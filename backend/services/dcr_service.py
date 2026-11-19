"""
Dynamic Client Registration (RFC 7591) pour le connecteur MCP.

Profil volontairement réduit : clients publics uniquement, Authorization Code + PKCE S256,
URI HTTPS exactes, scopes imposés par la politique administrateur. Le mode observation
enregistre seulement les hôtes de retour validés puis refuse l'inscription.
"""

import hashlib
import hmac
import json
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import List
from urllib.parse import urlsplit

from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from config import settings

logger = logging.getLogger("jobtracker.oauth.dcr")

POLICY_KEY = "oauth_dcr_policy"
ATTEMPTS = "oauth_dcr_attempts"
OBSERVATIONS = "oauth_dcr_observations"
REGISTRATION = "dcr"
MAX_ALLOWED_HOSTS = 20
MAX_BODY_BYTES = 16 * 1024
PENDING_TTL_HOURS = 24
RATE_LIMIT_PER_HOUR = 10
UNSUPPORTED_METADATA = {
    "software_statement", "jwks", "jwks_uri", "request_uris",
    "client_secret", "client_secret_expires_at",
}


class DcrError(Exception):
    def __init__(self, error: str, description: str, status_code: int = 400):
        super().__init__(error)
        self.error = error
        self.description = description
        self.status_code = status_code


def _now() -> datetime:
    return datetime.now(timezone.utc)


def default_policy() -> dict:
    return {
        "enabled": False,
        "observation_mode": False,
        "allowed_redirect_hosts": [],
        "default_scopes": [
            "watch:read", "opportunities:write", "applications:read",
            "applications:write", "interviews:read", "interviews:write",
        ],
    }


async def get_policy(db) -> dict:
    doc = await db.platform_settings.find_one({"key": POLICY_KEY}, {"_id": 0, "value": 1})
    policy = {**default_policy(), **((doc or {}).get("value") or {})}
    policy["enabled"] = policy.get("enabled") is True
    policy["observation_mode"] = policy.get("observation_mode") is True
    return policy


async def set_policy(db, enabled: bool, observation_mode: bool, allowed_hosts: List[str],
                     default_scopes: List[str], admin_id: str) -> dict:
    from services.cimd_service import validate_host
    from services.oauth_service import validate_allowed_scopes

    hosts = list(dict.fromkeys(validate_host(h) for h in allowed_hosts))
    if len(hosts) > MAX_ALLOWED_HOSTS:
        raise ValueError(f"{MAX_ALLOWED_HOSTS} hôtes au plus")
    if enabled and observation_mode:
        raise ValueError("les modes actif et observation sont mutuellement exclusifs")
    if enabled and not hosts:
        raise ValueError("au moins un hôte de retour est requis pour activer DCR")
    scopes = validate_allowed_scopes(default_scopes)
    value = {
        "enabled": bool(enabled),
        "observation_mode": bool(observation_mode),
        "allowed_redirect_hosts": hosts,
        "default_scopes": scopes,
    }
    await db.platform_settings.update_one(
        {"key": POLICY_KEY},
        {"$set": {
            "key": POLICY_KEY, "value": value, "updated_at": _now().isoformat(),
            "updated_by": admin_id,
        }},
        upsert=True,
    )
    logger.warning(
        "oauth_dcr_policy admin_id=%s enabled=%s observation=%s hosts=%s scopes=%s",
        admin_id, enabled, observation_mode, ",".join(hosts), ",".join(scopes),
    )
    return value


def operational(policy: dict) -> bool:
    return policy.get("enabled") is True and bool(policy.get("allowed_redirect_hosts"))


def advertised(policy: dict) -> bool:
    """En observation l'endpoint est annoncé, mais aucune inscription n'est créée."""
    return operational(policy) or policy.get("observation_mode") is True


def _string_list(value, field: str, required: bool = True) -> List[str]:
    if value is None and not required:
        return []
    if not isinstance(value, list) or (required and not value) or any(not isinstance(v, str) for v in value):
        raise DcrError("invalid_client_metadata", f"{field} invalide")
    return list(dict.fromkeys(value))


def validate_redirect_metadata(body) -> dict:
    from services.oauth_service import MAX_REDIRECT_URIS, validate_redirect_uri

    if not isinstance(body, dict):
        raise DcrError("invalid_client_metadata", "objet JSON attendu")
    try:
        raw_uris = _string_list(body.get("redirect_uris"), "redirect_uris")
        if len(raw_uris) > MAX_REDIRECT_URIS:
            raise ValueError(f"{MAX_REDIRECT_URIS} redirect_uri au plus")
        uris = [validate_redirect_uri(uri) for uri in raw_uris]
    except ValueError as exc:
        raise DcrError("invalid_redirect_uri", str(exc))
    return {
        "redirect_uris": uris,
        "redirect_hosts": list(dict.fromkeys(urlsplit(uri).hostname for uri in uris)),
    }


def validate_metadata(body) -> dict:
    from services.oauth_service import validate_client_name

    redirects = validate_redirect_metadata(body)
    if any(k in body for k in UNSUPPORTED_METADATA):
        raise DcrError("invalid_client_metadata", "métadonnée client non prise en charge")
    # RFC 7591 rend client_name facultatif. Le callback exact reste l'identité de confiance
    # affichée au consentement ; le nom déclaré n'est jamais une preuve.
    try:
        name = validate_client_name(body.get("client_name", "Client DCR"))
    except ValueError as exc:
        raise DcrError("invalid_client_metadata", str(exc))

    auth_method = body.get("token_endpoint_auth_method", "none")
    if auth_method != "none":
        raise DcrError("invalid_client_metadata", "seuls les clients publics sont acceptés")
    grants = _string_list(body.get("grant_types", ["authorization_code", "refresh_token"]), "grant_types")
    if "authorization_code" not in grants or any(g not in ("authorization_code", "refresh_token") for g in grants):
        raise DcrError("invalid_client_metadata", "grant_types non pris en charge")
    responses = _string_list(body.get("response_types", ["code"]), "response_types")
    if responses != ["code"]:
        raise DcrError("invalid_client_metadata", "response_types doit contenir uniquement code")
    return {
        "client_name": name,
        **redirects,
        "token_endpoint_auth_method": "none",
        "grant_types": grants,
        "response_types": responses,
    }


async def _observe(db, hosts: List[str]) -> None:
    now = _now()
    for host in hosts:
        update = {
            "$set": {"last_seen_at": now, "expires_at": now + timedelta(days=30)},
            "$setOnInsert": {"first_seen_at": now},
            "$inc": {"count": 1},
        }
        try:
            await db[OBSERVATIONS].update_one({"host": host}, update, upsert=True)
        except DuplicateKeyError:
            await db[OBSERVATIONS].update_one(
                {"host": host},
                {"$set": {"last_seen_at": now, "expires_at": now + timedelta(days=30)},
                 "$inc": {"count": 1}},
            )
    logger.info("oauth_dcr_observation hosts=%s", ",".join(hosts))


def _source_hash(source: str) -> str:
    return hmac.new(settings.SECRET_KEY.encode("utf-8"), source.encode("utf-8"), hashlib.sha256).hexdigest()


async def check_rate_limit(db, source: str) -> None:
    now = _now()
    bucket = now.replace(minute=0, second=0, microsecond=0)
    key = _source_hash(source or "unknown")
    query = {"source_hash": key, "bucket": bucket}
    update = {
        "$inc": {"count": 1},
        "$setOnInsert": {"expires_at": bucket + timedelta(hours=2)},
    }
    try:
        doc = await db[ATTEMPTS].find_one_and_update(
            query, update, upsert=True, return_document=ReturnDocument.AFTER)
    except DuplicateKeyError:
        # Deux premières requêtes concurrentes peuvent tenter le même upsert.
        doc = await db[ATTEMPTS].find_one_and_update(
            query, {"$inc": {"count": 1}}, return_document=ReturnDocument.AFTER)
    if (doc or {}).get("count", RATE_LIMIT_PER_HOUR + 1) > RATE_LIMIT_PER_HOUR:
        raise DcrError("temporarily_unavailable", "limite d'inscription atteinte", 429)


def _fingerprint(metadata: dict) -> str:
    canonical = json.dumps(metadata, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


async def register(db, body, source: str) -> dict:
    from services import oauth_service

    await oauth_service.ensure_indexes(db)
    policy = await get_policy(db)
    if not advertised(policy):
        raise DcrError("temporarily_unavailable", "enregistrement dynamique désactivé", 503)
    await check_rate_limit(db, source)

    if policy.get("observation_mode") is True:
        # L'observation sert à découvrir le callback réel d'un client tiers. Une métadonnée
        # annexe incompatible ne doit pas empêcher cette découverte : seules les redirect_uris
        # sont validées ici, et seul leur hôte HTTPS normalisé est conservé.
        redirects = validate_redirect_metadata(body)
        await _observe(db, redirects["redirect_hosts"])
        try:
            validate_metadata(body)
        except DcrError as err:
            logger.info("oauth_dcr_observation metadata_result=%s", err.error)
        raise DcrError(
            "invalid_client_metadata",
            "hôte de retour observé mais non encore approuvé par l'administrateur",
        )
    metadata = validate_metadata(body)
    if any(host not in policy["allowed_redirect_hosts"] for host in metadata["redirect_hosts"]):
        logger.info("oauth_dcr_register result=host_refused hosts=%s", ",".join(metadata["redirect_hosts"]))
        raise DcrError("invalid_redirect_uri", "hôte de retour non approuvé")

    scopes = oauth_service.validate_allowed_scopes(policy["default_scopes"])
    fingerprint = _fingerprint(metadata)
    now = _now()
    existing = await db[oauth_service.CLIENTS].find_one({
        "registration": REGISTRATION,
        "dcr.request_fingerprint": fingerprint,
        "active": True,
        "expires_at": {"$gt": now},
    }, {"_id": 0})
    if existing:
        return response(existing)

    client = {
        "client_id": oauth_service.CLIENT_PREFIX + secrets.token_urlsafe(16),
        "name": metadata["client_name"],
        "client_type": oauth_service.PUBLIC,
        "allowed_scopes": scopes,
        "secret_hash": None,
        "redirect_uris": metadata["redirect_uris"],
        "active": True,
        "registration": REGISTRATION,
        "created_at": now,
        "expires_at": now + timedelta(hours=PENDING_TTL_HOURS),
        "secret_rotated_at": None,
        "dcr": {
            "redirect_hosts": metadata["redirect_hosts"],
            "request_fingerprint": fingerprint,
            "first_grant_at": None,
        },
    }
    await db[oauth_service.CLIENTS].insert_one(client)
    logger.info("oauth_dcr_register result=created client_id=%s hosts=%s",
                client["client_id"], ",".join(metadata["redirect_hosts"]))
    return response(client)


def response(client: dict) -> dict:
    issued = client.get("created_at") or _now()
    return {
        "client_id": client["client_id"],
        "client_id_issued_at": int(issued.timestamp()),
        "client_name": client["name"],
        "redirect_uris": list(client["redirect_uris"]),
        "token_endpoint_auth_method": "none",
        "grant_types": ["authorization_code", "refresh_token"],
        "response_types": ["code"],
        "scope": " ".join(client["allowed_scopes"]),
    }


async def client_allowed(db, client: dict) -> bool:
    if client.get("registration") != REGISTRATION:
        return True
    policy = await get_policy(db)
    hosts = (client.get("dcr") or {}).get("redirect_hosts") or []
    return operational(policy) and bool(hosts) and all(h in policy["allowed_redirect_hosts"] for h in hosts)


async def mark_consented(db, client_id: str) -> None:
    from services.oauth_service import CLIENTS
    await db[CLIENTS].update_one(
        {"client_id": client_id, "registration": REGISTRATION},
        {"$set": {"dcr.first_grant_at": _now()}, "$unset": {"expires_at": ""}},
    )


async def list_observed_hosts(db) -> List[dict]:
    return [
        {
            "host": item["host"],
            "count": item.get("count", 0),
            "first_seen_at": item.get("first_seen_at"),
            "last_seen_at": item.get("last_seen_at"),
        }
        async for item in db[OBSERVATIONS].find(
            {}, {"_id": 0, "host": 1, "count": 1, "first_seen_at": 1, "last_seen_at": 1}
        ).sort("last_seen_at", -1).limit(50)
    ]
