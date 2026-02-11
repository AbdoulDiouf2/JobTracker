"""
JobTracker SaaS - Routes IA (Google Gemini & OpenAI)
"""

from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import os
import uuid

from emergentintegrations.llm.chat import LlmChat, UserMessage
from utils.auth import get_current_user

router = APIRouter(prefix="/ai", tags=["AI"])


def get_db():
    """Dependency injection pour la DB"""
    pass


# Request/Response Models
class ChatMessage(BaseModel):
    role: str  # 'user' or 'assistant'
    content: str
    timestamp: Optional[str] = None


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None


class ChatResponse(BaseModel):
    response: str
    session_id: str


class CareerAdviceRequest(BaseModel):
    question: str
    include_applications: bool = True


class CareerAdviceResponse(BaseModel):
    advice: str
    session_id: str


# Helper to get user's application context
async def get_user_context(user_id: str, db) -> str:
    """Build context from user's applications and interviews"""
    # Get applications
    applications = await db.applications.find(
        {"user_id": user_id},
        {"_id": 0, "entreprise": 1, "poste": 1, "type_poste": 1, "lieu": 1, "reponse": 1, "date_candidature": 1}
    ).sort("date_candidature", -1).limit(20).to_list(20)
    
    # Get interviews
    interviews = await db.interviews.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("date_entretien", -1).limit(10).to_list(10)
    
    # Get stats
    total = await db.applications.count_documents({"user_id": user_id})
    pending = await db.applications.count_documents({"user_id": user_id, "reponse": "pending"})
    positive = await db.applications.count_documents({"user_id": user_id, "reponse": "positive"})
    negative = await db.applications.count_documents({"user_id": user_id, "reponse": "negative"})
    
    context = f"""
Contexte du candidat:
- Total candidatures: {total}
- En attente: {pending}
- Réponses positives: {positive}
- Réponses négatives: {negative}
- Taux de réponse: {((positive + negative) / total * 100):.1f}% si {total} > 0 else 0

Dernières candidatures:
"""
    for app in applications[:10]:
        status_label = {
            'pending': 'En attente',
            'positive': 'Positive',
            'negative': 'Négative',
            'no_response': 'Pas de réponse'
        }.get(app.get('reponse', 'pending'), app.get('reponse'))
        context += f"- {app['entreprise']} - {app['poste']} ({app.get('type_poste', 'CDI')}) - {status_label}\n"
    
    if interviews:
        context += "\nEntretiens récents:\n"
        for interview in interviews[:5]:
            context += f"- Entretien {interview.get('type_entretien', '')} - {interview.get('statut', '')}\n"
    
    return context


# Career Advisor (Gemini)
@router.post("/career-advisor", response_model=CareerAdviceResponse)
async def get_career_advice(
    request: CareerAdviceRequest,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get career advice from AI advisor (powered by Gemini)"""
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AI service not configured"
        )
    
    user_id = current_user["user_id"]
    session_id = f"career-{user_id}"
    
    # Build context
    context = ""
    if request.include_applications:
        context = await get_user_context(user_id, db)
    
    system_message = f"""Tu es un conseiller carrière IA expert et bienveillant. Tu aides les candidats dans leur recherche d'emploi.

{context}

Tes responsabilités:
1. Analyser les candidatures et identifier les tendances
2. Donner des conseils personnalisés pour améliorer le taux de réponse
3. Suggérer des stratégies de recherche d'emploi
4. Aider à préparer les entretiens
5. Motiver et encourager le candidat

Réponds toujours en français de manière professionnelle mais accessible.
Sois concis et actionnable dans tes conseils."""

    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=session_id,
            system_message=system_message
        ).with_model("gemini", "gemini-2.5-flash")
        
        user_message = UserMessage(text=request.question)
        response = await chat.send_message(user_message)
        
        # Save to chat history
        await db.chat_history.insert_one({
            "user_id": user_id,
            "session_id": session_id,
            "type": "career_advisor",
            "messages": [
                {"role": "user", "content": request.question, "timestamp": datetime.now(timezone.utc).isoformat()},
                {"role": "assistant", "content": response, "timestamp": datetime.now(timezone.utc).isoformat()}
            ],
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        return CareerAdviceResponse(advice=response, session_id=session_id)
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI service error: {str(e)}"
        )


# Chatbot Assistant (OpenAI)
@router.post("/chatbot", response_model=ChatResponse)
async def chat_with_assistant(
    request: ChatRequest,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Chat with AI assistant (powered by OpenAI GPT)"""
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AI service not configured"
        )
    
    user_id = current_user["user_id"]
    session_id = request.session_id or f"chat-{user_id}-{uuid.uuid4().hex[:8]}"
    
    system_message = """Tu es un assistant IA spécialisé dans la recherche d'emploi. Tu aides les utilisateurs avec:

1. Rédaction de CV et lettres de motivation
2. Préparation aux entretiens d'embauche
3. Conseils sur les négociations salariales
4. Informations sur les entreprises et secteurs
5. Gestion du stress lié à la recherche d'emploi

Réponds toujours en français de manière claire et utile.
Si tu ne sais pas quelque chose, dis-le honnêtement."""

    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=session_id,
            system_message=system_message
        ).with_model("openai", "gpt-4o")
        
        user_message = UserMessage(text=request.message)
        response = await chat.send_message(user_message)
        
        # Save to chat history
        await db.chat_history.update_one(
            {"session_id": session_id, "user_id": user_id},
            {
                "$push": {
                    "messages": {
                        "$each": [
                            {"role": "user", "content": request.message, "timestamp": datetime.now(timezone.utc).isoformat()},
                            {"role": "assistant", "content": response, "timestamp": datetime.now(timezone.utc).isoformat()}
                        ]
                    }
                },
                "$set": {"updated_at": datetime.now(timezone.utc).isoformat()},
                "$setOnInsert": {
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "type": "chatbot"
                }
            },
            upsert=True
        )
        
        return ChatResponse(response=response, session_id=session_id)
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI service error: {str(e)}"
        )


# Get chat history
@router.get("/chat-history/{session_id}")
async def get_chat_history(
    session_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get chat history for a session"""
    history = await db.chat_history.find_one(
        {"session_id": session_id, "user_id": current_user["user_id"]},
        {"_id": 0}
    )
    
    if not history:
        return {"messages": [], "session_id": session_id}
    
    return history


# List user's chat sessions
@router.get("/chat-sessions")
async def list_chat_sessions(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """List all chat sessions for user"""
    sessions = await db.chat_history.find(
        {"user_id": current_user["user_id"]},
        {"_id": 0, "session_id": 1, "type": 1, "created_at": 1, "updated_at": 1}
    ).sort("updated_at", -1).to_list(50)
    
    return sessions


# Delete chat session
@router.delete("/chat-session/{session_id}")
async def delete_chat_session(
    session_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Delete a chat session"""
    result = await db.chat_history.delete_one(
        {"session_id": session_id, "user_id": current_user["user_id"]}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    return {"message": "Session deleted"}
