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
    q: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Recherche exhaustive ou suggestions par défaut.
    """
    user_id = current_user["user_id"]
    results = []

    # Cas où la recherche est vide : on renvoie des suggestions (Récents / Prochains)
    if not q or q.strip() == "":
        # 1. Candidatures récentes
        recent_apps = await db.applications.find(
            {"user_id": user_id}
        ).sort("updated_at", -1).limit(4).to_list(4)
        
        for app in recent_apps:
            results.append({
                "id": app["id"],
                "type": "application",
                "title": app["entreprise"],
                "subtitle": f"Récemment mis à jour - {app['poste']}",
                "url": f"/dashboard/applications?id={app['id']}",
                "suggestion": True
            })

        # 2. Entretiens à venir
        upcoming_interviews = await db.interviews.find(
            {"user_id": user_id, "statut": "planned"}
        ).sort("date_entretien", 1).limit(3).to_list(3)
        
        for interview in upcoming_interviews:
            app_info = await db.applications.find_one({"id": interview["candidature_id"]}, {"entreprise": 1, "poste": 1})
            results.append({
                "id": interview["id"],
                "type": "interview",
                "title": f"Entretien : {app_info['entreprise'] if app_info else '?'}",
                "subtitle": f"Prochainement le {interview['date_entretien'][:10]}",
                "url": f"/dashboard/interviews?id={interview['id']}",
                "suggestion": True
            })
            
        return results

    search_regex = {"$regex": re.escape(q), "$options": "i"}


    # 1. Candidatures
    apps_cursor = db.applications.find({
        "user_id": user_id,
        "$or": [
            {"entreprise": search_regex},
            {"poste": search_regex},
            {"lieu": search_regex}
        ]
    }).limit(10)
    
    async for app in apps_cursor:
        results.append({
            "id": app["id"],
            "type": "application",
            "title": app["entreprise"],
            "subtitle": app["poste"],
            "url": f"/dashboard/applications?id={app['id']}",

            "status": app.get("reponse", "pending")
        })

    # 2. Entretiens (Recherche croisée avec candidatures car entreprise/poste ne sont pas stockés dans l'entretien)
    matching_apps = await db.applications.find({
        "user_id": user_id,
        "$or": [
            {"entreprise": search_regex},
            {"poste": search_regex}
        ]
    }, {"id": 1}).to_list(100)
    
    app_ids = [app["id"] for app in matching_apps]
    
    interviews_cursor = db.interviews.find({
        "user_id": user_id,
        "$or": [
            {"candidature_id": {"$in": app_ids}},
            {"notes": search_regex},
            {"type_entretien": search_regex},
            {"interviewer": search_regex}
        ]
    }).limit(10)
    
    async for interview in interviews_cursor:

        # Récupérer les infos de l'entreprise pour l'affichage
        app_info = await db.applications.find_one({"id": interview["candidature_id"]}, {"entreprise": 1, "poste": 1})
        title = app_info["entreprise"] if app_info else "Entretien"
        subtitle = app_info["poste"] if app_info else interview.get("type_entretien", "RH")
        
        results.append({
            "id": interview["id"],
            "type": "interview",
            "title": f"Entretien : {title}",
            "subtitle": f"{subtitle} - {interview.get('date_entretien', '')[:10]}",
            "url": f"/dashboard/interviews?id={interview['id']}",
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
    }).limit(10)
    
    async for doc in docs_cursor:

        results.append({
            "id": doc["id"],
            "type": "document",
            "title": doc["name"],
            "subtitle": doc.get("document_type", "Document").upper(),
            "url": f"/dashboard/documents?id={doc['id']}",
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
    }).limit(8)

    
    async for letter in letters_cursor:
        results.append({
            "id": letter["id"],
            "type": "letter",
            "title": f"Lettre : {letter['entreprise']}",
            "subtitle": letter['poste'],
            "url": f"/dashboard/documents?id={letter['id']}",
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
    }).limit(10)

    
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

