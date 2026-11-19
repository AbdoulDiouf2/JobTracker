"""
P4 — Dynamic Client Registration RFC 7591 : politique, observation, validation,
flux OAuth public avec PKCE et administration.
"""

import secrets
from datetime import datetime, timedelta, timezone

import pytest

from config import settings
from services import dcr_service, oauth_service as svc
from utils import mcp_transport
from utils.auth import create_access_token
from test_oauth import HOST, ISSUER, LIST, RESOURCE, authorize_params, consent_redirect, mcp, pkce, qs

pytestmark = pytest.mark.anyio

CALLBACK = "https://callback.composio.example/oauth/callback"
ALL_SCOPES = list(svc.SUPPORTED_SCOPES)


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
    await db.users.insert_one({
        "id": admin_id, "email": "admin@test.local", "is_active": True, "role": "admin",
    })
    return {"Authorization": f"Bearer {create_access_token({'sub': admin_id})}"}


def registration(**over):
    return {
        "client_name": "Composio",
        "redirect_uris": [CALLBACK],
        "token_endpoint_auth_method": "none",
        "grant_types": ["authorization_code", "refresh_token"],
        "response_types": ["code"],
        **over,
    }


async def policy(db, *, enabled=False, observation=False, hosts=None, scopes=None):
    return await dcr_service.set_policy(
        db, enabled, observation, hosts or [], scopes or ALL_SCOPES, "tests")


async def discovery(api):
    return (await api.get("/.well-known/oauth-authorization-server")).json()


async def register(api, body=None):
    return await api.post("/api/oauth/register", json=body or registration())


async def test_dcr_not_advertised_and_refused_by_default(api):
    assert "registration_endpoint" not in await discovery(api)
    response = await register(api)
    assert response.status_code == 503
    assert response.json()["error"] == "temporarily_unavailable"


async def test_observation_advertises_but_refuses_and_records_only_host(api, db, admin):
    await policy(db, observation=True)
    meta = await discovery(api)
    assert meta["registration_endpoint"] == f"{ISSUER}/api/oauth/register"
    response = await register(api)
    assert response.status_code == 400
    assert response.json()["error"] == "invalid_client_metadata"
    assert await db.oauth_clients.count_documents({}) == 0

    view = (await api.get("/api/admin/oauth/dcr-policy", headers=admin)).json()
    assert view["advertised"] is True and view["operational"] is False
    assert view["observed_hosts"][0]["host"] == "callback.composio.example"
    observation = await db[dcr_service.OBSERVATIONS].find_one({})
    assert observation["host"] == "callback.composio.example"
    assert CALLBACK not in str(observation)


async def test_observation_records_safe_host_before_rejecting_other_metadata(api, db):
    await policy(db, observation=True)
    response = await register(api, registration(
        token_endpoint_auth_method="client_secret_basic",
        software_statement="untrusted",
    ))
    assert response.status_code == 400
    assert response.json()["error"] == "invalid_client_metadata"
    assert await db.oauth_clients.count_documents({}) == 0
    observation = await db[dcr_service.OBSERVATIONS].find_one({})
    assert set(observation) >= {"host", "count", "first_seen_at", "last_seen_at", "expires_at"}
    assert observation["host"] == "callback.composio.example"
    assert CALLBACK not in str(observation)
    assert "client_secret_basic" not in str(observation)
    assert "untrusted" not in str(observation)


@pytest.mark.parametrize("redirect_uris", [
    ["http://callback.composio.example/oauth/callback"],
    ["https://Callback.Composio.Example/oauth/callback"],
    ["https://*.composio.example/oauth/callback"],
])
async def test_observation_never_records_unsafe_or_noncanonical_host(api, db, redirect_uris):
    await policy(db, observation=True)
    response = await register(api, registration(redirect_uris=redirect_uris))
    assert response.status_code == 400
    assert await db[dcr_service.OBSERVATIONS].count_documents({}) == 0


async def test_admin_policy_requires_exact_lowercase_host_and_exclusive_modes(api, admin):
    base = "/api/admin/oauth/dcr-policy"
    initial = (await api.get(base, headers=admin)).json()
    assert initial["enabled"] is False and initial["observation_mode"] is False
    assert initial["default_scopes"] == ALL_SCOPES

    for payload in (
        {"enabled": True, "observation_mode": True, "allowed_redirect_hosts": ["callback.composio.example"],
         "default_scopes": ALL_SCOPES},
        {"enabled": True, "observation_mode": False, "allowed_redirect_hosts": [],
         "default_scopes": ALL_SCOPES},
        {"enabled": True, "observation_mode": False, "allowed_redirect_hosts": ["Callback.Composio.Example"],
         "default_scopes": ALL_SCOPES},
        {"enabled": True, "observation_mode": False, "allowed_redirect_hosts": ["*.composio.example"],
         "default_scopes": ALL_SCOPES},
    ):
        assert (await api.put(base, headers=admin, json=payload)).status_code == 400

    ok = await api.put(base, headers=admin, json={
        "enabled": True, "observation_mode": False,
        "allowed_redirect_hosts": ["callback.composio.example"],
        "default_scopes": ALL_SCOPES,
    })
    assert ok.status_code == 200 and ok.json()["operational"] is True


@pytest.mark.parametrize("change, error", [
    ({"client_name": "<script>"}, "invalid_client_metadata"),
    ({"redirect_uris": []}, "invalid_client_metadata"),
    ({"redirect_uris": ["http://callback.composio.example/x"]}, "invalid_redirect_uri"),
    ({"redirect_uris": ["https://evil.example/x"]}, "invalid_redirect_uri"),
    ({"token_endpoint_auth_method": "private_key_jwt"}, "invalid_client_metadata"),
    ({"grant_types": ["client_credentials"]}, "invalid_client_metadata"),
    ({"response_types": ["token"]}, "invalid_client_metadata"),
    ({"software_statement": "x"}, "invalid_client_metadata"),
])
async def test_invalid_or_untrusted_metadata_is_refused(api, db, change, error):
    await policy(db, enabled=True, hosts=["callback.composio.example"])
    response = await register(api, registration(**change))
    assert response.status_code == 400 and response.json()["error"] == error
    assert await db.oauth_clients.count_documents({}) == 0


async def test_register_is_public_scope_bounded_and_idempotent_while_pending(api, db):
    await policy(db, enabled=True, hosts=["callback.composio.example"])
    first = await register(api)
    second = await register(api)
    assert first.status_code == second.status_code == 201
    assert first.json()["client_id"] == second.json()["client_id"]
    assert "client_secret" not in first.json()
    assert first.json()["token_endpoint_auth_method"] == "none"
    assert first.json()["scope"].split() == ALL_SCOPES
    assert await db.oauth_clients.count_documents({"registration": "dcr"}) == 1
    stored = await db.oauth_clients.find_one({"client_id": first.json()["client_id"]})
    assert stored["client_type"] == "public" and stored["secret_hash"] is None
    assert svc._aware(stored["expires_at"]) > datetime.now(timezone.utc)


@pytest.mark.parametrize("requested_method", ["client_secret_basic", "client_secret_post"])
async def test_confidential_auth_request_is_normalized_to_public_client(api, db, requested_method):
    await policy(db, enabled=True, hosts=["callback.composio.example"])
    created = await register(api, registration(token_endpoint_auth_method=requested_method))
    assert created.status_code == 201
    assert created.json()["token_endpoint_auth_method"] == "none"
    assert "client_secret" not in created.json()
    stored = await db.oauth_clients.find_one({"client_id": created.json()["client_id"]})
    assert stored["client_type"] == "public"
    assert stored["secret_hash"] is None


async def test_full_authorization_pkce_token_and_mcp_flow(api, db):
    await policy(db, enabled=True, hosts=["callback.composio.example"])
    client_id = (await register(api)).json()["client_id"]
    verifier, challenge = pkce()
    auth = await api.get("/api/oauth/authorize", params=authorize_params(
        {"client_id": client_id}, challenge, redirect_uri=CALLBACK, scope=" ".join(ALL_SCOPES)))
    assert auth.status_code == 302
    request_id = qs(auth.headers["location"])["request"]
    consent = await consent_redirect(api, request_id, True, "a")
    code = qs(consent)["code"]
    stored = await db.oauth_clients.find_one({"client_id": client_id})
    assert "expires_at" not in stored and stored["dcr"]["first_grant_at"] is not None

    token = await api.post("/api/oauth/token", data={
        "grant_type": "authorization_code", "code": code, "code_verifier": verifier,
        "redirect_uri": CALLBACK, "resource": RESOURCE, "client_id": client_id,
    })
    assert token.status_code == 200 and token.json()["scope"].split() == ALL_SCOPES
    assert (await mcp(api, LIST, token.json()["access_token"])).status_code == 200


async def test_expired_pending_client_and_removed_host_cannot_authorize(api, db):
    await policy(db, enabled=True, hosts=["callback.composio.example"])
    client_id = (await register(api)).json()["client_id"]
    await db.oauth_clients.update_one(
        {"client_id": client_id},
        {"$set": {"expires_at": datetime.now(timezone.utc) - timedelta(seconds=1)}})
    _, challenge = pkce()
    response = await api.get("/api/oauth/authorize", params=authorize_params(
        {"client_id": client_id}, challenge, redirect_uri=CALLBACK))
    assert response.status_code == 400 and response.json()["error"] == "invalid_client"


async def test_content_type_size_and_persistent_rate_limit(api, db):
    await policy(db, enabled=True, hosts=["callback.composio.example"])
    wrong = await api.post("/api/oauth/register", content="{}", headers={"Content-Type": "text/plain"})
    assert wrong.status_code == 400
    huge = await api.post(
        "/api/oauth/register", content=b"{" + b" " * dcr_service.MAX_BODY_BYTES + b"}",
        headers={"Content-Type": "application/json"})
    assert huge.status_code == 400

    await db[dcr_service.ATTEMPTS].delete_many({})
    for _ in range(dcr_service.RATE_LIMIT_PER_HOUR):
        await dcr_service.check_rate_limit(db, "203.0.113.1")
    with pytest.raises(dcr_service.DcrError) as limited:
        await dcr_service.check_rate_limit(db, "203.0.113.1")
    assert limited.value.status_code == 429 and limited.value.error == "temporarily_unavailable"
    # Une autre source pseudonymisée possède son propre quota.
    await dcr_service.check_rate_limit(db, "203.0.113.2")
