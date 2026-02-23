"""
JobTracker SaaS - Routes IA (Google Gemini, OpenAI & Groq)
Supporte trois fournisseurs d'IA avec sélection dynamique du modèle.
"""

from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from dotenv import load_dotenv
import os
import uuid
import json
import re

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

# Try to import Groq
try:
    from groq import Groq
    GROQ_AVAILABLE = True
    print("✅ Groq SDK loaded")
except ImportError:
    GROQ_AVAILABLE = False
    print("⚠️ Groq SDK not available")

from utils.auth import get_current_user

router = APIRouter(prefix="/ai", tags=["AI"])


def get_db():
    """Dependency injection pour la DB"""
    pass


# ============== AI Model Definitions ==============

AI_MODELS = {
    "openai": [
        {"model_id": "gpt-4o", "display_name": "GPT-4o", "description": "Modèle le plus puissant d'OpenAI"},
        {"model_id": "gpt-4o-mini", "display_name": "GPT-4o Mini", "description": "Version rapide et économique"},
        {"model_id": "gpt-4-turbo", "display_name": "GPT-4 Turbo", "description": "GPT-4 optimisé pour la vitesse"},
    ],
    "google": [
        {"model_id": "gemini-1.5-flash", "display_name": "Gemini 2.0 Flash", "description": "Modèle rapide de Google"},
        {"model_id": "gemini-1.5-pro", "display_name": "Gemini 1.5 Pro", "description": "Modèle avancé avec grand contexte"},
        {"model_id": "gemini-1.5-flash", "display_name": "Gemini 1.5 Flash", "description": "Version optimisée"},
    ],
    "groq": [
        {"model_id": "llama-3.3-70b-versatile", "display_name": "Llama 3.3 70B", "description": "Modèle Llama puissant sur Groq"},
        {"model_id": "llama-3.1-8b-instant", "display_name": "Llama 3.1 8B", "description": "Modèle rapide et léger"},
        {"model_id": "mixtral-8x7b-32768", "display_name": "Mixtral 8x7B", "description": "Modèle Mixtral de Mistral AI"},
        {"model_id": "gemma2-9b-it", "display_name": "Gemma 2 9B", "description": "Modèle Google Gemma sur Groq"},
    ]
}


# Request/Response Models
class ChatMessage(BaseModel):
    role: str  # 'user' or 'assistant'
    content: str
    timestamp: Optional[str] = None


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    model_provider: Optional[str] = None  # 'openai', 'google', 'groq'
    model_name: Optional[str] = None


class ChatResponse(BaseModel):
    response: str
    session_id: str
    model_used: Optional[str] = None


class CareerAdviceRequest(BaseModel):
    question: str
    include_applications: bool = True
    model_provider: Optional[str] = None
    model_name: Optional[str] = None


class CareerAdviceResponse(BaseModel):
    advice: str
    session_id: str
    model_used: Optional[str] = None


class JobExtractionRequest(BaseModel):
    page_content: str
    page_url: str
    model_provider: Optional[str] = None
    model_name: Optional[str] = None


class JobExtractionResponse(BaseModel):
    entreprise: Optional[str] = None
    poste: Optional[str] = None
    type_poste: Optional[str] = None
    lieu: Optional[str] = None
    salaire_min: Optional[int] = None
    salaire_max: Optional[int] = None
    description_poste: Optional[str] = None
    competences: List[str] = []
    experience_requise: Optional[str] = None
    date_publication: Optional[str] = None
    contact_email: Optional[str] = None
    contact_name: Optional[str] = None
    moyen: Optional[str] = None
    lien: Optional[str] = None
    confidence_score: float = 0.0


class AvailableModelsResponse(BaseModel):
    models: List[dict] = []
    default_model: Optional[dict] = None


# ============== Helper Functions ==============

async def get_user_api_keys(user_id: str, db) -> dict:
    """Get user's configured API keys"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "google_ai_key": 1, "openai_key": 1, "groq_key": 1})
    if not user:
        return {}
    return {
        "google": user.get("google_ai_key"),
        "openai": user.get("openai_key"),
        "groq": user.get("groq_key")
    }


async def get_user_context(user_id: str, db) -> str:
    """Build context from user's applications and interviews"""
    applications = await db.applications.find(
        {"user_id": user_id},
        {"_id": 0, "entreprise": 1, "poste": 1, "type_poste": 1, "lieu": 1, "reponse": 1, "date_candidature": 1}
    ).sort("date_candidature", -1).limit(20).to_list(20)
    
    interviews = await db.interviews.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("date_entretien", -1).limit(10).to_list(10)
    
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


def select_api_key(user_keys: dict, provider: Optional[str] = None) -> tuple:
    """Select the best available API key and provider"""
    # Priority: user-specified provider > user's keys > environment keys
    
    env_keys = {
        "openai": os.environ.get("OPENAI_API_KEY") or os.environ.get("EMERGENT_LLM_KEY"),
        "google": os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY") or os.environ.get("EMERGENT_LLM_KEY"),
        "groq": os.environ.get("GROQ_API_KEY")
    }
    
    if provider and provider in user_keys:
        key = user_keys.get(provider) or env_keys.get(provider)
        if key:
            return key, provider
    
    # Try user's keys first
    for p in ["openai", "google", "groq"]:
        if user_keys.get(p):
            return user_keys[p], p
    
    # Fallback to environment keys
    for p in ["openai", "google", "groq"]:
        if env_keys.get(p):
            return env_keys[p], p
    
    return None, None


# ============== AI Call Functions ==============

async def call_openai(api_key: str, model: str, system_message: str, user_message: str) -> str:
    """Call OpenAI API"""
    if USE_EMERGENT:
        chat = LlmChat(
            api_key=api_key,
            session_id=str(uuid.uuid4()),
            system_message=system_message
        ).with_model("openai", model)
        response = await chat.send_message(UserMessage(text=user_message))
        return response
    else:
        client = OpenAI(api_key=api_key)
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message}
            ]
        )
        return response.choices[0].message.content


async def call_google(api_key: str, model: str, system_message: str, user_message: str) -> str:
    """Call Google Gemini API"""
    if USE_EMERGENT:
        chat = LlmChat(
            api_key=api_key,
            session_id=str(uuid.uuid4()),
            system_message=system_message
        ).with_model("gemini", model)
        response = await chat.send_message(UserMessage(text=user_message))
        return response
    else:
        client = genai.Client(api_key=api_key)
        full_prompt = f"{system_message}\n\n---\n\nQuestion:\n{user_message}"
        response = client.models.generate_content(model=model, contents=full_prompt)
        return response.text


async def call_groq(api_key: str, model: str, system_message: str, user_message: str) -> str:
    """Call Groq API"""
    if not GROQ_AVAILABLE:
        raise HTTPException(status_code=500, detail="Groq SDK not installed")
    
    client = Groq(api_key=api_key)
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_message},
            {"role": "user", "content": user_message}
        ]
    )
    return response.choices[0].message.content


async def call_ai(api_key: str, provider: str, model: str, system_message: str, user_message: str) -> str:
    """Universal AI call function"""
    if provider == "openai":
        return await call_openai(api_key, model, system_message, user_message)
    elif provider == "google":
        return await call_google(api_key, model, system_message, user_message)
    elif provider == "groq":
        return await call_groq(api_key, model, system_message, user_message)
    else:
        raise HTTPException(status_code=400, detail=f"Unknown provider: {provider}")


# ============== API Endpoints ==============

@router.get("/available-models", response_model=AvailableModelsResponse)
async def get_available_models(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get available AI models based on user's configured API keys"""
    user_keys = await get_user_api_keys(current_user["user_id"], db)
    
    env_keys = {
        "openai": bool(os.environ.get("OPENAI_API_KEY") or os.environ.get("EMERGENT_LLM_KEY")),
        "google": bool(os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY") or os.environ.get("EMERGENT_LLM_KEY")),
        "groq": bool(os.environ.get("GROQ_API_KEY"))
    }
    
    available_models = []
    default_model = None
    
    for provider, models in AI_MODELS.items():
        has_user_key = bool(user_keys.get(provider))
        has_env_key = env_keys.get(provider, False)
        is_available = has_user_key or has_env_key
        
        # Groq requires SDK
        if provider == "groq" and not GROQ_AVAILABLE:
            is_available = False
        
        # Determine key source
        key_source = None
        if has_user_key:
            key_source = "user"
        elif has_env_key:
            key_source = "platform"
        
        for model in models:
            model_info = {
                "provider": provider,
                "model_id": model["model_id"],
                "display_name": model["display_name"],
                "description": model["description"],
                "is_available": is_available,
                "key_source": key_source  # 'user', 'platform', or None
            }
            available_models.append(model_info)
            
            # Set first available as default
            if is_available and not default_model:
                default_model = model_info
    
    return AvailableModelsResponse(models=available_models, default_model=default_model)


@router.post("/career-advisor", response_model=CareerAdviceResponse)
async def get_career_advice(
    request: CareerAdviceRequest,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get career advice from AI advisor"""
    user_id = current_user["user_id"]
    user_keys = await get_user_api_keys(user_id, db)
    
    api_key, provider = select_api_key(user_keys, request.model_provider)
    
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Aucune clé API configurée. Configurez une clé OpenAI, Google ou Groq dans les paramètres."
        )
    
    # Select model
    model = request.model_name
    if not model:
        model = AI_MODELS[provider][0]["model_id"]
    
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
        response = await call_ai(api_key, provider, model, system_message, request.question)
        
        # Save to chat history
        await db.chat_history.insert_one({
            "user_id": user_id,
            "session_id": session_id,
            "type": "career_advisor",
            "model_used": f"{provider}/{model}",
            "messages": [
                {"role": "user", "content": request.question, "timestamp": datetime.now(timezone.utc).isoformat()},
                {"role": "assistant", "content": response, "timestamp": datetime.now(timezone.utc).isoformat()}
            ],
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        return CareerAdviceResponse(advice=response, session_id=session_id, model_used=f"{provider}/{model}")
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur du service IA: {str(e)}"
        )


@router.post("/chatbot", response_model=ChatResponse)
async def chat_with_assistant(
    request: ChatRequest,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Chat with AI assistant with model selection"""
    user_id = current_user["user_id"]
    user_keys = await get_user_api_keys(user_id, db)
    
    api_key, provider = select_api_key(user_keys, request.model_provider)
    
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Aucune clé API configurée. Configurez une clé OpenAI, Google ou Groq dans les paramètres."
        )
    
    # Select model
    model = request.model_name
    if not model:
        model = AI_MODELS[provider][0]["model_id"]
    
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
        response = await call_ai(api_key, provider, model, system_message, request.message)
        
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
                "$set": {
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                    "model_used": f"{provider}/{model}"
                },
                "$setOnInsert": {
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "type": "chatbot"
                }
            },
            upsert=True
        )
        
        return ChatResponse(response=response, session_id=session_id, model_used=f"{provider}/{model}")
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur du service IA: {str(e)}"
        )


@router.post("/extract-job", response_model=JobExtractionResponse)
async def extract_job_from_page(
    request: JobExtractionRequest,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Extract job information from page content using AI (for Chrome extension)"""
    user_id = current_user["user_id"]
    user_keys = await get_user_api_keys(user_id, db)
    
    api_key, provider = select_api_key(user_keys, request.model_provider)
    
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Aucune clé API configurée. Configurez une clé dans les paramètres."
        )
    
    # Select model (prefer fast models for extraction)
    model = request.model_name
    if not model:
        if provider == "openai":
            model = "gpt-4o-mini"
        elif provider == "google":
            model = "gemini-1.5-flash"
        elif provider == "groq":
            model = "llama-3.1-8b-instant"
        else:
            model = AI_MODELS[provider][0]["model_id"]
    
    # Detect platform from URL
    url = request.page_url.lower()
    moyen = "other"
    if "linkedin" in url:
        moyen = "linkedin"
    elif "indeed" in url:
        moyen = "indeed"
    elif "welcometothejungle" in url:
        moyen = "welcome_to_jungle"
    elif "apec" in url:
        moyen = "apec"
    elif "pole-emploi" in url or "francetravail" in url:
        moyen = "pole_emploi"
    
    # Truncate content to avoid token limits
    page_content = request.page_content[:15000] if len(request.page_content) > 15000 else request.page_content
    
    system_message = """Tu es un extracteur d'informations d'offres d'emploi. 
Analyse le contenu de la page web et extrais les informations de l'offre d'emploi.

Tu dois retourner un JSON valide avec les champs suivants:
{
    "entreprise": "Nom de l'entreprise",
    "poste": "Titre du poste",
    "type_poste": "cdi|cdd|stage|alternance|freelance|interim",
    "lieu": "Ville, Pays ou Remote",
    "salaire_min": null ou nombre (salaire annuel brut minimum),
    "salaire_max": null ou nombre (salaire annuel brut maximum),
    "description_poste": "Description courte du poste (max 500 caractères)",
    "competences": ["compétence1", "compétence2", ...],
    "experience_requise": "0-2 ans|2-5 ans|5+ ans|junior|senior|etc",
    "date_publication": "date si disponible",
    "contact_email": "email du recruteur si disponible",
    "contact_name": "nom du recruteur si disponible",
    "confidence_score": 0.0 à 1.0 (confiance dans l'extraction)
}

IMPORTANT:
- Retourne UNIQUEMENT le JSON objet (pas de texte avant ou après, pas de markdown ```json)
- Si une information n'est pas disponible, utilise null
- Pour type_poste, utilise uniquement: cdi, cdd, stage, alternance, freelance, interim
- Pour les salaires, convertis en annuel brut si possible
- confidence_score: 1.0 si toutes les infos clés sont trouvées, moins si incertain"
"""

    user_message = f"""URL de l'offre: {request.page_url}

Contenu de la page:
{page_content}

Extrais les informations de cette offre d'emploi."""

    try:
        response = await call_ai(api_key, provider, model, system_message, user_message)
        print(f"DEBUG: Raw AI Response: {response}")
        
        # Parse JSON response
        # Clean response (remove markdown code blocks if present)
        cleaned = response.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r'^```(?:json)?\n?', '', cleaned)
            cleaned = re.sub(r'\n?```$', '', cleaned)
        
        try:
            data = json.loads(cleaned)
        except json.JSONDecodeError:
            # Try to extract JSON from response
            json_match = re.search(r'\{[\s\S]*\}', cleaned)
            if json_match:
                data = json.loads(json_match.group())
            else:
                data = {}
        
        return JobExtractionResponse(
            entreprise=data.get("entreprise"),
            poste=data.get("poste"),
            type_poste=data.get("type_poste"),
            lieu=data.get("lieu"),
            salaire_min=data.get("salaire_min"),
            salaire_max=data.get("salaire_max"),
            description_poste=data.get("description_poste"),
            competences=data.get("competences") or [],
            experience_requise=data.get("experience_requise"),
            date_publication=data.get("date_publication"),
            contact_email=data.get("contact_email"),
            contact_name=data.get("contact_name"),
            moyen=moyen,
            lien=request.page_url,
            confidence_score=data.get("confidence_score", 0.5)
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur d'extraction IA: {str(e)}"
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
        {"_id": 0, "session_id": 1, "type": 1, "created_at": 1, "updated_at": 1, "model_used": 1}
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
