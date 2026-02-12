"""
JobTracker SaaS - Routes Suivi Avancé des Candidatures
Timeline, Rappels, Relances et Matching IA
"""

from fastapi import APIRouter, HTTPException, status, Depends, Query
from datetime import datetime, timezone, timedelta
from typing import Optional, List

from models import (
    ApplicationHistoryEvent, FollowupEmailRequest, FollowupEmailResponse,
    MatchingScoreRequest, MatchingScoreResponse, ApplicationStatus
)
from utils.auth import get_current_user

router = APIRouter(prefix="/applications", tags=["Application Tracking"])


def get_db():
    """Dependency injection pour la DB"""
    pass


# ============================================
# TIMELINE / HISTORIQUE
# ============================================

@router.get("/{application_id}/timeline")
async def get_application_timeline(
    application_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Récupère la timeline complète d'une candidature"""
    app = await db.applications.find_one({
        "id": application_id,
        "user_id": current_user["user_id"]
    })
    
    if not app:
        raise HTTPException(status_code=404, detail="Candidature non trouvée")
    
    # Récupérer l'historique existant
    history = app.get("history", [])
    
    # Ajouter les entretiens liés comme événements
    interviews = await db.interviews.find({
        "candidature_id": application_id,
        "user_id": current_user["user_id"]
    }).to_list(length=100)
    
    for interview in interviews:
        # Ajout de l'entretien planifié
        history.append({
            "event_type": "interview_scheduled",
            "timestamp": interview.get("created_at", interview["date_entretien"]),
            "new_value": interview["type_entretien"],
            "details": f"Entretien {interview['type_entretien']} - {interview['format_entretien']}"
        })
        
        # Si l'entretien est passé
        if interview.get("statut") == "completed":
            history.append({
                "event_type": "interview_completed",
                "timestamp": interview["date_entretien"],
                "new_value": "completed",
                "details": f"Entretien {interview['type_entretien']} effectué"
            })
    
    # Trier par date
    history.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    
    # Ajouter l'événement de création
    history.append({
        "event_type": "application_created",
        "timestamp": app.get("created_at", app["date_candidature"]),
        "new_value": "pending",
        "details": f"Candidature envoyée à {app['entreprise']}"
    })
    
    return {
        "application_id": application_id,
        "entreprise": app["entreprise"],
        "poste": app["poste"],
        "current_status": app.get("reponse", "pending"),
        "timeline": sorted(history, key=lambda x: x.get("timestamp", ""), reverse=True)
    }


@router.post("/{application_id}/timeline/event")
async def add_timeline_event(
    application_id: str,
    event: ApplicationHistoryEvent,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Ajoute un événement personnalisé à la timeline"""
    app = await db.applications.find_one({
        "id": application_id,
        "user_id": current_user["user_id"]
    })
    
    if not app:
        raise HTTPException(status_code=404, detail="Candidature non trouvée")
    
    event_dict = event.model_dump()
    event_dict["timestamp"] = datetime.now(timezone.utc).isoformat()
    
    await db.applications.update_one(
        {"id": application_id},
        {"$push": {"history": event_dict}}
    )
    
    return {"message": "Événement ajouté à la timeline"}


# ============================================
# RAPPELS AUTOMATIQUES
# ============================================

@router.get("/reminders/pending")
async def get_pending_reminders(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Récupère les candidatures nécessitant une relance"""
    now = datetime.now(timezone.utc)
    
    # Trouver les candidatures en attente sans réponse après X jours
    applications = await db.applications.find({
        "user_id": current_user["user_id"],
        "reponse": "pending"
    }).to_list(length=500)
    
    pending_reminders = []
    
    for app in applications:
        days_before_reminder = app.get("days_before_reminder", 7)
        date_candidature = app.get("date_candidature")
        
        if isinstance(date_candidature, str):
            date_candidature = datetime.fromisoformat(date_candidature.replace("Z", "+00:00"))
        
        days_since_application = (now - date_candidature).days
        last_reminder = app.get("last_reminder_sent")
        
        if last_reminder:
            if isinstance(last_reminder, str):
                last_reminder = datetime.fromisoformat(last_reminder.replace("Z", "+00:00"))
            days_since_reminder = (now - last_reminder).days
        else:
            days_since_reminder = days_since_application
        
        # Vérifier si une relance est recommandée
        if days_since_application >= days_before_reminder and days_since_reminder >= days_before_reminder:
            pending_reminders.append({
                "id": app["id"],
                "entreprise": app["entreprise"],
                "poste": app["poste"],
                "date_candidature": app["date_candidature"],
                "days_since_application": days_since_application,
                "days_since_last_reminder": days_since_reminder,
                "followup_count": app.get("followup_count", 0),
                "contact_email": app.get("contact_email"),
                "contact_name": app.get("contact_name")
            })
    
    # Trier par ancienneté
    pending_reminders.sort(key=lambda x: x["days_since_application"], reverse=True)
    
    return {
        "count": len(pending_reminders),
        "applications": pending_reminders
    }


@router.post("/{application_id}/reminder/mark-sent")
async def mark_reminder_sent(
    application_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Marque un rappel comme envoyé"""
    result = await db.applications.update_one(
        {"id": application_id, "user_id": current_user["user_id"]},
        {
            "$set": {"last_reminder_sent": datetime.now(timezone.utc).isoformat()},
            "$inc": {"followup_count": 1},
            "$push": {
                "history": {
                    "event_type": "reminder_sent",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "details": "Rappel de relance envoyé"
                }
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Candidature non trouvée")
    
    return {"message": "Rappel marqué comme envoyé"}


# ============================================
# GÉNÉRATION EMAIL DE RELANCE
# ============================================

@router.post("/{application_id}/followup/generate", response_model=FollowupEmailResponse)
async def generate_followup_email(
    application_id: str,
    request: FollowupEmailRequest,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Génère un email de relance personnalisé avec l'IA"""
    app = await db.applications.find_one({
        "id": application_id,
        "user_id": current_user["user_id"]
    })
    
    if not app:
        raise HTTPException(status_code=404, detail="Candidature non trouvée")
    
    # Récupérer les infos utilisateur
    user = await db.users.find_one({"id": current_user["user_id"]})
    user_name = user.get("full_name", "Candidat")
    
    # Calculer le nombre de jours depuis la candidature
    date_candidature = app.get("date_candidature")
    if isinstance(date_candidature, str):
        date_candidature = datetime.fromisoformat(date_candidature.replace("Z", "+00:00"))
    days_since = (datetime.now(timezone.utc) - date_candidature).days
    
    followup_count = app.get("followup_count", 0)
    
    # Construire le prompt pour l'IA
    tone_instructions = {
        "professional": "Ton professionnel mais engageant, montrant de l'intérêt sans être insistant",
        "friendly": "Ton amical et décontracté tout en restant professionnel",
        "formal": "Ton très formel et respectueux, style lettre de motivation"
    }
    
    prompt = f"""Génère un email de relance pour une candidature avec les informations suivantes:

- Entreprise: {app['entreprise']}
- Poste: {app['poste']}
- Candidat: {user_name}
- Jours depuis la candidature: {days_since}
- Nombre de relances précédentes: {followup_count}
- Ton souhaité: {tone_instructions.get(request.tone, tone_instructions['professional'])}
- Langue: {'Français' if request.language == 'fr' else 'English'}

Instructions:
1. L'email doit être court et impactant (max 150 mots)
2. Rappeler brièvement la candidature
3. Exprimer un intérêt sincère pour le poste
4. Proposer une disponibilité pour échanger
5. Ne pas être trop insistant{'(c est une ' + str(followup_count + 1) + 'ème relance)' if followup_count > 0 else ''}

Réponds UNIQUEMENT avec un JSON au format:
{{"subject": "Objet de l'email", "body": "Corps de l'email"}}
"""

    # Appeler l'IA
    try:
        # Try emergentintegrations first
        try:
            from emergentintegrations.llm import chat, LlmModel
            response = await chat(
                model=LlmModel.GEMINI_2_FLASH,
                system_message="Tu es un expert en communication professionnelle et en recherche d'emploi.",
                user_message=prompt
            )
            response_text = response.message if hasattr(response, 'message') else str(response)
        except ImportError:
            # Fallback to standard Google AI SDK
            import google.genai as genai
            import os
            
            api_key = os.environ.get("GOOGLE_AI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
            if not api_key:
                # Fallback to template
                raise Exception("No API key available")
            
            client = genai.Client(api_key=api_key)
            response = client.models.generate_content(
                model="gemini-2.0-flash",
                contents=prompt
            )
            response_text = response.text
        
        # Parser la réponse JSON
        import json
        # Nettoyer la réponse
        response_text = response_text.strip()
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
        
        email_data = json.loads(response_text.strip())
        
        return FollowupEmailResponse(
            subject=email_data.get("subject", f"Relance - Candidature {app['poste']}"),
            body=email_data.get("body", ""),
            recipient_email=app.get("contact_email"),
            recipient_name=app.get("contact_name")
        )
        
    except Exception as e:
        # Fallback: Générer un template basique
        if request.language == "fr":
            subject = f"Relance - Candidature au poste de {app['poste']}"
            body = f"""Bonjour{' ' + app.get('contact_name', '') if app.get('contact_name') else ''},

Je me permets de vous recontacter concernant ma candidature au poste de {app['poste']} chez {app['entreprise']}, envoyée il y a {days_since} jours.

Je reste très intéressé(e) par cette opportunité et serais ravi(e) d'échanger avec vous sur ma candidature.

Je me tiens à votre disposition pour un entretien à votre convenance.

Cordialement,
{user_name}"""
        else:
            subject = f"Follow-up - {app['poste']} Application"
            body = f"""Hello{' ' + app.get('contact_name', '') if app.get('contact_name') else ''},

I am following up on my application for the {app['poste']} position at {app['entreprise']}, submitted {days_since} days ago.

I remain very interested in this opportunity and would be happy to discuss my application with you.

I am available for an interview at your convenience.

Best regards,
{user_name}"""

        return FollowupEmailResponse(
            subject=subject,
            body=body,
            recipient_email=app.get("contact_email"),
            recipient_name=app.get("contact_name")
        )


# ============================================
# SCORE DE MATCHING IA
# ============================================

@router.post("/{application_id}/matching/calculate", response_model=MatchingScoreResponse)
async def calculate_matching_score(
    application_id: str,
    cv_text: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Calcule le score de matching entre le CV et l'offre d'emploi"""
    app = await db.applications.find_one({
        "id": application_id,
        "user_id": current_user["user_id"]
    })
    
    if not app:
        raise HTTPException(status_code=404, detail="Candidature non trouvée")
    
    job_description = app.get("description_poste")
    if not job_description:
        raise HTTPException(
            status_code=400, 
            detail="Veuillez d'abord ajouter une description de poste à cette candidature"
        )
    
    # Utiliser le CV fourni ou récupérer le dernier CV analysé
    if not cv_text:
        # Chercher le dernier CV analysé pour cet utilisateur
        cv_analysis = await db.cv_analyses.find_one(
            {"user_id": current_user["user_id"]},
            sort=[("created_at", -1)]
        )
        if cv_analysis:
            cv_text = cv_analysis.get("extracted_text", "")
    
    if not cv_text:
        raise HTTPException(
            status_code=400,
            detail="Veuillez fournir le texte de votre CV ou analyser un CV d'abord"
        )
    
    # Construire le prompt pour l'analyse de matching
    prompt = f"""Analyse la compatibilité entre ce CV et cette offre d'emploi.

=== OFFRE D'EMPLOI ===
Entreprise: {app['entreprise']}
Poste: {app['poste']}
Type: {app.get('type_poste', 'Non spécifié')}
Lieu: {app.get('lieu', 'Non spécifié')}

Description du poste:
{job_description}

=== CV DU CANDIDAT ===
{cv_text[:3000]}

=== INSTRUCTIONS ===
Analyse en détail et réponds avec un JSON au format:
{{
    "score": <score de 0 à 100>,
    "summary": "<résumé en 2-3 phrases de la compatibilité>",
    "strengths": ["<point fort 1>", "<point fort 2>", ...],
    "gaps": ["<lacune 1>", "<lacune 2>", ...],
    "recommendations": ["<conseil 1>", "<conseil 2>", ...],
    "keywords_matched": ["<mot-clé trouvé 1>", ...],
    "keywords_missing": ["<mot-clé manquant 1>", ...]
}}

Score guide:
- 80-100: Excellent match, candidat très qualifié
- 60-79: Bon match, quelques ajustements possibles
- 40-59: Match moyen, formation ou expérience complémentaire conseillée
- 0-39: Faible match, profil différent du poste
"""

    try:
        # Try emergentintegrations first
        try:
            from emergentintegrations.llm import chat, LlmModel
            response = await chat(
                model=LlmModel.GEMINI_2_FLASH,
                system_message="Tu es un expert en recrutement et en analyse de CV.",
                user_message=prompt
            )
            response_text = response.message if hasattr(response, 'message') else str(response)
        except ImportError:
            # Fallback to standard Google AI SDK
            import google.genai as genai
            import os
            
            api_key = os.environ.get("GOOGLE_AI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
            if not api_key:
                raise Exception("No API key available")
            
            client = genai.Client(api_key=api_key)
            response = client.models.generate_content(
                model="gemini-2.0-flash",
                contents=prompt
            )
            response_text = response.text
        
        # Parser la réponse JSON
        import json
        response_text = response_text.strip()
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
        
        match_data = json.loads(response_text.strip())
        
        # Sauvegarder le score dans la candidature
        await db.applications.update_one(
            {"id": application_id},
            {
                "$set": {
                    "match_score": match_data.get("score", 0),
                    "match_details": match_data,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                },
                "$push": {
                    "history": {
                        "event_type": "matching_calculated",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "new_value": str(match_data.get("score", 0)),
                        "details": f"Score de matching calculé: {match_data.get('score', 0)}%"
                    }
                }
            }
        )
        
        return MatchingScoreResponse(
            score=match_data.get("score", 0),
            summary=match_data.get("summary", ""),
            strengths=match_data.get("strengths", []),
            gaps=match_data.get("gaps", []),
            recommendations=match_data.get("recommendations", []),
            keywords_matched=match_data.get("keywords_matched", []),
            keywords_missing=match_data.get("keywords_missing", [])
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erreur lors du calcul du matching: {str(e)}"
        )


@router.get("/{application_id}/matching")
async def get_matching_score(
    application_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Récupère le score de matching existant"""
    app = await db.applications.find_one({
        "id": application_id,
        "user_id": current_user["user_id"]
    })
    
    if not app:
        raise HTTPException(status_code=404, detail="Candidature non trouvée")
    
    match_score = app.get("match_score")
    match_details = app.get("match_details")
    
    if match_score is None:
        return {
            "has_score": False,
            "message": "Aucun score de matching calculé pour cette candidature"
        }
    
    return {
        "has_score": True,
        "score": match_score,
        "details": match_details
    }
