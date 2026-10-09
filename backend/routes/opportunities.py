"""
JobTracker SaaS - Routes des opportunités (offres découvertes, pas encore candidatées)

Toutes les routes utilisent le JWT utilisateur et sont strictement scopées
au user connecté. La logique métier vit dans services.opportunity_service.
"""

import re
from datetime import date
from typing import List, Literal, Optional

from fastapi import APIRouter, HTTPException, status, Depends, Query, Response

from models import (
    RESERVED_OPPORTUNITY_SOURCES,
    OpportunityCreate, OpportunityUpdate, OpportunityStatus,
    OpportunityResponse, OpportunityListResponse, OpportunityCountResponse,
    OpportunityIngestResult, OpportunityConversionResponse,
)
from services import opportunity_service
from services.opportunity_service import (
    OpportunityNotFound, OpportunityConflict, OpportunityConversionInProgress, OpportunityFilters,
)
from utils.auth import get_current_user

router = APIRouter(prefix="/opportunities", tags=["Opportunities"])


def get_db():
    """Dependency injection pour la DB"""
    pass


def _not_found() -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Opportunité non trouvée")


# Valeurs de filtres acceptées (toute autre valeur : 422, sans écho)
_ORIGIN_RE = re.compile(r"^(client:[A-Za-z0-9_-]{1,100}|watch_legacy|source:[a-z0-9_-]{1,50})$")
_COUNTRY_RE = re.compile(r"^[A-Za-z]{2}$")
ContractKind = Literal["permanent", "fixed_term", "freelance", "internship", "apprenticeship"]
SeniorityLevel = Literal["junior", "entry_level", "graduate", "mid"]
SortKey = Literal["discovered", "relevance", "company"]
MAX_MULTI = 20


def _invalid(param: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                         detail={"code": "invalid_filter", "param": param})


@router.get("", response_model=OpportunityListResponse)
async def list_opportunities(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status_filter: Optional[OpportunityStatus] = Query(None, alias="status"),
    search: Optional[str] = Query(None, max_length=200),
    origin: List[str] = Query(default_factory=list, max_length=MAX_MULTI),
    country: List[str] = Query(default_factory=list, max_length=MAX_MULTI),
    min_score: Optional[int] = Query(None, ge=0, le=100),
    max_score: Optional[int] = Query(None, ge=0, le=100),
    discovered_from: Optional[date] = Query(None),
    discovered_to: Optional[date] = Query(None),
    contract: List[ContractKind] = Query(default_factory=list, max_length=MAX_MULTI),
    seniority: List[SeniorityLevel] = Query(default_factory=list, max_length=MAX_MULTI),
    location: Optional[str] = Query(None, max_length=100),
    sort: SortKey = Query("discovered"),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Liste les opportunités de l'utilisateur. Filtres combinés en ET (valeurs multiples en OU),
    appliqués AVANT la pagination ; `total` = nombre de résultats filtrés.
    - origin : client:<client_id> | watch_legacy | source:<source> (voir /facets) ;
    - country : code ISO 3166 alpha-2 (pays en texte libre normalisés à la lecture) ;
    - min_score / max_score : pertinence incluse (offres sans score exclues si filtré) ;
    - discovered_from / discovered_to : jours de Paris, bornes INCLUSES ;
    - seniority : une offre sans séniorité ne correspond à aucun niveau ;
    - sort : discovered (défaut) | relevance (sans score en dernier) | company.
    """
    if any(not _ORIGIN_RE.match(o) or o == "source:chatgpt_watch" for o in origin):
        raise _invalid("origin")
    if any(not _COUNTRY_RE.match(c) for c in country):
        raise _invalid("country")
    if min_score is not None and max_score is not None and min_score > max_score:
        raise _invalid("min_score")
    if discovered_from and discovered_to and discovered_from > discovered_to:
        raise _invalid("discovered_from")
    filters = OpportunityFilters(
        status=status_filter.value if status_filter else None, search=search,
        origins=list(dict.fromkeys(origin)), countries=list(dict.fromkeys(c.upper() for c in country)),
        min_score=min_score, max_score=max_score, discovered_from=discovered_from, discovered_to=discovered_to,
        contracts=list(dict.fromkeys(contract)), seniorities=list(dict.fromkeys(seniority)),
        location=location, sort=sort,
    )
    result = await opportunity_service.list_opportunities(
        db, current_user["user_id"], page=page, per_page=per_page, filters=filters
    )
    await opportunity_service.attach_client_names(db, result["items"])
    return result


@router.get("/count", response_model=OpportunityCountResponse)
async def count_opportunities(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Nombre d'opportunités nouvelles (badge de navigation)"""
    return OpportunityCountResponse(
        new=await opportunity_service.count_new_opportunities(db, current_user["user_id"])
    )


@router.get("/facets")
async def opportunity_facets(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Valeurs disponibles pour les filtres, avec effectifs GLOBAUX au compte (`scope: "account"`) :
    tous statuts confondus, indépendants des filtres en cours."""
    return await opportunity_service.opportunity_facets(db, current_user["user_id"])


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
        opportunity = await opportunity_service.get_opportunity(db, current_user["user_id"], opportunity_id)
    except OpportunityNotFound:
        raise _not_found()
    return (await opportunity_service.attach_client_names(db, [opportunity]))[0]


@router.patch("/{opportunity_id}", response_model=OpportunityResponse)
async def update_opportunity(
    opportunity_id: str,
    update: OpportunityUpdate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Met à jour une opportunité (champs descriptifs, statut new/ignored)"""
    try:
        updated = await opportunity_service.update_opportunity(db, current_user["user_id"], opportunity_id, update)
        return (await opportunity_service.attach_client_names(db, [updated]))[0]
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
        ignored = await opportunity_service.ignore_opportunity(db, current_user["user_id"], opportunity_id)
        return (await opportunity_service.attach_client_names(db, [ignored]))[0]
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
