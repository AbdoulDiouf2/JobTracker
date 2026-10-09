"""
JobTracker SaaS - Validation métier de la veille ChatGPT (Lot 2)

Fonctions pures (aucun accès base, aucun appel réseau) :
- `parse_run_id` : identifiant d'exécution en heure de Paris (§7.1 de la spécification) ;
- `validate_watch_url` : protections des URL d'offres (§5.7) ;
- normalisation des contrats, pays et niveaux ;
- `check_item` : validation complète d'un élément proposé par ChatGPT (§5.2).

JobTracker ne visite JAMAIS les URL reçues : aucune requête sortante ici.
"""

import hashlib
import ipaddress
import json
import re
import unicodedata
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from urllib.parse import parse_qsl, urlsplit
from zoneinfo import ZoneInfo

from publicsuffixlist import PublicSuffixList
from pydantic import ValidationError

from models.watch import (
    DESCRIPTION_MAX_LENGTH, UNCERTAIN_FIELD_NAMES, WATCH_TIMEZONE, WatchOpportunityItem,
)
from utils.job_urls import MAX_URL_LENGTH, normalize_job_url

PARIS = ZoneInfo(WATCH_TIMEZONE)

# ============================================
# RUN_ID (D5, révision 1.3)
# ============================================

RUN_ID_RE = re.compile(r"^veille-(\d{8})-(\d{4})-(prog|manuel-[a-z0-9]{6})$")


class RunIdError(ValueError):
    """`code` : invalid_run_id | run_id_out_of_window."""

    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


@dataclass(frozen=True)
class ParsedRunId:
    run_id: str
    kind: str  # "prog" | "manuel"
    scheduled_for: datetime  # instant désigné, UTC
    quota_day: str  # date du run_id (heure de Paris), "AAAA-MM-JJ"
    warnings: tuple = ()


def paris_instants(local: datetime) -> List[datetime]:
    """
    Instants UTC correspondant à une heure locale de Paris (naïve).
    - heure normale : 1 instant ;
    - heure ambiguë (passage à l'heure d'hiver) : 2 instants ;
    - heure inexistante (passage à l'heure d'été) : aucun.
    """
    instants = []
    for fold in (0, 1):
        aware = local.replace(tzinfo=PARIS, fold=fold)
        utc = aware.astimezone(timezone.utc)
        if utc.astimezone(PARIS).replace(tzinfo=None) == local and utc not in instants:
            instants.append(utc)
    return instants


def paris_day(instant: datetime) -> str:
    return instant.astimezone(PARIS).strftime("%Y-%m-%d")


def parse_run_id(
    run_id: str,
    now: datetime,
    *,
    known_run: bool,
    schedule_times: List[str],
    past_hours: int,
    resume_hours: int,
    future_minutes: int,
) -> ParsedRunId:
    """
    Valide un run_id et sa fenêtre de validité.

    - Nouvelle exécution : instant désigné entre now - past_hours et now + future_minutes.
    - Reprise (run_id déjà enregistré pour ce compte) : jusqu'à resume_hours dans le passé.
    - Heure inexistante à Paris : invalid_run_id. Heure ambiguë : acceptée si l'une
      des deux occurrences est dans la fenêtre.
    """
    if not isinstance(run_id, str):
        raise RunIdError("invalid_run_id")
    match = RUN_ID_RE.fullmatch(run_id)
    if not match:
        raise RunIdError("invalid_run_id")
    date_part, time_part, kind_part = match.groups()
    try:
        local = datetime.strptime(date_part + time_part, "%Y%m%d%H%M")
    except ValueError:
        raise RunIdError("invalid_run_id")

    instants = paris_instants(local)
    if not instants:
        raise RunIdError("invalid_run_id")

    now = now.astimezone(timezone.utc)
    oldest = now - timedelta(hours=resume_hours if known_run else past_hours)
    latest = now + timedelta(minutes=future_minutes)
    in_window = [i for i in instants if oldest <= i <= latest]
    if not in_window:
        raise RunIdError("run_id_out_of_window")

    kind = "prog" if kind_part == "prog" else "manuel"
    warnings = []
    if kind == "prog" and local.strftime("%H:%M") not in schedule_times:
        warnings.append("slot_not_in_schedule")

    return ParsedRunId(
        run_id=run_id,
        kind=kind,
        scheduled_for=in_window[0],
        quota_day=local.strftime("%Y-%m-%d"),
        warnings=tuple(warnings),
    )


# ============================================
# URL DES OFFRES (D11, §5.7)
# ============================================

class UrlRejected(ValueError):
    """`code` : invalid_url | url_userinfo_forbidden | url_host_forbidden |
    url_port_forbidden | url_redirector_forbidden."""

    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


# Liste fermée, maintenue dans le code (aucune résolution réseau)
URL_SHORTENERS = frozenset({
    "bit.ly", "t.co", "lnkd.in", "goo.gl", "tinyurl.com", "ow.ly", "buff.ly", "is.gd",
    "rebrand.ly", "cutt.ly", "shorturl.at", "tiny.cc", "rb.gy", "t.ly", "s.id", "bl.ink",
    "trib.al", "dlvr.it", "fb.me", "v.gd", "bitly.com", "shorte.st", "adf.ly", "x.co",
    "l.facebook.com", "lm.facebook.com", "l.instagram.com", "out.reddit.com", "href.li",
})
# Paramètres de redirection : refusés s'ils pointent vers un AUTRE domaine
REDIRECT_PARAMS = frozenset({
    "url", "redirect", "redirect_url", "redirect_uri", "redirecturl", "dest", "destination",
    "target", "goto", "next", "u", "out", "link", "to", "r", "continue", "return", "returnurl",
})
FORBIDDEN_HOST_SUFFIXES = (
    ".localhost", ".local", ".internal", ".lan", ".home", ".arpa", ".test", ".example",
    ".invalid", ".localdomain", ".corp",
)
_LABEL_RE = re.compile(r"^(?!-)[a-z0-9-]{1,63}(?<!-)$")

# Public Suffix List embarquée dans le paquet (version épinglée, aucun accès réseau).
# Sections ICANN ET privées : `a.github.io` et `b.github.io` sont deux sites distincts.
_PSL = PublicSuffixList()


@dataclass(frozen=True)
class CheckedUrl:
    url: str
    url_normalized: str
    host: str
    site: str  # domaine enregistrable (eTLD+1, Public Suffix List)
    uncertain: bool  # domaine IDN / punycode (risque d'homographe)


def registrable_domain(host: str) -> Optional[str]:
    """
    Domaine enregistrable (eTLD+1) selon la Public Suffix List : `jobs.acme.co.uk` ->
    `acme.co.uk`. None si le suffixe est inconnu de la liste, ou si l'hôte EST un
    suffixe public (`co.uk`, `github.io`).
    """
    if not host:
        return None
    try:
        ascii_host = host.rstrip(".").encode("idna").decode("ascii").lower()
    except UnicodeError:
        return None
    return _PSL.privatesuffix(ascii_host, accept_unknown=False)


def _check_host(host: str) -> tuple:
    """Retourne (host_ascii, site, uncertain) ou lève UrlRejected."""
    host = host.rstrip(".")
    if not host:
        raise UrlRejected("invalid_url")
    # Adresses IP littérales (y compris formes décimales/hexadécimales abrégées)
    try:
        ipaddress.ip_address(host.strip("[]"))
        is_ip = True
    except ValueError:
        is_ip = False
    if is_ip or re.fullmatch(r"[0-9.]+|0x[0-9a-f.x]+", host):
        raise UrlRejected("url_host_forbidden")
    try:
        ascii_host = host.encode("idna").decode("ascii").lower()
    except UnicodeError:
        raise UrlRejected("invalid_url")
    if ascii_host == "localhost" or ascii_host.endswith(FORBIDDEN_HOST_SUFFIXES):
        raise UrlRejected("url_host_forbidden")
    labels = ascii_host.split(".")
    if len(labels) < 2 or not all(_LABEL_RE.match(label) for label in labels):
        raise UrlRejected("url_host_forbidden")
    # Suffixe inconnu de la Public Suffix List, ou hôte égal à un suffixe public
    site = _PSL.privatesuffix(ascii_host, accept_unknown=False)
    if site is None:
        raise UrlRejected("url_host_forbidden")
    uncertain = ascii_host != host.lower() or any(label.startswith("xn--") for label in labels)
    return ascii_host, site, uncertain


def validate_watch_url(url) -> CheckedUrl:
    """Applique les protections du §5.7, puis la normalisation du Lot 1."""
    if not isinstance(url, str):
        raise UrlRejected("invalid_url")
    url = url.strip()
    if not url or len(url) > MAX_URL_LENGTH or any(c.isspace() or ord(c) < 32 or ord(c) == 127 for c in url):
        raise UrlRejected("invalid_url")
    try:
        parts = urlsplit(url)
        port = parts.port
    except ValueError:
        raise UrlRejected("invalid_url")
    if parts.scheme.lower() != "https" or not parts.netloc:
        raise UrlRejected("invalid_url")
    if "@" in parts.netloc:
        raise UrlRejected("url_userinfo_forbidden")
    if port not in (None, 443):
        raise UrlRejected("url_port_forbidden")
    if not parts.hostname:
        raise UrlRejected("invalid_url")

    host, site, uncertain = _check_host(parts.hostname)
    bare = host[4:] if host.startswith("www.") else host
    if bare in URL_SHORTENERS or host in URL_SHORTENERS or site in URL_SHORTENERS:
        raise UrlRejected("url_redirector_forbidden")
    if re.fullmatch(r"(www\.)?google\.[a-z.]+", host) and parts.path.rstrip("/") == "/url":
        raise UrlRejected("url_redirector_forbidden")

    for key, value in parse_qsl(parts.query, keep_blank_values=True):
        if key.lower() not in REDIRECT_PARAMS:
            continue
        candidate = value.strip()
        if candidate.startswith("//"):
            candidate = "https:" + candidate
        try:
            target = urlsplit(candidate)
            target_host = (target.hostname or "").lower()
        except ValueError:
            continue
        # Cible absolue vers un AUTRE site (ou un site indéterminable) : refus
        if target.scheme.lower() in ("http", "https") and target_host:
            if registrable_domain(target_host) != site:
                raise UrlRejected("url_redirector_forbidden")

    try:
        normalized = normalize_job_url(url)
    except ValueError:
        raise UrlRejected("invalid_url")
    return CheckedUrl(url=url, url_normalized=normalized, host=host, site=site, uncertain=uncertain)


# ============================================
# NORMALISATION (contrats, pays, niveaux)
# ============================================

def _label(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    value = re.sub(r"[-_/().,]+", " ", value.lower())
    return re.sub(r"\s+", " ", value).strip()


_CONTRACT_ALIASES = {
    "permanent": {
        "cdi", "permanent", "permanent contract", "permanent position", "permanent full time",
        "contrat a duree indeterminee", "duree indeterminee", "cdi contrat a duree indeterminee",
        "unbefristet", "unbefristete anstellung", "unbefristeter vertrag", "festanstellung",
        "feste anstellung", "indefinite", "indefinite term", "open ended", "open ended contract",
        "onbepaalde duur", "contract van onbepaalde duur", "vast contract", "vaste aanstelling",
        "unbefristet vollzeit", "contratto a tempo indeterminato", "tempo indeterminato",
    },
    "fixed_term": {
        "cdd", "fixed term", "fixed term contract", "contrat a duree determinee", "duree determinee",
        "befristet", "befristeter vertrag", "bepaalde duur", "contract van bepaalde duur",
        "temporary", "temporaire", "contratto a tempo determinato", "interim",
    },
    "freelance": {"freelance", "free lance", "independant", "contractor", "freiberuflich", "zelfstandige"},
    "internship": {"stage", "stagiaire", "internship", "intern", "praktikum", "stage pfe"},
    "apprenticeship": {
        "alternance", "apprentissage", "apprenticeship", "apprenti", "contrat de professionnalisation",
        "contrat pro", "lehre", "lehrstelle", "work study",
    },
}
_CONTRACT_LOOKUP = {alias: kind for kind, aliases in _CONTRACT_ALIASES.items() for alias in aliases}


def normalize_contract(value) -> Optional[str]:
    if not isinstance(value, str) or not value.strip():
        return None
    return _CONTRACT_LOOKUP.get(_label(value))


_COUNTRY_ALIASES = {
    "FR": {"france", "republique francaise", "frankreich", "frankrijk", "francia"},
    "CH": {"suisse", "switzerland", "schweiz", "svizzera", "zwitserland", "confederation suisse"},
    "BE": {"belgique", "belgium", "belgie", "belgien", "belgio"},
    "LU": {"luxembourg", "luxemburg", "letzebuerg", "lussemburgo", "grand duche de luxembourg"},
}
_COUNTRY_LOOKUP = {alias: code for code, aliases in _COUNTRY_ALIASES.items() for alias in aliases}


def normalize_country(value) -> Optional[str]:
    """Code ISO 3166 alpha-2 en majuscules, ou None si non reconnu."""
    if not isinstance(value, str) or not value.strip():
        return None
    raw = value.strip()
    if re.fullmatch(r"[A-Za-z]{2}", raw):
        return raw.upper()
    return _COUNTRY_LOOKUP.get(_label(raw))


_SENIORITY_ALIASES = {
    "junior": {"junior", "jr"},
    "entry_level": {"entry level", "entry", "debutant", "debutante", "beginner", "berufseinsteiger", "einsteiger"},
    "graduate": {"graduate", "jeune diplome", "jeune diplomee", "jeunes diplomes", "new grad", "absolvent", "young graduate"},
    "mid": {"mid", "mid level", "intermediate", "confirme", "confirmee"},
}
_SENIORITY_LOOKUP = {alias: level for level, aliases in _SENIORITY_ALIASES.items() for alias in aliases}


def normalize_seniority(value) -> Optional[str]:
    """Niveau normalisé, ou None si non reconnu (donc non ciblé)."""
    if not isinstance(value, str) or not value.strip():
        return None
    return _SENIORITY_LOOKUP.get(_label(value))


# ============================================
# VALIDATION D'UN ÉLÉMENT (§5.2)
# ============================================

@dataclass
class ItemCheck:
    item_key: str
    ok: bool
    reasons: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    opportunity: Optional[dict] = None  # champs pour OpportunityCreate
    watch: Optional[dict] = None  # sous-document `watch`


def _pydantic_reasons(error: ValidationError) -> List[str]:
    """Raisons sans écho des valeurs reçues."""
    reasons = []
    for err in error.errors():
        name = str(err["loc"][0]) if err.get("loc") else "item"
        if err["type"] == "extra_forbidden":
            reason = "forbidden_field" if name in ("user_id", "source") else "unknown_field"
        elif err["type"] == "missing":
            reason = f"missing_{name}"
        else:
            reason = f"invalid_{name}"
        if reason not in reasons:
            reasons.append(reason)
    return reasons


def _raw_item_key(raw) -> str:
    """Clé d'un élément invalide : identique pour un même contenu (rejeu)."""
    if isinstance(raw, dict):
        ext = raw.get("external_id")
        if isinstance(ext, str) and ext.strip() and len(ext.strip()) <= 200:
            return "ext:" + ext.strip()
        try:
            return "url:" + validate_watch_url(raw.get("url")).url_normalized
        except UrlRejected:
            pass
    digest = hashlib.sha256(json.dumps(raw, sort_keys=True, default=str).encode("utf-8")).hexdigest()
    return "raw:" + digest


def _clean_evidence(evidence, warnings: List[str]) -> tuple:
    """Retourne (evidence_nettoyée | None, site | None). Invalide -> ignorée + avertissement."""
    if evidence is None:
        return None, None
    if not isinstance(evidence, dict) or not set(evidence) <= {"url", "excerpt"} or "url" not in evidence:
        warnings.append("source_evidence_ignored")
        return None, None
    try:
        checked = validate_watch_url(evidence["url"])
    except UrlRejected:
        warnings.append("source_evidence_ignored")
        return None, None
    excerpt = evidence.get("excerpt")
    if excerpt is not None:
        if not isinstance(excerpt, str) or len(excerpt.strip()) > 500:
            warnings.append("source_evidence_ignored")
            return None, None
        excerpt = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", excerpt.strip())
    cleaned = {"url": checked.url}
    if excerpt:
        cleaned["excerpt"] = excerpt
    return cleaned, checked.site


def check_item(raw, prefs: dict, run_id: str, preferences_version: Optional[int] = None) -> ItemCheck:
    """
    Valide un élément contre le schéma, les règles de sécurité des URL et les
    préférences (règles DÉTERMINISTES, CDC §5.4). Le score de ChatGPT est vérifié
    contre le seuil puis conservé comme estimation, jamais recalculé.
    Toutes les raisons de rejet sont renvoyées, pas seulement la première.
    """
    if not isinstance(raw, dict):
        return ItemCheck(item_key=_raw_item_key(raw), ok=False, reasons=["invalid_item"])

    try:
        item = WatchOpportunityItem.model_validate(raw)
    except ValidationError as e:
        return ItemCheck(item_key=_raw_item_key(raw), ok=False, reasons=_pydantic_reasons(e))

    reasons: List[str] = []
    warnings: List[str] = []
    uncertain: List[str] = []

    checked_url = None
    try:
        checked_url = validate_watch_url(item.url)
        if checked_url.uncertain:
            uncertain.append("url")
    except UrlRejected as e:
        reasons.append(e.code)

    country = normalize_country(item.country)
    if country is None:
        reasons.append("invalid_country")
    elif country not in prefs["countries"]:
        reasons.append("country_not_targeted")

    contract = normalize_contract(item.contract_type)
    if contract is None or contract not in prefs["contract_types"]:
        reasons.append("contract_not_targeted")

    seniority = None
    if item.seniority:
        seniority = normalize_seniority(item.seniority)
        if seniority is None or seniority not in prefs["seniority"]:
            reasons.append("seniority_not_targeted")

    if item.relevance_score < prefs["min_score"]:
        reasons.append("score_below_threshold")

    if item.external_id:
        item_key = "ext:" + item.external_id
    elif checked_url:
        item_key = "url:" + checked_url.url_normalized
    else:
        item_key = _raw_item_key(raw)

    if reasons:
        return ItemCheck(item_key=item_key, ok=False, reasons=reasons)

    description = item.description
    if description and len(description) > DESCRIPTION_MAX_LENGTH:
        description = description[: DESCRIPTION_MAX_LENGTH - 1].rstrip() + "…"
        warnings.append("description_truncated")

    evidence, evidence_site = _clean_evidence(item.source_evidence, warnings)
    if evidence_site and evidence_site != checked_url.site and "url" not in uncertain:
        uncertain.append("url")

    if item.uncertain_fields:
        known = [f for f in item.uncertain_fields if isinstance(f, str) and f in UNCERTAIN_FIELD_NAMES]
        if len(known) != len(item.uncertain_fields):
            warnings.append("uncertain_fields_filtered")
        for name in known:
            if name not in uncertain:
                uncertain.append(name)

    discovered_at = item.discovered_at
    if discovered_at is not None and discovered_at.tzinfo is None:
        discovered_at = discovered_at.replace(tzinfo=timezone.utc)

    opportunity = {
        "title": item.title,
        "company": item.company,
        "url": checked_url.url,
        "location": item.location,
        "country": country,
        # Libellé d'origine conservé (≤ 50) : la conversion du Lot 1 le mappe vers JobType
        "contract_type": item.contract_type[:50],
        "description": description,
        "external_id": item.external_id,
        "discovered_at": discovered_at,
    }
    watch = {
        "run_id": run_id,
        "relevance_score": item.relevance_score,
        "relevance_reasons": item.relevance_reasons,
        "source_evidence": evidence,
        "uncertain_fields": uncertain,
        "preferences_version": preferences_version,
        "contract_category": contract,
        "seniority": seniority,
    }
    return ItemCheck(item_key=item_key, ok=True, warnings=warnings, opportunity=opportunity, watch=watch)
