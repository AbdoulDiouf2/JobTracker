"""
P1 — Généralisation multi-client du serveur OAuth/MCP.
MongoDB éphémère, application FastAPI réelle (ASGI en mémoire). Aucune donnée réelle.

Couvre : deux clients distincts aux autorisations indépendantes ; consentement affichant le
vrai client et son domaine de retour ; refus d'une adresse de retour non autorisée ;
désactivation, révocation et renouvellement isolés par client ; création, doublons de noms
et collisions d'adresses de retour en administration ; traçabilité du client vérifié sur les
offres et les exécutions ; compatibilité des offres antérieures sans client_id ; format des
réponses MCP inchangé.
"""

import json
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import urlsplit

import pytest

from config import settings
from services import oauth_service as svc
from utils import mcp_transport
from utils.auth import create_access_token
from test_oauth import HOST, ISSUER, LIST, RESOURCE, authorize_params, consent_redirect, enable_watch, mcp, pkce, qs

pytestmark = pytest.mark.anyio

CHATGPT_REDIRECT = svc.CHATGPT_DEFAULT_REDIRECT
OTHER_REDIRECT = "https://agent.maadec.com/oauth/callback"
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
    api.users["admin"] = admin_id
    return {"Authorization": f"Bearer {create_access_token({'sub': admin_id})}"}


async def two_clients(db):
    chatgpt = await svc.create_client(db, "ChatGPT", [CHATGPT_REDIRECT])
    agent = await svc.create_client(db, "Agent MAADEC", [OTHER_REDIRECT])
    return chatgpt, agent


async def connect(api, db, client, redirect, who="a"):
    """Autorisation complète (PKCE, consentement, échange) : renvoie les jetons."""
    verifier, challenge = pkce()
    r = await api.get("/api/oauth/authorize", params=authorize_params(client, challenge, redirect_uri=redirect))
    assert r.status_code == 302, r.text
    code = qs(await consent_redirect(api, qs(r.headers["location"])["request"], True, who))["code"]
    tok = await token(api, client, {"grant_type": "authorization_code", "code": code, "code_verifier": verifier,
                                    "redirect_uri": redirect, "resource": RESOURCE})
    assert tok.status_code == 200, tok.text
    return tok.json()


async def token(api, client, form):
    return await api.post("/api/oauth/token", data={**form, "client_id": client["client_id"],
                                                    "client_secret": client["client_secret"]})


def run_id():
    from zoneinfo import ZoneInfo
    now = datetime.now(ZoneInfo("Europe/Paris"))
    return f"veille-{now:%Y%m%d}-{now:%H%M}-manuel-{secrets.token_hex(3)}"


def offer(n):
    return {"title": f"Data Engineer {n}", "company": "Orange", "url": f"https://careers.orange.com/jobs/p1-{n}",
            "country": "FR", "contract_type": "CDI", "relevance_score": 90, "relevance_reasons": ["CDI"]}


async def tool(api, access, name, arguments):
    r = await mcp(api, {"jsonrpc": "2.0", "id": 3, "method": "tools/call",
                        "params": {"name": name, "arguments": arguments}}, access)
    assert r.status_code == 200, r.text
    result = r.json()["result"]
    return result["isError"], json.loads(result["content"][0]["text"])


# ============================================
# 1. Deux clients, autorisations indépendantes
# ============================================

async def test_two_clients_have_independent_grants(api, db):
    await enable_watch(db, api)
    chatgpt, agent = await two_clients(db)
    t1 = await connect(api, db, chatgpt, CHATGPT_REDIRECT)
    t2 = await connect(api, db, agent, OTHER_REDIRECT)
    # Le consentement du second client ne remplace PAS l'autorisation du premier
    grants = {g["client_id"]: g["status"] async for g in db.oauth_grants.find({})}
    assert grants == {chatgpt["client_id"]: "active", agent["client_id"]: "active"}
    assert (await mcp(api, LIST, t1["access_token"])).status_code == 200
    assert (await mcp(api, LIST, t2["access_token"])).status_code == 200
    # Un code d'un client ne peut pas être échangé par l'autre
    verifier, challenge = pkce()
    r = await api.get("/api/oauth/authorize", params=authorize_params(agent, challenge, redirect_uri=OTHER_REDIRECT))
    code = qs(await consent_redirect(api, qs(r.headers["location"])["request"]))["code"]
    stolen = await token(api, chatgpt, {"grant_type": "authorization_code", "code": code, "code_verifier": verifier,
                                        "redirect_uri": OTHER_REDIRECT, "resource": RESOURCE})
    assert stolen.status_code == 400 and stolen.json()["error"] == "invalid_grant"


# ============================================
# 2 et 3. Consentement et adresses de retour
# ============================================

async def test_consent_shows_real_client_and_redirect_domain(api, db):
    await enable_watch(db, api)
    _, agent = await two_clients(db)
    _, challenge = pkce()
    r = await api.get("/api/oauth/authorize", params=authorize_params(agent, challenge, redirect_uri=OTHER_REDIRECT))
    request_id = qs(r.headers["location"])["request"]
    body = (await api.get(f"/api/oauth/requests/{request_id}", headers=api.headers_for("a"))).json()
    assert body["client"] == {"name": "Agent MAADEC", "redirect_domain": "agent.maadec.com"}
    assert "ChatGPT" not in json.dumps(body)


@pytest.mark.parametrize("redirect", [CHATGPT_REDIRECT, "https://agent.maadec.com/oauth/other",
                                      "https://evil.example.com/oauth/callback", OTHER_REDIRECT + "?x=1"])
async def test_unregistered_redirect_is_refused_without_redirect(api, db, redirect):
    _, agent = await two_clients(db)
    _, challenge = pkce()
    r = await api.get("/api/oauth/authorize", params=authorize_params(agent, challenge, redirect_uri=redirect))
    assert r.status_code == 400 and "location" not in r.headers
    assert await db.oauth_requests.count_documents({}) == 0


async def test_non_conforming_stored_redirect_is_refused(api, db):
    """Défense en profondeur : une adresse enregistrée hors des règles (donnée ancienne ou
    modifiée en base) n'est ni utilisée ni affichée."""
    _, agent = await two_clients(db)
    await db.oauth_clients.update_one({"client_id": agent["client_id"]},
                                      {"$push": {"redirect_uris": "http://agent.maadec.com/cb"}})
    _, challenge = pkce()
    r = await api.get("/api/oauth/authorize",
                      params=authorize_params(agent, challenge, redirect_uri="http://agent.maadec.com/cb"))
    assert r.status_code == 400 and "location" not in r.headers


# ============================================
# 4 et 5. Désactivation, révocation, renouvellement isolés
# ============================================

async def test_deactivating_one_client_leaves_the_other_intact(api, db):
    await enable_watch(db, api)
    chatgpt, agent = await two_clients(db)
    t1 = await connect(api, db, chatgpt, CHATGPT_REDIRECT)
    t2 = await connect(api, db, agent, OTHER_REDIRECT)
    assert await svc.deactivate_client(db, agent["client_id"]) == 1
    assert (await mcp(api, LIST, t2["access_token"])).status_code == 401
    assert (await mcp(api, LIST, t1["access_token"])).status_code == 200
    refreshed = await token(api, chatgpt, {"grant_type": "refresh_token", "refresh_token": t1["refresh_token"]})
    assert refreshed.status_code == 200


async def test_refresh_and_revocation_are_isolated_per_client(api, db):
    await enable_watch(db, api)
    chatgpt, agent = await two_clients(db)
    t1 = await connect(api, db, chatgpt, CHATGPT_REDIRECT)
    t2 = await connect(api, db, agent, OTHER_REDIRECT)
    # Le refresh d'un client présenté par l'autre est refusé, sans effet sur le titulaire
    cross = await token(api, chatgpt, {"grant_type": "refresh_token", "refresh_token": t2["refresh_token"]})
    assert cross.status_code == 400 and cross.json()["error"] == "invalid_grant"
    # Révocation demandée par le mauvais client : sans effet (RFC 7009 : réponse 200)
    r = await api.post("/api/oauth/revoke", data={"token": t2["refresh_token"], "client_id": chatgpt["client_id"],
                                                  "client_secret": chatgpt["client_secret"]})
    assert r.status_code == 200 and (await mcp(api, LIST, t2["access_token"])).status_code == 200
    # Rotation chez l'agent : le jeton de ChatGPT n'est pas touché
    rotated = await token(api, agent, {"grant_type": "refresh_token", "refresh_token": t2["refresh_token"]})
    assert rotated.status_code == 200
    assert (await mcp(api, LIST, t1["access_token"])).status_code == 200
    # Révocation par le bon client : seul l'agent perd l'accès
    r = await api.post("/api/oauth/revoke", data={"token": rotated.json()["refresh_token"],
                                                  "client_id": agent["client_id"], "client_secret": agent["client_secret"]})
    assert r.status_code == 200
    assert (await mcp(api, LIST, rotated.json()["access_token"])).status_code == 401
    assert (await mcp(api, LIST, t1["access_token"])).status_code == 200


async def test_admin_revocation_and_rotation_target_one_client(api, db, admin):
    await enable_watch(db, api)
    chatgpt, agent = await two_clients(db)
    t1 = await connect(api, db, chatgpt, CHATGPT_REDIRECT)
    t2 = await connect(api, db, agent, OTHER_REDIRECT)
    grants = (await api.get(f"{BASE}/grants", headers=admin)).json()["items"]
    agent_grant = next(g for g in grants if g["client_id"] == agent["client_id"])
    assert agent_grant["client_name"] == "Agent MAADEC"
    assert (await api.delete(f"{BASE}/grants/{agent_grant['id']}", headers=admin)).status_code == 200
    assert (await mcp(api, LIST, t2["access_token"])).status_code == 401
    assert (await mcp(api, LIST, t1["access_token"])).status_code == 200
    # Rotation du secret de l'agent : ChatGPT continue de renouveler avec son propre secret
    assert (await api.post(f"{BASE}/clients/{agent['client_id']}/rotate-secret", headers=admin)).status_code == 200
    r = await token(api, chatgpt, {"grant_type": "refresh_token", "refresh_token": t1["refresh_token"]})
    assert r.status_code == 200


# ============================================
# Administration multi-client
# ============================================

async def test_admin_creates_several_clients(api, db, admin):
    r1 = await api.post(f"{BASE}/clients", json={"name": "ChatGPT", "redirect_uris": [CHATGPT_REDIRECT]}, headers=admin)
    r2 = await api.post(f"{BASE}/clients", headers=admin,
                        json={"name": "  Agent   MAADEC ", "redirect_uris": [OTHER_REDIRECT, OTHER_REDIRECT]})
    assert r1.status_code == r2.status_code == 201
    assert r2.json()["name"] == "Agent MAADEC" and r2.json()["redirect_uris"] == [OTHER_REDIRECT]
    assert r1.json()["warnings"] == [] and r2.json()["warnings"] == []
    assert r1.json()["client_id"] != r2.json()["client_id"]
    assert r1.json()["client_secret"] != r2.json()["client_secret"]
    listed = (await api.get(f"{BASE}/clients", headers=admin)).json()["items"]
    assert [c["name"] for c in listed] == ["ChatGPT", "Agent MAADEC"]
    assert "jt_ocs_" not in json.dumps(listed)


@pytest.mark.parametrize("name", ["chatgpt", "CHATGPT", "  ChatGPT  ", "Chatgpt"])
async def test_duplicate_names_case_insensitive(api, db, admin, name):
    first = await api.post(f"{BASE}/clients", json={"name": "ChatGPT", "redirect_uris": [CHATGPT_REDIRECT]}, headers=admin)
    r = await api.post(f"{BASE}/clients", json={"name": name, "redirect_uris": [OTHER_REDIRECT]}, headers=admin)
    assert r.status_code == 409 and "client_secret" not in r.text and "réactivez" not in r.text
    await api.put(f"{BASE}/clients/{first.json()['client_id']}/active", json={"active": False}, headers=admin)
    r = await api.post(f"{BASE}/clients", json={"name": name, "redirect_uris": [OTHER_REDIRECT]}, headers=admin)
    assert r.status_code == 409 and "réactivez" in r.json()["detail"]
    assert await db.oauth_clients.count_documents({}) == 1


@pytest.mark.parametrize("body", [
    {"name": "", "redirect_uris": [OTHER_REDIRECT]},
    {"name": "   ", "redirect_uris": [OTHER_REDIRECT]},
    {"name": "<script>alert(1)</script>", "redirect_uris": [OTHER_REDIRECT]},
    {"name": "Agent\x07", "redirect_uris": [OTHER_REDIRECT]},
    {"name": "A" * 101, "redirect_uris": [OTHER_REDIRECT]},
    {"name": "Agent", "redirect_uris": ["http://agent.maadec.com/cb"]},
    {"name": "Agent", "redirect_uris": ["https://localhost/cb"]},
    {"name": "Agent", "redirect_uris": ["https://agent.maadec.com/cb#x"]},
])
async def test_invalid_client_definitions_are_refused(api, db, admin, body):
    r = await api.post(f"{BASE}/clients", json=body, headers=admin)
    assert r.status_code == 400 and "client_secret" not in r.text
    assert await db.oauth_clients.count_documents({}) == 0


@pytest.mark.parametrize("body", [{"name": "Agent"}, {"name": "Agent", "redirect_uris": []},
                                  {"name": "Agent", "redirect_uris": [OTHER_REDIRECT] * 11},
                                  {"name": "Agent", "redirect_uris": [OTHER_REDIRECT], "client_secret": "x"}])
async def test_invalid_create_payloads(api, db, admin, body):
    assert (await api.post(f"{BASE}/clients", json=body, headers=admin)).status_code == 422
    assert await db.oauth_clients.count_documents({}) == 0


async def test_shared_redirect_is_allowed_but_reported(api, db, admin):
    first = (await api.post(f"{BASE}/clients", json={"name": "ChatGPT", "redirect_uris": [CHATGPT_REDIRECT]},
                            headers=admin)).json()
    r = await api.post(f"{BASE}/clients", json={"name": "ChatGPT pro", "redirect_uris": [CHATGPT_REDIRECT]},
                       headers=admin)
    assert r.status_code == 201
    assert r.json()["warnings"] == [{"code": "redirect_uri_shared", "redirect_uri": CHATGPT_REDIRECT,
                                     "client_id": first["client_id"], "client_name": "ChatGPT"}]
    # Ajout d'une adresse déjà portée par un autre client : accepté, signalé
    other = (await api.post(f"{BASE}/clients", json={"name": "Agent", "redirect_uris": [OTHER_REDIRECT]},
                            headers=admin)).json()
    r = await api.post(f"{BASE}/clients/{other['client_id']}/redirect-uris",
                       json={"redirect_uri": CHATGPT_REDIRECT}, headers=admin)
    assert r.status_code == 200 and {w["client_name"] for w in r.json()["warnings"]} == {"ChatGPT", "ChatGPT pro"}
    # Le code reste lié au client_id : aucune confusion possible à l'échange (test 1)


async def test_status_offers_an_optional_chatgpt_preset(api, db, admin):
    presets = (await api.get(f"{BASE}/status", headers=admin)).json()["presets"]
    assert presets == [{"key": "chatgpt", "name": "ChatGPT", "redirect_uris": [CHATGPT_REDIRECT]}]
    assert await db.oauth_clients.count_documents({}) == 0  # rien n'est créé d'office


async def test_redirect_uri_limit(api, db, admin):
    created = (await api.post(f"{BASE}/clients", headers=admin, json={
        "name": "Agent", "redirect_uris": [f"https://agent.maadec.com/cb{i}" for i in range(10)]})).json()
    r = await api.post(f"{BASE}/clients/{created['client_id']}/redirect-uris",
                       json={"redirect_uri": "https://agent.maadec.com/cb10"}, headers=admin)
    assert r.status_code == 400


async def test_service_never_defaults_the_client_name(db):
    for bad in ("", "  ", None):
        with pytest.raises(ValueError):
            svc.validate_client_name(bad)
        with pytest.raises(ValueError):
            await svc.create_client(db, bad, [OTHER_REDIRECT])
    assert await db.oauth_clients.count_documents({}) == 0


# ============================================
# 6. Traçabilité du client vérifié
# ============================================

async def test_opportunities_and_runs_record_the_verified_client(api, db):
    await enable_watch(db, api)
    chatgpt, agent = await two_clients(db)
    t1 = await connect(api, db, chatgpt, CHATGPT_REDIRECT)
    t2 = await connect(api, db, agent, OTHER_REDIRECT)
    rid = run_id()
    err, out = await tool(api, t2["access_token"], "create_opportunities", {"run_id": rid, "opportunities": [offer(1)]})
    assert err is False and out["results"][0]["status"] == "created"
    # Format de réponse inchangé : aucune clé de traçabilité exposée à l'appelant
    assert "client_id" not in json.dumps(out)
    opp = await db.opportunities.find_one({"id": out["results"][0]["opportunity_id"]})
    assert opp["watch"]["client_id"] == agent["client_id"] and opp["source"] == "chatgpt_watch"

    err, out = await tool(api, t1["access_token"], "create_opportunities", {"run_id": rid, "opportunities": [offer(2)]})
    assert err is False
    opp2 = await db.opportunities.find_one({"id": out["results"][0]["opportunity_id"]})
    assert opp2["watch"]["client_id"] == chatgpt["client_id"]
    run = await db.watch_runs.find_one({"run_id": rid})
    assert sorted(run["client_ids"]) == sorted([chatgpt["client_id"], agent["client_id"]])

    err, out = await tool(api, t1["access_token"], "report_watch_run", {"run_id": rid, "status": "completed"})
    assert err is False and set(out) == {"run_id", "recorded", "observed"}
    run = await db.watch_runs.find_one({"run_id": rid})
    assert run["report_client_id"] == chatgpt["client_id"] and "client_id" not in run["report"]
    err, status = await tool(api, t1["access_token"], "get_watch_status", {})
    assert "client_id" not in json.dumps(status)


@pytest.mark.parametrize("arguments", [
    {"client_id": "jt_oc_usurpe", "run_id": "x", "opportunities": [offer(1)]},
    {"run_id": "x", "opportunities": [{**offer(1), "client_id": "jt_oc_usurpe"}]},
])
async def test_caller_supplied_client_id_is_never_trusted(api, db, arguments):
    await enable_watch(db, api)
    chatgpt, _ = await two_clients(db)
    t1 = await connect(api, db, chatgpt, CHATGPT_REDIRECT)
    if arguments["run_id"] == "x":
        arguments = {**arguments, "run_id": run_id()}
    err, out = await tool(api, t1["access_token"], "create_opportunities", arguments)
    if err:
        assert out["error"]["code"] == "invalid_arguments"
    else:
        assert out["results"][0]["status"] == "rejected"
    assert await db.opportunities.count_documents({"watch.client_id": "jt_oc_usurpe"}) == 0
    assert await db.opportunities.count_documents({}) == 0


# ============================================
# 7. Compatibilité des données antérieures
# ============================================

async def test_legacy_opportunities_and_runs_without_client_id(api, db):
    await enable_watch(db, api)
    chatgpt, _ = await two_clients(db)
    t1 = await connect(api, db, chatgpt, CHATGPT_REDIRECT)
    user = api.users["a"]
    rid = run_id()
    # Exécution et offre au format antérieur à P1 (aucun client_id)
    err, out = await tool(api, t1["access_token"], "create_opportunities", {"run_id": rid, "opportunities": [offer(1)]})
    opp_id = out["results"][0]["opportunity_id"]
    await db.opportunities.update_one({"id": opp_id}, {"$unset": {"watch.client_id": ""}})
    await db.watch_runs.update_one({"run_id": rid}, {"$unset": {"client_ids": ""}})
    legacy = await db.opportunities.find_one({"id": opp_id})
    assert "client_id" not in legacy["watch"]

    # Lecture par l'interface (Lot 1) et par les outils MCP
    r = await api.get("/api/opportunities", headers=api.headers_for("a"))
    assert r.status_code == 200
    item = next(i for i in r.json()["items"] if i["id"] == opp_id)
    assert item["watch"]["run_id"] == rid and item["watch"].get("client_id") is None
    err, recent = await tool(api, t1["access_token"], "list_recent_opportunities", {})
    assert err is False and recent["total"] == 1
    err, status = await tool(api, t1["access_token"], "get_watch_status", {})
    assert err is False and status["last_run"]["run_id"] == rid
    # Rejeu et déduplication intacts sur des données anciennes
    err, again = await tool(api, t1["access_token"], "create_opportunities", {"run_id": rid, "opportunities": [offer(1)]})
    assert again["results"][0]["replayed"] is True and again["results"][0]["opportunity_id"] == opp_id
    err, dup = await tool(api, t1["access_token"], "create_opportunities", {"run_id": run_id(), "opportunities": [offer(1)]})
    assert dup["results"][0]["status"] == "duplicate"
    assert await db.opportunities.count_documents({"user_id": user}) == 1
    # Le rapport d'une exécution ancienne complète la traçabilité sans casser le document
    err, rep = await tool(api, t1["access_token"], "report_watch_run", {"run_id": rid, "status": "completed"})
    assert err is False
    run = await db.watch_runs.find_one({"run_id": rid})
    assert run["client_ids"] == [chatgpt["client_id"]]
