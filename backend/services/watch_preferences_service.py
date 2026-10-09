"""
JobTracker SaaS - Service des préférences de veille (Lot 2)

Source de vérité unique des critères lus par ChatGPT (get_watch_preferences).
Le `user_id` provient toujours de l'identité vérifiée, jamais d'un payload.
"""

from datetime import datetime, timezone

from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from models.watch import WATCH_TIMEZONE, WatchPreferencesResponse, WatchPreferencesUpdate

COLLECTION = "watch_preferences"

# Valeurs initiales validées (D12, révision 1.2)
DEFAULT_PREFERENCES = {
    "active": True,
    "countries": ["FR", "CH", "BE", "LU"],
    "job_families": ["data_engineering", "data_science", "big_data", "ai_ml", "data_analytics"],
    "title_keywords": ["Data Engineer", "Data Scientist", "ML Engineer", "Ingénieur Data"],
    "exclusions": ["stage", "alternance", "senior", "lead", "freelance"],
    "seniority": ["junior", "entry_level", "graduate"],
    "contract_types": ["permanent"],
    "languages": ["fr", "en"],
    "min_score": 75,
    "max_per_run": 20,
    "schedule": {"timezone": WATCH_TIMEZONE, "times": ["08:00", "18:00"]},
    "scoring_rubric": (
        "Pays cible +20 ; CDI/permanent +25 ; junior/jeune diplômé +25 ; métier Data cœur +20 ; "
        "lien direct vers l'offre +10. Exclure si stage/alternance/senior."
    ),
}

_indexed_dbs: set = set()


class VersionConflict(Exception):
    """La version attendue ne correspond plus (modification concurrente)."""

    def __init__(self, current_version: int):
        super().__init__("version_conflict")
        self.current_version = current_version


async def ensure_indexes(db) -> None:
    """Index créés paresseusement (le lifespan ne tourne pas sur Vercel)."""
    key = (id(db.client), db.name)
    if key in _indexed_dbs:
        return
    await db[COLLECTION].create_index("user_id", unique=True, name="watch_prefs_user_unique")
    _indexed_dbs.add(key)


def _to_response(doc: dict) -> WatchPreferencesResponse:
    return WatchPreferencesResponse.model_validate(doc)


async def get_or_create(db, user_id: str) -> WatchPreferencesResponse:
    """Lit les préférences ; crée les valeurs initiales au premier accès (sans course)."""
    await ensure_indexes(db)
    coll = db[COLLECTION]
    now = datetime.now(timezone.utc).isoformat()
    initial = {**DEFAULT_PREFERENCES, "user_id": user_id, "preferences_version": 1, "updated_at": now}
    try:
        doc = await coll.find_one_and_update(
            {"user_id": user_id},
            {"$setOnInsert": initial},
            upsert=True,
            projection={"_id": 0, "user_id": 0},
            return_document=ReturnDocument.AFTER,
        )
    except DuplicateKeyError:
        # Deux premiers accès simultanés : l'autre a créé le document
        doc = await coll.find_one({"user_id": user_id}, {"_id": 0, "user_id": 0})
    return _to_response(doc)


async def update(db, user_id: str, data: WatchPreferencesUpdate) -> WatchPreferencesResponse:
    """
    Remplace les préférences si `expected_version` est la version courante (P5).
    Incrémente la version : ChatGPT peut tracer quelle version il a appliquée.
    """
    current = await get_or_create(db, user_id)
    fields = data.model_dump(exclude={"expected_version"})
    fields["updated_at"] = datetime.now(timezone.utc).isoformat()
    doc = await db[COLLECTION].find_one_and_update(
        {"user_id": user_id, "preferences_version": data.expected_version},
        {"$set": fields, "$inc": {"preferences_version": 1}},
        projection={"_id": 0, "user_id": 0},
        return_document=ReturnDocument.AFTER,
    )
    if doc is None:
        latest = await db[COLLECTION].find_one({"user_id": user_id}, {"preferences_version": 1})
        raise VersionConflict(latest["preferences_version"] if latest else current.preferences_version)
    return _to_response(doc)
