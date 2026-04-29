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
    Recherche exhaustive dans TOUTES les données de l'utilisateur.
    """
    user_id = current_user["user_id"]
    search_regex = {"$regex": re.escape(q), "$options": "i"}
    
    results = []

    # 1. Candidatures
    apps_cursor = db.applications.find({
        "user_id": user_id,
        "$or": [
            {"entreprise": search_regex},
            {"poste": search_regex},
            {"lieu": search_regex}
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

    # 2. Entretiens
    interviews_cursor = db.interviews.find({
        "user_id": user_id,
        "$or": [
            {"entreprise": search_regex},
            {"notes": search_regex},
            {"type_entretien": search_regex}
        ]
    }).limit(5)
    
    async for interview in interviews_cursor:
        results.append({
            "id": interview["id"],
            "type": "interview",
            "title": f"Entretien : {interview['entreprise']}",
            "subtitle": f"{interview.get('type_entretien', 'RH')} - {interview.get('date_entretien', '')}",
            "url": f"/dashboard/interviews",
            "date": interview.get("date_entretien")
        })

    # 3. Documents (CV, Lettres)
    docs_cursor = db.documents.find({
        "user_id": user_id,
        "$or": [
            {"name": search_regex},
            {"original_filename": search_regex},
            {"description": search_regex}
        ]
    }).limit(5)
    
    async for doc in docs_cursor:
        results.append({
            "id": doc["id"],
            "type": "document",
            "title": doc["name"],
            "subtitle": doc.get("document_type", "Document").upper(),
            "url": "/dashboard/documents",
            "format": doc.get("mime_type")
        })

    # 4. Lettres de motivation générées
    letters_cursor = db.generated_cover_letters.find({
        "user_id": user_id,
        "$or": [
            {"entreprise": search_regex},
            {"poste": search_regex},
            {"content": search_regex}
        ]
    }).limit(3)
    
    async for letter in letters_cursor:
        results.append({
            "id": letter["id"],
            "type": "letter",
            "title": f"Lettre : {letter['entreprise']}",
            "subtitle": letter['poste'],
            "url": "/dashboard/documents", # Ou une page dédiée si elle existe
            "is_ai": True
        })

    # 5. Notifications / Alertes
    notifs_cursor = db.notifications.find({
        "user_id": user_id,
        "$or": [
            {"title": search_regex},
            {"message": search_regex}
        ]
    }).limit(3)
    
    async for notif in notifs_cursor:
        results.append({
            "id": notif["id"],
            "type": "notification",
            "title": notif["title"],
            "subtitle": notif["message"],
            "url": "#",
            "date": notif.get("created_at")
        })

    return results

@router.get("/admin")
async def admin_search(
    q: str = Query(..., min_length=1),
    admin_user: dict = Depends(get_admin_user),
    db = Depends(get_db)
):
    """Recherche spécifique pour les administrateurs (Utilisateurs & Support)"""
    search_regex = {"$regex": re.escape(q), "$options": "i"}
    
    results = []
    
    # 1. Recherche Utilisateurs
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
            "url": f"/admin/users",
            "role": user.get("role", "standard")
        })

    # 2. Recherche Tickets de Support
    tickets_cursor = db.support_tickets.find({
        "$or": [
            {"name": search_regex},
            {"email": search_regex},
            {"message": search_regex}
        ]
    }).limit(5)
    
    async for ticket in tickets_cursor:
        results.append({
            "id": str(ticket.get("_id")),
            "type": "support",
            "title": f"Support : {ticket['name']}",
            "subtitle": ticket['message'][:100] + "...",
            "url": "/admin/support",
            "email": ticket.get("email")
        })
        
    return results

