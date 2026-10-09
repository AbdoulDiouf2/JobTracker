"""
Serveur OAuth 2.1 du connecteur MCP (Lot 2, étape 3, sous-lot OAuth minimal).
MongoDB éphémère, application FastAPI réelle (ASGI en mémoire, sans lifespan).
Aucun réseau, aucune donnée réelle.
"""

import base64
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urlsplit

import pytest

from config import settings
from services import oauth_service as svc
from utils import mcp_transport

pytestmark = pytest.mark.anyio

ISSUER = "https://jobtracker.maadec.com"
RESOURCE = ISSUER + "/api/mcp"
REDIRECT = svc.CHATGPT_DEFAULT_REDIRECT
HOST = "jobtracker.maadec.com"
MCP_HEADERS = {"Accept": "application/json, text/event-stream", "Content-Type": "application/json", "Host": HOST}
LIST = {"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}
PING = {"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {"name": "jobtracker_ping", "arguments": {}}}


@pytest.fixture(autouse=True)
def oauth_on(monkeypatch):
    monkeypatch.setattr(settings, "MCP_ENABLED", True)
    monkeypatch.setattr(settings, "MCP_ALLOWED_HOSTS", HOST)
    monkeypatch.setattr(settings, "OAUTH_ISSUER", ISSUER)
    monkeypatch.delenv("VERCEL_ENV", raising=False)
    from routes.oauth import limiter
    limiter.reset()
    mcp_transport.reset_for_tests()
    yield
    limiter.reset()


@pytest.fixture(autouse=True)
async def kill_switch_open(db):
    """L'interrupteur d'urgence est FERMÉ par défaut (A0) : ces tests l'ouvrent explicitement."""
    await svc.set_kill_switch(db, False, "tests")


def pkce():
    verifier = secrets.token_urlsafe(48)[:64]
    return verifier, svc.pkce_s256(verifier)


def qs(url):
    return {k: v[0] for k, v in parse_qs(urlsplit(url).query).items()}


async def enable_watch(db, api, who="a", enabled=True):
    await db.users.update_one({"id": api.users[who]}, {"$set": {"watch_enabled": enabled}})


async def new_client(db, uris=(REDIRECT,)):
    return await svc.create_client(db, "ChatGPT", list(uris))


def authorize_params(client, challenge, **over):
    params = {"response_type": "code", "client_id": client["client_id"], "redirect_uri": REDIRECT,
              "code_challenge": challenge, "code_challenge_method": "S256", "state": "etat-123",
              "scope": "watch:read opportunities:write", "resource": RESOURCE}
    params.update(over)
    return {k: v for k, v in params.items() if v is not None}


async def decide(api, request_id, approve=True, who="a"):
    """POST /consent : renvoie la réponse (continue_url, jamais de code)."""
    return await api.post("/api/oauth/consent", json={"request_id": request_id, "approve": approve},
                          headers=api.headers_for(who))


async def follow(api, continue_url):
    """Navigation du navigateur vers /api/oauth/continue : renvoie la réponse (302 attendu)."""
    assert continue_url.startswith(ISSUER + "/api/oauth/continue?ticket=")
    return await api.get(continue_url[len(ISSUER):])


async def consent_redirect(api, request_id, approve=True, who="a"):
    """Décision + continuation : URL finale de retour vers le client."""
    r = await decide(api, request_id, approve, who)
    assert r.status_code == 200, r.text
    final = await follow(api, r.json()["continue_url"])
    assert final.status_code == 302, final.text
    return final.headers["location"]


async def get_code(api, db, client, who="a", **over):
    verifier, challenge = pkce()
    r = await api.get("/api/oauth/authorize", params=authorize_params(client, challenge, **over))
    assert r.status_code == 302, r.text
    request_id = qs(r.headers["location"])["request"]
    return qs(await consent_redirect(api, request_id, True, who))["code"], verifier


async def token_call(api, client, form, basic=False):
    if basic:
        cred = base64.b64encode(f"{client['client_id']}:{client['client_secret']}".encode()).decode()
        return await api.post("/api/oauth/token", data=form, headers={"Authorization": f"Basic {cred}"})
    return await api.post("/api/oauth/token", data={**form, "client_id": client["client_id"],
                                                    "client_secret": client["client_secret"]})


async def full_flow(api, db, who="a", scope="watch:read opportunities:write"):
    await enable_watch(db, api, who)
    client = await new_client(db)
    code, verifier = await get_code(api, db, client, who, scope=scope)
    r = await token_call(api, client, {"grant_type": "authorization_code", "code": code,
                                       "code_verifier": verifier, "redirect_uri": REDIRECT, "resource": RESOURCE})
    assert r.status_code == 200, r.text
    return client, r.json()


async def mcp(api, body, token=None, **headers):
    h = dict(MCP_HEADERS)
    if token:
        h["Authorization"] = f"Bearer {token}"
    h.update(headers)
    return await api.post("/api/mcp", json=body, headers=h)


# ============================================
# Découverte et activation
# ============================================

DISCOVERY = ["/.well-known/oauth-protected-resource", "/.well-known/oauth-protected-resource/api/mcp",
             "/.well-known/oauth-authorization-server"]


@pytest.mark.parametrize("path", DISCOVERY + ["/api/oauth/authorize", "/api/oauth/grants"])
async def test_everything_is_absent_when_mcp_disabled(api, monkeypatch, path):
    monkeypatch.setattr(settings, "MCP_ENABLED", False)
    r = await api.get(path, headers=api.headers_for("a"))
    assert r.status_code == 404 and r.json() == {"detail": "Not Found"}
    assert (await api.post("/api/oauth/token", data={"grant_type": "x"})).status_code == 404


@pytest.mark.parametrize("path", DISCOVERY + ["/api/oauth/authorize"])
async def test_blocked_in_vercel_production(api, monkeypatch, path):
    monkeypatch.setenv("VERCEL_ENV", "production")
    assert (await api.get(path)).status_code == 404
    assert (await mcp(api, LIST)).status_code == 404


@pytest.mark.parametrize("method, path", [
    ("GET", "/api/oauth/requests/x"), ("POST", "/api/oauth/consent"), ("GET", "/api/oauth/grants"),
    ("DELETE", "/api/oauth/grants/x"), ("GET", "/api/oauth/continue?ticket=x"), ("POST", "/api/oauth/revoke"),
])
@pytest.mark.parametrize("vercel_env, enabled", [("production", True), (None, False)])
async def test_inactive_service_hides_session_routes(api, monkeypatch, method, path, vercel_env, enabled):
    """Inactif ou en production : 404 pour tous, même sans session (aucun 401 révélateur)."""
    monkeypatch.setattr(settings, "MCP_ENABLED", enabled)
    if vercel_env:
        monkeypatch.setenv("VERCEL_ENV", vercel_env)
    r = await api.request(method, path, json={} if method == "POST" else None)
    assert r.status_code == 404 and r.json() == {"detail": "Not Found"}


async def test_protected_resource_metadata(api):
    for path in DISCOVERY[:2]:
        r = await api.get(path)
        assert r.status_code == 200
        assert r.json() == {"resource": RESOURCE, "authorization_servers": [ISSUER],
                            "scopes_supported": ["watch:read", "opportunities:write"],
                            "bearer_methods_supported": ["header"], "resource_name": "JobTracker"}


async def test_authorization_server_metadata(api):
    m = (await api.get(DISCOVERY[2])).json()
    assert m["issuer"] == ISSUER
    assert m["authorization_endpoint"] == ISSUER + "/api/oauth/authorize"
    assert m["token_endpoint"] == ISSUER + "/api/oauth/token"
    assert m["revocation_endpoint"] == ISSUER + "/api/oauth/revoke"
    assert m["code_challenge_methods_supported"] == ["S256"]
    assert m["response_types_supported"] == ["code"]
    assert m["authorization_response_iss_parameter_supported"] is True
    assert "none" not in m["token_endpoint_auth_methods_supported"]


async def test_openid_configuration_is_not_served(api):
    r = await api.get("/.well-known/openid-configuration")
    assert r.status_code == 404 and r.headers["content-type"] == "application/json"


async def test_kill_switch_cuts_everything_immediately(api, db):
    client, tokens = await full_flow(api, db)
    assert (await mcp(api, LIST, tokens["access_token"])).status_code == 200
    await svc.set_kill_switch(db, True, "admin")
    assert (await mcp(api, LIST, tokens["access_token"])).status_code == 503
    assert (await api.get("/api/oauth/authorize")).status_code == 503
    assert (await api.post("/api/oauth/token", data={})).status_code == 503
    for path in DISCOVERY:
        assert (await api.get(path)).status_code == 404
    await svc.set_kill_switch(db, False, "admin")
    assert (await mcp(api, LIST, tokens["access_token"])).status_code == 200


async def test_admin_kill_switch_route(api, db):
    admin_id = "admin-" + secrets.token_hex(3)
    await db.users.insert_one({"id": admin_id, "email": "admin@test.local", "is_active": True, "role": "admin"})
    from utils.auth import create_access_token
    h = {"Authorization": f"Bearer {create_access_token({'sub': admin_id})}"}
    r = await api.put("/api/admin/settings/mcp-kill-switch", json={"active": True}, headers=h)
    assert r.status_code == 200 and await svc.kill_switch_active(db) is True
    assert (await api.get("/api/admin/settings/mcp-kill-switch", headers=h)).json() == {"active": True}
    assert (await api.put("/api/admin/settings/mcp-kill-switch", json={"active": "yes"}, headers=h)).status_code == 422
    assert (await api.put("/api/admin/settings/mcp-kill-switch", json={"active": False},
                          headers=api.headers_for("a"))).status_code == 403


# ============================================
# /authorize
# ============================================

async def test_authorize_redirects_to_consent_page(api, db):
    client = await new_client(db)
    _, challenge = pkce()
    r = await api.get("/api/oauth/authorize", params=authorize_params(client, challenge))
    assert r.status_code == 302
    loc = r.headers["location"]
    assert loc.startswith(ISSUER + "/oauth/consent?request=")
    req = await db[svc.REQUESTS].find_one({"id": qs(loc)["request"]})
    assert req["scopes"] == ["watch:read", "opportunities:write"] and req["resource"] == RESOURCE


@pytest.mark.parametrize("over", [
    {"client_id": "jt_oc_inconnu"}, {"client_id": None},
    {"redirect_uri": "https://evil.example/cb"}, {"redirect_uri": REDIRECT + "/"},
    {"redirect_uri": REDIRECT + "?x=1"}, {"redirect_uri": None},
])
async def test_invalid_client_or_redirect_never_redirects(api, db, over):
    client = await new_client(db)
    _, challenge = pkce()
    r = await api.get("/api/oauth/authorize", params=authorize_params(client, challenge, **over))
    assert r.status_code in (400, 401) and "location" not in r.headers
    assert r.json()["error"] in ("invalid_client", "invalid_request")


@pytest.mark.parametrize("over, error", [
    ({"code_challenge_method": "plain"}, "invalid_request"),
    ({"code_challenge_method": None}, "invalid_request"),
    ({"code_challenge": "court"}, "invalid_request"),
    ({"code_challenge": None}, "invalid_request"),
    ({"resource": None}, "invalid_target"),
    ({"resource": "https://autre.example/api/mcp"}, "invalid_target"),
    ({"resource": ISSUER + "/api/mcp/"}, "invalid_target"),
    ({"scope": "admin"}, "invalid_scope"),
    ({"response_type": "token"}, "unsupported_response_type"),
])
async def test_authorize_errors_are_redirected_with_state_and_iss(api, db, over, error):
    client = await new_client(db)
    _, challenge = pkce()
    r = await api.get("/api/oauth/authorize", params=authorize_params(client, challenge, **over))
    assert r.status_code == 302
    loc = r.headers["location"]
    assert loc.startswith(REDIRECT)
    q = qs(loc)
    assert q["error"] == error and q["state"] == "etat-123" and q["iss"] == ISSUER
    assert await db[svc.REQUESTS].count_documents({}) == 0


async def test_scope_subset_and_default(api, db):
    client = await new_client(db)
    _, challenge = pkce()
    r = await api.get("/api/oauth/authorize", params=authorize_params(client, challenge, scope="watch:read"))
    assert (await db[svc.REQUESTS].find_one({"id": qs(r.headers["location"])["request"]}))["scopes"] == ["watch:read"]
    r = await api.get("/api/oauth/authorize", params=authorize_params(client, challenge, scope=None))
    assert (await db[svc.REQUESTS].find_one({"id": qs(r.headers["location"])["request"]}))["scopes"] == list(svc.SUPPORTED_SCOPES)


async def test_authorize_rate_limit(api, db, monkeypatch):
    client = await new_client(db)
    _, challenge = pkce()
    statuses = [(await api.get("/api/oauth/authorize", params=authorize_params(client, challenge))).status_code
                for _ in range(12)]
    assert statuses[:10] == [302] * 10 and statuses[10:] == [429, 429]


# ============================================
# Consentement
# ============================================

async def start(api, db, **over):
    client = await new_client(db)
    verifier, challenge = pkce()
    r = await api.get("/api/oauth/authorize", params=authorize_params(client, challenge, **over))
    return client, verifier, qs(r.headers["location"])["request"]


async def test_consent_details(api, db):
    await enable_watch(db, api)
    _, _, request_id = await start(api, db)
    r = await api.get(f"/api/oauth/requests/{request_id}", headers=api.headers_for("a"))
    assert r.status_code == 200 and r.headers["cache-control"] == "no-store"
    body = r.json()
    assert body["client"] == {"name": "ChatGPT", "redirect_domain": "chatgpt.com"} and body["eligible"] is True
    assert [s["scope"] for s in body["scopes"]] == ["watch:read", "opportunities:write"]
    assert all(s["description"] for s in body["scopes"])


async def test_consent_requires_webapp_session(api, db):
    _, _, request_id = await start(api, db)
    assert (await api.get(f"/api/oauth/requests/{request_id}")).status_code in (401, 403)
    r = await api.post("/api/oauth/consent", json={"request_id": request_id, "approve": True},
                       headers=api.headers_for("a", source="extension"))
    assert r.status_code == 403


async def test_approve_returns_code_once_and_never_to_the_frontend(api, db):
    await enable_watch(db, api)
    _, _, request_id = await start(api, db)
    r = await decide(api, request_id, True)
    body = r.json()
    assert set(body) == {"continue_url"}  # aucun code, aucun jeton dans la réponse JSON
    assert await db[svc.CODES].count_documents({}) == 0  # le code n'existe pas encore
    final = await follow(api, body["continue_url"])
    location = final.headers["location"]
    q = qs(location)
    assert location.startswith(REDIRECT)
    assert q["code"] and q["state"] == "etat-123" and q["iss"] == ISSUER
    stored = await db[svc.CODES].find_one({})
    assert stored["code_hash"] == svc.hash_secret(q["code"]) and q["code"] not in str(stored)
    again = await decide(api, request_id, True)
    assert again.status_code == 400 and again.json()["error"] == "request_already_used"
    assert await db[svc.CODES].count_documents({}) == 1


async def test_continue_ticket_is_single_use(api, db):
    await enable_watch(db, api)
    _, _, request_id = await start(api, db)
    continue_url = (await decide(api, request_id, True)).json()["continue_url"]
    assert (await follow(api, continue_url)).status_code == 302
    replay = await follow(api, continue_url)
    assert replay.status_code == 400 and "location" not in replay.headers
    assert await db[svc.CODES].count_documents({}) == 1


async def test_continue_ticket_expires(api, db):
    await enable_watch(db, api)
    _, _, request_id = await start(api, db)
    continue_url = (await decide(api, request_id, True)).json()["continue_url"]
    await db[svc.REQUESTS].update_one({"id": request_id},
                                      {"$set": {"ticket_expires_at": datetime.now(timezone.utc) - timedelta(seconds=1)}})
    r = await follow(api, continue_url)
    assert r.status_code == 400 and "location" not in r.headers
    assert await db[svc.CODES].count_documents({}) == 0


@pytest.mark.parametrize("ticket", ["inconnu", "", "x" * 300])
async def test_invalid_ticket_never_redirects(api, db, ticket):
    r = await api.get("/api/oauth/continue", params={"ticket": ticket})
    assert r.status_code == 400 and "location" not in r.headers


async def test_deny(api, db):
    await enable_watch(db, api)
    _, _, request_id = await start(api, db)
    q = qs(await consent_redirect(api, request_id, False))
    assert q["error"] == "access_denied" and "code" not in q and q["iss"] == ISSUER and q["state"] == "etat-123"
    assert await db[svc.CODES].count_documents({}) == 0


async def test_non_owner_account_is_denied(api, db):
    """MVP propriétaire : un compte sans watch_enabled ne peut pas autoriser."""
    _, _, request_id = await start(api, db)
    details = await api.get(f"/api/oauth/requests/{request_id}", headers=api.headers_for("b"))
    assert details.json()["eligible"] is False
    assert qs(await consent_redirect(api, request_id, True, "b"))["error"] == "access_denied"
    assert await db[svc.CODES].count_documents({}) == 0


async def test_owner_disabled_between_consent_and_continue(api, db):
    await enable_watch(db, api)
    _, _, request_id = await start(api, db)
    continue_url = (await decide(api, request_id, True)).json()["continue_url"]
    await enable_watch(db, api, enabled=False)
    assert qs((await follow(api, continue_url)).headers["location"])["error"] == "access_denied"
    assert await db[svc.CODES].count_documents({}) == 0


async def test_expired_request(api, db):
    await enable_watch(db, api)
    _, _, request_id = await start(api, db)
    await db[svc.REQUESTS].update_one({"id": request_id}, {"$set": {"expires_at": datetime.now(timezone.utc) - timedelta(seconds=1)}})
    r = await api.get(f"/api/oauth/requests/{request_id}", headers=api.headers_for("a"))
    assert r.status_code == 410 and r.json() == {"error": "request_expired"}
    r = await decide(api, request_id, True)
    assert r.status_code == 400 and r.json()["error"] == "request_expired"


async def test_used_and_unknown_requests(api, db):
    await enable_watch(db, api)
    _, _, request_id = await start(api, db)
    await decide(api, request_id, False)
    r = await api.get(f"/api/oauth/requests/{request_id}", headers=api.headers_for("a"))
    assert r.status_code == 409 and r.json() == {"error": "request_already_used"}
    r = await api.get("/api/oauth/requests/inconnue", headers=api.headers_for("a"))
    assert r.status_code == 404 and r.json() == {"error": "request_not_found"}
    assert (await decide(api, "inconnue", True)).json()["error"] == "request_not_found"


async def test_concurrent_decisions_only_one_wins(api, db):
    import asyncio
    await enable_watch(db, api)
    _, _, request_id = await start(api, db)
    results = await asyncio.gather(*[decide(api, request_id, True) for _ in range(5)])
    assert sorted(r.status_code for r in results) == [200, 400, 400, 400, 400]


@pytest.mark.parametrize("call", ["details", "consent", "authorize", "continue_error"])
async def test_oauth_responses_forbid_framing(api, db, call):
    await enable_watch(db, api)
    client, _, request_id = await start(api, db)
    if call == "details":
        r = await api.get(f"/api/oauth/requests/{request_id}", headers=api.headers_for("a"))
    elif call == "consent":
        r = await decide(api, request_id, True)
    elif call == "authorize":
        _, challenge = pkce()
        r = await api.get("/api/oauth/authorize", params=authorize_params(client, challenge))
    else:
        r = await api.get("/api/oauth/continue", params={"ticket": "inconnu"})
    assert r.headers["x-frame-options"] == "DENY"
    assert r.headers["content-security-policy"] == "frame-ancestors 'none'"
    assert r.headers["cache-control"] == "no-store"


@pytest.mark.parametrize("body", [{"request_id": "x", "approve": "yes"}, {"request_id": "x"},
                                  {"request_id": "x", "approve": True, "user_id": "victim"}])
async def test_consent_body_validation(api, db, body):
    assert (await api.post("/api/oauth/consent", json=body, headers=api.headers_for("a"))).status_code == 422


# ============================================
# /token : code d'autorisation
# ============================================

async def test_code_exchange(api, db):
    client, tokens = await full_flow(api, db)
    assert tokens["access_token"].startswith("jt_oat_") and tokens["refresh_token"].startswith("jt_ort_")
    assert tokens["token_type"] == "Bearer" and tokens["expires_in"] == 3600
    assert tokens["scope"] == "watch:read opportunities:write"
    dump = str([d async for d in db[svc.TOKENS].find({})])
    assert tokens["access_token"] not in dump and tokens["refresh_token"] not in dump
    assert client["client_secret"] not in str(await db[svc.CLIENTS].find_one({}))
    grant = await db[svc.GRANTS].find_one({})
    assert grant["status"] == "active" and grant["user_id"] == api.users["a"] and grant["resource"] == RESOURCE


async def test_token_response_is_not_cacheable_and_basic_auth_works(api, db):
    await enable_watch(db, api)
    client = await new_client(db)
    code, verifier = await get_code(api, db, client)
    r = await token_call(api, client, {"grant_type": "authorization_code", "code": code,
                                       "code_verifier": verifier, "redirect_uri": REDIRECT}, basic=True)
    assert r.status_code == 200 and r.headers["cache-control"] == "no-store" and r.headers["pragma"] == "no-cache"


@pytest.mark.parametrize("secret", ["mauvais", "", None])
async def test_bad_client_secret(api, db, secret):
    await enable_watch(db, api)
    client = await new_client(db)
    code, verifier = await get_code(api, db, client)
    form = {"grant_type": "authorization_code", "code": code, "code_verifier": verifier, "redirect_uri": REDIRECT,
            "client_id": client["client_id"]}
    if secret is not None:
        form["client_secret"] = secret
    r = await api.post("/api/oauth/token", data=form)
    assert r.status_code == 401 and r.json()["error"] == "invalid_client"
    assert r.headers["www-authenticate"].startswith("Basic")


@pytest.mark.parametrize("change, error", [
    ({"code_verifier": None}, "invalid_request"),
    ({"code_verifier": "x" * 43}, "invalid_grant"),
    ({"redirect_uri": "https://evil.example/cb"}, "invalid_grant"),
    ({"resource": "https://autre.example/api/mcp"}, "invalid_target"),
    ({"code": "inconnu"}, "invalid_grant"),
    ({"grant_type": "password"}, "unsupported_grant_type"),
])
async def test_code_exchange_rejections(api, db, change, error):
    await enable_watch(db, api)
    client = await new_client(db)
    code, verifier = await get_code(api, db, client)
    form = {"grant_type": "authorization_code", "code": code, "code_verifier": verifier, "redirect_uri": REDIRECT}
    form.update({k: v for k, v in change.items() if v is not None})
    for k, v in change.items():
        if v is None:
            form.pop(k)
    r = await token_call(api, client, form)
    assert r.status_code == 400 and r.json()["error"] == error
    assert await db[svc.GRANTS].count_documents({}) == 0


async def test_expired_code(api, db):
    await enable_watch(db, api)
    client = await new_client(db)
    code, verifier = await get_code(api, db, client)
    await db[svc.CODES].update_one({}, {"$set": {"expires_at": datetime.now(timezone.utc) - timedelta(seconds=1)}})
    r = await token_call(api, client, {"grant_type": "authorization_code", "code": code,
                                       "code_verifier": verifier, "redirect_uri": REDIRECT})
    assert r.json()["error"] == "invalid_grant"


async def test_code_reuse_revokes_issued_tokens(api, db):
    await enable_watch(db, api)
    client = await new_client(db)
    code, verifier = await get_code(api, db, client)
    form = {"grant_type": "authorization_code", "code": code, "code_verifier": verifier, "redirect_uri": REDIRECT}
    first = (await token_call(api, client, form)).json()
    assert (await mcp(api, LIST, first["access_token"])).status_code == 200
    second = await token_call(api, client, form)
    assert second.status_code == 400 and second.json()["error"] == "invalid_grant"
    assert (await mcp(api, LIST, first["access_token"])).status_code == 401
    assert (await db[svc.GRANTS].find_one({}))["status"] == "compromised"


async def test_code_bound_to_its_client(api, db):
    await enable_watch(db, api)
    client_a = await new_client(db)
    client_b = await new_client(db)
    code, verifier = await get_code(api, db, client_a)
    r = await token_call(api, client_b, {"grant_type": "authorization_code", "code": code,
                                         "code_verifier": verifier, "redirect_uri": REDIRECT})
    assert r.json()["error"] == "invalid_grant"


async def test_owner_disabled_between_consent_and_exchange(api, db):
    await enable_watch(db, api)
    client = await new_client(db)
    code, verifier = await get_code(api, db, client)
    await enable_watch(db, api, enabled=False)
    r = await token_call(api, client, {"grant_type": "authorization_code", "code": code,
                                       "code_verifier": verifier, "redirect_uri": REDIRECT})
    assert r.json()["error"] == "invalid_grant"


async def test_new_consent_supersedes_previous_grant(api, db):
    client, first = await full_flow(api, db)
    code, verifier = await get_code(api, db, client)
    second = (await token_call(api, client, {"grant_type": "authorization_code", "code": code,
                                             "code_verifier": verifier, "redirect_uri": REDIRECT})).json()
    assert (await mcp(api, LIST, first["access_token"])).status_code == 401
    assert (await mcp(api, LIST, second["access_token"])).status_code == 200
    statuses = sorted([g["status"] async for g in db[svc.GRANTS].find({})])
    assert statuses == ["active", "superseded"]


# ============================================
# /token : refresh et rotation
# ============================================

async def do_refresh(api, client, refresh_token, **extra):
    return await token_call(api, client, {"grant_type": "refresh_token", "refresh_token": refresh_token, **extra})


async def test_refresh_rotates(api, db):
    client, tokens = await full_flow(api, db)
    r = await do_refresh(api, client, tokens["refresh_token"])
    new = r.json()
    assert r.status_code == 200 and new["refresh_token"] != tokens["refresh_token"]
    assert (await mcp(api, LIST, new["access_token"])).status_code == 200
    old = await db[svc.TOKENS].find_one({"token_hash": svc.hash_secret(tokens["refresh_token"])})
    assert old["status"] == "consumed" and old["replaced_by"] == svc.hash_secret(new["refresh_token"])


async def test_refresh_reuse_within_grace_reissues_and_cancels_lost_pair(api, db):
    client, tokens = await full_flow(api, db)
    lost = (await do_refresh(api, client, tokens["refresh_token"])).json()
    retry = await do_refresh(api, client, tokens["refresh_token"])
    assert retry.status_code == 200
    assert (await mcp(api, LIST, lost["access_token"])).status_code == 401  # paire perdue annulée
    assert (await mcp(api, LIST, retry.json()["access_token"])).status_code == 200
    assert (await db[svc.GRANTS].find_one({}))["status"] == "active"


async def test_refresh_reuse_after_grace_compromises_family(api, db):
    client, tokens = await full_flow(api, db)
    new = (await do_refresh(api, client, tokens["refresh_token"])).json()
    await db[svc.TOKENS].update_one({"token_hash": svc.hash_secret(tokens["refresh_token"])},
                                    {"$set": {"consumed_at": datetime.now(timezone.utc) - timedelta(minutes=5)}})
    r = await do_refresh(api, client, tokens["refresh_token"])
    assert r.status_code == 400 and r.json()["error"] == "invalid_grant"
    assert (await db[svc.GRANTS].find_one({}))["status"] == "compromised"
    assert (await mcp(api, LIST, new["access_token"])).status_code == 401
    assert (await do_refresh(api, client, new["refresh_token"])).json()["error"] == "invalid_grant"


async def test_expired_refresh_requires_reconnection(api, db):
    client, tokens = await full_flow(api, db)
    await db[svc.TOKENS].update_one({"token_hash": svc.hash_secret(tokens["refresh_token"])},
                                    {"$set": {"expires_at": datetime.now(timezone.utc) - timedelta(seconds=1)}})
    r = await do_refresh(api, client, tokens["refresh_token"])
    assert r.json()["error"] == "invalid_grant"
    assert (await db[svc.GRANTS].find_one({}))["status"] == "reconnection_required"


async def test_absolute_grant_expiry(api, db):
    client, tokens = await full_flow(api, db)
    await db[svc.GRANTS].update_one({}, {"$set": {"absolute_expires_at": datetime.now(timezone.utc) - timedelta(seconds=1)}})
    assert (await do_refresh(api, client, tokens["refresh_token"])).json()["error"] == "invalid_grant"
    assert (await db[svc.GRANTS].find_one({}))["status"] == "reconnection_required"


async def test_refresh_cannot_escalate_scope(api, db):
    client, tokens = await full_flow(api, db, scope="watch:read")
    r = await do_refresh(api, client, tokens["refresh_token"], scope="watch:read opportunities:write")
    assert r.json()["error"] == "invalid_scope"


async def test_refresh_by_other_client_is_refused(api, db):
    _, tokens = await full_flow(api, db)
    other = await new_client(db)
    assert (await do_refresh(api, other, tokens["refresh_token"])).json()["error"] == "invalid_grant"


async def test_refresh_after_owner_disabled_revokes(api, db):
    client, tokens = await full_flow(api, db)
    await enable_watch(db, api, enabled=False)
    assert (await do_refresh(api, client, tokens["refresh_token"])).json()["error"] == "invalid_grant"
    assert (await db[svc.GRANTS].find_one({}))["status"] == "revoked"


# ============================================
# Révocation
# ============================================

@pytest.mark.parametrize("which", ["access_token", "refresh_token"])
async def test_client_revocation(api, db, which):
    client, tokens = await full_flow(api, db)
    r = await api.post("/api/oauth/revoke", data={"token": tokens[which], "client_id": client["client_id"],
                                                  "client_secret": client["client_secret"]})
    assert r.status_code == 200
    assert (await mcp(api, LIST, tokens["access_token"])).status_code == 401
    assert (await do_refresh(api, client, tokens["refresh_token"])).json()["error"] == "invalid_grant"


async def test_revocation_unknown_token_and_bad_client(api, db):
    client, tokens = await full_flow(api, db)
    ok = await api.post("/api/oauth/revoke", data={"token": "jt_ort_inconnu", "client_id": client["client_id"],
                                                   "client_secret": client["client_secret"]})
    assert ok.status_code == 200
    bad = await api.post("/api/oauth/revoke", data={"token": tokens["access_token"], "client_id": client["client_id"],
                                                    "client_secret": "faux"})
    assert bad.status_code == 401
    other = await new_client(db)
    await api.post("/api/oauth/revoke", data={"token": tokens["access_token"], "client_id": other["client_id"],
                                              "client_secret": other["client_secret"]})
    assert (await mcp(api, LIST, tokens["access_token"])).status_code == 200  # jeton d'un autre client : sans effet


async def test_user_connections(api, db):
    _, tokens = await full_flow(api, db)
    items = (await api.get("/api/oauth/grants", headers=api.headers_for("a"))).json()["items"]
    assert len(items) == 1 and items[0]["client_name"] == "ChatGPT" and items[0]["status"] == "active"
    assert "jt_o" not in str(items)
    assert (await api.get("/api/oauth/grants", headers=api.headers_for("b"))).json() == {"items": []}
    grant_id = items[0]["id"]
    assert (await api.delete(f"/api/oauth/grants/{grant_id}", headers=api.headers_for("b"))).status_code == 404
    assert (await mcp(api, LIST, tokens["access_token"])).status_code == 200
    assert (await api.delete(f"/api/oauth/grants/{grant_id}", headers=api.headers_for("a"))).status_code == 200
    assert (await mcp(api, LIST, tokens["access_token"])).status_code == 401


async def test_deactivated_client_loses_access(api, db):
    client, tokens = await full_flow(api, db)
    assert await svc.deactivate_client(db, client["client_id"]) == 1
    assert (await mcp(api, LIST, tokens["access_token"])).status_code == 401
    assert (await do_refresh(api, client, tokens["refresh_token"])).status_code == 401


# ============================================
# /api/mcp protégé par OAuth
# ============================================

async def test_mcp_without_token_challenges_with_resource_metadata(api, db):
    r = await mcp(api, LIST)
    assert r.status_code == 401
    challenge = r.headers["www-authenticate"]
    assert challenge.startswith("Bearer ")
    assert f'resource_metadata="{ISSUER}/.well-known/oauth-protected-resource/api/mcp"' in challenge
    assert 'scope="watch:read opportunities:write"' in challenge and "error=" not in challenge


@pytest.mark.parametrize("token", ["jt_oat_faux", "n'importe quoi", "jt_agent_" + "a" * 43])
async def test_mcp_rejects_invalid_or_foreign_tokens(api, db, token):
    r = await mcp(api, LIST, token)
    assert r.status_code == 401 and 'error="invalid_token"' in r.headers["www-authenticate"]


async def test_mcp_works_with_valid_token(api, db):
    _, tokens = await full_flow(api, db)
    assert (await mcp(api, LIST, tokens["access_token"])).json()["result"]["tools"][0]["name"] == "jobtracker_ping"
    result = (await mcp(api, PING, tokens["access_token"])).json()["result"]
    assert result["structuredContent"] == {"service": "jobtracker", "transport": "ok", "authenticated": True}


async def test_oauth_token_refused_on_agent_api(api, db):
    _, tokens = await full_flow(api, db)
    r = await api.post("/api/agent/opportunities", json={"title": "T", "company": "C", "url": "https://c.com/j/1"},
                       headers={"Authorization": f"Bearer {tokens['access_token']}"})
    assert r.status_code == 401


async def test_expired_access_token_is_observed_then_refresh_restores(api, db):
    client, tokens = await full_flow(api, db)
    await db[svc.TOKENS].update_one({"token_hash": svc.hash_secret(tokens["access_token"])},
                                    {"$set": {"expires_at": datetime.now(timezone.utc) - timedelta(seconds=1)}})
    r = await mcp(api, LIST, tokens["access_token"])
    assert r.status_code == 401 and 'error="invalid_token"' in r.headers["www-authenticate"]
    assert (await db[svc.GRANTS].find_one({}))["status"] == "access_expired_observed"
    new = (await do_refresh(api, client, tokens["refresh_token"])).json()
    assert (await db[svc.GRANTS].find_one({}))["status"] == "active"
    assert (await mcp(api, LIST, new["access_token"])).status_code == 200


async def test_refresh_not_observed_alert(api, db):
    await full_flow(api, db)
    await db[svc.GRANTS].update_one({}, {"$set": {"status": "access_expired_observed",
                                                  "first_expired_seen_at": datetime.now(timezone.utc) - timedelta(minutes=20)}})
    items = (await api.get("/api/oauth/grants", headers=api.headers_for("a"))).json()["items"]
    assert items[0]["alert"] == "refresh_not_observed"


async def test_insufficient_scope(api, db):
    _, tokens = await full_flow(api, db, scope="opportunities:write")
    assert (await mcp(api, LIST, tokens["access_token"])).status_code == 200
    r = await mcp(api, PING, tokens["access_token"])
    assert r.status_code == 403 and r.json() == {"error": "insufficient_scope", "scope": "watch:read"}
    assert 'error="insufficient_scope"' in r.headers["www-authenticate"]
    assert 'scope="watch:read"' in r.headers["www-authenticate"]


async def test_owner_disabled_after_issuance_loses_mcp(api, db):
    _, tokens = await full_flow(api, db)
    await enable_watch(db, api, enabled=False)
    assert (await mcp(api, LIST, tokens["access_token"])).status_code == 401
    await db.users.update_one({"id": api.users["a"]}, {"$set": {"watch_enabled": True, "is_active": False}})
    assert (await mcp(api, LIST, tokens["access_token"])).status_code == 401


async def test_audience_is_bound_to_the_resource(api, db, monkeypatch):
    _, tokens = await full_flow(api, db)
    monkeypatch.setattr(settings, "OAUTH_ISSUER", "https://autre.example")
    assert (await mcp(api, LIST, tokens["access_token"])).status_code == 401


async def test_user_id_comes_from_grant_only(api, db):
    """Le principal posé pour les outils provient du grant, jamais de la requête."""
    _, tokens = await full_flow(api, db)
    principal, reason = await svc.validate_access_token(db, tokens["access_token"])
    assert reason is None and principal.user_id == api.users["a"]
    assert principal.scopes == ("watch:read", "opportunities:write")


async def test_sdk_not_loaded_before_authentication(api, db):
    """Un appel non authentifié est refusé avant tout chargement du serveur MCP."""
    await mcp(api, LIST)
    assert mcp_transport.build_count == 0


async def test_logs_contain_no_secrets(api, db, caplog):
    import logging
    with caplog.at_level(logging.INFO):
        client, tokens = await full_flow(api, db)
        await do_refresh(api, client, tokens["refresh_token"])
        await mcp(api, LIST, "jt_oat_faux")
    text = caplog.text
    for secret in (tokens["access_token"], tokens["refresh_token"], client["client_secret"]):
        assert secret not in text


# ============================================
# Clients
# ============================================

@pytest.mark.parametrize("uri", ["http://chatgpt.com/cb", "https://chatgpt.com/cb#frag", "https://*.chatgpt.com/cb", ""])
async def test_client_redirect_uri_validation(db, uri):
    with pytest.raises(ValueError):
        await svc.create_client(db, "X", [uri])


async def test_rotate_secret(api, db):
    await enable_watch(db, api)
    client = await new_client(db)
    new_secret = await svc.rotate_client_secret(db, client["client_id"])
    code, verifier = await get_code(api, db, client)
    form = {"grant_type": "authorization_code", "code": code, "code_verifier": verifier, "redirect_uri": REDIRECT}
    assert (await token_call(api, client, form)).status_code == 401  # ancien secret refusé
    assert (await token_call(api, {**client, "client_secret": new_secret}, form)).status_code == 200
