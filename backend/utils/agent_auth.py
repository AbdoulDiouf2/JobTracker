"""
JobTracker SaaS - Authentification des agents externes (AgentToken)

Mécanisme distinct du JWT utilisateur : un token agent n'est jamais accepté par
get_current_user(), et un JWT n'est jamais accepté ici.

Bearer -> format -> hash -> lookup -> révoqué ? -> compte actif ? -> scope ? -> principal
"""

from typing import List

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from models import AgentScope
from services.agent_token_service import authenticate_agent_token, touch_last_used

# auto_error=False : on renvoie nous-mêmes un 401 homogène (absent / non-Bearer / invalide)
agent_bearer = HTTPBearer(auto_error=False)


def get_db():
    """Dependency injection pour la DB — overridée dans server.py"""
    pass


class AgentPrincipal(BaseModel):
    user_id: str
    token_id: str
    token_prefix: str
    scopes: List[str]


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_agent_principal(
    credentials: HTTPAuthorizationCredentials = Depends(agent_bearer),
    db=Depends(get_db),
) -> AgentPrincipal:
    if credentials is None:
        raise _unauthorized("Token agent manquant")

    token = await authenticate_agent_token(db, credentials.credentials)
    if token is None:
        # Même réponse pour malformé / inconnu / révoqué / compte désactivé
        raise _unauthorized("Token agent invalide ou révoqué")

    await touch_last_used(db, token)
    return AgentPrincipal(
        user_id=token["user_id"],
        token_id=token["id"],
        token_prefix=token["token_prefix"],
        scopes=token.get("scopes") or [],
    )


def require_agent_scope(scope: AgentScope):
    """Dépendance : principal authentifié ET porteur du scope (deny by default)."""
    async def dependency(principal: AgentPrincipal = Depends(get_agent_principal)) -> AgentPrincipal:
        if scope.value not in principal.scopes:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Scope requis : {scope.value}",
            )
        return principal
    return dependency
