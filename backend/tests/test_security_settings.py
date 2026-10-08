"""
Sécurité S3 — secrets de signature (JWT_SECRET, SECRET_KEY).

- validation stricte en production (absent, prévisible, court, identique) ;
- secrets éphémères explicites en development/test (jamais de valeur fixe) ;
- JWT forgés refusés : ancien défaut du code, valeur publiée dans .env.example,
  mauvaise signature, expiration, alg=none, autre algorithme.
"""

import base64
import json
import secrets
import subprocess
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from jose import jwt

from config import (
    InsecureSecretError, resolve_signing_secrets, secret_problems,
    SECRET_MIN_LENGTH, settings,
)
from utils.auth import decode_token

OLD_CODE_DEFAULT_JWT = "super-secret-key-change-in-production"
OLD_CODE_DEFAULT_SESSION = "super-secret-session-key"
BACKEND_DIR = Path(__file__).resolve().parent.parent


def strong() -> str:
    return secrets.token_urlsafe(48)


def published_example_value(key: str):
    """Valeur publiée dans .env.example au commit HEAD d'origine (dépôt public)."""
    try:
        content = subprocess.run(
            ["git", "show", "45d7e98:backend/.env.example"],
            cwd=BACKEND_DIR, capture_output=True, text=True, encoding="utf-8", timeout=10, check=True,
        ).stdout
    except Exception:
        return None
    for line in content.splitlines():
        if line.startswith(f"{key}="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    return None


def forge(secret: str, sub: str = "victim-user-id", **claims) -> str:
    payload = {"sub": sub, "exp": datetime.now(timezone.utc) + timedelta(days=7), **claims}
    return jwt.encode(payload, secret, algorithm="HS256")


# ============================================
# Règles de validation
# ============================================

@pytest.mark.parametrize("value,reason", [
    (None, "absent"),
    ("", "absent"),
    ("short-but-random-Xy9", "trop court"),
    ("a" * 64, "caractères distincts"),
    (OLD_CODE_DEFAULT_JWT, "exemple"),
    (OLD_CODE_DEFAULT_SESSION, "trop court"),
    ("votre-cle-secrete-a-changer-en-production-2026", "exemple"),
    ("please-CHANGE-me-" + secrets.token_hex(16), "exemple"),
], ids=["none", "empty", "short", "low-diversity", "old-jwt-default", "old-session-default",
        "fr-placeholder", "change-me"])
def test_weak_secrets_have_problems(value, reason):
    problems = secret_problems(value)
    assert problems and any(reason in p for p in problems)


def test_strong_secret_has_no_problem():
    assert secret_problems(strong()) == []
    assert secret_problems(secrets.token_hex(32)) == []  # openssl rand -hex 32


def test_published_example_values_are_rejected():
    jwt_value = published_example_value("JWT_SECRET")
    key_value = published_example_value("SECRET_KEY")
    if jwt_value is None:
        pytest.skip("historique git indisponible")
    assert secret_problems(jwt_value), "la valeur publiée de JWT_SECRET doit être refusée"
    assert secret_problems(key_value), "la valeur publiée de SECRET_KEY doit être refusée"


def test_current_env_example_has_no_usable_secret():
    for line in (BACKEND_DIR / ".env.example").read_text(encoding="utf-8").splitlines():
        if line.startswith(("JWT_SECRET=", "SECRET_KEY=")):
            assert line.split("=", 1)[1].strip() == "", line.split("=", 1)[0]


# ============================================
# Production : démarrage refusé
# ============================================

@pytest.mark.parametrize("app_env", [None, "", "production", "preview", "PRODUCTION", "staging"])
def test_production_like_envs_reject_weak_secrets(app_env):
    with pytest.raises(InsecureSecretError):
        resolve_signing_secrets(OLD_CODE_DEFAULT_JWT, strong(), app_env)
    with pytest.raises(InsecureSecretError):
        resolve_signing_secrets(strong(), None, app_env)
    with pytest.raises(InsecureSecretError):
        resolve_signing_secrets("", "", app_env)


def test_production_rejects_identical_secrets():
    value = strong()
    with pytest.raises(InsecureSecretError, match="différents"):
        resolve_signing_secrets(value, value, "production")


def test_production_accepts_strong_distinct_secrets():
    a, b = strong(), strong()
    assert resolve_signing_secrets(a, b, "production") == (a, b)


def test_error_message_never_contains_the_secret():
    leaked = "votre-cle-secrete-a-changer-" + secrets.token_hex(8)
    with pytest.raises(InsecureSecretError) as exc:
        resolve_signing_secrets(leaked, strong(), "production")
    assert leaked not in str(exc.value)
    assert "JWT_SECRET" in str(exc.value)


# ============================================
# development / test : explicite et sûr
# ============================================

@pytest.mark.parametrize("app_env", ["development", "test", "Development"])
def test_non_production_replaces_weak_secrets_with_ephemeral(app_env, caplog):
    jwt_secret, secret_key = resolve_signing_secrets(OLD_CODE_DEFAULT_JWT, None, app_env)
    for value in (jwt_secret, secret_key):
        assert value not in (OLD_CODE_DEFAULT_JWT, OLD_CODE_DEFAULT_SESSION, "")
        assert len(value) >= SECRET_MIN_LENGTH and secret_problems(value) == []
    again, _ = resolve_signing_secrets(OLD_CODE_DEFAULT_JWT, None, app_env)
    assert again != jwt_secret  # éphémère : nouveau à chaque processus
    assert "secret éphémère" in caplog.text


def test_non_production_keeps_strong_secrets():
    a, b = strong(), strong()
    assert resolve_signing_secrets(a, b, "development") == (a, b)


def test_test_session_uses_a_compliant_secret():
    # Quelle que soit la config locale, la session de test signe avec un secret conforme
    assert settings.APP_ENV == "test"
    assert secret_problems(settings.JWT_SECRET) == []
    assert secret_problems(settings.SECRET_KEY) == []


# ============================================
# JWT forgés
# ============================================

def test_token_forged_with_old_code_default_is_rejected():
    assert decode_token(forge(OLD_CODE_DEFAULT_JWT)) is None


def test_token_forged_with_published_example_is_rejected():
    published = published_example_value("JWT_SECRET")
    if published is None:
        pytest.skip("historique git indisponible")
    assert decode_token(forge(published)) is None


def test_token_with_wrong_signature_is_rejected():
    assert decode_token(forge(strong())) is None


def test_expired_token_is_rejected():
    token = jwt.encode(
        {"sub": "u1", "exp": datetime.now(timezone.utc) - timedelta(minutes=1)},
        settings.JWT_SECRET, algorithm="HS256",
    )
    assert decode_token(token) is None


def test_alg_none_token_is_rejected():
    def b64(data: dict) -> str:
        return base64.urlsafe_b64encode(json.dumps(data).encode()).rstrip(b"=").decode()
    unsigned = f"{b64({'alg': 'none', 'typ': 'JWT'})}.{b64({'sub': 'u1', 'exp': 9999999999})}."
    assert decode_token(unsigned) is None


def test_other_algorithm_is_rejected():
    token = jwt.encode({"sub": "u1", "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
                       settings.JWT_SECRET, algorithm="HS512")
    assert decode_token(token) is None


def test_properly_signed_token_is_accepted():
    token = jwt.encode({"sub": "u1", "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
                       settings.JWT_SECRET, algorithm="HS256")
    assert decode_token(token).user_id == "u1"


# ============================================
# Bout en bout HTTP (MongoDB éphémère)
# ============================================

@pytest.mark.anyio
async def test_api_rejects_forged_tokens_and_accepts_real_session(api):
    user_id = api.users["a"]  # compte EXISTANT : la forge viserait un vrai utilisateur
    url = "/api/opportunities/count"  # route protégée par get_current_user (JWT)
    for secret in filter(None, [OLD_CODE_DEFAULT_JWT, published_example_value("JWT_SECRET")]):
        r = await api.get(url, headers={"Authorization": f"Bearer {forge(secret, sub=user_id)}"})
        assert r.status_code == 401
        assert r.json()["detail"] == "Could not validate credentials"

    r = await api.get(url, headers=api.headers_for("a"))
    assert r.status_code == 200 and r.json() == {"new": 0}


# ============================================
# Garde VERCEL_ENV et pré-vol de déploiement (phase B)
# ============================================

from config import effective_app_env  # noqa: E402


@pytest.mark.parametrize("app_env,vercel_env,expected", [
    ("development", "production", "production"),   # APP_ENV erroné sur Vercel : neutralisé
    ("test", "preview", "production"),
    (None, "production", "production"),
    ("development", "development", "development"),  # `vercel dev` en local
    ("development", None, "development"),           # poste local
    (None, None, "production"),                     # défaut sûr
])
def test_effective_app_env(app_env, vercel_env, expected):
    assert effective_app_env(app_env, vercel_env) == expected


def test_vercel_production_never_gets_ephemeral_secrets():
    with pytest.raises(InsecureSecretError):
        resolve_signing_secrets(OLD_CODE_DEFAULT_JWT, None, effective_app_env("development", "production"))


def _load_preflight():
    import importlib.util
    spec = importlib.util.spec_from_file_location("check_signing_secrets", BACKEND_DIR / "scripts" / "check_signing_secrets.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_preflight_accepts_compliant_production_env():
    preflight = _load_preflight()
    assert preflight.check_values({"JWT_SECRET": strong(), "SECRET_KEY": strong()}, "production") == []


@pytest.mark.parametrize("values,expected", [
    ({"JWT_SECRET": "", "SECRET_KEY": "x"}, "JWT_SECRET"),
    ({"SECRET_KEY": "x" * 40}, "JWT_SECRET"),
    ({"JWT_SECRET": "votre-cle-secrete-a-changer-" + "Ab1" * 8}, "SECRET_KEY"),
], ids=["empty-jwt", "missing-jwt", "missing-secret-key"])
def test_preflight_reports_blocking_issues(values, expected):
    preflight = _load_preflight()
    issues = preflight.check_values(values, "production")
    assert issues and any(expected in i for i in issues)


def test_preflight_rejects_identical_secrets_and_never_prints_values(tmp_path, capsys):
    preflight = _load_preflight()
    value = strong()
    env_file = tmp_path / ".env.test"
    env_file.write_text(f"JWT_SECRET={value}\nSECRET_KEY={value}\nAPP_ENV=development\n", encoding="utf-8")
    assert preflight.check_values(preflight.read_env_file(env_file), "production") == [
        "JWT_SECRET et SECRET_KEY sont identiques"
    ]
    import sys as _sys
    argv = _sys.argv
    try:
        _sys.argv = ["check", str(env_file), "--env", "production"]
        assert preflight.main() == 1
    finally:
        _sys.argv = argv
    assert value not in capsys.readouterr().out
