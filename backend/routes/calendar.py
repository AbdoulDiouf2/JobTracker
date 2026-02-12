"""
JobTracker SaaS - Routes Google Calendar
Synchronisation des entretiens avec Google Calendar.
"""

from fastapi import APIRouter, HTTPException, status, Depends, Query
from fastapi.responses import RedirectResponse
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import os
import requests
from pydantic import BaseModel

from utils.auth import get_current_user

router = APIRouter(prefix="/calendar", tags=["Calendar"])


def get_db():
    """Dependency injection pour la DB"""
    pass


# Configuration
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CALENDAR_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CALENDAR_CLIENT_SECRET")
REDIRECT_URI = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001") + "/api/calendar/callback"
FRONTEND_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:3000").replace("/api", "")

SCOPES = [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/userinfo.email"
]


class CalendarEventCreate(BaseModel):
    title: str
    description: Optional[str] = None
    start_time: str  # ISO format
    end_time: str  # ISO format
    location: Optional[str] = None
    interview_id: Optional[str] = None  # Link to JobTracker interview


class CalendarEventResponse(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    start: str
    end: str
    location: Optional[str] = None
    html_link: Optional[str] = None


# ============================================
# OAUTH FLOW
# ============================================

@router.get("/auth/status")
async def get_calendar_auth_status(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Check if user has connected their Google Calendar"""
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        return {
            "configured": False,
            "connected": False,
            "message": "Google Calendar n'est pas configuré sur ce serveur"
        }
    
    user = await db.users.find_one(
        {"id": current_user["user_id"]},
        {"_id": 0, "google_calendar_tokens": 1, "google_calendar_email": 1}
    )
    
    has_tokens = bool(user and user.get("google_calendar_tokens"))
    
    return {
        "configured": True,
        "connected": has_tokens,
        "email": user.get("google_calendar_email") if has_tokens else None
    }


@router.get("/auth/login")
async def start_google_auth(
    current_user: dict = Depends(get_current_user)
):
    """Start Google OAuth flow for Calendar access"""
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google Calendar n'est pas configuré. Contactez l'administrateur."
        )
    
    # Build authorization URL
    auth_url = "https://accounts.google.com/o/oauth2/auth"
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(SCOPES),
        "access_type": "offline",
        "prompt": "consent",
        "state": current_user["user_id"]  # Pass user_id in state
    }
    
    url = auth_url + "?" + "&".join([f"{k}={v}" for k, v in params.items()])
    
    return {"authorization_url": url}


@router.get("/callback")
async def google_auth_callback(
    code: str = Query(...),
    state: str = Query(...),  # user_id
    db = Depends(get_db)
):
    """Handle Google OAuth callback"""
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=400, detail="Not configured")
    
    # Exchange code for tokens
    token_response = requests.post(
        "https://oauth2.googleapis.com/token",
        data={
            "code": code,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": REDIRECT_URI,
            "grant_type": "authorization_code"
        }
    )
    
    if not token_response.ok:
        return RedirectResponse(f"{FRONTEND_URL}/dashboard/settings?calendar_error=token_failed")
    
    tokens = token_response.json()
    
    # Get user email
    user_info = requests.get(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        headers={"Authorization": f"Bearer {tokens['access_token']}"}
    ).json()
    
    # Save tokens to user
    await db.users.update_one(
        {"id": state},
        {
            "$set": {
                "google_calendar_tokens": tokens,
                "google_calendar_email": user_info.get("email"),
                "google_calendar_connected_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return RedirectResponse(f"{FRONTEND_URL}/dashboard/settings?calendar_connected=true")


@router.post("/disconnect")
async def disconnect_google_calendar(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Disconnect Google Calendar"""
    await db.users.update_one(
        {"id": current_user["user_id"]},
        {
            "$unset": {
                "google_calendar_tokens": "",
                "google_calendar_email": "",
                "google_calendar_connected_at": ""
            }
        }
    )
    
    return {"message": "Google Calendar déconnecté"}


# ============================================
# CALENDAR OPERATIONS
# ============================================

async def get_google_credentials(user_id: str, db):
    """Get and refresh Google credentials for a user"""
    user = await db.users.find_one(
        {"id": user_id},
        {"_id": 0, "google_calendar_tokens": 1}
    )
    
    if not user or not user.get("google_calendar_tokens"):
        return None
    
    tokens = user["google_calendar_tokens"]
    access_token = tokens.get("access_token")
    refresh_token = tokens.get("refresh_token")
    
    # Check if token needs refresh (Google tokens expire after 1 hour)
    # For simplicity, we'll try to use the token and refresh on 401
    
    return access_token, refresh_token


async def refresh_access_token(user_id: str, refresh_token: str, db):
    """Refresh Google access token"""
    response = requests.post(
        "https://oauth2.googleapis.com/token",
        data={
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token"
        }
    )
    
    if response.ok:
        new_tokens = response.json()
        # Update stored tokens
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"google_calendar_tokens.access_token": new_tokens["access_token"]}}
        )
        return new_tokens["access_token"]
    
    return None


@router.get("/events", response_model=List[CalendarEventResponse])
async def list_calendar_events(
    max_results: int = 20,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """List upcoming calendar events"""
    creds = await get_google_credentials(current_user["user_id"], db)
    
    if not creds:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google Calendar non connecté"
        )
    
    access_token, refresh_token = creds
    
    # Get events
    now = datetime.now(timezone.utc).isoformat()
    url = f"https://www.googleapis.com/calendar/v3/calendars/primary/events"
    params = {
        "timeMin": now,
        "maxResults": max_results,
        "singleEvents": "true",
        "orderBy": "startTime"
    }
    
    response = requests.get(
        url,
        headers={"Authorization": f"Bearer {access_token}"},
        params=params
    )
    
    # Handle token refresh
    if response.status_code == 401:
        new_token = await refresh_access_token(current_user["user_id"], refresh_token, db)
        if new_token:
            response = requests.get(
                url,
                headers={"Authorization": f"Bearer {new_token}"},
                params=params
            )
    
    if not response.ok:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur lors de la récupération des événements"
        )
    
    events = response.json().get("items", [])
    
    return [
        CalendarEventResponse(
            id=event["id"],
            title=event.get("summary", "Sans titre"),
            description=event.get("description"),
            start=event.get("start", {}).get("dateTime") or event.get("start", {}).get("date", ""),
            end=event.get("end", {}).get("dateTime") or event.get("end", {}).get("date", ""),
            location=event.get("location"),
            html_link=event.get("htmlLink")
        )
        for event in events
    ]


@router.post("/events", response_model=CalendarEventResponse)
async def create_calendar_event(
    event: CalendarEventCreate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Create a new calendar event"""
    creds = await get_google_credentials(current_user["user_id"], db)
    
    if not creds:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google Calendar non connecté"
        )
    
    access_token, refresh_token = creds
    
    # Build event body
    event_body = {
        "summary": event.title,
        "description": event.description,
        "start": {"dateTime": event.start_time, "timeZone": "Europe/Paris"},
        "end": {"dateTime": event.end_time, "timeZone": "Europe/Paris"},
    }
    
    if event.location:
        event_body["location"] = event.location
    
    # Create event
    response = requests.post(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events",
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        },
        json=event_body
    )
    
    # Handle token refresh
    if response.status_code == 401:
        new_token = await refresh_access_token(current_user["user_id"], refresh_token, db)
        if new_token:
            response = requests.post(
                "https://www.googleapis.com/calendar/v3/calendars/primary/events",
                headers={
                    "Authorization": f"Bearer {new_token}",
                    "Content-Type": "application/json"
                },
                json=event_body
            )
    
    if not response.ok:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de la création de l'événement: {response.text}"
        )
    
    created = response.json()
    
    # If linked to interview, save the Google event ID
    if event.interview_id:
        await db.interviews.update_one(
            {"id": event.interview_id},
            {"$set": {"google_calendar_event_id": created["id"]}}
        )
    
    return CalendarEventResponse(
        id=created["id"],
        title=created.get("summary", ""),
        description=created.get("description"),
        start=created.get("start", {}).get("dateTime", ""),
        end=created.get("end", {}).get("dateTime", ""),
        location=created.get("location"),
        html_link=created.get("htmlLink")
    )


@router.delete("/events/{event_id}")
async def delete_calendar_event(
    event_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Delete a calendar event"""
    creds = await get_google_credentials(current_user["user_id"], db)
    
    if not creds:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google Calendar non connecté"
        )
    
    access_token, refresh_token = creds
    
    response = requests.delete(
        f"https://www.googleapis.com/calendar/v3/calendars/primary/events/{event_id}",
        headers={"Authorization": f"Bearer {access_token}"}
    )
    
    # Handle token refresh
    if response.status_code == 401:
        new_token = await refresh_access_token(current_user["user_id"], refresh_token, db)
        if new_token:
            response = requests.delete(
                f"https://www.googleapis.com/calendar/v3/calendars/primary/events/{event_id}",
                headers={"Authorization": f"Bearer {new_token}"}
            )
    
    if not response.ok and response.status_code != 404:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur lors de la suppression"
        )
    
    return {"message": "Événement supprimé"}


# ============================================
# SYNC INTERVIEWS TO CALENDAR
# ============================================

@router.post("/sync-interview/{interview_id}")
async def sync_interview_to_calendar(
    interview_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Sync a JobTracker interview to Google Calendar"""
    user_id = current_user["user_id"]
    
    # Get interview
    interview = await db.interviews.find_one(
        {"id": interview_id, "user_id": user_id},
        {"_id": 0}
    )
    
    if not interview:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Entretien non trouvé"
        )
    
    # Get application for context
    application = await db.applications.find_one(
        {"id": interview.get("candidature_id")},
        {"_id": 0, "entreprise": 1, "poste": 1}
    )
    
    # Build event
    title = f"Entretien - {application['entreprise'] if application else 'JobTracker'}"
    description = f"""Entretien pour le poste: {application['poste'] if application else 'N/A'}
Type: {interview.get('type_entretien', 'N/A')}
Format: {interview.get('format_entretien', 'N/A')}
Interviewer: {interview.get('interviewer', 'N/A')}
Notes: {interview.get('commentaire', '')}

---
Géré par JobTracker"""

    # Parse interview date
    interview_date = interview.get("date_entretien")
    if isinstance(interview_date, str):
        if "T" in interview_date:
            start_time = interview_date
        else:
            start_time = interview_date + "T09:00:00"
    else:
        start_time = datetime.now(timezone.utc).isoformat()
    
    # End time = start + 1 hour
    try:
        start_dt = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
        end_dt = start_dt + timedelta(hours=1)
        end_time = end_dt.isoformat()
    except:
        end_time = start_time
    
    event_data = CalendarEventCreate(
        title=title,
        description=description,
        start_time=start_time,
        end_time=end_time,
        location=interview.get("lieu_lien"),
        interview_id=interview_id
    )
    
    return await create_calendar_event(event_data, current_user, db)
