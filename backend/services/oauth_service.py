"""
JobTracker SaaS - Serveur d'autorisation OAuth 2.1 du connecteur MCP (Lot 2, étape 3)

Spécification Lot 2, §3 :
- client PRÉ-ENREGISTRÉ (D1, option A) : client_id + client_secret haché ; liste blanche
  EXACTE des redirect_uri ;
- code d'autorisation + PKCE S256 obligatoire ; paramètre `resource` (RFC 8707) lié au jeton ;
  `iss` dans la redirection (RFC 9207) ;
- jetons OPAQUES (jt_oat_ / jt_ort_), seuls leurs hachés SHA-256 sont stockés ; révocation
  immédiate ; rotation du refresh token, réutilisation détectée -> famille révoquée ;
- accès limité au propriétaire : compte actif ET `watch_enabled` (D7), vérifié au
  consentement, à l'émission et à CHAQUE validation.

Tout l'état est en base (serverless) : aucune session en mémoire.
"""

import base64
import hashlib
import hmac
import logging
import re
import secrets
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pymongo import ReturnDocument

from config import settings

logger = logging.getLogger("jobtracker.oauth")

CLIENTS = "oauth_clients"
REQUESTS = "oauth_requests"
CODES = "oauth_codes"
GRANTS = "oauth_grants"
TOKENS = "oauth_tokens"

SUPPORTED_SCOPES = ("watch:read", "opportunities:write")
SCOPE_DESCRIPTIONS = {
    "watch:read": "Lire tes critères de veille, l'état du service et un résumé de tes opportunités récentes",
    "opportunities:write": "Ajouter de nouvelles opportunités (statut « nouveau ») et le compte-rendu de chaque veille",
}
ACCESS_PREFIX = "jt_oat_"
REFRESH_PREFIX = "jt_ort_"
CLIENT_PREFIX = "jt_oc_"
CLIENT_SECRET_PREFIX = "jt_ocs_"
CHATGPT_DEFAULT_REDIRECT = "https://chatgpt.com/connector_platform_oauth_redirect"
# Statuts de grant (spécification §3.7)
ACTIVE, EXPIRED_OBSERVED = "active", "access_expired_observed"
RECONNECTION, REVOKED, COMPROMISED, SUPERSEDED = "reconnection_required", "revoked", "compromised", "superseded"
USABLE_STATUSES = (ACTIVE, EXPIRED_OBSERVED)
REFRESH_NOT_OBSERVED_AFTER = timedelta(minutes=15)

_CHALLENGE_RE = re.compile(r"^[A-Za-z0-9_-]{43,128}$")
_VERIFIER_RE = re.compile(r"^[A-Za-z0-9._~-]{43,128}$")
_STATE_MAX = 512

_indexed_dbs: set = set()


class OAuthError(Exception):
    """Erreur OAuth normalisée (RFC 6749 §5.2 / §4.1.2.1). `redirectable` : l'erreur peut être
    renvoyée au client par redirection (redirect_uri déjà validée)."""

    def __init__(self, error: str, description: str = "", status_code: int = 400, redirectable: bool = False):
        super().__init__(error)
        self.error = error
        self.description = description
        self.status_code = status_code
        self.redirectable = redirectable


@dataclass(frozen=True)
class Principal:
    """Identité vérifiée d'un appel MCP : user_id vient TOUJOURS du grant."""
    user_id: str
    grant_id: str
    client_id: str
    scopes: tuple


# ============================================
# OUTILS
# ============================================

def _now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


def hash_secret(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def issuer() -> str:
    return settings.OAUTH_ISSUER


def canonical_resource() -> str:
    return f"{settings.OAUTH_ISSUER}/api/mcp"


def resource_metadata_url() -> str:
    return f"{settings.OAUTH_ISSUER}/.well-known/oauth-protected-resource/api/mcp"


def protected_resource_metadata() -> dict:
    return {
        "resource": canonical_resource(),
        "authorization_servers": [issuer()],
        "scopes_supported": list(SUPPORTED_SCOPES),
        "bearer_methods_supported": ["header"],
        "resource_name": "JobTracker",
    }


def authorization_server_metadata() -> dict:
    base = issuer()
    return {
        "issuer": base,
        "authorization_endpoint": f"{base}/api/oauth/authorize",
        "token_endpoint": f"{base}/api/oauth/token",
        "revocation_endpoint": f"{base}/api/oauth/revoke",
        "response_types_supported": ["code"],
        "grant_types_supported": ["authorization_code", "refresh_token"],
        "code_challenge_methods_supported": ["S256"],
        "token_endpoint_auth_methods_supported": ["client_secret_post", "client_secret_basic"],
        "revocation_endpoint_auth_methods_supported": ["client_secret_post", "client_secret_basic"],
        "scopes_supported": list(SUPPORTED_SCOPES),
        "authorization_response_iss_parameter_supported": True,
        "client_id_metadata_document_supported": False,
    }


def parse_scopes(raw: Optional[str]) -> List[str]:
    """Scopes demandés ; absents -> tous les scopes supportés. Inconnu -> invalid_scope."""
    if raw is None or not raw.strip():
        return list(SUPPORTED_SCOPES)
    scopes = []
    for s in raw.split():
        if s not in SUPPORTED_SCOPES:
            raise OAuthError("invalid_scope", "Scope inconnu", redirectable=True)
        if s not in scopes:
            scopes.append(s)
    return scopes


def pkce_s256(verifier: str) -> str:
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")


def add_query(url: str, params: dict) -> str:
    parts = urlsplit(url)
    query = parse_qsl(parts.query, keep_blank_values=True) + [(k, v) for k, v in params.items() if v is not None]
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


async def ensure_indexes(db) -> None:
    key = (id(db.client), db.name)
    if key in _indexed_dbs:
        return
    await db[CLIENTS].create_index("client_id", unique=True, name="oauth_client_unique")
    await db[REQUESTS].create_index("id", unique=True, name="oauth_request_unique")
    await db[REQUESTS].create_index("expires_at", expireAfterSeconds=0, name="oauth_request_ttl")
    await db[CODES].create_index("code_hash", unique=True, name="oauth_code_unique")
    await db[CODES].create_index("expires_at", expireAfterSeconds=3600, name="oauth_code_ttl")
    await db[GRANTS].create_index("id", unique=True, name="oauth_grant_unique")
    await db[GRANTS].create_index([("user_id", 1), ("client_id", 1), ("status", 1)], name="oauth_grant_user")
    await db[TOKENS].create_index("token_hash", unique=True, name="oauth_token_unique")
    await db[TOKENS].create_index("grant_id", name="oauth_token_grant")
    # Conservés jusqu'à leur expiration : nécessaire pour détecter une réutilisation
    await db[TOKENS].create_index("expires_at", expireAfterSeconds=86400, name="oauth_token_ttl")
    _indexed_dbs.add(key)


async def user_is_eligible(db, user_id: str) -> bool:
    """MVP propriétaire uniquement : compte actif ET veille activée par l'admin (D7)."""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "is_active": 1, "watch_enabled": 1})
    return bool(user) and user.get("is_active", True) and user.get("watch_enabled") is True


# ============================================
# CLIENTS (pré-enregistrés, D1)
# ============================================

def _validate_redirect_uri(uri: str) -> str:
    uri = (uri or "").strip()
    parts = urlsplit(uri)
    local = parts.hostname in ("localhost", "127.0.0.1") and parts.scheme == "http"
    if (parts.scheme != "https" and not local) or not parts.hostname or parts.fragment or "*" in uri:
        raise ValueError("redirect_uri invalide : HTTPS exact, sans fragment ni joker")
    return uri


async def create_client(db, name: str, redirect_uris: List[str]) -> dict:
    """Crée un client confidentiel. Le secret brut n'est renvoyé QU'UNE fois."""
    await ensure_indexes(db)
    uris = [_validate_redirect_uri(u) for u in redirect_uris]
    if not uris:
        raise ValueError("au moins une redirect_uri est requise")
    client_id = CLIENT_PREFIX + secrets.token_urlsafe(16)
    secret = CLIENT_SECRET_PREFIX + secrets.token_urlsafe(32)
    await db[CLIENTS].insert_one({
        "client_id": client_id, "name": name.strip()[:100] or "ChatGPT", "secret_hash": hash_secret(secret),
        "redirect_uris": uris, "active": True, "created_at": _now(), "secret_rotated_at": _now(),
    })
    logger.info("oauth_client_created client_id=%s", client_id)
    return {"client_id": client_id, "client_secret": secret, "redirect_uris": uris}


async def rotate_client_secret(db, client_id: str) -> str:
    secret = CLIENT_SECRET_PREFIX + secrets.token_urlsafe(32)
    result = await db[CLIENTS].update_one(
        {"client_id": client_id}, {"$set": {"secret_hash": hash_secret(secret), "secret_rotated_at": _now()}})
    if result.matched_count == 0:
        raise ValueError("client inconnu")
    return secret


async def deactivate_client(db, client_id: str) -> int:
    """Désactive un client et révoque tous ses grants. Retourne le nombre de grants révoqués."""
    await db[CLIENTS].update_one({"client_id": client_id}, {"$set": {"active": False}})
    count = 0
    async for grant in db[GRANTS].find({"client_id": client_id, "status": {"$in": list(USABLE_STATUSES)}}, {"id": 1}):
        await revoke_grant(db, grant["id"], REVOKED, "client_deactivated")
        count += 1
    return count


async def get_active_client(db, client_id: Optional[str]) -> Optional[dict]:
    if not client_id or not isinstance(client_id, str) or len(client_id) > 100:
        return None
    return await db[CLIENTS].find_one({"client_id": client_id, "active": True}, {"_id": 0})


async def authenticate_client(db, client_id: Optional[str], client_secret: Optional[str]) -> dict:
    """client_secret_basic ou client_secret_post. Comparaison à temps constant."""
    client = await get_active_client(db, client_id)
    if not client or not client_secret:
        raise OAuthError("invalid_client", "Authentification du client refusée", status_code=401)
    if not hmac.compare_digest(client["secret_hash"], hash_secret(client_secret)):
        raise OAuthError("invalid_client", "Authentification du client refusée", status_code=401)
    return client


# ============================================
# AUTORISATION ET CONSENTEMENT
# ============================================

async def create_authorization_request(db, params: dict) -> dict:
    """
    Valide la requête /authorize. Erreurs non redirigeables (client ou redirect_uri invalides) :
    OAuthError(redirectable=False). Autres erreurs : redirectable=True.
    Retourne la demande enregistrée (10 min, usage unique).
    """
    await ensure_indexes(db)
    client = await get_active_client(db, params.get("client_id"))
    if not client:
        raise OAuthError("invalid_client", "Client inconnu")
    redirect_uri = params.get("redirect_uri")
    if not redirect_uri or redirect_uri not in client["redirect_uris"]:
        raise OAuthError("invalid_request", "redirect_uri non autorisée")

    if params.get("response_type") != "code":
        raise OAuthError("unsupported_response_type", "Seul response_type=code est accepté", redirectable=True)
    state = params.get("state")
    if state is not None and len(state) > _STATE_MAX:
        raise OAuthError("invalid_request", "state trop long", redirectable=True)
    if params.get("code_challenge_method") != "S256":
        raise OAuthError("invalid_request", "PKCE S256 obligatoire", redirectable=True)
    challenge = params.get("code_challenge") or ""
    if not _CHALLENGE_RE.fullmatch(challenge):
        raise OAuthError("invalid_request", "code_challenge invalide", redirectable=True)
    if params.get("resource") != canonical_resource():
        raise OAuthError("invalid_target", "resource absente ou différente de la ressource protégée", redirectable=True)
    scopes = parse_scopes(params.get("scope"))

    request = {
        "id": secrets.token_urlsafe(24),
        "client_id": client["client_id"], "client_name": client["name"],
        "redirect_uri": redirect_uri, "state": state, "code_challenge": challenge,
        "scopes": scopes, "resource": canonical_resource(),
        "created_at": _now(), "expires_at": _now() + timedelta(seconds=settings.OAUTH_REQUEST_TTL_SECONDS),
        "used_at": None,
    }
    await db[REQUESTS].insert_one(dict(request))
    return request


def error_redirect(redirect_uri: str, error: str, state: Optional[str], description: str = "") -> str:
    return add_query(redirect_uri, {"error": error, "error_description": description or None,
                                    "state": state, "iss": issuer()})


REQUEST_NOT_FOUND, REQUEST_EXPIRED, REQUEST_USED = "request_not_found", "request_expired", "request_already_used"
CONTINUE_TTL = timedelta(seconds=60)


async def get_request_state(db, request_id: str) -> tuple:
    """(demande, None) si utilisable, sinon (None, code) : introuvable, expirée ou déjà utilisée."""
    if not request_id or len(request_id) > 100:
        return None, REQUEST_NOT_FOUND
    req = await db[REQUESTS].find_one({"id": request_id}, {"_id": 0})
    if not req:
        return None, REQUEST_NOT_FOUND
    if req.get("used_at") is not None:
        return None, REQUEST_USED
    if _aware(req["expires_at"]) <= _now():
        return None, REQUEST_EXPIRED
    return req, None


async def get_pending_request(db, request_id: str) -> Optional[dict]:
    req, _ = await get_request_state(db, request_id)
    return req


async def decide(db, request_id: str, user_id: str, approve: bool) -> str:
    """
    Consentement de l'utilisateur connecté, usage unique (atomique). Ne renvoie PAS le code
    d'autorisation : seulement un ticket de continuation (60 s, usage unique). Le navigateur
    suit ensuite /api/oauth/continue, qui redirige directement vers le client : le code ne
    passe jamais par le JavaScript du frontend.
    """
    _, error = await get_request_state(db, request_id)
    if error:
        raise OAuthError(error, "Demande d'autorisation inutilisable", status_code=400)
    ticket = secrets.token_urlsafe(32)
    req = await db[REQUESTS].find_one_and_update(
        {"id": request_id, "used_at": None, "expires_at": {"$gt": _now()}},
        {"$set": {"used_at": _now(), "decided_by": user_id, "approved": bool(approve),
                  "ticket_hash": hash_secret(ticket), "ticket_expires_at": _now() + CONTINUE_TTL,
                  "ticket_used_at": None}},
        projection={"_id": 0}, return_document=ReturnDocument.AFTER,
    )
    if req is None:  # course entre deux décisions simultanées
        raise OAuthError(REQUEST_USED, "Demande d'autorisation déjà utilisée", status_code=400)
    logger.info("oauth_consent decision=%s user_id=%s client_id=%s",
                "approve" if approve else "deny", user_id, req["client_id"])
    return f"{issuer()}/api/oauth/continue?ticket={ticket}"


async def complete(db, ticket: str) -> str:
    """Consomme le ticket (atomique) et renvoie l'URL de retour vers le client : code
    d'autorisation si la demande est approuvée et le compte éligible, sinon access_denied."""
    if not ticket or len(ticket) > 100:
        raise OAuthError("invalid_request", "Ticket invalide")
    req = await db[REQUESTS].find_one_and_update(
        {"ticket_hash": hash_secret(ticket), "ticket_used_at": None, "ticket_expires_at": {"$gt": _now()}},
        {"$set": {"ticket_used_at": _now()}}, projection={"_id": 0}, return_document=ReturnDocument.AFTER,
    )
    if req is None:
        raise OAuthError("invalid_request", "Ticket inconnu, expiré ou déjà utilisé")
    user_id = req["decided_by"]
    if not req.get("approved"):
        return error_redirect(req["redirect_uri"], "access_denied", req.get("state"))
    if not await user_is_eligible(db, user_id):
        logger.info("oauth_consent result=not_eligible user_id=%s", user_id)
        return error_redirect(req["redirect_uri"], "access_denied", req.get("state"), "Compte non autorisé")

    code = secrets.token_urlsafe(32)
    await db[CODES].insert_one({
        "code_hash": hash_secret(code), "client_id": req["client_id"], "redirect_uri": req["redirect_uri"],
        "code_challenge": req["code_challenge"], "scopes": req["scopes"], "resource": req["resource"],
        "user_id": user_id, "request_id": req["id"], "created_at": _now(),
        "expires_at": _now() + timedelta(seconds=settings.OAUTH_CODE_TTL_SECONDS), "used_at": None, "grant_id": None,
    })
    logger.info("oauth_consent result=approved user_id=%s client_id=%s", user_id, req["client_id"])
    return add_query(req["redirect_uri"], {"code": code, "state": req.get("state"), "iss": issuer()})


# ============================================
# GRANTS ET JETONS
# ============================================

async def _issue_tokens(db, grant: dict) -> dict:
    now = _now()
    access = ACCESS_PREFIX + secrets.token_urlsafe(32)
    refresh = REFRESH_PREFIX + secrets.token_urlsafe(32)
    grant_end = _aware(grant["absolute_expires_at"])
    refresh_exp = min(now + timedelta(seconds=settings.OAUTH_REFRESH_TTL_SECONDS), grant_end)
    common = {"grant_id": grant["id"], "user_id": grant["user_id"], "client_id": grant["client_id"],
              "scopes": grant["scopes"], "aud": grant["resource"], "created_at": now, "status": "active"}
    await db[TOKENS].insert_many([
        {**common, "token_hash": hash_secret(access), "kind": "access",
         "expires_at": now + timedelta(seconds=settings.OAUTH_ACCESS_TTL_SECONDS)},
        {**common, "token_hash": hash_secret(refresh), "kind": "refresh", "expires_at": refresh_exp,
         "consumed_at": None, "replaced_by": None},
    ])
    return {
        "access_token": access, "token_type": "Bearer", "expires_in": settings.OAUTH_ACCESS_TTL_SECONDS,
        "refresh_token": refresh, "scope": " ".join(grant["scopes"]),
        "_refresh_hash": hash_secret(refresh),
    }


def public_token_response(tokens: dict) -> dict:
    return {k: v for k, v in tokens.items() if not k.startswith("_")}


async def revoke_grant(db, grant_id: str, status: str = REVOKED, reason: str = "") -> None:
    """Révoque un grant et TOUS ses jetons (effet immédiat : jetons opaques)."""
    await db[GRANTS].update_one(
        {"id": grant_id, "status": {"$nin": [REVOKED, COMPROMISED, SUPERSEDED]}},
        {"$set": {"status": status, "status_changed_at": _now(), "status_reason": reason}},
    )
    await db[TOKENS].update_many({"grant_id": grant_id, "status": {"$ne": "revoked"}},
                                 {"$set": {"status": "revoked", "revoked_at": _now()}})
    logger.info("oauth_grant_revoked grant=%s status=%s reason=%s", grant_id[:8], status, reason)


async def exchange_code(db, client: dict, form: dict) -> dict:
    """grant_type=authorization_code : PKCE, redirect_uri, resource, usage unique du code."""
    code = form.get("code") or ""
    verifier = form.get("code_verifier") or ""
    if not code or not _VERIFIER_RE.fullmatch(verifier):
        raise OAuthError("invalid_request", "code et code_verifier requis")
    code_doc = await db[CODES].find_one_and_update(
        {"code_hash": hash_secret(code), "used_at": None},
        {"$set": {"used_at": _now()}}, return_document=ReturnDocument.BEFORE,
    )
    if code_doc is None:
        reused = await db[CODES].find_one({"code_hash": hash_secret(code)}, {"grant_id": 1})
        if reused and reused.get("grant_id"):
            # Réutilisation d'un code (RFC 6749 §4.1.2) : les jetons émis sont révoqués
            await revoke_grant(db, reused["grant_id"], COMPROMISED, "code_reuse")
        raise OAuthError("invalid_grant", "Code invalide, expiré ou déjà utilisé")
    if _aware(code_doc["expires_at"]) <= _now():
        raise OAuthError("invalid_grant", "Code expiré")
    if code_doc["client_id"] != client["client_id"]:
        raise OAuthError("invalid_grant", "Code émis pour un autre client")
    if form.get("redirect_uri") != code_doc["redirect_uri"]:
        raise OAuthError("invalid_grant", "redirect_uri différente")
    resource = form.get("resource")
    if resource is not None and resource != code_doc["resource"]:
        raise OAuthError("invalid_target", "resource différente")
    if not hmac.compare_digest(pkce_s256(verifier), code_doc["code_challenge"]):
        raise OAuthError("invalid_grant", "code_verifier invalide (PKCE)")
    if not await user_is_eligible(db, code_doc["user_id"]):
        raise OAuthError("invalid_grant", "Compte non autorisé")

    now = _now()
    # Un nouveau consentement remplace les grants actifs du même client (§3.7 : superseded)
    async for old in db[GRANTS].find({"user_id": code_doc["user_id"], "client_id": client["client_id"],
                                      "status": {"$in": [ACTIVE, EXPIRED_OBSERVED, RECONNECTION]}}, {"id": 1}):
        await revoke_grant(db, old["id"], SUPERSEDED, "new_consent")
    grant = {
        "id": str(uuid.uuid4()), "user_id": code_doc["user_id"], "client_id": client["client_id"],
        "scopes": code_doc["scopes"], "resource": code_doc["resource"], "status": ACTIVE,
        "created_at": now, "status_changed_at": now, "last_refresh_at": None, "first_expired_seen_at": None,
        "absolute_expires_at": now + timedelta(seconds=settings.OAUTH_GRANT_MAX_SECONDS),
    }
    await db[GRANTS].insert_one(dict(grant))
    await db[CODES].update_one({"code_hash": code_doc["code_hash"]}, {"$set": {"grant_id": grant["id"]}})
    tokens = await _issue_tokens(db, grant)
    logger.info("oauth_token grant_type=authorization_code grant=%s user_id=%s", grant["id"][:8], grant["user_id"])
    return tokens


async def refresh(db, client: dict, form: dict) -> dict:
    """grant_type=refresh_token : rotation à chaque usage ; réutilisation hors délai de grâce ->
    famille révoquée (grant compromised)."""
    raw = form.get("refresh_token") or ""
    if not raw.startswith(REFRESH_PREFIX) or len(raw) > 200:
        raise OAuthError("invalid_grant", "refresh_token invalide")
    token_hash = hash_secret(raw)
    token = await db[TOKENS].find_one({"token_hash": token_hash, "kind": "refresh"}, {"_id": 0})
    if not token or token["client_id"] != client["client_id"]:
        raise OAuthError("invalid_grant", "refresh_token invalide")
    grant = await db[GRANTS].find_one({"id": token["grant_id"]}, {"_id": 0})
    if not grant or grant["status"] not in USABLE_STATUSES:
        raise OAuthError("invalid_grant", "Autorisation révoquée ou expirée : reconnexion nécessaire")
    now = _now()
    if token["status"] == "revoked":
        raise OAuthError("invalid_grant", "refresh_token révoqué")
    if _aware(token["expires_at"]) <= now or _aware(grant["absolute_expires_at"]) <= now:
        await db[GRANTS].update_one({"id": grant["id"]},
                                    {"$set": {"status": RECONNECTION, "status_changed_at": now,
                                              "status_reason": "refresh_expired"}})
        raise OAuthError("invalid_grant", "Autorisation expirée : reconnexion nécessaire")
    if form.get("scope"):
        requested = parse_scopes(form.get("scope"))
        if not set(requested) <= set(grant["scopes"]):
            raise OAuthError("invalid_scope", "Scope supérieur à l'autorisation")
    if not await user_is_eligible(db, grant["user_id"]):
        await revoke_grant(db, grant["id"], REVOKED, "user_not_eligible")
        raise OAuthError("invalid_grant", "Compte non autorisé")

    consumed = await db[TOKENS].find_one_and_update(
        {"token_hash": token_hash, "status": "active", "consumed_at": None},
        {"$set": {"consumed_at": now, "status": "consumed"}}, return_document=ReturnDocument.BEFORE,
    )
    if consumed is None:
        latest = await db[TOKENS].find_one({"token_hash": token_hash}, {"consumed_at": 1, "replaced_by": 1})
        consumed_at = _aware(latest.get("consumed_at")) if latest else None
        grace = timedelta(seconds=settings.OAUTH_REFRESH_REUSE_GRACE_SECONDS)
        if consumed_at and now - consumed_at <= grace:
            # Double envoi légitime (retry réseau) : nouvelle paire, la précédente est annulée
            if latest.get("replaced_by"):
                await db[TOKENS].update_many(
                    {"grant_id": grant["id"], "status": "active",
                     "$or": [{"token_hash": latest["replaced_by"]}, {"kind": "access", "created_at": {"$gte": consumed_at}}]},
                    {"$set": {"status": "revoked", "revoked_at": now}})
        else:
            await revoke_grant(db, grant["id"], COMPROMISED, "refresh_reuse")
            raise OAuthError("invalid_grant", "refresh_token déjà utilisé : autorisation révoquée")

    tokens = await _issue_tokens(db, grant)
    await db[TOKENS].update_one({"token_hash": token_hash}, {"$set": {"replaced_by": tokens["_refresh_hash"]}})
    await db[GRANTS].update_one({"id": grant["id"], "status": {"$in": list(USABLE_STATUSES)}},
                                {"$set": {"status": ACTIVE, "last_refresh_at": now, "first_expired_seen_at": None}})
    logger.info("oauth_token grant_type=refresh_token grant=%s", grant["id"][:8])
    return tokens


async def revoke_token(db, client: dict, raw_token: str) -> None:
    """RFC 7009 : révoque le grant du jeton (accès ou refresh). Jeton inconnu : sans effet."""
    if not raw_token or len(raw_token) > 200:
        return
    token = await db[TOKENS].find_one({"token_hash": hash_secret(raw_token)}, {"grant_id": 1, "client_id": 1})
    if token and token["client_id"] == client["client_id"]:
        await revoke_grant(db, token["grant_id"], REVOKED, "client_revocation")


async def validate_access_token(db, raw_token: Optional[str]) -> tuple:
    """
    Validation à CHAQUE appel MCP. Retourne (Principal, None) ou (None, raison).
    Raisons : missing | invalid | expired | not_eligible.
    """
    if not raw_token:
        return None, "missing"
    if not raw_token.startswith(ACCESS_PREFIX) or len(raw_token) > 200:
        return None, "invalid"
    await ensure_indexes(db)
    token = await db[TOKENS].find_one({"token_hash": hash_secret(raw_token), "kind": "access"}, {"_id": 0})
    if not token or token["status"] != "active" or token["aud"] != canonical_resource():
        return None, "invalid"
    grant = await db[GRANTS].find_one({"id": token["grant_id"]}, {"_id": 0})
    if not grant or grant["status"] not in USABLE_STATUSES:
        return None, "invalid"
    now = _now()
    if _aware(token["expires_at"]) <= now:
        # §3.7 : expiration observée, sans surveillance active
        await db[GRANTS].update_one(
            {"id": grant["id"], "status": ACTIVE},
            {"$set": {"status": EXPIRED_OBSERVED, "status_changed_at": now, "first_expired_seen_at": now}})
        return None, "expired"
    if not await user_is_eligible(db, grant["user_id"]):
        return None, "not_eligible"
    return Principal(user_id=grant["user_id"], grant_id=grant["id"], client_id=grant["client_id"],
                     scopes=tuple(grant["scopes"])), None


# ============================================
# CONNEXIONS DE L'UTILISATEUR
# ============================================

async def list_user_grants(db, user_id: str) -> List[dict]:
    """Connexions de l'utilisateur (sans aucun secret). `alert` : signal indicatif calculé à la
    consultation (§3.7), sans surveillance active."""
    now = _now()
    items = []
    clients = {}
    async for g in db[GRANTS].find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).limit(20):
        if g["client_id"] not in clients:
            c = await db[CLIENTS].find_one({"client_id": g["client_id"]}, {"name": 1})
            clients[g["client_id"]] = c["name"] if c else "Client"
        alert = None
        seen = _aware(g.get("first_expired_seen_at"))
        if g["status"] == EXPIRED_OBSERVED and seen and now - seen > REFRESH_NOT_OBSERVED_AFTER:
            alert = "refresh_not_observed"
        abs_end = _aware(g["absolute_expires_at"])
        if g["status"] in USABLE_STATUSES and abs_end - now <= timedelta(days=7):
            alert = alert or "reconnection_soon"
        items.append({
            "id": g["id"], "client_name": clients[g["client_id"]], "scopes": g["scopes"], "status": g["status"],
            "created_at": _aware(g["created_at"]), "last_refresh_at": _aware(g.get("last_refresh_at")),
            "expires_at": abs_end, "alert": alert,
        })
    return items


async def revoke_user_grant(db, user_id: str, grant_id: str) -> bool:
    grant = await db[GRANTS].find_one({"id": grant_id, "user_id": user_id}, {"id": 1})
    if not grant:
        return False
    await revoke_grant(db, grant_id, REVOKED, "user_revocation")
    return True


# ============================================
# INTERRUPTEUR D'URGENCE (§8 bis.2, couche 1)
# ============================================

KILL_SWITCH_KEY = "mcp_kill_switch"


async def kill_switch_active(db) -> bool:
    doc = await db.platform_settings.find_one({"key": KILL_SWITCH_KEY}, {"value": 1})
    return bool(doc and doc.get("value") is True)


async def set_kill_switch(db, active: bool, admin_id: str) -> None:
    await db.platform_settings.update_one(
        {"key": KILL_SWITCH_KEY},
        {"$set": {"key": KILL_SWITCH_KEY, "value": bool(active), "updated_at": _now().isoformat(), "updated_by": admin_id}},
        upsert=True)
    logger.warning("mcp_kill_switch admin_id=%s active=%s", admin_id, active)
