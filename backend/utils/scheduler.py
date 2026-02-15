"""
JobTracker SaaS - Scheduler pour les tâches automatiques
Utilise APScheduler pour exécuter les rappels automatiquement
"""

import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from datetime import datetime, timezone
import os
import json

logger = logging.getLogger(__name__)

# Instance globale du scheduler
scheduler = AsyncIOScheduler()

# VAPID Config
VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY", "")
VAPID_CLAIMS_EMAIL = os.environ.get("VAPID_CLAIMS_EMAIL", "contact@maadec.com")


async def send_push_notification(db, subscription_info: dict, payload: dict) -> bool:
    """Envoie une notification push"""
    try:
        from pywebpush import webpush
        
        if not VAPID_PRIVATE_KEY:
            return False
        
        webpush(
            subscription_info=subscription_info,
            data=json.dumps(payload),
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims={"sub": f"mailto:{VAPID_CLAIMS_EMAIL}"}
        )
        return True
    except Exception as e:
        error_str = str(e)
        logger.warning(f"[Scheduler] Push error: {error_str}")
        if "410" in error_str or "expired" in error_str.lower():
            await db.push_subscriptions.delete_one({
                "subscription.endpoint": subscription_info.get("endpoint")
            })
        return False


async def process_interview_reminders(db):
    """
    Traite les rappels d'entretiens pour TOUS les utilisateurs.
    Appelé automatiquement par le scheduler toutes les 15 minutes.
    """
    now = datetime.now(timezone.utc)
    logger.info(f"[Scheduler] Traitement des rappels - {now.isoformat()}")
    
    stats = {"users": 0, "reminders_24h": 0, "reminders_1h": 0, "push_sent": 0}
    
    try:
        # Récupérer tous les entretiens planifiés
        interviews = await db.interviews.find({"statut": "planned"}).to_list(1000)
        
        # Grouper par utilisateur
        users_interviews = {}
        for interview in interviews:
            user_id = interview.get("user_id")
            if user_id:
                if user_id not in users_interviews:
                    users_interviews[user_id] = []
                users_interviews[user_id].append(interview)
        
        for user_id, user_interviews in users_interviews.items():
            # Récupérer les paramètres de notification
            settings = await db.notification_settings.find_one({"user_id": user_id}) or {}
            reminder_24h_enabled = settings.get("reminder_24h", True)
            reminder_1h_enabled = settings.get("reminder_1h", True)
            
            if not reminder_24h_enabled and not reminder_1h_enabled:
                continue
            
            stats["users"] += 1
            
            for interview in user_interviews:
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
                except Exception:
                    continue
                
                # Calculer le temps restant
                hours_remaining = (interview_date - now).total_seconds() / 3600
                
                # Récupérer les infos de l'entretien ou de la candidature associée
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
                            logger.warning(f"[Scheduler] Erreur récupération candidature: {e}")
                
                entreprise = entreprise or "Entreprise"
                poste = poste or "Poste"
                type_entretien = interview.get("type_entretien", "")
                
                # Rappel 24h (entre 23h et 25h avant)
                if reminder_24h_enabled and 23 <= hours_remaining <= 25:
                    reminder_key = f"reminder_24h_{interview_id}"
                    existing = await db.sent_reminders.find_one({
                        "user_id": user_id,
                        "reminder_key": reminder_key
                    })
                    
                    if not existing:
                        title = f"🗓️ Entretien demain - {entreprise}"
                        body = f"Votre entretien {type_entretien} pour {poste} est prévu demain. Préparez-vous !"
                        
                        # Envoyer push
                        subscriptions = await db.push_subscriptions.find({"user_id": user_id}).to_list(10)
                        for sub in subscriptions:
                            payload = {
                                "title": title,
                                "body": body,
                                "icon": "/icons/icon-192x192.png",
                                "url": "/dashboard/interviews",
                                "tag": f"interview-24h-{interview_id}"
                            }
                            if await send_push_notification(db, sub["subscription"], payload):
                                stats["push_sent"] += 1
                        
                        # Créer notification in-app
                        await db.notifications.insert_one({
                            "id": f"notif-{interview_id}-24h",
                            "user_id": user_id,
                            "type": "interview_reminder_24h",
                            "title": title,
                            "message": body,
                            "interview_id": interview_id,
                            "read": False,
                            "created_at": now.isoformat()
                        })
                        
                        # Marquer comme envoyé
                        await db.sent_reminders.insert_one({
                            "user_id": user_id,
                            "reminder_key": reminder_key,
                            "interview_id": interview_id,
                            "sent_at": now.isoformat()
                        })
                        
                        stats["reminders_24h"] += 1
                        logger.info(f"[Scheduler] Rappel 24h envoyé: {entreprise} -> {user_id}")
                
                # Rappel 1h (entre 45min et 75min avant)
                if reminder_1h_enabled and 0.75 <= hours_remaining <= 1.25:
                    reminder_key = f"reminder_1h_{interview_id}"
                    existing = await db.sent_reminders.find_one({
                        "user_id": user_id,
                        "reminder_key": reminder_key
                    })
                    
                    if not existing:
                        title = f"⚠️ Entretien dans 1h - {entreprise}"
                        body = f"Votre entretien chez {entreprise} commence bientôt ! Bonne chance ! 🍀"
                        
                        # Envoyer push
                        subscriptions = await db.push_subscriptions.find({"user_id": user_id}).to_list(10)
                        for sub in subscriptions:
                            payload = {
                                "title": title,
                                "body": body,
                                "icon": "/icons/icon-192x192.png",
                                "url": "/dashboard/interviews",
                                "tag": f"interview-1h-{interview_id}"
                            }
                            if await send_push_notification(db, sub["subscription"], payload):
                                stats["push_sent"] += 1
                        
                        # Créer notification in-app
                        await db.notifications.insert_one({
                            "id": f"notif-{interview_id}-1h",
                            "user_id": user_id,
                            "type": "interview_reminder_1h",
                            "title": title,
                            "message": body,
                            "interview_id": interview_id,
                            "read": False,
                            "created_at": now.isoformat()
                        })
                        
                        # Marquer comme envoyé
                        await db.sent_reminders.insert_one({
                            "user_id": user_id,
                            "reminder_key": reminder_key,
                            "interview_id": interview_id,
                            "sent_at": now.isoformat()
                        })
                        
                        stats["reminders_1h"] += 1
                        logger.info(f"[Scheduler] Rappel 1h envoyé: {entreprise} -> {user_id}")
        
        logger.info(f"[Scheduler] Terminé - Users: {stats['users']}, 24h: {stats['reminders_24h']}, 1h: {stats['reminders_1h']}, Push: {stats['push_sent']}")
        
    except Exception as e:
        logger.error(f"[Scheduler] Erreur: {str(e)}")
    
    return stats


def setup_scheduler(db):
    """
    Configure et démarre le scheduler avec la référence à la DB.
    Appelé au démarrage de l'application.
    """
    
    async def job_wrapper():
        """Wrapper pour passer la DB au job"""
        await process_interview_reminders(db)
    
    # Ajouter le job de rappels (toutes les 15 minutes)
    scheduler.add_job(
        job_wrapper,
        trigger=IntervalTrigger(minutes=15),
        id='interview_reminders',
        name='Traitement des rappels d\'entretiens',
        replace_existing=True,
        max_instances=1
    )
    
    # Démarrer le scheduler
    scheduler.start()
    logger.info("[Scheduler] ✅ Scheduler démarré - Rappels toutes les 15 minutes")


def shutdown_scheduler():
    """Arrête proprement le scheduler"""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("[Scheduler] Scheduler arrêté")
