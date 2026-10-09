"""
JobTracker SaaS - Outils MCP métier de la veille ChatGPT (Lot 2, spécification §4 et §5)

Catalogue indépendant du SDK `mcp` : définitions (schémas, scopes, annotations) et
exécution. Le transport (`utils/mcp_transport.py`) les expose et vérifie le scope AVANT
l'appel ; ici, chaque outil :
- tient le `user_id` EXCLUSIVEMENT de l'identité vérifiée (grant OAuth), jamais d'un argument ;
- réutilise les services existants (préférences, ingestion, statut, rapport), qui portent
  validation stricte, quotas atomiques, déduplication et idempotence ;
- répond `{"error": {...}}` (isError) sans jamais renvoyer l'écho des valeurs reçues.

JobTracker ne cherche AUCUNE offre : ChatGPT effectue les recherches et envoie ses résultats.
"""

import logging
from dataclasses import dataclass
from typing import Awaitable, Callable, Optional

from pydantic import BaseModel, ConfigDict, Field, ValidationError
from pymongo.errors import PyMongoError

from services import opportunity_service, watch_ingest_service, watch_preferences_service
from services.watch_ingest_service import WatchNotEnabled, WatchRequestError

logger = logging.getLogger("jobtracker.mcp")

READ, WRITE = "watch:read", "opportunities:write"

RUN_ID_HELP = (
    "run_id : `veille-AAAAMMJJ-HHMM-prog` (tâche programmée ; HHMM = heure PRÉVUE du créneau) ou "
    "`veille-AAAAMMJJ-HHMM-manuel-xxxxxx` (exécution manuelle ; HHMM = minute de démarrage, xxxxxx = "
    "6 caractères [a-z0-9] tirés une fois). Toujours en heure de Paris. Calculé UNE seule fois au début "
    "de l'exécution et réutilisé tel quel pour tous les appels, reprises et le rapport final."
)


class ToolError(Exception):
    def __init__(self, code: str, details: Optional[list] = None, retryable: bool = False):
        super().__init__(code)
        self.code = code
        self.details = details or []
        self.retryable = retryable


@dataclass(frozen=True)
class ToolSpec:
    name: str
    title: str
    description: str
    scope: str
    input_schema: dict
    read_only: bool
    idempotent: bool
    handler: Callable[..., Awaitable[dict]]


def _details(error: ValidationError) -> list:
    """Emplacement et type de chaque erreur, sans écho des valeurs reçues."""
    return [{"loc": [str(p) for p in err.get("loc", ())], "type": err["type"]} for err in error.errors()]


class _NoArguments(BaseModel):
    model_config = ConfigDict(extra="forbid")


class _RecentArguments(BaseModel):
    model_config = ConfigDict(extra="forbid")

    days: int = Field(14, ge=1, le=60, strict=True)
    limit: int = Field(50, ge=1, le=100, strict=True)


def _parse(model, arguments: dict):
    try:
        return model.model_validate(arguments)
    except ValidationError as e:
        raise ToolError("invalid_arguments", _details(e))


# ============================================
# OUTILS
# ============================================

async def _get_watch_preferences(db, user_id: str, arguments: dict) -> dict:
    _parse(_NoArguments, arguments)
    await watch_ingest_service.require_enabled(db, user_id)
    prefs = await watch_preferences_service.get_or_create(db, user_id)
    return prefs.model_dump(mode="json")


async def _create_opportunities(db, user_id: str, arguments: dict) -> dict:
    result = await watch_ingest_service.ingest_batch(db, user_id, arguments)
    return result.model_dump(mode="json")


async def _list_recent_opportunities(db, user_id: str, arguments: dict) -> dict:
    args = _parse(_RecentArguments, arguments)
    await watch_ingest_service.require_enabled(db, user_id)
    return await opportunity_service.list_recent_summary(db, user_id, args.days, args.limit)


async def _get_watch_status(db, user_id: str, arguments: dict) -> dict:
    _parse(_NoArguments, arguments)
    await watch_ingest_service.require_enabled(db, user_id)
    status = await watch_ingest_service.get_status(db, user_id)
    return {"service": "ok", **status.model_dump(mode="json")}


async def _report_watch_run(db, user_id: str, arguments: dict) -> dict:
    result = await watch_ingest_service.report_watch_run(db, user_id, arguments)
    return result.model_dump(mode="json")


# ============================================
# SCHÉMAS D'ENTRÉE (exposés à ChatGPT ; la validation réelle est côté serveur)
# ============================================

_EMPTY = {"type": "object", "properties": {}, "additionalProperties": False}

_STR = lambda n, desc="": {"type": "string", "maxLength": n, **({"description": desc} if desc else {})}  # noqa: E731

_OPPORTUNITY_ITEM = {
    "type": "object",
    "additionalProperties": False,
    "required": ["title", "company", "url", "country", "contract_type", "relevance_score", "relevance_reasons"],
    "properties": {
        "title": {"type": "string", "minLength": 1, "maxLength": 200},
        "company": {"type": "string", "minLength": 1, "maxLength": 200},
        "url": _STR(2000, "Lien DIRECT et HTTPS vers l'offre (pas de raccourcisseur ni de redirection)."),
        "country": _STR(100, "Code pays ISO 3166 alpha-2 (ex. FR), parmi les pays des préférences."),
        "location": _STR(200),
        "contract_type": _STR(100, "Ex. CDI, permanent, CDD ; doit correspondre aux contrats des préférences."),
        "seniority": _STR(50, "Optionnel : junior, entry_level, graduate, mid."),
        "description": _STR(10000, "Texte brut, 10 000 caractères au plus."),
        "external_id": _STR(200, "Identifiant stable de l'offre chez la source, si connu (ex. orange:12345)."),
        "discovered_at": {"type": "string", "format": "date-time"},
        "relevance_score": {"type": "integer", "minimum": 0, "maximum": 100,
                            "description": "Estimation de pertinence ; rejetée sous le min_score des préférences."},
        "relevance_reasons": {"type": "array", "minItems": 1, "maxItems": 5, "items": _STR(200)},
        "source_evidence": {
            "type": "object", "additionalProperties": False,
            "properties": {"url": _STR(2000), "excerpt": _STR(500)},
        },
        "uncertain_fields": {"type": "array", "items": {"type": "string", "maxLength": 50}},
    },
}

TOOLS = [
    ToolSpec(
        name="get_watch_preferences",
        title="JobTracker : critères de veille",
        description=(
            "À appeler AU DÉBUT de chaque exécution de veille : renvoie les critères à appliquer (pays, "
            "métiers, mots-clés, exclusions, séniorité, contrats, langues, score minimal, maximum par "
            "exécution, grille de notation) et `preferences_version`. Si `active` vaut false, arrêter la "
            "veille sans rien envoyer. Lecture seule."
        ),
        scope=READ, input_schema=_EMPTY, read_only=True, idempotent=True, handler=_get_watch_preferences,
    ),
    ToolSpec(
        name="create_opportunities",
        title="JobTracker : ajouter des offres",
        description=(
            "Envoie de 1 à 20 offres trouvées par TA recherche web pour une exécution `run_id`. JobTracker ne "
            "cherche rien lui-même : il valide, déduplique et enregistre chaque offre au statut « nouveau ». "
            "Résultat PAR offre : created, duplicate (déjà connue, sans coût), rejected (avec raisons) ou "
            "error (retryable). Un renvoi avec le même run_id ne crée jamais de doublon. Plafonds : 20 "
            "créations par exécution, 40 par jour. " + RUN_ID_HELP
        ),
        scope=WRITE,
        input_schema={
            "type": "object", "additionalProperties": False, "required": ["run_id", "opportunities"],
            "properties": {
                "run_id": {"type": "string", "maxLength": 64, "description": RUN_ID_HELP},
                "preferences_version": {"type": "integer", "minimum": 1,
                                        "description": "Version des critères appliqués (get_watch_preferences)."},
                "opportunities": {"type": "array", "minItems": 1, "maxItems": 20, "items": _OPPORTUNITY_ITEM},
            },
        },
        read_only=False, idempotent=True, handler=_create_opportunities,
    ),
    ToolSpec(
        name="list_recent_opportunities",
        title="JobTracker : offres déjà connues",
        description=(
            "Liste les offres déjà présentes dans JobTracker (titre, entreprise, URL, statut, date), pour ne "
            "pas reproposer les mêmes. Optionnel, avant create_opportunities. Lecture seule."
        ),
        scope=READ,
        input_schema={
            "type": "object", "additionalProperties": False,
            "properties": {
                "days": {"type": "integer", "minimum": 1, "maximum": 60, "default": 14},
                "limit": {"type": "integer", "minimum": 1, "maximum": 100, "default": 50},
            },
        },
        read_only=True, idempotent=True, handler=_list_recent_opportunities,
    ),
    ToolSpec(
        name="get_watch_status",
        title="JobTracker : état de la veille",
        description=(
            "État de la veille : active ou en pause, version des critères, créations restantes aujourd'hui, "
            "maximum par exécution, dernière exécution reçue. Lecture seule."
        ),
        scope=READ, input_schema=_EMPTY, read_only=True, idempotent=True, handler=_get_watch_status,
    ),
    ToolSpec(
        name="report_watch_run",
        title="JobTracker : compte-rendu d'exécution",
        description=(
            "À appeler UNE fois à la FIN de chaque exécution, même sans offre envoyée ou en cas d'échec : "
            "status completed, partial ou failed, avec les chiffres de ta recherche. Le dernier rapport du "
            "run_id fait foi ; JobTracker renvoie aussi ses propres compteurs observés. " + RUN_ID_HELP
        ),
        scope=WRITE,
        input_schema={
            "type": "object", "additionalProperties": False, "required": ["run_id", "status"],
            "properties": {
                "run_id": {"type": "string", "maxLength": 64},
                "status": {"type": "string", "enum": ["completed", "partial", "failed"]},
                "searched_sources": {"type": "integer", "minimum": 0, "maximum": 1000},
                "candidates_considered": {"type": "integer", "minimum": 0, "maximum": 10000},
                "sent": {"type": "integer", "minimum": 0, "maximum": 1000},
                "notes": _STR(500, "Texte brut, 500 caractères au plus."),
            },
        },
        read_only=False, idempotent=True, handler=_report_watch_run,
    ),
]

TOOLS_BY_NAME = {t.name: t for t in TOOLS}


async def call_tool(db, user_id: str, name: str, arguments) -> tuple:
    """
    Exécute un outil métier pour `user_id` (issu du grant). Retourne (payload, is_error).
    Le scope a déjà été vérifié par le transport ; il est revérifié par l'appelant.
    """
    spec = TOOLS_BY_NAME.get(name)
    if spec is None:
        return {"error": {"code": "unknown_tool"}}, True
    if arguments is None:
        arguments = {}
    try:
        if not isinstance(arguments, dict):
            raise ToolError("invalid_arguments", [{"loc": [], "type": "dict_type"}])
        if "user_id" in arguments or "source" in arguments:
            # Propriétaire et source sont imposés par le serveur (spécification §5.2)
            raise ToolError("invalid_arguments", [{"loc": [k], "type": "extra_forbidden"}
                                                  for k in ("user_id", "source") if k in arguments])
        payload = await spec.handler(db, user_id, arguments)
        logger.info("mcp_tool name=%s user_id=%s result=ok", name, user_id)
        return payload, False
    except ToolError as e:
        error = {"code": e.code, "details": e.details}
    except WatchRequestError as e:
        error = {"code": e.code, "details": e.details}
    except WatchNotEnabled:
        error = {"code": "watch_not_enabled"}
    except PyMongoError as e:
        logger.warning("mcp_tool name=%s user_id=%s db_error=%s", name, user_id, type(e).__name__)
        error = {"code": "temporarily_unavailable", "retryable": True}
    logger.info("mcp_tool name=%s user_id=%s result=error code=%s", name, user_id, error["code"])
    return {"error": error}, True
