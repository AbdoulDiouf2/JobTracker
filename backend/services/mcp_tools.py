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

from services import mcp_application_service, opportunity_service, watch_ingest_service, watch_preferences_service
from services.watch_ingest_service import WatchNotEnabled, WatchRequestError

logger = logging.getLogger("jobtracker.mcp")

READ, WRITE = "watch:read", "opportunities:write"
APP_READ, APP_WRITE = "applications:read", "applications:write"

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
    destructive: bool = False


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

async def _get_watch_preferences(db, user_id: str, arguments: dict, client_id: str) -> dict:
    _parse(_NoArguments, arguments)
    await watch_ingest_service.require_enabled(db, user_id)
    prefs = await watch_preferences_service.get_or_create(db, user_id)
    return prefs.model_dump(mode="json")


async def _create_opportunities(db, user_id: str, arguments: dict, client_id: str) -> dict:
    result = await watch_ingest_service.ingest_batch(db, user_id, arguments, client_id=client_id)
    return result.model_dump(mode="json")


async def _list_recent_opportunities(db, user_id: str, arguments: dict, client_id: str) -> dict:
    args = _parse(_RecentArguments, arguments)
    await watch_ingest_service.require_enabled(db, user_id)
    return await opportunity_service.list_recent_summary(db, user_id, args.days, args.limit)


async def _get_watch_status(db, user_id: str, arguments: dict, client_id: str) -> dict:
    _parse(_NoArguments, arguments)
    await watch_ingest_service.require_enabled(db, user_id)
    status = await watch_ingest_service.get_status(db, user_id)
    return {"service": "ok", **status.model_dump(mode="json")}


async def _report_watch_run(db, user_id: str, arguments: dict, client_id: str) -> dict:
    result = await watch_ingest_service.report_watch_run(db, user_id, arguments, client_id=client_id)
    return result.model_dump(mode="json")


async def _application_action(db, user_id: str, arguments: dict, client_id: str, action) -> dict:
    return await action(db, user_id, arguments)


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

_APP_ID = {"type": "object", "additionalProperties": False, "required": ["application_id"],
           "properties": {"application_id": {"type": "string", "minLength": 1, "maxLength": 100}}}
_APP_FIELDS = {
    "entreprise": {"type": "string", "minLength": 1, "maxLength": 200},
    "poste": {"type": "string", "minLength": 1, "maxLength": 200},
    "type_poste": {"type": "string", "enum": ["cdi", "cdd", "stage", "alternance", "freelance", "interim", "mastere"]},
    "lieu": _STR(100), "moyen": {"type": "string", "enum": ["linkedin", "company_website", "email", "indeed", "apec", "pole_emploi", "welcome_to_jungle", "jobteaser", "hello_work", "meteojob", "cadremploi", "glassdoor", "workable", "spontanee", "other"]},
    "date_candidature": {"type": "string", "format": "date-time"}, "lien": _STR(500),
    "commentaire": _STR(2000), "description_poste": _STR(5000),
    "contact_email": _STR(200), "contact_name": _STR(100),
    "salaire_min": {"type": "integer"}, "salaire_max": {"type": "integer"},
    "days_before_reminder": {"type": "integer"},
    "competences": {"type": "array", "items": {"type": "string"}},
    "experience_requise": _STR(100), "cv_id": _STR(100),
}
_APP_CHANGES = {**_APP_FIELDS, "reponse": {"type": "string", "enum": ["to_apply", "pending", "contacted", "positive", "negative", "no_response", "cancelled"]},
                "date_reponse": {"type": "string", "format": "date-time"}, "is_favorite": {"type": "boolean"}}
for _nullable in ("lieu", "moyen", "lien", "commentaire", "description_poste", "contact_email",
                  "contact_name", "salaire_min", "salaire_max", "experience_requise", "cv_id", "date_reponse"):
    _APP_CHANGES[_nullable] = {"anyOf": [_APP_CHANGES[_nullable], {"type": "null"}]}

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
    ToolSpec(
        name="list_applications", title="JobTracker : lister les candidatures",
        description="Liste paginée des candidatures du compte, avec filtres. Inclut les notes et contacts.",
        scope=APP_READ, input_schema={"type": "object", "additionalProperties": False, "properties": {
            "page": {"type": "integer", "minimum": 1, "default": 1},
            "per_page": {"type": "integer", "minimum": 1, "maximum": 100, "default": 20},
            "search": _STR(200), "status": _APP_CHANGES["reponse"], "job_type": _STR(50),
            "method": _STR(50), "is_favorite": {"type": "boolean"},
            "date_from": {"type": "string", "format": "date-time"},
            "date_to": {"type": "string", "format": "date-time"},
        }}, read_only=True, idempotent=True,
        handler=lambda db, uid, args, cid: _application_action(db, uid, args, cid, mcp_application_service.list_applications),
    ),
    ToolSpec(
        name="get_application", title="JobTracker : lire une candidature",
        description="Lit tous les champs d'une candidature du compte, y compris notes et contacts.",
        scope=APP_READ, input_schema=_APP_ID, read_only=True, idempotent=True,
        handler=lambda db, uid, args, cid: _application_action(db, uid, args, cid, mcp_application_service.get_application),
    ),
    ToolSpec(
        name="create_application", title="JobTracker : créer une candidature",
        description="Enregistre une candidature dans JobTracker ; n'envoie rien à l'employeur. Statut to_apply ou pending ; pending exige la date réelle d'envoi.",
        scope=APP_WRITE, input_schema={"type": "object", "additionalProperties": False,
            "required": ["status", "application"], "properties": {
                "status": {"type": "string", "enum": ["to_apply", "pending"]},
                "application": {"type": "object", "additionalProperties": False,
                                "required": ["entreprise", "poste"], "properties": _APP_FIELDS},
            }}, read_only=False, idempotent=False,
        handler=lambda db, uid, args, cid: _application_action(db, uid, args, cid, mcp_application_service.create_application),
    ),
    ToolSpec(
        name="update_application", title="JobTracker : modifier une candidature",
        description="Modifie une candidature. Quitter to_apply exige la vraie date d'envoi.",
        scope=APP_WRITE, input_schema={"type": "object", "additionalProperties": False,
            "required": ["application_id", "changes"], "properties": {
                "application_id": _APP_ID["properties"]["application_id"],
                "changes": {"type": "object", "additionalProperties": False,
                            "minProperties": 1, "properties": _APP_CHANGES},
            }}, read_only=False, idempotent=True,
        handler=lambda db, uid, args, cid: _application_action(db, uid, args, cid, mcp_application_service.update_application),
    ),
    ToolSpec(
        name="delete_application", title="JobTracker : supprimer une candidature",
        description="Supprime définitivement une candidature et tous ses entretiens associés.",
        scope=APP_WRITE, input_schema=_APP_ID, read_only=False, idempotent=True, destructive=True,
        handler=lambda db, uid, args, cid: _application_action(db, uid, args, cid, mcp_application_service.delete_application),
    ),
]

TOOLS_BY_NAME = {t.name: t for t in TOOLS}


IDENTITY_ARGUMENTS = ("user_id", "client_id", "source")


async def call_tool(db, user_id: str, name: str, arguments, client_id: Optional[str] = None) -> tuple:
    """
    Exécute un outil métier pour `user_id` et `client_id`, tous deux issus du grant OAuth
    vérifié (jamais des arguments). Retourne (payload, is_error).
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
        if any(k in arguments for k in IDENTITY_ARGUMENTS):
            # Propriétaire, client et source sont imposés par le serveur (§5.2, P1.4)
            raise ToolError("invalid_arguments", [{"loc": [k], "type": "extra_forbidden"}
                                                  for k in IDENTITY_ARGUMENTS if k in arguments])
        payload = await spec.handler(db, user_id, arguments, client_id)
        logger.info("mcp_tool name=%s user_id=%s client_id=%s result=ok", name, user_id, client_id)
        return payload, False
    except ToolError as e:
        error = {"code": e.code, "details": e.details}
    except WatchRequestError as e:
        error = {"code": e.code, "details": e.details}
    except WatchNotEnabled:
        error = {"code": "watch_not_enabled"}
    except mcp_application_service.ApplicationToolError as e:
        error = {"code": e.code, "details": e.details}
    except PyMongoError as e:
        logger.warning("mcp_tool name=%s user_id=%s db_error=%s", name, user_id, type(e).__name__)
        error = {"code": "temporarily_unavailable", "retryable": True}
    logger.info("mcp_tool name=%s user_id=%s result=error code=%s", name, user_id, error["code"])
    return {"error": error}, True
