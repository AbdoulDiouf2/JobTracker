"""
A1.3 — Gestion OAuth/MCP depuis l'administration (Paramètres → API / Agents).
MongoDB éphémère, application FastAPI réelle (ASGI en mémoire). Aucune donnée réelle.

Couvre : accès réservé à l'admin webapp, secret affiché une seule fois, aucun doublon,
validation stricte des adresses de retour, (dés)activation et effet sur les jetons émis,
rotation du secret, consultation/révocation des connexions, état du service, et
disponibilité des routes admin quand le MCP est coupé ou désactivé.
"""

import logging
import secrets

import pytest

from config import settings
from services import oauth_service as svc
from utils import mcp_transport
from utils.auth import create_access_token
from test_oauth import (HOST, ISSUER, LIST, REDIRECT, RESOURCE, do_refresh, enable_watch, full_flow, get_code,
                        mcp, token_call)

pytestmark = pytest.mark.anyio

BASE = "/api/admin/oauth"
CHATGPT = {"name": "ChatGPT", "redirect_uris": [REDIRECT]}


@pytest.fixture(autouse=True)
def oauth_settings(monkeypatch):
    monkeypatch.setattr(settings, "MCP_ENABLED", True)
    monkeypatch.setattr(settings, "MCP_PRODUCTION_ALLOWED", False)
    monkeypatch.setattr(settings, "MCP_ALLOWED_HOSTS", HOST)
    monkeypatch.setattr(settings, "OAUTH_ISSUER", ISSUER)
    monkeypatch.delenv("VERCEL_ENV", raising=False)
    from routes.oauth import limiter
    limiter.reset()
    mcp_transport.reset_for_tests()
    yield
    limiter.reset()


@pytest.fixture
async def admin(api, db):
    """Compte admin ; renvoie ses en-têtes webapp."""
    admin_id = "admin-" + secrets.token_hex(3)
    await db.users.insert_one({"id": admin_id, "email": "admin@test.local", "is_active": True, "role": "admin"})
    api.users["admin"] = admin_id
    return {"Authorization": f"Bearer {create_access_token({'sub': admin_id})}"}


@pytest.fixture
async def service_open(db):
    """Flux OAuth complet : interrupteur ouvert EXPLICITEMENT (fermé par défaut, A0)."""
    await svc.set_kill_switch(db, False, "tests")


async def create(api, admin):
    r = await api.post(f"{BASE}/clients", json=CHATGPT, headers=admin)
    assert r.status_code == 201, r.text
    return r.json()


# ============================================
# Accès
# ============================================

ROUTES = [("get", "/status"), ("get", "/clients"), ("post", "/clients"),
          ("post", "/clients/x/redirect-uris"), ("put", "/clients/x/active"),
          ("post", "/clients/x/rotate-secret"), ("get", "/grants"), ("delete", "/grants/x")]


@pytest.mark.parametrize("method, path", ROUTES)
async def test_routes_require_admin_webapp_session(api, db, admin, method, path):
    call = getattr(api, method)
    assert (await call(BASE + path)).status_code == 401
    assert (await call(BASE + path, headers=api.headers_for("a"))).status_code == 403
    admin_ext = {"Authorization": f"Bearer {create_access_token({'sub': api.users['admin'], 'source': 'extension'})}"}
    assert (await call(BASE + path, headers=admin_ext)).status_code == 403
    assert await db.oauth_clients.count_documents({}) == 0


# ============================================
# Création : secret une seule fois, pas de doublon
# ============================================

async def test_create_returns_secret_once_and_never_again(api, db, admin, caplog):
    caplog.set_level(logging.DEBUG)
    r = await api.post(f"{BASE}/clients", json=CHATGPT, headers=admin)
    assert r.status_code == 201
    assert "no-store" in r.headers["cache-control"]
    body = r.json()
    secret = body["client_secret"]
    assert body["client_id"].startswith("jt_oc_") and secret.startswith("jt_ocs_")
    assert body["redirect_uris"] == [REDIRECT]

    listed = await api.get(f"{BASE}/clients", headers=admin)
    text = listed.text
    assert secret not in text and "secret_hash" not in text and svc.hash_secret(secret) not in text
    [client] = listed.json()["items"]
    assert client == {**client, "client_id": body["client_id"], "name": "ChatGPT", "active": True,
                      "redirect_uris": [REDIRECT], "active_grants": 0}
    assert secret not in caplog.text
    # Le secret créé fonctionne réellement avec le serveur OAuth
    assert await svc.authenticate_client(db, body["client_id"], secret)


async def test_no_duplicate_even_when_deactivated(api, db, admin):
    created = await create(api, admin)
    r = await api.post(f"{BASE}/clients", json=CHATGPT, headers=admin)
    assert r.status_code == 409 and "client_secret" not in r.text
    await api.put(f"{BASE}/clients/{created['client_id']}/active", json={"active": False}, headers=admin)
    assert (await api.post(f"{BASE}/clients", json=CHATGPT, headers=admin)).status_code == 409
    assert await db.oauth_clients.count_documents({}) == 1


# ============================================
# Adresses de retour
# ============================================

@pytest.mark.parametrize("uri", ["http://chatgpt.com/cb", "https://chatgpt.com/cb?x=1", "https://ChatGPT.com/cb",
                                 "https://*.chatgpt.com/cb", "https://chatgpt.com:8443/cb", "https://1.2.3.4/cb",
                                 "https://u:p@chatgpt.com/cb", "https://chatgpt.com/cb#f", " https://chatgpt.com/cb"])
async def test_invalid_redirect_uri_rejected(api, db, admin, uri):
    created = await create(api, admin)
    r = await api.post(f"{BASE}/clients/{created['client_id']}/redirect-uris", json={"redirect_uri": uri}, headers=admin)
    assert r.status_code == 400 and "redirect_uri invalide" in r.json()["detail"]
    assert (await db.oauth_clients.find_one({}))["redirect_uris"] == [REDIRECT]


async def test_add_redirect_uri_exact_and_idempotent(api, db, admin):
    created = await create(api, admin)
    path = f"{BASE}/clients/{created['client_id']}/redirect-uris"
    uri = "https://chatgpt.com/connector/oauth/abc123"
    assert (await api.post(path, json={"redirect_uri": uri}, headers=admin)).json()["redirect_uris"] == [REDIRECT, uri]
    assert (await api.post(path, json={"redirect_uri": uri}, headers=admin)).json()["redirect_uris"] == [REDIRECT, uri]
    assert (await api.post(path, json={"redirect_uri": uri, "x": 1}, headers=admin)).status_code == 422
    assert (await api.post(f"{BASE}/clients/inconnu/redirect-uris", json={"redirect_uri": uri},
                           headers=admin)).status_code == 404


# ============================================
# Activation / désactivation et jetons déjà émis
# ============================================

async def test_deactivation_revokes_grants_and_issued_tokens(api, db, admin, service_open):
    client, tokens = await full_flow(api, db)
    assert (await mcp(api, LIST, tokens["access_token"])).status_code == 200
    r = await api.put(f"{BASE}/clients/{client['client_id']}/active", json={"active": False}, headers=admin)
    assert r.status_code == 200 and r.json()["revoked_grants"] == 1 and r.json()["client"]["active"] is False
    assert (await mcp(api, LIST, tokens["access_token"])).status_code == 401           # jeton d'accès émis
    assert (await do_refresh(api, client, tokens["refresh_token"])).status_code == 401  # refresh émis
    grants = (await api.get(f"{BASE}/grants", headers=admin)).json()["items"]
    assert [g["status"] for g in grants] == ["revoked"]

    # Réactivation : pas de résurrection des anciens jetons, nouvelle connexion possible
    r = await api.put(f"{BASE}/clients/{client['client_id']}/active", json={"active": True}, headers=admin)
    assert r.status_code == 200 and r.json()["client"]["active"] is True
    assert (await mcp(api, LIST, tokens["access_token"])).status_code == 401
    code, verifier = await get_code(api, db, client)
    form = {"grant_type": "authorization_code", "code": code, "code_verifier": verifier,
            "redirect_uri": REDIRECT, "resource": RESOURCE}
    fresh = await token_call(api, client, form)
    assert fresh.status_code == 200
    assert (await mcp(api, LIST, fresh.json()["access_token"])).status_code == 200


async def test_token_of_inactive_client_refused_even_if_grant_escaped(api, db, admin, service_open):
    """Défense en profondeur : grant resté actif (course) mais client désactivé -> 401."""
    client, tokens = await full_flow(api, db)
    await db.oauth_clients.update_one({"client_id": client["client_id"]}, {"$set": {"active": False}})
    assert (await db.oauth_grants.find_one({}))["status"] == "active"
    assert (await mcp(api, LIST, tokens["access_token"])).status_code == 401


async def test_active_body_and_unknown_client(api, db, admin):
    created = await create(api, admin)
    path = f"{BASE}/clients/{created['client_id']}/active"
    assert (await api.put(path, json={"active": "no"}, headers=admin)).status_code == 422
    assert (await api.put(f"{BASE}/clients/inconnu/active", json={"active": False}, headers=admin)).status_code == 404


# ============================================
# Rotation du secret
# ============================================

async def test_rotate_secret_invalidates_old_one_immediately(api, db, admin, service_open):
    await enable_watch(db, api)
    created = await create(api, admin)
    old = {"client_id": created["client_id"], "client_secret": created["client_secret"]}
    r = await api.post(f"{BASE}/clients/{created['client_id']}/rotate-secret", headers=admin)
    assert r.status_code == 200 and "no-store" in r.headers["cache-control"]
    new_secret = r.json()["client_secret"]
    assert new_secret.startswith("jt_ocs_") and new_secret != old["client_secret"]
    assert new_secret not in (await api.get(f"{BASE}/clients", headers=admin)).text

    code, verifier = await get_code(api, db, old)
    form = {"grant_type": "authorization_code", "code": code, "code_verifier": verifier,
            "redirect_uri": REDIRECT, "resource": RESOURCE}
    assert (await token_call(api, old, form)).status_code == 401
    assert (await token_call(api, {**old, "client_secret": new_secret}, form)).status_code == 200
    assert (await api.post(f"{BASE}/clients/inconnu/rotate-secret", headers=admin)).status_code == 404


# ============================================
# Connexions (grants)
# ============================================

async def test_admin_lists_and_revokes_all_grants(api, db, admin, service_open):
    client, tokens = await full_flow(api, db, who="a")
    [grant] = (await api.get(f"{BASE}/grants", headers=admin)).json()["items"]
    assert grant["user_email"].startswith(api.users["a"]) and grant["client_id"] == client["client_id"]
    assert grant["client_name"] == "ChatGPT" and grant["status"] == "active"
    assert "jt_oat_" not in str(grant) and "jt_ort_" not in str(grant) and "hash" not in str(grant)

    # Isolation conservée pour les comptes standards : b ne voit ni ne révoque la connexion de a
    assert (await api.get("/api/oauth/grants", headers=api.headers_for("b"))).json() == {"items": []}
    assert (await api.get(f"{BASE}/grants", headers=api.headers_for("b"))).status_code == 403

    assert (await api.delete(f"{BASE}/grants/{grant['id']}", headers=admin)).status_code == 200
    assert (await mcp(api, LIST, tokens["access_token"])).status_code == 401
    refused = await do_refresh(api, client, tokens["refresh_token"])
    assert refused.status_code == 400 and refused.json()["error"] == "invalid_grant"
    assert (await api.delete(f"{BASE}/grants/inconnu", headers=admin)).status_code == 404


async def test_user_grant_view_unchanged(api, db, service_open):
    await full_flow(api, db, who="a")
    [item] = (await api.get("/api/oauth/grants", headers=api.headers_for("a"))).json()["items"]
    assert set(item) == {"id", "client_name", "scopes", "status", "created_at", "last_refresh_at", "expires_at", "alert"}


# ============================================
# État du service, disponibilité quand tout est coupé
# ============================================

@pytest.mark.parametrize("vercel_env, enabled, allowed, kill, expected", [
    (None, False, False, True, "unavailable"),
    ("production", True, False, False, "unavailable"),
    ("production", False, True, False, "unavailable"),
    ("production", True, True, True, "cut"),
    ("production", True, True, False, "open"),
    (None, True, False, False, "open"),
])
async def test_status(api, db, admin, monkeypatch, vercel_env, enabled, allowed, kill, expected):
    monkeypatch.setattr(settings, "MCP_ENABLED", enabled)
    monkeypatch.setattr(settings, "MCP_PRODUCTION_ALLOWED", allowed)
    if vercel_env:
        monkeypatch.setenv("VERCEL_ENV", vercel_env)
    if not kill:
        await svc.set_kill_switch(db, False, "tests")
    await db.users.update_one({"id": api.users["admin"]}, {"$set": {"watch_enabled": True}})
    body = (await api.get(f"{BASE}/status", headers=admin)).json()
    assert body == {"service": expected, "mcp_enabled": expected != "unavailable", "kill_switch_active": kill,
                    "production": vercel_env == "production",
                    "keys": {"mcp_enabled": enabled, "production_allowed": allowed},
                    "owner_watch_enabled": True, "mcp_url": RESOURCE,
                    "presets": [{"key": "chatgpt", "name": "ChatGPT", "redirect_uris": [REDIRECT],
                                 "client_type": "confidential", "allowed_scopes": ["watch:read", "opportunities:write"]}]}


async def test_kill_switch_closed_by_default_in_status(api, db, admin):
    body = (await api.get(f"{BASE}/status", headers=admin)).json()
    assert body["kill_switch_active"] is True and body["service"] == "cut" and body["owner_watch_enabled"] is False


@pytest.mark.parametrize("mode", ["kill_switch", "mcp_disabled", "production_one_key"])
async def test_admin_routes_available_when_service_is_off(api, db, admin, monkeypatch, mode):
    if mode == "mcp_disabled":
        monkeypatch.setattr(settings, "MCP_ENABLED", False)
    elif mode == "production_one_key":
        monkeypatch.setenv("VERCEL_ENV", "production")
    assert await svc.kill_switch_active(db) is True  # fermé par défaut
    assert (await api.get("/api/oauth/grants", headers=api.headers_for("a"))).status_code in (404, 503)

    created = await create(api, admin)
    cid = created["client_id"]
    assert (await api.get(f"{BASE}/status", headers=admin)).status_code == 200
    assert (await api.get(f"{BASE}/clients", headers=admin)).status_code == 200
    assert (await api.post(f"{BASE}/clients/{cid}/redirect-uris",
                           json={"redirect_uri": "https://chatgpt.com/connector/oauth/z"}, headers=admin)).status_code == 200
    assert (await api.post(f"{BASE}/clients/{cid}/rotate-secret", headers=admin)).status_code == 200
    assert (await api.put(f"{BASE}/clients/{cid}/active", json={"active": False}, headers=admin)).status_code == 200
    assert (await api.get(f"{BASE}/grants", headers=admin)).status_code == 200
    assert (await api.get("/api/admin/settings/mcp-kill-switch", headers=admin)).json() == {"active": True}
    # Rien de tout cela n'a ouvert le service
    assert await svc.kill_switch_active(db) is True
