"""
Tests du service Opportunity contre une vraie MongoDB éphémère
(index uniques, upsert/$setOnInsert, idempotence, concurrence, isolation).
"""

import asyncio
import uuid

import pytest
from pydantic import ValidationError

from models import OpportunityCreate, OpportunityUpdate, OpportunityStatus
from services import opportunity_service as svc
from services.opportunity_service import OpportunityNotFound, OpportunityConflict

pytestmark = pytest.mark.anyio

USER_A = "user-a-" + uuid.uuid4().hex[:6]
USER_B = "user-b-" + uuid.uuid4().hex[:6]


def make(**overrides) -> OpportunityCreate:
    data = {
        "title": "Data Engineer Junior",
        "company": "Orange",
        "url": f"https://company.com/jobs/{uuid.uuid4().hex[:8]}",
        "location": "Paris",
        "country": "France",
        "contract_type": "CDI",
        "description": "Description de l'offre",
        "source": "chatgpt_watch",
    }
    data.update(overrides)
    return OpportunityCreate(**data)


# ============================================
# Index
# ============================================

async def test_indexes_are_created(db):
    await svc.ensure_indexes(db)
    info = await db[svc.COLLECTION].index_information()

    assert info["opp_user_url_unique"]["unique"] is True
    assert info["opp_user_url_unique"]["key"] == [("user_id", 1), ("url_normalized", 1)]

    ext = info["opp_user_source_external_id_unique"]
    assert ext["unique"] is True
    assert ext["partialFilterExpression"] == {"external_id": {"$type": "string"}}

    assert "opp_user_status_discovered" in info
    assert "opp_user_discovered" in info
    assert info["opp_id_unique"]["unique"] is True


# ============================================
# Création / lecture
# ============================================

async def test_create_opportunity(db):
    result = await svc.ingest_opportunity(db, USER_A, make(url="https://company.com/jobs/1"))

    assert result.created is True
    assert result.duplicate is False

    doc = await svc.get_opportunity(db, USER_A, result.opportunity_id)
    assert doc["title"] == "Data Engineer Junior"
    assert doc["status"] == OpportunityStatus.NEW.value
    assert doc["user_id"] == USER_A
    assert doc["converted_application_id"] is None
    assert doc["discovered_at"] and doc["created_at"] and doc["updated_at"]
    assert "_id" not in doc and "url_normalized" not in doc


async def test_list_opportunities_filters_search_and_pagination(db):
    await svc.ingest_opportunity(db, USER_A, make(title="Data Engineer", company="Orange"))
    await svc.ingest_opportunity(db, USER_A, make(title="Backend Developer", company="Thales"))
    ignored = await svc.ingest_opportunity(db, USER_A, make(title="Data Analyst", company="SNCF"))
    await svc.ignore_opportunity(db, USER_A, ignored.opportunity_id)

    all_items = await svc.list_opportunities(db, USER_A)
    assert all_items["total"] == 3

    new_items = await svc.list_opportunities(db, USER_A, status=OpportunityStatus.NEW)
    assert new_items["total"] == 2

    ignored_items = await svc.list_opportunities(db, USER_A, status="ignored")
    assert [i["title"] for i in ignored_items["items"]] == ["Data Analyst"]

    by_title = await svc.list_opportunities(db, USER_A, search="data")
    assert by_title["total"] == 2
    by_company = await svc.list_opportunities(db, USER_A, search="thales")
    assert by_company["total"] == 1
    # La recherche est échappée (pas d'injection regex)
    assert (await svc.list_opportunities(db, USER_A, search=".*"))["total"] == 0

    page = await svc.list_opportunities(db, USER_A, page=2, per_page=2)
    assert len(page["items"]) == 1 and page["total_pages"] == 2


async def test_count_new_opportunities(db):
    a = await svc.ingest_opportunity(db, USER_A, make())
    await svc.ingest_opportunity(db, USER_A, make())
    await svc.ingest_opportunity(db, USER_B, make())
    assert await svc.count_new_opportunities(db, USER_A) == 2

    await svc.ignore_opportunity(db, USER_A, a.opportunity_id)
    assert await svc.count_new_opportunities(db, USER_A) == 1


# ============================================
# Isolation utilisateurs
# ============================================

async def test_user_isolation(db):
    a = await svc.ingest_opportunity(db, USER_A, make())

    assert (await svc.list_opportunities(db, USER_B))["total"] == 0
    with pytest.raises(OpportunityNotFound):
        await svc.get_opportunity(db, USER_B, a.opportunity_id)
    with pytest.raises(OpportunityNotFound):
        await svc.ignore_opportunity(db, USER_B, a.opportunity_id)
    with pytest.raises(OpportunityNotFound):
        await svc.update_opportunity(db, USER_B, a.opportunity_id, OpportunityUpdate(title="Piraté"))

    doc = await svc.get_opportunity(db, USER_A, a.opportunity_id)
    assert doc["status"] == "new" and doc["title"] == "Data Engineer Junior"


async def test_same_url_for_two_users_is_not_a_duplicate(db):
    url = "https://company.com/jobs/shared"
    a = await svc.ingest_opportunity(db, USER_A, make(url=url))
    b = await svc.ingest_opportunity(db, USER_B, make(url=url))
    assert a.created and b.created
    assert a.opportunity_id != b.opportunity_id


async def test_payload_user_id_is_rejected():
    with pytest.raises(ValidationError):
        make(user_id=USER_B)


# ============================================
# Ignorer / modifier
# ============================================

async def test_ignore_is_idempotent_and_keeps_document(db):
    a = await svc.ingest_opportunity(db, USER_A, make())

    first = await svc.ignore_opportunity(db, USER_A, a.opportunity_id)
    second = await svc.ignore_opportunity(db, USER_A, a.opportunity_id)
    assert first["status"] == second["status"] == "ignored"
    assert await db[svc.COLLECTION].count_documents({"id": a.opportunity_id}) == 1


async def test_ignored_offer_reimported_stays_ignored(db):
    url = "https://company.com/jobs/ignored"
    a = await svc.ingest_opportunity(db, USER_A, make(url=url))
    await svc.ignore_opportunity(db, USER_A, a.opportunity_id)

    again = await svc.ingest_opportunity(db, USER_A, make(url=url))
    assert again.duplicate is True and again.opportunity_id == a.opportunity_id
    assert (await svc.get_opportunity(db, USER_A, a.opportunity_id))["status"] == "ignored"


async def test_converted_opportunity_cannot_be_ignored_or_restored(db):
    a = await svc.ingest_opportunity(db, USER_A, make())
    # La conversion réelle arrive à l'étape 3 ; on simule l'état converti.
    await db[svc.COLLECTION].update_one(
        {"id": a.opportunity_id},
        {"$set": {"status": "converted", "converted_application_id": "app-1"}},
    )

    with pytest.raises(OpportunityConflict):
        await svc.ignore_opportunity(db, USER_A, a.opportunity_id)
    with pytest.raises(OpportunityConflict):
        await svc.update_opportunity(db, USER_A, a.opportunity_id, OpportunityUpdate(status="new"))

    # Les champs descriptifs restent éditables
    updated = await svc.update_opportunity(db, USER_A, a.opportunity_id, OpportunityUpdate(location="Lyon"))
    assert updated["location"] == "Lyon" and updated["status"] == "converted"


async def test_update_fields_and_restore_status(db):
    a = await svc.ingest_opportunity(db, USER_A, make())
    await svc.ignore_opportunity(db, USER_A, a.opportunity_id)

    updated = await svc.update_opportunity(
        db, USER_A, a.opportunity_id, OpportunityUpdate(status="new", title="Data Engineer Senior")
    )
    assert updated["status"] == "new"
    assert updated["title"] == "Data Engineer Senior"


async def test_update_rejects_converted_status_and_url():
    with pytest.raises(ValidationError):
        OpportunityUpdate(status="converted")
    with pytest.raises(ValidationError):
        OpportunityUpdate(url="https://other.com/job")


# ============================================
# Dédoublonnage
# ============================================

async def test_duplicate_same_url(db):
    url = "https://company.com/jobs/42"
    first = await svc.ingest_opportunity(db, USER_A, make(url=url))
    second = await svc.ingest_opportunity(db, USER_A, make(url=url, title="Autre titre"))

    assert second.created is False and second.duplicate is True
    assert second.opportunity_id == first.opportunity_id
    assert second.duplicate_reason == "url"
    assert await db[svc.COLLECTION].count_documents({"user_id": USER_A}) == 1
    # La première version est conservée
    assert (await svc.get_opportunity(db, USER_A, first.opportunity_id))["title"] == "Data Engineer Junior"


async def test_duplicate_url_with_utm(db):
    first = await svc.ingest_opportunity(db, USER_A, make(url="https://company.com/jobs/123"))
    second = await svc.ingest_opportunity(
        db, USER_A, make(url="https://www.company.com/jobs/123/?utm_source=linkedin&utm_campaign=x#top")
    )
    assert second.duplicate is True and second.opportunity_id == first.opportunity_id


async def test_duplicate_external_id_with_different_url(db):
    first = await svc.ingest_opportunity(
        db, USER_A, make(url="https://company.com/jobs/a", external_id="EXT-1")
    )
    second = await svc.ingest_opportunity(
        db, USER_A, make(url="https://company.com/jobs/a-renamed", external_id="EXT-1")
    )
    assert second.duplicate is True
    assert second.duplicate_reason == "external_id"
    assert second.opportunity_id == first.opportunity_id


async def test_same_external_id_from_other_source_is_not_duplicate(db):
    a = await svc.ingest_opportunity(db, USER_A, make(source="chatgpt_watch", external_id="42"))
    b = await svc.ingest_opportunity(db, USER_A, make(source="external_agent", external_id="42"))
    assert a.created and b.created


async def test_opportunities_without_external_id_do_not_collide(db):
    # L'index partiel ignore les documents sans external_id
    a = await svc.ingest_opportunity(db, USER_A, make(external_id=None))
    b = await svc.ingest_opportunity(db, USER_A, make(external_id=None))
    assert a.created and b.created


async def test_concurrent_ingestion_same_url_creates_once(db):
    url = "https://company.com/jobs/race"
    results = await asyncio.gather(*[
        svc.ingest_opportunity(db, USER_A, make(url=f"{url}?utm_source=s{i}")) for i in range(20)
    ])

    assert sum(r.created for r in results) == 1
    assert len({r.opportunity_id for r in results}) == 1
    assert await db[svc.COLLECTION].count_documents({"user_id": USER_A}) == 1


async def test_concurrent_ingestion_same_external_id_creates_once(db):
    results = await asyncio.gather(*[
        svc.ingest_opportunity(
            db, USER_A, make(url=f"https://company.com/jobs/v{i}", external_id="RACE-1")
        ) for i in range(20)
    ])

    assert sum(r.created for r in results) == 1
    assert len({r.opportunity_id for r in results}) == 1
    assert await db[svc.COLLECTION].count_documents({"user_id": USER_A}) == 1


# ============================================
# Validation du payload
# ============================================

@pytest.mark.parametrize("field,value", [
    ("url", "javascript:alert(1)"),
    ("url", "ftp://company.com/job"),
    ("title", "   "),
    ("company", ""),
    ("description", "x" * 10001),
    ("source", "Source Invalide!"),
    ("metadata", {"$where": "1"}),
    ("metadata", {"a.b": 1}),
    ("metadata", {"blob": "x" * 10001}),
], ids=["javascript-url", "ftp-url", "blank-title", "empty-company", "description-too-long",
        "invalid-source", "metadata-dollar-key", "metadata-dotted-key", "metadata-too-big"])
async def test_invalid_payloads_are_rejected(field, value):
    with pytest.raises(ValidationError):
        make(**{field: value})


async def test_missing_required_fields_are_rejected():
    for missing in ("title", "company", "url"):
        data = {"title": "t", "company": "c", "url": "https://c.com/j"}
        del data[missing]
        with pytest.raises(ValidationError):
            OpportunityCreate(**data)


async def test_source_is_normalized_and_free_form():
    assert make(source="ChatGPT_Watch").source == "chatgpt_watch"
    assert make(source="my-future-agent").source == "my-future-agent"
    assert OpportunityCreate(title="t", company="c", url="https://c.com/j").source == "manual"
