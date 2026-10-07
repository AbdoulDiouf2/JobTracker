"""
Tests de la conversion Opportunity -> Application (service), contre une vraie
MongoDB éphémère : mapping, troncature, idempotence, concurrence, rollback,
reprise après crash.
"""

import asyncio
import uuid
from datetime import datetime, timezone, timedelta

import pytest

from models import OpportunityCreate, OpportunityUpdate
from services import opportunity_service as svc
from services.opportunity_service import (
    OpportunityConflict, OpportunityConversionInProgress, OpportunityNotFound,
    build_application_from_opportunity, map_contract_type,
)

pytestmark = pytest.mark.anyio

USER_A = "user-a-" + uuid.uuid4().hex[:6]
USER_B = "user-b-" + uuid.uuid4().hex[:6]


async def ingest(db, user_id=USER_A, **overrides) -> str:
    data = {
        "title": "Data Engineer Junior",
        "company": "Orange",
        "url": f"https://www.linkedin.com/jobs/view/{uuid.uuid4().int % 10**10}/?trk=x",
        "location": "Paris",
        "country": "France",
        "contract_type": "CDI",
        "description": "Pipelines Spark, Airflow.",
        "source": "chatgpt_watch",
    }
    data.update(overrides)
    result = await svc.ingest_opportunity(db, user_id, OpportunityCreate(**data))
    return result.opportunity_id


async def raw_opportunity(db, opportunity_id) -> dict:
    return await db[svc.COLLECTION].find_one({"id": opportunity_id}, {"_id": 0})


# ============================================
# Mapping
# ============================================

async def test_conversion_full_mapping(db):
    opp_id = await ingest(db)
    result = await svc.convert_opportunity(db, USER_A, opp_id)

    assert result["created"] is True
    app = await db.applications.find_one({"id": result["application_id"]}, {"_id": 0})
    opp = await raw_opportunity(db, opp_id)

    assert app["user_id"] == USER_A
    assert app["reponse"] == "to_apply"
    assert app["poste"] == "Data Engineer Junior"
    assert app["entreprise"] == "Orange"
    assert app["lieu"] == "Paris, France"
    assert app["lien"] == opp["url"]
    assert app["description_poste"] == "Pipelines Spark, Airflow."
    assert app["type_poste"] == "cdi"
    assert app["moyen"] == "linkedin"
    assert app["source"] == "opportunity:chatgpt_watch"
    assert app["commentaire"] is None
    assert app["followup_count"] == 0 and app["history"] == []
    # Dates stockées en ISO string, comme le reste du repo
    assert isinstance(app["date_candidature"], str) and isinstance(app["created_at"], str)

    assert opp["status"] == "converted"
    assert opp["converted_application_id"] == result["application_id"]
    assert opp["converted_at"]
    assert "conversion_started_at" not in opp


@pytest.mark.parametrize("raw,expected,recognized", [
    ("CDI", "cdi", True),
    ("cdd", "cdd", True),
    ("Contrat à durée déterminée", "cdd", True),
    ("Internship", "stage", True),
    ("Stage", "stage", True),
    ("Alternance", "alternance", True),
    ("Contrat de professionnalisation", "alternance", True),
    ("Free-lance", "freelance", True),
    ("Intérim", "interim", True),
    ("Mastère spécialisé", "mastere", True),
    ("Full-time", "cdi", False),
    ("VIE", "cdi", False),
    (None, "cdi", False),
    ("   ", "cdi", False),
])
def test_contract_type_mapping(raw, expected, recognized):
    job_type, is_recognized = map_contract_type(raw)
    assert job_type.value == expected
    assert is_recognized is recognized


async def test_unknown_contract_type_is_traced_in_comment(db):
    opp_id = await ingest(db, contract_type="VIE")
    result = await svc.convert_opportunity(db, USER_A, opp_id)
    app = await db.applications.find_one({"id": result["application_id"]})
    assert app["type_poste"] == "cdi"
    assert "Type de contrat d'origine : VIE" in app["commentaire"]


@pytest.mark.parametrize("url,expected_moyen", [
    ("https://fr.indeed.com/viewjob?jk=abc", "indeed"),
    ("https://www.welcometothejungle.com/fr/companies/x/jobs/y", "welcome_to_jungle"),
    ("https://careers.orange.com/job/123", "other"),
])
async def test_source_and_moyen(db, url, expected_moyen):
    opp_id = await ingest(db, url=url, source="external_agent")
    result = await svc.convert_opportunity(db, USER_A, opp_id)
    app = await db.applications.find_one({"id": result["application_id"]})
    assert app["moyen"] == expected_moyen
    assert app["source"] == "opportunity:external_agent"


def test_lieu_variants():
    base = {"title": "t", "company": "c", "url": "https://c.com/j", "source": "manual"}
    assert build_application_from_opportunity({**base, "location": "Paris"}).lieu == "Paris"
    assert build_application_from_opportunity({**base, "country": "France"}).lieu == "France"
    assert build_application_from_opportunity({**base, "location": "Paris, France", "country": "France"}).lieu == "Paris, France"
    assert build_application_from_opportunity(base).lieu is None


def test_controlled_truncation():
    opp = {
        "title": "t", "company": "c", "source": "manual",
        "url": "https://company.com/jobs/1",
        "location": "L" * 150, "country": "France",
        "description": "D" * 8000,
    }
    app = build_application_from_opportunity(opp)
    assert len(app.lieu) == 100 and app.lieu.endswith("…")
    assert len(app.description_poste) == 5000 and app.description_poste.endswith("…")
    assert "Description tronquée" in app.commentaire


def test_long_url_falls_back_to_normalized_then_comment():
    long_tracking = "https://company.com/jobs/1?" + "&".join(f"utm_x{i}=v" for i in range(80))
    assert len(long_tracking) > 500
    app = build_application_from_opportunity({
        "title": "t", "company": "c", "source": "manual",
        "url": long_tracking, "url_normalized": "https://company.com/jobs/1",
    })
    assert app.lien == "https://company.com/jobs/1"

    long_real = "https://company.com/jobs/" + "a" * 600
    app = build_application_from_opportunity({
        "title": "t", "company": "c", "source": "manual",
        "url": long_real, "url_normalized": long_real,
    })
    assert app.lien is None
    assert long_real in app.commentaire


async def test_long_fields_convert_end_to_end(db):
    opp_id = await ingest(db, location="L" * 150, description="D" * 8000)
    result = await svc.convert_opportunity(db, USER_A, opp_id)
    app = await db.applications.find_one({"id": result["application_id"]})
    assert len(app["lieu"]) == 100 and len(app["description_poste"]) == 5000


# ============================================
# Idempotence / concurrence
# ============================================

async def test_double_conversion_sequential(db):
    opp_id = await ingest(db)
    first = await svc.convert_opportunity(db, USER_A, opp_id)
    second = await svc.convert_opportunity(db, USER_A, opp_id)

    assert first["created"] is True and second["created"] is False
    assert first["application_id"] == second["application_id"]
    assert await db.applications.count_documents({"user_id": USER_A}) == 1


async def test_concurrent_conversions_create_exactly_one_application(db):
    opp_id = await ingest(db)
    results = await asyncio.gather(*[svc.convert_opportunity(db, USER_A, opp_id) for _ in range(30)])

    assert len({r["application_id"] for r in results}) == 1
    assert sum(r["created"] for r in results) == 1
    assert await db.applications.count_documents({"user_id": USER_A}) == 1
    opp = await raw_opportunity(db, opp_id)
    assert opp["status"] == "converted" and opp["converted_application_id"] == results[0]["application_id"]


async def test_concurrent_conversions_of_different_opportunities(db):
    ids = [await ingest(db) for _ in range(5)]
    results = await asyncio.gather(*[svc.convert_opportunity(db, USER_A, i) for i in ids for _ in range(4)])
    assert len({r["application_id"] for r in results}) == 5
    assert await db.applications.count_documents({"user_id": USER_A}) == 5


async def test_ignored_opportunity_can_be_converted(db):
    opp_id = await ingest(db)
    await svc.ignore_opportunity(db, USER_A, opp_id)
    result = await svc.convert_opportunity(db, USER_A, opp_id)
    assert result["created"] is True
    assert (await raw_opportunity(db, opp_id))["status"] == "converted"


async def test_conversion_is_scoped_to_user(db):
    opp_id = await ingest(db)
    with pytest.raises(OpportunityNotFound):
        await svc.convert_opportunity(db, USER_B, opp_id)
    assert await db.applications.count_documents({}) == 0
    assert (await raw_opportunity(db, opp_id))["converted_application_id"] is None


# ============================================
# Échec, rollback, retry
# ============================================

async def test_failure_before_insert_rolls_back_and_retry_succeeds(db, monkeypatch):
    opp_id = await ingest(db)

    async def failing_create(*args, **kwargs):
        raise RuntimeError("Mongo indisponible")

    monkeypatch.setattr(svc, "create_application_record", failing_create)
    with pytest.raises(RuntimeError):
        await svc.convert_opportunity(db, USER_A, opp_id)

    opp = await raw_opportunity(db, opp_id)
    assert opp["status"] == "new"
    assert opp["converted_application_id"] is None
    assert "conversion_started_at" not in opp
    assert await db.applications.count_documents({}) == 0

    monkeypatch.undo()
    result = await svc.convert_opportunity(db, USER_A, opp_id)
    assert result["created"] is True
    assert await db.applications.count_documents({}) == 1


async def test_failure_after_insert_removes_partial_application(db, monkeypatch):
    """Ex: écriture appliquée mais erreur réseau remontée au client."""
    opp_id = await ingest(db)
    real_create = svc.create_application_record

    async def create_then_fail(*args, **kwargs):
        await real_create(*args, **kwargs)
        raise ConnectionError("réponse perdue")

    monkeypatch.setattr(svc, "create_application_record", create_then_fail)
    with pytest.raises(ConnectionError):
        await svc.convert_opportunity(db, USER_A, opp_id)

    assert await db.applications.count_documents({}) == 0
    assert (await raw_opportunity(db, opp_id))["converted_application_id"] is None

    monkeypatch.undo()
    result = await svc.convert_opportunity(db, USER_A, opp_id)
    assert result["created"] is True
    assert await db.applications.count_documents({}) == 1


async def test_stale_reservation_is_taken_over(db):
    """Crash (ex: timeout serverless) après réservation, avant insertion."""
    opp_id = await ingest(db)
    old = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
    await db[svc.COLLECTION].update_one(
        {"id": opp_id}, {"$set": {"converted_application_id": "ghost-app", "conversion_started_at": old}}
    )

    result = await svc.convert_opportunity(db, USER_A, opp_id)
    assert result["created"] is True and result["application_id"] != "ghost-app"
    assert await db.applications.count_documents({}) == 1
    assert (await raw_opportunity(db, opp_id))["status"] == "converted"


async def test_fresh_reservation_without_application_returns_in_progress(db, monkeypatch):
    opp_id = await ingest(db)
    await db[svc.COLLECTION].update_one(
        {"id": opp_id},
        {"$set": {"converted_application_id": "in-flight", "conversion_started_at": datetime.now(timezone.utc).isoformat()}},
    )
    monkeypatch.setattr(svc, "CONVERSION_WAIT_SECONDS", 0.3)
    with pytest.raises(OpportunityConversionInProgress):
        await svc.convert_opportunity(db, USER_A, opp_id)
    assert await db.applications.count_documents({}) == 0


async def test_crash_after_insert_is_finalized_on_retry(db):
    """Candidature insérée mais opportunité non finalisée : le retry finalise sans doublon."""
    opp_id = await ingest(db)
    opp = await raw_opportunity(db, opp_id)
    app_id = str(uuid.uuid4())
    await db[svc.COLLECTION].update_one(
        {"id": opp_id},
        {"$set": {"converted_application_id": app_id, "conversion_started_at": datetime.now(timezone.utc).isoformat()}},
    )
    await svc.create_application_record(
        db, USER_A, build_application_from_opportunity(opp),
        reponse=svc.ApplicationStatus.TO_APPLY, application_id=app_id,
    )

    result = await svc.convert_opportunity(db, USER_A, opp_id)
    assert result == {"opportunity_id": opp_id, "application_id": app_id, "created": False}
    assert await db.applications.count_documents({}) == 1
    assert (await raw_opportunity(db, opp_id))["status"] == "converted"


async def test_lost_reservation_compensates_created_application(db):
    """Tentative lente dont la réservation a été reprise : sa candidature est supprimée."""
    opp_id = await ingest(db)
    opp = await raw_opportunity(db, opp_id)
    # Réservation détenue par une autre tentative
    await db[svc.COLLECTION].update_one({"id": opp_id}, {"$set": {"converted_application_id": "other-attempt"}})

    result = await svc._perform_conversion(db, USER_A, opp, "slow-attempt")
    assert result is None
    assert await db.applications.find_one({"id": "slow-attempt"}) is None


# ============================================
# Opportunité convertie protégée
# ============================================

async def test_converted_opportunity_is_protected(db):
    opp_id = await ingest(db)
    result = await svc.convert_opportunity(db, USER_A, opp_id)

    with pytest.raises(OpportunityConflict):
        await svc.ignore_opportunity(db, USER_A, opp_id)
    with pytest.raises(OpportunityConflict):
        await svc.update_opportunity(db, USER_A, opp_id, OpportunityUpdate(status="new"))
    with pytest.raises(OpportunityConflict):
        await svc.update_opportunity(db, USER_A, opp_id, OpportunityUpdate(status="ignored"))

    again = await svc.convert_opportunity(db, USER_A, opp_id)
    assert again["application_id"] == result["application_id"]
    assert await db.applications.count_documents({}) == 1


async def test_opportunity_being_converted_cannot_be_ignored(db):
    opp_id = await ingest(db)
    await db[svc.COLLECTION].update_one(
        {"id": opp_id},
        {"$set": {"converted_application_id": "in-flight", "conversion_started_at": datetime.now(timezone.utc).isoformat()}},
    )
    with pytest.raises(OpportunityConflict):
        await svc.ignore_opportunity(db, USER_A, opp_id)
    with pytest.raises(OpportunityConflict):
        await svc.update_opportunity(db, USER_A, opp_id, OpportunityUpdate(status="ignored"))
