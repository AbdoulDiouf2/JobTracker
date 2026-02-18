"""
JobTracker SaaS - Routes d'authentification
"""

from fastapi import APIRouter, HTTPException, status, Depends, Response, Request
from datetime import timedelta
import httpx
import uuid

from models import (
    UserCreate, UserLogin, UserUpdate, User, UserResponse, Token, UserRole
)
from utils.auth import (
    verify_password, get_password_hash, create_access_token, 
    get_current_user, security
)
from config import settings
from datetime import timedelta, datetime, timezone

router = APIRouter(prefix="/auth", tags=["Authentication"])


def get_db():
    """Dependency injection pour la DB - sera override dans server.py"""
    pass


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, db = Depends(get_db)):
    """Inscription d'un nouvel utilisateur"""
    # Vérifier si l'email existe déjà
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Un compte avec cet email existe déjà"
        )
    
    # Créer l'utilisateur
    user = User(
        email=user_data.email,
        full_name=user_data.full_name,
        hashed_password=get_password_hash(user_data.password)
    )
    
    user_dict = user.model_dump()
    user_dict['created_at'] = user_dict['created_at'].isoformat()
    
    await db.users.insert_one(user_dict)
    
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        created_at=user.created_at,
        is_active=user.is_active,
        has_google_ai_key=False,
        has_openai_key=False,
        has_groq_key=False
    )


@router.post("/login", response_model=Token)
async def login(user_data: UserLogin, db = Depends(get_db)):
    """Connexion utilisateur"""
    user = await db.users.find_one({"email": user_data.email})
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect"
        )
    
    if not verify_password(user_data.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect"
        )
    
    if not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Compte désactivé"
        )
    
    # Mettre à jour la dernière connexion
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"last_login": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Créer le token avec le rôle
    access_token = create_access_token(
        data={"sub": user["id"], "role": user.get("role", "standard")},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    
    return Token(access_token=access_token)


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
    
    return UserResponse(
        id=user["id"],
        email=user["email"],
        full_name=user["full_name"],
        role=user.get("role", "standard"),
        created_at=user["created_at"] if isinstance(user["created_at"], str) else user["created_at"],
        last_login=user.get("last_login"),
        is_active=user.get("is_active", True),
        has_google_ai_key=bool(user.get("google_ai_key")),
        has_openai_key=bool(user.get("openai_key")),
        has_groq_key=bool(user.get("groq_key"))
    )


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
        has_groq_key=bool(user.get("groq_key"))
    )


@router.put("/update-api-keys")
async def update_api_keys(
    google_ai_key: str = None,
    openai_key: str = None,
    groq_key: str = None,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Met à jour les clés API IA"""
    update_data = {}
    if google_ai_key is not None:
        update_data["google_ai_key"] = google_ai_key if google_ai_key else None
    if openai_key is not None:
        update_data["openai_key"] = openai_key if openai_key else None
    if groq_key is not None:
        update_data["groq_key"] = groq_key if groq_key else None
    
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


@router.post("/extension/generate-code", response_model=ExtensionAuthCode)
async def generate_extension_code(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Génère un code temporaire pour connecter l'extension Chrome.
    Le code expire après 5 minutes et ne peut être utilisé qu'une fois.
    """
    # Générer un code aléatoire de 8 caractères
    code = secrets.token_urlsafe(6)[:8].upper()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)
    
    # Stocker le code en base
    await db.extension_auth_codes.delete_many({"user_id": current_user["user_id"]})
    await db.extension_auth_codes.insert_one({
        "code": code,
        "user_id": current_user["user_id"],
        "expires_at": expires_at.isoformat(),
        "used": False
    })
    
    return ExtensionAuthCode(
        code=code,
        expires_at=expires_at.isoformat()
    )


@router.post("/extension/verify-code", response_model=Token)
async def verify_extension_code(
    request: ExtensionAuthRequest,
    db = Depends(get_db)
):
    """
    Vérifie un code d'extension et retourne un token JWT.
    Utilisé par l'extension pour s'authentifier sans login.
    """
    # Chercher le code
    auth_code = await db.extension_auth_codes.find_one({
        "code": request.code.upper(),
        "used": False
    })
    
    if not auth_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Code invalide ou expiré"
        )
    
    # Vérifier l'expiration
    expires_at = datetime.fromisoformat(auth_code["expires_at"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc) > expires_at:
        await db.extension_auth_codes.delete_one({"_id": auth_code["_id"]})
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Code expiré"
        )
    
    # Marquer comme utilisé
    await db.extension_auth_codes.update_one(
        {"_id": auth_code["_id"]},
        {"$set": {"used": True}}
    )
    
    # Récupérer l'utilisateur
    user = await db.users.find_one({"id": auth_code["user_id"]})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur non trouvé"
        )
    
    # Créer un token longue durée pour l'extension (30 jours)
    access_token = create_access_token(
        data={"sub": user["id"], "role": user.get("role", "standard"), "source": "extension"},
        expires_delta=timedelta(days=30)
    )
    
    return Token(access_token=access_token)


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
# GOOGLE OAUTH AUTHENTICATION (Emergent Auth)
# ============================================
# REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH

from pydantic import BaseModel as PydanticBaseModel

class GoogleSessionRequest(PydanticBaseModel):
    """Requête pour échanger un session_id Google"""
    session_id: str


class GoogleUserResponse(PydanticBaseModel):
    """Réponse utilisateur après auth Google"""
    id: str
    email: str
    full_name: str
    picture: str | None = None
    access_token: str
    is_new_user: bool = False


@router.post("/google/session", response_model=GoogleUserResponse)
async def exchange_google_session(
    request: GoogleSessionRequest,
    response: Response,
    db = Depends(get_db)
):
    """
    Échange un session_id Emergent Auth contre les données utilisateur et un JWT.
    Crée l'utilisateur s'il n'existe pas.
    """
    # Appeler l'API Emergent Auth pour récupérer les données de session
    async with httpx.AsyncClient() as client:
        try:
            auth_response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": request.session_id},
                timeout=10.0
            )
            
            if auth_response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Session invalide ou expirée"
                )
            
            google_data = auth_response.json()
        except httpx.RequestError:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Service d'authentification indisponible"
            )
    
    email = google_data.get("email", "").lower()
    name = google_data.get("name", "")
    picture = google_data.get("picture")
    session_token = google_data.get("session_token")
    
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email non fourni par Google"
        )
    
    # Chercher l'utilisateur existant
    existing_user = await db.users.find_one({"email": email}, {"_id": 0})
    is_new_user = False
    
    if existing_user:
        # Utilisateur existant - mettre à jour les infos Google
        user_id = existing_user["id"]
        await db.users.update_one(
            {"id": user_id},
            {"$set": {
                "google_picture": picture,
                "last_login": datetime.now(timezone.utc).isoformat(),
                "auth_provider": "google"
            }}
        )
    else:
        # Nouvel utilisateur - créer le compte
        user_id = str(uuid.uuid4())
        is_new_user = True
        
        new_user = {
            "id": user_id,
            "email": email,
            "full_name": name,
            "hashed_password": None,  # Pas de mot de passe pour auth Google
            "role": "standard",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "is_active": True,
            "last_login": datetime.now(timezone.utc).isoformat(),
            "google_picture": picture,
            "auth_provider": "google",
            "google_ai_key": None,
            "openai_key": None,
            "groq_key": None
        }
        
        await db.users.insert_one(new_user)
    
    # Stocker la session Google (optionnel, pour logout global)
    if session_token:
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        await db.google_sessions.update_one(
            {"user_id": user_id},
            {"$set": {
                "session_token": session_token,
                "expires_at": expires_at.isoformat(),
                "created_at": datetime.now(timezone.utc).isoformat()
            }},
            upsert=True
        )
    
    # Créer notre propre JWT
    access_token = create_access_token(
        data={"sub": user_id, "role": "standard", "provider": "google"},
        expires_delta=timedelta(days=7)
    )
    
    # Récupérer l'utilisateur mis à jour
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    
    return GoogleUserResponse(
        id=user_id,
        email=email,
        full_name=user.get("full_name", name),
        picture=picture,
        access_token=access_token,
        is_new_user=is_new_user
    )
