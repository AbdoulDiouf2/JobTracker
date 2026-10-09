"""
JobTracker SaaS - Routes OAuth 2.1 du connecteur MCP (Lot 2, étape 3)

Disponibles SEULEMENT si le MCP est actif (`MCP_ENABLED`, jamais en production avant la
levée explicite du blocage) : sinon 404, comme une route absente. Interrupteur d'urgence
en base -> 503.

Points d'entrée :
  GET  /api/oauth/authorize            (ChatGPT, navigateur)  -> page de consentement
  GET  /api/oauth/requests/{id}        (JWT webapp)            détails pour le consentement
  POST /api/oauth/consent              (JWT webapp)            décision -> URL de retour
  POST /api/oauth/token                (client authentifié ou public + PKCE)  code -> jetons, rotation
  POST /api/oauth/revoke               (client authentifié)    RFC 7009
  GET  /api/oauth/grants               (JWT webapp)            connexions de l'utilisateur
  DELETE /api/oauth/grants/{id}        (JWT webapp)            révocation par l'utilisateur
Métadonnées : /.well-known/oauth-protected-resource[/api/mcp], /.well-known/oauth-authorization-server
"""

import base64
import logging
from typing import Optional
from urllib.parse import unquote

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel, ConfigDict, Field, StrictBool
from slowapi import Limiter
from slowapi.util import get_remote_address

from config import settings
from services import oauth_service
from services.oauth_service import OAuthError
from utils.auth import get_current_user
from utils.mcp_transport import mcp_enabled

logger = logging.getLogger("jobtracker.oauth")

router = APIRouter(prefix="/oauth", tags=["OAuth"])
well_known_router = APIRouter(tags=["OAuth discovery"], include_in_schema=False)

# Mémoire par instance (comme l'API agent) : protection contre les rafales
limiter = Limiter(key_func=get_remote_address)

NO_STORE = {"Cache-Control": "no-store", "Pragma": "no-cache"}
# Anti-clickjacking sur toutes les réponses OAuth (§6.1)
FRAME_DENY = {"X-Frame-Options": "DENY", "Content-Security-Policy": "frame-ancestors 'none'",
              "Referrer-Policy": "no-referrer"}
SECURE = {**NO_STORE, **FRAME_DENY}
NOT_FOUND = HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not Found")


def get_db():
    """Dependency injection pour la DB"""
    pass


async def oauth_available(db=Depends(get_db)):
    """Couche 1 (§8 bis.2) : MCP actif, sinon route absente ; interrupteur d'urgence -> 503.
    Toujours déclarée AVANT l'authentification dans les signatures : inactif, le service
    répond 404 à tous, sans révéler l'existence des routes (pas de 401)."""
    if not mcp_enabled():
        raise NOT_FOUND
    if await oauth_service.kill_switch_active(db):
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                            detail={"error": "temporarily_unavailable"})
    return db


async def get_webapp_user(current_user: dict = Depends(get_current_user)) -> dict:
    """Consentement et connexions : session de la webapp uniquement (pas l'extension)."""
    if current_user.get("source") == "extension":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Action non autorisée depuis l'extension")
    return current_user


def oauth_error_response(err: OAuthError) -> JSONResponse:
    headers = dict(SECURE)
    if err.status_code == 401:
        headers["WWW-Authenticate"] = 'Basic realm="jobtracker-oauth"'
    body = {"error": err.error}
    if err.description:
        body["error_description"] = err.description
    return JSONResponse(status_code=err.status_code, content=body, headers=headers)


def client_credentials(request: Request, form: dict) -> tuple:
    """client_secret_basic (prioritaire), client_secret_post, ou identifiant seul pour un client public."""
    auth = request.headers.get("authorization", "")
    scheme, _, value = auth.partition(" ")
    if scheme.lower() == "basic" and value:
        try:
            decoded = base64.b64decode(value.strip(), validate=True).decode("utf-8")
            client_id, _, secret = decoded.partition(":")
            return unquote(client_id), unquote(secret)
        except (ValueError, UnicodeDecodeError):
            raise OAuthError("invalid_client", "En-tête Basic invalide", status_code=401)
    return form.get("client_id"), form.get("client_secret")


# ============================================
# AUTORISATION
# ============================================

@router.get("/authorize", include_in_schema=False)
@limiter.limit(settings.OAUTH_RATE_LIMIT)
async def authorize(request: Request, db=Depends(oauth_available)):
    params = dict(request.query_params)
    try:
        auth_request = await oauth_service.create_authorization_request(db, params)
    except OAuthError as err:
        if err.redirectable:
            return RedirectResponse(
                oauth_service.error_redirect(params["redirect_uri"], err.error, params.get("state"), err.description),
                status_code=status.HTTP_302_FOUND)
        # Client ou redirect_uri invalides : AUCUNE redirection (protection open redirect)
        return oauth_error_response(err)
    return RedirectResponse(f"{oauth_service.issuer()}/oauth/consent?request={auth_request['id']}",
                            status_code=status.HTTP_302_FOUND, headers=SECURE)


@router.get("/requests/{request_id}")
async def get_consent_request(request_id: str, db=Depends(oauth_available), current_user: dict = Depends(get_webapp_user)):
    req, error = await oauth_service.get_request_state(db, request_id)
    if error:
        # 404 introuvable, 410 expirée, 409 déjà utilisée : la page explique quoi faire
        code = {oauth_service.REQUEST_EXPIRED: 410, oauth_service.REQUEST_USED: 409}.get(error, 404)
        return JSONResponse(status_code=code, content={"error": error}, headers=SECURE)
    try:
        # Domaine de retour REVALIDÉ côté serveur : l'utilisateur voit où il sera renvoyé (P1.1).
        # `redirect_local` : retour vers une application de cet appareil (loopback, P2.3)
        redirect = oauth_service.describe_redirect(req["redirect_uri"])
    except ValueError:
        return JSONResponse(status_code=400, content={"error": "invalid_request"}, headers=SECURE)
    user = await db.users.find_one({"id": current_user["user_id"]}, {"_id": 0, "email": 1, "full_name": 1})
    return JSONResponse(headers=SECURE, content={
        "request_id": req["id"],
        "client": {"name": req["client_name"], "redirect_domain": redirect["host"], "redirect_local": redirect["local"]},
        "scopes": [{"scope": s, "description": oauth_service.SCOPE_DESCRIPTIONS[s]} for s in req["scopes"]],
        "account": {"email": (user or {}).get("email"), "name": (user or {}).get("full_name")},
        "eligible": await oauth_service.user_is_eligible(db, current_user["user_id"]),
        "expires_at": oauth_service._aware(req["expires_at"]).isoformat(),
    })


class ConsentDecision(BaseModel):
    model_config = ConfigDict(extra="forbid")

    request_id: str = Field(..., min_length=1, max_length=100)
    approve: StrictBool


@router.post("/consent")
async def consent(body: ConsentDecision, db=Depends(oauth_available), current_user: dict = Depends(get_webapp_user)):
    try:
        url = await oauth_service.decide(db, body.request_id, current_user["user_id"], body.approve)
    except OAuthError as err:
        return oauth_error_response(err)
    # Uniquement l'URL de continuation (ticket) : jamais de code d'autorisation côté frontend
    return JSONResponse(content={"continue_url": url}, headers=SECURE)


@router.get("/continue", include_in_schema=False)
@limiter.limit(settings.OAUTH_RATE_LIMIT)
async def continue_to_client(request: Request, db=Depends(oauth_available)):
    """Navigation de premier niveau du navigateur : redirige vers le client avec le code (ou
    access_denied). Ticket invalide : erreur sans redirection."""
    try:
        url = await oauth_service.complete(db, request.query_params.get("ticket", ""))
    except OAuthError as err:
        return oauth_error_response(err)
    return RedirectResponse(url, status_code=status.HTTP_302_FOUND, headers=SECURE)


# ============================================
# JETONS
# ============================================

@router.post("/token", include_in_schema=False)
@limiter.limit(settings.OAUTH_RATE_LIMIT)
async def token(request: Request, db=Depends(oauth_available)):
    form = {k: v for k, v in (await request.form()).items() if isinstance(v, str)}
    try:
        client_id, secret = client_credentials(request, form)
        client = await oauth_service.authenticate_client(db, client_id, secret)
        grant_type = form.get("grant_type")
        if grant_type == "authorization_code":
            tokens = await oauth_service.exchange_code(db, client, form)
        elif grant_type == "refresh_token":
            tokens = await oauth_service.refresh(db, client, form)
        else:
            raise OAuthError("unsupported_grant_type", "grant_type non supporté")
    except OAuthError as err:
        logger.info("oauth_token result=%s", err.error)
        return oauth_error_response(err)
    return JSONResponse(content=oauth_service.public_token_response(tokens), headers=NO_STORE)


@router.post("/revoke", include_in_schema=False)
@limiter.limit(settings.OAUTH_RATE_LIMIT)
async def revoke(request: Request, db=Depends(oauth_available)):
    form = {k: v for k, v in (await request.form()).items() if isinstance(v, str)}
    try:
        client_id, secret = client_credentials(request, form)
        client = await oauth_service.authenticate_client(db, client_id, secret)
    except OAuthError as err:
        return oauth_error_response(err)
    await oauth_service.revoke_token(db, client, form.get("token") or "")
    return JSONResponse(content={}, headers=NO_STORE)  # RFC 7009 : 200 même si jeton inconnu


# ============================================
# CONNEXIONS DE L'UTILISATEUR
# ============================================

@router.get("/grants")
async def list_grants(db=Depends(oauth_available), current_user: dict = Depends(get_webapp_user)):
    return {"items": await oauth_service.list_user_grants(db, current_user["user_id"])}


@router.delete("/grants/{grant_id}")
async def delete_grant(grant_id: str, db=Depends(oauth_available), current_user: dict = Depends(get_webapp_user)):
    if not await oauth_service.revoke_user_grant(db, current_user["user_id"], grant_id):
        raise HTTPException(status_code=404, detail="Connexion non trouvée")
    return {"revoked": True}


# ============================================
# DÉCOUVERTE (RFC 9728, RFC 8414) : à la racine, hors /api
# ============================================

async def discovery_available(db=Depends(get_db)):
    """Métadonnées : 404 si le MCP est inactif OU coupé par l'interrupteur d'urgence."""
    if not mcp_enabled() or await oauth_service.kill_switch_active(db):
        raise NOT_FOUND
    return db


@well_known_router.get("/.well-known/oauth-protected-resource")
@well_known_router.get("/.well-known/oauth-protected-resource/api/mcp")
async def protected_resource_metadata(db=Depends(discovery_available)):
    return JSONResponse(content=oauth_service.protected_resource_metadata())


@well_known_router.get("/.well-known/oauth-authorization-server")
async def authorization_server_metadata(db=Depends(discovery_available)):
    return JSONResponse(content=oauth_service.authorization_server_metadata())
