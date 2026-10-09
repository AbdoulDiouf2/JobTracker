"""
JobTracker SaaS - Configuration
"""

from pydantic_settings import BaseSettings
from typing import Optional, Tuple, List
from dotenv import load_dotenv
import logging
import os
import secrets

# Load .env file
load_dotenv()

logger = logging.getLogger(__name__)


# ============================================
# SECRETS DE SIGNATURE (JWT_SECRET, SECRET_KEY)
# ============================================
# Environnements où un secret absent/faible est remplacé par un secret ÉPHÉMÈRE
# aléatoire (jamais une valeur fixe). Tout autre APP_ENV — y compris absent —
# est traité comme la production : un secret absent ou faible bloque le démarrage.
NON_PRODUCTION_ENVS = {"development", "test"}
SECRET_MIN_LENGTH = 32
SECRET_MIN_DISTINCT_CHARS = 12
# Marqueurs de valeurs d'exemple ou déjà publiées (anciens défauts du code, .env.example)
_PLACEHOLDER_MARKERS = (
    "change", "changer", "votre", "your-", "your_", "example", "exemple", "placeholder",
    "super-secret", "secret-key", "cle-secrete", "replace", "todo",
)


class InsecureSecretError(RuntimeError):
    """Secret de signature absent, prévisible ou trop faible en production."""


def secret_problems(value: Optional[str]) -> List[str]:
    """Raisons pour lesquelles un secret est refusé (ne contient jamais la valeur)."""
    if not value:
        return ["absent"]
    problems = []
    if len(value) < SECRET_MIN_LENGTH:
        problems.append(f"trop court (< {SECRET_MIN_LENGTH} caractères)")
    if len(set(value)) < SECRET_MIN_DISTINCT_CHARS:
        problems.append("trop peu de caractères distincts (non aléatoire)")
    lowered = value.lower()
    if any(marker in lowered for marker in _PLACEHOLDER_MARKERS):
        problems.append("valeur d'exemple ou prévisible")
    return problems


def effective_app_env(app_env: Optional[str], vercel_env: Optional[str] = None) -> str:
    """
    Environnement effectif. Sur Vercel Production/Preview (VERCEL_ENV, posé
    automatiquement par Vercel), les règles de production s'appliquent toujours,
    même si APP_ENV a été réglé par erreur sur development/test.
    """
    if (vercel_env or "").strip().lower() in ("production", "preview"):
        return "production"
    return (app_env or "production").strip().lower()


def resolve_signing_secrets(jwt_secret: Optional[str], secret_key: Optional[str], app_env: Optional[str]) -> Tuple[str, str]:
    """
    Production (APP_ENV absent ou différent de development/test) : refuse tout
    secret absent, prévisible, trop court, ou identique à l'autre secret.
    development/test : un secret absent ou faible est remplacé par un secret
    éphémère aléatoire (les sessions ne survivent pas au redémarrage).
    """
    env = (app_env or "production").strip().lower()
    candidates = {"JWT_SECRET": jwt_secret, "SECRET_KEY": secret_key}

    if env not in NON_PRODUCTION_ENVS:
        errors = [f"{name}: {', '.join(secret_problems(value))}"
                  for name, value in candidates.items() if secret_problems(value)]
        if jwt_secret and secret_key and jwt_secret == secret_key:
            errors.append("JWT_SECRET et SECRET_KEY doivent être différents")
        if errors:
            raise InsecureSecretError(
                "Démarrage refusé — secrets de signature non conformes (APP_ENV="
                f"{env}) : " + " ; ".join(errors)
                + ". Générer : python -c \"import secrets; print(secrets.token_urlsafe(64))\""
            )
        return jwt_secret, secret_key

    resolved = {}
    for name, value in candidates.items():
        if secret_problems(value):
            logger.warning(
                "%s absent ou faible (APP_ENV=%s) : secret éphémère généré pour ce processus.", name, env
            )
            resolved[name] = secrets.token_urlsafe(48)
        else:
            resolved[name] = value
    return resolved["JWT_SECRET"], resolved["SECRET_KEY"]


def _bounded_int(name: str, default: int, minimum: int, maximum: int) -> int:
    """Entier d'environnement borné : une valeur hors bornes bloque le démarrage."""
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        value = int(raw)
    except ValueError:
        raise ValueError(f"{name} doit être un entier")
    if not minimum <= value <= maximum:
        raise ValueError(f"{name} doit être compris entre {minimum} et {maximum}")
    return value


class Settings(BaseSettings):
    # Database
    MONGO_URL: str = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    DB_NAME: str = os.environ.get('DB_NAME', 'jobtracker')
    
    # Environnement : "production" par défaut (sûr). "development" ou "test" uniquement en local/CI.
    APP_ENV: str = os.environ.get('APP_ENV', 'production')

    # JWT — aucune valeur par défaut : validé par resolve_signing_secrets()
    JWT_SECRET: str = os.environ.get('JWT_SECRET', '')
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # CORS
    CORS_ORIGINS: str = os.environ.get('CORS_ORIGINS', '*')
    
    # AI APIs
    EMERGENT_LLM_KEY: Optional[str] = os.environ.get('EMERGENT_LLM_KEY')
    GOOGLE_AI_API_KEY: Optional[str] = os.environ.get('GOOGLE_AI_API_KEY')
    OPENAI_API_KEY: Optional[str] = os.environ.get('OPENAI_API_KEY')
    
    # Google Calendar
    GOOGLE_CALENDAR_CLIENT_ID: Optional[str] = os.environ.get('GOOGLE_CALENDAR_CLIENT_ID')
    GOOGLE_CALENDAR_CLIENT_SECRET: Optional[str] = os.environ.get('GOOGLE_CALENDAR_CLIENT_SECRET')

    # Google OAuth (Native)
    GOOGLE_CLIENT_ID: Optional[str] = os.environ.get('GOOGLE_CLIENT_ID')
    GOOGLE_CLIENT_SECRET: Optional[str] = os.environ.get('GOOGLE_CLIENT_SECRET')
    # Signe le state anti-CSRF du login Google — aucune valeur par défaut, validé comme JWT_SECRET
    SECRET_KEY: str = os.environ.get('SECRET_KEY', '')
    
    # URLs
    BACKEND_URL: str = os.environ.get('BACKEND_URL', 'http://localhost:8001')
    FRONTEND_URL: str = os.environ.get('FRONTEND_URL', 'http://localhost:3000')

    # SMTP
    SMTP_HOST: str = os.environ.get('SMTP_HOST', 'smtppro.zoho.eu')
    SMTP_PORT: int = int(os.environ.get('SMTP_PORT', '465'))
    SMTP_SECURE: bool = os.environ.get('SMTP_SECURE', 'true').lower() == 'true'
    SMTP_USER: str = os.environ.get('SMTP_USER', '')
    SMTP_PASSWORD_APP: str = os.environ.get('SMTP_PASSWORD_APP', '')
    SMTP_FROM_NAME: str = os.environ.get('SMTP_FROM_NAME', 'JobTracker Support')
    SMTP_FROM_EMAIL: str = os.environ.get('SMTP_FROM_EMAIL', '')
    SUPPORT_EMAIL: str = os.environ.get('SUPPORT_EMAIL', 'abdoulam.diouf@maadec.com')

    # Encryption (Fernet key for API keys at rest)
    # Generate: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    ENCRYPTION_KEY: Optional[str] = os.environ.get('ENCRYPTION_KEY')

    # Agent tokens (API d'ingestion externe)
    AGENT_RATE_LIMIT: str = os.environ.get('AGENT_RATE_LIMIT', '30/minute')  # burst, par token
    AGENT_DAILY_CREATE_QUOTA: int = int(os.environ.get('AGENT_DAILY_CREATE_QUOTA', '500'))  # créations/jour/token
    AGENT_MAX_ACTIVE_TOKENS: int = int(os.environ.get('AGENT_MAX_ACTIVE_TOKENS', '10'))  # par utilisateur
    AGENT_LAST_USED_THROTTLE_SECONDS: int = int(os.environ.get('AGENT_LAST_USED_THROTTLE_SECONDS', '300'))

    # Veille ChatGPT (Lot 2) : bornes vérifiées au chargement (_bounded_int)
    WATCH_MAX_PER_RUN: int = _bounded_int('WATCH_MAX_PER_RUN', 20, 1, 20)  # créations par run_id
    WATCH_DAILY_CREATE_QUOTA: int = _bounded_int('WATCH_DAILY_CREATE_QUOTA', 40, 1, 200)  # par utilisateur et jour de Paris
    WATCH_RUN_WINDOW_PAST_HOURS: int = _bounded_int('WATCH_RUN_WINDOW_PAST_HOURS', 6, 1, 12)  # nouvelle exécution
    WATCH_RUN_RESUME_HOURS: int = _bounded_int('WATCH_RUN_RESUME_HOURS', 24, 6, 48)  # reprise d'une exécution connue
    WATCH_RUN_WINDOW_FUTURE_MINUTES: int = _bounded_int('WATCH_RUN_WINDOW_FUTURE_MINUTES', 15, 0, 60)
    WATCH_ITEM_STALE_SECONDS: int = _bounded_int('WATCH_ITEM_STALE_SECONDS', 60, 10, 600)  # reprise d'un élément pending
    WATCH_TIMEZONE: str = "Europe/Paris"  # fixe en v1

    # App
    APP_NAME: str = "JobTracker SaaS"
    DEBUG: bool = os.environ.get('DEBUG', 'false').lower() == 'true'
    
    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()

# Validation au chargement du module : s'applique aussi sur Vercel (où le lifespan ne tourne pas)
settings.JWT_SECRET, settings.SECRET_KEY = resolve_signing_secrets(
    settings.JWT_SECRET, settings.SECRET_KEY,
    effective_app_env(settings.APP_ENV, os.environ.get("VERCEL_ENV")),
)
