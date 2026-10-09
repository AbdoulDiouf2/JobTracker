"""
Sous-lot A0 (préparation de l'activation, sans activation) :
- deux clés cumulatives en production (MCP_ENABLED et MCP_PRODUCTION_ALLOWED) ;
- interrupteur d'urgence FERMÉ par défaut (absent, invalide ou base illisible -> coupé) ;
- 404 de /api/mcp identique à l'octet près à une route absente ;
- ajout strict d'une adresse de retour à un client existant (service et script) ;
- script d'essai manuel V1 à V6, exécuté contre l'application en mémoire (jamais la base réelle) ;
- catalogue exposé : `jobtracker_ping` et les cinq outils métier, chacun avec son scope.
"""

import io
import json
import os
import subprocess
import sys
from types import SimpleNamespace

import httpx
import pytest

from config import settings
from services import oauth_service as svc
from utils import mcp_transport

pytestmark = pytest.mark.anyio

ISSUER = "https://jobtracker.maadec.com"
HOST = "jobtracker.maadec.com"
REDIRECT = svc.CHATGPT_DEFAULT_REDIRECT
MCP_HEADERS = {"Accept": "application/json, text/event-stream", "Content-Type": "application/json", "Host": HOST}
LIST = {"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DISCOVERY = ["/.well-known/oauth-protected-resource/api/mcp", "/.well-known/oauth-authorization-server"]


@pytest.fixture(autouse=True)
def base_settings(monkeypatch):
    monkeypatch.setattr(settings, "MCP_ALLOWED_HOSTS", HOST)
    monkeypatch.setattr(settings, "OAUTH_ISSUER", ISSUER)
    monkeypatch.setattr(settings, "MCP_ENABLED", False)
    monkeypatch.setattr(settings, "MCP_PRODUCTION_ALLOWED", False)
    monkeypatch.delenv("VERCEL_ENV", raising=False)
    from routes.oauth import limiter
    limiter.reset()
    mcp_transport.reset_for_tests()
    yield
    limiter.reset()


def configure(monkeypatch, enabled, production_allowed, vercel_env="production"):
    monkeypatch.setattr(settings, "MCP_ENABLED", enabled)
    monkeypatch.setattr(settings, "MCP_PRODUCTION_ALLOWED", production_allowed)
    if vercel_env:
        monkeypatch.setenv("VERCEL_ENV", vercel_env)
    else:
        monkeypatch.delenv("VERCEL_ENV", raising=False)


async def surface(api):
    """Statuts de toute la surface MCP / OAuth / découverte."""
    out = {"mcp": (await api.post("/api/mcp", json=LIST, headers=MCP_HEADERS)).status_code,
           "authorize": (await api.get("/api/oauth/authorize")).status_code,
           "token": (await api.post("/api/oauth/token", data={})).status_code}
    for p in DISCOVERY:
        out[p] = (await api.get(p)).status_code
    return out


# ============================================
# Deux clés cumulatives (activation partielle)
# ============================================

@pytest.mark.parametrize("enabled, allowed, vercel_env, expected", [
    (False, False, "production", False),
    (True, False, "production", False),   # MCP_ENABLED seul : refusé en production
    (False, True, "production", False),   # seconde clé seule : refusé
    (True, True, "production", True),
    (True, False, "preview", True),        # hors production : MCP_ENABLED suffit
    (True, False, None, True),
    (False, True, None, False),
    (True, True, "PRODUCTION", True),
    (True, False, " Production ", False),
])
def test_two_key_rule(monkeypatch, enabled, allowed, vercel_env, expected):
    configure(monkeypatch, enabled, allowed, vercel_env)
    assert mcp_transport.mcp_enabled() is expected


@pytest.mark.parametrize("enabled, allowed", [(True, False), (False, True), (False, False)])
async def test_partial_activation_in_production_keeps_everything_absent(api, db, monkeypatch, enabled, allowed):
    configure(monkeypatch, enabled, allowed)
    await svc.set_kill_switch(db, False, "tests")  # même interrupteur ouvert
    assert await surface(api) == {"mcp": 404, "authorize": 404, "token": 404, DISCOVERY[0]: 404, DISCOVERY[1]: 404}


async def test_both_keys_but_kill_switch_absent_stays_cut(api, db, monkeypatch):
    """Fermé par défaut : sans ouverture explicite en base, le service reste coupé."""
    configure(monkeypatch, True, True)
    assert await svc.kill_switch_active(db) is True
    assert await surface(api) == {"mcp": 503, "authorize": 503, "token": 503, DISCOVERY[0]: 404, DISCOVERY[1]: 404}


async def test_full_activation_then_emergency_cut(api, db, monkeypatch):
    configure(monkeypatch, True, True)
    await svc.set_kill_switch(db, False, "admin")
    r = await api.post("/api/mcp", json=LIST, headers=MCP_HEADERS)
    assert r.status_code == 401 and "resource_metadata=" in r.headers["www-authenticate"]
    assert (await api.get(DISCOVERY[0])).json()["resource"] == ISSUER + "/api/mcp"
    # Coupure d'urgence : immédiate, sans redéploiement
    await svc.set_kill_switch(db, True, "admin")
    assert await surface(api) == {"mcp": 503, "authorize": 503, "token": 503, DISCOVERY[0]: 404, DISCOVERY[1]: 404}


# ============================================
# Interrupteur d'urgence fermé par défaut
# ============================================

@pytest.mark.parametrize("doc, active", [
    (None, True), ({"value": False}, False), ({"value": True}, True),
    ({"value": "false"}, True), ({"value": 0}, True), ({"value": None}, True), ({}, True),
])
async def test_kill_switch_is_closed_unless_explicitly_opened(db, doc, active):
    if doc is not None:
        await db.platform_settings.insert_one({"key": svc.KILL_SWITCH_KEY, **doc})
    assert await svc.kill_switch_active(db) is active


async def test_kill_switch_unreadable_database_means_cut():
    class Broken:
        async def find_one(self, *args, **kwargs):
            raise RuntimeError("base indisponible")
    assert await svc.kill_switch_active(SimpleNamespace(platform_settings=Broken())) is True


async def test_admin_sees_closed_switch_by_default(api, db):
    import uuid
    from utils.auth import create_access_token
    admin_id = "admin-" + uuid.uuid4().hex[:6]
    await db.users.insert_one({"id": admin_id, "email": "a@test.local", "is_active": True, "role": "admin"})
    h = {"Authorization": f"Bearer {create_access_token({'sub': admin_id})}"}
    assert (await api.get("/api/admin/settings/mcp-kill-switch", headers=h)).json() == {"active": True}
    await api.put("/api/admin/settings/mcp-kill-switch", json={"active": False}, headers=h)
    assert (await api.get("/api/admin/settings/mcp-kill-switch", headers=h)).json() == {"active": False}


# ============================================
# 404 identique à une route absente
# ============================================

@pytest.mark.parametrize("vercel_env, enabled", [(None, False), ("production", True)])
@pytest.mark.parametrize("method", ["GET", "POST", "DELETE"])
async def test_inactive_mcp_404_is_byte_identical(api, monkeypatch, vercel_env, enabled, method):
    configure(monkeypatch, enabled, False, vercel_env)
    r = await api.request(method, "/api/mcp", headers=MCP_HEADERS)
    missing = await api.request(method, "/api/route-inexistante", headers=MCP_HEADERS)
    assert r.status_code == missing.status_code == 404
    assert r.content == missing.content == b'{"detail":"Not Found"}'
    assert r.headers["content-type"] == missing.headers["content-type"]
    assert r.headers["content-length"] == missing.headers["content-length"]


# ============================================
# Adresses de retour : validation stricte et ajout
# ============================================

@pytest.mark.parametrize("uri", [REDIRECT, "https://chatgpt.com/connector/oauth/AbC_123-xyz"])
def test_valid_redirect_uris(uri):
    assert svc.validate_redirect_uri(uri) == uri


@pytest.mark.parametrize("uri", [
    "http://chatgpt.com/cb", "https://chatgpt.com/cb?x=1", "https://chatgpt.com/cb?", "https://chatgpt.com/cb#f",
    "https://u:p@chatgpt.com/cb", "https://chatgpt.com:8443/cb", "https://1.2.3.4/cb", "https://[::1]/cb",
    " https://chatgpt.com/cb", "https://chatgpt.com/cb ", "https://chatgpt.com/c b", "https://*.chatgpt.com/cb",
    "https://ChatGPT.com/cb", "https://chatgpt.com", "https://localhost/cb", "http://localhost/cb",
    "javascript:alert(1)", "", "https://chatgpt.com/" + "a" * 520, "https://chatgpt.com\\@evil.com/cb",
])
def test_invalid_redirect_uris(uri):
    with pytest.raises(ValueError):
        svc.validate_redirect_uri(uri)


def test_local_redirect_only_when_explicitly_allowed():
    assert svc.validate_redirect_uri("http://localhost:3000/cb", allow_local=True)
    with pytest.raises(ValueError):
        svc.validate_redirect_uri("http://localhost:3000/cb")


async def test_add_redirect_uri(db):
    client = await svc.create_client(db, "ChatGPT", [REDIRECT])
    new = "https://chatgpt.com/connector/oauth/cb_42"
    assert await svc.add_redirect_uri(db, client["client_id"], new) == [REDIRECT, new]
    assert await svc.add_redirect_uri(db, client["client_id"], new) == [REDIRECT, new]  # idempotent
    with pytest.raises(ValueError):
        await svc.add_redirect_uri(db, client["client_id"], "https://chatgpt.com/connector/oauth/cb_42?x=1")
    with pytest.raises(ValueError):
        await svc.add_redirect_uri(db, "jt_oc_inconnu", new)
    stored = await db[svc.CLIENTS].find_one({"client_id": client["client_id"]})
    assert stored["redirect_uris"] == [REDIRECT, new]


async def test_added_redirect_uri_is_used_exactly(api, db, monkeypatch):
    configure(monkeypatch, True, False, None)
    await svc.set_kill_switch(db, False, "tests")
    client = await svc.create_client(db, "ChatGPT", [REDIRECT])
    new = "https://chatgpt.com/connector/oauth/cb_42"
    _, challenge = __import__("scripts.oauth_manual_check", fromlist=["new_pkce"]).new_pkce()
    params = {"response_type": "code", "client_id": client["client_id"], "code_challenge": challenge,
              "code_challenge_method": "S256", "resource": ISSUER + "/api/mcp"}
    assert (await api.get("/api/oauth/authorize", params={**params, "redirect_uri": new})).status_code == 400
    await svc.add_redirect_uri(db, client["client_id"], new)
    assert (await api.get("/api/oauth/authorize", params={**params, "redirect_uri": new})).status_code == 302
    variant = await api.get("/api/oauth/authorize", params={**params, "redirect_uri": new + "/"})
    assert variant.status_code == 400 and "location" not in variant.headers


def run_cli(mongo_db, *args):
    env = {**os.environ, "APP_ENV": "test", "MONGO_URL": os.environ["MONGO_TEST_URL"], "DB_NAME": mongo_db,
           "PYTHONIOENCODING": "utf-8"}
    return subprocess.run([sys.executable, "scripts/manage_oauth_client.py", *args], cwd=BACKEND_DIR, env=env,
                          capture_output=True, text=True, encoding="utf-8", timeout=120)


async def test_cli_add_redirect_uri_and_list_never_shows_secret(db, mongo_test_db_name):
    """Script d'administration contre la base de TEST uniquement (MONGO_URL forcé)."""
    created = run_cli(mongo_test_db_name, "create", "--name", "ChatGPT")
    assert created.returncode == 0, created.stderr
    import re
    client_id = re.search(r"^client_id\s*:\s*(\S+)", created.stdout, re.M).group(1)
    secret = re.search(r"^client_secret\s*:\s*(\S+)", created.stdout, re.M).group(1)
    assert client_id.startswith("jt_oc_") and secret.startswith("jt_ocs_")
    added = run_cli(mongo_test_db_name, "add-redirect-uri", "--client-id", client_id,
                    "--redirect-uri", "https://chatgpt.com/connector/oauth/cb_77")
    assert added.returncode == 0 and "cb_77" in added.stdout
    refused = run_cli(mongo_test_db_name, "add-redirect-uri", "--client-id", client_id,
                      "--redirect-uri", "http://chatgpt.com/cb")
    assert refused.returncode != 0 and "HTTPS" in refused.stderr
    listed = run_cli(mongo_test_db_name, "list")
    assert client_id in listed.stdout and "cb_77" in listed.stdout
    for output in (added.stdout, added.stderr, refused.stdout, refused.stderr, listed.stdout, listed.stderr):
        assert secret not in output


# ============================================
# Script d'essai manuel V1 à V6 (application en mémoire, base de test)
# ============================================

async def test_manual_check_script_end_to_end(api, db, monkeypatch):
    from scripts import oauth_manual_check as script
    configure(monkeypatch, True, False, None)
    await svc.set_kill_switch(db, False, "tests")
    await db.users.update_one({"id": api.users["a"]}, {"$set": {"watch_enabled": True}})
    client = await svc.create_client(db, "ChatGPT", [REDIRECT])
    import server
    http = httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app), base_url=ISSUER)
    printed = io.StringIO()
    out = lambda *a: print(*a, file=printed)  # noqa: E731

    async def browser_step():
        """Simule le navigateur connecté : suit l'URL affichée, approuve, renvoie l'URL ChatGPT."""
        url = [l for l in printed.getvalue().splitlines() if l.startswith(ISSUER + "/api/oauth/authorize")][-1]
        r = await http.get(url[len(ISSUER):])
        request_id = r.headers["location"].split("request=")[1]
        decision = await http.post("/api/oauth/consent", json={"request_id": request_id, "approve": True},
                                   headers=api.headers_for("a"))
        final = await http.get(decision.json()["continue_url"][len(ISSUER):])
        return final.headers["location"]

    # La saisie de l'URL de retour est simulée en enveloppant finish_flow : le navigateur
    # (approbation puis continuation) est rejoué via l'API, avec la session de test.
    args = script.parse_args(["--base", ISSUER, "--client-id", client["client_id"]])
    orig_finish = script.finish_flow

    async def finish(http_, base, cid, secret, redirect, verifier, state, returned, rep):
        returned = await browser_step()
        return await orig_finish(http_, base, cid, secret, redirect, verifier, state, returned, rep)

    monkeypatch.setattr(script, "finish_flow", finish)
    code = await script.main(args, http=http, ask=lambda p: "", ask_secret=lambda p: client["client_secret"], out=out)
    await http.aclose()
    text = printed.getvalue()
    assert code == 0, text
    for label in ("V1 métadonnées de ressource", "V2 /api/mcp sans jeton", "V3 client inconnu", "V5 retour",
                  "V6 échange du code", "V6 outils exposés", "V6 jobtracker_ping", "V6 révocation"):
        assert f"[OK] {label}" in text, text
    assert "ÉCHEC" not in text
    # Jamais de secret ni de jeton dans la sortie
    assert client["client_secret"] not in text
    tokens = [d async for d in db[svc.TOKENS].find({}, {"token_hash": 1})]
    assert tokens and "jt_oat_" in text and all(t["token_hash"] not in text for t in tokens)
    assert "code=" not in text.replace("code_challenge", "")


async def test_manual_check_only_anonymous_checks(api, db, monkeypatch):
    from scripts import oauth_manual_check as script
    configure(monkeypatch, True, False, None)
    await svc.set_kill_switch(db, False, "tests")
    import server
    printed = io.StringIO()
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app), base_url=ISSUER) as http:
        code = await script.main(script.parse_args(["--base", ISSUER, "--checks-only"]), http=http,
                                 out=lambda *a: print(*a, file=printed))
    assert code == 0 and printed.getvalue().count("[OK]") == 4


async def test_manual_check_detects_closed_service(api, db, monkeypatch):
    """Service fermé : le script le signale (ÉCHEC), sans planter."""
    from scripts import oauth_manual_check as script
    import server
    printed = io.StringIO()
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app), base_url=ISSUER) as http:
        code = await script.main(script.parse_args(["--base", ISSUER, "--checks-only"]), http=http,
                                 out=lambda *a: print(*a, file=printed))
    assert code == 1 and "[ÉCHEC] V1" in printed.getvalue()


# ============================================
# Catalogue exposé : diagnostic + cinq outils métier (GO du Lot 2)
# ============================================

async def issue_access_token(db):
    """Propriétaire éligible + grant actif, directement via le service (base de test)."""
    import uuid
    from datetime import datetime, timedelta, timezone
    user_id = "a0-owner-" + uuid.uuid4().hex[:6]
    await db.users.insert_one({"id": user_id, "is_active": True, "watch_enabled": True})
    now = datetime.now(timezone.utc)
    grant = {"id": str(uuid.uuid4()), "user_id": user_id, "client_id": "jt_oc_test",
             "scopes": ["watch:read", "opportunities:write"], "resource": svc.canonical_resource(),
             "status": "active", "created_at": now, "absolute_expires_at": now + timedelta(days=1)}
    # Client enregistré et actif : un jeton d'un client inconnu ou désactivé est refusé
    await db[svc.CLIENTS].update_one({"client_id": grant["client_id"]}, {"$set": {"active": True, "name": "ChatGPT", "redirect_uris": []}}, upsert=True)
    await db[svc.GRANTS].insert_one(dict(grant))
    return (await svc._issue_tokens(db, grant))["access_token"]


BUSINESS_TOOLS = ["get_watch_preferences", "create_opportunities", "list_recent_opportunities",
                  "get_watch_status", "report_watch_run"]


def test_declared_tools_and_scopes():
    """Moindre privilège (§3.5) : lecture en watch:read, écritures en opportunities:write."""
    assert mcp_transport.TOOL_SCOPES == {
        "jobtracker_ping": "watch:read", "get_watch_preferences": "watch:read",
        "list_recent_opportunities": "watch:read", "get_watch_status": "watch:read",
        "create_opportunities": "opportunities:write", "report_watch_run": "opportunities:write",
    }


@pytest.mark.parametrize("tool", BUSINESS_TOOLS)
async def test_business_tools_reject_invalid_calls_without_writing(api, db, monkeypatch, tool):
    configure(monkeypatch, True, False, None)
    await svc.set_kill_switch(db, False, "tests")
    token = await issue_access_token(db)
    headers = {**MCP_HEADERS, "Authorization": f"Bearer {token}"}
    listed = await api.post("/api/mcp", json=LIST, headers=headers)
    assert [t["name"] for t in listed.json()["result"]["tools"]] == ["jobtracker_ping"] + BUSINESS_TOOLS
    call = await api.post("/api/mcp", json={"jsonrpc": "2.0", "id": 2, "method": "tools/call",
                                            "params": {"name": tool, "arguments": {"user_id": "autre"}}},
                          headers=headers)
    assert call.json()["result"]["isError"] is True
    assert json.loads(call.json()["result"]["content"][0]["text"])["error"]["code"] == "invalid_arguments"
    assert await db.opportunities.count_documents({}) == 0
    assert await db.watch_runs.count_documents({}) == 0
