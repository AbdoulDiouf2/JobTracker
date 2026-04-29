from fastapi import APIRouter, Depends, Query, HTTPException
from typing import List, Optional
import re
from datetime import datetime

from utils.auth import get_current_user
from routes.admin import get_admin_user


router = APIRouter(prefix="/search", tags=["Search"])

def get_db():
    pass

@router.get("/global")
async def global_search(
    q: str = Query(..., min_length=1),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Recherche globale dans les données de l'utilisateur (Applications, Entretiens).
    Si l'utilisateur est admin, il peut aussi avoir des résultats sur les utilisateurs ? 
    Non, on va séparer la recherche admin de la recherche user pour plus de clarté.
    """
    user_id = current_user["user_id"]
    search_regex = {"$regex": re.escape(q), "$options": "i"}
    
    results = []

    # 1. Recherche dans les candidatures (Entreprise, Poste)
    apps_cursor = db.applications.find({
        "user_id": user_id,
        "$or": [
            {"entreprise": search_regex},
            {"poste": search_regex}
        ]
    }).limit(5)
    
    async for app in apps_cursor:
        results.append({
            "id": app["id"],
            "type": "application",
            "title": app["entreprise"],
            "subtitle": app["poste"],
            "url": f"/dashboard/applications/{app['id']}",
            "status": app.get("reponse", "pending")
        })

    # 2. Recherche dans les entretiens
    interviews_cursor = db.interviews.find({
        "user_id": user_id,
        "$or": [
            {"entreprise": search_regex},
            {"notes": search_regex}
        ]
    }).limit(5)
    
    async for interview in interviews_cursor:
        results.append({
            "id": interview["id"],
            "type": "interview",
            "title": f"Entretien : {interview['entreprise']}",
            "subtitle": f"{interview.get('type_entretien', 'RH')} - {interview.get('date_entretien', '')}",
            "url": f"/dashboard/interviews", # On n'a pas de page détail par entretien, on renvoie vers la liste
            "date": interview.get("date_entretien")
        })

    return results

@router.get("/admin")
async def admin_search(
    q: str = Query(..., min_length=1),
    admin_user: dict = Depends(get_admin_user),
    db = Depends(get_db)
):
    """Recherche spécifique pour les administrateurs (Utilisateurs)"""
    search_regex = {"$regex": re.escape(q), "$options": "i"}
    
    results = []
    
    # Recherche dans les utilisateurs
    users_cursor = db.users.find({
        "$or": [
            {"full_name": search_regex},
            {"email": search_regex}
        ]
    }).limit(10)
    
    async for user in users_cursor:
        results.append({
            "id": user["id"],
            "type": "user",
            "title": user["full_name"],
            "subtitle": user["email"],
            "url": f"/admin/users", # On peut imaginer filtrer la liste admin
            "role": user.get("role", "standard")
        })
        
    return results
