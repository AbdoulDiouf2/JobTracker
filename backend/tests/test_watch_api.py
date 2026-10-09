"""
Tests HTTP de la veille (Lot 2) : /api/watch/*, drapeau admin `watch_enabled`,
source `chatgpt_watch` réservée (P3), absence de route d'ingestion.
"""

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from jose import jwt

from services import watch_ingest_service

pytestmark = pytest.mark.anyio

PREFS_URL = "/api/watch/preferences"


async def enable(db, api, who, enabled=True):
    await db.users.update_one({"id": api.users[who]}, {"$set": {"watch_enabled": enabled}})


async def get_prefs(api, who="a"):
    return await api.get(PREFS_URL, headers=api.headers_for(who))


def body_from(prefs: dict, **overrides) -> dict:
    data = {k: v for k, v in prefs.items() if k not in ("preferences_version", "updated_at")}
    data["expected_version"] = prefs["preferences_version"]
    data.update(overrides)
    return data


async def make_admin(db) -> str:
    admin_id = f"admin-{uuid.uuid4().hex[:6]}"
    await db.users.insert_one({"id": admin_id, "email": f"{admin_id}@test.local", "full_name": "admin",
                               "is_active": True, "role": "admin"})
    return admin_id


def jwt_headers(user_id: str) -> dict:
    from utils.auth import create_access_token
    return {"Authorization": f"Bearer {create_access_token({'sub': user_id})}"}


# ============================================
# Authentification et contrôle d'accès
# ============================================

@pytest.mark.parametrize("path", [PREFS_URL, "/api/watch/status", "/api/watch/runs"])
async def test_requires_authentication(api, path):
    assert (await api.get(path)).status_code in (401, 403)
    forged = jwt.encode({"sub": api.users["a"], "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
                        "votre-cle-secrete-a-changer-en-production", algorithm="HS256")
    r = await api.get(path, headers={"Authorization": f"Bearer {forged}"})
    assert r.status_code == 401


@pytest.mark.parametrize("path", [PREFS_URL, "/api/watch/status", "/api/watch/runs"])
async def test_requires_watch_enabled(api, db, path):
    r = await api.get(path, headers=api.headers_for("a"))
    assert r.status_code == 403 and r.json()["detail"] == {"code": "watch_not_enabled"}
    put = await api.put(PREFS_URL, json={}, headers=api.headers_for("a"))
    assert put.status_code in (403, 422)
    assert await db.watch_preferences.count_documents({}) == 0


async def test_disabled_again_blocks_access(api, db):
    await enable(db, api, "a")
    assert (await get_prefs(api)).status_code == 200
    await enable(db, api, "a", False)
    assert (await get_prefs(api)).status_code == 403


# ============================================
# Préférences
# ============================================

async def test_get_and_update_preferences(api, db):
    await enable(db, api, "a")
    r = await get_prefs(api)
    assert r.status_code == 200
    prefs = r.json()
    assert prefs["preferences_version"] == 1 and prefs["schedule"] == {"timezone": "Europe/Paris", "times": ["08:00", "18:00"]}
    assert "user_id" not in prefs

    r = await api.put(PREFS_URL, json=body_from(prefs, min_score=80), headers=api.headers_for("a"))
    assert r.status_code == 200 and r.json()["preferences_version"] == 2 and r.json()["min_score"] == 80

    stale = await api.put(PREFS_URL, json=body_from(prefs, min_score=90), headers=api.headers_for("a"))
    assert stale.status_code == 409
    assert stale.json()["detail"] == {"code": "version_conflict", "current_version": 2}


@pytest.mark.parametrize("overrides", [
    {"min_score": 10}, {"countries": []}, {"user_id": "victim"}, {"preferences_version": 7},
    {"schedule": {"timezone": "UTC", "times": ["08:00"]}}, {"expected_version": None},
])
async def test_invalid_preferences_are_422(api, db, overrides):
    await enable(db, api, "a")
    prefs = (await get_prefs(api)).json()
    r = await api.put(PREFS_URL, json=body_from(prefs, **overrides), headers=api.headers_for("a"))
    assert r.status_code == 422
    assert (await get_prefs(api)).json()["preferences_version"] == 1


async def test_preferences_and_runs_are_isolated(api, db):
    await enable(db, api, "a")
    await enable(db, api, "b")
    prefs = (await get_prefs(api, "a")).json()
    await api.put(PREFS_URL, json=body_from(prefs, min_score=95), headers=api.headers_for("a"))

    now = datetime.now(timezone.utc)
    from utils.watch_validation import PARIS
    run_id = "veille-" + now.astimezone(PARIS).strftime("%Y%m%d-%H%M") + "-manuel-abcdef"
    await watch_ingest_service.ingest_batch(db, api.users["a"], {"run_id": run_id, "opportunities": [{
        "title": "Data Engineer", "company": "Orange", "url": "https://careers.orange.com/jobs/iso",
        "country": "FR", "contract_type": "CDI", "relevance_score": 99, "relevance_reasons": ["ok"],
    }]})

    b_prefs = (await get_prefs(api, "b")).json()
    assert b_prefs["min_score"] == 75 and b_prefs["preferences_version"] == 1
    b_runs = (await api.get("/api/watch/runs", headers=api.headers_for("b"))).json()
    assert b_runs == {"items": []}
    b_status = (await api.get("/api/watch/status", headers=api.headers_for("b"))).json()
    assert b_status["last_run"] is None and b_status["remaining_today"] == 40

    a_runs = (await api.get("/api/watch/runs", headers=api.headers_for("a"))).json()["items"]
    assert [r["run_id"] for r in a_runs] == [run_id] and a_runs[0]["observed"]["created"] == 1
    a_status = (await api.get("/api/watch/status", headers=api.headers_for("a"))).json()
    assert a_status["last_run"]["run_id"] == run_id and a_status["remaining_today"] == 39
    assert (await api.get("/api/opportunities", headers=api.headers_for("b"))).json()["total"] == 0


async def test_runs_limit_is_bounded(api, db):
    await enable(db, api, "a")
    assert (await api.get("/api/watch/runs?limit=51", headers=api.headers_for("a"))).status_code == 422
    assert (await api.get("/api/watch/runs?limit=0", headers=api.headers_for("a"))).status_code == 422


# ============================================
# Aucune route d'ingestion HTTP à cette étape
# ============================================

@pytest.mark.parametrize("path", ["/api/watch/opportunities", "/api/watch/runs", "/api/watch/report", "/api/watch/ingest"])
async def test_no_http_ingestion_route(api, db, path):
    await enable(db, api, "a")
    r = await api.post(path, json={"run_id": "x", "opportunities": []}, headers=api.headers_for("a"))
    assert r.status_code in (404, 405)


# ============================================
# Source réservée (P3)
# ============================================

async def test_reserved_source_refused_on_manual_route(api, db):
    body = {"title": "T", "company": "C", "url": "https://c.com/jobs/1", "source": "ChatGPT_Watch"}
    r = await api.post("/api/opportunities", json=body, headers=api.headers_for("a"))
    assert r.status_code == 422 and r.json()["detail"] == {"code": "source_reserved"}
    assert await db.opportunities.count_documents({}) == 0


async def test_reserved_source_refused_on_agent_route(api, db):
    r = await api.post("/api/agent-tokens", json={"name": "Agent"}, headers=api.headers_for("a"))
    token = r.json()["token"]
    body = {"title": "T", "company": "C", "url": "https://c.com/jobs/1", "source": "chatgpt_watch"}
    r = await api.post("/api/agent/opportunities", json=body, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 422 and r.json()["detail"] == {"code": "source_reserved"}
    assert await db.opportunities.count_documents({}) == 0
    # Le quota agent n'est pas consommé
    from services import agent_token_service
    token_id = (await db.agent_tokens.find_one({}))["id"]
    assert await agent_token_service.get_creations_today(db, token_id) == 0


async def test_other_sources_still_accepted(api, db):
    body = {"title": "T", "company": "C", "url": "https://c.com/jobs/2", "source": "chrome_extension"}
    r = await api.post("/api/opportunities", json=body, headers=api.headers_for("a"))
    assert r.status_code == 201


# ============================================
# Drapeau admin watch_enabled (D7)
# ============================================

async def test_admin_can_enable_and_disable_watch(api, db):
    admin = await make_admin(db)
    url = f"/api/admin/users/{api.users['a']}/watch"
    r = await api.put(url, json={"enabled": True}, headers=jwt_headers(admin))
    assert r.status_code == 200 and r.json() == {"user_id": api.users["a"], "watch_enabled": True}
    assert (await db.users.find_one({"id": api.users["a"]}))["watch_enabled"] is True
    assert (await get_prefs(api)).status_code == 200

    r = await api.put(url, json={"enabled": False}, headers=jwt_headers(admin))
    assert r.status_code == 200 and (await get_prefs(api)).status_code == 403


async def test_non_admin_cannot_change_watch_flag(api, db):
    r = await api.put(f"/api/admin/users/{api.users['a']}/watch", json={"enabled": True}, headers=api.headers_for("a"))
    assert r.status_code == 403
    assert "watch_enabled" not in await db.users.find_one({"id": api.users["a"]})


@pytest.mark.parametrize("body", [{"enabled": "yes"}, {"enabled": 1}, {}, {"enabled": True, "role": "admin"}])
async def test_admin_watch_flag_validation(api, db, body):
    admin = await make_admin(db)
    r = await api.put(f"/api/admin/users/{api.users['a']}/watch", json=body, headers=jwt_headers(admin))
    assert r.status_code == 422
    user = await db.users.find_one({"id": api.users["a"]})
    assert "watch_enabled" not in user and user["role"] == "standard"


async def test_admin_watch_flag_unknown_user(api, db):
    admin = await make_admin(db)
    r = await api.put("/api/admin/users/nobody/watch", json={"enabled": True}, headers=jwt_headers(admin))
    assert r.status_code == 404
