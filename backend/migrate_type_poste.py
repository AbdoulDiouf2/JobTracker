"""
Migration one-shot : normalise type_poste et moyen en DB.
Lance : python migrate_type_poste.py
"""
import asyncio
import unicodedata
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "jobtracker"

VALID_TYPE_POSTE = {"cdi", "cdd", "stage", "alternance", "freelance", "interim", "mastere"}
VALID_MOYEN = {"linkedin", "company_website", "email", "indeed", "apec", "pole_emploi", "welcome_to_jungle", "other"}


def normalize(s):
    s = unicodedata.normalize("NFD", s.lower())
    return "".join(c for c in s if unicodedata.category(c) != "Mn")


def map_type_poste(val):
    if val in VALID_TYPE_POSTE:
        return val
    raw = normalize(val)
    if "master" in raw:
        return "mastere"
    if "alternance" in raw or "apprentissage" in raw:
        return "alternance"
    if "stage" in raw or "intern" in raw:
        return "stage"
    if "freelance" in raw or "independant" in raw:
        return "freelance"
    if "interim" in raw:
        return "interim"
    if "cdd" in raw:
        return "cdd"
    if "cdi" in raw:
        return "cdi"
    return "cdi"


def map_moyen(val):
    if val in VALID_MOYEN:
        return val
    raw = normalize(val)
    if "linkedin" in raw:
        return "linkedin"
    if "indeed" in raw:
        return "indeed"
    if "apec" in raw:
        return "apec"
    if "pole" in raw or "france travail" in raw or "emploi" in raw:
        return "pole_emploi"
    if "jungle" in raw:
        return "welcome_to_jungle"
    if "site" in raw or "entreprise" in raw or "company" in raw:
        return "company_website"
    if "email" in raw or "mail" in raw:
        return "email"
    return "other"


async def migrate():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    cursor = db.applications.find({}, {"_id": 1, "type_poste": 1, "moyen": 1})
    updated = 0

    async for doc in cursor:
        changes = {}
        tp = doc.get("type_poste") or ""
        mo = doc.get("moyen") or ""

        new_tp = map_type_poste(tp)
        new_mo = map_moyen(mo)

        if new_tp != tp:
            changes["type_poste"] = new_tp
        if new_mo != mo:
            changes["moyen"] = new_mo

        if changes:
            await db.applications.update_one({"_id": doc["_id"]}, {"$set": changes})
            updated += 1
            print(f"  Updated: type_poste '{tp}'→'{new_tp}' | moyen '{mo}'→'{new_mo}'")

    print(f"\nDone. {updated} document(s) updated.")
    client.close()


if __name__ == "__main__":
    asyncio.run(migrate())
