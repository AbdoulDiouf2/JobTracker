"""
JobTracker SaaS - Routes des entretiens
"""

from fastapi import APIRouter, HTTPException, status, Depends, Query
from typing import Optional, List
from datetime import datetime, timezone, timedelta

from models import (
    Interview, InterviewCreate, InterviewUpdate, InterviewResponse,
    InterviewStatus, InterviewType, InterviewFormat
)
from utils.auth import get_current_user

router = APIRouter(prefix="/interviews", tags=["Interviews"])


def get_db():
    """Dependency injection pour la DB"""
    pass


def calculate_time_remaining(interview_date: datetime) -> tuple:
    """Calcule le temps restant et le niveau d'urgence"""
    now = datetime.now(timezone.utc)
    
    if isinstance(interview_date, str):
        interview_date = datetime.fromisoformat(interview_date.replace('Z', '+00:00'))
    
    if interview_date.tzinfo is None:
        interview_date = interview_date.replace(tzinfo=timezone.utc)
    
    diff = interview_date - now
    
    if diff.total_seconds() < 0:
        return "Passé", "passed"
    
    days = diff.days
    hours, remainder = divmod(diff.seconds, 3600)
    minutes = remainder // 60
    
    # Calculer l'urgence
    total_hours = diff.total_seconds() / 3600
    if total_hours < 1:
        urgency = "danger"
        time_str = f"{minutes} min"
    elif total_hours < 24:
        urgency = "warning"
        time_str = f"{hours}h {minutes}min"
    elif days < 7:
        urgency = "info"
        time_str = f"{days}j {hours}h"
    else:
        urgency = "normal"
        time_str = f"{days} jours"
    
    return time_str, urgency


@router.get("", response_model=List[InterviewResponse])
async def list_interviews(
    status: Optional[InterviewStatus] = None,
    interview_type: Optional[InterviewType] = None,
    interview_format: Optional[InterviewFormat] = None,
    candidature_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Liste tous les entretiens"""
    filter_query = {"user_id": current_user["user_id"]}
    
    if status:
        filter_query["statut"] = status.value
    if interview_type:
        filter_query["type_entretien"] = interview_type.value
    if interview_format:
        filter_query["format_entretien"] = interview_format.value
    if candidature_id:
        filter_query["candidature_id"] = candidature_id
    
    cursor = db.interviews.find(filter_query, {"_id": 0}).sort("date_entretien", 1)
    interviews = await cursor.to_list(length=500)
    
    # Enrichir avec les infos de candidature et le temps restant
    enriched = []
    for interview in interviews:
        # Récupérer la candidature
        application = await db.applications.find_one(
            {"id": interview["candidature_id"]},
            {"_id": 0, "entreprise": 1, "poste": 1}
        )
        
        interview["entreprise"] = application["entreprise"] if application else "N/A"
        interview["poste"] = application["poste"] if application else "N/A"
        
        # Calculer le temps restant si planifié
        if interview["statut"] == "planned":
            time_remaining, urgency = calculate_time_remaining(interview["date_entretien"])
            interview["time_remaining"] = time_remaining
            interview["urgency"] = urgency
        else:
            interview["time_remaining"] = None
            interview["urgency"] = None
        
        enriched.append(interview)
    
    return enriched


@router.get("/upcoming", response_model=List[InterviewResponse])
async def get_upcoming_interviews(
    limit: int = Query(5, ge=1, le=20),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Récupère les prochains entretiens planifiés"""
    now = datetime.now(timezone.utc).isoformat()
    
    cursor = db.interviews.find(
        {
            "user_id": current_user["user_id"],
            "statut": "planned",
            "date_entretien": {"$gte": now}
        },
        {"_id": 0}
    ).sort("date_entretien", 1).limit(limit)
    
    interviews = await cursor.to_list(length=limit)
    
    # Enrichir
    enriched = []
    for interview in interviews:
        application = await db.applications.find_one(
            {"id": interview["candidature_id"]},
            {"_id": 0, "entreprise": 1, "poste": 1}
        )
        
        interview["entreprise"] = application["entreprise"] if application else "N/A"
        interview["poste"] = application["poste"] if application else "N/A"
        
        time_remaining, urgency = calculate_time_remaining(interview["date_entretien"])
        interview["time_remaining"] = time_remaining
        interview["urgency"] = urgency
        
        enriched.append(interview)
    
    return enriched


@router.post("", response_model=InterviewResponse, status_code=status.HTTP_201_CREATED)
async def create_interview(
    interview_data: InterviewCreate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Crée un nouvel entretien"""
    # Vérifier que la candidature existe et appartient à l'utilisateur
    application = await db.applications.find_one(
        {"id": interview_data.candidature_id, "user_id": current_user["user_id"]}
    )
    
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidature non trouvée"
        )
    
    interview = Interview(
        **interview_data.model_dump(),
        user_id=current_user["user_id"]
    )
    
    interview_dict = interview.model_dump()
    # Convertir les datetimes et enums
    interview_dict['date_entretien'] = interview_dict['date_entretien'].isoformat()
    interview_dict['created_at'] = interview_dict['created_at'].isoformat()
    interview_dict['statut'] = interview_dict['statut'].value if hasattr(interview_dict['statut'], 'value') else interview_dict['statut']
    interview_dict['type_entretien'] = interview_dict['type_entretien'].value if hasattr(interview_dict['type_entretien'], 'value') else interview_dict['type_entretien']
    interview_dict['format_entretien'] = interview_dict['format_entretien'].value if hasattr(interview_dict['format_entretien'], 'value') else interview_dict['format_entretien']
    
    await db.interviews.insert_one(interview_dict)
    
    # Retourner enrichi
    response = interview.model_dump()
    response["entreprise"] = application["entreprise"]
    response["poste"] = application["poste"]
    
    time_remaining, urgency = calculate_time_remaining(interview.date_entretien)
    response["time_remaining"] = time_remaining
    response["urgency"] = urgency
    
    return response


@router.get("/{interview_id}", response_model=InterviewResponse)
async def get_interview(
    interview_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Récupère un entretien par ID"""
    interview = await db.interviews.find_one(
        {"id": interview_id, "user_id": current_user["user_id"]},
        {"_id": 0}
    )
    
    if not interview:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Entretien non trouvé"
        )
    
    # Enrichir
    application = await db.applications.find_one(
        {"id": interview["candidature_id"]},
        {"_id": 0, "entreprise": 1, "poste": 1}
    )
    
    interview["entreprise"] = application["entreprise"] if application else "N/A"
    interview["poste"] = application["poste"] if application else "N/A"
    
    if interview["statut"] == "planned":
        time_remaining, urgency = calculate_time_remaining(interview["date_entretien"])
        interview["time_remaining"] = time_remaining
        interview["urgency"] = urgency
    
    return interview


@router.put("/{interview_id}", response_model=InterviewResponse)
async def update_interview(
    interview_id: str,
    interview_update: InterviewUpdate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Met à jour un entretien"""
    existing = await db.interviews.find_one(
        {"id": interview_id, "user_id": current_user["user_id"]}
    )
    
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Entretien non trouvé"
        )
    
    update_data = {k: v for k, v in interview_update.model_dump().items() if v is not None}
    
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Aucune donnée à mettre à jour"
        )
    
    # Convertir les enums et dates
    for key, value in update_data.items():
        if hasattr(value, 'value'):
            update_data[key] = value.value
        elif isinstance(value, datetime):
            update_data[key] = value.isoformat()
    
    await db.interviews.update_one(
        {"id": interview_id},
        {"$set": update_data}
    )
    
    return await get_interview(interview_id, current_user, db)


@router.delete("/{interview_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_interview(
    interview_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Supprime un entretien"""
    result = await db.interviews.delete_one(
        {"id": interview_id, "user_id": current_user["user_id"]}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Entretien non trouvé"
        )
