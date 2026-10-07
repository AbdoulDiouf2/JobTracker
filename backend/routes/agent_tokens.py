"""
JobTracker SaaS - Gestion des tokens agent (API utilisateur, JWT)
"""

from typing import List

from fastapi import APIRouter, HTTPException, status, Depends

from models import AgentTokenCreate, AgentTokenResponse, AgentTokenCreatedResponse
from services import agent_token_service
from services.agent_token_service import AgentTokenNotFound, AgentTokenLimitReached
from utils.auth import get_current_user
from config import settings

router = APIRouter(prefix="/agent-tokens", tags=["Agent tokens"])


def get_db():
    """Dependency injection pour la DB"""
    pass


async def get_webapp_user(current_user: dict = Depends(get_current_user)) -> dict:
    """
    Gestion des tokens réservée à la webapp : le JWT longue durée de
    l'extension Chrome ne peut pas créer ni révoquer de tokens agent.
    """
    if current_user.get("source") == "extension":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Gestion des tokens agent non autorisée depuis l'extension",
        )
    return current_user


@router.post("", response_model=AgentTokenCreatedResponse, status_code=status.HTTP_201_CREATED)
async def create_agent_token(
    data: AgentTokenCreate,
    current_user: dict = Depends(get_webapp_user),
    db = Depends(get_db)
):
    """Crée un token agent. Le token complet n'est retourné QU'UNE SEULE FOIS."""
    try:
        token, raw_token = await agent_token_service.create_agent_token(db, current_user["user_id"], data)
    except AgentTokenLimitReached:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Nombre maximum de tokens actifs atteint ({settings.AGENT_MAX_ACTIVE_TOKENS})",
        )
    return AgentTokenCreatedResponse(**token, token=raw_token)


@router.get("", response_model=List[AgentTokenResponse])
async def list_agent_tokens(
    current_user: dict = Depends(get_webapp_user),
    db = Depends(get_db)
):
    """Liste les tokens de l'utilisateur (actifs et révoqués). Jamais le token ni son hash."""
    return await agent_token_service.list_agent_tokens(db, current_user["user_id"])


@router.delete("/{token_id}", response_model=AgentTokenResponse)
async def revoke_agent_token(
    token_id: str,
    current_user: dict = Depends(get_webapp_user),
    db = Depends(get_db)
):
    """Révoque un token (effet immédiat, idempotent). L'enregistrement est conservé pour audit."""
    try:
        return await agent_token_service.revoke_agent_token(db, current_user["user_id"], token_id)
    except AgentTokenNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Token non trouvé")
