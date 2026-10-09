"""
JobTracker SaaS - API agent (systèmes externes authentifiés par AgentToken)

POST /api/agent/opportunities : dépose une opportunité dans le compte du
propriétaire du token. Le user_id provient exclusivement du token.
"""

import logging

from fastapi import APIRouter, HTTPException, status, Depends, Request, Response
from slowapi import Limiter
from slowapi.util import get_remote_address

from config import settings
from models import AgentScope, OpportunityCreate, OpportunityIngestResult, RESERVED_OPPORTUNITY_SOURCES
from services.agent_token_service import (
    AgentQuotaExceeded, hash_token, is_well_formed, ingest_opportunity_as_agent, seconds_until_quota_reset,
)
from utils.agent_auth import AgentPrincipal, require_agent_scope

logger = logging.getLogger("jobtracker.agent")

router = APIRouter(prefix="/agent", tags=["Agent API"])

DEFAULT_AGENT_SOURCE = "external_agent"


def get_db():
    """Dependency injection pour la DB"""
    pass


def agent_rate_limit_key(request: Request) -> str:
    """
    Clé du rate limit burst : l'identité du token (son hash tronqué), pas l'IP.
    L'IP ne sert que de repli pour une requête sans token bien formé
    (déjà rejetée en 401 par l'authentification).
    """
    auth = request.headers.get("authorization", "")
    scheme, _, credentials = auth.partition(" ")
    if scheme.lower() == "bearer" and is_well_formed(credentials.strip()):
        return "agent:" + hash_token(credentials.strip())[:32]
    return "ip:" + get_remote_address(request)


# Stockage mémoire : protection burst par instance. Le quota journalier
# (MongoDB) reste la limite fiable en serverless.
limiter = Limiter(key_func=agent_rate_limit_key)


@router.post("/opportunities", response_model=OpportunityIngestResult)
@limiter.limit(settings.AGENT_RATE_LIMIT)
async def ingest_opportunity(
    request: Request,
    response: Response,
    data: OpportunityCreate,
    principal: AgentPrincipal = Depends(require_agent_scope(AgentScope.OPPORTUNITIES_CREATE)),
    db = Depends(get_db)
):
    """
    Ingestion idempotente : 201 si créée, 200 si doublon.
    Un champ `user_id` dans le payload est refusé (422).
    """
    if "source" not in data.model_fields_set:
        data.source = DEFAULT_AGENT_SOURCE
    if data.source in RESERVED_OPPORTUNITY_SOURCES:
        # Source réservée à la veille ChatGPT (imposée par le serveur, Lot 2)
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail={"code": "source_reserved"})

    log_ctx = {"token_id": principal.token_id, "prefix": principal.token_prefix, "user_id": principal.user_id}
    try:
        token = {"id": principal.token_id, "user_id": principal.user_id}
        result = await ingest_opportunity_as_agent(db, token, data)
    except AgentQuotaExceeded as e:
        logger.warning(
            "agent_ingest endpoint=/agent/opportunities result=quota_exceeded token_id=%(token_id)s "
            "prefix=%(prefix)s user_id=%(user_id)s", log_ctx,
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"code": "agent_daily_quota_exceeded", "quota": e.quota},
            headers={"Retry-After": str(seconds_until_quota_reset())},
        )

    logger.info(
        "agent_ingest endpoint=/agent/opportunities result=%s token_id=%s prefix=%s user_id=%s "
        "opportunity_id=%s duplicate=%s",
        "created" if result.created else "duplicate",
        principal.token_id, principal.token_prefix, principal.user_id,
        result.opportunity_id, result.duplicate,
    )
    response.status_code = status.HTTP_201_CREATED if result.created else status.HTTP_200_OK
    return result
