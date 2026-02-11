"""
JobTracker SaaS - Routes des statistiques
"""

from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List
from datetime import datetime, timezone
from collections import defaultdict

from models import (
    DashboardStats, TimelineDataPoint, StatusDistribution,
    TypeDistribution, MethodDistribution, StatisticsOverview,
    ApplicationStatus, JobType, ApplicationMethod
)
from utils.auth import get_current_user

router = APIRouter(prefix="/statistics", tags=["Statistics"])


def get_db():
    """Dependency injection pour la DB"""
    pass


@router.get("/dashboard", response_model=DashboardStats)
async def get_dashboard_stats(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Statistiques pour le dashboard"""
    user_id = current_user["user_id"]
    
    # Total candidatures
    total = await db.applications.count_documents({"user_id": user_id})
    
    # Par statut
    pending = await db.applications.count_documents({"user_id": user_id, "reponse": "pending"})
    positive = await db.applications.count_documents({"user_id": user_id, "reponse": "positive"})
    negative = await db.applications.count_documents({"user_id": user_id, "reponse": "negative"})
    no_response = await db.applications.count_documents({"user_id": user_id, "reponse": "no_response"})
    cancelled = await db.applications.count_documents({"user_id": user_id, "reponse": "cancelled"})
    
    # Avec entretien (au moins un entretien associé)
    pipeline = [
        {"$match": {"user_id": user_id}},
        {"$lookup": {
            "from": "interviews",
            "localField": "id",
            "foreignField": "candidature_id",
            "as": "interviews"
        }},
        {"$match": {"interviews": {"$ne": []}}},
        {"$count": "count"}
    ]
    result = await db.applications.aggregate(pipeline).to_list(1)
    with_interview = result[0]["count"] if result else 0
    
    # Favoris
    favorites_count = await db.applications.count_documents({"user_id": user_id, "is_favorite": True})
    
    # Taux de réponse
    responded = positive + negative + no_response
    response_rate = (responded / total * 100) if total > 0 else 0
    
    return DashboardStats(
        total_applications=total,
        pending=pending,
        with_interview=with_interview,
        positive=positive,
        negative=negative,
        no_response=no_response,
        cancelled=cancelled,
        response_rate=round(response_rate, 1),
        favorites_count=favorites_count
    )


@router.get("/timeline", response_model=List[TimelineDataPoint])
async def get_timeline_stats(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Évolution temporelle des candidatures (cumul)"""
    cursor = db.applications.find(
        {"user_id": current_user["user_id"]},
        {"_id": 0, "date_candidature": 1}
    ).sort("date_candidature", 1)
    
    applications = await cursor.to_list(length=10000)
    
    if not applications:
        return []
    
    # Grouper par date
    date_counts = defaultdict(int)
    for app in applications:
        date_str = app["date_candidature"][:10] if isinstance(app["date_candidature"], str) else app["date_candidature"].strftime("%Y-%m-%d")
        date_counts[date_str] += 1
    
    # Calculer le cumul
    timeline = []
    cumulative = 0
    for date in sorted(date_counts.keys()):
        cumulative += date_counts[date]
        timeline.append(TimelineDataPoint(
            date=date,
            count=date_counts[date],
            cumulative=cumulative
        ))
    
    return timeline


@router.get("/by-status", response_model=List[StatusDistribution])
async def get_status_distribution(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Répartition par statut"""
    pipeline = [
        {"$match": {"user_id": current_user["user_id"]}},
        {"$group": {"_id": "$reponse", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    
    result = await db.applications.aggregate(pipeline).to_list(10)
    total = sum(r["count"] for r in result)
    
    distribution = []
    for r in result:
        status_value = r["_id"] or "pending"
        try:
            status_enum = ApplicationStatus(status_value)
            label = status_enum.label_fr
        except ValueError:
            label = status_value
        
        distribution.append(StatusDistribution(
            status=status_value,
            label=label,
            count=r["count"],
            percentage=round(r["count"] / total * 100, 1) if total > 0 else 0
        ))
    
    return distribution


@router.get("/by-type", response_model=List[TypeDistribution])
async def get_type_distribution(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Répartition par type de poste"""
    pipeline = [
        {"$match": {"user_id": current_user["user_id"]}},
        {"$group": {"_id": "$type_poste", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    
    result = await db.applications.aggregate(pipeline).to_list(10)
    total = sum(r["count"] for r in result)
    
    distribution = []
    for r in result:
        type_value = r["_id"] or "cdi"
        try:
            type_enum = JobType(type_value)
            label = type_enum.label_fr
        except ValueError:
            label = type_value
        
        distribution.append(TypeDistribution(
            type=type_value,
            label=label,
            count=r["count"],
            percentage=round(r["count"] / total * 100, 1) if total > 0 else 0
        ))
    
    return distribution


@router.get("/by-method", response_model=List[MethodDistribution])
async def get_method_distribution(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Répartition par moyen de candidature"""
    pipeline = [
        {"$match": {"user_id": current_user["user_id"], "moyen": {"$ne": None}}},
        {"$group": {"_id": "$moyen", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    
    result = await db.applications.aggregate(pipeline).to_list(20)
    total = sum(r["count"] for r in result)
    
    distribution = []
    for r in result:
        method_value = r["_id"]
        if method_value:
            try:
                method_enum = ApplicationMethod(method_value)
                label = method_enum.label_fr
            except ValueError:
                label = method_value
            
            distribution.append(MethodDistribution(
                method=method_value,
                label=label,
                count=r["count"],
                percentage=round(r["count"] / total * 100, 1) if total > 0 else 0
            ))
    
    return distribution


@router.get("/response-rate")
async def get_response_rate_stats(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Taux de réponse et temps moyen de réponse"""
    user_id = current_user["user_id"]
    
    # Total et réponses
    total = await db.applications.count_documents({"user_id": user_id})
    responded = await db.applications.count_documents({
        "user_id": user_id,
        "reponse": {"$in": ["positive", "negative"]}
    })
    
    response_rate = (responded / total * 100) if total > 0 else 0
    
    # Temps moyen de réponse (pour celles qui ont date_reponse)
    pipeline = [
        {"$match": {
            "user_id": user_id,
            "date_reponse": {"$ne": None}
        }},
        {"$project": {
            "response_time": {
                "$divide": [
                    {"$subtract": ["$date_reponse", "$date_candidature"]},
                    1000 * 60 * 60 * 24  # Convertir en jours
                ]
            }
        }},
        {"$group": {
            "_id": None,
            "avg_response_time": {"$avg": "$response_time"}
        }}
    ]
    
    result = await db.applications.aggregate(pipeline).to_list(1)
    avg_response_time = result[0]["avg_response_time"] if result else None
    
    return {
        "response_rate": round(response_rate, 1),
        "avg_response_time_days": round(avg_response_time, 1) if avg_response_time else None,
        "total_applications": total,
        "responded": responded
    }


@router.get("/overview", response_model=StatisticsOverview)
async def get_statistics_overview(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Vue d'ensemble complète des statistiques"""
    # Dashboard stats
    dashboard = await get_dashboard_stats(current_user, db)
    
    # Timeline
    timeline = await get_timeline_stats(current_user, db)
    
    # Distributions
    by_status = await get_status_distribution(current_user, db)
    by_type = await get_type_distribution(current_user, db)
    by_method = await get_method_distribution(current_user, db)
    
    # Response rate
    response_data = await get_response_rate_stats(current_user, db)
    
    # Stats entretiens
    user_id = current_user["user_id"]
    interviews_total = await db.interviews.count_documents({"user_id": user_id})
    interviews_planned = await db.interviews.count_documents({"user_id": user_id, "statut": "planned"})
    interviews_completed = await db.interviews.count_documents({"user_id": user_id, "statut": "completed"})
    interviews_cancelled = await db.interviews.count_documents({"user_id": user_id, "statut": "cancelled"})
    
    return StatisticsOverview(
        dashboard=dashboard,
        timeline=timeline,
        by_status=by_status,
        by_type=by_type,
        by_method=by_method,
        avg_response_time_days=response_data.get("avg_response_time_days"),
        interviews_stats={
            "total": interviews_total,
            "planned": interviews_planned,
            "completed": interviews_completed,
            "cancelled": interviews_cancelled
        }
    )
