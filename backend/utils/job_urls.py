"""
JobTracker SaaS - Utilitaires URL des offres d'emploi

- validation stricte http/https ;
- normalisation pour le dédoublonnage ;
- détection de la plateforme (moyen de candidature) depuis l'URL.
"""

from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode

MAX_URL_LENGTH = 2000

# Paramètres de tracking neutralisés lors de la normalisation.
# Liste volontairement conservatrice : un paramètre inconnu est conservé car il
# peut identifier l'offre (ex: Indeed ?jk=..., ATS ?id=...).
TRACKING_PARAM_PREFIXES = ("utm_",)
TRACKING_PARAMS = {
    "gclid", "fbclid", "msclkid", "mc_cid", "mc_eid", "_hsenc", "_hsmi",
    # LinkedIn
    "trk", "trackingid", "refid",
}


def validate_http_url(url: str) -> str:
    """Valide une URL absolue http(s). Retourne l'URL nettoyée ou lève ValueError."""
    if not isinstance(url, str):
        raise ValueError("URL invalide")
    url = url.strip()
    if not url or len(url) > MAX_URL_LENGTH:
        raise ValueError(f"URL vide ou trop longue (max {MAX_URL_LENGTH} caractères)")
    if any(c.isspace() or ord(c) < 32 for c in url):
        raise ValueError("URL invalide : caractères interdits")
    try:
        parts = urlsplit(url)
        parts.port  # lève ValueError si le port est invalide
    except ValueError:
        raise ValueError("URL invalide")
    if parts.scheme.lower() not in ("http", "https"):
        raise ValueError("Seules les URLs http(s) sont acceptées")
    if not parts.hostname:
        raise ValueError("URL invalide : domaine manquant")
    return url


def _is_tracking_param(key: str) -> bool:
    k = key.lower()
    return k in TRACKING_PARAMS or k.startswith(TRACKING_PARAM_PREFIXES)


def normalize_job_url(url: str) -> str:
    """
    Clé de dédoublonnage d'une URL d'offre.

    Neutralise : schéma http/https, casse du domaine, préfixe www., port par
    défaut, identifiants, fragment, slash final, paramètres de tracking et
    ordre des paramètres. Les autres paramètres sont conservés.
    """
    parts = urlsplit(validate_http_url(url))

    host = parts.hostname.lower()
    if host.startswith("www."):
        host = host[4:]
    port = parts.port
    netloc = host if port in (None, 80, 443) else f"{host}:{port}"

    path = parts.path or "/"
    if len(path) > 1:
        path = path.rstrip("/") or "/"

    params = [
        (k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True)
        if not _is_tracking_param(k)
    ]
    query = urlencode(sorted(params))

    return urlunsplit(("https", netloc, path, query, ""))


def detect_platform(url: str) -> str:
    """Déduit le moyen de candidature (ApplicationMethod) depuis l'URL de l'offre."""
    url = (url or "").lower()
    if "linkedin" in url:
        return "linkedin"
    if "indeed" in url:
        return "indeed"
    if "welcometothejungle" in url:
        return "welcome_to_jungle"
    if "apec" in url:
        return "apec"
    if "pole-emploi" in url or "francetravail" in url:
        return "pole_emploi"
    return "other"
