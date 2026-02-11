"""
JobTracker SaaS - Routes IA (Google Gemini & OpenAI)
Supporte deux modes:
- Mode Emergent: utilise emergentintegrations (plateforme Emergent)
- Mode Local: utilise les SDKs standards (openai, google-generativeai)
"""

from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from dotenv import load_dotenv
import os
import uuid

load_dotenv()

# Try to import emergentintegrations, fallback to standard SDKs
USE_EMERGENT = False
try:
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    USE_EMERGENT = True
    print("✅ Using Emergent integrations for AI")
except ImportError:
    print("⚠️ emergentintegrations not available, using standard SDKs")
    try:
        from google import genai
        from openai import OpenAI
        print("✅ Standard SDKs loaded (openai, google-genai)")
    except ImportError as e:
        print(f"⚠️ AI SDKs not fully available: {e}")

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
    
    response_rate = ((positive + negative) / total * 100) if total > 0 else 0
    
    context = f"""
Contexte du candidat:
- Total candidatures: {total}
- En attente: {pending}
- Réponses positives: {positive}
- Réponses négatives: {negative}
- Taux de réponse: {response_rate:.1f}%

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


# ============== AI Functions (Dual Mode) ==============

async def call_gemini_emergent(api_key: str, session_id: str, system_message: str, user_question: str) -> str:
    """Call Gemini using Emergent integrations"""
    chat = LlmChat(
        api_key=api_key,
        session_id=session_id,
        system_message=system_message
    ).with_model("gemini", "gemini-2.5-flash")
    
    user_message = UserMessage(text=user_question)
    response = await chat.send_message(user_message)
    return response


async def call_gemini_standard(api_key: str, system_message: str, user_question: str) -> str:
    """Call Gemini using standard Google SDK (google-genai)"""
    client = genai.Client(api_key=api_key)
    
    # Combine system message and user question for Gemini
    full_prompt = f"{system_message}\n\n---\n\nQuestion de l'utilisateur:\n{user_question}"
    
    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=full_prompt
    )
    return response.text


async def call_openai_emergent(api_key: str, session_id: str, system_message: str, user_message_text: str) -> str:
    """Call OpenAI using Emergent integrations"""
    chat = LlmChat(
        api_key=api_key,
        session_id=session_id,
        system_message=system_message
    ).with_model("openai", "gpt-4o")
    
    user_message = UserMessage(text=user_message_text)
    response = await chat.send_message(user_message)
    return response


async def call_openai_standard(api_key: str, system_message: str, user_message_text: str) -> str:
    """Call OpenAI using standard SDK"""
    client = OpenAI(api_key=api_key)
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": system_message},
            {"role": "user", "content": user_message_text}
        ]
    )
    return response.choices[0].message.content


# Career Advisor (Gemini)
@router.post("/career-advisor", response_model=CareerAdviceResponse)
async def get_career_advice(
    request: CareerAdviceRequest,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get career advice from AI advisor (powered by Gemini)"""
    # Get API key based on mode
    if USE_EMERGENT:
        api_key = os.environ.get("EMERGENT_LLM_KEY")
    else:
        api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
    
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AI service not configured. Set GOOGLE_API_KEY or GEMINI_API_KEY in .env"
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
        if USE_EMERGENT:
            response = await call_gemini_emergent(api_key, session_id, system_message, request.question)
        else:
            response = await call_gemini_standard(api_key, system_message, request.question)
        
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
    # Get API key based on mode
    if USE_EMERGENT:
        api_key = os.environ.get("EMERGENT_LLM_KEY")
    else:
        api_key = os.environ.get("OPENAI_API_KEY")
    
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AI service not configured. Set OPENAI_API_KEY in .env"
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
        if USE_EMERGENT:
            response = await call_openai_emergent(api_key, session_id, system_message, request.message)
        else:
            response = await call_openai_standard(api_key, system_message, request.message)
        
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
