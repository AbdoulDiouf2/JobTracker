"""
JobTracker SaaS - Routes Administration
Panel admin pour la gestion multi-tenant
"""

from fastapi import APIRouter, HTTPException, status, Depends, Query
from datetime import datetime, timezone, timedelta
from typing import Optional

from models import (
    UserResponse, UserAdminResponse, UserRole, AdminDashboardStats,
    AdminUserUpdate, AdminUserCreate, UserGrowthDataPoint, ActivityDataPoint, PaginatedResponse,
    SupportTicket, SupportTicketStatus, SupportTicketUpdate
)
from passlib.context import CryptContext
import uuid

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
from utils.auth import get_current_user
from utils.ai_quota import DAILY_QUOTA

router = APIRouter(prefix="/admin", tags=["Administration"])


def get_db():
    """Dependency injection pour la DB - sera override dans server.py"""
    pass


async def get_admin_user(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Vérifie que l'utilisateur est admin"""
    user = await db.users.find_one({"id": current_user["user_id"]})
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur non trouvé"
        )
    
    if user.get("role", "standard") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux administrateurs"
        )
    
    return user


# ============================================
# DASHBOARD ADMIN
# ============================================

@router.get("/dashboard", response_model=AdminDashboardStats)
async def get_admin_dashboard(
    admin_user: dict = Depends(get_admin_user),
    db = Depends(get_db)
):
    """Récupère les statistiques globales pour le dashboard admin"""
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)
    
    # Total utilisateurs
    total_users = await db.users.count_documents({})
    
    # Utilisateurs actifs (connectés dans les 7 derniers jours)
    active_users = await db.users.count_documents({
        "last_login": {"$gte": week_ago.isoformat()}
    })
    
    # Nouveaux utilisateurs cette semaine
    new_users_week = await db.users.count_documents({
        "created_at": {"$gte": week_ago.isoformat()}
    })
    
    # Nouveaux utilisateurs ce mois
    new_users_month = await db.users.count_documents({
        "created_at": {"$gte": month_ago.isoformat()}
    })
    
    # Total candidatures
    total_applications = await db.applications.count_documents({})
    
    # Total entretiens
    total_interviews = await db.interviews.count_documents({})
    
    # Candidatures cette semaine
    applications_week = await db.applications.count_documents({
        "created_at": {"$gte": week_ago.isoformat()}
    })
    
    # Entretiens cette semaine
    interviews_week = await db.interviews.count_documents({
        "created_at": {"$gte": week_ago.isoformat()}
    })
    
    return AdminDashboardStats(
        total_users=total_users,
        active_users=active_users,
        new_users_this_week=new_users_week,
        new_users_this_month=new_users_month,
        total_applications=total_applications,
        total_interviews=total_interviews,
        applications_this_week=applications_week,
        interviews_this_week=interviews_week
    )


@router.get("/stats/user-growth")
async def get_user_growth(
    days: int = Query(30, ge=7, le=365),
    admin_user: dict = Depends(get_admin_user),
    db = Depends(get_db)
):
    """Récupère les données de croissance des utilisateurs"""
    now = datetime.now(timezone.utc)
    start_date = now - timedelta(days=days)
    
    # Pipeline d'agrégation pour grouper par jour
    pipeline = [
        {
            "$match": {
                "created_at": {"$gte": start_date.isoformat()}
            }
        },
        {
            "$group": {
                "_id": {"$substr": ["$created_at", 0, 10]},
                "count": {"$sum": 1}
            }
        },
        {"$sort": {"_id": 1}}
    ]
    
    results = await db.users.aggregate(pipeline).to_list(length=None)
    
    # Construire la timeline avec cumul
    data_points = []
    cumulative = await db.users.count_documents({
        "created_at": {"$lt": start_date.isoformat()}
    })
    
    for item in results:
        cumulative += item["count"]
        data_points.append(UserGrowthDataPoint(
            date=item["_id"],
            count=item["count"],
            cumulative=cumulative
        ))
    
    return data_points


@router.get("/stats/activity")
async def get_activity_stats(
    days: int = Query(30, ge=7, le=365),
    admin_user: dict = Depends(get_admin_user),
    db = Depends(get_db)
):
    """Récupère les données d'activité (candidatures et entretiens par jour)"""
    now = datetime.now(timezone.utc)
    start_date = now - timedelta(days=days)
    
    # Candidatures par jour
    apps_pipeline = [
        {
            "$match": {
                "created_at": {"$gte": start_date.isoformat()}
            }
        },
        {
            "$group": {
                "_id": {"$substr": ["$created_at", 0, 10]},
                "count": {"$sum": 1}
            }
        },
        {"$sort": {"_id": 1}}
    ]
    
    apps_results = await db.applications.aggregate(apps_pipeline).to_list(length=None)
    apps_by_date = {item["_id"]: item["count"] for item in apps_results}
    
    # Entretiens par jour
    interviews_pipeline = [
        {
            "$match": {
                "created_at": {"$gte": start_date.isoformat()}
            }
        },
        {
            "$group": {
                "_id": {"$substr": ["$created_at", 0, 10]},
                "count": {"$sum": 1}
            }
        },
        {"$sort": {"_id": 1}}
    ]
    
    interviews_results = await db.interviews.aggregate(interviews_pipeline).to_list(length=None)
    interviews_by_date = {item["_id"]: item["count"] for item in interviews_results}
    
    # Fusionner les données
    all_dates = sorted(set(apps_by_date.keys()) | set(interviews_by_date.keys()))
    
    data_points = []
    for date in all_dates:
        data_points.append(ActivityDataPoint(
            date=date,
            applications=apps_by_date.get(date, 0),
            interviews=interviews_by_date.get(date, 0)
        ))
    
    return data_points


# ============================================
# GESTION DES UTILISATEURS
# ============================================

@router.get("/users")
async def get_users(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    role: Optional[UserRole] = None,
    is_active: Optional[bool] = None,
    admin_user: dict = Depends(get_admin_user),
    db = Depends(get_db)
):
    """Liste tous les utilisateurs avec pagination et filtres"""
    query = {}
    
    if search:
        query["$or"] = [
            {"email": {"$regex": search, "$options": "i"}},
            {"full_name": {"$regex": search, "$options": "i"}}
        ]
    
    if role:
        query["role"] = role.value
    
    if is_active is not None:
        query["is_active"] = is_active
    
    # Compter le total
    total = await db.users.count_documents(query)
    total_pages = (total + per_page - 1) // per_page
    
    # Récupérer les utilisateurs
    skip = (page - 1) * per_page
    cursor = db.users.find(query).skip(skip).limit(per_page).sort("created_at", -1)
    users = await cursor.to_list(length=per_page)
    
    # Enrichir avec les stats
    users_response = []
    for user in users:
        apps_count = await db.applications.count_documents({"user_id": user["id"]})
        interviews_count = await db.interviews.count_documents({"user_id": user["id"]})
        
        users_response.append(UserAdminResponse(
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
            applications_count=apps_count,
            interviews_count=interviews_count,
            onboarding_completed=user.get("onboarding_completed", True),
            welcome_shown=user.get("welcome_shown", True),
            onboarding_steps=user.get("onboarding_steps")
        ))
    
    return {
        "items": users_response,
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": total_pages
    }


@router.get("/users/{user_id}")
async def get_user_detail(
    user_id: str,
    admin_user: dict = Depends(get_admin_user),
    db = Depends(get_db)
):
    """Récupère les détails d'un utilisateur"""
    user = await db.users.find_one({"id": user_id})
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur non trouvé"
        )
    
    apps_count = await db.applications.count_documents({"user_id": user_id})
    interviews_count = await db.interviews.count_documents({"user_id": user_id})
    
    # Stats supplémentaires
    apps_by_status = await db.applications.aggregate([
        {"$match": {"user_id": user_id}},
        {"$group": {"_id": "$reponse", "count": {"$sum": 1}}}
    ]).to_list(length=None)
    
    return {
        "user": UserAdminResponse(
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
            applications_count=apps_count,
            interviews_count=interviews_count,
            onboarding_completed=user.get("onboarding_completed", True),
            welcome_shown=user.get("welcome_shown", True),
            onboarding_steps=user.get("onboarding_steps")
        ),
        "stats": {
            "applications_by_status": {item["_id"]: item["count"] for item in apps_by_status}
        }
    }


@router.put("/users/{user_id}")
async def update_user(
    user_id: str,
    update_data: AdminUserUpdate,
    admin_user: dict = Depends(get_admin_user),
    db = Depends(get_db)
):
    """Met à jour un utilisateur (rôle, statut actif)"""
    user = await db.users.find_one({"id": user_id})
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur non trouvé"
        )
    
    # Empêcher l'admin de se désactiver lui-même
    if user_id == admin_user["id"] and update_data.is_active is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vous ne pouvez pas désactiver votre propre compte"
        )
    
    # Empêcher l'admin de changer son propre rôle
    if user_id == admin_user["id"] and update_data.role and update_data.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vous ne pouvez pas rétrograder votre propre compte"
        )
    
    update_dict = {k: v.value if hasattr(v, 'value') else v 
                   for k, v in update_data.model_dump().items() if v is not None}
    
    if update_dict:
        await db.users.update_one(
            {"id": user_id},
            {"$set": update_dict}
        )
    
    return {"message": "Utilisateur mis à jour avec succès"}


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    admin_user: dict = Depends(get_admin_user),
    db = Depends(get_db)
):
    """Supprime un utilisateur (soft delete - désactivation)"""
    user = await db.users.find_one({"id": user_id})
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur non trouvé"
        )
    
    # Empêcher l'admin de se supprimer lui-même
    if user_id == admin_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vous ne pouvez pas supprimer votre propre compte"
        )
    
    # Soft delete - désactiver le compte
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"is_active": False}}
    )
    
    return {"message": "Utilisateur désactivé avec succès"}


@router.post("/users/{user_id}/reactivate")
async def reactivate_user(
    user_id: str,
    admin_user: dict = Depends(get_admin_user),
    db = Depends(get_db)
):
    """Réactive un utilisateur désactivé"""
    user = await db.users.find_one({"id": user_id})
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur non trouvé"
        )
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"is_active": True}}
    )
    
    return {"message": "Utilisateur réactivé avec succès"}


@router.post("/users", response_model=UserAdminResponse)
async def create_user(
    user_data: AdminUserCreate,
    admin_user: dict = Depends(get_admin_user),
    db = Depends(get_db)
):
    """Crée un nouvel utilisateur (réservé aux admins)"""
    from datetime import datetime, timezone
    
    # Vérifier si l'email existe déjà
    existing_user = await db.users.find_one({"email": user_data.email.lower()})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Un utilisateur avec cet email existe déjà"
        )
    
    # Hasher le mot de passe
    hashed_password = pwd_context.hash(user_data.password)
    
    # Créer l'utilisateur
    from models import OnboardingSteps as _OnboardingSteps
    new_user = {
        "id": str(uuid.uuid4()),
        "email": user_data.email.lower(),
        "full_name": user_data.full_name,
        "hashed_password": hashed_password,
        "role": user_data.role.value,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_active": True,
        "last_login": None,
        "google_ai_key": None,
        "openai_key": None,
        "groq_key": None,
        "onboarding_completed": True,
        "welcome_shown": True,
        "onboarding_steps": _OnboardingSteps().model_dump()
    }

    await db.users.insert_one(new_user)

    return UserAdminResponse(
        id=new_user["id"],
        email=new_user["email"],
        full_name=new_user["full_name"],
        role=new_user["role"],
        created_at=new_user["created_at"],
        last_login=None,
        is_active=True,
        has_google_ai_key=False,
        has_openai_key=False,
        has_groq_key=False,
        applications_count=0,
        interviews_count=0,
        onboarding_completed=True,
        welcome_shown=True,
        onboarding_steps=new_user["onboarding_steps"]
    )


# ============================================
# ONBOARDING FUNNEL STATS
# ============================================

@router.get("/onboarding-stats")
async def get_onboarding_stats(
    admin_user: dict = Depends(get_admin_user),
    db = Depends(get_db)
):
    """Statistiques du funnel d'onboarding"""
    # Utilisateurs créés avec onboarding_completed explicite (nouveaux users)
    total_new = await db.users.count_documents({"onboarding_completed": {"$exists": True}})
    completed = await db.users.count_documents({"onboarding_completed": True})
    not_completed = await db.users.count_documents({"onboarding_completed": False})

    # Drop-off par étape
    step_keys = ["goal", "profile", "extension", "first_application"]
    step_stats = {}
    for step in step_keys:
        done = await db.users.count_documents({
            f"onboarding_steps.{step}.completed": True
        })
        skipped = await db.users.count_documents({
            f"onboarding_steps.{step}.skipped": True
        })
        step_stats[step] = {"completed": done, "skipped": skipped}

    return {
        "total_with_onboarding_field": total_new,
        "completed_wizard": completed,
        "not_completed": not_completed,
        "completion_rate": round(completed / total_new * 100, 1) if total_new > 0 else 0,
        "steps": step_stats
    }


# ============================================
# EXPORT ADMIN
# ============================================

@router.get("/ai-quota-stats")
async def get_ai_quota_stats(
    admin_user: dict = Depends(get_admin_user),
    db = Depends(get_db)
):
    """Retourne les stats de quota IA de tous les utilisateurs pour aujourd'hui"""
    from datetime import date
    from utils.ai_quota import get_quota_limit
    today = date.today().isoformat()
    quota = await get_quota_limit(db)

    # Récupérer tous les utilisateurs actifs
    users = await db.users.find(
        {"is_active": True},
        {"_id": 0, "id": 1, "full_name": 1, "email": 1, "role": 1,
         "google_ai_key": 1, "openai_key": 1, "groq_key": 1}
    ).to_list(length=None)

    # Récupérer tous les usages du jour en une seule requête
    usages = await db.ai_usage.find({"date": today}).to_list(length=None)
    usage_map = {u["user_id"]: u["call_count"] for u in usages}

    result = []
    for u in users:
        uid = u["id"]
        has_own_key = any([u.get("google_ai_key"), u.get("openai_key"), u.get("groq_key")])
        is_admin = u.get("role") == "admin"
        calls = usage_map.get(uid, 0)
        result.append({
            "user_id": uid,
            "full_name": u.get("full_name"),
            "email": u.get("email"),
            "role": u.get("role", "standard"),
            "has_own_key": has_own_key,
            "is_exempt": is_admin or has_own_key,
            "calls_today": calls,
            "quota_daily": quota,
            "remaining": max(0, quota - calls) if not (is_admin or has_own_key) else None,
        })

    # Trier : quota épuisé en premier, puis par usage décroissant
    result.sort(key=lambda x: (-x["calls_today"], x["full_name"] or ""))

    return {
        "date": today,
        "quota_daily": quota,
        "total_users": len(result),
        "users_at_limit": sum(1 for r in result if not r["is_exempt"] and r["calls_today"] >= quota),
        "total_calls_today": sum(r["calls_today"] for r in result),
        "users": result
    }


# ============================================
# PLATFORM SETTINGS (QUOTA IA)
# ============================================

from pydantic import BaseModel as _BaseModel, Field

class QuotaSettingsUpdate(_BaseModel):
    daily_quota: int = Field(..., ge=1, le=10000)


@router.get("/settings/quota")
async def get_quota_settings(
    admin_user: dict = Depends(get_admin_user),
    db = Depends(get_db)
):
    """Retourne le quota journalier IA configuré"""
    from utils.ai_quota import get_quota_limit, DAILY_QUOTA
    current = await get_quota_limit(db)
    return {"daily_quota": current, "default": DAILY_QUOTA}


@router.put("/settings/quota")
async def update_quota_settings(
    body: QuotaSettingsUpdate,
    admin_user: dict = Depends(get_admin_user),
    db = Depends(get_db)
):
    """Met à jour le quota journalier IA pour tous les utilisateurs non-exemptés"""
    await db.platform_settings.update_one(
        {"key": "ai_daily_quota"},
        {"$set": {"key": "ai_daily_quota", "value": body.daily_quota, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    return {"daily_quota": body.daily_quota}


# ============================================
# SUPPORT TICKETS
# ============================================

@router.get("/support-tickets")
async def list_support_tickets(
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    admin_user: dict = Depends(get_admin_user),
    db = Depends(get_db)
):
    """Liste tous les tickets de support avec pagination et filtrage"""
    query = {}
    if status:
        query["status"] = status

    total = await db.support_tickets.count_documents(query)
    skip = (page - 1) * per_page

    tickets = await db.support_tickets.find(
        query, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(per_page).to_list(length=per_page)

    # Sérialiser les datetimes
    for t in tickets:
        for field in ("created_at", "updated_at"):
            if isinstance(t.get(field), datetime):
                t[field] = t[field].isoformat()

    return {
        "items": tickets,
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": (total + per_page - 1) // per_page,
    }


@router.get("/support-tickets/stats")
async def support_tickets_stats(
    admin_user: dict = Depends(get_admin_user),
    db = Depends(get_db)
):
    """Résumé rapide des tickets par statut"""
    pipeline = [{"$group": {"_id": "$status", "count": {"$sum": 1}}}]
    raw = await db.support_tickets.aggregate(pipeline).to_list(length=None)
    counts = {item["_id"]: item["count"] for item in raw}
    total = sum(counts.values())
    return {
        "total": total,
        "open": counts.get("open", 0),
        "in_progress": counts.get("in_progress", 0),
        "resolved": counts.get("resolved", 0),
        "closed": counts.get("closed", 0),
    }


@router.get("/support-tickets/{ticket_id}")
async def get_support_ticket(
    ticket_id: str,
    admin_user: dict = Depends(get_admin_user),
    db = Depends(get_db)
):
    """Détail d'un ticket de support"""
    ticket = await db.support_tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket non trouvé")
    for field in ("created_at", "updated_at"):
        if isinstance(ticket.get(field), datetime):
            ticket[field] = ticket[field].isoformat()
    return ticket


@router.put("/support-tickets/{ticket_id}")
async def update_support_ticket(
    ticket_id: str,
    data: SupportTicketUpdate,
    admin_user: dict = Depends(get_admin_user),
    db = Depends(get_db)
):
    """Met à jour le statut ou la note admin d'un ticket"""
    ticket = await db.support_tickets.find_one({"id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket non trouvé")

    update_fields = {"updated_at": datetime.now(timezone.utc)}
    if data.status is not None:
        update_fields["status"] = data.status.value
    if data.admin_note is not None:
        update_fields["admin_note"] = data.admin_note

    await db.support_tickets.update_one({"id": ticket_id}, {"$set": update_fields})
    return {"success": True}


@router.delete("/support-tickets/{ticket_id}")
async def delete_support_ticket(
    ticket_id: str,
    admin_user: dict = Depends(get_admin_user),
    db = Depends(get_db)
):
    """Supprime définitivement un ticket de support"""
    result = await db.support_tickets.delete_one({"id": ticket_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Ticket non trouvé")
    return {"success": True}


@router.get("/export/stats")
async def export_admin_stats(
    admin_user: dict = Depends(get_admin_user),
    db = Depends(get_db)
):
    """Exporte toutes les statistiques admin en JSON"""
    dashboard = await get_admin_dashboard(admin_user, db)
    user_growth = await get_user_growth(30, admin_user, db)
    activity = await get_activity_stats(30, admin_user, db)
    
    # Stats par rôle
    role_stats = await db.users.aggregate([
        {"$group": {"_id": "$role", "count": {"$sum": 1}}}
    ]).to_list(length=None)
    
    # Stats candidatures par statut
    app_stats = await db.applications.aggregate([
        {"$group": {"_id": "$reponse", "count": {"$sum": 1}}}
    ]).to_list(length=None)
    
    return {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "dashboard": dashboard.model_dump(),
        "user_growth_30d": [p.model_dump() for p in user_growth],
        "activity_30d": [p.model_dump() for p in activity],
        "users_by_role": {item["_id"] or "standard": item["count"] for item in role_stats},
        "applications_by_status": {item["_id"]: item["count"] for item in app_stats}
    }
