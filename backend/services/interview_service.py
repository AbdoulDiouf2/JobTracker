"""Shared interview rules for the REST API and future MCP adapter."""

import asyncio
import hashlib
import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from pymongo.errors import DuplicateKeyError

from models import Interview, InterviewCreate, InterviewUpdate


class InterviewError(Exception):
    def __init__(self, code: str, message: str):
        self.code = code
        super().__init__(message)


def utc_date(value):
    """Read historical naive dates as UTC, without changing stored values."""
    try:
        if isinstance(value, str):
            value = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if not isinstance(value, datetime):
            return None
        return (value.replace(tzinfo=timezone.utc) if value.tzinfo is None
                else value.astimezone(timezone.utc))
    except (ValueError, TypeError, OverflowError):
        return None


def input_date(value: datetime, *, require_offset: bool = False) -> datetime:
    if require_offset and (value.tzinfo is None or value.utcoffset() is None):
        raise InterviewError("invalid_arguments", "La date doit inclure un fuseau horaire")
    if not require_offset:
        return value  # The existing REST API accepts and stores naive or offset dates.
    return value.astimezone(timezone.utc)


def calculate_time_remaining(interview_date: datetime) -> tuple:
    date = utc_date(interview_date)
    now = datetime.now(timezone.utc)
    if date is None or date < now:
        return "Passé", "passed"
    diff = date - now
    days = diff.days
    hours, remainder = divmod(diff.seconds, 3600)
    minutes = remainder // 60
    total_hours = diff.total_seconds() / 3600
    if total_hours < 1:
        return f"{minutes} min", "danger"
    if total_hours < 24:
        return f"{hours}h {minutes}min", "warning"
    if days < 7:
        return f"{days}j {hours}h", "info"
    return f"{days} jours", "normal"


def _event(kind: str, previous: Optional[str], new: str, source: str, client_id: Optional[str] = None):
    return {"event_id": str(uuid.uuid4()), "event_type": kind,
            "previous_status": previous, "new_status": new,
            "changed_at": datetime.now(timezone.utc).isoformat(),
            "source": source, "client_id": client_id}


def _public(interview: dict, application: Optional[dict], *, history: bool = False):
    result = {k: v for k, v in interview.items() if k not in ("_id", "user_id", "revision")}
    if not history:
        result.pop("status_history", None)
    else:
        result["status_history"] = result.get("status_history") or []
    result["entreprise"] = application.get("entreprise", "N/A") if application else "N/A"
    result["poste"] = application.get("poste", "N/A") if application else "N/A"
    date = utc_date(result.get("date_entretien"))
    if date is None:
        result["date_entretien"] = None
        result["date_warning"] = "invalid_historical_date"
        result["time_remaining"] = None
        result["urgency"] = None
    else:
        result["date_entretien"] = date.isoformat()
    if date is not None and result.get("statut") == "planned":
        result["time_remaining"], result["urgency"] = calculate_time_remaining(date)
    elif date is not None:
        result["time_remaining"] = None
        result["urgency"] = None
    return result


async def _application(db, user_id: str, candidature_id: str, *, active: bool = False):
    query = {"id": candidature_id, "user_id": user_id}
    if active:
        query["deleting"] = {"$ne": True}
    return await db.applications.find_one(query, {"_id": 0, "entreprise": 1, "poste": 1})


async def list_interviews(db, user_id: str, filters: dict, *, page: Optional[int] = None,
                          per_page: int = 20, history: bool = False):
    query = {"user_id": user_id}
    for input_name, field in (("status", "statut"), ("interview_type", "type_entretien"),
                              ("interview_format", "format_entretien"), ("candidature_id", "candidature_id")):
        if filters.get(input_name):
            value = filters[input_name]
            query[field] = value.value if hasattr(value, "value") else value
    if page is None:
        pipeline = [
            {"$match": query},
            {"$addFields": {"_sort_date": {"$convert": {"input": "$date_entretien", "to": "date",
                                                       "onError": None, "onNull": None}}}},
            {"$addFields": {"_invalid_date": {"$cond": [{"$eq": ["$_sort_date", None]}, 1, 0]}}},
            {"$sort": {"_invalid_date": 1, "_sort_date": 1, "id": 1}},
            {"$limit": 500},
            {"$project": {"_id": 0, "_sort_date": 0, "_invalid_date": 0}},
        ]
        records = await db.interviews.aggregate(pipeline).to_list(length=500)
        total = len(records)
    else:
        # MongoDB converts valid ISO strings (including offsets and legacy naive UTC) to dates.
        pipeline = [
            {"$match": query},
            {"$addFields": {"_sort_date": {"$convert": {"input": "$date_entretien", "to": "date",
                                                       "onError": None, "onNull": None}}}},
            {"$addFields": {"_invalid_date": {"$cond": [{"$eq": ["$_sort_date", None]}, 1, 0]}}},
            {"$facet": {
                "items": [{"$sort": {"_invalid_date": 1, "_sort_date": 1, "id": 1}},
                          {"$skip": (page - 1) * per_page}, {"$limit": per_page},
                          {"$project": {"_id": 0, "_sort_date": 0, "_invalid_date": 0}}],
                "count": [{"$count": "total"}],
            }},
        ]
        result = (await db.interviews.aggregate(pipeline).to_list(length=1))[0]
        records = result["items"]
        total = result["count"][0]["total"] if result["count"] else 0
    return [ _public(row, await _application(db, user_id, row.get("candidature_id")), history=history)
             for row in records ], total


async def upcoming_interviews(db, user_id: str, limit: int):
    now = datetime.now(timezone.utc)
    rows = await find_interviews_between(db, user_id, now, datetime.max.replace(tzinfo=timezone.utc),
                                         limit=limit)
    return [_public(row, await _application(db, user_id, row.get("candidature_id"))) for row in rows]


async def next_interview_date(db, user_id: str, candidature_id: str):
    now = datetime.now(timezone.utc)
    rows = await db.interviews.find({"user_id": user_id, "candidature_id": candidature_id,
                                     "statut": "planned"}, {"date_entretien": 1}).to_list(length=None)
    dates = [date for row in rows if (date := utc_date(row.get("date_entretien"))) and date >= now]
    return min(dates).isoformat() if dates else None


def _date_range_pipeline(user_id, start, end, *, status=None, end_inclusive=False):
    match = {"user_id": user_id}
    if status:
        match["statut"] = status
    bounds = {"$gte": start, "$lte" if end_inclusive else "$lt": end}
    return [{"$match": match},
            {"$addFields": {"_parsed_date": {"$convert": {"input": "$date_entretien", "to": "date",
                                                          "onError": None, "onNull": None}}}},
            {"$match": {"_parsed_date": bounds}}]


async def find_interviews_between(db, user_id: str, start: datetime, end: datetime,
                                  *, status: str = "planned", limit: int = 100,
                                  end_inclusive: bool = False):
    pipeline = _date_range_pipeline(user_id, start, end, status=status, end_inclusive=end_inclusive)
    pipeline.extend([{"$sort": {"_parsed_date": 1, "id": 1}}, {"$limit": limit},
                     {"$project": {"_id": 0, "_parsed_date": 0}}])
    return await db.interviews.aggregate(pipeline).to_list(length=limit)


async def count_interviews_between(db, user_id: str, start: datetime, end: datetime,
                                   *, status: Optional[str] = None, end_inclusive: bool = False):
    pipeline = _date_range_pipeline(user_id, start, end, status=status, end_inclusive=end_inclusive)
    rows = await db.interviews.aggregate(pipeline + [{"$count": "total"}]).to_list(length=1)
    return rows[0]["total"] if rows else 0


async def count_interviews_for_period(db, user_id: str, date_from=None, date_to=None, *, status=None):
    if not date_from and not date_to:
        query = {"user_id": user_id}
        if status:
            query["statut"] = status
        return await db.interviews.count_documents(query)
    start = datetime.fromisoformat(date_from).replace(tzinfo=timezone.utc) if date_from else datetime.min.replace(tzinfo=timezone.utc)
    end = (datetime.fromisoformat(date_to).replace(tzinfo=timezone.utc) + timedelta(days=1)
           if date_to else datetime.max.replace(tzinfo=timezone.utc))
    return await count_interviews_between(db, user_id, start, end, status=status)


async def get_interview(db, user_id: str, interview_id: str, *, history: bool = False):
    row = await db.interviews.find_one({"id": interview_id, "user_id": user_id}, {"_id": 0})
    if row is None:
        raise InterviewError("not_found", "Entretien non trouvé")
    return _public(row, await _application(db, user_id, row.get("candidature_id")), history=history)


def _fingerprint(data: InterviewCreate) -> str:
    values = data.model_dump(mode="json", exclude_unset=True)
    values["date_entretien"] = utc_date(data.date_entretien).isoformat()
    return hashlib.sha256(json.dumps(values, sort_keys=True, ensure_ascii=False,
                                     separators=(",", ":")).encode()).hexdigest()


async def _reserve(db, user_id, request_id, fingerprint, client_id):
    await db.interviews.create_index("id", unique=True)
    await db.interview_idempotency.create_index([("user_id", 1), ("operation", 1), ("request_id", 1)], unique=True)
    await db.interview_idempotency.create_index("expires_at", expireAfterSeconds=0)
    key = {"user_id": user_id, "operation": "create_interview", "request_id": request_id}
    now = datetime.now(timezone.utc)
    await db.interview_idempotency.delete_one({**key, "expires_at": {"$lte": now}})
    candidate = {**key, "fingerprint": fingerprint, "interview_id": str(uuid.uuid4()),
                 "expires_at": now + timedelta(hours=24), "client_id": client_id,
                 "status": "pending", "lease_until": now + timedelta(seconds=30)}
    try:
        await db.interview_idempotency.insert_one(candidate)
        return candidate, True
    except DuplicateKeyError:
        receipt = await db.interview_idempotency.find_one(key)
        if receipt is None:
            raise InterviewError("conflict", "Réessayer la création")
        if receipt["fingerprint"] != fingerprint:
            raise InterviewError("conflict", "Clé déjà utilisée avec des données différentes")
        if receipt.get("status") == "pending" and utc_date(receipt.get("lease_until")) <= now:
            claimed = await db.interview_idempotency.find_one_and_update(
                {"_id": receipt["_id"], "status": "pending", "lease_until": {"$lte": now}},
                {"$set": {"lease_until": now + timedelta(seconds=30)}})
            if claimed is not None:
                return receipt, True
        return receipt, False


def _row_from_snapshot(snapshot: dict, user_id: str, source: str, client_id: Optional[str]):
    """Recreate an interrupted insert from the immutable, public creation result."""
    fields = ("id", "candidature_id", "date_entretien", "type_entretien",
              "format_entretien", "lieu_entretien", "interviewer", "commentaire",
              "statut", "created_at")
    return {**{key: snapshot[key] for key in fields if key in snapshot},
            "user_id": user_id,
            "status_history": [_event("created", None, "planned", source, client_id)]}


async def _complete_receipt(db, receipt: dict, snapshot: dict):
    """Never publish a complete receipt without its creation result."""
    result = await db.interview_idempotency.update_one(
        {"_id": receipt["_id"], "initial_result": snapshot},
        {"$set": {"status": "complete", "initial_result": snapshot}})
    if result.matched_count != 1:
        raise InterviewError("conflict", "Reçu d'idempotence indisponible")


async def create_interview(db, user_id: str, data: InterviewCreate, *, source: str = "web",
                           client_id: Optional[str] = None, request_id: Optional[str] = None,
                           require_offset: bool = False):
    if request_id is not None and (not isinstance(request_id, str) or not 1 <= len(request_id) <= 128):
        raise InterviewError("invalid_arguments", "request_id invalide")
    date = input_date(data.date_entretien, require_offset=require_offset)
    application = await _application(db, user_id, data.candidature_id, active=True)
    if application is None:
        raise InterviewError("not_found", "Candidature non trouvée")
    receipt = None
    if request_id is not None:
        receipt, owner = await _reserve(db, user_id, request_id, _fingerprint(data), client_id)
        interview_id = receipt["interview_id"]
        if not owner:
            for _ in range(40):
                if receipt.get("status") == "complete":
                    snapshot = receipt.get("initial_result")
                    if not isinstance(snapshot, dict):
                        raise InterviewError("conflict", "Résultat initial indisponible")
                    row = await db.interviews.find_one({"id": interview_id, "user_id": user_id}, {"_id": 0})
                    if row is None:
                        raise InterviewError("conflict", "L'entretien initial a été supprimé")
                    return snapshot.copy(), True
                await asyncio.sleep(.05)
                receipt = await db.interview_idempotency.find_one({"_id": receipt["_id"]}) or receipt
            raise InterviewError("conflict", "Création en cours ; réessayer")
    else:
        interview_id = str(uuid.uuid4())
    if receipt is not None and isinstance(receipt.get("initial_result"), dict):
        snapshot = receipt["initial_result"]
        row = _row_from_snapshot(snapshot, user_id, source, client_id)
    else:
        interview = Interview(**{**data.model_dump(), "date_entretien": date}, user_id=user_id, id=interview_id)
        row = interview.model_dump(mode="json")
        row["status_history"] = [_event("created", None, "planned", source, client_id)]
        snapshot = _public(row, application)
        if receipt is not None:
            # The insert cannot happen before its original result is durable.
            await db.interview_idempotency.update_one(
                {"_id": receipt["_id"], "status": "pending", "initial_result": {"$exists": False}},
                {"$set": {"initial_result": snapshot}})
            receipt = await db.interview_idempotency.find_one({"_id": receipt["_id"]})
            if receipt is None or not isinstance(receipt.get("initial_result"), dict):
                raise InterviewError("conflict", "Résultat initial indisponible")
            snapshot = receipt["initial_result"]
            row = _row_from_snapshot(snapshot, user_id, source, client_id)
    recovered = False
    try:
        await db.interviews.insert_one(row)
    except DuplicateKeyError:
        if request_id is None:
            raise
        row = await db.interviews.find_one({"id": interview_id, "user_id": user_id}, {"_id": 0})
        if row is None:
            raise InterviewError("conflict", "Création concurrente")
        recovered = True
    still_active = await _application(db, user_id, data.candidature_id, active=True)
    if still_active is None:
        await db.interviews.delete_one({"id": interview_id, "user_id": user_id})
        if receipt is not None:
            await _complete_receipt(db, receipt, snapshot)
        raise InterviewError("not_found", "Candidature non trouvée")
    if receipt is not None:
        await _complete_receipt(db, receipt, snapshot)
        return snapshot.copy(), recovered
    return _public(row, still_active), recovered


async def update_interview(db, user_id: str, interview_id: str, changes: InterviewUpdate,
                           *, source: str = "web", client_id: Optional[str] = None,
                           require_offset: bool = False):
    data = changes.model_dump(exclude_unset=True)
    if not data:
        raise InterviewError("invalid_arguments", "Aucune donnée à mettre à jour")
    nullable = {"lieu_entretien", "interviewer", "commentaire"}
    if any(v is None and k not in nullable for k, v in data.items()):
        raise InterviewError("invalid_arguments", "Valeur null interdite")
    for key, value in list(data.items()):
        if key == "date_entretien" and value is not None:
            data[key] = input_date(value, require_offset=require_offset).isoformat()
        elif hasattr(value, "value"):
            data[key] = value.value
    for _ in range(3):
        existing = await db.interviews.find_one({"id": interview_id, "user_id": user_id})
        if existing is None:
            raise InterviewError("not_found", "Entretien non trouvé")
        changed = {k: v for k, v in data.items() if existing.get(k) != v}
        if not changed:
            return await get_interview(db, user_id, interview_id)
        revision = existing.get("revision")
        version_filter = {"revision": revision} if revision is not None else {"revision": {"$exists": False}}
        update = {"$set": changed, "$inc": {"revision": 1}}
        if "statut" in changed:
            update["$push"] = {"status_history": _event("status_changed", existing.get("statut"),
                                                          changed["statut"], source, client_id)}
        result = await db.interviews.update_one({"id": interview_id, "user_id": user_id, **version_filter}, update)
        if result.matched_count:
            return await get_interview(db, user_id, interview_id)
    raise InterviewError("conflict", "Entretien modifié simultanément ; réessayez")


async def delete_interview(db, user_id: str, interview_id: str):
    result = await db.interviews.delete_one({"id": interview_id, "user_id": user_id})
    if result.deleted_count == 0:
        raise InterviewError("not_found", "Entretien non trouvé")
