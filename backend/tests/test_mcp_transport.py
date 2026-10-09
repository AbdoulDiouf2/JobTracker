"""
Transport MCP compatible Vercel (Lot 2, étape 3) : API publiques du SDK, gestionnaire
par requête SANS lifespan (httpx.ASGITransport ne l'exécute pas, comme Vercel),
chargement différé, concurrence, garde-fous d'activation et d'hôte.
Depuis le sous-lot OAuth, chaque appel présente un jeton d'accès OAuth valide
(émis sur la base MongoDB éphémère de test).
"""

import asyncio
import json
import os
import subprocess
import sys
import uuid
from datetime import datetime, timedelta, timezone

import httpx
import pytest

from config import settings
from services import oauth_service
from utils import mcp_transport

pytestmark = pytest.mark.anyio

HOST = "jobtracker.maadec.com"
HEADERS = {"Accept": "application/json, text/event-stream", "Content-Type": "application/json"}
INIT = {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {
    "protocolVersion": "2025-11-25", "capabilities": {}, "clientInfo": {"name": "tests", "version": "0"}}}
LIST = {"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}}
CALL = {"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {"name": "jobtracker_ping", "arguments": {}}}
NOT_FOUND = {"detail": "Not Found"}
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


async def issue_access_token(db, scopes=("watch:read", "opportunities:write")) -> str:
    """Propriétaire éligible + grant actif + jetons, directement via le service OAuth."""
    user_id = "mcp-owner-" + uuid.uuid4().hex[:8]
    await db.users.insert_one({"id": user_id, "email": f"{user_id}@test.local", "is_active": True,
                               "role": "standard", "watch_enabled": True})
    now = datetime.now(timezone.utc)
    grant = {"id": str(uuid.uuid4()), "user_id": user_id, "client_id": "jt_oc_test", "scopes": list(scopes),
             "resource": oauth_service.canonical_resource(), "status": "active", "created_at": now,
             "absolute_expires_at": now + timedelta(days=90)}
    await db[oauth_service.GRANTS].insert_one(dict(grant))
    return (await oauth_service._issue_tokens(db, grant))["access_token"]


@pytest.fixture
async def client(db):
    import server
    previous = (server.client, server.db)
    server.client, server.db = db.client, db
    transport = httpx.ASGITransport(app=server.app)  # n'exécute PAS le lifespan
    async with httpx.AsyncClient(transport=transport, base_url=f"https://{HOST}") as c:
        yield c
    server.client, server.db = previous


@pytest.fixture
async def mcp_on(monkeypatch, client, db):
    monkeypatch.setattr(settings, "MCP_ENABLED", True)
    monkeypatch.setattr(settings, "MCP_ALLOWED_HOSTS", HOST)
    monkeypatch.setattr(settings, "OAUTH_ISSUER", "https://" + HOST)
    monkeypatch.delenv("VERCEL_ENV", raising=False)
    mcp_transport.reset_for_tests()
    await oauth_service.set_kill_switch(db, False, "tests")  # fermé par défaut (A0)
    client.headers["Authorization"] = "Bearer " + await issue_access_token(db)
    yield
    mcp_transport.reset_for_tests()


async def post(client, body, **kwargs):
    return await client.post("/api/mcp", json=body, headers={**HEADERS, **kwargs.pop("headers", {})}, **kwargs)


# ============================================
# Désactivé : indiscernable d'une route absente
# ============================================

@pytest.mark.parametrize("method", ["GET", "POST", "PUT", "DELETE"])
async def test_disabled_by_default_answers_like_missing_route(client, monkeypatch, method):
    monkeypatch.setattr(settings, "MCP_ENABLED", False)
    r = await client.request(method, "/api/mcp", json=INIT, headers=HEADERS)
    missing = await client.request(method, "/api/route-inexistante", headers=HEADERS)
    assert r.status_code == missing.status_code == 404
    assert r.json() == missing.json() == NOT_FOUND
    assert r.content == missing.content  # identique à l'octet près (A0)
    assert r.headers["content-type"] == missing.headers["content-type"]


async def test_blocked_in_vercel_production_even_if_enabled(client, mcp_on, monkeypatch):
    monkeypatch.setenv("VERCEL_ENV", "production")
    r = await post(client, INIT)
    assert r.status_code == 404 and r.json() == NOT_FOUND
    assert mcp_transport.build_count == 0


# ============================================
# Fonctionnement (API publiques, sans lifespan)
# ============================================

async def test_initialize_list_and_call(client, mcp_on):
    r = await post(client, INIT)
    assert r.status_code == 200
    assert r.json()["result"]["serverInfo"]["name"] == "JobTracker"

    tools = (await post(client, LIST)).json()["result"]["tools"]
    assert [t["name"] for t in tools] == ["jobtracker_ping"]
    assert tools[0]["annotations"]["readOnlyHint"] is True
    assert tools[0]["annotations"]["destructiveHint"] is False

    result = (await post(client, CALL)).json()["result"]
    assert result["isError"] is False
    expected = {"service": "jobtracker", "transport": "ok", "authenticated": True}
    assert result["structuredContent"] == expected
    assert json.loads(result["content"][0]["text"]) == expected


async def test_unknown_tool_is_an_error_result(client, mcp_on):
    body = {**CALL, "params": {"name": "delete_everything", "arguments": {}}}
    result = (await post(client, body)).json()["result"]
    assert result["isError"] is True


async def test_server_is_built_once_and_reused(client, mcp_on):
    for _ in range(5):
        assert (await post(client, LIST)).status_code == 200
    assert mcp_transport.build_count == 1


async def test_other_routes_unaffected(client, mcp_on):
    assert (await post(client, LIST)).status_code == 200
    r = await client.get("/api/")
    assert r.status_code == 200 and r.json()["status"] == "running"


# ============================================
# Protection d'hôte et d'origine (anti DNS-rebinding)
# ============================================

async def test_unknown_host_is_refused(client, mcp_on):
    r = await post(client, LIST, headers={"Host": "evil.example"})
    assert r.status_code == 421


@pytest.mark.parametrize("vercel_env", [None, "preview", "development"])
async def test_vercel_deployment_hosts_are_never_added(client, mcp_on, monkeypatch, vercel_env):
    """Aucune Preview : les hôtes de déploiement Vercel ne sont jamais autorisés automatiquement."""
    if vercel_env:
        monkeypatch.setenv("VERCEL_ENV", vercel_env)
    monkeypatch.setenv("VERCEL_URL", "job-tracker-abc.vercel.app")
    monkeypatch.setenv("VERCEL_BRANCH_URL", "job-tracker-git-branche.vercel.app")
    for host in ("job-tracker-abc.vercel.app", "job-tracker-git-branche.vercel.app"):
        r = await post(client, LIST, headers={"Host": host})
        assert r.status_code == 421
    assert mcp_transport.allowed_hosts() == [HOST]


async def test_foreign_origin_is_refused(client, mcp_on):
    r = await post(client, LIST, headers={"Origin": "https://evil.example"})
    assert r.status_code == 403


# ============================================
# Concurrence
# ============================================

@pytest.mark.parametrize("attempt", range(5))
async def test_concurrent_first_calls_build_once_and_all_succeed(client, mcp_on, attempt):
    bodies = [INIT, LIST, CALL] * 10
    responses = await asyncio.gather(*[post(client, {**b, "id": i}) for i, b in enumerate(bodies)])
    assert [r.status_code for r in responses] == [200] * 30
    assert [r.json()["id"] for r in responses] == list(range(30))  # chaque réponse correspond à sa requête
    assert mcp_transport.build_count == 1


# ============================================
# Chargement différé (V5) : processus neuf
# ============================================

LAZY_SCRIPT = r"""
import asyncio, io, contextlib, json, sys, uuid
from datetime import datetime, timedelta, timezone
import httpx
with contextlib.redirect_stdout(io.StringIO()):
    import server
from config import settings
from services import oauth_service
loaded = lambda: any(m == "mcp" or m.startswith("mcp.") for m in sys.modules)
state = {"apres_demarrage": loaded()}
LIST = {"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}
ACCEPT = {"Accept": "application/json, text/event-stream"}
async def main():
    db = server._ensure_db()  # base de test jetable (MONGO_URL / DB_NAME forcés par le test)
    uid = "lazy-" + uuid.uuid4().hex[:6]
    await db.users.insert_one({"id": uid, "is_active": True, "watch_enabled": True})
    now = datetime.now(timezone.utc)
    grant = {"id": str(uuid.uuid4()), "user_id": uid, "client_id": "jt_oc_test", "scopes": ["watch:read"],
             "resource": oauth_service.canonical_resource(), "status": "active", "created_at": now,
             "absolute_expires_at": now + timedelta(days=1)}
    await db[oauth_service.GRANTS].insert_one(dict(grant))
    token = (await oauth_service._issue_tokens(db, grant))["access_token"]
    await oauth_service.set_kill_switch(db, False, "tests")
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app), base_url="https://jobtracker.maadec.com") as c:
        await c.get("/api/")
        state["apres_autre_route"] = loaded()
        settings.MCP_ENABLED = False
        await c.post("/api/mcp", json={})
        state["apres_mcp_desactive"] = loaded()
        settings.MCP_ENABLED = True
        r = await c.post("/api/mcp", json=LIST, headers=ACCEPT)
        state["statut_sans_jeton"] = r.status_code
        state["apres_appel_refuse"] = loaded()
        r = await c.post("/api/mcp", json=LIST, headers={**ACCEPT, "Authorization": "Bearer " + token})
        state["statut_mcp"] = r.status_code
        state["apres_appel_mcp"] = loaded()
asyncio.run(main())
print("RESULT " + json.dumps(state))
"""


def test_sdk_is_loaded_only_on_first_authenticated_mcp_call(mongo_test_db_name):
    MONGO_TEST_URL = os.environ["MONGO_TEST_URL"]  # base locale jetable, vérifiée par conftest
    # Sous-processus : base de test jetable EXPLICITE (jamais celle de backend/.env)
    env = {**os.environ, "APP_ENV": "test", "MCP_ALLOWED_HOSTS": "jobtracker.maadec.com", "PYTHONIOENCODING": "utf-8",
           "MONGO_URL": MONGO_TEST_URL, "DB_NAME": mongo_test_db_name, "OAUTH_ISSUER": "https://jobtracker.maadec.com"}
    env.pop("VERCEL_ENV", None)
    proc = subprocess.run([sys.executable, "-c", LAZY_SCRIPT], cwd=BACKEND_DIR, env=env,
                          capture_output=True, text=True, encoding="utf-8", timeout=300)
    line = [l for l in proc.stdout.splitlines() if l.startswith("RESULT ")]
    assert line, proc.stderr[-2000:]
    state = json.loads(line[0][len("RESULT "):])
    assert state == {
        "apres_demarrage": False, "apres_autre_route": False, "apres_mcp_desactive": False,
        "statut_sans_jeton": 401, "apres_appel_refuse": False,
        "statut_mcp": 200, "apres_appel_mcp": True,
    }


# ============================================
# Découverte OAuth (E0a-1) : le backend répond en JSON
# ============================================

@pytest.mark.parametrize("path", [
    "/.well-known/oauth-protected-resource",
    "/.well-known/oauth-protected-resource/api/mcp",
    "/.well-known/oauth-authorization-server",
    "/.well-known/openid-configuration",
])
async def test_well_known_paths_answer_json_404_for_now(client, path):
    r = await client.get(path)
    assert r.status_code == 404 and r.headers["content-type"] == "application/json"
    assert r.json() == NOT_FOUND
