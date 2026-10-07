"""
JobTracker SaaS - Service AgentToken

Tokens d'API pour les systèmes externes (veille, futur MCP...).

Format : `jt_agent_` + 43 caractères base64url (256 bits aléatoires, `secrets`).
Stockage : uniquement le SHA-256 du token (`token_hash`) et un préfixe
d'affichage (`token_prefix`). Le token brut n'est retourné qu'une fois, à la
création, et n'est jamais journalisé.

Pourquoi SHA-256 et pas bcrypt : le token a 256 bits d'entropie, une attaque
par dictionnaire/force brute sur le hash est impossible ; un hash rapide et
déterministe permet une recherche directe par index unique (un seul accès DB
par authentification).
"""

import asyncio
import hashlib
import logging
import re
import secrets
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from config import settings
from models import AGENT_TOKEN_PREFIX, AgentTokenCreate, OpportunityCreate, OpportunityIngestResult
from services import opportunity_service

logger = logging.getLogger("jobtracker.agent")

TOKENS = "agent_tokens"
USAGE = "agent_token_usage"

_TOKEN_RANDOM_BYTES = 32  # -> 43 caractères base64url
_TOKEN_RE = re.compile(r"^" + re.escape(AGENT_TOKEN_PREFIX) + r"[A-Za-z0-9_-]{43}$")
_DISPLAY_PREFIX_LENGTH = len(AGENT_TOKEN_PREFIX) + 4  # ex: jt_agent_a82f
_USAGE_RETENTION = timedelta(days=90)

# Contention sur le quota (réservations concurrentes en vol)
QUOTA_CONTENTION_WAIT_SECONDS = 1.0
QUOTA_CONTENTION_POLL_SECONDS = 0.02

_PUBLIC_PROJECTION = {"_id": 0, "token_hash": 0}

_indexed_dbs: set = set()


class AgentTokenNotFound(Exception):
    """Token inexistant ou appartenant à un autre utilisateur."""


class AgentTokenLimitReached(Exception):
    """Nombre maximum de tokens actifs atteint pour cet utilisateur."""


class AgentQuotaExceeded(Exception):
    def __init__(self, quota: int):
        super().__init__(f"Quota journalier de créations atteint ({quota})")
        self.quota = quota


# ============================================
# INDEX
# ============================================

async def ensure_indexes(db) -> None:
    """Idempotent, appelé paresseusement (lifespan absent sur Vercel)."""
    key = (id(db.client), db.name)
    if key in _indexed_dbs:
        return
    await db[TOKENS].create_index("id", unique=True, name="agent_token_id_unique")
    await db[TOKENS].create_index("token_hash", unique=True, name="agent_token_hash_unique")
    await db[TOKENS].create_index([("user_id", 1), ("created_at", -1)], name="agent_token_user_created")
    await db[USAGE].create_index(
        [("token_id", 1), ("date", 1)], unique=True, name="agent_usage_token_date_unique"
    )
    await db[USAGE].create_index("expires_at", expireAfterSeconds=0, name="agent_usage_ttl")
    _indexed_dbs.add(key)


# ============================================
# TOKEN : génération / hash
# ============================================

def generate_token() -> str:
    return AGENT_TOKEN_PREFIX + secrets.token_urlsafe(_TOKEN_RANDOM_BYTES)


def hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def is_well_formed(raw_token: Optional[str]) -> bool:
    return bool(raw_token) and bool(_TOKEN_RE.match(raw_token))


def _public(doc: dict) -> dict:
    doc = {k: v for k, v in doc.items() if k not in ("_id", "token_hash")}
    doc["is_active"] = doc.get("revoked_at") is None
    return doc


# ============================================
# GESTION (API utilisateur, JWT)
# ============================================

async def create_agent_token(db, user_id: str, data: AgentTokenCreate) -> tuple:
    """Crée un token. Retourne (métadonnées publiques, token brut à afficher une fois)."""
    await ensure_indexes(db)

    active = await db[TOKENS].count_documents({"user_id": user_id, "revoked_at": None})
    if active >= settings.AGENT_MAX_ACTIVE_TOKENS:
        raise AgentTokenLimitReached()

    raw_token = generate_token()
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "name": data.name,
        "token_prefix": raw_token[:_DISPLAY_PREFIX_LENGTH],
        "token_hash": hash_token(raw_token),
        "scopes": [s.value for s in data.scopes],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_used_at": None,
        "revoked_at": None,
    }
    await db[TOKENS].insert_one(doc)
    logger.info("agent_token_created token_id=%s prefix=%s user_id=%s", doc["id"], doc["token_prefix"], user_id)
    return _public(doc), raw_token


async def list_agent_tokens(db, user_id: str) -> list:
    await ensure_indexes(db)
    cursor = db[TOKENS].find({"user_id": user_id}, _PUBLIC_PROJECTION).sort("created_at", -1)
    return [_public(doc) for doc in await cursor.to_list(length=200)]


async def revoke_agent_token(db, user_id: str, token_id: str) -> dict:
    """Révocation immédiate (idempotente). L'enregistrement est conservé pour audit."""
    now = datetime.now(timezone.utc).isoformat()
    doc = await db[TOKENS].find_one_and_update(
        {"id": token_id, "user_id": user_id, "revoked_at": None},
        {"$set": {"revoked_at": now}},
        projection=_PUBLIC_PROJECTION,
        return_document=ReturnDocument.AFTER,
    )
    if doc:
        logger.info("agent_token_revoked token_id=%s user_id=%s", token_id, user_id)
        return _public(doc)

    existing = await db[TOKENS].find_one({"id": token_id, "user_id": user_id}, _PUBLIC_PROJECTION)
    if not existing:
        raise AgentTokenNotFound(token_id)
    return _public(existing)


# ============================================
# AUTHENTIFICATION
# ============================================

async def authenticate_agent_token(db, raw_token: Optional[str]) -> Optional[dict]:
    """
    Retourne le document du token si valide, sinon None.
    Format -> hash -> lookup (index unique) -> révoqué ? -> compte actif ?
    """
    if not is_well_formed(raw_token):
        return None
    await ensure_indexes(db)
    token = await db[TOKENS].find_one({"token_hash": hash_token(raw_token)}, {"_id": 0})
    if not token or token.get("revoked_at") is not None:
        return None

    user = await db.users.find_one({"id": token["user_id"]}, {"_id": 0, "is_active": 1})
    if not user or not user.get("is_active", True):
        return None
    return token


async def touch_last_used(db, token: dict) -> None:
    """
    Met à jour last_used_at au plus une fois par AGENT_LAST_USED_THROTTLE_SECONDS
    (décision prise sur le document déjà lu : aucune écriture superflue).
    """
    now = datetime.now(timezone.utc)
    last = token.get("last_used_at")
    if last:
        try:
            last_dt = datetime.fromisoformat(str(last).replace("Z", "+00:00"))
            if (now - last_dt).total_seconds() < settings.AGENT_LAST_USED_THROTTLE_SECONDS:
                return
        except ValueError:
            pass
    await db[TOKENS].update_one({"id": token["id"]}, {"$set": {"last_used_at": now.isoformat()}})


# ============================================
# QUOTA PERSISTANT (créations / jour UTC / token)
# ============================================

def _today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def seconds_until_quota_reset() -> int:
    now = datetime.now(timezone.utc)
    tomorrow = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return max(1, int((tomorrow - now).total_seconds()))


async def _reserve_creation(db, token_id: str, user_id: str, day: str, quota: int) -> bool:
    """
    Réserve atomiquement une création si le compteur du jour est < quota.
    Jamais de dépassement, même sous concurrence (condition + $inc atomiques).
    """
    if quota <= 0:
        return False
    query = {"token_id": token_id, "date": day, "creations": {"$lt": quota}}
    try:
        await db[USAGE].update_one(
            query,
            {
                "$inc": {"creations": 1},
                "$setOnInsert": {
                    "user_id": user_id,
                    "expires_at": datetime.now(timezone.utc) + _USAGE_RETENTION,
                },
            },
            upsert=True,
        )
        return True
    except DuplicateKeyError:
        # Le document du jour existe : soit quota atteint (filtre non satisfait),
        # soit course entre deux premiers appels du jour -> réessai sans upsert.
        result = await db[USAGE].update_one(query, {"$inc": {"creations": 1}})
        return result.modified_count == 1


async def _release_creation(db, token_id: str, day: str) -> None:
    await db[USAGE].update_one(
        {"token_id": token_id, "date": day, "creations": {"$gt": 0}},
        {"$inc": {"creations": -1}},
    )


async def get_creations_today(db, token_id: str) -> int:
    doc = await db[USAGE].find_one({"token_id": token_id, "date": _today()}, {"creations": 1})
    return doc["creations"] if doc else 0


async def ingest_opportunity_as_agent(db, token: dict, data: OpportunityCreate) -> OpportunityIngestResult:
    """
    Ingestion via token agent, en réutilisant OpportunityService.

    Sémantique du quota :
      - création réelle -> +1 ;
      - doublon (détecté avant ou pendant l'insertion) -> +0 ;
      - erreur -> +0 (réservation libérée).
    Un doublon reste accepté même quota épuisé (retry de veille sûr).
    """
    user_id = token["user_id"]

    duplicate = await opportunity_service.find_existing_opportunity(db, user_id, data)
    if duplicate:
        return duplicate

    day = _today()
    quota = settings.AGENT_DAILY_CREATE_QUOTA
    loop = asyncio.get_running_loop()
    deadline = loop.time() + QUOTA_CONTENTION_WAIT_SECONDS
    # Réservation impossible : peut être due à des réservations en vol pour la
    # MÊME offre (requêtes identiques concurrentes). On revérifie le doublon et
    # on réessaie brièvement avant de conclure à un quota épuisé.
    while not await _reserve_creation(db, token["id"], user_id, day, quota):
        duplicate = await opportunity_service.find_existing_opportunity(db, user_id, data)
        if duplicate:
            return duplicate
        if loop.time() >= deadline:
            raise AgentQuotaExceeded(quota)
        await asyncio.sleep(QUOTA_CONTENTION_POLL_SECONDS)

    try:
        result = await opportunity_service.ingest_opportunity(db, user_id, data)
    except Exception:
        await _release_creation(db, token["id"], day)
        raise

    if not result.created:
        await _release_creation(db, token["id"], day)
    return result
