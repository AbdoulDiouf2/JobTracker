"""
JobTracker SaaS - Client ID Metadata Documents (CIMD) du serveur OAuth (Lot 2, P3.1)

Un client MCP sans enregistrement préalable s'identifie par une URL HTTPS (`client_id`) qui
désigne un document JSON publié par son éditeur (draft-ietf-oauth-client-id-metadata-document,
spécification MCP 2025-11-25). JobTracker récupère ce document, le valide, puis traite le
client comme un client PUBLIC (PKCE S256, aucun secret).

Garde-fous :
- politique de confiance gérée par l'admin (désactivée par défaut) : liste EXACTE des hôtes
  autorisés et scopes accordés par défaut (minimaux) ; aucune annonce dans la découverte tant
  qu'elle n'est pas opérationnelle ;
- URL stricte : https, nom de domaine (pas d'IP), port par défaut, chemin sans « . » ni « .. »,
  sans identifiants, requête, fragment ni encodage ;
- anti-SSRF : résolution DNS préalable, refus si UNE adresse n'est pas publique, connexion à
  l'adresse vérifiée (pas de seconde résolution : DNS rebinding), certificat TLS vérifié pour
  le nom d'hôte (SNI), aucune redirection, aucun proxy, délai et taille bornés ;
- document strict : `client_id` identique à l'URL, aucun secret, méthode `none`, nom valide,
  adresses de retour HTTPS exactes ou locales (loopback) ;
- cache contrôlé (Cache-Control borné à [5 min, 24 h]) ; erreurs et documents invalides jamais
  mis en cache ; document indisponible ou invalide : nouvelle autorisation refusée.
"""

import asyncio
import ipaddress
import json
import logging
import re
import socket
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from urllib.parse import urlsplit

import httpx

logger = logging.getLogger("jobtracker.oauth.cimd")

POLICY_KEY = "oauth_cimd_policy"
REGISTRATION = "cimd"
MAX_URL_LENGTH = 512
MAX_DOCUMENT_BYTES = 5 * 1024  # recommandation du brouillon CIMD
FETCH_TIMEOUT = httpx.Timeout(5.0, connect=3.0)
CACHE_MIN, CACHE_DEFAULT, CACHE_MAX = 300, 3600, 86400
MAX_ALLOWED_HOSTS = 20

_HOST_RE = re.compile(r"^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$")
_PATH_RE = re.compile(r"^/[A-Za-z0-9._~!$&'()*+,;=:@/-]{1,400}$")

# Points d'injection pour les tests (aucun réseau réel en test)
_transport: Optional[httpx.AsyncBaseTransport] = None


class CimdError(Exception):
    """Document refusé. `code` est journalisé (jamais le contenu du document)."""

    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


# ============================================
# POLITIQUE DE CONFIANCE (administrateur)
# ============================================

def default_policy() -> dict:
    return {"enabled": False, "allowed_hosts": [], "default_scopes": ["watch:read"]}


def validate_host(host) -> str:
    if not isinstance(host, str) or not _HOST_RE.match(host.strip().lower()) or host.strip() != host.strip().lower():
        raise ValueError("hôte invalide : nom de domaine en minuscules attendu (ex. claude.ai)")
    return host.strip()


async def get_policy(db) -> dict:
    doc = await db.platform_settings.find_one({"key": POLICY_KEY}, {"_id": 0, "value": 1})
    policy = {**default_policy(), **((doc or {}).get("value") or {})}
    policy["enabled"] = policy.get("enabled") is True
    return policy


async def set_policy(db, enabled: bool, allowed_hosts: List[str], default_scopes: List[str], admin_id: str) -> dict:
    from services.oauth_service import validate_allowed_scopes
    hosts = list(dict.fromkeys(validate_host(h) for h in allowed_hosts))
    if len(hosts) > MAX_ALLOWED_HOSTS:
        raise ValueError(f"{MAX_ALLOWED_HOSTS} hôtes au plus")
    scopes = validate_allowed_scopes(default_scopes)
    value = {"enabled": bool(enabled), "allowed_hosts": hosts, "default_scopes": scopes}
    await db.platform_settings.update_one(
        {"key": POLICY_KEY},
        {"$set": {"key": POLICY_KEY, "value": value, "updated_at": _now().isoformat(), "updated_by": admin_id}},
        upsert=True)
    logger.warning("oauth_cimd_policy admin_id=%s enabled=%s hosts=%s scopes=%s",
                   admin_id, value["enabled"], ",".join(hosts), ",".join(scopes))
    return value


def operational(policy: dict) -> bool:
    """CIMD annoncé et utilisable seulement s'il est activé ET qu'au moins un hôte est approuvé."""
    return policy.get("enabled") is True and bool(policy.get("allowed_hosts"))


# ============================================
# URL DU CLIENT
# ============================================

def is_cimd_client_id(client_id) -> bool:
    return isinstance(client_id, str) and client_id.startswith("https://")


def validate_client_id_url(url) -> str:
    """Contrôle STRICT de l'URL servant de client_id. Retourne l'hôte. ValueError sinon."""
    if not isinstance(url, str) or not url or len(url) > MAX_URL_LENGTH or url != url.strip():
        raise ValueError("client_id URL invalide")
    if any(c.isspace() or ord(c) < 32 for c in url) or "%" in url or "\\" in url or "#" in url:
        raise ValueError("client_id URL invalide : caractère interdit")
    try:
        parts = urlsplit(url)
        port = parts.port
    except ValueError:
        raise ValueError("client_id URL invalide")
    if parts.scheme != "https" or not url.startswith("https://"):
        raise ValueError("client_id URL invalide : https obligatoire")
    if parts.username or parts.password or "@" in parts.netloc:
        raise ValueError("client_id URL invalide : identifiants interdits")
    if port is not None or parts.netloc != (parts.hostname or ""):
        raise ValueError("client_id URL invalide : port par défaut uniquement")
    host = parts.hostname or ""
    if not _HOST_RE.match(host) or parts.netloc != parts.netloc.lower():
        raise ValueError("client_id URL invalide : nom de domaine attendu (pas d'adresse IP)")
    if parts.query or url.endswith("?"):
        raise ValueError("client_id URL invalide : pas de requête")
    if not _PATH_RE.match(parts.path) or any(seg in (".", "..") for seg in parts.path.split("/")[1:]) or "//" in parts.path:
        raise ValueError("client_id URL invalide : chemin requis, sans segment « . » ou « .. »")
    return host


# ============================================
# RÉCUPÉRATION PROTÉGÉE (anti-SSRF)
# ============================================

def is_public_ip(value: str) -> bool:
    """Adresse joignable sur Internet : ni privée, ni loopback, ni lien local, ni réservée,
    ni multicast, ni partagée (CGNAT), y compris sous forme IPv4 encapsulée dans IPv6."""
    try:
        ip = ipaddress.ip_address(value.split("%")[0])
    except ValueError:
        return False
    if isinstance(ip, ipaddress.IPv6Address):
        embedded = _embedded_ipv4(ip)
        if embedded is not None:
            # NAT64, 6to4, IPv4-compatible, IPv4-mapped : c'est l'adresse IPv4 portée qui compte
            # (::1 et :: tombent ici sur 0.0.0.1 / 0.0.0.0, non publiques)
            return embedded.is_global and not embedded.is_multicast
    return ip.is_global and not ip.is_multicast


_NAT64_PREFIXES = (ipaddress.ip_network("64:ff9b::/96"), ipaddress.ip_network("64:ff9b:1::/48"))
_IPV4_COMPATIBLE = ipaddress.ip_network("::/96")


def _embedded_ipv4(ip: ipaddress.IPv6Address) -> Optional[ipaddress.IPv4Address]:
    """Adresse IPv4 transportée par une adresse IPv6 de transition (sinon None). Python classe
    ces adresses « globales » : sans ce contrôle, une passerelle NAT64 ou 6to4 permettrait de
    joindre une adresse interne (127.0.0.1, 10.0.0.0/8, 169.254.169.254...)."""
    if ip.ipv4_mapped is not None:
        return ip.ipv4_mapped
    if ip.sixtofour is not None:
        return ip.sixtofour
    if any(ip in net for net in _NAT64_PREFIXES) or ip in _IPV4_COMPATIBLE:
        return ipaddress.IPv4Address(int(ip) & 0xFFFFFFFF)
    return None


async def _resolve(host: str) -> List[str]:
    loop = asyncio.get_running_loop()
    infos = await asyncio.wait_for(
        loop.getaddrinfo(host, 443, type=socket.SOCK_STREAM, proto=socket.IPPROTO_TCP), timeout=3.0)
    return list(dict.fromkeys(info[4][0] for info in infos))


def _cache_seconds(cache_control: str) -> int:
    """Durée de cache bornée : max-age respecté dans [5 min, 24 h] ; no-store/no-cache : minimum."""
    value = (cache_control or "").lower()
    if "no-store" in value or "no-cache" in value:
        return CACHE_MIN
    match = re.search(r"max-age=(\d+)", value)
    seconds = int(match.group(1)) if match else CACHE_DEFAULT
    return max(CACHE_MIN, min(CACHE_MAX, seconds))


async def fetch_document(url: str, host: str) -> tuple:
    """Récupère le document (GET, JSON, sans redirection) depuis une adresse vérifiée.
    Retourne (document, secondes de cache). CimdError sinon."""
    try:
        addresses = await _resolve(host)
    except (OSError, asyncio.TimeoutError):
        raise CimdError("dns_failure")
    if not addresses:
        raise CimdError("dns_failure")
    if not all(is_public_ip(a) for a in addresses):
        raise CimdError("non_public_address")
    address = addresses[0]
    target_host = f"[{address}]" if ":" in address else address
    path = urlsplit(url).path
    try:
        async with httpx.AsyncClient(transport=_transport, timeout=FETCH_TIMEOUT, follow_redirects=False,
                                     trust_env=False) as client:
            async with client.stream(
                "GET", f"https://{target_host}{path}",
                headers={"Host": host, "Accept": "application/json", "User-Agent": "JobTracker-OAuth/1.0"},
                extensions={"sni_hostname": host},  # certificat vérifié pour le NOM, connexion à l'IP vérifiée
            ) as response:
                if response.status_code != 200:
                    raise CimdError("http_redirect" if 300 <= response.status_code < 400 else "http_status")
                content_type = response.headers.get("content-type", "").split(";")[0].strip().lower()
                if content_type != "application/json":
                    raise CimdError("content_type")
                declared = response.headers.get("content-length")
                if declared and declared.isdigit() and int(declared) > MAX_DOCUMENT_BYTES:
                    raise CimdError("too_large")
                body = bytearray()
                async for chunk in response.aiter_bytes():
                    body.extend(chunk)
                    if len(body) > MAX_DOCUMENT_BYTES:
                        raise CimdError("too_large")
                cache = _cache_seconds(response.headers.get("cache-control", ""))
    except CimdError:
        raise
    except httpx.HTTPError:
        raise CimdError("network_error")
    try:
        document = json.loads(bytes(body).decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        raise CimdError("invalid_json")
    return document, cache


# ============================================
# VALIDATION DU DOCUMENT
# ============================================

def validate_document(document, url: str) -> dict:
    """Document conforme au brouillon CIMD et à nos règles. Retourne {name, redirect_uris}."""
    from services.oauth_service import (
        MAX_REDIRECT_URIS, loopback_registration_form, validate_client_name, validate_redirect_uri,
    )
    if not isinstance(document, dict):
        raise CimdError("invalid_document")
    if document.get("client_id") != url:  # comparaison de chaînes EXACTE
        raise CimdError("client_id_mismatch")
    if "client_secret" in document or "client_secret_expires_at" in document:
        raise CimdError("secret_forbidden")
    if document.get("token_endpoint_auth_method", "none") != "none":
        raise CimdError("auth_method_not_none")
    grant_types = document.get("grant_types")
    if grant_types is not None and (not isinstance(grant_types, list) or "authorization_code" not in grant_types):
        raise CimdError("grant_types")
    response_types = document.get("response_types")
    if response_types is not None and (not isinstance(response_types, list) or "code" not in response_types):
        raise CimdError("response_types")
    try:
        name = validate_client_name(document.get("client_name"))
    except ValueError:
        raise CimdError("client_name")
    uris = document.get("redirect_uris")
    if not isinstance(uris, list) or not uris or len(uris) > MAX_REDIRECT_URIS or \
            not all(isinstance(u, str) for u in uris):
        raise CimdError("redirect_uris")
    for uri in uris:
        if uri.startswith("http://"):
            if loopback_registration_form(uri, allow_localhost=True) is None:
                raise CimdError("redirect_uris")
        else:
            try:
                validate_redirect_uri(uri)
            except ValueError:
                raise CimdError("redirect_uris")
    return {"name": name, "redirect_uris": list(dict.fromkeys(uris))}


# ============================================
# CLIENT CIMD (création / actualisation)
# ============================================

async def resolve_client(db, client_id: str, now: Optional[datetime] = None) -> Optional[dict]:
    """
    Client CIMD utilisable pour une NOUVELLE autorisation, ou None (refus).
    - client désactivé par l'admin : refus, sans aucun accès réseau ;
    - politique inactive ou hôte non approuvé : refus, sans accès réseau ;
    - document en cache et frais : utilisé ; sinon récupéré, validé, enregistré ;
    - document indisponible ou invalide : refus (jamais de document périmé ou d'erreur en cache).
    Un nouveau client reçoit les scopes PAR DÉFAUT de la politique (minimaux) et aucun privilège.
    """
    from services.oauth_service import CLIENTS, PUBLIC
    now = now or _now()
    existing = await db[CLIENTS].find_one({"client_id": client_id}, {"_id": 0})
    if existing is not None and (existing.get("registration") != REGISTRATION or existing.get("active") is not True):
        return None
    policy = await get_policy(db)
    if not operational(policy):
        return None
    try:
        host = validate_client_id_url(client_id)
    except ValueError:
        return None
    if host not in policy["allowed_hosts"]:
        logger.info("oauth_cimd result=host_not_allowed host=%s", host)
        return None
    if existing is not None and _aware(existing.get("metadata_cached_until")) and \
            _aware(existing["metadata_cached_until"]) > now:
        return existing
    try:
        document, cache_seconds = await fetch_document(client_id, host)
        meta = validate_document(document, client_id)
    except CimdError as err:
        logger.warning("oauth_cimd result=%s host=%s", err.code, host)
        return None
    fields = {"name": meta["name"], "redirect_uris": meta["redirect_uris"], "metadata_host": host,
              "metadata_fetched_at": now, "metadata_cached_until": now + timedelta(seconds=cache_seconds)}
    if existing is None:
        # Client NON enregistré à ce stade : il ne le sera qu'après un consentement APPROUVÉ
        # (persist_client). Une demande anonyme ou refusée ne crée rien en base.
        return {"client_id": client_id, "client_type": PUBLIC, "registration": REGISTRATION,
                "allowed_scopes": list(policy["default_scopes"]), "secret_hash": None, "active": True,
                "created_at": now, "secret_rotated_at": None, **fields}
    await db[CLIENTS].update_one({"client_id": client_id, "registration": REGISTRATION}, {"$set": fields})
    return await db[CLIENTS].find_one({"client_id": client_id, "active": True}, {"_id": 0})


async def host_allowed(db, client_id: str) -> bool:
    """La politique accepte-t-elle ENCORE ce client (activée, hôte approuvé) ? Sans réseau.
    Revérifié à l'émission du code et à son échange : aucune nouvelle autorisation après le
    retrait d'un domaine ou la désactivation de la politique, même pour une demande en cours."""
    policy = await get_policy(db)
    if not operational(policy):
        return False
    try:
        return validate_client_id_url(client_id) in policy["allowed_hosts"]
    except ValueError:
        return False


SNAPSHOT_FIELDS = ("client_id", "name", "redirect_uris", "allowed_scopes", "metadata_host",
                   "metadata_fetched_at", "metadata_cached_until")


def snapshot(client: dict) -> dict:
    """Données du document validé, conservées dans la demande d'autorisation."""
    return {k: client.get(k) for k in SNAPSHOT_FIELDS}


async def persist_client(db, snap: dict, now: Optional[datetime] = None) -> Optional[dict]:
    """Enregistre le client CIMD APRÈS un consentement approuvé (première connexion) ; si le
    client existe déjà, le renvoie seulement s'il est actif (désactivé par l'admin : refus)."""
    from services.oauth_service import CLIENTS, PUBLIC
    now = now or _now()
    existing = await db[CLIENTS].find_one({"client_id": snap["client_id"]}, {"_id": 0})
    if existing is None:
        record = {**snap, "client_type": PUBLIC, "registration": REGISTRATION, "secret_hash": None,
                  "active": True, "created_at": now, "secret_rotated_at": None}
        try:
            await db[CLIENTS].insert_one(dict(record))
            logger.info("oauth_cimd result=registered host=%s", snap.get("metadata_host"))
        except Exception:  # noqa: BLE001 - course : enregistré entre-temps
            pass
    return await db[CLIENTS].find_one({"client_id": snap["client_id"], "registration": REGISTRATION,
                                        "active": True}, {"_id": 0})
