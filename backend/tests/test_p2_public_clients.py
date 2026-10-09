"""
P2 — Clients publics (PKCE), redirections locales (loopback), scopes par client,
isolation des exécutions par client, administration enrichie.
MongoDB éphémère, application FastAPI réelle (ASGI en mémoire). Aucun réseau, aucune donnée réelle.
"""

import base64
import json
import secrets
from datetime import datetime
from zoneinfo import ZoneInfo

import pytest

from config import settings
from models.watch import WatchPreferencesUpdate
from services import oauth_service as svc, watch_preferences_service
from utils import mcp_transport
from utils.auth import create_access_token
from test_oauth import HOST, ISSUER, LIST, RESOURCE, authorize_params, consent_redirect, enable_watch, mcp, pkce, qs

pytestmark = pytest.mark.anyio

LOOPBACK = "http://127.0.0.1/callback"
LOOPBACK_V6 = "http://[::1]/oauth/cb"
WEB = "https://agent.maadec.com/oauth/callback"
BASE = "/api/admin/oauth"


@pytest.fixture(autouse=True)
async def service_on(monkeypatch, db):
    monkeypatch.setattr(settings, "MCP_ENABLED", True)
    monkeypatch.setattr(settings, "MCP_ALLOWED_HOSTS", HOST)
    monkeypatch.setattr(settings, "OAUTH_ISSUER", ISSUER)
    monkeypatch.delenv("VERCEL_ENV", raising=False)
    from routes.oauth import limiter
    limiter.reset()
    mcp_transport.reset_for_tests()
    await svc.set_kill_switch(db, False, "tests")
    yield
    limiter.reset()


@pytest.fixture
async def admin(api, db):
    admin_id = "admin-" + secrets.token_hex(3)
    await db.users.insert_one({"id": admin_id, "email": "admin@test.local", "is_active": True, "role": "admin"})
    return {"Authorization": f"Bearer {create_access_token({'sub': admin_id})}"}


async def public_client(db, uris=(LOOPBACK,), scopes=None, name="Agent local"):
    return await svc.create_client(db, name, list(uris), client_type="public", allowed_scopes=scopes)


async def authorize(api, client, redirect, **over):
    verifier, challenge = pkce()
    r = await api.get("/api/oauth/authorize", params=authorize_params(client, challenge, redirect_uri=redirect, **over))
    return r, verifier


async def get_code(api, client, redirect, who="a", **over):
    r, verifier = await authorize(api, client, redirect, **over)
    assert r.status_code == 302, r.text
    params = qs(await consent_redirect(api, qs(r.headers["location"])["request"], True, who))
    return params["code"], verifier


async def public_token(api, client_id, form, basic=False):
    if basic:
        cred = base64.b64encode(f"{client_id}:".encode()).decode()
        return await api.post("/api/oauth/token", data=form, headers={"Authorization": f"Basic {cred}"})
    return await api.post("/api/oauth/token", data={**form, "client_id": client_id})


def exchange_form(code, verifier, redirect):
    return {"grant_type": "authorization_code", "code": code, "code_verifier": verifier,
            "redirect_uri": redirect, "resource": RESOURCE}


async def connect_public(api, db, client, redirect="http://127.0.0.1:53682/callback", who="a"):
    code, verifier = await get_code(api, client, redirect, who)
    r = await public_token(api, client["client_id"], exchange_form(code, verifier, redirect))
    assert r.status_code == 200, r.text
    return r.json()


async def tool(api, access, name, arguments=None):
    r = await mcp(api, {"jsonrpc": "2.0", "id": 3, "method": "tools/call",
                        "params": {"name": name, "arguments": arguments or {}}}, access)
    return r


# ============================================
# P2.2 — Client public : flux complet sans secret
# ============================================

async def test_public_client_has_no_secret(db):
    created = await public_client(db)
    assert created["client_secret"] is None and created["client_type"] == "public"
    stored = await db.oauth_clients.find_one({"client_id": created["client_id"]})
    assert stored["secret_hash"] is None and stored["client_type"] == "public"


@pytest.mark.parametrize("redirect", ["http://127.0.0.1:53682/callback", "http://127.0.0.1/callback",
                                      "http://127.0.0.1:1/callback", "http://127.0.0.1:65535/callback"])
async def test_public_flow_with_dynamic_loopback_port(api, db, redirect):
    await enable_watch(db, api)
    client = await public_client(db)
    tokens = await connect_public(api, db, client, redirect)
    assert tokens["access_token"].startswith("jt_oat_") and tokens["refresh_token"].startswith("jt_ort_")
    assert (await mcp(api, LIST, tokens["access_token"])).status_code == 200


async def test_public_flow_with_ipv6_loopback_and_basic_without_secret(api, db):
    await enable_watch(db, api)
    client = await public_client(db, uris=(LOOPBACK_V6,))
    redirect = "http://[::1]:49152/oauth/cb"
    code, verifier = await get_code(api, client, redirect)
    r = await public_token(api, client["client_id"], exchange_form(code, verifier, redirect), basic=True)
    assert r.status_code == 200, r.text


async def test_consent_flags_local_redirect(api, db):
    await enable_watch(db, api)
    client = await public_client(db)
    r, _ = await authorize(api, client, "http://127.0.0.1:8123/callback")
    body = (await api.get(f"/api/oauth/requests/{qs(r.headers['location'])['request']}",
                          headers=api.headers_for("a"))).json()
    assert body["client"] == {"name": "Agent local", "redirect_domain": "127.0.0.1", "redirect_local": True}


@pytest.mark.parametrize("secret", ["jt_ocs_quelconque", "x"])
async def test_public_client_refuses_any_secret(api, db, secret):
    await enable_watch(db, api)
    client = await public_client(db)
    redirect = "http://127.0.0.1:5000/callback"
    code, verifier = await get_code(api, client, redirect)
    r = await api.post("/api/oauth/token", data={**exchange_form(code, verifier, redirect),
                                                 "client_id": client["client_id"], "client_secret": secret})
    assert r.status_code == 401 and r.json()["error"] == "invalid_client"


async def test_confidential_client_still_requires_its_secret(api, db):
    await enable_watch(db, api)
    conf = await svc.create_client(db, "ChatGPT", [svc.CHATGPT_DEFAULT_REDIRECT])
    code, verifier = await get_code(api, conf, svc.CHATGPT_DEFAULT_REDIRECT)
    form = exchange_form(code, verifier, svc.CHATGPT_DEFAULT_REDIRECT)
    r = await api.post("/api/oauth/token", data={**form, "client_id": conf["client_id"]})  # sans secret
    assert r.status_code == 401 and r.json()["error"] == "invalid_client"
    r = await api.post("/api/oauth/token", data={**form, "client_id": conf["client_id"], "client_secret": conf["client_secret"]})
    assert r.status_code == 200


# ============================================
# P2.2 — PKCE, rejeu, substitution, adresse de retour à l'échange
# ============================================

async def test_pkce_is_mandatory_and_strict(api, db):
    await enable_watch(db, api)
    client = await public_client(db)
    redirect = "http://127.0.0.1:5000/callback"
    for over in ({"code_challenge_method": "plain"}, {"code_challenge_method": None}, {"code_challenge": "court"}):
        r, _ = await authorize(api, client, redirect, **over)
        assert r.status_code == 302 and qs(r.headers["location"]).get("error") == "invalid_request"
    code, verifier = await get_code(api, client, redirect)
    wrong = pkce()[0]
    r = await public_token(api, client["client_id"], exchange_form(code, wrong, redirect))
    assert r.status_code == 400 and r.json()["error"] == "invalid_grant"
    code, verifier = await get_code(api, client, redirect)
    r = await public_token(api, client["client_id"], {**exchange_form(code, verifier, redirect), "code_verifier": ""})
    assert r.status_code == 400 and r.json()["error"] == "invalid_request"


async def test_code_replay_revokes_and_substitution_between_clients_fails(api, db):
    await enable_watch(db, api)
    a = await public_client(db, name="App A")
    b = await public_client(db, name="App B")
    redirect = "http://127.0.0.1:5000/callback"
    code, verifier = await get_code(api, a, redirect)
    # Substitution : le code de A présenté par B
    r = await public_token(api, b["client_id"], exchange_form(code, verifier, redirect))
    assert r.status_code == 400 and r.json()["error"] == "invalid_grant"
    # Le code a été consommé par la tentative : A ne peut plus l'utiliser
    r = await public_token(api, a["client_id"], exchange_form(code, verifier, redirect))
    assert r.status_code == 400
    # Rejeu d'un code déjà échangé : l'autorisation émise est révoquée
    code, verifier = await get_code(api, a, redirect)
    ok = await public_token(api, a["client_id"], exchange_form(code, verifier, redirect))
    assert ok.status_code == 200
    again = await public_token(api, a["client_id"], exchange_form(code, verifier, redirect))
    assert again.status_code == 400
    assert (await mcp(api, LIST, ok.json()["access_token"])).status_code == 401


async def test_redirect_must_be_identical_at_exchange(api, db):
    await enable_watch(db, api)
    client = await public_client(db)
    code, verifier = await get_code(api, client, "http://127.0.0.1:5000/callback")
    r = await public_token(api, client["client_id"], exchange_form(code, verifier, "http://127.0.0.1:5001/callback"))
    assert r.status_code == 400 and r.json()["error"] == "invalid_grant"


async def test_public_refresh_rotation_reuse_and_revocation(api, db):
    await enable_watch(db, api)
    client = await public_client(db)
    tokens = await connect_public(api, db, client)
    r = await public_token(api, client["client_id"], {"grant_type": "refresh_token", "refresh_token": tokens["refresh_token"]})
    assert r.status_code == 200
    rotated = r.json()
    assert rotated["refresh_token"] != tokens["refresh_token"]
    # Réutilisation de l'ancien refresh hors délai de grâce : famille révoquée
    await db.oauth_tokens.update_one({"token_hash": svc.hash_secret(tokens["refresh_token"])},
                                     {"$set": {"consumed_at": datetime(2020, 1, 1)}})
    reuse = await public_token(api, client["client_id"], {"grant_type": "refresh_token", "refresh_token": tokens["refresh_token"]})
    assert reuse.status_code == 400
    assert (await mcp(api, LIST, rotated["access_token"])).status_code == 401
    # Révocation par un client public (identifiant seul)
    fresh = await connect_public(api, db, client)
    r = await api.post("/api/oauth/revoke", data={"token": fresh["refresh_token"], "client_id": client["client_id"]})
    assert r.status_code == 200 and (await mcp(api, LIST, fresh["access_token"])).status_code == 401


# ============================================
# P2.3 — Redirections locales : détournements
# ============================================

@pytest.mark.parametrize("redirect", [
    "http://localhost:5000/callback", "http://127.0.0.2:5000/callback", "http://127.1:5000/callback",
    "http://0x7f.0.0.1:5000/callback", "http://[::ffff:127.0.0.1]:5000/callback", "http://127.0.0.1.evil.com/callback",
    "http://127.0.0.1:5000@evil.com/callback", "http://user@127.0.0.1:5000/callback", "https://127.0.0.1:5000/callback",
    "http://127.0.0.1:5000/callback/", "http://127.0.0.1:5000/Callback", "http://127.0.0.1:5000/callback?x=1",
    "http://127.0.0.1:5000/callback#f", "http://127.0.0.1:5000/%63allback", "http://127.0.0.1:5000/x/../callback",
    "http://127.0.0.1:0/callback", "http://127.0.0.1:65536/callback", "http://127.0.0.1:080/callback",
    "http://127.0.0.1:5000//callback", "http://127.0.0.1:5000/other", "http://evil.com/callback",
    "http://127.0.0.1:5000/callback ", "HTTP://127.0.0.1:5000/callback",
])
async def test_loopback_bypass_attempts_never_redirect(api, db, redirect):
    client = await public_client(db)
    r, _ = await authorize(api, client, redirect)
    assert r.status_code == 400 and "location" not in r.headers
    assert await db.oauth_requests.count_documents({}) == 0


@pytest.mark.parametrize("uri", [
    "http://127.0.0.1:8080/callback", "http://localhost/callback", "http://127.0.0.2/callback",
    "http://127.0.0.1/callback?x=1", "http://127.0.0.1/a%2Fb", "http://127.0.0.1/a/../b", "http://127.0.0.1",
    "http://[::ffff:127.0.0.1]/cb", "http://user@127.0.0.1/cb",
])
async def test_invalid_loopback_registrations(db, uri):
    with pytest.raises(ValueError):
        await public_client(db, uris=(uri,))


async def test_confidential_clients_never_get_loopback(api, db, admin):
    with pytest.raises(ValueError):
        await svc.create_client(db, "Conf", [LOOPBACK])
    conf = await svc.create_client(db, "Conf", [WEB])
    with pytest.raises(ValueError):
        await svc.add_redirect_uri(db, conf["client_id"], LOOPBACK)
    # Même si une telle adresse se retrouvait en base, elle ne serait pas utilisable
    await db.oauth_clients.update_one({"client_id": conf["client_id"]}, {"$push": {"redirect_uris": LOOPBACK}})
    r, _ = await authorize(api, conf, "http://127.0.0.1:5000/callback")
    assert r.status_code == 400 and "location" not in r.headers
    r = await api.post(f"{BASE}/clients", json={"name": "Conf2", "redirect_uris": [LOOPBACK]}, headers=admin)
    assert r.status_code == 400 and "réservée aux clients publics" in r.json()["detail"]


async def test_public_https_redirect_stays_exact(api, db):
    client = await public_client(db, uris=(WEB, LOOPBACK))
    assert (await authorize(api, client, WEB))[0].status_code == 302
    for variant in ("https://agent.maadec.com:8443/oauth/callback", "https://agent.maadec.com/oauth/callback/"):
        assert (await authorize(api, client, variant))[0].status_code == 400


# ============================================
# P2.1 — Scopes par client
# ============================================

async def test_client_scopes_bound_and_reduce_the_request(api, db):
    await enable_watch(db, api)
    reader = await public_client(db, scopes=["watch:read"], name="Lecteur")
    redirect = "http://127.0.0.1:5000/callback"
    tokens = await connect_public(api, db, reader, redirect)  # sans scope demandé -> scopes du client
    assert tokens["scope"] == "watch:read"
    assert (await tool(api, tokens["access_token"], "get_watch_status")).status_code == 200
    denied = await tool(api, tokens["access_token"], "create_opportunities", {"run_id": "x", "opportunities": []})
    assert denied.status_code == 403 and denied.json()["error"] == "insufficient_scope"
    # Demande des deux scopes : réduite au scope autorisé
    code, verifier = await get_code(api, reader, redirect, scope="watch:read opportunities:write")
    r = await public_token(api, reader["client_id"], exchange_form(code, verifier, redirect))
    assert r.json()["scope"] == "watch:read"
    # Demande d'un seul scope non autorisé : refus, redirigé avec l'erreur
    r, _ = await authorize(api, reader, redirect, scope="opportunities:write")
    assert r.status_code == 302 and qs(r.headers["location"])["error"] == "invalid_scope"
    r, _ = await authorize(api, reader, redirect, scope="admin")
    assert qs(r.headers["location"])["error"] == "invalid_scope"


async def test_scope_reduction_applies_immediately_and_expansion_needs_new_consent(api, db):
    await enable_watch(db, api)
    client = await public_client(db)
    tokens = await connect_public(api, db, client)
    write = {"run_id": "veille-20200101-0800-prog", "opportunities": []}
    assert (await tool(api, tokens["access_token"], "create_opportunities", write)).status_code == 200
    await svc.set_client_scopes(db, client["client_id"], ["watch:read"])
    # Effet immédiat sur le jeton déjà émis
    assert (await tool(api, tokens["access_token"], "create_opportunities", write)).status_code == 403
    assert (await tool(api, tokens["access_token"], "get_watch_status")).status_code == 200
    # Renouvellement : autorisation réduite
    r = await public_token(api, client["client_id"], {"grant_type": "refresh_token", "refresh_token": tokens["refresh_token"]})
    assert r.status_code == 200 and r.json()["scope"] == "watch:read"
    grant = await db.oauth_grants.find_one({"client_id": client["client_id"]})
    assert grant["scopes"] == ["watch:read"]
    # Élargissement : n'étend PAS l'autorisation existante
    await svc.set_client_scopes(db, client["client_id"], ["watch:read", "opportunities:write"])
    assert (await tool(api, r.json()["access_token"], "create_opportunities", write)).status_code == 403


async def test_removing_every_granted_scope_revokes_at_refresh(api, db):
    await enable_watch(db, api)
    client = await public_client(db, scopes=["watch:read"])
    tokens = await connect_public(api, db, client)
    await svc.set_client_scopes(db, client["client_id"], ["opportunities:write"])
    assert (await tool(api, tokens["access_token"], "get_watch_status")).status_code == 403
    r = await public_token(api, client["client_id"], {"grant_type": "refresh_token", "refresh_token": tokens["refresh_token"]})
    assert r.status_code == 400 and r.json()["error"] == "invalid_grant"
    assert (await db.oauth_grants.find_one({"client_id": client["client_id"]}))["status"] == "revoked"


async def test_pre_p2_clients_keep_all_scopes_and_confidential_type(api, db):
    """Clients existants (ChatGPT, Claude) : documents sans client_type ni allowed_scopes."""
    await enable_watch(db, api)
    legacy = await svc.create_client(db, "ChatGPT", [svc.CHATGPT_DEFAULT_REDIRECT])
    await db.oauth_clients.update_one({"client_id": legacy["client_id"]},
                                      {"$unset": {"client_type": "", "allowed_scopes": ""}})
    stored = await db.oauth_clients.find_one({"client_id": legacy["client_id"]})
    assert svc.client_type_of(stored) == "confidential" and svc.client_scopes(stored) == list(svc.SUPPORTED_SCOPES)
    code, verifier = await get_code(api, legacy, svc.CHATGPT_DEFAULT_REDIRECT)
    r = await api.post("/api/oauth/token", data={**exchange_form(code, verifier, svc.CHATGPT_DEFAULT_REDIRECT),
                                                 "client_id": legacy["client_id"], "client_secret": legacy["client_secret"]})
    assert r.status_code == 200 and r.json()["scope"] == "watch:read opportunities:write"
    assert (await db.oauth_clients.find_one({"client_id": legacy["client_id"]})).get("client_type") is None  # non modifié


# ============================================
# P2.1 — Isolation des exécutions par client
# ============================================

def prog_run_id():
    now = datetime.now(ZoneInfo("Europe/Paris"))
    return f"veille-{now:%Y%m%d}-{now:%H}00-prog"


def offer(n):
    return {"title": f"Data {n}", "company": "Orange", "url": f"https://careers.orange.com/jobs/p2-{n}",
            "country": "FR", "contract_type": "CDI", "relevance_score": 90, "relevance_reasons": ["CDI"]}


async def call_json(api, access, name, arguments):
    r = await tool(api, access, name, arguments)
    assert r.status_code == 200, r.text
    result = r.json()["result"]
    return result["isError"], json.loads(result["content"][0]["text"])


async def test_same_run_id_from_two_clients_is_two_isolated_runs(api, db, monkeypatch):
    await enable_watch(db, api)
    user = api.users["a"]
    prefs = await watch_preferences_service.get_or_create(db, user)
    fields = {k: v for k, v in prefs.model_dump().items() if k not in ("preferences_version", "updated_at")}
    await watch_preferences_service.update(db, user, WatchPreferencesUpdate(**{**fields, "max_per_run": 2, "expected_version": 1}))
    monkeypatch.setattr(settings, "WATCH_DAILY_CREATE_QUOTA", 3)
    a = await public_client(db, name="Agent A")
    b = await public_client(db, name="Agent B")
    ta, tb = await connect_public(api, db, a), await connect_public(api, db, b)
    rid = prog_run_id()
    # Plafond par exécution : chaque client a SON exécution (2 chacun)
    _, out_a = await call_json(api, ta["access_token"], "create_opportunities", {"run_id": rid, "opportunities": [offer(1), offer(2)]})
    assert [r["status"] for r in out_a["results"]] == ["created", "created"] and out_a["run_id"] == rid
    _, out_b = await call_json(api, tb["access_token"], "create_opportunities", {"run_id": rid, "opportunities": [offer(3), offer(4)]})
    # Quota journalier du compte (3) toujours commun
    assert [r["status"] for r in out_b["results"]] == ["created", "rejected"]
    assert out_b["results"][1]["reasons"] == ["daily_quota_reached"]
    # Rejeu : uniquement dans l'exécution du même client
    _, replay_a = await call_json(api, ta["access_token"], "create_opportunities", {"run_id": rid, "opportunities": [offer(1)]})
    assert replay_a["results"][0]["replayed"] is True
    _, cross = await call_json(api, tb["access_token"], "create_opportunities", {"run_id": rid, "opportunities": [offer(1)]})
    assert cross["results"][0]["replayed"] is False and cross["results"][0]["status"] == "duplicate"
    runs = await db.watch_runs.find({"public_run_id": rid}).to_list(10)
    assert len(runs) == 2 and {r["client_ids"][0] for r in runs} == {a["client_id"], b["client_id"]}
    assert all(r["run_id"] != rid and r["run_id"].startswith(rid + "#") for r in runs)
    # Rapports séparés ; le run_id renvoyé est toujours celui du client
    _, rep_a = await call_json(api, ta["access_token"], "report_watch_run", {"run_id": rid, "status": "completed"})
    _, rep_b = await call_json(api, tb["access_token"], "report_watch_run", {"run_id": rid, "status": "partial"})
    assert rep_a["run_id"] == rid and rep_a["observed"]["created"] == 2
    assert rep_b["observed"] == {"created": 1, "duplicate": 1, "rejected": 1, "error": 0}
    # Statut et historique : run_id d'origine, jamais la clé interne
    _, status = await call_json(api, tb["access_token"], "get_watch_status", {})
    assert status["last_run"]["run_id"] == rid
    listed = (await api.get("/api/watch/runs", headers=api.headers_for("a"))).json()["items"]
    assert {r["run_id"] for r in listed} == {rid} and "#" not in json.dumps(listed)


async def test_pre_p2_run_is_continued_by_its_own_client_only(api, db):
    await enable_watch(db, api)
    a = await public_client(db, name="Agent A")
    b = await public_client(db, name="Agent B")
    ta, tb = await connect_public(api, db, a), await connect_public(api, db, b)
    rid = prog_run_id()
    _, out = await call_json(api, ta["access_token"], "create_opportunities", {"run_id": rid, "opportunities": [offer(1)]})
    key = (await db.watch_runs.find_one({"public_run_id": rid}))["run_id"]
    # Format antérieur à P2 : clé = run_id brut
    await db.watch_runs.update_one({"run_id": key}, {"$set": {"run_id": rid}, "$unset": {"public_run_id": ""}})
    await db.watch_run_items.update_many({"run_id": key}, {"$set": {"run_id": rid}})
    _, again = await call_json(api, ta["access_token"], "create_opportunities", {"run_id": rid, "opportunities": [offer(1)]})
    assert again["results"][0]["replayed"] is True  # A poursuit SON exécution d'origine
    await call_json(api, tb["access_token"], "create_opportunities", {"run_id": rid, "opportunities": [offer(2)]})
    assert await db.watch_runs.count_documents({"run_id": rid}) == 1
    assert await db.watch_runs.count_documents({"run_id": f"{rid}#{b['client_id']}"}) == 1


async def test_users_stay_isolated_with_public_clients(api, db):
    await enable_watch(db, api, "a")
    await enable_watch(db, api, "b")
    client = await public_client(db)
    ta = await connect_public(api, db, client, who="a")
    tb = await connect_public(api, db, client, who="b")
    rid = prog_run_id()
    await call_json(api, ta["access_token"], "create_opportunities", {"run_id": rid, "opportunities": [offer(1)]})
    _, recent_b = await call_json(api, tb["access_token"], "list_recent_opportunities", {})
    assert recent_b["total"] == 0
    assert await db.oauth_grants.count_documents({"client_id": client["client_id"], "status": "active"}) == 2


# ============================================
# P2.4 — Administration
# ============================================

async def test_admin_creates_public_and_confidential_clients(api, db, admin):
    pub = await api.post(f"{BASE}/clients", headers=admin, json={
        "name": "Agent local", "client_type": "public", "redirect_uris": [LOOPBACK, LOOPBACK_V6], "allowed_scopes": ["watch:read"]})
    assert pub.status_code == 201, pub.text
    body = pub.json()
    assert body["client_secret"] is None and body["client_type"] == "public" and body["allowed_scopes"] == ["watch:read"]
    conf = await api.post(f"{BASE}/clients", headers=admin, json={"name": "Web", "redirect_uris": [WEB]})
    assert conf.json()["client_type"] == "confidential" and conf.json()["client_secret"].startswith("jt_ocs_")
    assert conf.json()["allowed_scopes"] == ["watch:read", "opportunities:write"]
    items = {c["name"]: c for c in (await api.get(f"{BASE}/clients", headers=admin)).json()["items"]}
    assert items["Agent local"]["token_endpoint_auth_method"] == "none"
    assert items["Web"]["token_endpoint_auth_method"] == "client_secret_basic"
    assert "jt_ocs_" not in json.dumps(items)


@pytest.mark.parametrize("payload", [
    {"name": "X", "client_type": "hybrid", "redirect_uris": [WEB]},
    {"name": "X", "redirect_uris": [WEB], "allowed_scopes": []},
    {"name": "X", "redirect_uris": [WEB], "allowed_scopes": ["admin"]},
])
async def test_invalid_admin_payloads(api, db, admin, payload):
    assert (await api.post(f"{BASE}/clients", headers=admin, json=payload)).status_code == 422
    assert await db.oauth_clients.count_documents({}) == 0


async def test_admin_scopes_redirects_and_rotation_rules(api, db, admin):
    pub = (await api.post(f"{BASE}/clients", headers=admin, json={
        "name": "Agent local", "client_type": "public", "redirect_uris": [LOOPBACK]})).json()
    cid = pub["client_id"]
    r = await api.put(f"{BASE}/clients/{cid}/scopes", headers=admin, json={"allowed_scopes": ["watch:read"]})
    assert r.status_code == 200 and r.json()["client"]["allowed_scopes"] == ["watch:read"]
    assert (await api.put(f"{BASE}/clients/{cid}/scopes", headers=admin, json={"allowed_scopes": []})).status_code == 422
    assert (await api.post(f"{BASE}/clients/{cid}/rotate-secret", headers=admin)).status_code == 400
    add = await api.post(f"{BASE}/clients/{cid}/redirect-uris", headers=admin, json={"redirect_uri": LOOPBACK_V6})
    assert add.status_code == 200
    bad = await api.post(f"{BASE}/clients/{cid}/redirect-uris", headers=admin, json={"redirect_uri": "http://127.0.0.1:9/cb"})
    assert bad.status_code == 400
    rm = await api.delete(f"{BASE}/clients/{cid}/redirect-uris", params={"redirect_uri": LOOPBACK}, headers=admin)
    assert rm.status_code == 200 and rm.json()["redirect_uris"] == [LOOPBACK_V6]
    last = await api.delete(f"{BASE}/clients/{cid}/redirect-uris", params={"redirect_uri": LOOPBACK_V6}, headers=admin)
    assert last.status_code == 400
    assert (await api.delete(f"{BASE}/clients/{cid}/redirect-uris", params={"redirect_uri": WEB}, headers=admin)).status_code == 400
    # Accès réservé à l'admin
    assert (await api.put(f"{BASE}/clients/{cid}/scopes", headers=api.headers_for("a"),
                          json={"allowed_scopes": ["watch:read"]})).status_code == 403


async def test_removed_redirect_cannot_be_used_anymore(api, db):
    await enable_watch(db, api)
    client = await public_client(db, uris=(LOOPBACK, LOOPBACK_V6))
    await svc.remove_redirect_uri(db, client["client_id"], LOOPBACK)
    r, _ = await authorize(api, client, "http://127.0.0.1:5000/callback")
    assert r.status_code == 400 and "location" not in r.headers


async def test_deactivating_a_public_client_cuts_it_only(api, db):
    await enable_watch(db, api)
    pub = await public_client(db)
    conf = await svc.create_client(db, "ChatGPT", [svc.CHATGPT_DEFAULT_REDIRECT])
    tp = await connect_public(api, db, pub)
    code, verifier = await get_code(api, conf, svc.CHATGPT_DEFAULT_REDIRECT)
    tc = (await api.post("/api/oauth/token", data={**exchange_form(code, verifier, svc.CHATGPT_DEFAULT_REDIRECT),
                                                   "client_id": conf["client_id"], "client_secret": conf["client_secret"]})).json()
    await svc.deactivate_client(db, pub["client_id"])
    assert (await mcp(api, LIST, tp["access_token"])).status_code == 401
    r = await public_token(api, pub["client_id"], {"grant_type": "refresh_token", "refresh_token": tp["refresh_token"]})
    assert r.status_code == 401
    assert (await mcp(api, LIST, tc["access_token"])).status_code == 200
