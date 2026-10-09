"""
Tests HTTP : gestion des tokens agent (JWT) et ingestion externe
POST /api/agent/opportunities (AgentToken), contre la MongoDB éphémère.
"""

import asyncio
import hashlib
import logging
import re
import uuid

import pytest

from config import settings
from services import agent_token_service

pytestmark = pytest.mark.anyio


# Horloge figée pour le jour du quota (UTC) : un test qui franchit minuit UTC ne doit pas
# lire le compteur d'un autre jour que celui de ses créations. La logique métier des quotas
# n'est pas modifiée : seule la date renvoyée par _today() est fixée pendant le test.
FROZEN_QUOTA_DAY = "2026-10-08"


@pytest.fixture(autouse=True)
def frozen_quota_day(monkeypatch):
    monkeypatch.setattr(agent_token_service, "_today", lambda: FROZEN_QUOTA_DAY)

TOKEN_RE = re.compile(r"^jt_agent_[A-Za-z0-9_-]{43}$")
AGENT_URL = "/api/agent/opportunities"


async def make_token(api, who="a", name="ChatGPT Watch", **extra) -> dict:
    r = await api.post("/api/agent-tokens", json={"name": name, **extra}, headers=api.headers_for(who))
    assert r.status_code == 201, r.text
    return r.json()


def bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def offer(**overrides) -> dict:
    data = {
        "title": "Data Engineer Junior", "company": "Orange",
        "url": f"https://company.com/jobs/{uuid.uuid4().hex[:10]}",
        "location": "Paris", "country": "France", "contract_type": "CDI",
        "source": "veille_externe",  # chatgpt_watch est réservée à la veille Lot 2 (P3)
    }
    data.update(overrides)
    return data


async def usage(db, token_id) -> int:
    return await agent_token_service.get_creations_today(db, token_id)


# ============================================
# Gestion des tokens (JWT utilisateur)
# ============================================

async def test_create_token_returns_raw_token_once(api, db):
    created = await make_token(api)
    assert TOKEN_RE.match(created["token"])
    assert created["token_prefix"] == created["token"][:13]
    assert created["scopes"] == ["opportunities:create"]
    assert created["is_active"] is True and created["revoked_at"] is None and created["last_used_at"] is None
    assert "token_hash" not in created

    listing = await api.get("/api/agent-tokens", headers=api.headers_for("a"))
    assert listing.status_code == 200
    assert created["token"] not in listing.text
    assert "token_hash" not in listing.text and '"token"' not in listing.text
    assert [t["id"] for t in listing.json()] == [created["id"]]

    doc = await db.agent_tokens.find_one({"id": created["id"]})
    assert created["token"] not in str(doc)
    assert doc["token_hash"] == hashlib.sha256(created["token"].encode()).hexdigest()


@pytest.mark.parametrize("body", [
    {"name": ""}, {"name": "x", "scopes": []}, {"name": "x", "scopes": ["admin"]},
    {"name": "x", "scopes": ["opportunities:read"]}, {"name": "x", "user_id": "other"}, {},
], ids=["empty-name", "no-scope", "admin-scope", "read-scope-not-yet", "user-id-injected", "missing-name"])
async def test_create_token_validation(api, body):
    r = await api.post("/api/agent-tokens", json=body, headers=api.headers_for("a"))
    assert r.status_code == 422


async def test_token_management_requires_webapp_jwt(api):
    created = await make_token(api)
    assert (await api.get("/api/agent-tokens")).status_code in (401, 403)
    # Un token agent n'est pas un JWT utilisateur
    assert (await api.get("/api/agent-tokens", headers=bearer(created["token"]))).status_code == 401
    assert (await api.post("/api/agent-tokens", json={"name": "x"}, headers=bearer(created["token"]))).status_code == 401
    # Le JWT longue durée de l'extension ne gère pas les tokens agent
    r = await api.post("/api/agent-tokens", json={"name": "x"}, headers=api.headers_for("a", source="extension"))
    assert r.status_code == 403


async def test_agent_token_rejected_on_user_routes(api):
    created = await make_token(api)
    for method, path in (("GET", "/api/opportunities"), ("GET", "/api/applications"), ("GET", "/api/auth/me")):
        r = await api.request(method, path, headers=bearer(created["token"]))
        assert r.status_code == 401, path


async def test_token_isolation_between_users(api):
    token_a = await make_token(api, "a")
    await make_token(api, "b")

    listing_b = (await api.get("/api/agent-tokens", headers=api.headers_for("b"))).json()
    assert token_a["id"] not in [t["id"] for t in listing_b]

    r = await api.delete(f"/api/agent-tokens/{token_a['id']}", headers=api.headers_for("b"))
    assert r.status_code == 404
    assert (await api.post(AGENT_URL, json=offer(), headers=bearer(token_a["token"]))).status_code == 201


async def test_revocation_is_immediate_and_kept_for_audit(api, db):
    created = await make_token(api)
    assert (await api.post(AGENT_URL, json=offer(), headers=bearer(created["token"]))).status_code == 201

    r = await api.delete(f"/api/agent-tokens/{created['id']}", headers=api.headers_for("a"))
    assert r.status_code == 200
    assert r.json()["is_active"] is False and r.json()["revoked_at"] is not None
    assert (await api.delete(f"/api/agent-tokens/{created['id']}", headers=api.headers_for("a"))).status_code == 200

    r = await api.post(AGENT_URL, json=offer(), headers=bearer(created["token"]))
    assert r.status_code == 401
    assert await db.agent_tokens.count_documents({"id": created["id"]}) == 1


async def test_max_active_tokens_via_api(api, monkeypatch):
    monkeypatch.setattr(settings, "AGENT_MAX_ACTIVE_TOKENS", 1)
    await make_token(api)
    r = await api.post("/api/agent-tokens", json={"name": "2"}, headers=api.headers_for("a"))
    assert r.status_code == 409


# ============================================
# Ingestion : authentification / autorisation
# ============================================

async def test_valid_token_creates_then_duplicate(api):
    created = await make_token(api)
    payload = offer()

    r1 = await api.post(AGENT_URL, json=payload, headers=bearer(created["token"]))
    assert r1.status_code == 201
    assert r1.json() == {"created": True, "duplicate": False, "opportunity_id": r1.json()["opportunity_id"],
                         "duplicate_reason": None}

    r2 = await api.post(AGENT_URL, json=payload, headers=bearer(created["token"]))
    assert r2.status_code == 200
    assert r2.json()["created"] is False and r2.json()["duplicate"] is True
    assert r2.json()["opportunity_id"] == r1.json()["opportunity_id"]

    # Visible dans le compte du propriétaire du token, et lui seul
    mine = (await api.get("/api/opportunities", headers=api.headers_for("a"))).json()
    other = (await api.get("/api/opportunities", headers=api.headers_for("b"))).json()
    assert mine["total"] == 1 and other["total"] == 0
    assert mine["items"][0]["source"] == "veille_externe"
    assert (await api.get("/api/opportunities/count", headers=api.headers_for("a"))).json() == {"new": 1}


async def test_default_source_is_external_agent(api):
    created = await make_token(api)
    payload = offer()
    del payload["source"]
    r = await api.post(AGENT_URL, json=payload, headers=bearer(created["token"]))
    opp = (await api.get(f"/api/opportunities/{r.json()['opportunity_id']}", headers=api.headers_for("a"))).json()
    assert opp["source"] == "external_agent"


async def test_token_of_user_b_writes_only_to_b(api):
    token_b = await make_token(api, "b")
    await api.post(AGENT_URL, json=offer(), headers=bearer(token_b["token"]))
    assert (await api.get("/api/opportunities", headers=api.headers_for("a"))).json()["total"] == 0
    assert (await api.get("/api/opportunities", headers=api.headers_for("b"))).json()["total"] == 1


@pytest.mark.parametrize("headers", [
    {},
    {"Authorization": "Bearer"},
    {"Authorization": "Bearer jt_agent_short"},
    {"Authorization": "Bearer not-a-token"},
    {"Authorization": "Basic dXNlcjpwYXNz"},
    {"Authorization": "Token " + "jt_agent_" + "a" * 43},
    {"Authorization": "Bearer jt_agent_" + "a" * 43},  # bien formé mais inconnu
], ids=["missing", "empty-bearer", "malformed", "garbage", "basic-auth", "non-bearer-scheme", "unknown-token"])
async def test_invalid_authorization_returns_401(api, db, headers):
    r = await api.post(AGENT_URL, json=offer(), headers=headers)
    assert r.status_code == 401
    assert r.headers.get("www-authenticate") == "Bearer"
    assert await db.opportunities.count_documents({}) == 0


async def test_user_jwt_is_rejected_on_agent_api(api):
    r = await api.post(AGENT_URL, json=offer(), headers=api.headers_for("a"))
    assert r.status_code == 401


async def test_inactive_owner_returns_401(api, db):
    created = await make_token(api)
    await db.users.update_one({"id": api.users["a"]}, {"$set": {"is_active": False}})
    assert (await api.post(AGENT_URL, json=offer(), headers=bearer(created["token"]))).status_code == 401


@pytest.mark.parametrize("scopes", [[], ["opportunities:read"], ["admin"]], ids=["none", "other-scope", "unknown"])
async def test_missing_scope_returns_403(api, db, scopes):
    created = await make_token(api)
    await db.agent_tokens.update_one({"id": created["id"]}, {"$set": {"scopes": scopes}})
    r = await api.post(AGENT_URL, json=offer(), headers=bearer(created["token"]))
    assert r.status_code == 403
    assert await db.opportunities.count_documents({}) == 0


@pytest.mark.parametrize("patch", [
    {"user_id": "victim"}, {"status": "converted"}, {"url": "javascript:alert(1)"}, {"title": ""},
], ids=["user-id-injected", "status-injected", "javascript-url", "empty-title"])
async def test_invalid_payload_returns_422_without_quota(api, db, patch):
    created = await make_token(api)
    r = await api.post(AGENT_URL, json=offer(**patch), headers=bearer(created["token"]))
    assert r.status_code == 422
    assert await db.opportunities.count_documents({}) == 0
    assert await usage(db, created["id"]) == 0


async def test_last_used_at_is_updated(api):
    created = await make_token(api)
    await api.post(AGENT_URL, json=offer(), headers=bearer(created["token"]))
    tokens = (await api.get("/api/agent-tokens", headers=api.headers_for("a"))).json()
    assert tokens[0]["last_used_at"] is not None


async def test_no_secret_in_logs(api, caplog):
    caplog.set_level(logging.DEBUG)
    created = await make_token(api)
    raw = created["token"]
    secret_part = raw[13:]

    await api.post(AGENT_URL, json=offer(), headers=bearer(raw))
    await api.post(AGENT_URL, json=offer(user_id="x"), headers=bearer(raw))
    await api.delete(f"/api/agent-tokens/{created['id']}", headers=api.headers_for("a"))
    await api.post(AGENT_URL, json=offer(), headers=bearer(raw))

    logs = caplog.text
    assert secret_part not in logs
    assert "Authorization" not in logs and "Bearer " not in logs
    assert "agent_ingest" in logs and created["token_prefix"] in logs


# ============================================
# Rate limiting burst (30/min/token)
# ============================================

async def test_burst_limit_is_per_token(api):
    t1 = await make_token(api, name="t1")
    t2 = await make_token(api, name="t2")
    payload = offer()  # doublons : ne consomment pas le quota journalier

    statuses = [(await api.post(AGENT_URL, json=payload, headers=bearer(t1["token"]))).status_code for _ in range(31)]
    assert statuses[:30].count(429) == 0
    assert statuses[30] == 429

    # Un autre token du même utilisateur n'est pas affecté
    assert (await api.post(AGENT_URL, json=payload, headers=bearer(t2["token"]))).status_code == 200


# ============================================
# Quota journalier persistant
# ============================================

async def test_daily_quota_reached(api, db, monkeypatch):
    monkeypatch.setattr(settings, "AGENT_DAILY_CREATE_QUOTA", 3)
    created = await make_token(api)
    first = offer()

    for p in (first, offer(), offer()):
        assert (await api.post(AGENT_URL, json=p, headers=bearer(created["token"]))).status_code == 201

    r = await api.post(AGENT_URL, json=offer(), headers=bearer(created["token"]))
    assert r.status_code == 429
    assert r.json()["detail"] == {"code": "agent_daily_quota_exceeded", "quota": 3}
    assert int(r.headers["retry-after"]) > 0

    # Un doublon reste accepté (retry de veille sûr) et ne consomme rien
    r = await api.post(AGENT_URL, json=first, headers=bearer(created["token"]))
    assert r.status_code == 200 and r.json()["duplicate"] is True
    assert await usage(db, created["id"]) == 3
    assert await db.opportunities.count_documents({}) == 3


async def test_concurrent_creations_near_limit(api, db, monkeypatch):
    monkeypatch.setattr(settings, "AGENT_DAILY_CREATE_QUOTA", 5)
    created = await make_token(api)
    responses = await asyncio.gather(*[
        api.post(AGENT_URL, json=offer(), headers=bearer(created["token"])) for _ in range(12)
    ])
    codes = sorted(r.status_code for r in responses)
    assert codes.count(201) == 5 and codes.count(429) == 7
    assert await usage(db, created["id"]) == 5
    assert await db.opportunities.count_documents({}) == 5


async def test_concurrent_duplicates_consume_once(api, db, monkeypatch):
    monkeypatch.setattr(settings, "AGENT_DAILY_CREATE_QUOTA", 5)
    created = await make_token(api)
    payload = offer()
    responses = await asyncio.gather(*[
        api.post(AGENT_URL, json=payload, headers=bearer(created["token"])) for _ in range(10)
    ])
    assert sorted(r.status_code for r in responses) == [200] * 9 + [201]
    assert len({r.json()["opportunity_id"] for r in responses}) == 1
    assert await usage(db, created["id"]) == 1


async def test_duplicates_when_quota_almost_reached(api, db, monkeypatch):
    monkeypatch.setattr(settings, "AGENT_DAILY_CREATE_QUOTA", 2)
    created = await make_token(api)
    existing = offer()
    await api.post(AGENT_URL, json=existing, headers=bearer(created["token"]))

    responses = await asyncio.gather(
        *[api.post(AGENT_URL, json=existing, headers=bearer(created["token"])) for _ in range(5)],
        api.post(AGENT_URL, json=offer(), headers=bearer(created["token"])),
        api.post(AGENT_URL, json=offer(), headers=bearer(created["token"])),
    )
    duplicates, news = responses[:5], responses[5:]
    assert all(r.status_code == 200 and r.json()["duplicate"] for r in duplicates)
    assert sorted(r.status_code for r in news) == [201, 429]
    assert await usage(db, created["id"]) == 2


async def test_two_tokens_have_independent_quotas(api, db, monkeypatch):
    monkeypatch.setattr(settings, "AGENT_DAILY_CREATE_QUOTA", 2)
    t1 = await make_token(api, name="t1")
    t2 = await make_token(api, name="t2")
    for _ in range(2):
        assert (await api.post(AGENT_URL, json=offer(), headers=bearer(t1["token"]))).status_code == 201
    assert (await api.post(AGENT_URL, json=offer(), headers=bearer(t1["token"]))).status_code == 429
    assert (await api.post(AGENT_URL, json=offer(), headers=bearer(t2["token"]))).status_code == 201
    assert await usage(db, t1["id"]) == 2 and await usage(db, t2["id"]) == 1
