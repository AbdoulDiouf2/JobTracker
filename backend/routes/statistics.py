"""
JobTracker SaaS - Routes des statistiques
"""

from fastapi import APIRouter, Depends, Query, HTTPException
from typing import List, Optional
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
                    {"$subtract": [
                        {"$dateFromString": {"dateString": "$date_reponse"}},
                        {"$dateFromString": {"dateString": "$date_candidature"}}
                    ]},
                    1000 * 60 * 60 * 24
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


@router.get("/by-method-effectiveness")
async def get_method_effectiveness(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
):
    """Taux de réponse et d'acceptation par source de candidature"""
    user_id = current_user["user_id"]
    base_filter: dict = {"user_id": user_id, "moyen": {"$ne": None}}
    if date_from or date_to:
        dr: dict = {}
        if date_from:
            dr["$gte"] = date_from
        if date_to:
            dr["$lte"] = date_to + "T23:59:59"
        base_filter["date_candidature"] = dr

    pipeline = [
        {"$match": base_filter},
        {"$group": {
            "_id": {"method": "$moyen", "status": "$reponse"},
            "count": {"$sum": 1}
        }},
        {"$group": {
            "_id": "$_id.method",
            "statuses": {"$push": {"status": "$_id.status", "count": "$count"}}
        }}
    ]
    raw = await db.applications.aggregate(pipeline).to_list(50)

    # Normalise une valeur brute vers une clé enum connue
    def normalize_method(raw_value: str) -> str:
        if not raw_value:
            return "other"
        # Valeur enum déjà valide → retour direct
        try:
            ApplicationMethod(raw_value)
            return raw_value
        except ValueError:
            pass
        v = raw_value.lower().strip()
        if "linkedin" in v:
            return "linkedin"
        if "indeed" in v:
            return "indeed"
        if "welcome" in v or "jungle" in v:
            return "welcome_to_jungle"
        if "jobteaser" in v or "job teaser" in v:
            return "jobteaser"
        if "hello work" in v or "hellowork" in v:
            return "hello_work"
        if "meteo" in v or "météo" in v:
            return "meteojob"
        if "cadremp" in v:
            return "cadremploi"
        if "glassdoor" in v:
            return "glassdoor"
        if "workable" in v:
            return "workable"
        if "spontan" in v:
            return "spontanee"
        if "apec" in v:
            return "apec"
        if "pole" in v or "france travail" in v or "pôle" in v or "francetravail" in v:
            return "pole_emploi"
        if "email" in v or "@" in v or "courriel" in v:
            return "email"
        if "mail" in v and "@" not in v:
            return "email"
        if "site" in v or "company" in v or "entreprise" in v or "web" in v or "career" in v:
            return "company_website"
        return "other"

    # Fusionner par clé normalisée
    merged: dict = {}
    for item in raw:
        key = normalize_method(item["_id"])
        statuses = item["statuses"]
        if key not in merged:
            merged[key] = {"total": 0, "responded": 0, "positive": 0}
        merged[key]["total"] += sum(s["count"] for s in statuses)
        merged[key]["responded"] += sum(s["count"] for s in statuses if s["status"] in ["positive", "negative"])
        merged[key]["positive"] += sum(s["count"] for s in statuses if s["status"] == "positive")

    result = []
    for key, counts in merged.items():
        total = counts["total"]
        responded = counts["responded"]
        positive = counts["positive"]
        try:
            label = ApplicationMethod(key).label_fr
        except (ValueError, AttributeError):
            label = key.replace("_", " ").title()
        result.append({
            "method": key,
            "label": label,
            "total": total,
            "responded": responded,
            "positive": positive,
            "response_rate": round(responded / total * 100, 1) if total > 0 else 0.0,
            "positive_rate": round(positive / total * 100, 1) if total > 0 else 0.0,
        })

    # Minimum 3 candidatures pour être significatif
    filtered = [r for r in result if r["total"] >= 3]
    return sorted(filtered, key=lambda x: x["response_rate"], reverse=True)[:10]


@router.get("/overview", response_model=StatisticsOverview)
async def get_statistics_overview(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db),
    date_from: Optional[str] = Query(None, description="ISO date début (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="ISO date fin (YYYY-MM-DD)"),
):
    """Vue d'ensemble complète des statistiques"""
    user_id = current_user["user_id"]

    # Filtre de période appliqué sur date_candidature
    date_filter: dict = {"user_id": user_id}
    if date_from or date_to:
        date_range: dict = {}
        if date_from:
            date_range["$gte"] = date_from
        if date_to:
            # Inclure tout le jour de fin
            date_range["$lte"] = date_to + "T23:59:59"
        date_filter["date_candidature"] = date_range

    # --- Dashboard stats ---
    total = await db.applications.count_documents(date_filter)
    pending = await db.applications.count_documents({**date_filter, "reponse": "pending"})
    positive = await db.applications.count_documents({**date_filter, "reponse": "positive"})
    negative = await db.applications.count_documents({**date_filter, "reponse": "negative"})
    no_response = await db.applications.count_documents({**date_filter, "reponse": "no_response"})
    cancelled = await db.applications.count_documents({**date_filter, "reponse": "cancelled"})
    wi_result = await db.applications.aggregate([
        {"$match": date_filter},
        {"$lookup": {"from": "interviews", "localField": "id", "foreignField": "candidature_id", "as": "_ivs"}},
        {"$match": {"_ivs": {"$ne": []}}},
        {"$count": "count"}
    ]).to_list(1)
    with_interview = wi_result[0]["count"] if wi_result else 0
    favorites_count = await db.applications.count_documents({**date_filter, "is_favorite": True})
    responded = positive + negative
    response_rate = round(responded / total * 100, 1) if total > 0 else 0.0

    dashboard = DashboardStats(
        total_applications=total,
        pending=pending,
        with_interview=with_interview,
        positive=positive,
        negative=negative,
        no_response=no_response,
        cancelled=cancelled,
        response_rate=response_rate,
        favorites_count=favorites_count,
    )

    # --- Timeline ---
    cursor = db.applications.find(date_filter, {"_id": 0, "date_candidature": 1}).sort("date_candidature", 1)
    apps = await cursor.to_list(length=10000)
    date_counts: dict = defaultdict(int)
    for app in apps:
        d = app.get("date_candidature", "")[:10]
        if d:
            date_counts[d] += 1
    timeline = []
    cumulative = 0
    for date in sorted(date_counts.keys()):
        cumulative += date_counts[date]
        timeline.append(TimelineDataPoint(date=date, count=date_counts[date], cumulative=cumulative))

    # --- Distributions ---
    def add_date_filter(pipeline):
        pipeline[0]["$match"].update({k: v for k, v in date_filter.items() if k != "user_id"})
        return pipeline

    status_pipeline = add_date_filter([
        {"$match": {"user_id": user_id}},
        {"$group": {"_id": "$reponse", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ])
    status_result = await db.applications.aggregate(status_pipeline).to_list(10)
    status_total = sum(r["count"] for r in status_result)
    by_status = []
    for r in status_result:
        sv = r["_id"]
        try:
            label = ApplicationStatus(sv).label_fr
        except (ValueError, AttributeError):
            label = sv or "Inconnu"
        by_status.append(StatusDistribution(
            status=sv, label=label, count=r["count"],
            percentage=round(r["count"] / status_total * 100, 1) if status_total > 0 else 0
        ))

    type_pipeline = add_date_filter([
        {"$match": {"user_id": user_id}},
        {"$group": {"_id": "$type_poste", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ])
    type_result = await db.applications.aggregate(type_pipeline).to_list(10)
    type_total = sum(r["count"] for r in type_result)
    by_type = []
    for r in type_result:
        tv = r["_id"]
        try:
            label = JobType(tv).label_fr
        except (ValueError, AttributeError):
            label = tv or "Inconnu"
        by_type.append(TypeDistribution(
            type=tv, label=label, count=r["count"],
            percentage=round(r["count"] / type_total * 100, 1) if type_total > 0 else 0
        ))

    method_match = {**date_filter, "moyen": {"$ne": None}}
    method_pipeline = [
        {"$match": method_match},
        {"$group": {"_id": "$moyen", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    method_result = await db.applications.aggregate(method_pipeline).to_list(20)
    method_total = sum(r["count"] for r in method_result)
    by_method = []
    for r in method_result:
        mv = r["_id"]
        if mv:
            try:
                label = ApplicationMethod(mv).label_fr
            except (ValueError, AttributeError):
                label = mv
            by_method.append(MethodDistribution(
                method=mv, label=label, count=r["count"],
                percentage=round(r["count"] / method_total * 100, 1) if method_total > 0 else 0
            ))

    # --- Avg response time ---
    rt_pipeline = [
        {"$match": {**date_filter, "date_reponse": {"$ne": None}}},
        {"$project": {"response_time": {"$divide": [
            {"$subtract": [
                {"$dateFromString": {"dateString": "$date_reponse"}},
                {"$dateFromString": {"dateString": "$date_candidature"}}
            ]},
            1000 * 60 * 60 * 24
        ]}}},
        {"$group": {"_id": None, "avg": {"$avg": "$response_time"}}}
    ]
    rt_result = await db.applications.aggregate(rt_pipeline).to_list(1)
    avg_response_time = round(rt_result[0]["avg"], 1) if rt_result else None

    # --- Interviews (filtre sur date_entretien si période définie) ---
    interview_filter: dict = {"user_id": user_id}
    if date_from or date_to:
        dr: dict = {}
        if date_from:
            dr["$gte"] = date_from
        if date_to:
            dr["$lte"] = date_to + "T23:59:59"
        interview_filter["date_entretien"] = dr

    interviews_total = await db.interviews.count_documents(interview_filter)
    interviews_planned = await db.interviews.count_documents({**interview_filter, "statut": "planned"})
    interviews_completed = await db.interviews.count_documents({**interview_filter, "statut": "completed"})
    interviews_cancelled = await db.interviews.count_documents({**interview_filter, "statut": "cancelled"})

    return StatisticsOverview(
        dashboard=dashboard,
        timeline=timeline,
        by_status=by_status,
        by_type=by_type,
        by_method=by_method,
        avg_response_time_days=avg_response_time,
        interviews_stats={
            "total": interviews_total,
            "planned": interviews_planned,
            "completed": interviews_completed,
            "cancelled": interviews_cancelled,
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
    db = Depends(get_db),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
):
    """Dashboard V2 avec insights intelligents, score et objectifs"""
    user_id = current_user["user_id"]
    now = datetime.now()

    # Filtre de période sur date_candidature
    period_filter: dict = {"user_id": user_id}
    if date_from or date_to:
        dr: dict = {}
        if date_from:
            dr["$gte"] = date_from
        if date_to:
            dr["$lte"] = date_to + "T23:59:59"
        period_filter["date_candidature"] = dr

    # ============================================
    # 1. STATS DE BASE (filtrées par période)
    # ============================================
    total_apps = await db.applications.count_documents(period_filter)
    pending = await db.applications.count_documents({**period_filter, "reponse": "pending"})
    positive = await db.applications.count_documents({**period_filter, "reponse": "positive"})
    negative = await db.applications.count_documents({**period_filter, "reponse": "negative"})
    no_response = await db.applications.count_documents({**period_filter, "reponse": "no_response"})
    cancelled = await db.applications.count_documents({**period_filter, "reponse": "cancelled"})
    wi_result = await db.applications.aggregate([
        {"$match": period_filter},
        {"$lookup": {"from": "interviews", "localField": "id", "foreignField": "candidature_id", "as": "_ivs"}},
        {"$match": {"_ivs": {"$ne": []}}},
        {"$count": "count"}
    ]).to_list(1)
    with_interview = wi_result[0]["count"] if wi_result else 0
    favorites_count = await db.applications.count_documents({**period_filter, "is_favorite": True})
    responded = positive + negative
    response_rate = round(responded / total_apps * 100, 1) if total_apps > 0 else 0.0

    basic_stats = DashboardStats(
        total_applications=total_apps,
        pending=pending,
        with_interview=with_interview,
        positive=positive,
        negative=negative,
        no_response=no_response,
        cancelled=cancelled,
        response_rate=response_rate,
        favorites_count=favorites_count,
    )
    
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
    interview_filter: dict = {"user_id": user_id}
    if date_from or date_to:
        idr: dict = {}
        if date_from:
            idr["$gte"] = date_from
        if date_to:
            idr["$lte"] = date_to + "T23:59:59"
        interview_filter["date_entretien"] = idr
    interview_count = await db.interviews.count_documents(interview_filter)
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
        **period_filter,
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
    old_pending_filter = {**period_filter, "reponse": "pending"}
    # Garde la contrainte d'ancienneté seulement si pas de filtre de période
    if not (date_from or date_to):
        old_pending_filter["date_candidature"] = {"$lt": old_pending_date}
    old_pending = await db.applications.count_documents(old_pending_filter)
    if old_pending > 0:
        insights.append(DashboardInsight(
            type="warning",
            icon="📩",
            message=f"{old_pending} candidature(s) sans réponse depuis plus de 21 jours. Pense à relancer !",
            priority=0
        ))
    
    # Insight sur la régularité
    if avg_weekly < 2 and total_apps > 5 and not (date_from or date_to):
        insights.append(DashboardInsight(
            type="tip",
            icon="💡",
            message="Astuce : Envoyer au moins 5 candidatures par semaine augmente tes chances de 40%.",
            priority=1
        ))
    
    # Insight sur les relances
    if followup_rate < 20 and total_apps > 10 and not (date_from or date_to):
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
            action_url="/dashboard/applications?needs_followup=true"
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


# ============================================
# ANALYSE IA DES STATISTIQUES
# ============================================

@router.get("/ai-analysis")
async def analyze_statistics_with_ai(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    model_provider: Optional[str] = Query(None),
    model_name: Optional[str] = Query(None),
):
    """Analyse IA complète des statistiques de l'utilisateur"""
    from routes.ai import get_user_api_keys, select_api_key, call_ai

    user_id = current_user["user_id"]

    # Récupérer les clés API
    user_keys = await get_user_api_keys(user_id, db)

    # Si l'utilisateur a choisi un provider/modèle spécifique, l'utiliser
    if model_provider and model_name:
        api_key = user_keys.get(model_provider) or None
        # Fallback sur clé env si pas de clé user
        if not api_key:
            import os
            env_map = {
                "openai": os.environ.get("OPENAI_API_KEY"),
                "google": os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY"),
                "groq": os.environ.get("GROQ_API_KEY"),
            }
            api_key = env_map.get(model_provider)
        provider = model_provider
        model = model_name
        if not api_key:
            raise HTTPException(status_code=400, detail=f"Aucune clé API pour le provider '{model_provider}'")
    else:
        api_key, provider = select_api_key(user_keys)
        if not api_key:
            raise HTTPException(status_code=400, detail="Aucune clé API IA configurée")
        model_map = {
            "groq": "llama-3.3-70b-versatile",
            "openai": "gpt-4o-mini",
            "google": "gemini-2.0-flash",
        }
        model = model_map.get(provider, "llama-3.3-70b-versatile")

    # Construire le filtre de période
    period_filter: dict = {"user_id": user_id}
    if date_from or date_to:
        dr: dict = {}
        if date_from:
            dr["$gte"] = date_from
        if date_to:
            dr["$lte"] = date_to + "T23:59:59"
        period_filter["date_candidature"] = dr

    # Collecter toutes les stats
    total = await db.applications.count_documents(period_filter)
    pending = await db.applications.count_documents({**period_filter, "reponse": "pending"})
    positive = await db.applications.count_documents({**period_filter, "reponse": "positive"})
    negative = await db.applications.count_documents({**period_filter, "reponse": "negative"})
    no_response = await db.applications.count_documents({**period_filter, "reponse": "no_response"})
    wi_result = await db.applications.aggregate([
        {"$match": period_filter},
        {"$lookup": {"from": "interviews", "localField": "id", "foreignField": "candidature_id", "as": "_ivs"}},
        {"$match": {"_ivs": {"$ne": []}}},
        {"$count": "count"}
    ]).to_list(1)
    with_interview = wi_result[0]["count"] if wi_result else 0
    responded = positive + negative
    response_rate = round(responded / total * 100, 1) if total > 0 else 0

    interview_filter: dict = {"user_id": user_id}
    if date_from or date_to:
        idr: dict = {}
        if date_from:
            idr["$gte"] = date_from
        if date_to:
            idr["$lte"] = date_to + "T23:59:59"
        interview_filter["date_entretien"] = idr

    interviews_total = await db.interviews.count_documents(interview_filter)
    interviews_completed = await db.interviews.count_documents({**interview_filter, "statut": "completed"})

    # Top méthodes (par volume)
    method_pipeline = [
        {"$match": {**period_filter, "moyen": {"$ne": None}}},
        {"$group": {"_id": "$moyen", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 5}
    ]
    top_methods = await db.applications.aggregate(method_pipeline).to_list(5)
    methods_str = ", ".join([f"{m['_id']} ({m['count']})" for m in top_methods]) or "N/A"

    # Top types de poste
    type_pipeline = [
        {"$match": period_filter},
        {"$group": {"_id": "$type_poste", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 4}
    ]
    top_types = await db.applications.aggregate(type_pipeline).to_list(4)
    types_str = ", ".join([f"{t['_id']} ({t['count']})" for t in top_types]) or "N/A"

    # Période label
    period_label = f"du {date_from} au {date_to}" if date_from and date_to else "toute la période"

    # Null-safe funnel rates
    interview_rate = round(with_interview / total * 100, 1) if total > 0 else 0
    offer_rate = round(positive / total * 100, 1) if total > 0 else 0

    system_message = """Tu es un expert en recherche d'emploi et coaching de carrière.
Tu analyses les statistiques de candidature d'un utilisateur de JobTracker.
Réponds UNIQUEMENT en français, avec un ton bienveillant et direct en tutoyant l'utilisateur.
Format de réponse OBLIGATOIRE : markdown structuré avec des titres ## pour chaque section.
Longueur cible : 400 à 600 mots. Utilise des listes à puces pour les points concrets.
Benchmark de référence : taux de réponse moyen sur le marché = 10-20%, taux d'obtention d'entretien = 5-15%, taux d'offre = 1-5%."""

    user_message = f"""Voici les statistiques de candidature ({period_label}) :

- Total candidatures : {total}
- En attente : {pending} | Réponses positives : {positive} | Refus : {negative} | Sans réponse : {no_response}
- Avec au moins un entretien : {with_interview}
- Taux de réponse global : {response_rate}%
- Entretiens planifiés/passés : {interviews_total} (dont {interviews_completed} complétés)
- Funnel : {total} candidatures → {with_interview} entretiens ({interview_rate}%) → {positive} offres ({offer_rate}%)
- Top sources : {methods_str}
- Types de postes visés : {types_str}

Analyse avec ces sections exactes :
## Résumé global
## Points forts
## Points à améliorer
## Analyse du funnel
## Recommandations concrètes
## Benchmark marché"""

    try:
        analysis = await call_ai(api_key, provider, model, system_message, user_message)
        return {"analysis": analysis, "provider": provider, "model": model, "period": period_label}
    except HTTPException:
        raise
    except Exception as e:
        err = str(e).lower()
        if any(kw in err for kw in ["api key", "invalid_api_key", "unauthorized", "401", "authentication"]):
            raise HTTPException(status_code=401, detail="Clé API invalide ou manquante. Vérifie tes paramètres IA.")
        if any(kw in err for kw in ["rate", "429", "quota", "too many"]):
            raise HTTPException(status_code=429, detail="Limite de requêtes IA atteinte, réessaie dans quelques secondes.")
        if any(kw in err for kw in ["timeout", "connect", "network", "503"]):
            raise HTTPException(status_code=503, detail="Service IA indisponible, réessaie plus tard.")
        raise HTTPException(status_code=500, detail=f"Erreur IA : {str(e)}")
