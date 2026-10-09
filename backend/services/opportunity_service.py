"""
JobTracker SaaS - Service Opportunity

Couche métier unique pour les opportunités : routes utilisateur, API agent et
futur MCP l'appellent, aucune logique parallèle.

Toutes les fonctions sont strictement scopées par `user_id`, qui doit provenir
de l'authentification (JWT ou token agent), jamais d'un payload.
"""

import asyncio
import logging
import re
import unicodedata
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from models import (
    Opportunity, OpportunityCreate, OpportunityUpdate,
    OpportunityStatus, OpportunityIngestResult,
    ApplicationStatus, JobApplicationCreate, JobType,
)
from services.application_service import create_application_record
from utils.job_urls import normalize_job_url, detect_platform

logger = logging.getLogger(__name__)

COLLECTION = "opportunities"

# Conversion : une réservation (converted_application_id posé, statut pas encore
# `converted`) plus ancienne que ce délai est considérée abandonnée (crash,
# timeout serverless) et peut être reprise.
CONVERSION_STALE_AFTER = timedelta(seconds=60)
# Attente max d'une conversion concurrente en cours avant de répondre 409.
CONVERSION_WAIT_SECONDS = 5.0
CONVERSION_POLL_INTERVAL = 0.05

_DATETIME_FIELDS = ("discovered_at", "created_at", "updated_at", "converted_at")

# Bases dont les index ont déjà été vérifiés dans ce process
_indexed_dbs: set = set()


class OpportunityNotFound(Exception):
    """Opportunité inexistante ou appartenant à un autre utilisateur."""


class OpportunityConflict(Exception):
    """Transition de statut interdite (ex: modifier une opportunité convertie)."""


class OpportunityConversionInProgress(Exception):
    """Une conversion concurrente est en cours ; le client peut réessayer."""


# ============================================
# INDEX
# ============================================

async def ensure_indexes(db) -> None:
    """
    Crée les index de la collection (idempotent).

    Appelé paresseusement par le service : sur Vercel, le lifespan FastAPI ne
    s'exécute pas, on ne peut donc pas compter sur la création au démarrage.
    Le dédoublonnage concurrent repose sur les index uniques.
    """
    key = (id(db.client), db.name)
    if key in _indexed_dbs:
        return

    coll = db[COLLECTION]
    await coll.create_index("id", unique=True, name="opp_id_unique")
    await coll.create_index(
        [("user_id", 1), ("discovered_at", -1)],
        name="opp_user_discovered",
    )
    await coll.create_index(
        [("user_id", 1), ("status", 1), ("discovered_at", -1)],
        name="opp_user_status_discovered",
    )
    # Dédoublonnage URL (obligatoire)
    await coll.create_index(
        [("user_id", 1), ("url_normalized", 1)],
        unique=True,
        name="opp_user_url_unique",
    )
    # Dédoublonnage par identifiant fournisseur, uniquement si external_id présent
    await coll.create_index(
        [("user_id", 1), ("source", 1), ("external_id", 1)],
        unique=True,
        name="opp_user_source_external_id_unique",
        partialFilterExpression={"external_id": {"$type": "string"}},
    )
    _indexed_dbs.add(key)


# ============================================
# HELPERS
# ============================================

def _utc(dt: datetime) -> datetime:
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)


def _to_document(opportunity: Opportunity) -> dict:
    """Sérialise vers MongoDB (dates en ISO strings, comme le reste du repo)."""
    doc = opportunity.model_dump()
    doc["status"] = opportunity.status.value
    for field in _DATETIME_FIELDS:
        if doc.get(field) is not None:
            doc[field] = _utc(doc[field]).isoformat()
    return doc


async def _find_duplicate(coll, user_id: str, source: str, external_id: Optional[str], url_normalized: str):
    """Retourne (document, raison) d'un doublon existant, ou (None, None)."""
    if external_id:
        existing = await coll.find_one(
            {"user_id": user_id, "source": source, "external_id": external_id},
            {"_id": 0, "id": 1},
        )
        if existing:
            return existing, "external_id"

    existing = await coll.find_one(
        {"user_id": user_id, "url_normalized": url_normalized},
        {"_id": 0, "id": 1},
    )
    if existing:
        return existing, "url"
    return None, None


# ============================================
# INGESTION (idempotente)
# ============================================

async def find_existing_opportunity(db, user_id: str, data: OpportunityCreate) -> Optional[OpportunityIngestResult]:
    """
    Retourne le résultat « doublon » si l'offre existe déjà pour cet utilisateur,
    sinon None. Lecture seule (utilisé avant de consommer un quota).
    """
    await ensure_indexes(db)
    existing, reason = await _find_duplicate(
        db[COLLECTION], user_id, data.source, data.external_id, normalize_job_url(data.url)
    )
    if not existing:
        return None
    return OpportunityIngestResult(
        created=False, duplicate=True, opportunity_id=existing["id"], duplicate_reason=reason,
    )


async def ingest_opportunity(
    db, user_id: str, data: OpportunityCreate, watch: Optional[dict] = None,
) -> OpportunityIngestResult:
    """
    Crée une opportunité si elle n'existe pas déjà pour cet utilisateur.

    `watch` (veille ChatGPT, Lot 2) : sous-document de pertinence, écrit uniquement
    à la création. Absent : document strictement identique au Lot 1.

    Dédoublonnage, par priorité :
      1. (user_id, source, external_id) si external_id fourni ;
      2. (user_id, url_normalized).

    L'insertion passe par un upsert $setOnInsert sur la clé URL : deux appels
    concurrents ne peuvent pas créer deux documents (index unique).
    """
    await ensure_indexes(db)
    coll = db[COLLECTION]
    url_normalized = normalize_job_url(data.url)

    existing, reason = await _find_duplicate(coll, user_id, data.source, data.external_id, url_normalized)
    if existing:
        return OpportunityIngestResult(
            created=False, duplicate=True,
            opportunity_id=existing["id"], duplicate_reason=reason,
        )

    now = datetime.now(timezone.utc)
    opportunity = Opportunity(
        **data.model_dump(exclude={"discovered_at"}),
        user_id=user_id,
        url_normalized=url_normalized,
        discovered_at=_utc(data.discovered_at) if data.discovered_at else now,
        created_at=now,
        updated_at=now,
        watch=watch,
    )
    doc = _to_document(opportunity)
    if watch is None:
        doc.pop("watch", None)

    try:
        result = await coll.update_one(
            {"user_id": user_id, "url_normalized": url_normalized},
            {"$setOnInsert": doc},
            upsert=True,
        )
        if result.upserted_id is not None:
            return OpportunityIngestResult(
                created=True, duplicate=False, opportunity_id=opportunity.id,
            )
    except DuplicateKeyError:
        # Course concurrente ou collision external_id avec une autre URL
        pass

    existing, reason = await _find_duplicate(coll, user_id, data.source, data.external_id, url_normalized)
    if existing:
        return OpportunityIngestResult(
            created=False, duplicate=True,
            opportunity_id=existing["id"], duplicate_reason=reason,
        )
    raise RuntimeError("Ingestion d'opportunité incohérente : ni créée ni retrouvée")


# ============================================
# LECTURE
# ============================================

async def list_opportunities(
    db,
    user_id: str,
    status: Optional[OpportunityStatus] = None,
    search: Optional[str] = None,
    page: int = 1,
    per_page: int = 20,
) -> dict:
    """Liste paginée (format PaginatedResponse), plus récentes d'abord."""
    await ensure_indexes(db)
    query: dict = {"user_id": user_id}
    if status:
        query["status"] = OpportunityStatus(status).value
    if search and search.strip():
        regex = {"$regex": re.escape(search.strip()), "$options": "i"}
        query["$or"] = [{"title": regex}, {"company": regex}]

    total = await db[COLLECTION].count_documents(query)
    cursor = (
        db[COLLECTION]
        .find(query, {"_id": 0, "url_normalized": 0})
        .sort([("discovered_at", -1), ("created_at", -1)])
        .skip((page - 1) * per_page)
        .limit(per_page)
    )
    items = await cursor.to_list(length=per_page)
    return {
        "items": items,
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": (total + per_page - 1) // per_page,
    }


async def list_recent_summary(db, user_id: str, days: int, limit: int, now: Optional[datetime] = None) -> dict:
    """
    Résumé MINIMAL des opportunités récentes du compte (outil MCP `list_recent_opportunities`,
    spécification §5.3) : titre, entreprise, URL, statut, date. Toutes sources confondues, pour
    que ChatGPT ne repropose pas une offre déjà connue. Aucune description ni autre donnée.
    """
    await ensure_indexes(db)
    # Dates stockées en ISO UTC (`_to_document`) : la comparaison de chaînes suit l'ordre temporel
    since = _utc((now or datetime.now(timezone.utc)) - timedelta(days=days)).isoformat()
    query = {"user_id": user_id, "discovered_at": {"$gte": since}}
    total = await db[COLLECTION].count_documents(query)
    cursor = (
        db[COLLECTION]
        .find(query, {"_id": 0, "title": 1, "company": 1, "url": 1, "status": 1, "discovered_at": 1})
        .sort([("discovered_at", -1), ("created_at", -1)])
        .limit(limit)
    )
    items = [
        {"title": d.get("title"), "company": d.get("company"), "url": d.get("url"), "status": d.get("status"),
         "discovered_at": d.get("discovered_at")}
        async for d in cursor
    ]
    return {"items": items, "total": total, "days": days}


async def get_opportunity(db, user_id: str, opportunity_id: str) -> dict:
    opportunity = await db[COLLECTION].find_one(
        {"id": opportunity_id, "user_id": user_id},
        {"_id": 0, "url_normalized": 0},
    )
    if not opportunity:
        raise OpportunityNotFound(opportunity_id)
    return opportunity


async def count_new_opportunities(db, user_id: str) -> int:
    """Compteur du badge de navigation."""
    return await db[COLLECTION].count_documents(
        {"user_id": user_id, "status": OpportunityStatus.NEW.value}
    )


# ============================================
# MODIFICATIONS
# ============================================

async def update_opportunity(db, user_id: str, opportunity_id: str, update: OpportunityUpdate) -> dict:
    """
    Met à jour les champs éditables. Un changement de statut (new <-> ignored)
    est refusé si l'opportunité est déjà convertie.
    """
    update_data = update.model_dump(exclude_unset=True)
    # Les champs obligatoires ne peuvent pas être vidés
    for required in ("title", "company"):
        if required in update_data and update_data[required] is None:
            del update_data[required]

    query: dict = {"id": opportunity_id, "user_id": user_id}
    if "status" in update_data:
        if update_data["status"] is None:
            del update_data["status"]
        else:
            # Ni convertie, ni en cours de conversion
            query["status"] = {"$ne": OpportunityStatus.CONVERTED.value}
            query["converted_application_id"] = None

    if not update_data:
        return await get_opportunity(db, user_id, opportunity_id)

    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    updated = await db[COLLECTION].find_one_and_update(
        query,
        {"$set": update_data},
        projection={"_id": 0, "url_normalized": 0},
        return_document=ReturnDocument.AFTER,
    )
    if updated:
        return updated

    # Distinguer « introuvable » de « transition interdite »
    await get_opportunity(db, user_id, opportunity_id)
    raise OpportunityConflict("Une opportunité convertie (ou en cours de conversion) ne peut pas changer de statut")


async def ignore_opportunity(db, user_id: str, opportunity_id: str) -> dict:
    """
    Passe une opportunité `new` en `ignored` (idempotent si déjà ignorée).
    Ne supprime jamais : le document empêche une réimportation ultérieure.
    """
    updated = await db[COLLECTION].find_one_and_update(
        {
            "id": opportunity_id,
            "user_id": user_id,
            "status": OpportunityStatus.NEW.value,
            "converted_application_id": None,
        },
        {"$set": {
            "status": OpportunityStatus.IGNORED.value,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
        projection={"_id": 0, "url_normalized": 0},
        return_document=ReturnDocument.AFTER,
    )
    if updated:
        return updated

    current = await get_opportunity(db, user_id, opportunity_id)
    if current["status"] == OpportunityStatus.IGNORED.value:
        return current
    raise OpportunityConflict("Une opportunité convertie (ou en cours de conversion) ne peut pas être ignorée")


# ============================================
# MAPPING Opportunity -> Application
# ============================================

# Limites du modèle Application (JobApplicationBase)
APPLICATION_LIEU_MAX = 100
APPLICATION_LIEN_MAX = 500
APPLICATION_DESCRIPTION_MAX = 5000
APPLICATION_COMMENTAIRE_MAX = 2000

# Libellés normalisés (minuscules, sans accents, séparateurs -> espace)
_CONTRACT_TYPE_ALIASES = {
    JobType.CDI: {"cdi", "contrat a duree indeterminee", "permanent", "permanent contract"},
    JobType.CDD: {"cdd", "contrat a duree determinee", "fixed term", "fixed term contract"},
    JobType.STAGE: {"stage", "stagiaire", "internship", "intern"},
    JobType.ALTERNANCE: {
        "alternance", "apprentissage", "apprenticeship", "apprenti",
        "contrat pro", "contrat de professionnalisation", "work study",
    },
    JobType.FREELANCE: {"freelance", "free lance", "independant", "contractor"},
    JobType.INTERIM: {"interim", "temporary", "temp", "travail temporaire"},
    JobType.MASTERE: {"mastere", "mastere specialise"},
}
_CONTRACT_TYPE_LOOKUP = {alias: jt for jt, aliases in _CONTRACT_TYPE_ALIASES.items() for alias in aliases}


def _normalize_label(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    value = re.sub(r"[-_/]+", " ", value.lower())
    return re.sub(r"\s+", " ", value).strip()


def map_contract_type(value: Optional[str]) -> tuple:
    """
    Retourne (JobType, reconnu).
    Valeur absente ou inconnue -> CDI (défaut du modèle Application), reconnu=False.
    """
    if not value or not value.strip():
        return JobType.CDI, False
    job_type = _CONTRACT_TYPE_LOOKUP.get(_normalize_label(value))
    return (job_type, True) if job_type else (JobType.CDI, False)


def _truncate(text: Optional[str], max_length: int) -> Optional[str]:
    if text is None or len(text) <= max_length:
        return text
    return text[: max_length - 1].rstrip() + "…"


def _build_lieu(location: Optional[str], country: Optional[str]) -> Optional[str]:
    location = (location or "").strip()
    country = (country or "").strip()
    if location and country and country.lower() not in location.lower():
        lieu = f"{location}, {country}"
    else:
        lieu = location or country
    return _truncate(lieu, APPLICATION_LIEU_MAX) or None


def build_application_from_opportunity(opportunity: dict) -> JobApplicationCreate:
    """
    Construit la candidature (to_apply) issue d'une opportunité.

    Les champs plus longs que les limites Application sont tronqués ; les
    informations perdues (contrat non reconnu, URL trop longue, description
    coupée) sont tracées dans `commentaire`.
    """
    notes = []

    job_type, recognized = map_contract_type(opportunity.get("contract_type"))
    if opportunity.get("contract_type") and not recognized:
        notes.append(f"Type de contrat d'origine : {opportunity['contract_type']}")

    url = opportunity["url"]
    lien = url
    if len(lien) > APPLICATION_LIEN_MAX:
        normalized = opportunity.get("url_normalized")
        lien = normalized if normalized and len(normalized) <= APPLICATION_LIEN_MAX else None
        if lien is None:
            notes.append(f"Lien de l'offre : {url}")

    description = opportunity.get("description")
    if description and len(description) > APPLICATION_DESCRIPTION_MAX:
        notes.append("Description tronquée : texte complet dans l'opportunité d'origine.")

    return JobApplicationCreate(
        entreprise=opportunity["company"],
        poste=opportunity["title"],
        type_poste=job_type,
        lieu=_build_lieu(opportunity.get("location"), opportunity.get("country")),
        moyen=detect_platform(url),
        # Valeur technique : sans valeur métier tant que reponse = to_apply
        date_candidature=datetime.now(timezone.utc),
        lien=lien,
        commentaire=_truncate("\n".join(notes), APPLICATION_COMMENTAIRE_MAX) or None,
        description_poste=_truncate(description, APPLICATION_DESCRIPTION_MAX),
        source=f"opportunity:{opportunity.get('source') or 'other'}",
    )


# ============================================
# CONVERSION Opportunity -> Application (idempotente)
# ============================================

def _parse_iso(value) -> Optional[datetime]:
    if not value:
        return None
    if isinstance(value, datetime):
        return _utc(value)
    try:
        return _utc(datetime.fromisoformat(str(value).replace("Z", "+00:00")))
    except ValueError:
        return None


def _conversion_result(opportunity_id: str, application_id: str, created: bool) -> dict:
    return {"opportunity_id": opportunity_id, "application_id": application_id, "created": created}


async def _finalize_conversion(db, user_id: str, opportunity_id: str, application_id: str) -> bool:
    """Marque l'opportunité convertie si la réservation est toujours la nôtre."""
    now = datetime.now(timezone.utc).isoformat()
    result = await db[COLLECTION].update_one(
        {"id": opportunity_id, "user_id": user_id, "converted_application_id": application_id},
        {
            "$set": {"status": OpportunityStatus.CONVERTED.value, "converted_at": now, "updated_at": now},
            "$unset": {"conversion_started_at": ""},
        },
    )
    return result.matched_count == 1


async def _rollback_conversion(db, user_id: str, opportunity_id: str, application_id: str) -> None:
    """
    Annule une tentative : supprime la candidature éventuellement insérée
    (identifiant propre à cette tentative) et libère la réservation.
    Si le rollback échoue, la réservation expire (CONVERSION_STALE_AFTER) :
    l'opportunité n'est jamais bloquée définitivement.
    """
    try:
        await db.applications.delete_one({"id": application_id, "user_id": user_id})
        await db[COLLECTION].update_one(
            {
                "id": opportunity_id,
                "user_id": user_id,
                "converted_application_id": application_id,
                "status": {"$ne": OpportunityStatus.CONVERTED.value},
            },
            {"$set": {"converted_application_id": None}, "$unset": {"conversion_started_at": ""}},
        )
    except Exception:
        logger.exception("Rollback de conversion échoué (opportunity_id=%s)", opportunity_id)


async def _perform_conversion(db, user_id: str, opportunity: dict, application_id: str) -> Optional[dict]:
    """
    Exécute une conversion dont la réservation `application_id` est acquise.
    Retourne None si la réservation a été reprise entre-temps (tentative jugée
    abandonnée) : la candidature créée est alors supprimée.
    """
    opportunity_id = opportunity["id"]
    try:
        app_data = build_application_from_opportunity(opportunity)
        await create_application_record(
            db,
            user_id,
            app_data,
            default_source=app_data.source,
            reponse=ApplicationStatus.TO_APPLY,
            application_id=application_id,
        )
    except Exception:
        await _rollback_conversion(db, user_id, opportunity_id, application_id)
        raise

    if await _finalize_conversion(db, user_id, opportunity_id, application_id):
        return _conversion_result(opportunity_id, application_id, created=True)

    # Réservation perdue : compenser pour ne jamais laisser deux candidatures
    await db.applications.delete_one({"id": application_id, "user_id": user_id})
    return None


async def _claim(db, query: dict):
    """Pose atomiquement une réservation de conversion. Retourne (doc, app_id) ou None."""
    application_id = str(uuid.uuid4())
    claimed = await db[COLLECTION].find_one_and_update(
        query,
        {"$set": {
            "converted_application_id": application_id,
            "conversion_started_at": datetime.now(timezone.utc).isoformat(),
        }},
        projection={"_id": 0},
        return_document=ReturnDocument.AFTER,
    )
    return (claimed, application_id) if claimed else None


async def convert_opportunity(db, user_id: str, opportunity_id: str) -> dict:
    """
    Convertit une opportunité en candidature `to_apply`. Idempotent.

    Réservation atomique : `converted_application_id` est posé par un
    find_one_and_update conditionné à `converted_application_id: null`.
    Un seul appel gagne, même sous concurrence ; les autres attendent la fin
    de la conversion et renvoient la même candidature.

    Reprise si une réservation existe sans opportunité finalisée :
      - la candidature existe déjà -> on finalise (crash après insertion) ;
      - réservation expirée -> reprise atomique (crash avant insertion) ;
      - sinon -> attente, puis OpportunityConversionInProgress.
    """
    await ensure_indexes(db)
    coll = db[COLLECTION]
    loop = asyncio.get_running_loop()
    deadline = loop.time() + CONVERSION_WAIT_SECONDS

    while True:
        if loop.time() >= deadline:
            raise OpportunityConversionInProgress(opportunity_id)

        opportunity = await coll.find_one({"id": opportunity_id, "user_id": user_id}, {"_id": 0})
        if not opportunity:
            raise OpportunityNotFound(opportunity_id)

        reserved_id = opportunity.get("converted_application_id")

        if opportunity["status"] == OpportunityStatus.CONVERTED.value and reserved_id:
            return _conversion_result(opportunity_id, reserved_id, created=False)

        if reserved_id is None:
            claim = await _claim(db, {
                "id": opportunity_id,
                "user_id": user_id,
                "status": {"$in": [OpportunityStatus.NEW.value, OpportunityStatus.IGNORED.value]},
                "converted_application_id": None,
            })
            if claim:
                result = await _perform_conversion(db, user_id, *claim)
                if result:
                    return result
            continue  # état modifié par un appel concurrent : relire

        # Réservation en cours ou abandonnée
        if await db.applications.find_one({"id": reserved_id, "user_id": user_id}, {"_id": 1}):
            await _finalize_conversion(db, user_id, opportunity_id, reserved_id)
            continue

        started_at = _parse_iso(opportunity.get("conversion_started_at"))
        if started_at is None or datetime.now(timezone.utc) - started_at > CONVERSION_STALE_AFTER:
            claim = await _claim(db, {
                "id": opportunity_id,
                "user_id": user_id,
                "status": {"$ne": OpportunityStatus.CONVERTED.value},
                "converted_application_id": reserved_id,
            })
            if claim:
                logger.warning("Reprise d'une conversion abandonnée (opportunity_id=%s)", opportunity_id)
                result = await _perform_conversion(db, user_id, *claim)
                if result:
                    return result
            continue

        # Conversion concurrente en cours : attendre sa fin
        await asyncio.sleep(CONVERSION_POLL_INTERVAL)
