"""
JobTracker SaaS - Routes Notifications
"""

from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
import os

load_dotenv()

from utils.auth import get_current_user

router = APIRouter(prefix="/notifications", tags=["Notifications"])


def get_db():
    """Dependency injection pour la DB"""
    pass


# Models
class NotificationSettings(BaseModel):
    email_notifications: bool = True
    reminder_24h: bool = True
    reminder_1h: bool = True
    browser_notifications: bool = True


class Notification(BaseModel):
    id: str
    type: str  # 'interview_reminder', 'application_response', 'system'
    title: str
    message: str
    read: bool = False
    created_at: str
    interview_id: Optional[str] = None
    application_id: Optional[str] = None


class NotificationResponse(BaseModel):
    notifications: List[Notification]
    unread_count: int


# Get notification settings
@router.get("/settings", response_model=NotificationSettings)
async def get_notification_settings(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get user's notification settings"""
    settings = await db.notification_settings.find_one(
        {"user_id": current_user["user_id"]},
        {"_id": 0}
    )
    
    if not settings:
        # Return default settings
        return NotificationSettings()
    
    return NotificationSettings(**settings)


# Update notification settings
@router.put("/settings", response_model=NotificationSettings)
async def update_notification_settings(
    settings: NotificationSettings,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Update user's notification settings"""
    await db.notification_settings.update_one(
        {"user_id": current_user["user_id"]},
        {
            "$set": {
                **settings.model_dump(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            },
            "$setOnInsert": {
                "created_at": datetime.now(timezone.utc).isoformat()
            }
        },
        upsert=True
    )
    
    return settings


# Get all notifications
@router.get("", response_model=NotificationResponse)
async def get_notifications(
    limit: int = 20,
    unread_only: bool = False,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get user's notifications"""
    query = {"user_id": current_user["user_id"]}
    if unread_only:
        query["read"] = False
    
    notifications = await db.notifications.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    unread_count = await db.notifications.count_documents({
        "user_id": current_user["user_id"],
        "read": False
    })
    
    return NotificationResponse(
        notifications=[Notification(**n) for n in notifications],
        unread_count=unread_count
    )


# Mark notification as read
@router.put("/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Mark a notification as read"""
    result = await db.notifications.update_one(
        {"id": notification_id, "user_id": current_user["user_id"]},
        {"$set": {"read": True}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"message": "Marked as read"}


# Mark all as read
@router.put("/read-all")
async def mark_all_read(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Mark all notifications as read"""
    await db.notifications.update_many(
        {"user_id": current_user["user_id"], "read": False},
        {"$set": {"read": True}}
    )
    
    return {"message": "All marked as read"}


# Delete notification
@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Delete a notification"""
    result = await db.notifications.delete_one(
        {"id": notification_id, "user_id": current_user["user_id"]}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"message": "Deleted"}


# Get upcoming interview reminders (for dashboard widget)
@router.get("/upcoming-reminders")
async def get_upcoming_reminders(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get interviews happening in the next 24 hours"""
    now = datetime.now(timezone.utc)
    in_24h = now + timedelta(hours=24)
    
    interviews = await db.interviews.find({
        "user_id": current_user["user_id"],
        "statut": "planned",
        "date_entretien": {
            "$gte": now.isoformat(),
            "$lte": in_24h.isoformat()
        }
    }, {"_id": 0}).sort("date_entretien", 1).to_list(10)
    
    return interviews


# Generate reminder notifications (called by scheduler or manually)
@router.post("/generate-reminders")
async def generate_reminders(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Generate reminder notifications for upcoming interviews"""
    import uuid
    
    now = datetime.now(timezone.utc)
    
    # Get user's notification settings
    settings = await db.notification_settings.find_one(
        {"user_id": current_user["user_id"]},
        {"_id": 0}
    ) or {}
    
    if not settings.get("reminder_24h", True) and not settings.get("reminder_1h", True):
        return {"generated": 0}
    
    generated = 0
    
    # Check for 24h reminders
    if settings.get("reminder_24h", True):
        in_24h = now + timedelta(hours=24)
        in_25h = now + timedelta(hours=25)
        
        interviews_24h = await db.interviews.find({
            "user_id": current_user["user_id"],
            "statut": "planned",
            "date_entretien": {
                "$gte": in_24h.isoformat(),
                "$lte": in_25h.isoformat()
            }
        }, {"_id": 0}).to_list(100)
        
        for interview in interviews_24h:
            # Check if notification already exists
            existing = await db.notifications.find_one({
                "user_id": current_user["user_id"],
                "interview_id": interview["id"],
                "type": "interview_reminder_24h"
            })
            
            if not existing:
                await db.notifications.insert_one({
                    "id": str(uuid.uuid4()),
                    "user_id": current_user["user_id"],
                    "type": "interview_reminder_24h",
                    "title": f"🔔 Entretien dans 24h - {interview['entreprise']}",
                    "message": f"Votre entretien {interview.get('type_entretien', '')} chez {interview['entreprise']} pour le poste {interview['poste']} est prévu demain.",
                    "interview_id": interview["id"],
                    "read": False,
                    "created_at": now.isoformat()
                })
                generated += 1
    
    # Check for 1h reminders
    if settings.get("reminder_1h", True):
        in_1h = now + timedelta(hours=1)
        in_2h = now + timedelta(hours=2)
        
        interviews_1h = await db.interviews.find({
            "user_id": current_user["user_id"],
            "statut": "planned",
            "date_entretien": {
                "$gte": in_1h.isoformat(),
                "$lte": in_2h.isoformat()
            }
        }, {"_id": 0}).to_list(100)
        
        for interview in interviews_1h:
            existing = await db.notifications.find_one({
                "user_id": current_user["user_id"],
                "interview_id": interview["id"],
                "type": "interview_reminder_1h"
            })
            
            if not existing:
                await db.notifications.insert_one({
                    "id": str(uuid.uuid4()),
                    "user_id": current_user["user_id"],
                    "type": "interview_reminder_1h",
                    "title": f"⚠️ Entretien dans 1h - {interview['entreprise']}",
                    "message": f"Votre entretien {interview.get('type_entretien', '')} chez {interview['entreprise']} commence bientôt !",
                    "interview_id": interview["id"],
                    "read": False,
                    "created_at": now.isoformat()
                })
                generated += 1
    
    return {"generated": generated}


# ===========================================
# PUSH NOTIFICATIONS (Web Push API)
# ===========================================

import json

# VAPID Configuration
VAPID_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY", "")
VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY", "")
VAPID_CLAIMS_EMAIL = os.environ.get("VAPID_CLAIMS_EMAIL", "contact@maadec.com")


class PushSubscriptionKeys(BaseModel):
    p256dh: str
    auth: str


class PushSubscriptionData(BaseModel):
    endpoint: str
    keys: PushSubscriptionKeys


class SubscribeRequest(BaseModel):
    subscription: PushSubscriptionData
    device_name: Optional[str] = None


async def send_push_notification(db, subscription_info: dict, payload: dict) -> bool:
    """Send a push notification to a single subscription"""
    try:
        from pywebpush import webpush, WebPushException
        
        webpush(
            subscription_info=subscription_info,
            data=json.dumps(payload),
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims={"sub": f"mailto:{VAPID_CLAIMS_EMAIL}"}
        )
        return True
    except Exception as e:
        error_str = str(e)
        print(f"[Push] Erreur: {error_str}")
        # Si subscription expirée (410 Gone), on la supprime
        if "410" in error_str or "expired" in error_str.lower():
            await db.push_subscriptions.delete_one({
                "subscription.endpoint": subscription_info.get("endpoint")
            })
        return False


@router.get("/push/vapid-key")
async def get_vapid_public_key():
    """Get the VAPID public key for client-side subscription"""
    if not VAPID_PUBLIC_KEY:
        raise HTTPException(status_code=503, detail="Push notifications not configured")
    return {"publicKey": VAPID_PUBLIC_KEY}


@router.post("/push/subscribe")
async def subscribe_to_push(
    data: SubscribeRequest,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Subscribe a device to push notifications"""
    user_id = current_user["user_id"]
    
    # Check if subscription already exists
    existing = await db.push_subscriptions.find_one({
        "user_id": user_id,
        "subscription.endpoint": data.subscription.endpoint
    })
    
    if existing:
        # Update existing subscription
        await db.push_subscriptions.update_one(
            {"_id": existing["_id"]},
            {"$set": {
                "subscription": data.subscription.model_dump(),
                "device_name": data.device_name,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        return {"message": "Subscription updated"}
    
    # Create new subscription
    subscription_doc = {
        "user_id": user_id,
        "subscription": data.subscription.model_dump(),
        "device_name": data.device_name,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.push_subscriptions.insert_one(subscription_doc)
    
    # Send a welcome notification
    welcome_payload = {
        "title": "Notifications activées 🔔",
        "body": "Vous recevrez des alertes pour vos entretiens et candidatures.",
        "icon": "/icons/icon-192x192.png",
        "url": "/dashboard"
    }
    
    await send_push_notification(db, data.subscription.model_dump(), welcome_payload)
    
    return {"message": "Subscribed successfully"}


@router.delete("/push/unsubscribe")
async def unsubscribe_from_push(
    endpoint: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Unsubscribe a device from push notifications"""
    user_id = current_user["user_id"]
    
    result = await db.push_subscriptions.delete_one({
        "user_id": user_id,
        "subscription.endpoint": endpoint
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    return {"message": "Unsubscribed successfully"}


@router.post("/push/test")
async def send_test_push(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Send a test push notification to all user's devices"""
    user_id = current_user["user_id"]
    
    subscriptions = await db.push_subscriptions.find(
        {"user_id": user_id}
    ).to_list(100)
    
    if not subscriptions:
        raise HTTPException(status_code=404, detail="Aucun appareil enregistré")
    
    payload = {
        "title": "Test de notification 🧪",
        "body": "Si vous voyez ceci, les notifications push fonctionnent !",
        "icon": "/icons/icon-192x192.png",
        "url": "/dashboard"
    }
    
    success_count = 0
    for sub in subscriptions:
        if await send_push_notification(db, sub["subscription"], payload):
            success_count += 1
    
    return {
        "message": f"Envoyé à {success_count}/{len(subscriptions)} appareil(s)",
        "success_count": success_count,
        "total": len(subscriptions)
    }


async def notify_user_push(db, user_id: str, title: str, body: str, url: str = "/dashboard", tag: str = None):
    """
    Internal function to send push notification to all devices of a user.
    Can be called from other modules for interview reminders, etc.
    """
    subscriptions = await db.push_subscriptions.find(
        {"user_id": user_id}
    ).to_list(100)
    
    if not subscriptions:
        return False
    
    payload = {
        "title": title,
        "body": body,
        "icon": "/icons/icon-192x192.png",
        "badge": "/icons/icon-96x96.png",
        "url": url
    }
    if tag:
        payload["tag"] = tag
    
    success = False
    for sub in subscriptions:
        if await send_push_notification(db, sub["subscription"], payload):
            success = True
    
    return success

