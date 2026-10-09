"""
JobTracker SaaS - Ingestion de la veille ChatGPT (Lot 2)

Point d'entrée unique que l'outil MCP `create_opportunities` appellera (étape 3).
Aucune route HTTP n'expose l'ingestion à cette étape.

Trois niveaux de clés (§7.2 de la spécification) :
  - exécution  : watch_runs(user_id, run_id)            -> compteurs, avertissements, rapport ;
  - élément    : watch_run_items(user_id, run_id, key)  -> résultat rejouable ;
  - offre      : opportunities (index uniques du Lot 1) -> jamais deux fois la même offre.

Ordre de traitement d'un élément (§7.3) : validation -> réservation de l'élément ->
doublon AVANT quota -> réservation atomique des quotas (exécution puis jour) ->
ingestion -> finalisation. Un doublon ou un rejet ne consomme jamais de quota ;
les plafonds ne sont jamais dépassés, même en concurrence (mises à jour conditionnelles).
"""

import asyncio
import dataclasses
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from pydantic import ValidationError
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from config import settings
from models import WATCH_SOURCE, OpportunityCreate
from models.watch import (
    WatchBatchRequest, WatchBatchResult, WatchBatchSummary, WatchItemResult,
    WatchRunCounts, WatchRunListResponse, WatchRunReport, WatchRunReportResult,
    WatchRunSummary, WatchRunTotals, WatchStatusResponse,
)
from services import opportunity_service
from services import watch_preferences_service
from utils.watch_validation import (
    ItemCheck, ParsedRunId, RunIdError, check_item, paris_day, paris_instants, parse_run_id,
)

logger = logging.getLogger("jobtracker.watch")

RUNS = "watch_runs"
ITEMS = "watch_run_items"
USAGE = "watch_usage"

ITEM_RETENTION = timedelta(days=30)
USAGE_RETENTION = timedelta(days=8)
# Attente d'un élément traité par un appel concurrent avant de répondre `in_progress`
ITEM_WAIT_SECONDS = 2.0
# Attente bornée quand le plafond d'exécution est atteint par des réservations en vol
RUN_CAP_WAIT_SECONDS = 2.0
POLL_SECONDS = 0.05
# Absence présumée : un créneau déclaré passé depuis plus de ce délai, sans exécution reçue
MISSING_SLOT_GRACE = timedelta(minutes=30)
MISSING_SLOT_LOOKBACK = timedelta(hours=24)

_indexed_dbs: set = set()


class WatchNotEnabled(Exception):
    """La veille n'est pas activée pour ce compte (drapeau admin `watch_enabled`)."""


class WatchRequestError(Exception):
    """Appel refusé dans son ensemble. `code` : invalid_arguments | invalid_run_id |
    run_id_out_of_window. `details` ne contient jamais les valeurs reçues."""

    def __init__(self, code: str, details: Optional[list] = None):
        super().__init__(code)
        self.code = code
        self.details = details or []


# ============================================
# INDEX ET OUTILS
# ============================================

async def ensure_indexes(db) -> None:
    """Index créés paresseusement (le lifespan ne tourne pas sur Vercel)."""
    key = (id(db.client), db.name)
    if key in _indexed_dbs:
        return
    await db[RUNS].create_index([("user_id", 1), ("run_id", 1)], unique=True, name="watch_run_unique")
    await db[RUNS].create_index([("user_id", 1), ("last_seen_at", -1)], name="watch_run_recent")
    await db[RUNS].create_index([("user_id", 1), ("kind", 1), ("scheduled_for", 1)], name="watch_run_slot")
    await db[ITEMS].create_index(
        [("user_id", 1), ("run_id", 1), ("item_key", 1)], unique=True, name="watch_item_unique",
    )
    await db[ITEMS].create_index("expires_at", expireAfterSeconds=0, name="watch_item_ttl")
    await db[USAGE].create_index([("user_id", 1), ("day", 1)], unique=True, name="watch_usage_unique")
    await db[USAGE].create_index("expires_at", expireAfterSeconds=0, name="watch_usage_ttl")
    _indexed_dbs.add(key)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _aware(dt: datetime) -> datetime:
    # Motor renvoie des dates naïves (UTC)
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


def _error_details(error: ValidationError) -> list:
    """Emplacement et type de chaque erreur, sans écho des valeurs reçues."""
    return [{"loc": [str(p) for p in err.get("loc", ())], "type": err["type"]} for err in error.errors()]


def _run_cap(prefs: dict) -> int:
    return min(prefs["max_per_run"], settings.WATCH_MAX_PER_RUN)


async def require_enabled(db, user_id: str) -> None:
    """Défense en profondeur : vérifiée par le service, pas seulement par les routes."""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "watch_enabled": 1, "is_active": 1})
    if not user or not user.get("is_active", True) or user.get("watch_enabled") is not True:
        raise WatchNotEnabled()


# ============================================
# EXÉCUTIONS
# ============================================

RUN_KEY_SEPARATOR = "#"


async def _run_storage_key(db, user_id: str, run_id: str, client_id: Optional[str]) -> str:
    """
    Clé de stockage d'une exécution, ISOLÉE PAR CLIENT (P2.1) : deux clients qui emploient le même
    `run_id` (ex. le créneau 08:00 « prog ») ont deux exécutions distinctes (compteurs, plafond
    de 20, éléments rejouables, rapport). Le quota journalier reste commun au compte.
    - sans client (appel interne) : le run_id tel quel ;
    - exécution antérieure à P2 sous ce run_id, ouverte par CE client ou sans client connu :
      on la poursuit sous sa clé d'origine (aucune migration, reprise jusqu'à 24 h préservée) ;
    - sinon : « run_id#client_id ».
    Le run_id renvoyé aux clients reste toujours celui qu'ils ont envoyé.
    """
    if not client_id:
        return run_id
    legacy = await db[RUNS].find_one({"user_id": user_id, "run_id": run_id}, {"_id": 0, "client_ids": 1})
    if legacy is not None and set(legacy.get("client_ids") or []) <= {client_id}:
        return run_id
    return f"{run_id}{RUN_KEY_SEPARATOR}{client_id}"


def _public_run(doc: dict) -> dict:
    """Document d'exécution tel qu'exposé : run_id d'origine, jamais la clé interne."""
    return {**doc, "run_id": doc.get("public_run_id") or doc["run_id"]}


async def _open_run(db, user_id: str, run_id: str, prefs: dict, now: datetime,
                    client_id: Optional[str] = None) -> ParsedRunId:
    """Valide le run_id (fenêtre « reprise » si déjà connu) et enregistre l'exécution.
    `client_id` : client OAuth VÉRIFIÉ, ajouté à `client_ids` (traçabilité, P1.4).
    Retourne le run_id analysé, dont `run_id` est la CLÉ DE STOCKAGE (isolée par client)."""
    runs = db[RUNS]
    key = await _run_storage_key(db, user_id, run_id, client_id)
    known = await runs.find_one({"user_id": user_id, "run_id": key}, {"_id": 1}) is not None
    try:
        parsed = parse_run_id(
            run_id, now,
            known_run=known,
            schedule_times=prefs["schedule"]["times"],
            past_hours=settings.WATCH_RUN_WINDOW_PAST_HOURS,
            resume_hours=settings.WATCH_RUN_RESUME_HOURS,
            future_minutes=settings.WATCH_RUN_WINDOW_FUTURE_MINUTES,
        )
    except RunIdError as e:
        raise WatchRequestError(e.code)

    query = {"user_id": user_id, "run_id": key}
    update = {
        "$setOnInsert": {
            "user_id": user_id,
            "run_id": key,
            "public_run_id": run_id,
            "kind": parsed.kind,
            "scheduled_for": parsed.scheduled_for.isoformat(),
            "quota_day": parsed.quota_day,
            "first_seen_at": now.isoformat(),
            "reserved": 0,
            "observed": WatchRunCounts().model_dump(),
            "warnings": list(parsed.warnings),
        },
        "$set": {"last_seen_at": now.isoformat()},
    }
    if client_id:
        update["$addToSet"] = {"client_ids": client_id}
    try:
        await runs.update_one(query, update, upsert=True)
    except DuplicateKeyError:
        # Premier appel concurrent de la même exécution : le document existe désormais
        await runs.update_one(query, {k: v for k, v in update.items() if k != "$setOnInsert"})
    return dataclasses.replace(parsed, run_id=key)


async def _reserve_run(db, user_id: str, run_id: str, cap: int) -> bool:
    """
    Réserve une création sur l'exécution si `reserved < cap` (atomique).
    Si le plafond est atteint par des réservations EN VOL (pas encore créées),
    attend brièvement leur issue : un doublon révélé libère sa place.
    """
    loop = asyncio.get_running_loop()
    deadline = loop.time() + RUN_CAP_WAIT_SECONDS
    query = {"user_id": user_id, "run_id": run_id}
    while True:
        result = await db[RUNS].update_one({**query, "reserved": {"$lt": cap}}, {"$inc": {"reserved": 1}})
        if result.modified_count == 1:
            return True
        doc = await db[RUNS].find_one(query, {"reserved": 1, "observed.created": 1})
        in_flight = doc["reserved"] - doc["observed"]["created"] if doc else 0
        if in_flight <= 0 or loop.time() >= deadline:
            return False
        await asyncio.sleep(POLL_SECONDS)


async def _release_run(db, user_id: str, run_id: str) -> None:
    await db[RUNS].update_one(
        {"user_id": user_id, "run_id": run_id, "reserved": {"$gt": 0}}, {"$inc": {"reserved": -1}},
    )


async def _reserve_day(db, user_id: str, day: str, quota: int) -> bool:
    """Réserve une création sur le jour (date du run_id, heure de Paris) si < quota."""
    query = {"user_id": user_id, "day": day, "creations": {"$lt": quota}}
    try:
        await db[USAGE].update_one(
            query,
            {"$inc": {"creations": 1}, "$setOnInsert": {"expires_at": _utcnow() + USAGE_RETENTION}},
            upsert=True,
        )
        return True
    except DuplicateKeyError:
        # Document du jour existant : quota atteint, ou course entre deux premiers appels
        result = await db[USAGE].update_one(query, {"$inc": {"creations": 1}})
        return result.modified_count == 1


async def _release_day(db, user_id: str, day: str) -> None:
    await db[USAGE].update_one(
        {"user_id": user_id, "day": day, "creations": {"$gt": 0}}, {"$inc": {"creations": -1}},
    )


async def _creations_on(db, user_id: str, day: str) -> int:
    doc = await db[USAGE].find_one({"user_id": user_id, "day": day}, {"creations": 1})
    return doc["creations"] if doc else 0


# ============================================
# ÉLÉMENTS
# ============================================

async def _claim_item(db, key: dict, claim_id: str) -> tuple:
    """
    Réserve l'élément pour ce traitement. Retourne :
      ("owned", doc)    : à traiter (doc = état repris d'un traitement interrompu, ou {}) ;
      ("replay", result): déjà traité, résultat enregistré ;
      ("busy", None)    : traitement concurrent en cours depuis moins du délai de reprise.
    """
    items = db[ITEMS]
    loop = asyncio.get_running_loop()
    deadline = loop.time() + ITEM_WAIT_SECONDS
    stale_after = timedelta(seconds=settings.WATCH_ITEM_STALE_SECONDS)

    while True:
        now = _utcnow()
        try:
            before = await items.find_one_and_update(
                key,
                {"$setOnInsert": {
                    **key, "state": "pending", "claim_id": claim_id, "claimed_at": now,
                    "expires_at": now + ITEM_RETENTION,
                }},
                upsert=True,
                return_document=ReturnDocument.BEFORE,
            )
        except DuplicateKeyError:
            before = await items.find_one(key)
        if before is None:
            return "owned", {}

        while before is not None:
            if before["state"] == "done":
                return "replay", before["result"]
            if _utcnow() - _aware(before["claimed_at"]) >= stale_after:
                # Traitement interrompu (crash, timeout serverless) : reprise atomique,
                # conditionnée au claim_id observé (un seul repreneur possible).
                taken = await items.find_one_and_update(
                    {**key, "state": "pending", "claim_id": before["claim_id"]},
                    {"$set": {"claim_id": claim_id, "claimed_at": _utcnow()}},
                    return_document=ReturnDocument.AFTER,
                )
                if taken is not None:
                    return "owned", taken
            elif loop.time() >= deadline:
                return "busy", None
            await asyncio.sleep(POLL_SECONDS)
            before = await items.find_one(key)
        # Élément relâché après une erreur : nouvelle tentative de réservation


async def _process_item(
    db, user_id: str, run: ParsedRunId, check: ItemCheck, prefs: dict, cap: int,
    client_id: Optional[str] = None, client_name: Optional[str] = None,
) -> WatchItemResult:
    key = {"user_id": user_id, "run_id": run.run_id, "item_key": check.item_key}
    claim_id = uuid.uuid4().hex
    outcome, state = await _claim_item(db, key, claim_id)
    if outcome == "replay":
        return WatchItemResult(index=0, replayed=True, **state)
    if outcome == "busy":
        return WatchItemResult(index=0, status="error", reasons=["in_progress"], retryable=True)

    owned = {**key, "claim_id": claim_id}
    reserved_run = bool(state.get("reserved_run"))
    reserved_day = bool(state.get("reserved_day"))

    async def release() -> None:
        # Ordre sûr : effacer l'indicateur de l'élément AVANT de rendre la place.
        # Un arrêt entre les deux laisse une place bloquée (prudent). L'ordre inverse
        # laisserait un élément « réservé » sans place réelle : une reprise créerait
        # alors sans réservation et pourrait dépasser un plafond.
        nonlocal reserved_run, reserved_day
        if reserved_run:
            await db[ITEMS].update_one(owned, {"$set": {"reserved_run": False}})
            await _release_run(db, user_id, run.run_id)
            reserved_run = False
        if reserved_day:
            await db[ITEMS].update_one(owned, {"$set": {"reserved_day": False}})
            await _release_day(db, user_id, run.quota_day)
            reserved_day = False

    async def finalize(status: str, **fields) -> WatchItemResult:
        result = WatchItemResult(index=0, status=status, warnings=check.warnings, **fields)
        stored = result.model_dump(exclude={"index", "replayed"})
        done = await db[ITEMS].update_one(
            owned, {"$set": {"state": "done", "result": stored, "finished_at": _utcnow()}},
        )
        if done.modified_count == 1:
            await db[RUNS].update_one(
                {"user_id": user_id, "run_id": run.run_id}, {"$inc": {f"observed.{status}": 1}},
            )
        return result

    if not check.ok:
        await release()
        return await finalize("rejected", reasons=check.reasons)
    if not prefs["active"]:
        await release()
        return await finalize("rejected", reasons=["watch_paused"])

    data = OpportunityCreate(**check.opportunity, source=WATCH_SOURCE)

    # 1. Doublon AVANT quota
    existing = await opportunity_service.find_existing_opportunity(db, user_id, data)
    if existing:
        if reserved_run and reserved_day:
            # Reprise d'un traitement interrompu APRÈS la création : l'offre vient de cette exécution
            doc = await db[opportunity_service.COLLECTION].find_one(
                {"user_id": user_id, "id": existing.opportunity_id}, {"_id": 0, "watch.run_id": 1, "watch.client_id": 1},
            )
            watch_doc = (doc or {}).get("watch") or {}
            if watch_doc.get("run_id") == check.watch["run_id"] and watch_doc.get("client_id") == client_id:
                return await finalize("created", opportunity_id=existing.opportunity_id)
        await release()
        return await finalize(
            "duplicate", opportunity_id=existing.opportunity_id, duplicate_reason=existing.duplicate_reason,
        )

    # 2. Quotas : exécution, puis jour (libération de la première si la seconde échoue)
    if not reserved_run:
        if not await _reserve_run(db, user_id, run.run_id, cap):
            await release()
            return await finalize("rejected", reasons=["run_limit_reached"])
        reserved_run = True
        await db[ITEMS].update_one(owned, {"$set": {"reserved_run": True}})
    if not reserved_day:
        if not await _reserve_day(db, user_id, run.quota_day, settings.WATCH_DAILY_CREATE_QUOTA):
            await release()
            return await finalize("rejected", reasons=["daily_quota_reached"])
        reserved_day = True
        await db[ITEMS].update_one(owned, {"$set": {"reserved_day": True}})

    # 3. Ingestion (service du Lot 1, upsert $setOnInsert)
    try:
        watch = {**check.watch, "client_id": client_id, "client_name": client_name} if client_id else check.watch
        result = await opportunity_service.ingest_opportunity(db, user_id, data, watch=watch)
    except Exception:
        logger.exception("watch_ingest result=error user_id=%s run_id=%s", user_id, run.run_id)
        await release()
        # Élément relâché : une reprise le retraitera entièrement
        await db[ITEMS].delete_one(owned)
        await db[RUNS].update_one({"user_id": user_id, "run_id": run.run_id}, {"$inc": {"observed.error": 1}})
        return WatchItemResult(index=0, status="error", reasons=["temporarily_unavailable"], retryable=True)

    if result.created:
        return await finalize("created", opportunity_id=result.opportunity_id)
    # Doublon révélé par une course concurrente : places libérées
    await release()
    return await finalize("duplicate", opportunity_id=result.opportunity_id, duplicate_reason=result.duplicate_reason)


# ============================================
# API DU SERVICE
# ============================================

async def ingest_batch(db, user_id: str, payload: dict, now: Optional[datetime] = None,
                       client_id: Optional[str] = None) -> WatchBatchResult:
    """
    Ingestion d'un envoi groupé (1 à 20 offres) pour une exécution `run_id`.
    Lève WatchNotEnabled ou WatchRequestError ; sinon un résultat PAR ÉLÉMENT.
    `client_id` : client OAuth VÉRIFIÉ (jamais un argument de l'appelant), enregistré sur
    l'exécution et sur chaque nouvelle offre. Le format de la réponse est inchangé.
    """
    now = now or _utcnow()
    await ensure_indexes(db)
    await require_enabled(db, user_id)
    try:
        request = WatchBatchRequest.model_validate(payload)
    except ValidationError as e:
        raise WatchRequestError("invalid_arguments", _error_details(e))

    prefs = (await watch_preferences_service.get_or_create(db, user_id)).model_dump()
    run = await _open_run(db, user_id, request.run_id, prefs, now, client_id)
    cap = _run_cap(prefs)
    # Nom du client VÉRIFIÉ, lu dans le registre OAuth (jamais fourni par l'appelant)
    client_name = await opportunity_service.oauth_client_name(db, client_id) if client_id else None

    results = []
    for index, raw in enumerate(request.opportunities):
        check = check_item(raw, prefs, request.run_id, request.preferences_version)
        item = await _process_item(db, user_id, run, check, prefs, cap, client_id, client_name)
        item.index = index
        results.append(item)

    summary = WatchBatchSummary(received=len(results))
    for item in results:
        setattr(summary, item.status, getattr(summary, item.status) + 1)
        summary.replayed += item.replayed

    run_doc = await db[RUNS].find_one({"user_id": user_id, "run_id": run.run_id}, {"_id": 0})
    used_today = await _creations_on(db, user_id, run.quota_day)
    logger.info(
        "watch_ingest user_id=%s run_id=%s received=%d created=%d duplicate=%d rejected=%d error=%d",
        user_id, request.run_id, summary.received, summary.created, summary.duplicate, summary.rejected, summary.error,
    )
    return WatchBatchResult(
        run_id=request.run_id,
        summary=summary,
        run_totals=WatchRunTotals(
            created=run_doc["observed"]["created"],
            remaining_for_run=max(0, cap - run_doc["reserved"]),
            remaining_today=max(0, settings.WATCH_DAILY_CREATE_QUOTA - used_today),
        ),
        warnings=run_doc.get("warnings", []),
        results=results,
    )


async def report_watch_run(db, user_id: str, payload: dict, now: Optional[datetime] = None,
                           client_id: Optional[str] = None) -> WatchRunReportResult:
    """Signal de fin d'exécution : le dernier rapport fait foi ; compteurs observés renvoyés.
    Le client auteur du rapport est stocké HORS de `report` (format de `last_run` inchangé)."""
    now = now or _utcnow()
    await ensure_indexes(db)
    await require_enabled(db, user_id)
    try:
        report = WatchRunReport.model_validate(payload)
    except ValidationError as e:
        raise WatchRequestError("invalid_arguments", _error_details(e))

    prefs = (await watch_preferences_service.get_or_create(db, user_id)).model_dump()
    run = await _open_run(db, user_id, report.run_id, prefs, now, client_id)
    declared = report.model_dump(exclude={"run_id"})
    declared["reported_at"] = now.isoformat()
    fields = {"report": declared}
    if client_id:
        fields["report_client_id"] = client_id
    doc = await db[RUNS].find_one_and_update(
        {"user_id": user_id, "run_id": run.run_id},
        {"$set": fields, "$inc": {"report_count": 1}},
        projection={"_id": 0, "observed": 1},
        return_document=ReturnDocument.AFTER,
    )
    observed = WatchRunCounts.model_validate(doc["observed"])
    logger.info("watch_report user_id=%s run_id=%s status=%s", user_id, report.run_id, report.status)
    return WatchRunReportResult(run_id=report.run_id, observed=observed)


async def list_runs(db, user_id: str, limit: int = 20) -> WatchRunListResponse:
    """Exécutions OBSERVÉES (faits reçus), les plus récentes d'abord."""
    await ensure_indexes(db)
    cursor = db[RUNS].find({"user_id": user_id}, {"_id": 0}).sort("last_seen_at", -1).limit(limit)
    return WatchRunListResponse(items=[WatchRunSummary.model_validate(_public_run(doc)) async for doc in cursor])


async def _presumed_missing_slots(db, user_id: str, times: list, now: datetime) -> list:
    """Créneaux déclarés des dernières 24 h, passés de plus de 30 min, sans aucune
    exécution programmée reçue. Indicatif, calculé seulement à la consultation."""
    missing = []
    today = now.astimezone(timezone.utc)
    for day_offset in (1, 0):
        day = paris_day(today - timedelta(days=day_offset))
        for hhmm in times:
            local = datetime.strptime(f"{day} {hhmm}", "%Y-%m-%d %H:%M")
            for instant in paris_instants(local):
                if not (now - MISSING_SLOT_LOOKBACK <= instant <= now - MISSING_SLOT_GRACE):
                    continue
                seen = await db[RUNS].find_one(
                    {"user_id": user_id, "kind": "prog", "scheduled_for": instant.isoformat()}, {"_id": 1},
                )
                if seen is None and instant not in missing:
                    missing.append(instant)
    return sorted(missing)


async def get_status(db, user_id: str, now: Optional[datetime] = None) -> WatchStatusResponse:
    now = now or _utcnow()
    await ensure_indexes(db)
    prefs = (await watch_preferences_service.get_or_create(db, user_id)).model_dump()
    used_today = await _creations_on(db, user_id, paris_day(now))
    last = await db[RUNS].find_one({"user_id": user_id}, {"_id": 0}, sort=[("last_seen_at", -1)])
    return WatchStatusResponse(
        active=prefs["active"],
        preferences_version=prefs["preferences_version"],
        max_per_run=_run_cap(prefs),
        daily_quota=settings.WATCH_DAILY_CREATE_QUOTA,
        remaining_today=max(0, settings.WATCH_DAILY_CREATE_QUOTA - used_today),
        last_run=WatchRunSummary.model_validate(_public_run(last)) if last else None,
        presumed_missing_slots=await _presumed_missing_slots(db, user_id, prefs["schedule"]["times"], now),
    )
