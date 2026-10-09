"""
JobTracker SaaS - Routes de la veille ChatGPT (Lot 2), côté utilisateur

JWT utilisateur ; `user_id` toujours issu du jeton. Toutes les routes exigent
le drapeau `watch_enabled` (activé par un admin) : sinon 403 `watch_not_enabled`.

Aucune route d'ingestion d'offres ici : l'ingestion n'est exposée qu'au
travers du MCP authentifié (étape 3).
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status

from models.watch import (
    WatchPreferencesResponse, WatchPreferencesUpdate, WatchRunListResponse, WatchStatusResponse,
)
from services import watch_ingest_service, watch_preferences_service
from services.watch_ingest_service import WatchNotEnabled
from services.watch_preferences_service import VersionConflict
from utils.auth import get_current_user

router = APIRouter(prefix="/watch", tags=["Watch"])


def get_db():
    """Dependency injection pour la DB"""
    pass


async def require_watch_user(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db),
) -> dict:
    try:
        await watch_ingest_service.require_enabled(db, current_user["user_id"])
    except WatchNotEnabled:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={"code": "watch_not_enabled"})
    return current_user


@router.get("/preferences", response_model=WatchPreferencesResponse)
async def get_preferences(
    current_user: dict = Depends(require_watch_user),
    db = Depends(get_db),
):
    """Critères de veille (créés avec les valeurs initiales au premier accès)."""
    return await watch_preferences_service.get_or_create(db, current_user["user_id"])


@router.put("/preferences", response_model=WatchPreferencesResponse)
async def update_preferences(
    data: WatchPreferencesUpdate,
    current_user: dict = Depends(require_watch_user),
    db = Depends(get_db),
):
    """Remplacement complet, avec contrôle de version (409 si modifiées entre-temps)."""
    try:
        return await watch_preferences_service.update(db, current_user["user_id"], data)
    except VersionConflict as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "version_conflict", "current_version": e.current_version},
        )


@router.get("/status", response_model=WatchStatusResponse)
async def get_status(
    current_user: dict = Depends(require_watch_user),
    db = Depends(get_db),
):
    """État de la veille : faits observés uniquement, absence présumée indicative."""
    return await watch_ingest_service.get_status(db, current_user["user_id"])


@router.get("/runs", response_model=WatchRunListResponse)
async def list_runs(
    limit: int = Query(20, ge=1, le=50),
    current_user: dict = Depends(require_watch_user),
    db = Depends(get_db),
):
    """Historique des exécutions observées par JobTracker."""
    return await watch_ingest_service.list_runs(db, current_user["user_id"], limit=limit)
