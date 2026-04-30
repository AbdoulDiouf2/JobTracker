"""
JobTracker SaaS - Routes d'authentification
"""

from fastapi import APIRouter, HTTPException, status, Depends, Response, Request
from datetime import timedelta
import httpx
import uuid
import secrets

from slowapi import Limiter
from slowapi.util import get_remote_address

from models import (
    UserCreate, UserLogin, UserUpdate, User, UserResponse, Token, UserRole, OnboardingSteps
)
from utils.auth import (
    verify_password, get_password_hash, create_access_token,
    get_current_user, security
)
from utils.email import send_password_reset_email, send_email_verification
from utils.crypto import encrypt, decrypt
from config import settings
from datetime import timedelta, datetime, timezone
from pydantic import BaseModel, EmailStr
from typing import Optional

router = APIRouter(prefix="/auth", tags=["Authentication"])

limiter = Limiter(key_func=get_remote_address)


def _build_user_response(user: dict) -> UserResponse:
    """Construit un UserResponse depuis un document MongoDB."""
    steps = user.get("onboarding_steps") or {}
    goal_data = (steps.get("goal") or {}).get("data") or {}
    profile_data = (steps.get("profile") or {}).get("data") or {}
    return UserResponse(
        id=user["id"],
        email=user["email"],
        full_name=user["full_name"],
        role=user.get("role", "standard"),
        created_at=user["created_at"],
        last_login=user.get("last_login"),
        is_active=user.get("is_active", True),
        has_google_ai_key=bool(user.get("google_ai_key")),
        has_openai_key=bool(user.get("openai_key")),
        has_groq_key=bool(user.get("groq_key")),
        extension_connected=bool(user.get("extension_connected")),
        onboarding_completed=user.get("onboarding_completed", True),
        welcome_shown=user.get("welcome_shown", True),
        monthly_goal=goal_data.get("monthly_goal"),
        job_title=profile_data.get("job_title"),
        experience_level=profile_data.get("experience_level"),
        sector=profile_data.get("sector"),
        contract_types=profile_data.get("contract_types"),
    )


def get_db():
    """Dependency injection pour la DB - sera override dans server.py"""
    pass


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def register(request: Request, user_data: UserCreate, db = Depends(get_db)):
    """Inscription d'un nouvel utilisateur"""
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Un compte avec cet email existe déjà"
        )

    verification_token = secrets.token_urlsafe(32)

    user = User(
        email=user_data.email,
        full_name=user_data.full_name,
        hashed_password=get_password_hash(user_data.password)
    )

    user_dict = user.model_dump()
    user_dict['created_at'] = user_dict['created_at'].isoformat()
    user_dict['onboarding_completed'] = False
    user_dict['welcome_shown'] = False
    user_dict['onboarding_steps'] = OnboardingSteps().model_dump()
    user_dict['email_verified'] = False
    user_dict['email_verification_token'] = verification_token
    user_dict['verification_token_expires'] = (
        datetime.now(timezone.utc) + timedelta(hours=24)
    ).isoformat()

    await db.users.insert_one(user_dict)

    verify_url = f"{settings.FRONTEND_URL}/verify-email?token={verification_token}"
    send_email_verification(user.email, user.full_name, verify_url)

    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        created_at=user.created_at,
        is_active=user.is_active,
        has_google_ai_key=False,
        has_openai_key=False,
        has_groq_key=False,
        extension_connected=False,
        onboarding_completed=False,
        welcome_shown=False
    )


@router.post("/login", response_model=Token)
@limiter.limit("10/minute")
async def login(request: Request, user_data: UserLogin, db = Depends(get_db)):
    """Connexion utilisateur"""
    user = await db.users.find_one({"email": user_data.email})

    if not user or not user.get("hashed_password") or not verify_password(user_data.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect"
        )

    if not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Compte désactivé"
        )

    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"last_login": datetime.now(timezone.utc).isoformat()}}
    )

    access_token = create_access_token(
        data={"sub": user["id"], "role": user.get("role", "standard")},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    return Token(access_token=access_token)


# ============================================
# EMAIL VERIFICATION
# ============================================

@router.get("/verify-email")
async def verify_email(token: str, db = Depends(get_db)):
    """Vérifie le token d'email et active le compte."""
    user = await db.users.find_one({"email_verification_token": token})
    if not user:
        raise HTTPException(status_code=400, detail="Token invalide ou déjà utilisé")

    expires = datetime.fromisoformat(
        user.get("verification_token_expires", "2000-01-01T00:00:00+00:00").replace("Z", "+00:00")
    )
    if datetime.now(timezone.utc) > expires:
        raise HTTPException(status_code=400, detail="Lien de vérification expiré")

    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "email_verified": True,
            "email_verification_token": None,
            "verification_token_expires": None,
        }}
    )
    return {"message": "Email vérifié avec succès"}


@router.post("/resend-verification")
@limiter.limit("3/minute")
async def resend_verification(request: Request, current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    """Renvoie l'email de vérification."""
    user = await db.users.find_one({"id": current_user["user_id"]})
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    if user.get("email_verified"):
        raise HTTPException(status_code=400, detail="Email déjà vérifié")

    verification_token = secrets.token_urlsafe(32)
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "email_verification_token": verification_token,
            "verification_token_expires": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat(),
        }}
    )
    verify_url = f"{settings.FRONTEND_URL}/verify-email?token={verification_token}"
    send_email_verification(user["email"], user["full_name"], verify_url)
    return {"message": "Email de vérification renvoyé"}


# ============================================
# PASSWORD RESET
# ============================================

class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


@router.post("/forgot-password")
@limiter.limit("3/minute")
async def forgot_password(request: Request, body: ForgotPasswordRequest, db = Depends(get_db)):
    """Envoie un email de réinitialisation de mot de passe."""
    user = await db.users.find_one({"email": body.email})
    # Toujours répondre 200 pour ne pas confirmer l'existence d'un compte
    if not user or not user.get("hashed_password"):
        return {"message": "Si cet email existe, un lien vous a été envoyé"}

    reset_token = secrets.token_urlsafe(32)
    expires = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()

    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"password_reset_token": reset_token, "password_reset_expires": expires}}
    )

    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={reset_token}"
    send_password_reset_email(user["email"], user["full_name"], reset_url)

    return {"message": "Si cet email existe, un lien vous a été envoyé"}


@router.post("/reset-password")
@limiter.limit("5/minute")
async def reset_password(request: Request, body: ResetPasswordRequest, db = Depends(get_db)):
    """Réinitialise le mot de passe via token."""
    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="Le mot de passe doit faire au moins 8 caractères")

    user = await db.users.find_one({"password_reset_token": body.token})
    if not user:
        raise HTTPException(status_code=400, detail="Token invalide ou expiré")

    expires = datetime.fromisoformat(
        user.get("password_reset_expires", "2000-01-01T00:00:00+00:00").replace("Z", "+00:00")
    )
    if datetime.now(timezone.utc) > expires:
        raise HTTPException(status_code=400, detail="Lien de réinitialisation expiré")

    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "hashed_password": get_password_hash(body.new_password),
            "password_reset_token": None,
            "password_reset_expires": None,
        }}
    )
    return {"message": "Mot de passe réinitialisé avec succès"}


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Récupère le profil de l'utilisateur connecté"""
    user = await db.users.find_one({"id": current_user["user_id"]})
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur non trouvé"
        )
    
    return _build_user_response(user)


@router.put("/update-profile", response_model=UserResponse)
async def update_profile(
    user_update: UserUpdate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Met à jour le profil utilisateur"""
    update_data = {k: v for k, v in user_update.model_dump().items() if v is not None}
    
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Aucune donnée à mettre à jour"
        )
    
    await db.users.update_one(
        {"id": current_user["user_id"]},
        {"$set": update_data}
    )
    
    user = await db.users.find_one({"id": current_user["user_id"]})
    return _build_user_response(user)


class ApiKeysUpdate(BaseModel):
    google_ai_key: Optional[str] = None
    openai_key: Optional[str] = None
    groq_key: Optional[str] = None

@router.put("/update-api-keys")
async def update_api_keys(
    body: ApiKeysUpdate = None,
    # legacy query param support
    google_ai_key: str = None,
    openai_key: str = None,
    groq_key: str = None,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Met à jour les clés API IA"""
    # Body takes precedence over query params
    g_key = body.google_ai_key if body and body.google_ai_key is not None else google_ai_key
    o_key = body.openai_key if body and body.openai_key is not None else openai_key
    r_key = body.groq_key if body and body.groq_key is not None else groq_key

    update_data = {}
    if g_key is not None:
        update_data["google_ai_key"] = encrypt(g_key) if g_key else None
    if o_key is not None:
        update_data["openai_key"] = encrypt(o_key) if o_key else None
    if r_key is not None:
        update_data["groq_key"] = encrypt(r_key) if r_key else None
    
    if update_data:
        await db.users.update_one(
            {"id": current_user["user_id"]},
            {"$set": update_data}
        )
    
    return {"message": "Clés API mises à jour"}



# ============================================
# CHROME EXTENSION AUTHENTICATION
# ============================================

import secrets
from pydantic import BaseModel

class ExtensionAuthCode(BaseModel):
    """Code d'authentification pour l'extension Chrome"""
    code: str
    expires_at: str


class ExtensionAuthRequest(BaseModel):
    """Requête d'authentification via code"""
    code: str


def _parse_extension_expiry(value) -> datetime:
    """Parse legacy ISO-string expiries and native Mongo datetimes."""
    if isinstance(value, datetime):
        expiry = value
    else:
        expiry = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    if expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=timezone.utc)
    return expiry


@router.post("/extension/generate-code", response_model=ExtensionAuthCode)
@limiter.limit("5/minute")
async def generate_extension_code(
    request: Request,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Génère un code temporaire pour connecter l'extension Chrome.
    Le code expire après 5 minutes et ne peut être utilisé qu'une fois.
    """
    # Générer un code aléatoire de 8 caractères
    code = secrets.token_urlsafe(6).replace("-", "").replace("_", "")[:8].upper()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)
    
    # Stocker le code en base
    await db.extension_auth_codes.delete_many({"user_id": current_user["user_id"]})
    await db.extension_auth_codes.insert_one({
        "code": code,
        "user_id": current_user["user_id"],
        "expires_at": expires_at,
        "used": False
    })
    
    return ExtensionAuthCode(
        code=code,
        expires_at=expires_at.isoformat()
    )


@router.post("/extension/verify-code", response_model=Token)
@limiter.limit("10/minute")
async def verify_extension_code(
    request: Request,
    auth_request: ExtensionAuthRequest,
    db = Depends(get_db)
):
    """
    Vérifie un code d'extension et retourne un token JWT.
    Utilisé par l'extension pour s'authentifier sans login.
    """
    # Chercher le code
    auth_code = await db.extension_auth_codes.find_one({
        "code": auth_request.code.upper(),
        "used": False
    })
    
    if not auth_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Code invalide ou expiré"
        )
    
    # Vérifier l'expiration
    expires_at = _parse_extension_expiry(auth_code["expires_at"])
    if datetime.now(timezone.utc) > expires_at:
        await db.extension_auth_codes.delete_one({"_id": auth_code["_id"]})
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Code expiré"
        )
    
    # Invalider le code utilise immediatement
    await db.extension_auth_codes.delete_one({"_id": auth_code["_id"]})
    
    # Récupérer l'utilisateur
    user = await db.users.find_one({"id": auth_code["user_id"]})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur non trouvé"
        )

    if not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Compte désactivé"
        )

    # Créer un token longue durée pour l'extension (30 jours)
    access_token = create_access_token(
        data={"sub": user["id"], "role": user.get("role", "standard"), "source": "extension"},
        expires_delta=timedelta(days=30)
    )

    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "extension_connected": True,
            "extension_last_sync": datetime.now(timezone.utc).isoformat(),
        }}
    )
    
    return Token(access_token=access_token)


@router.post("/extension/disconnect")
async def disconnect_extension(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Deconnecte l'extension Chrome cote serveur."""
    now = datetime.now(timezone.utc).isoformat()
    await db.users.update_one(
        {"id": current_user["user_id"]},
        {"$set": {
            "extension_connected": False,
            "extension_disconnected_at": now,
            "extension_last_sync": now,
        }}
    )
    await db.extension_auth_codes.delete_many({"user_id": current_user["user_id"]})
    return {"message": "Extension deconnectee"}


@router.get("/extension/status")
async def get_extension_status(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Vérifie si l'extension est connectée (si un token extension existe).
    """
    user = await db.users.find_one({"id": current_user["user_id"]})
    
    return {
        "connected": bool(user.get("extension_connected")),
        "last_sync": user.get("extension_last_sync"),
        "user_email": user["email"],
        "user_name": user["full_name"]
    }


# ============================================
# GOOGLE OAUTH AUTHENTICATION (stateless, compatible Vercel serverless)
# ============================================

import urllib.parse
from starlette.requests import Request
from starlette.responses import RedirectResponse

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


@router.get("/google/login")
async def google_login(request: Request):
    """Initie le flux OAuth Google (stateless — compatible Vercel)."""
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google OAuth not configured"
        )

    redirect_uri = f"{settings.BACKEND_URL}/api/auth/google/callback"
    # On génère un state signé avec itsdangerous pour la protection CSRF
    from itsdangerous import URLSafeTimedSerializer
    s = URLSafeTimedSerializer(settings.SECRET_KEY)
    state = s.dumps("oauth_state")

    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "online",
    }
    auth_url = f"{GOOGLE_AUTH_URL}?{urllib.parse.urlencode(params)}"
    return RedirectResponse(url=auth_url)


@router.get("/google/callback")
async def google_callback(request: Request, db=Depends(get_db)):
    """Callback Google OAuth — échange le code contre un token JWT."""
    code = request.query_params.get("code")
    state = request.query_params.get("state")
    error = request.query_params.get("error")

    if error or not code:
        return RedirectResponse(url=f"{settings.FRONTEND_URL}/login?error=oauth_cancelled")

    # Vérification du state CSRF
    from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
    s = URLSafeTimedSerializer(settings.SECRET_KEY)
    try:
        s.loads(state, max_age=600)
    except (BadSignature, SignatureExpired):
        return RedirectResponse(url=f"{settings.FRONTEND_URL}/login?error=oauth_invalid_state")

    redirect_uri = f"{settings.BACKEND_URL}/api/auth/google/callback"

    # Échange code → access token
    try:
        async with httpx.AsyncClient() as client:
            token_resp = await client.post(GOOGLE_TOKEN_URL, data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            })
            token_data = token_resp.json()

            if "error" in token_data:
                return RedirectResponse(url=f"{settings.FRONTEND_URL}/login?error=oauth_token_failed")

            # Récupérer les infos utilisateur
            userinfo_resp = await client.get(
                GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {token_data['access_token']}"}
            )
            user_info = userinfo_resp.json()
    except Exception as e:
        return RedirectResponse(url=f"{settings.FRONTEND_URL}/login?error=oauth_failed")

    email = user_info.get("email", "").lower()
    name = user_info.get("name", "")
    picture = user_info.get("picture")

    if not email:
        return RedirectResponse(url=f"{settings.FRONTEND_URL}/login?error=oauth_no_email")

    existing_user = await db.users.find_one({"email": email})
    user_id = None

    if existing_user:
        if not existing_user.get("is_active", True):
            return RedirectResponse(url=f"{settings.FRONTEND_URL}/login?error=account_disabled")
        user_id = existing_user["id"]
        await db.users.update_one(
            {"id": user_id},
            {"$set": {
                "google_picture": picture,
                "last_login": datetime.now(timezone.utc).isoformat(),
                "auth_provider": "google",
            }}
        )
    else:
        user_id = str(uuid.uuid4())
        new_user = {
            "id": user_id,
            "email": email,
            "full_name": name,
            "hashed_password": None,
            "role": "standard",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "is_active": True,
            "last_login": datetime.now(timezone.utc).isoformat(),
            "google_picture": picture,
            "auth_provider": "google",
            "google_ai_key": None,
            "openai_key": None,
            "groq_key": None,
            "onboarding_completed": False,
            "welcome_shown": False,
            "email_verified": True,  # Google garantit l'email
            "onboarding_steps": OnboardingSteps().model_dump(),
        }
        await db.users.insert_one(new_user)

    access_token = create_access_token(
        data={"sub": user_id, "role": "standard", "provider": "google"},
        expires_delta=timedelta(days=7)
    )

    redirect_url = f"{settings.FRONTEND_URL}/auth/callback#session_id={access_token}"
    return RedirectResponse(url=redirect_url)
