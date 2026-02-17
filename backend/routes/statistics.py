"""
JobTracker SaaS - Routes des statistiques
"""

from fastapi import APIRouter, Depends
from typing import List
from datetime import datetime, timezone, timedelta
from collections import defaultdict

from models import (
    DashboardStats, TimelineDataPoint, StatusDistribution,
    TypeDistribution, MethodDistribution, StatisticsOverview,
    ApplicationStatus, JobType, ApplicationMethod,
    # Dashboard V2
    DashboardV2Response, GoalProgress, JobSearchScore,
    DashboardInsight, PriorityAction, WeeklyEvolution,
    UserPreferences, UserPreferencesUpdate
)
from utils.auth import get_current_user

router = APIRouter(prefix="/statistics", tags=["Statistics"])


def get_db():
    """Dependency injection pour la DB"""
    pass


@router.get("/dashboard", response_model=DashboardStats)
async def get_dashboard_stats(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
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
    db = Depends(get_db)
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
    db = Depends(get_db)
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
    db = Depends(get_db)
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
    db = Depends(get_db)
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
    db = Depends(get_db)
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
    db = Depends(get_db)
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



# ============================================
# DASHBOARD V2 - INTELLIGENT STATISTICS
# ============================================

@router.get("/preferences", response_model=UserPreferences)
async def get_user_preferences(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Récupérer les préférences utilisateur (objectifs)"""
    user_id = current_user["user_id"]
    
    prefs = await db.user_preferences.find_one({"user_id": user_id}, {"_id": 0})
    if prefs:
        return UserPreferences(**prefs)
    
    # Retourner les valeurs par défaut
    return UserPreferences()


@router.put("/preferences", response_model=UserPreferences)
async def update_user_preferences(
    preferences: UserPreferencesUpdate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Mettre à jour les préférences utilisateur"""
    user_id = current_user["user_id"]
    
    update_data = {k: v for k, v in preferences.model_dump().items() if v is not None}
    update_data["user_id"] = user_id
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.user_preferences.update_one(
        {"user_id": user_id},
        {"$set": update_data},
        upsert=True
    )
    
    return await get_user_preferences(current_user, db)


@router.get("/dashboard-v2", response_model=DashboardV2Response)
async def get_dashboard_v2(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Dashboard V2 avec insights intelligents, score et objectifs"""
    user_id = current_user["user_id"]
    # Utiliser datetime sans timezone pour correspondre au format stocké
    now = datetime.now()
    
    # ============================================
    # 1. STATS DE BASE
    # ============================================
    basic_stats = await get_dashboard_stats(current_user, db)
    
    # ============================================
    # 2. PRÉFÉRENCES & OBJECTIFS
    # ============================================
    prefs = await db.user_preferences.find_one({"user_id": user_id}, {"_id": 0})
    monthly_goal = prefs.get("monthly_goal", 40) if prefs else 40
    weekly_goal = prefs.get("weekly_goal", 10) if prefs else 10
    
    # Dates clés (converties en ISO strings pour MongoDB)
    start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    start_of_week = now - timedelta(days=now.weekday())
    start_of_week = start_of_week.replace(hour=0, minute=0, second=0, microsecond=0)
    start_of_last_month = (start_of_month - timedelta(days=1)).replace(day=1)
    
    # ISO string format pour les requêtes (car dates stockées en ISO string)
    start_of_month_str = start_of_month.isoformat()
    start_of_week_str = start_of_week.isoformat()
    start_of_last_month_str = start_of_last_month.isoformat()
    
    # Candidatures ce mois
    this_month_count = await db.applications.count_documents({
        "user_id": user_id,
        "date_candidature": {"$gte": start_of_month_str}
    })
    
    # Candidatures mois dernier
    last_month_count = await db.applications.count_documents({
        "user_id": user_id,
        "date_candidature": {"$gte": start_of_last_month_str, "$lt": start_of_month_str}
    })
    
    # Candidatures cette semaine
    this_week_count = await db.applications.count_documents({
        "user_id": user_id,
        "date_candidature": {"$gte": start_of_week_str}
    })
    
    # Goal Progress
    goal_progress = GoalProgress(
        monthly_goal=monthly_goal,
        monthly_current=this_month_count,
        monthly_percentage=min(round((this_month_count / monthly_goal) * 100, 1), 100) if monthly_goal > 0 else 0,
        weekly_goal=weekly_goal,
        weekly_current=this_week_count,
        weekly_percentage=min(round((this_week_count / weekly_goal) * 100, 1), 100) if weekly_goal > 0 else 0
    )
    
    # Month over month change
    mom_change = 0.0
    if last_month_count > 0:
        mom_change = round(((this_month_count - last_month_count) / last_month_count) * 100, 1)
    elif this_month_count > 0:
        mom_change = 100.0
    
    # ============================================
    # 3. JOB SEARCH SCORE (sur 100)
    # ============================================
    
    # 3.1 Régularité (30 pts) - basé sur les 4 dernières semaines
    weeks_data = []
    for i in range(4):
        week_start = start_of_week - timedelta(weeks=i)
        week_end = week_start + timedelta(weeks=1)
        week_count = await db.applications.count_documents({
            "user_id": user_id,
            "date_candidature": {"$gte": week_start.isoformat(), "$lt": week_end.isoformat()}
        })
        weeks_data.append(week_count)
    
    avg_weekly = sum(weeks_data) / 4 if weeks_data else 0
    if avg_weekly >= 5:
        regularity_score = 30
    elif avg_weekly >= 3:
        regularity_score = 20
    elif avg_weekly >= 1:
        regularity_score = 10
    else:
        regularity_score = 0
    
    # 3.2 Taux de réponse (25 pts)
    total_apps = basic_stats.total_applications
    responded = basic_stats.positive + basic_stats.negative
    response_rate = (responded / total_apps * 100) if total_apps > 0 else 0
    
    if response_rate >= 40:
        response_rate_score = 25
    elif response_rate >= 25:
        response_rate_score = 18
    elif response_rate >= 10:
        response_rate_score = 10
    else:
        response_rate_score = 5 if total_apps > 0 else 0
    
    # 3.3 Ratio entretiens/candidatures (25 pts)
    interview_count = await db.interviews.count_documents({"user_id": user_id})
    interview_ratio = (interview_count / total_apps * 100) if total_apps > 0 else 0
    
    if interview_ratio >= 30:
        interview_ratio_score = 25
    elif interview_ratio >= 20:
        interview_ratio_score = 18
    elif interview_ratio >= 10:
        interview_ratio_score = 12
    elif interview_ratio >= 5:
        interview_ratio_score = 6
    else:
        interview_ratio_score = 0
    
    # 3.4 Relances effectuées (20 pts)
    apps_with_followup = await db.applications.count_documents({
        "user_id": user_id,
        "followup_count": {"$gte": 1}
    })
    followup_rate = (apps_with_followup / total_apps * 100) if total_apps > 0 else 0
    
    if followup_rate >= 50:
        followup_score = 20
    elif followup_rate >= 30:
        followup_score = 14
    elif followup_rate >= 15:
        followup_score = 8
    else:
        followup_score = 0
    
    total_score = regularity_score + response_rate_score + interview_ratio_score + followup_score
    
    # Tendance (comparer avec le mois dernier - simplifié)
    trend = "stable"
    trend_value = 0
    if mom_change > 10:
        trend = "up"
        trend_value = min(int(mom_change / 10), 10)
    elif mom_change < -10:
        trend = "down"
        trend_value = max(int(mom_change / 10), -10)
    
    job_search_score = JobSearchScore(
        total_score=total_score,
        regularity_score=regularity_score,
        response_rate_score=response_rate_score,
        interview_ratio_score=interview_ratio_score,
        followup_score=followup_score,
        trend=trend,
        trend_value=trend_value
    )
    
    # ============================================
    # 4. INSIGHTS INTELLIGENTS
    # ============================================
    insights = []
    
    # Insight sur le taux de réponse
    if response_rate >= 30:
        insights.append(DashboardInsight(
            type="positive",
            icon="🎯",
            message=f"Excellent ! Ton taux de réponse est de {response_rate:.0f}%, bien au-dessus de la moyenne.",
            priority=1
        ))
    elif response_rate >= 15:
        insights.append(DashboardInsight(
            type="info",
            icon="📊",
            message=f"Ton taux de réponse est de {response_rate:.0f}%. Continue comme ça !",
            priority=2
        ))
    
    # Insight sur la progression mensuelle
    if mom_change > 20:
        insights.append(DashboardInsight(
            type="positive",
            icon="📈",
            message=f"+{mom_change:.0f}% de candidatures ce mois vs le mois dernier. Belle progression !",
            priority=0
        ))
    elif mom_change < -20:
        insights.append(DashboardInsight(
            type="warning",
            icon="⚠️",
            message=f"Activité en baisse de {abs(mom_change):.0f}% ce mois. Reste motivé !",
            priority=0
        ))
    
    # Insight sur les candidatures sans réponse
    old_pending_date = (now - timedelta(days=21)).isoformat()
    old_pending = await db.applications.count_documents({
        "user_id": user_id,
        "reponse": "pending",
        "date_candidature": {"$lt": old_pending_date}
    })
    if old_pending > 0:
        insights.append(DashboardInsight(
            type="warning",
            icon="📩",
            message=f"{old_pending} candidature(s) sans réponse depuis plus de 21 jours. Pense à relancer !",
            priority=0
        ))
    
    # Insight sur la régularité
    if avg_weekly < 2 and total_apps > 5:
        insights.append(DashboardInsight(
            type="tip",
            icon="💡",
            message="Astuce : Envoyer au moins 5 candidatures par semaine augmente tes chances de 40%.",
            priority=1
        ))
    
    # Insight sur les relances
    if followup_rate < 20 and total_apps > 10:
        insights.append(DashboardInsight(
            type="tip",
            icon="🔄",
            message="Seulement {:.0f}% de relances effectuées. Les relances doublent tes chances de réponse !".format(followup_rate),
            priority=1
        ))
    
    # Trier par priorité
    insights.sort(key=lambda x: x.priority)
    insights = insights[:4]  # Max 4 insights
    
    # ============================================
    # 5. ACTIONS PRIORITAIRES
    # ============================================
    priority_actions = []
    
    # Entretiens dans les 48h
    now_str = now.isoformat()
    in_48h_str = (now + timedelta(hours=48)).isoformat()
    upcoming_48h = await db.interviews.count_documents({
        "user_id": user_id,
        "statut": "planned",
        "date_entretien": {"$gte": now_str, "$lte": in_48h_str}
    })
    if upcoming_48h > 0:
        priority_actions.append(PriorityAction(
            type="interview_soon",
            icon="🔴",
            title="Entretiens imminents",
            description=f"{upcoming_48h} entretien(s) dans les 48h",
            count=upcoming_48h,
            action_url="/dashboard/interviews"
        ))
    
    # Candidatures à relancer
    followup_min_date = (now - timedelta(days=45)).isoformat()
    followup_max_date = (now - timedelta(days=14)).isoformat()
    needs_followup = await db.applications.count_documents({
        "user_id": user_id,
        "reponse": "pending",
        "followup_count": {"$lt": 2},
        "date_candidature": {"$lt": followup_max_date, "$gt": followup_min_date}
    })
    if needs_followup > 0:
        priority_actions.append(PriorityAction(
            type="needs_followup",
            icon="📩",
            title="Candidatures à relancer",
            description=f"{needs_followup} en attente depuis +14 jours",
            count=needs_followup,
            action_url="/dashboard/applications?filter=pending"
        ))
    
    # Favoris inactifs
    inactive_date = (now - timedelta(days=30)).isoformat()
    inactive_favorites = await db.applications.count_documents({
        "user_id": user_id,
        "is_favorite": True,
        "reponse": "pending",
        "date_candidature": {"$lt": inactive_date}
    })
    if inactive_favorites > 0:
        priority_actions.append(PriorityAction(
            type="inactive_favorite",
            icon="⭐",
            title="Favoris inactifs",
            description=f"{inactive_favorites} entreprise(s) favorite(s) sans nouvelles depuis 30j",
            count=inactive_favorites,
            action_url="/dashboard/applications?filter=favorites"
        ))
    
    # Entretiens cette semaine
    week_end_str = (start_of_week + timedelta(weeks=1)).isoformat()
    interviews_this_week = await db.interviews.count_documents({
        "user_id": user_id,
        "statut": "planned",
        "date_entretien": {"$gte": start_of_week_str, "$lt": week_end_str}
    })
    if interviews_this_week > 0 and upcoming_48h == 0:
        priority_actions.append(PriorityAction(
            type="interviews_week",
            icon="📅",
            title="Entretiens cette semaine",
            description=f"{interviews_this_week} entretien(s) planifié(s)",
            count=interviews_this_week,
            action_url="/dashboard/interviews"
        ))
    
    # ============================================
    # 6. ÉVOLUTION HEBDOMADAIRE (4 dernières semaines)
    # ============================================
    weekly_evolution = []
    for i in range(3, -1, -1):  # De la plus ancienne à la plus récente
        week_start = start_of_week - timedelta(weeks=i)
        week_end = week_start + timedelta(weeks=1)
        week_start_str = week_start.isoformat()
        week_end_str = week_end.isoformat()
        
        apps_count = await db.applications.count_documents({
            "user_id": user_id,
            "date_candidature": {"$gte": week_start_str, "$lt": week_end_str}
        })
        
        responses_count = await db.applications.count_documents({
            "user_id": user_id,
            "date_reponse": {"$gte": week_start_str, "$lt": week_end_str}
        })
        
        interviews_count = await db.interviews.count_documents({
            "user_id": user_id,
            "date_entretien": {"$gte": week_start_str, "$lt": week_end_str}
        })
        
        week_label = f"Sem {4-i}"
        if i == 0:
            week_label = "Cette sem."
        elif i == 1:
            week_label = "Sem -1"
        
        weekly_evolution.append(WeeklyEvolution(
            week=week_label,
            start_date=week_start.strftime("%d/%m"),
            applications=apps_count,
            responses=responses_count,
            interviews=interviews_count
        ))
    
    # ============================================
    # RÉPONSE FINALE
    # ============================================
    return DashboardV2Response(
        stats=basic_stats,
        goal_progress=goal_progress,
        job_search_score=job_search_score,
        insights=insights,
        priority_actions=priority_actions,
        weekly_evolution=weekly_evolution,
        this_month_applications=this_month_count,
        last_month_applications=last_month_count,
        month_over_month_change=mom_change
    )
