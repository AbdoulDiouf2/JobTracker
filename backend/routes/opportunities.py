"""
JobTracker SaaS - Routes des opportunités (offres découvertes, pas encore candidatées)

Toutes les routes utilisent le JWT utilisateur et sont strictement scopées
au user connecté. La logique métier vit dans services.opportunity_service.
"""

from fastapi import APIRouter, HTTPException, status, Depends, Query, Response
from typing import Optional

from models import (
    RESERVED_OPPORTUNITY_SOURCES,
    OpportunityCreate, OpportunityUpdate, OpportunityStatus,
    OpportunityResponse, OpportunityListResponse, OpportunityCountResponse,
    OpportunityIngestResult, OpportunityConversionResponse,
)
from services import opportunity_service
from services.opportunity_service import (
    OpportunityNotFound, OpportunityConflict, OpportunityConversionInProgress,
)
from utils.auth import get_current_user

router = APIRouter(prefix="/opportunities", tags=["Opportunities"])


def get_db():
    """Dependency injection pour la DB"""
    pass


def _not_found() -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Opportunité non trouvée")


@router.get("", response_model=OpportunityListResponse)
async def list_opportunities(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status_filter: Optional[OpportunityStatus] = Query(None, alias="status"),
    search: Optional[str] = Query(None, max_length=200),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Liste les opportunités de l'utilisateur (filtre statut, recherche poste/entreprise)"""
    return await opportunity_service.list_opportunities(
        db, current_user["user_id"], status=status_filter, search=search, page=page, per_page=per_page
    )


@router.get("/count", response_model=OpportunityCountResponse)
async def count_opportunities(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Nombre d'opportunités nouvelles (badge de navigation)"""
    return OpportunityCountResponse(
        new=await opportunity_service.count_new_opportunities(db, current_user["user_id"])
    )


@router.post("", response_model=OpportunityIngestResult)
async def create_opportunity(
    data: OpportunityCreate,
    response: Response,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Crée une opportunité (idempotent).
    201 si créée, 200 si doublon (l'opportunité existante est renvoyée).
    """
    if data.source in RESERVED_OPPORTUNITY_SOURCES:
        # Source réservée à la veille ChatGPT (imposée par le serveur, Lot 2)
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail={"code": "source_reserved"})
    result = await opportunity_service.ingest_opportunity(db, current_user["user_id"], data)
    response.status_code = status.HTTP_201_CREATED if result.created else status.HTTP_200_OK
    return result


@router.get("/{opportunity_id}", response_model=OpportunityResponse)
async def get_opportunity(
    opportunity_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Récupère une opportunité par ID"""
    try:
        return await opportunity_service.get_opportunity(db, current_user["user_id"], opportunity_id)
    except OpportunityNotFound:
        raise _not_found()


@router.patch("/{opportunity_id}", response_model=OpportunityResponse)
async def update_opportunity(
    opportunity_id: str,
    update: OpportunityUpdate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Met à jour une opportunité (champs descriptifs, statut new/ignored)"""
    try:
        return await opportunity_service.update_opportunity(db, current_user["user_id"], opportunity_id, update)
    except OpportunityNotFound:
        raise _not_found()
    except OpportunityConflict as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.post("/{opportunity_id}/ignore", response_model=OpportunityResponse)
async def ignore_opportunity(
    opportunity_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Ignore une opportunité (conservée pour éviter sa réimportation)"""
    try:
        return await opportunity_service.ignore_opportunity(db, current_user["user_id"], opportunity_id)
    except OpportunityNotFound:
        raise _not_found()
    except OpportunityConflict as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.post("/{opportunity_id}/convert", response_model=OpportunityConversionResponse)
async def convert_opportunity(
    opportunity_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Transforme l'opportunité en candidature suivie (statut « À postuler »).
    N'envoie rien à l'entreprise. Idempotent : un second appel renvoie la même candidature.
    """
    try:
        result = await opportunity_service.convert_opportunity(db, current_user["user_id"], opportunity_id)
    except OpportunityNotFound:
        raise _not_found()
    except OpportunityConversionInProgress:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Conversion déjà en cours, réessayez dans quelques secondes",
            headers={"Retry-After": "2"},
        )
    return OpportunityConversionResponse(**result)
