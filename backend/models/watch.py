"""
JobTracker SaaS - Modèles de la veille ChatGPT (Lot 2)

ChatGPT cherche et qualifie les offres ; JobTracker reçoit, valide, déduplique
et stocke. Ces modèles ne contiennent aucune logique de recherche.

Les éléments d'un envoi groupé sont validés UN PAR UN (WatchOpportunityItem) :
un élément invalide est rejeté avec ses raisons, sans faire échouer l'appel.
"""

import re
from datetime import datetime
from typing import Any, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

# ============================================
# VOCABULAIRES FERMÉS
# ============================================

JOB_FAMILIES = ("data_engineering", "data_science", "big_data", "ai_ml", "data_analytics", "mlops", "bi")
SENIORITY_LEVELS = ("junior", "entry_level", "graduate", "mid")
CONTRACT_TYPES = ("permanent", "fixed_term", "freelance", "internship", "apprenticeship")
RUN_REPORT_STATUSES = ("completed", "partial", "failed")
UNCERTAIN_FIELD_NAMES = (
    "title", "company", "url", "country", "location", "contract_type",
    "seniority", "description", "discovered_at", "external_id",
)

WATCH_TIMEZONE = "Europe/Paris"
MAX_ITEMS_PER_CALL = 20
DESCRIPTION_MAX_LENGTH = 10000
# Au-delà, l'élément est rejeté (protection contre les charges démesurées)
DESCRIPTION_HARD_LIMIT = 50000

_TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
_CONTROL_CHARS_RE = re.compile(r"[\x00-\x1f\x7f]")


def _clean_text_list(values: List[str], max_length: int) -> List[str]:
    cleaned = []
    for value in values:
        if not isinstance(value, str):
            raise ValueError("chaîne attendue")
        value = value.strip()
        if not value or len(value) > max_length or _CONTROL_CHARS_RE.search(value):
            raise ValueError(f"élément vide, trop long (max {max_length}) ou invalide")
        cleaned.append(value)
    if len({v.lower() for v in cleaned}) != len(cleaned):
        raise ValueError("doublons interdits")
    return cleaned


# ============================================
# PRÉFÉRENCES
# ============================================

class WatchSchedule(BaseModel):
    """Horaires DÉCLARÉS de la veille. Informatif : ne programme rien dans ChatGPT."""
    model_config = ConfigDict(extra="forbid")

    timezone: Literal["Europe/Paris"] = WATCH_TIMEZONE  # fixe en v1
    times: List[str] = Field(..., min_length=1, max_length=4)

    @field_validator("times")
    @classmethod
    def _check_times(cls, v: List[str]) -> List[str]:
        for t in v:
            if not isinstance(t, str) or not _TIME_RE.match(t):
                raise ValueError("format HH:MM attendu (00:00 à 23:59)")
        if len(set(v)) != len(v):
            raise ValueError("horaires en double")
        return sorted(v)


class WatchPreferencesFields(BaseModel):
    """Champs éditables des préférences (§5.1 de la spécification, D12)."""
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    active: bool
    countries: List[str] = Field(..., min_length=1, max_length=10)
    job_families: List[Literal[JOB_FAMILIES]] = Field(..., min_length=1, max_length=len(JOB_FAMILIES))
    title_keywords: List[str] = Field(default_factory=list, max_length=20)
    exclusions: List[str] = Field(default_factory=list, max_length=20)
    seniority: List[Literal[SENIORITY_LEVELS]] = Field(..., min_length=1, max_length=len(SENIORITY_LEVELS))
    contract_types: List[Literal[CONTRACT_TYPES]] = Field(..., min_length=1, max_length=len(CONTRACT_TYPES))
    languages: List[str] = Field(..., min_length=1, max_length=10)
    min_score: int = Field(..., ge=50, le=100)
    max_per_run: int = Field(..., ge=1, le=MAX_ITEMS_PER_CALL)
    schedule: WatchSchedule
    scoring_rubric: str = Field(..., min_length=1, max_length=1500)

    @field_validator("countries", mode="before")
    @classmethod
    def _check_countries(cls, v):
        if not isinstance(v, list):
            raise ValueError("liste attendue")
        out = []
        for c in v:
            if not isinstance(c, str) or not re.fullmatch(r"[A-Za-z]{2}", c.strip()):
                raise ValueError("code pays ISO 3166 alpha-2 attendu")
            out.append(c.strip().upper())
        if len(set(out)) != len(out):
            raise ValueError("pays en double")
        return out

    @field_validator("languages", mode="before")
    @classmethod
    def _check_languages(cls, v):
        if not isinstance(v, list):
            raise ValueError("liste attendue")
        out = []
        for c in v:
            if not isinstance(c, str) or not re.fullmatch(r"[A-Za-z]{2}", c.strip()):
                raise ValueError("code langue ISO 639-1 attendu")
            out.append(c.strip().lower())
        if len(set(out)) != len(out):
            raise ValueError("langues en double")
        return out

    @field_validator("job_families", "seniority", "contract_types")
    @classmethod
    def _no_duplicates(cls, v):
        if len(set(v)) != len(v):
            raise ValueError("valeurs en double")
        return v

    @field_validator("title_keywords", "exclusions")
    @classmethod
    def _check_keywords(cls, v):
        return _clean_text_list(v, 60)

    @field_validator("scoring_rubric")
    @classmethod
    def _check_rubric(cls, v: str) -> str:
        if re.search(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", v):
            raise ValueError("caractères de contrôle interdits")
        return v


class WatchPreferencesUpdate(WatchPreferencesFields):
    """Mise à jour complète, avec contrôle de version (P5) : sans la bonne
    version attendue, la modification est refusée (409) au lieu d'écraser."""
    expected_version: int = Field(..., ge=1)


class WatchPreferencesResponse(WatchPreferencesFields):
    model_config = ConfigDict(extra="ignore")

    preferences_version: int
    updated_at: datetime


# ============================================
# INGESTION (create_opportunities)
# ============================================

class WatchBatchRequest(BaseModel):
    """Enveloppe d'un envoi groupé. Les éléments restent bruts : ils sont validés
    un par un pour qu'un élément invalide ne fasse pas échouer tout l'appel."""
    model_config = ConfigDict(extra="forbid")

    run_id: str = Field(..., min_length=1, max_length=64)
    preferences_version: Optional[int] = Field(None, ge=1)
    # Any : un élément qui n'est pas un objet est rejeté seul (`invalid_item`), pas l'appel
    opportunities: List[Any] = Field(..., min_length=1, max_length=MAX_ITEMS_PER_CALL)


class WatchOpportunityItem(BaseModel):
    """Un élément proposé par ChatGPT. `user_id` et `source` sont interdits
    (extra=forbid) : le propriétaire et la source sont imposés par le serveur."""
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    title: str = Field(..., min_length=1, max_length=200)
    company: str = Field(..., min_length=1, max_length=200)
    url: str = Field(..., min_length=1, max_length=2000)
    country: str = Field(..., min_length=1, max_length=100)
    location: Optional[str] = Field(None, max_length=200)
    contract_type: str = Field(..., min_length=1, max_length=100)
    seniority: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = Field(None, max_length=DESCRIPTION_HARD_LIMIT)
    external_id: Optional[str] = Field(None, min_length=1, max_length=200)
    discovered_at: Optional[datetime] = None
    relevance_score: int = Field(..., ge=0, le=100, strict=True)
    relevance_reasons: List[str] = Field(..., min_length=1, max_length=5)
    source_evidence: Optional[Any] = None  # invalide -> ignoré avec avertissement
    uncertain_fields: Optional[List[Any]] = None  # noms inconnus -> ignorés

    @field_validator("title", "company", "location", "external_id")
    @classmethod
    def _no_control_chars(cls, v):
        if v is not None and _CONTROL_CHARS_RE.search(v):
            raise ValueError("caractères de contrôle interdits")
        return v

    @field_validator("relevance_reasons")
    @classmethod
    def _check_reasons(cls, v):
        return _clean_text_list(v, 200)


class WatchItemResult(BaseModel):
    index: int
    status: Literal["created", "duplicate", "rejected", "error"]
    opportunity_id: Optional[str] = None
    duplicate_reason: Optional[Literal["external_id", "url"]] = None
    reasons: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    replayed: bool = False
    retryable: bool = False


class WatchBatchSummary(BaseModel):
    """Résultats par statut. `replayed` : éléments déjà traités dont le résultat
    enregistré est renvoyé (aucune nouvelle écriture). Les écritures réelles de
    l'exécution sont dans `WatchRunTotals`."""
    received: int = 0
    replayed: int = 0
    created: int = 0
    duplicate: int = 0
    rejected: int = 0
    error: int = 0


class WatchRunTotals(BaseModel):
    created: int
    remaining_for_run: int
    remaining_today: int


class WatchBatchResult(BaseModel):
    run_id: str
    summary: WatchBatchSummary
    run_totals: WatchRunTotals
    warnings: List[str] = Field(default_factory=list)
    results: List[WatchItemResult]


# ============================================
# RAPPORT DE FIN D'EXÉCUTION (report_watch_run)
# ============================================

class WatchRunReport(BaseModel):
    """Chiffres DÉCLARÉS par ChatGPT, conservés à côté des compteurs observés."""
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    run_id: str = Field(..., min_length=1, max_length=64)
    status: Literal[RUN_REPORT_STATUSES]
    searched_sources: Optional[int] = Field(None, ge=0, le=1000)
    candidates_considered: Optional[int] = Field(None, ge=0, le=10000)
    sent: Optional[int] = Field(None, ge=0, le=1000)
    notes: Optional[str] = Field(None, max_length=500)

    @field_validator("notes")
    @classmethod
    def _plain_notes(cls, v):
        if v is not None and re.search(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", v):
            raise ValueError("caractères de contrôle interdits")
        return v


class WatchRunCounts(BaseModel):
    created: int = 0
    duplicate: int = 0
    rejected: int = 0
    error: int = 0


class WatchRunReportResult(BaseModel):
    run_id: str
    recorded: bool = True
    observed: WatchRunCounts


# ============================================
# LECTURE (statut, historique)
# ============================================

class WatchRunSummary(BaseModel):
    """Exécution OBSERVÉE par JobTracker (faits reçus uniquement)."""
    model_config = ConfigDict(extra="ignore")

    run_id: str
    kind: Literal["prog", "manuel"]
    scheduled_for: datetime
    quota_day: str
    first_seen_at: datetime
    last_seen_at: datetime
    observed: WatchRunCounts
    warnings: List[str] = Field(default_factory=list)
    report: Optional[dict] = None


class WatchRunListResponse(BaseModel):
    items: List[WatchRunSummary]


class WatchStatusResponse(BaseModel):
    active: bool
    preferences_version: int
    max_per_run: int
    daily_quota: int
    remaining_today: int
    timezone: str = WATCH_TIMEZONE
    last_run: Optional[WatchRunSummary] = None
    # Calcul paresseux, indicatif (§7 bis, niveau 2) : créneaux déclarés passés
    # depuis plus de 30 min sans aucune exécution reçue. Aucune notification.
    presumed_missing_slots: List[datetime] = Field(default_factory=list)
