"""
JobTracker SaaS - Routes des candidatures
"""

from fastapi import APIRouter, HTTPException, status, Depends, Query
from typing import Optional, List
from datetime import datetime, timezone
import re

from models import (
    JobApplication, JobApplicationCreate, JobApplicationUpdate,
    JobApplicationResponse, ApplicationStatus, JobType, ApplicationMethod,
    BulkUpdateRequest, PaginatedResponse
)
from utils.auth import get_current_user

router = APIRouter(prefix="/applications", tags=["Applications"])


def get_db():
    """Dependency injection pour la DB"""
    pass


@router.get("", response_model=PaginatedResponse)
async def list_applications(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    sort_by: str = Query("date_candidature"),
    sort_order: str = Query("desc"),
    search: Optional[str] = None,
    status: Optional[ApplicationStatus] = None,
    job_type: Optional[JobType] = None,
    method: Optional[ApplicationMethod] = None,
    is_favorite: Optional[bool] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Liste les candidatures avec filtres et pagination"""
    # Construire le filtre
    filter_query = {"user_id": current_user["user_id"]}
    
    if search:
        # Recherche dans entreprise et poste
        search_regex = {"$regex": re.escape(search), "$options": "i"}
        filter_query["$or"] = [
            {"entreprise": search_regex},
            {"poste": search_regex}
        ]
    
    if status:
        filter_query["reponse"] = status.value
    
    if job_type:
        filter_query["type_poste"] = job_type.value
    
    if method:
        filter_query["moyen"] = method.value
    
    if is_favorite is not None:
        filter_query["is_favorite"] = is_favorite
    
    if date_from:
        filter_query["date_candidature"] = {"$gte": date_from}
    
    if date_to:
        if "date_candidature" in filter_query:
            filter_query["date_candidature"]["$lte"] = date_to
        else:
            filter_query["date_candidature"] = {"$lte": date_to}
    
    # Compter le total
    total = await db.applications.count_documents(filter_query)
    
    # Tri
    sort_direction = -1 if sort_order == "desc" else 1
    
    # Récupérer les candidatures
    skip = (page - 1) * per_page
    cursor = db.applications.find(filter_query, {"_id": 0}).sort(sort_by, sort_direction).skip(skip).limit(per_page)
    applications = await cursor.to_list(length=per_page)
    
    # Enrichir avec les infos d'entretiens
    enriched_apps = []
    for app in applications:
        # Compter les entretiens
        interviews_count = await db.interviews.count_documents({"candidature_id": app["id"]})
        
        # Prochain entretien
        next_interview = await db.interviews.find_one(
            {
                "candidature_id": app["id"],
                "statut": "planned",
                "date_entretien": {"$gte": datetime.now(timezone.utc).isoformat()}
            },
            {"_id": 0, "date_entretien": 1},
            sort=[("date_entretien", 1)]
        )
        
        app["interviews_count"] = interviews_count
        app["next_interview"] = next_interview["date_entretien"] if next_interview else None
        enriched_apps.append(app)
    
    total_pages = (total + per_page - 1) // per_page
    
    return PaginatedResponse(
        items=enriched_apps,
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages
    )


@router.post("", response_model=JobApplicationResponse, status_code=status.HTTP_201_CREATED)
async def create_application(
    app_data: JobApplicationCreate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Crée une nouvelle candidature"""
    application = JobApplication(
        **app_data.model_dump(),
        user_id=current_user["user_id"]
    )
    
    app_dict = application.model_dump()
    # Convertir les datetimes en ISO strings
    app_dict['date_candidature'] = app_dict['date_candidature'].isoformat() if app_dict['date_candidature'] else None
    app_dict['created_at'] = app_dict['created_at'].isoformat()
    app_dict['updated_at'] = app_dict['updated_at'].isoformat()
    if app_dict.get('date_reponse'):
        app_dict['date_reponse'] = app_dict['date_reponse'].isoformat()
    
    # Convertir les enums en valeurs
    app_dict['reponse'] = app_dict['reponse'].value if hasattr(app_dict['reponse'], 'value') else app_dict['reponse']
    app_dict['type_poste'] = app_dict['type_poste'].value if hasattr(app_dict['type_poste'], 'value') else app_dict['type_poste']
    if app_dict.get('moyen'):
        app_dict['moyen'] = app_dict['moyen'].value if hasattr(app_dict['moyen'], 'value') else app_dict['moyen']
    
    await db.applications.insert_one(app_dict)
    
    return JobApplicationResponse(**application.model_dump(), interviews_count=0, next_interview=None)


@router.get("/{application_id}", response_model=JobApplicationResponse)
async def get_application(
    application_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Récupère une candidature par ID"""
    application = await db.applications.find_one(
        {"id": application_id, "user_id": current_user["user_id"]},
        {"_id": 0}
    )
    
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidature non trouvée"
        )
    
    # Compter les entretiens
    interviews_count = await db.interviews.count_documents({"candidature_id": application_id})
    
    # Prochain entretien
    next_interview = await db.interviews.find_one(
        {
            "candidature_id": application_id,
            "statut": "planned",
            "date_entretien": {"$gte": datetime.now(timezone.utc).isoformat()}
        },
        {"_id": 0, "date_entretien": 1},
        sort=[("date_entretien", 1)]
    )
    
    application["interviews_count"] = interviews_count
    application["next_interview"] = next_interview["date_entretien"] if next_interview else None
    
    # Calculer si une relance est recommandée
    needs_followup = False
    if application.get("reponse") == "pending":
        date_candidature = application.get("date_candidature")
        if date_candidature:
            if isinstance(date_candidature, str):
                date_candidature = datetime.fromisoformat(date_candidature.replace("Z", "+00:00"))
            days_since = (datetime.now(timezone.utc) - date_candidature).days
            days_before_reminder = application.get("days_before_reminder", 7)
            needs_followup = days_since >= days_before_reminder
    
    application["needs_followup"] = needs_followup
    
    return application


@router.put("/{application_id}", response_model=JobApplicationResponse)
async def update_application(
    application_id: str,
    app_update: JobApplicationUpdate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Met à jour une candidature"""
    # Vérifier que la candidature existe
    existing = await db.applications.find_one(
        {"id": application_id, "user_id": current_user["user_id"]}
    )
    
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidature non trouvée"
        )
    
    # Préparer les données de mise à jour
    update_data = {k: v for k, v in app_update.model_dump().items() if v is not None}
    
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Aucune donnée à mettre à jour"
        )
    
    # Préparer l'événement d'historique pour les changements de statut
    history_event = None
    if "reponse" in update_data and update_data["reponse"] != existing.get("reponse"):
        old_status = existing.get("reponse", "pending")
        new_status = update_data["reponse"]
        if hasattr(new_status, 'value'):
            new_status = new_status.value
        
        history_event = {
            "event_type": "status_change",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "old_value": old_status,
            "new_value": new_status,
            "details": f"Statut changé de {old_status} à {new_status}"
        }
    
    # Convertir les enums et dates
    for key, value in update_data.items():
        if hasattr(value, 'value'):
            update_data[key] = value.value
        elif isinstance(value, datetime):
            update_data[key] = value.isoformat()
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # Construire la requête de mise à jour
    update_query = {"$set": update_data}
    
    # Ajouter l'événement à l'historique si changement de statut
    if history_event:
        update_query["$push"] = {"history": history_event}
    
    await db.applications.update_one(
        {"id": application_id},
        update_query
    )
    
    # Récupérer la candidature mise à jour
    return await get_application(application_id, current_user, db)


@router.delete("/{application_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_application(
    application_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Supprime une candidature et ses entretiens associés"""
    result = await db.applications.delete_one(
        {"id": application_id, "user_id": current_user["user_id"]}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidature non trouvée"
        )
    
    # Supprimer les entretiens associés
    await db.interviews.delete_many({"candidature_id": application_id})


@router.post("/{application_id}/favorite")
async def toggle_favorite(
    application_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Toggle le statut favori d'une candidature"""
    application = await db.applications.find_one(
        {"id": application_id, "user_id": current_user["user_id"]}
    )
    
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidature non trouvée"
        )
    
    new_favorite = not application.get("is_favorite", False)
    
    await db.applications.update_one(
        {"id": application_id},
        {"$set": {"is_favorite": new_favorite, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"is_favorite": new_favorite}


@router.post("/bulk-update")
async def bulk_update_applications(
    bulk_data: BulkUpdateRequest,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Met à jour le statut de plusieurs candidatures"""
    result = await db.applications.update_many(
        {
            "id": {"$in": bulk_data.application_ids},
            "user_id": current_user["user_id"]
        },
        {
            "$set": {
                "reponse": bulk_data.reponse.value,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {
        "modified_count": result.modified_count,
        "message": f"{result.modified_count} candidature(s) mise(s) à jour"
    }


@router.get("/favorites/list", response_model=List[JobApplicationResponse])
async def list_favorites(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Liste les candidatures favorites"""
    cursor = db.applications.find(
        {"user_id": current_user["user_id"], "is_favorite": True},
        {"_id": 0}
    ).sort("date_candidature", -1)
    
    favorites = await cursor.to_list(length=100)
    
    # Enrichir avec les infos d'entretiens
    for app in favorites:
        interviews_count = await db.interviews.count_documents({"candidature_id": app["id"]})
        app["interviews_count"] = interviews_count
        app["next_interview"] = None
    
    return favorites


@router.delete("/reset/all", status_code=status.HTTP_200_OK)
async def reset_all_applications(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Supprime TOUTES les candidatures et entretiens de l'utilisateur"""
    user_id = current_user["user_id"]
    
    # Supprimer tous les entretiens
    interviews_result = await db.interviews.delete_many({"user_id": user_id})
    
    # Supprimer toutes les candidatures
    apps_result = await db.applications.delete_many({"user_id": user_id})
    
    return {
        "success": True,
        "deleted_applications": apps_result.deleted_count,
        "deleted_interviews": interviews_result.deleted_count,
        "message": f"{apps_result.deleted_count} candidature(s) et {interviews_result.deleted_count} entretien(s) supprimé(s)"
    }
