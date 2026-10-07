"""
Tests du service AgentToken (MongoDB éphémère) : format, hash, index,
authentification, quota persistant sous concurrence.
"""

import asyncio
import hashlib
import uuid

import pytest

from config import settings
from models import AgentTokenCreate, OpportunityCreate
from services import agent_token_service as svc
from services import opportunity_service

pytestmark = pytest.mark.anyio


async def make_user(db, active=True) -> str:
    user_id = "user-" + uuid.uuid4().hex[:8]
    await db.users.insert_one({"id": user_id, "email": f"{user_id}@t.local", "is_active": active})
    return user_id


def offer(**overrides) -> OpportunityCreate:
    data = {"title": "Data Engineer", "company": "Orange",
            "url": f"https://company.com/jobs/{uuid.uuid4().hex[:10]}", "source": "chatgpt_watch"}
    data.update(overrides)
    return OpportunityCreate(**data)


# ============================================
# Format / hash / index
# ============================================

def test_token_format_and_entropy():
    tokens = {svc.generate_token() for _ in range(200)}
    assert len(tokens) == 200
    for t in tokens:
        assert t.startswith("jt_agent_") and len(t) == len("jt_agent_") + 43
        assert svc.is_well_formed(t)


@pytest.mark.parametrize("value", [
    None, "", "jt_agent_", "jt_agent_short", "Bearer jt_agent_x", "eyJhbGciOiJIUzI1NiJ9.e30.x",
    "jt_agent_" + "a" * 42, "jt_agent_" + "a" * 44, "jt_agent_" + "a" * 42 + "!", "JT_AGENT_" + "a" * 43,
])
def test_malformed_tokens(value):
    assert svc.is_well_formed(value) is False


def test_hash_is_sha256_hex():
    t = svc.generate_token()
    assert svc.hash_token(t) == hashlib.sha256(t.encode()).hexdigest()


async def test_indexes(db):
    await svc.ensure_indexes(db)
    tokens = await db[svc.TOKENS].index_information()
    usage = await db[svc.USAGE].index_information()
    assert tokens["agent_token_id_unique"]["unique"] is True
    assert tokens["agent_token_hash_unique"]["unique"] is True
    assert tokens["agent_token_user_created"]["key"] == [("user_id", 1), ("created_at", -1)]
    assert usage["agent_usage_token_date_unique"]["unique"] is True
    assert usage["agent_usage_ttl"]["expireAfterSeconds"] == 0


async def test_raw_token_is_never_stored(db):
    user_id = await make_user(db)
    public, raw = await svc.create_agent_token(db, user_id, AgentTokenCreate(name="Veille"))
    doc = await db[svc.TOKENS].find_one({"id": public["id"]})

    assert raw not in str(doc)
    assert raw[len("jt_agent_") + 4:] not in str(doc)  # même la partie secrète
    assert doc["token_hash"] == hashlib.sha256(raw.encode()).hexdigest()
    assert doc["token_prefix"] == raw[:13]
    assert "token_hash" not in public and "token" not in public


# ============================================
# Authentification
# ============================================

async def test_authenticate_valid_revoked_inactive(db):
    user_id = await make_user(db)
    public, raw = await svc.create_agent_token(db, user_id, AgentTokenCreate(name="Veille"))

    token = await svc.authenticate_agent_token(db, raw)
    assert token["id"] == public["id"] and token["user_id"] == user_id

    assert await svc.authenticate_agent_token(db, svc.generate_token()) is None
    assert await svc.authenticate_agent_token(db, "jt_agent_nope") is None

    await svc.revoke_agent_token(db, user_id, public["id"])
    assert await svc.authenticate_agent_token(db, raw) is None

    user2 = await make_user(db)
    _, raw2 = await svc.create_agent_token(db, user2, AgentTokenCreate(name="Veille"))
    await db.users.update_one({"id": user2}, {"$set": {"is_active": False}})
    assert await svc.authenticate_agent_token(db, raw2) is None


async def test_revoke_is_scoped_and_idempotent(db):
    owner = await make_user(db)
    other = await make_user(db)
    public, raw = await svc.create_agent_token(db, owner, AgentTokenCreate(name="Veille"))

    with pytest.raises(svc.AgentTokenNotFound):
        await svc.revoke_agent_token(db, other, public["id"])
    assert await svc.authenticate_agent_token(db, raw) is not None

    first = await svc.revoke_agent_token(db, owner, public["id"])
    second = await svc.revoke_agent_token(db, owner, public["id"])
    assert first["revoked_at"] == second["revoked_at"] and first["is_active"] is False
    assert await db[svc.TOKENS].count_documents({"id": public["id"]}) == 1  # conservé (audit)


async def test_last_used_throttling(db, monkeypatch):
    user_id = await make_user(db)
    public, raw = await svc.create_agent_token(db, user_id, AgentTokenCreate(name="Veille"))

    token = await svc.authenticate_agent_token(db, raw)
    await svc.touch_last_used(db, token)
    first = (await db[svc.TOKENS].find_one({"id": public["id"]}))["last_used_at"]
    assert first is not None

    token = await svc.authenticate_agent_token(db, raw)
    await svc.touch_last_used(db, token)
    assert (await db[svc.TOKENS].find_one({"id": public["id"]}))["last_used_at"] == first

    monkeypatch.setattr(settings, "AGENT_LAST_USED_THROTTLE_SECONDS", 0)
    await asyncio.sleep(0.01)
    token = await svc.authenticate_agent_token(db, raw)
    await svc.touch_last_used(db, token)
    assert (await db[svc.TOKENS].find_one({"id": public["id"]}))["last_used_at"] > first


async def test_max_active_tokens(db, monkeypatch):
    monkeypatch.setattr(settings, "AGENT_MAX_ACTIVE_TOKENS", 2)
    user_id = await make_user(db)
    t1, _ = await svc.create_agent_token(db, user_id, AgentTokenCreate(name="1"))
    await svc.create_agent_token(db, user_id, AgentTokenCreate(name="2"))
    with pytest.raises(svc.AgentTokenLimitReached):
        await svc.create_agent_token(db, user_id, AgentTokenCreate(name="3"))
    await svc.revoke_agent_token(db, user_id, t1["id"])
    await svc.create_agent_token(db, user_id, AgentTokenCreate(name="3"))


# ============================================
# Quota persistant
# ============================================

async def test_reservation_never_exceeds_quota_under_concurrency(db):
    await svc.ensure_indexes(db)
    token_id, day = "tok-" + uuid.uuid4().hex[:6], "2026-10-07"
    # Aucun document du jour au départ : couvre aussi la course des premiers upserts
    results = await asyncio.gather(*[
        svc._reserve_creation(db, token_id, "u", day, 10) for _ in range(60)
    ])
    assert sum(results) == 10
    doc = await db[svc.USAGE].find_one({"token_id": token_id, "date": day})
    assert doc["creations"] == 10


async def test_zero_quota_blocks(db):
    await svc.ensure_indexes(db)
    assert await svc._reserve_creation(db, "tok-zero", "u", "2026-10-07", 0) is False
    assert await db[svc.USAGE].count_documents({"token_id": "tok-zero"}) == 0


async def test_server_error_does_not_consume_quota(db, monkeypatch):
    user_id = await make_user(db)
    public, _ = await svc.create_agent_token(db, user_id, AgentTokenCreate(name="Veille"))
    token = {"id": public["id"], "user_id": user_id}

    async def boom(*args, **kwargs):
        raise RuntimeError("panne")

    monkeypatch.setattr(opportunity_service, "ingest_opportunity", boom)
    with pytest.raises(RuntimeError):
        await svc.ingest_opportunity_as_agent(db, token, offer())
    assert await svc.get_creations_today(db, public["id"]) == 0


async def test_duplicate_does_not_consume_and_bypasses_exhausted_quota(db, monkeypatch):
    monkeypatch.setattr(settings, "AGENT_DAILY_CREATE_QUOTA", 1)
    user_id = await make_user(db)
    public, _ = await svc.create_agent_token(db, user_id, AgentTokenCreate(name="Veille"))
    token = {"id": public["id"], "user_id": user_id}

    first_offer = offer()
    created = await svc.ingest_opportunity_as_agent(db, token, first_offer)
    assert created.created is True

    dup = await svc.ingest_opportunity_as_agent(db, token, first_offer)
    assert dup.duplicate is True and dup.opportunity_id == created.opportunity_id
    with pytest.raises(svc.AgentQuotaExceeded):
        await svc.ingest_opportunity_as_agent(db, token, offer())
    assert await svc.get_creations_today(db, public["id"]) == 1
