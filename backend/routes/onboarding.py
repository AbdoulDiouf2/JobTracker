"""
JobTracker SaaS - Routes d'onboarding
"""

from fastapi import APIRouter, HTTPException, status, Depends
from datetime import datetime, timezone

from models import OnboardingStepUpdate, UserResponse
from utils.auth import get_current_user
from routes.auth import _build_user_response

router = APIRouter(prefix="/onboarding", tags=["Onboarding"])


def get_db():
    """Dependency injection pour la DB - sera override dans server.py"""
    pass


@router.post("/step")
async def complete_step(
    step_data: OnboardingStepUpdate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """Marque une étape d'onboarding comme complétée ou ignorée"""
    step_key = f"onboarding_steps.{step_data.step}"
    await db.users.update_one(
        {"id": current_user["user_id"]},
        {"$set": {
            f"{step_key}.completed": not step_data.skipped,
            f"{step_key}.skipped": step_data.skipped,
            f"{step_key}.data": step_data.data,
            f"{step_key}.completed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    return {"ok": True}


@router.post("/complete", response_model=UserResponse)
async def complete_onboarding(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """Marque l'onboarding comme terminé"""
    await db.users.update_one(
        {"id": current_user["user_id"]},
        {"$set": {"onboarding_completed": True}}
    )
    user = await db.users.find_one({"id": current_user["user_id"]})
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur non trouvé")

    return _build_user_response(user)


@router.post("/welcome")
async def mark_welcome_shown(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """Marque le modal de bienvenue comme vu"""
    await db.users.update_one(
        {"id": current_user["user_id"]},
        {"$set": {"welcome_shown": True}}
    )
    return {"ok": True}
