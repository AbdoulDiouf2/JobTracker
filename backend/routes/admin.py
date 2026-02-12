"""
JobTracker SaaS - Routes Administration
Panel admin pour la gestion multi-tenant
"""

from fastapi import APIRouter, HTTPException, status, Depends, Query
from datetime import datetime, timezone, timedelta
from typing import Optional

from models import (
    UserResponse, UserAdminResponse, UserRole, AdminDashboardStats,
    AdminUserUpdate, UserGrowthDataPoint, ActivityDataPoint, PaginatedResponse
)
from utils.auth import get_current_user

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
            applications_count=apps_count,
            interviews_count=interviews_count
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
            applications_count=apps_count,
            interviews_count=interviews_count
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


# ============================================
# EXPORT ADMIN
# ============================================

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
