from datetime import date
from fastapi import HTTPException

DAILY_QUOTA = 10  # valeur par défaut si rien en DB


async def get_quota_limit(db) -> int:
    """Lit le quota journalier configuré par l'admin depuis la DB."""
    doc = await db.platform_settings.find_one({"key": "ai_daily_quota"})
    if doc and isinstance(doc.get("value"), int) and doc["value"] > 0:
        return doc["value"]
    return DAILY_QUOTA


async def check_and_increment_quota(user_id: str, db) -> None:
    """Vérifie le quota IA journalier et l'incrémente. Lève 429 si dépassé.
    Les admins et les utilisateurs avec leur propre clé sont exemptés (géré en amont)."""
    user = await db.users.find_one({"id": user_id}, {"role": 1})
    if user and user.get("role") == "admin":
        return

    quota = await get_quota_limit(db)
    today = date.today().isoformat()
    doc = await db.ai_usage.find_one({"user_id": user_id, "date": today})
    count = doc["call_count"] if doc else 0

    if count >= quota:
        raise HTTPException(
            status_code=429,
            detail={"code": "quota_exceeded", "calls_today": count, "quota": quota}
        )

    await db.ai_usage.update_one(
        {"user_id": user_id, "date": today},
        {"$inc": {"call_count": 1}},
        upsert=True
    )


async def get_usage_today(user_id: str, db) -> int:
    today = date.today().isoformat()
    doc = await db.ai_usage.find_one({"user_id": user_id, "date": today})
    return doc["call_count"] if doc else 0
