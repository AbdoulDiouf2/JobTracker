"""
JobTracker SaaS - Routes d'authentification
"""

from fastapi import APIRouter, HTTPException, status, Depends
from datetime import timedelta

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
        has_openai_key=False
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
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Met à jour les clés API IA"""
    update_data = {}
    if google_ai_key is not None:
        update_data["google_ai_key"] = google_ai_key if google_ai_key else None
    if openai_key is not None:
        update_data["openai_key"] = openai_key if openai_key else None
    
    if update_data:
        await db.users.update_one(
            {"id": current_user["user_id"]},
            {"$set": update_data}
        )
    
    return {"message": "Clés API mises à jour"}
