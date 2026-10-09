"""
P3 — Client ID Metadata Documents (CIMD) : politique de confiance, anti-SSRF, validation du
document, cache, flux OAuth complet (Claude Code, Codex, VS Code : documents relevés le
10/10/2026), administration et non-régression. Aucun réseau réel : résolution DNS et
transport HTTP simulés ; le transport vérifie l'adresse épinglée, l'en-tête Host et le SNI.
"""

import json
import secrets
from datetime import datetime, timedelta, timezone

import httpx
import pytest

from config import settings
from services import cimd_service, oauth_service as svc
from utils import mcp_transport
from utils.auth import create_access_token
from test_oauth import HOST, ISSUER, LIST, RESOURCE, authorize_params, consent_redirect, enable_watch, mcp, pkce, qs

pytestmark = pytest.mark.anyio

CLAUDE_CODE = "https://claude.ai/oauth/claude-code-client-metadata"
CODEX = "https://chatgpt.com/oauth/codex/client.json"
VSCODE = "https://vscode.dev/oauth/client-metadata.json"
PUBLIC_IP = "93.184.216.34"
DOCS = {
    CLAUDE_CODE: {"client_id": CLAUDE_CODE, "client_name": "Claude Code", "client_uri": "https://claude.ai",
                  "redirect_uris": ["http://localhost/callback", "http://127.0.0.1/callback"],
                  "grant_types": ["authorization_code", "refresh_token"], "response_types": ["code"],
                  "token_endpoint_auth_method": "none"},
    CODEX: {"client_id": CODEX, "client_uri": "https://chatgpt.com/codex", "application_type": "native",
            "redirect_uris": ["http://127.0.0.1/callback", "http://localhost/callback"],
            "token_endpoint_auth_method": "none", "token_endpoint_auth_methods_supported": ["none"],
            "grant_types": ["authorization_code", "refresh_token"], "response_types": ["code"], "client_name": "Codex"},
    VSCODE: {"client_name": "Visual Studio Code", "grant_types": ["authorization_code", "refresh_token",
             "urn:ietf:params:oauth:grant-type:device_code"], "response_types": ["code"],
             "token_endpoint_auth_method": "none", "application_type": "native", "client_id": VSCODE,
             "client_uri": "https://vscode.dev/product", "redirect_uris": ["http://127.0.0.1:33418/", "https://vscode.dev/redirect"]},
}


class FakeWeb:
    """DNS et HTTP simulés. Vérifie chaque requête : connexion à l'IP résolue, Host et SNI."""

    def __init__(self):
        self.dns = {}
        self.responses = {}
        self.calls = []

    def serve(self, url, body=None, status=200, headers=None):
        host = url.split("/")[2]
        self.dns.setdefault(host, [PUBLIC_IP])
        content = body if isinstance(body, (bytes, str)) else json.dumps(body if body is not None else DOCS[url])
        self.responses[(host, url[len("https://") + len(host):])] = (
            status, {"content-type": "application/json", **(headers or {})}, content)

    async def resolve(self, host):
        if host not in self.dns:
            raise OSError("NXDOMAIN")
        return list(self.dns[host])

    def handler(self, request: httpx.Request):
        host = request.headers["host"]
        assert request.url.scheme == "https" and request.url.host in self.dns[host]  # IP épinglée
        assert request.extensions.get("sni_hostname") == host  # certificat vérifié pour le nom
        self.calls.append((host, request.url.path))
        status, headers, content = self.responses[(host, request.url.path)]
        return httpx.Response(status, headers=headers, content=content)


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
def web(monkeypatch):
    fake = FakeWeb()
    monkeypatch.setattr(cimd_service, "_resolve", fake.resolve)
    monkeypatch.setattr(cimd_service, "_transport", httpx.MockTransport(fake.handler))
    for url in DOCS:
        fake.serve(url)
    return fake


async def allow(db, hosts=("claude.ai", "chatgpt.com", "vscode.dev"), scopes=("watch:read",), enabled=True):
    await cimd_service.set_policy(db, enabled, list(hosts), list(scopes), "tests")


@pytest.fixture
async def admin(api, db):
    admin_id = "admin-" + secrets.token_hex(3)
    await db.users.insert_one({"id": admin_id, "email": "admin@test.local", "is_active": True, "role": "admin"})
    return {"Authorization": f"Bearer {create_access_token({'sub': admin_id})}"}


async def authorize(api, client_id, redirect, **over):
    verifier, challenge = pkce()
    r = await api.get("/api/oauth/authorize",
                      params=authorize_params({"client_id": client_id}, challenge, redirect_uri=redirect, **over))
    return r, verifier


async def connect(api, client_id, redirect, who="a"):
    r, verifier = await authorize(api, client_id, redirect)
    assert r.status_code == 302, r.text
    code = qs(await consent_redirect(api, qs(r.headers["location"])["request"], True, who))["code"]
    tok = await api.post("/api/oauth/token", data={"grant_type": "authorization_code", "code": code,
                                                   "code_verifier": verifier, "redirect_uri": redirect,
                                                   "resource": RESOURCE, "client_id": client_id})
    assert tok.status_code == 200, tok.text
    return tok.json()


async def discovery(api):
    return (await api.get("/.well-known/oauth-authorization-server")).json()


# ============================================
# Découverte et politique
# ============================================

async def test_cimd_announced_only_when_operational_and_no_dcr(api, db, web):
    meta = await discovery(api)
    assert meta["client_id_metadata_document_supported"] is False and "registration_endpoint" not in meta
    await allow(db, hosts=[], enabled=True)  # activée sans hôte : non opérationnelle
    assert (await discovery(api))["client_id_metadata_document_supported"] is False
    await allow(db)
    meta = await discovery(api)
    assert meta["client_id_metadata_document_supported"] is True and "none" in meta["token_endpoint_auth_methods_supported"]
    assert "registration_endpoint" not in meta
    assert (await api.post("/api/oauth/register", json={"redirect_uris": ["https://x.example.com/cb"]})).status_code in (404, 405)


async def test_disabled_policy_or_unlisted_host_refuses_without_network(api, db, web):
    r, _ = await authorize(api, CLAUDE_CODE, "http://localhost:3118/callback")
    assert r.status_code == 400 and r.json()["error"] == "invalid_client" and web.calls == []
    await allow(db, hosts=["vscode.dev"])
    r, _ = await authorize(api, CLAUDE_CODE, "http://localhost:3118/callback")
    assert r.status_code == 400 and web.calls == []
    # Correspondance EXACTE : un sous-domaine n'est pas approuvé
    web.serve("https://evil.vscode.dev/client.json", {**DOCS[VSCODE], "client_id": "https://evil.vscode.dev/client.json"})
    r, _ = await authorize(api, "https://evil.vscode.dev/client.json", "https://vscode.dev/redirect")
    assert r.status_code == 400 and web.calls == []


# ============================================
# URL du client
# ============================================

@pytest.mark.parametrize("url", [
    "http://claude.ai/oauth/x", "https://claude.ai", "https://claude.ai/", "https://user@claude.ai/x",
    "https://claude.ai:8443/x", "https://93.184.216.34/x", "https://[::1]/x", "https://claude.ai/x?y=1",
    "https://claude.ai/x#f", "https://claude.ai/a/../x", "https://claude.ai/./x", "https://claude.ai//x",
    "https://claude.ai/%2e%2e/x", "https://Claude.ai/x", "https://claude.ai/x y", "https://claude.ai/" + "a" * 600,
    "https://localhost/x", "https://claude.ai\\@evil.com/x",
])
async def test_invalid_client_id_urls(url):
    with pytest.raises(ValueError):
        cimd_service.validate_client_id_url(url)


async def test_valid_client_id_urls():
    for url in DOCS:
        assert cimd_service.validate_client_id_url(url) == url.split("/")[2]


# ============================================
# Anti-SSRF
# ============================================

@pytest.mark.parametrize("addresses", [
    ["127.0.0.1"], ["10.0.0.5"], ["192.168.1.10"], ["172.16.0.1"], ["169.254.169.254"], ["100.64.0.1"],
    ["0.0.0.0"], ["::1"], ["fc00::1"], ["fe80::1"], ["::ffff:127.0.0.1"], ["224.0.0.1"],
    [PUBLIC_IP, "10.0.0.5"],  # une seule adresse privée suffit à refuser
    # Adresses IPv6 de transition portant une IPv4 interne (classées « globales » par Python)
    ["64:ff9b::7f00:1"], ["64:ff9b::a9fe:a9fe"], ["64:ff9b:1::a00:1"], ["2002:7f00:1::"], ["2002:a00:1::"],
    ["::7f00:1"], ["::"],
])
async def test_private_or_mixed_resolution_is_refused_without_request(api, db, web, addresses):
    await allow(db)
    web.dns["claude.ai"] = addresses
    r, _ = await authorize(api, CLAUDE_CODE, "http://localhost:3118/callback")
    assert r.status_code == 400 and "location" not in r.headers
    assert web.calls == [] and await db.oauth_clients.count_documents({}) == 0


async def test_dns_failure_is_refused(api, db, web):
    await allow(db)
    del web.dns["claude.ai"]
    r, _ = await authorize(api, CLAUDE_CODE, "http://localhost:3118/callback")
    assert r.status_code == 400 and web.calls == []


async def test_public_ip_classifier():
    assert cimd_service.is_public_ip(PUBLIC_IP) and cimd_service.is_public_ip("2606:4700::1111")
    for ip in ("127.0.0.1", "10.1.1.1", "169.254.1.1", "::1", "::ffff:10.0.0.1", "fd12::1", "100.100.1.1", "x",
               "64:ff9b::7f00:1", "64:ff9b:1::a00:1", "2002:a9fe:a9fe::", "::7f00:1", "::"):
        assert not cimd_service.is_public_ip(ip)
    # Transition vers une IPv4 PUBLIQUE : acceptée (NAT64 / 6to4 légitimes)
    assert cimd_service.is_public_ip("64:ff9b::5db8:d822") and cimd_service.is_public_ip("2002:5db8:d822::")


# ============================================
# Documents invalides ou malveillants
# ============================================

def bad(**changes):
    doc = dict(DOCS[CLAUDE_CODE])
    for k, v in changes.items():
        if v is None:
            doc.pop(k, None)
        else:
            doc[k] = v
    return doc


@pytest.mark.parametrize("status, headers, body", [
    (302, {"location": "http://169.254.169.254/"}, "{}"),        # aucune redirection suivie
    (404, {}, "{}"), (500, {}, "{}"),
    (200, {"content-type": "text/html"}, json.dumps(DOCS[CLAUDE_CODE])),
    (200, {}, "x" * (6 * 1024)),                                  # trop volumineux
    (200, {"content-length": "999999"}, json.dumps(DOCS[CLAUDE_CODE])),
    (200, {}, "{pas du json"), (200, {}, "[1, 2]"),
    (200, {}, bad(client_id=CLAUDE_CODE + "/")),                  # client_id différent de l'URL
    (200, {}, bad(client_id="https://claude.ai/oauth/autre")),
    (200, {}, bad(client_secret="s3cr3t")), (200, {}, bad(client_secret_expires_at=0)),
    (200, {}, bad(token_endpoint_auth_method="client_secret_basic")),
    (200, {}, bad(client_name=None)), (200, {}, bad(client_name="<b>x</b>")), (200, {}, bad(client_name="")),
    (200, {}, bad(redirect_uris=[])), (200, {}, bad(redirect_uris=None)),
    (200, {}, bad(redirect_uris=["http://evil.com/cb"])), (200, {}, bad(redirect_uris=["javascript:alert(1)"])),
    (200, {}, bad(redirect_uris=["http://localhost:99999/cb"])), (200, {}, bad(redirect_uris=["https://x.com/cb#f"])),
    (200, {}, bad(redirect_uris=[f"https://x{i}.com/cb" for i in range(11)])),
    (200, {}, bad(grant_types=["client_credentials"])), (200, {}, bad(response_types=["token"])),
])
async def test_invalid_documents_are_refused_and_never_cached(api, db, web, status, headers, body):
    await allow(db)
    web.serve(CLAUDE_CODE, body, status=status, headers=headers)
    r, _ = await authorize(api, CLAUDE_CODE, "http://localhost:3118/callback")
    assert r.status_code == 400 and r.json()["error"] == "invalid_client" and "location" not in r.headers
    assert await db.oauth_clients.count_documents({}) == 0
    # Erreur non mise en cache : un document correct est accepté juste après
    web.serve(CLAUDE_CODE)
    r, _ = await authorize(api, CLAUDE_CODE, "http://localhost:3118/callback")
    assert r.status_code == 302


# ============================================
# Flux complets : Claude Code, Codex, VS Code
# ============================================

async def test_claude_code_full_flow_with_minimal_default_scopes(api, db, web):
    await enable_watch(db, api)
    await allow(db)
    redirect = "http://localhost:3118/callback"
    r, _ = await authorize(api, CLAUDE_CODE, redirect)
    body = (await api.get(f"/api/oauth/requests/{qs(r.headers['location'])['request']}",
                          headers=api.headers_for("a"))).json()
    assert body["client"] == {"name": "Claude Code", "redirect_domain": "localhost", "redirect_local": True,
                              "identity_host": "claude.ai"}
    assert [s["scope"] for s in body["scopes"]] == ["watch:read"]  # aucun privilège automatique
    tokens = await connect(api, CLAUDE_CODE, redirect)
    assert tokens["scope"] == "watch:read"
    assert (await mcp(api, LIST, tokens["access_token"])).status_code == 200
    write = await mcp(api, {"jsonrpc": "2.0", "id": 2, "method": "tools/call",
                            "params": {"name": "create_opportunities", "arguments": {"run_id": "x", "opportunities": []}}},
                      tokens["access_token"])
    assert write.status_code == 403
    stored = await db.oauth_clients.find_one({"client_id": CLAUDE_CODE})
    assert stored["registration"] == "cimd" and stored["client_type"] == "public" and stored["secret_hash"] is None
    # Renouvellement et révocation en client public (identifiant seul)
    r = await api.post("/api/oauth/token", data={"grant_type": "refresh_token", "refresh_token": tokens["refresh_token"],
                                                 "client_id": CLAUDE_CODE})
    assert r.status_code == 200 and r.json()["refresh_token"] != tokens["refresh_token"]
    rv = await api.post("/api/oauth/revoke", data={"token": r.json()["refresh_token"], "client_id": CLAUDE_CODE})
    assert rv.status_code == 200 and (await mcp(api, LIST, r.json()["access_token"])).status_code == 401


@pytest.mark.parametrize("client_id, redirect", [
    (CODEX, "http://127.0.0.1:49152/callback"), (CODEX, "http://localhost:1455/callback"),
    (CLAUDE_CODE, "http://127.0.0.1:3118/callback"),
    (VSCODE, "http://127.0.0.1:33418/"), (VSCODE, "http://127.0.0.1:50000/"), (VSCODE, "https://vscode.dev/redirect"),
])
async def test_published_identities_of_targeted_clients(api, db, web, client_id, redirect):
    await enable_watch(db, api)
    await allow(db)
    tokens = await connect(api, client_id, redirect)
    assert (await mcp(api, LIST, tokens["access_token"])).status_code == 200


@pytest.mark.parametrize("client_id, redirect", [
    (CLAUDE_CODE, "http://localhost:3118/other"), (CLAUDE_CODE, "http://localhost:3118/callback/"),
    (CLAUDE_CODE, "https://claude.ai/callback"), (CLAUDE_CODE, "http://[::1]:3118/callback"),
    (VSCODE, "https://vscode.dev/redirect/x"), (VSCODE, "https://evil.dev/redirect"),
    (VSCODE, "http://localhost:33418/"),  # localhost absent du document VS Code
    (CODEX, "http://127.0.0.1:0/callback"), (CODEX, "http://127.0.0.1.evil.com/callback"),
])
async def test_redirects_outside_the_document_are_refused(api, db, web, client_id, redirect):
    await allow(db)
    r, _ = await authorize(api, client_id, redirect)
    assert r.status_code == 400 and "location" not in r.headers


async def test_code_substitution_between_published_clients_fails(api, db, web):
    await enable_watch(db, api)
    await allow(db)
    redirect = "http://127.0.0.1:5000/callback"
    r, verifier = await authorize(api, CLAUDE_CODE, redirect)
    code = qs(await consent_redirect(api, qs(r.headers["location"])["request"]))["code"]
    stolen = await api.post("/api/oauth/token", data={"grant_type": "authorization_code", "code": code,
                                                      "code_verifier": verifier, "redirect_uri": redirect,
                                                      "resource": RESOURCE, "client_id": CODEX})
    assert stolen.status_code in (400, 401)


async def test_impersonating_name_shows_the_real_publisher_host(api, db, web):
    """Un document qui se nomme « ChatGPT » : la page de consentement montre l'hôte réel."""
    await enable_watch(db, api)
    await allow(db, hosts=["vscode.dev"])
    fake = "https://vscode.dev/oauth/fake.json"
    web.serve(fake, {**DOCS[VSCODE], "client_id": fake, "client_name": "ChatGPT"})
    r, _ = await authorize(api, fake, "https://vscode.dev/redirect")
    body = (await api.get(f"/api/oauth/requests/{qs(r.headers['location'])['request']}", headers=api.headers_for("a"))).json()
    assert body["client"]["name"] == "ChatGPT" and body["client"]["identity_host"] == "vscode.dev"


# ============================================
# Cache, document modifié ou indisponible
# ============================================

async def test_cache_bounds_and_refresh(api, db, web):
    await enable_watch(db, api)
    await allow(db)
    web.serve(CLAUDE_CODE, headers={"cache-control": "max-age=10"})  # borné à 5 min minimum
    # Cache tenu par le client enregistré (après le premier consentement approuvé)
    await connect(api, CLAUDE_CODE, "http://localhost:1/callback")
    for _ in range(2):
        assert (await authorize(api, CLAUDE_CODE, "http://localhost:1/callback"))[0].status_code == 302
    assert len(web.calls) == 1
    stored = await db.oauth_clients.find_one({"client_id": CLAUDE_CODE})
    ttl = svc._aware(stored["metadata_cached_until"]) - svc._aware(stored["metadata_fetched_at"])
    assert ttl == timedelta(seconds=300)
    assert cimd_service._cache_seconds("max-age=999999") == 86400 and cimd_service._cache_seconds("") == 3600
    assert cimd_service._cache_seconds("no-store") == 300


async def test_modified_or_unavailable_document_after_expiry(api, db, web):
    await enable_watch(db, api)
    await allow(db)
    tokens = await connect(api, CLAUDE_CODE, "http://localhost:3118/callback")
    expire = {"$set": {"metadata_cached_until": datetime.now(timezone.utc) - timedelta(seconds=1)}}
    # Document modifié : localhost retiré -> refusé ; 127.0.0.1 accepté
    await db.oauth_clients.update_one({"client_id": CLAUDE_CODE}, expire)
    web.serve(CLAUDE_CODE, {**DOCS[CLAUDE_CODE], "redirect_uris": ["http://127.0.0.1/callback"], "client_name": "Claude Code 2"})
    assert (await authorize(api, CLAUDE_CODE, "http://localhost:3118/callback"))[0].status_code == 400
    assert (await authorize(api, CLAUDE_CODE, "http://127.0.0.1:3118/callback"))[0].status_code == 302
    assert (await db.oauth_clients.find_one({"client_id": CLAUDE_CODE}))["name"] == "Claude Code 2"
    # Document indisponible après expiration : nouvelle autorisation refusée (aucun document périmé)
    await db.oauth_clients.update_one({"client_id": CLAUDE_CODE}, expire)
    web.serve(CLAUDE_CODE, "{}", status=503)
    assert (await authorize(api, CLAUDE_CODE, "http://127.0.0.1:3118/callback"))[0].status_code == 400
    # ... sans couper les connexions existantes
    assert (await mcp(api, LIST, tokens["access_token"])).status_code == 200


# ============================================
# Administration
# ============================================

async def test_admin_policy_and_cimd_client_management(api, db, web, admin):
    base = "/api/admin/oauth"
    assert (await api.get(f"{base}/cimd-policy", headers=admin)).json() == {
        "enabled": False, "allowed_hosts": [], "default_scopes": ["watch:read"], "operational": False}
    for payload in ({"enabled": True, "allowed_hosts": ["Claude.AI"], "default_scopes": ["watch:read"]},
                    {"enabled": True, "allowed_hosts": ["127.0.0.1"], "default_scopes": ["watch:read"]},
                    {"enabled": True, "allowed_hosts": ["*.claude.ai"], "default_scopes": ["watch:read"]}):
        assert (await api.put(f"{base}/cimd-policy", headers=admin, json=payload)).status_code == 400
    assert (await api.put(f"{base}/cimd-policy", headers=admin,
                          json={"enabled": True, "allowed_hosts": ["claude.ai"], "default_scopes": []})).status_code == 422
    assert (await api.put(f"{base}/cimd-policy", headers=api.headers_for("a"),
                          json={"enabled": True, "allowed_hosts": ["claude.ai"], "default_scopes": ["watch:read"]})).status_code == 403
    ok = await api.put(f"{base}/cimd-policy", headers=admin,
                       json={"enabled": True, "allowed_hosts": ["claude.ai", "claude.ai"], "default_scopes": ["watch:read"]})
    assert ok.json() == {"enabled": True, "allowed_hosts": ["claude.ai"], "default_scopes": ["watch:read"], "operational": True}

    await enable_watch(db, api)
    tokens = await connect(api, CLAUDE_CODE, "http://localhost:3118/callback")
    [client] = (await api.get(f"{base}/clients", headers=admin)).json()["items"]
    assert client["registration"] == "cimd" and client["metadata_host"] == "claude.ai" and client["client_type"] == "public"
    enc = CLAUDE_CODE  # client_id = URL : routes en {client_id:path}
    assert (await api.post(f"{base}/clients/{enc}/redirect-uris", headers=admin,
                           json={"redirect_uri": "http://127.0.0.1/x"})).status_code == 400
    assert (await api.post(f"{base}/clients/{enc}/rotate-secret", headers=admin)).status_code == 400
    r = await api.put(f"{base}/clients/{enc}/scopes", headers=admin, json={"allowed_scopes": ["watch:read", "opportunities:write"]})
    assert r.status_code == 200 and r.json()["client"]["allowed_scopes"] == ["watch:read", "opportunities:write"]
    # Désactivation : connexions révoquées, plus aucune récupération du document
    calls = len(web.calls)
    r = await api.put(f"{base}/clients/{enc}/active", headers=admin, json={"active": False})
    assert r.status_code == 200 and r.json()["revoked_grants"] == 1
    assert (await mcp(api, LIST, tokens["access_token"])).status_code == 401
    assert (await authorize(api, CLAUDE_CODE, "http://localhost:3118/callback"))[0].status_code == 400
    assert len(web.calls) == calls


async def test_manual_clients_keep_p1_p2_rules(api, db, web):
    """Non-régression : localhost reste interdit aux clients publics manuels ; confidentiels inchangés."""
    await allow(db)
    pub = await svc.create_client(db, "Local", ["http://127.0.0.1/callback"], client_type="public")
    r, _ = await authorize(api, pub["client_id"], "http://localhost:5000/callback")
    assert r.status_code == 400
    with pytest.raises(ValueError):
        await svc.create_client(db, "Local2", ["http://localhost/callback"], client_type="public")
    conf = await svc.create_client(db, "ChatGPT", [svc.CHATGPT_DEFAULT_REDIRECT])
    assert (await authorize(api, conf["client_id"], svc.CHATGPT_DEFAULT_REDIRECT))[0].status_code == 302
    assert web.calls == []  # aucun accès réseau pour les clients jt_oc_


# ============================================
# Validation finale P3 : politique, cache, consentement, désactivation, scopes
# ============================================

async def refresh(api, client_id, refresh_token):
    return await api.post("/api/oauth/token", data={"grant_type": "refresh_token", "refresh_token": refresh_token,
                                                    "client_id": client_id})


@pytest.mark.parametrize("change", ["disable_policy", "remove_host"])
async def test_existing_tokens_survive_policy_changes_but_new_authorizations_do_not(api, db, web, change):
    """Choix documenté : la politique gouverne les NOUVELLES autorisations ; couper l'existant =
    désactiver le client. Le cache ne permet aucune nouvelle autorisation."""
    await enable_watch(db, api)
    await allow(db)
    tokens = await connect(api, CLAUDE_CODE, "http://localhost:3118/callback")
    calls = len(web.calls)
    if change == "disable_policy":
        await allow(db, enabled=False)
    else:
        await allow(db, hosts=["chatgpt.com", "vscode.dev"])
    assert (await mcp(api, LIST, tokens["access_token"])).status_code == 200
    assert (await refresh(api, CLAUDE_CODE, tokens["refresh_token"])).status_code == 200
    stored = await db.oauth_clients.find_one({"client_id": CLAUDE_CODE})
    assert svc._aware(stored["metadata_cached_until"]) > datetime.now(timezone.utc)  # cache encore frais
    rr, _ = await authorize(api, CLAUDE_CODE, "http://localhost:3118/callback")
    assert rr.status_code == 400 and rr.json()["error"] == "invalid_client"
    assert len(web.calls) == calls  # refus sans réseau
    if change == "disable_policy":
        assert (await discovery(api))["client_id_metadata_document_supported"] is False


async def test_authorization_in_progress_when_host_is_removed(api, db, web):
    await enable_watch(db, api)
    await allow(db)
    redirect = "http://localhost:3118/callback"
    # 1. Page de consentement ouverte, domaine retiré, puis approbation : refus, rien de créé
    r, _ = await authorize(api, CLAUDE_CODE, redirect)
    request_id = qs(r.headers["location"])["request"]
    await allow(db, hosts=["vscode.dev"])
    final = qs(await consent_redirect(api, request_id, True))
    assert final.get("error") == "access_denied" and "code" not in final
    assert await db.oauth_clients.count_documents({}) == 0
    # 2. Code émis, domaine retiré avant l'échange : refus, aucune autorisation créée
    await allow(db)
    r, verifier = await authorize(api, CLAUDE_CODE, redirect)
    code = qs(await consent_redirect(api, qs(r.headers["location"])["request"], True))["code"]
    await allow(db, hosts=["vscode.dev"])
    tok = await api.post("/api/oauth/token", data={"grant_type": "authorization_code", "code": code,
                                                   "code_verifier": verifier, "redirect_uri": redirect,
                                                   "resource": RESOURCE, "client_id": CLAUDE_CODE})
    assert tok.status_code == 400 and tok.json()["error"] == "invalid_grant"
    assert await db.oauth_grants.count_documents({}) == 0


async def test_client_is_created_only_after_approved_consent(api, db, web):
    await enable_watch(db, api)
    await allow(db)
    redirect = "http://localhost:3118/callback"
    r, _ = await authorize(api, CLAUDE_CODE, redirect)
    assert r.status_code == 302 and await db.oauth_clients.count_documents({}) == 0
    denied = qs(await consent_redirect(api, qs(r.headers["location"])["request"], False))
    assert denied.get("error") == "access_denied" and await db.oauth_clients.count_documents({}) == 0
    await enable_watch(db, api, enabled=False)
    r, _ = await authorize(api, CLAUDE_CODE, redirect)
    assert qs(await consent_redirect(api, qs(r.headers["location"])["request"], True)).get("error") == "access_denied"
    assert await db.oauth_clients.count_documents({}) == 0
    await enable_watch(db, api)
    await connect(api, CLAUDE_CODE, redirect)
    stored = await db.oauth_clients.find_one({"client_id": CLAUDE_CODE})
    assert stored["registration"] == "cimd" and stored["allowed_scopes"] == ["watch:read"] and stored["active"] is True


async def test_deactivated_cimd_client_is_cut_everywhere(api, db, web):
    await enable_watch(db, api)
    await allow(db)
    tokens = await connect(api, CLAUDE_CODE, "http://localhost:3118/callback")
    assert await svc.deactivate_client(db, CLAUDE_CODE) == 1
    assert (await mcp(api, LIST, tokens["access_token"])).status_code == 401
    assert (await refresh(api, CLAUDE_CODE, tokens["refresh_token"])).status_code == 401
    assert (await authorize(api, CLAUDE_CODE, "http://localhost:3118/callback"))[0].status_code == 400
    # Demande ouverte AVANT la désactivation, approuvée APRÈS : refusée
    await svc.activate_client(db, CLAUDE_CODE)
    r, _ = await authorize(api, CLAUDE_CODE, "http://localhost:3118/callback")
    await svc.deactivate_client(db, CLAUDE_CODE)
    final = qs(await consent_redirect(api, qs(r.headers["location"])["request"], True))
    assert final.get("error") == "access_denied" and "code" not in final


async def test_effective_scopes_bound_to_client_grant_and_user(api, db, web):
    await enable_watch(db, api)
    await allow(db)
    redirect = "http://localhost:3118/callback"
    write = {"jsonrpc": "2.0", "id": 2, "method": "tools/call",
             "params": {"name": "report_watch_run", "arguments": {"run_id": "x", "status": "completed"}}}
    r, verifier = await authorize(api, CLAUDE_CODE, redirect, scope="watch:read opportunities:write")
    code = qs(await consent_redirect(api, qs(r.headers["location"])["request"], True))["code"]
    tokens = (await api.post("/api/oauth/token", data={"grant_type": "authorization_code", "code": code,
                                                       "code_verifier": verifier, "redirect_uri": redirect,
                                                       "resource": RESOURCE, "client_id": CLAUDE_CODE})).json()
    assert tokens["scope"] == "watch:read"
    assert (await mcp(api, write, tokens["access_token"])).status_code == 403
    await svc.set_client_scopes(db, CLAUDE_CODE, ["watch:read", "opportunities:write"])
    assert (await mcp(api, write, tokens["access_token"])).status_code == 403  # autorisation non étendue
    await db.oauth_clients.update_one({"client_id": CLAUDE_CODE},
                                      {"$set": {"metadata_cached_until": datetime.now(timezone.utc) - timedelta(seconds=1)}})
    assert (await authorize(api, CLAUDE_CODE, redirect))[0].status_code == 302
    stored = await db.oauth_clients.find_one({"client_id": CLAUDE_CODE})
    assert stored["allowed_scopes"] == ["watch:read", "opportunities:write"]  # document relu : scopes intacts
    await enable_watch(db, api, enabled=False)
    assert (await mcp(api, LIST, tokens["access_token"])).status_code == 401
