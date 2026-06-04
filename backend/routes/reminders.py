"""
JobTracker SaaS - Système de Rappels Automatiques
Gère l'envoi de notifications push pour les entretiens à venir
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid
import os
import json

router = APIRouter(prefix="/reminders", tags=["Reminders"])

# Import auth
from utils.auth import get_current_user

# VAPID Config for push
VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY", "")
VAPID_CLAIMS_EMAIL = os.environ.get("VAPID_CLAIMS_EMAIL", "contact@maadec.com")


def get_db():
    """Dependency injection pour la DB"""
    pass


async def send_push_to_user(db, user_id: str, title: str, body: str, url: str = "/dashboard/interviews", tag: str = None) -> int:
    """
    Envoie une notification push à tous les appareils d'un utilisateur.
    Retourne le nombre de notifications envoyées avec succès.
    """
    try:
        from pywebpush import webpush, WebPushException
    except ImportError:
        print("[Reminders] pywebpush non installé")
        return 0
    
    if not VAPID_PRIVATE_KEY:
        print("[Reminders] VAPID_PRIVATE_KEY non configuré")
        return 0
    
    subscriptions = await db.push_subscriptions.find({"user_id": user_id}).to_list(100)
    
    if not subscriptions:
        return 0
    
    payload = {
        "title": title,
        "body": body,
        "icon": "/icons/icon-192x192.png",
        "badge": "/icons/icon-96x96.png",
        "url": url,
        "tag": tag or f"reminder-{uuid.uuid4().hex[:8]}"
    }
    
    success_count = 0
    for sub in subscriptions:
        try:
            webpush(
                subscription_info=sub["subscription"],
                data=json.dumps(payload),
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims={"sub": f"mailto:{VAPID_CLAIMS_EMAIL}"}
            )
            success_count += 1
        except Exception as e:
            error_str = str(e)
            print(f"[Reminders] Erreur push: {error_str}")
            # Supprimer les subscriptions expirées
            if "410" in error_str or "expired" in error_str.lower():
                await db.push_subscriptions.delete_one({"_id": sub["_id"]})
    
    return success_count


async def create_in_app_notification(db, user_id: str, notif_type: str, title: str, message: str, interview_id: str = None):
    """Crée une notification dans l'application"""
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": notif_type,
        "title": title,
        "message": message,
        "interview_id": interview_id,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)
    return notification["id"]


async def process_reminders_for_user(db, user_id: str) -> dict:
    """
    Traite les rappels pour un utilisateur spécifique.
    Vérifie les entretiens à 24h et 1h et envoie les notifications.
    """
    now = datetime.now(timezone.utc)
    results = {"reminders_24h": 0, "reminders_1h": 0, "push_sent": 0}
    
    # Récupérer les paramètres de notification de l'utilisateur
    settings = await db.notification_settings.find_one({"user_id": user_id}) or {}
    reminder_24h_enabled = settings.get("reminder_24h", True)
    reminder_1h_enabled = settings.get("reminder_1h", True)
    
    if not reminder_24h_enabled and not reminder_1h_enabled:
        return results
    
    # Récupérer les entretiens planifiés de l'utilisateur
    interviews = await db.interviews.find({
        "user_id": user_id,
        "statut": "planned"
    }).to_list(100)
    
    for interview in interviews:
        interview_id = str(interview.get("_id", interview.get("id", "")))
        date_str = interview.get("date_entretien")
        
        if not date_str:
            continue
        
        # Parser la date
        try:
            if isinstance(date_str, str):
                interview_date = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
            else:
                interview_date = date_str
            
            if interview_date.tzinfo is None:
                interview_date = interview_date.replace(tzinfo=timezone.utc)
        except Exception as e:
            print(f"[Reminders] Erreur parsing date: {e}")
            continue
        
        # Calculer le temps restant
        time_diff = interview_date - now
        hours_remaining = time_diff.total_seconds() / 3600
        
        # Infos de l'entretien - récupérer depuis la candidature si nécessaire
        entreprise = interview.get("entreprise")
        poste = interview.get("poste")
        
        # Si pas dans l'entretien, récupérer depuis la candidature
        if not entreprise or not poste:
            candidature_id = interview.get("candidature_id") or interview.get("application_id")
            if candidature_id:
                try:
                    from bson import ObjectId
                    candidature = await db.applications.find_one({"_id": ObjectId(candidature_id)})
                    if not candidature:
                        candidature = await db.applications.find_one({"id": candidature_id})
                    if candidature:
                        entreprise = entreprise or candidature.get("entreprise", "Entreprise")
                        poste = poste or candidature.get("poste", "Poste")
                except Exception as e:
                    print(f"[Reminders] Erreur récupération candidature: {e}")
        
        entreprise = entreprise or "Entreprise"
        poste = poste or "Poste"
        type_entretien = interview.get("type_entretien", "")
        
        # Vérifier si déjà notifié
        reminder_key_24h = f"reminder_24h_{interview_id}"
        reminder_key_1h = f"reminder_1h_{interview_id}"
        
        # Rappel 24h (entre 23h et 25h avant)
        if reminder_24h_enabled and 23 <= hours_remaining <= 25:
            existing = await db.sent_reminders.find_one({
                "user_id": user_id,
                "reminder_key": reminder_key_24h
            })
            
            if not existing:
                title = f"🗓️ Entretien demain - {entreprise}"
                body = f"Votre entretien {type_entretien} pour le poste {poste} est prévu demain. Préparez-vous !"
                
                # Envoyer push
                push_count = await send_push_to_user(db, user_id, title, body, "/dashboard/interviews", f"interview-24h-{interview_id}")
                results["push_sent"] += push_count
                
                # Créer notification in-app
                await create_in_app_notification(db, user_id, "interview_reminder_24h", title, body, interview_id)
                
                # Marquer comme envoyé
                await db.sent_reminders.insert_one({
                    "user_id": user_id,
                    "reminder_key": reminder_key_24h,
                    "interview_id": interview_id,
                    "sent_at": now.isoformat()
                })
                
                results["reminders_24h"] += 1
        
        # Rappel 1h (entre 45min et 75min avant)
        if reminder_1h_enabled and 0.75 <= hours_remaining <= 1.25:
            existing = await db.sent_reminders.find_one({
                "user_id": user_id,
                "reminder_key": reminder_key_1h
            })
            
            if not existing:
                title = f"⚠️ Entretien dans 1h - {entreprise}"
                body = f"Votre entretien {type_entretien} chez {entreprise} commence bientôt ! Bonne chance ! 🍀"
                
                # Envoyer push
                push_count = await send_push_to_user(db, user_id, title, body, "/dashboard/interviews", f"interview-1h-{interview_id}")
                results["push_sent"] += push_count
                
                # Créer notification in-app
                await create_in_app_notification(db, user_id, "interview_reminder_1h", title, body, interview_id)
                
                # Marquer comme envoyé
                await db.sent_reminders.insert_one({
                    "user_id": user_id,
                    "reminder_key": reminder_key_1h,
                    "interview_id": interview_id,
                    "sent_at": now.isoformat()
                })
                
                results["reminders_1h"] += 1
    
    return results


@router.post("/process")
async def process_my_reminders(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Traite les rappels pour l'utilisateur connecté.
    Appelé automatiquement par le frontend au chargement du dashboard.
    """
    results = await process_reminders_for_user(db, current_user["user_id"])
    return {
        "processed": True,
        "reminders_24h_sent": results["reminders_24h"],
        "reminders_1h_sent": results["reminders_1h"],
        "push_notifications_sent": results["push_sent"]
    }


@router.post("/process-all")
async def process_all_reminders(
    background_tasks: BackgroundTasks,
    db = Depends(get_db)
):
    """
    Traite les rappels pour TOUS les utilisateurs.
    Endpoint à appeler via un cron job externe (toutes les 15 minutes par exemple).
    Note: Pas de protection auth pour permettre l'appel par cron.
    """
    # Récupérer tous les utilisateurs ayant des entretiens planifiés
    pipeline = [
        {"$match": {"statut": "planned"}},
        {"$group": {"_id": "$user_id"}}
    ]
    
    user_ids = await db.interviews.aggregate(pipeline).to_list(1000)
    
    total_results = {
        "users_processed": 0,
        "reminders_24h": 0,
        "reminders_1h": 0,
        "push_sent": 0
    }
    
    for user_doc in user_ids:
        user_id = user_doc["_id"]
        if user_id:
            results = await process_reminders_for_user(db, user_id)
            total_results["users_processed"] += 1
            total_results["reminders_24h"] += results["reminders_24h"]
            total_results["reminders_1h"] += results["reminders_1h"]
            total_results["push_sent"] += results["push_sent"]
    
    return total_results


@router.get("/status")
async def get_reminder_status(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Récupère le statut des rappels envoyés pour l'utilisateur.
    """
    now = datetime.now(timezone.utc)
    
    # Compter les rappels envoyés aujourd'hui
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    reminders_today = await db.sent_reminders.count_documents({
        "user_id": current_user["user_id"],
        "sent_at": {"$gte": today_start.isoformat()}
    })
    
    # Prochains entretiens
    upcoming = await db.interviews.find({
        "user_id": current_user["user_id"],
        "statut": "planned",
        "date_entretien": {"$gte": now.isoformat()}
    }).sort("date_entretien", 1).limit(5).to_list(5)
    
    upcoming_list = []
    for interview in upcoming:
        date_str = interview.get("date_entretien")
        if date_str:
            try:
                if isinstance(date_str, str):
                    interview_date = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
                else:
                    interview_date = date_str
                
                hours_until = (interview_date - now).total_seconds() / 3600
                
                upcoming_list.append({
                    "id": str(interview.get("_id", interview.get("id", ""))),
                    "entreprise": interview.get("entreprise"),
                    "poste": interview.get("poste"),
                    "date": date_str,
                    "hours_until": round(hours_until, 1)
                })
            except:
                pass
    
    return {
        "reminders_sent_today": reminders_today,
        "upcoming_interviews": upcoming_list,
        "reminder_settings": await db.notification_settings.find_one(
            {"user_id": current_user["user_id"]},
            {"_id": 0, "reminder_24h": 1, "reminder_1h": 1}
        ) or {"reminder_24h": True, "reminder_1h": True}
    }


@router.delete("/clear-sent")
async def clear_sent_reminders(
    interview_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Supprime les rappels envoyés (utile pour re-tester).
    Si interview_id fourni, supprime uniquement pour cet entretien.
    """
    query = {"user_id": current_user["user_id"]}
    if interview_id:
        query["interview_id"] = interview_id
    
    result = await db.sent_reminders.delete_many(query)
    
    return {"deleted": result.deleted_count}


@router.get("/scheduler-status")
async def get_scheduler_status(current_user: dict = Depends(get_current_user)):
    """Statut du scheduler + historique d'exécution des jobs."""
    try:
        from utils.scheduler import scheduler, get_job_logs

        jobs = []
        for job in scheduler.get_jobs():
            logs = get_job_logs(job.id)
            jobs.append({
                "id": job.id,
                "name": job.name,
                "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
                "trigger": str(job.trigger),
                "last_run": logs[0] if logs else None,
                "recent_logs": logs,
            })

        return {
            "scheduler_running": scheduler.running,
            "jobs": jobs,
        }
    except Exception as e:
        return {"scheduler_running": False, "error": str(e)}


@router.post("/trigger-now")
async def trigger_reminders_now(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Déclenche manuellement les rappels entretiens."""
    from utils.scheduler import process_interview_reminders
    stats = await process_interview_reminders(db)
    return {"triggered": True, "job": "interview_reminders", "stats": stats}


@router.post("/trigger-onboarding")
async def trigger_onboarding_reminders_now(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Déclenche manuellement les rappels onboarding incomplet."""
    from utils.scheduler import process_onboarding_reminders
    stats = await process_onboarding_reminders(db)
    return {"triggered": True, "job": "onboarding_reminders", "stats": stats}

