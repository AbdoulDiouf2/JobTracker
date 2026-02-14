"""
JobTracker SaaS - Routes Gestion des Documents
Gestion des CV, lettres de motivation, portfolios et liens.
"""

from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File, Form
from fastapi.responses import FileResponse
from typing import Optional, List
from datetime import datetime, timezone
import os
import uuid
import shutil
from pathlib import Path

from models import (
    DocumentType, DocumentCreate, DocumentUpdate, DocumentResponse,
    CoverLetterTemplateCreate, CoverLetterTemplate,
    GeneratedCoverLetter, ApplicationDocumentLink
)
from utils.auth import get_current_user

router = APIRouter(prefix="/documents", tags=["Documents"])


def get_db():
    """Dependency injection pour la DB"""
    pass


# Configuration
# Configuration
# Vercel filesystem is read-only except for /tmp
import sys
if os.environ.get("VERCEL") or "vercel" in sys.modules:
    UPLOAD_DIR = Path("/tmp/uploads/documents")
else:
    UPLOAD_DIR = Path("/app/uploads/documents") if os.path.exists("/app") else Path("uploads/documents")

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_MIME_TYPES = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/png",
    "image/jpeg"
]


# ============================================
# CV & DOCUMENT MANAGEMENT
# ============================================

@router.post("/upload", response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    name: str = Form(...),
    document_type: str = Form("cv"),
    label: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    is_default: bool = Form(False),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Upload a document (CV, cover letter, etc.)"""
    user_id = current_user["user_id"]
    
    # Validate file size
    file.file.seek(0, 2)  # Seek to end
    file_size = file.file.tell()
    file.file.seek(0)  # Reset
    
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Fichier trop volumineux. Maximum: {MAX_FILE_SIZE // (1024*1024)} MB"
        )
    
    # Validate mime type
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Type de fichier non autorisé. Types acceptés: PDF, DOC, DOCX, PNG, JPG"
        )
    
    # Create user directory
    user_dir = UPLOAD_DIR / user_id
    user_dir.mkdir(parents=True, exist_ok=True)
    
    # Generate unique filename
    file_ext = Path(file.filename).suffix
    unique_filename = f"{uuid.uuid4().hex}{file_ext}"
    file_path = user_dir / unique_filename
    
    # Save file
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # If setting as default, unset other defaults of same type
    doc_type = DocumentType(document_type)
    if is_default:
        await db.documents.update_many(
            {"user_id": user_id, "document_type": doc_type.value, "is_default": True},
            {"$set": {"is_default": False}}
        )
    
    # Create document record
    doc_id = str(uuid.uuid4())
    document = {
        "id": doc_id,
        "user_id": user_id,
        "name": name,
        "document_type": doc_type.value,
        "label": label,
        "description": description,
        "is_default": is_default,
        "file_path": str(file_path),
        "file_size": file_size,
        "mime_type": file.content_type,
        "original_filename": file.filename,
        "url": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.documents.insert_one(document)
    
    return DocumentResponse(
        id=doc_id,
        name=name,
        document_type=doc_type,
        label=label,
        description=description,
        is_default=is_default,
        file_size=file_size,
        mime_type=file.content_type,
        original_filename=file.filename,
        created_at=document["created_at"],
        updated_at=document["updated_at"],
        download_url=f"/api/documents/{doc_id}/download"
    )


@router.post("/link", response_model=DocumentResponse)
async def create_portfolio_link(
    name: str,
    url: str,
    label: Optional[str] = None,
    description: Optional[str] = None,
    is_default: bool = False,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Create a portfolio link (GitHub, LinkedIn, etc.)"""
    user_id = current_user["user_id"]
    
    # If setting as default, unset other defaults
    if is_default:
        await db.documents.update_many(
            {"user_id": user_id, "document_type": DocumentType.PORTFOLIO_LINK.value, "is_default": True},
            {"$set": {"is_default": False}}
        )
    
    doc_id = str(uuid.uuid4())
    document = {
        "id": doc_id,
        "user_id": user_id,
        "name": name,
        "document_type": DocumentType.PORTFOLIO_LINK.value,
        "label": label,
        "description": description,
        "is_default": is_default,
        "url": url,
        "file_path": None,
        "file_size": None,
        "mime_type": None,
        "original_filename": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.documents.insert_one(document)
    
    return DocumentResponse(
        id=doc_id,
        name=name,
        document_type=DocumentType.PORTFOLIO_LINK,
        label=label,
        description=description,
        is_default=is_default,
        url=url,
        created_at=document["created_at"],
        updated_at=document["updated_at"]
    )


@router.get("/", response_model=List[DocumentResponse])
async def list_documents(
    document_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """List all documents for the current user"""
    user_id = current_user["user_id"]
    
    query = {"user_id": user_id}
    if document_type:
        query["document_type"] = document_type
    
    documents = await db.documents.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    result = []
    for doc in documents:
        download_url = None
        if doc.get("file_path"):
            download_url = f"/api/documents/{doc['id']}/download"
        
        result.append(DocumentResponse(
            id=doc["id"],
            name=doc["name"],
            document_type=DocumentType(doc["document_type"]),
            label=doc.get("label"),
            description=doc.get("description"),
            is_default=doc.get("is_default", False),
            url=doc.get("url"),
            file_size=doc.get("file_size"),
            mime_type=doc.get("mime_type"),
            original_filename=doc.get("original_filename"),
            created_at=doc["created_at"],
            updated_at=doc["updated_at"],
            download_url=download_url
        ))
    
    return result


@router.get("/cv", response_model=List[DocumentResponse])
async def list_cvs(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """List all CVs for the current user"""
    return await list_documents(document_type="cv", current_user=current_user, db=db)


@router.get("/portfolio-links", response_model=List[DocumentResponse])
async def list_portfolio_links(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """List all portfolio links for the current user"""
    return await list_documents(document_type="portfolio_link", current_user=current_user, db=db)


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get a specific document"""
    user_id = current_user["user_id"]
    
    document = await db.documents.find_one(
        {"id": document_id, "user_id": user_id},
        {"_id": 0}
    )
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document non trouvé"
        )
    
    download_url = None
    if document.get("file_path"):
        download_url = f"/api/documents/{document_id}/download"
    
    return DocumentResponse(
        id=document["id"],
        name=document["name"],
        document_type=DocumentType(document["document_type"]),
        label=document.get("label"),
        description=document.get("description"),
        is_default=document.get("is_default", False),
        url=document.get("url"),
        file_size=document.get("file_size"),
        mime_type=document.get("mime_type"),
        original_filename=document.get("original_filename"),
        created_at=document["created_at"],
        updated_at=document["updated_at"],
        download_url=download_url
    )


@router.get("/{document_id}/download")
async def download_document(
    document_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Download a document file"""
    user_id = current_user["user_id"]
    
    document = await db.documents.find_one(
        {"id": document_id, "user_id": user_id},
        {"_id": 0}
    )
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document non trouvé"
        )
    
    if not document.get("file_path"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ce document n'a pas de fichier associé"
        )
    
    file_path = Path(document["file_path"])
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fichier non trouvé sur le serveur"
        )
    
    return FileResponse(
        path=file_path,
        filename=document.get("original_filename", file_path.name),
        media_type=document.get("mime_type", "application/octet-stream")
    )


@router.put("/{document_id}", response_model=DocumentResponse)
async def update_document(
    document_id: str,
    update: DocumentUpdate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Update a document's metadata"""
    user_id = current_user["user_id"]
    
    document = await db.documents.find_one(
        {"id": document_id, "user_id": user_id}
    )
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document non trouvé"
        )
    
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # If setting as default, unset other defaults
    if update.is_default:
        await db.documents.update_many(
            {"user_id": user_id, "document_type": document["document_type"], "is_default": True, "id": {"$ne": document_id}},
            {"$set": {"is_default": False}}
        )
    
    await db.documents.update_one(
        {"id": document_id},
        {"$set": update_data}
    )
    
    return await get_document(document_id, current_user, db)


@router.delete("/{document_id}")
async def delete_document(
    document_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Delete a document"""
    user_id = current_user["user_id"]
    
    document = await db.documents.find_one(
        {"id": document_id, "user_id": user_id}
    )
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document non trouvé"
        )
    
    # Delete file if exists
    if document.get("file_path"):
        file_path = Path(document["file_path"])
        if file_path.exists():
            file_path.unlink()
    
    await db.documents.delete_one({"id": document_id})
    
    return {"message": "Document supprimé"}


# ============================================
# COVER LETTER TEMPLATES
# ============================================

@router.post("/templates", response_model=dict)
async def create_template(
    template: CoverLetterTemplateCreate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Create a cover letter template"""
    user_id = current_user["user_id"]
    
    # If setting as default, unset other defaults
    if template.is_default:
        await db.cover_letter_templates.update_many(
            {"user_id": user_id, "is_default": True},
            {"$set": {"is_default": False}}
        )
    
    template_id = str(uuid.uuid4())
    template_doc = {
        "id": template_id,
        "user_id": user_id,
        "name": template.name,
        "content": template.content,
        "is_default": template.is_default,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.cover_letter_templates.insert_one(template_doc)
    
    return {
        "id": template_id,
        "name": template.name,
        "content": template.content,
        "is_default": template.is_default,
        "created_at": template_doc["created_at"]
    }


@router.get("/templates", response_model=List[dict])
async def list_templates(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """List all cover letter templates"""
    user_id = current_user["user_id"]
    
    templates = await db.cover_letter_templates.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return templates


@router.get("/templates/{template_id}", response_model=dict)
async def get_template(
    template_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get a specific template"""
    user_id = current_user["user_id"]
    
    template = await db.cover_letter_templates.find_one(
        {"id": template_id, "user_id": user_id},
        {"_id": 0}
    )
    
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template non trouvé"
        )
    
    return template


@router.put("/templates/{template_id}", response_model=dict)
async def update_template(
    template_id: str,
    name: Optional[str] = None,
    content: Optional[str] = None,
    is_default: Optional[bool] = None,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Update a template"""
    user_id = current_user["user_id"]
    
    template = await db.cover_letter_templates.find_one(
        {"id": template_id, "user_id": user_id}
    )
    
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template non trouvé"
        )
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if name is not None:
        update_data["name"] = name
    if content is not None:
        update_data["content"] = content
    if is_default is not None:
        update_data["is_default"] = is_default
        if is_default:
            await db.cover_letter_templates.update_many(
                {"user_id": user_id, "is_default": True, "id": {"$ne": template_id}},
                {"$set": {"is_default": False}}
            )
    
    await db.cover_letter_templates.update_one(
        {"id": template_id},
        {"$set": update_data}
    )
    
    return await get_template(template_id, current_user, db)


@router.delete("/templates/{template_id}")
async def delete_template(
    template_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Delete a template"""
    user_id = current_user["user_id"]
    
    result = await db.cover_letter_templates.delete_one(
        {"id": template_id, "user_id": user_id}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template non trouvé"
        )
    
    return {"message": "Template supprimé"}


@router.post("/templates/{template_id}/generate")
async def generate_cover_letter_from_template(
    template_id: str,
    entreprise: str,
    poste: str,
    application_id: Optional[str] = None,
    extra_vars: Optional[dict] = None,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Generate a cover letter from a template with variable substitution"""
    user_id = current_user["user_id"]
    
    template = await db.cover_letter_templates.find_one(
        {"id": template_id, "user_id": user_id},
        {"_id": 0}
    )
    
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template non trouvé"
        )
    
    # Get user info for variables
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "full_name": 1, "email": 1})
    
    # Variable substitution
    content = template["content"]
    variables = {
        "entreprise": entreprise,
        "poste": poste,
        "date": datetime.now().strftime("%d/%m/%Y"),
        "nom": user.get("full_name", ""),
        "email": user.get("email", ""),
        **(extra_vars or {})
    }
    
    for var, value in variables.items():
        content = content.replace(f"{{{var}}}", str(value))
    
    # Save generated letter
    letter_id = str(uuid.uuid4())
    letter = {
        "id": letter_id,
        "user_id": user_id,
        "application_id": application_id,
        "template_id": template_id,
        "entreprise": entreprise,
        "poste": poste,
        "content": content,
        "generated_by": "template",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.generated_cover_letters.insert_one(letter)
    
    return {
        "id": letter_id,
        "content": content,
        "entreprise": entreprise,
        "poste": poste,
        "created_at": letter["created_at"]
    }


@router.get("/cover-letters", response_model=List[dict])
async def list_generated_cover_letters(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """List all generated cover letters"""
    user_id = current_user["user_id"]
    
    letters = await db.generated_cover_letters.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return letters


# ============================================
# APPLICATION-DOCUMENT LINKING
# ============================================

@router.post("/link-to-application")
async def link_document_to_application(
    application_id: str,
    document_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Link a document to an application (track what was sent)"""
    user_id = current_user["user_id"]
    
    # Verify application exists
    application = await db.applications.find_one(
        {"id": application_id, "user_id": user_id}
    )
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidature non trouvée"
        )
    
    # Verify document exists
    document = await db.documents.find_one(
        {"id": document_id, "user_id": user_id}
    )
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document non trouvé"
        )
    
    # Check if link already exists
    existing = await db.application_documents.find_one({
        "application_id": application_id,
        "document_id": document_id
    })
    
    if existing:
        return {"message": "Lien déjà existant", "id": existing.get("id")}
    
    # Create link
    link_id = str(uuid.uuid4())
    link = {
        "id": link_id,
        "application_id": application_id,
        "document_id": document_id,
        "document_type": document["document_type"],
        "document_name": document["name"],
        "sent_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.application_documents.insert_one(link)
    
    return {"message": "Document lié à la candidature", "id": link_id}


@router.get("/application/{application_id}")
async def get_application_documents(
    application_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get all documents linked to an application"""
    user_id = current_user["user_id"]
    
    # Verify application exists
    application = await db.applications.find_one(
        {"id": application_id, "user_id": user_id}
    )
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidature non trouvée"
        )
    
    # Get links
    links = await db.application_documents.find(
        {"application_id": application_id},
        {"_id": 0}
    ).to_list(20)
    
    # Enrich with document details
    result = []
    for link in links:
        document = await db.documents.find_one(
            {"id": link["document_id"]},
            {"_id": 0, "name": 1, "document_type": 1, "label": 1, "original_filename": 1}
        )
        if document:
            result.append({
                **link,
                "document": document
            })
    
    return result


@router.delete("/application/{application_id}/document/{document_id}")
async def unlink_document_from_application(
    application_id: str,
    document_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Remove a document link from an application"""
    user_id = current_user["user_id"]
    
    # Verify application exists
    application = await db.applications.find_one(
        {"id": application_id, "user_id": user_id}
    )
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidature non trouvée"
        )
    
    result = await db.application_documents.delete_one({
        "application_id": application_id,
        "document_id": document_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lien non trouvé"
        )
    
    return {"message": "Lien supprimé"}


# ============================================
# AI COVER LETTER GENERATION
# ============================================

@router.post("/generate-cover-letter-ai")
async def generate_cover_letter_with_ai(
    entreprise: str,
    poste: str,
    cv_id: Optional[str] = None,
    job_description: Optional[str] = None,
    tone: str = "professional",  # professional, enthusiastic, formal
    application_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Generate a cover letter using AI based on CV and job description"""
    import os
    user_id = current_user["user_id"]
    
    # Get user info
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "full_name": 1, "email": 1, "google_ai_key": 1, "openai_key": 1, "groq_key": 1})
    
    # Get CV content if provided
    cv_content = ""
    if cv_id:
        cv_doc = await db.documents.find_one({"id": cv_id, "user_id": user_id})
        if cv_doc and cv_doc.get("description"):
            cv_content = cv_doc["description"]
    
    # Get user's recent applications for context
    recent_apps = await db.applications.find(
        {"user_id": user_id},
        {"_id": 0, "entreprise": 1, "poste": 1, "type_poste": 1}
    ).sort("date_candidature", -1).limit(5).to_list(5)
    
    # Build prompt
    tone_instructions = {
        "professional": "un ton professionnel et confiant",
        "enthusiastic": "un ton enthousiaste et dynamique", 
        "formal": "un ton formel et respectueux"
    }
    
    tone_text = tone_instructions.get(tone, tone_instructions["professional"])
    
    prompt = f"""Génère une lettre de motivation en français pour le poste suivant:

Entreprise: {entreprise}
Poste: {poste}
{f"Description du poste: {job_description}" if job_description else ""}

Informations du candidat:
- Nom: {user.get('full_name', 'Candidat')}
- Email: {user.get('email', '')}
{f"- Résumé CV: {cv_content}" if cv_content else ""}

Contexte: Le candidat a postulé récemment à des postes similaires:
{chr(10).join([f"- {app['poste']} chez {app['entreprise']}" for app in recent_apps]) if recent_apps else "- Première candidature"}

Instructions:
1. Utilise {tone_text}
2. Structure classique: accroche, motivation, compétences, conclusion
3. Maximum 300 mots
4. Ne pas inventer de compétences non mentionnées
5. Personnalise pour l'entreprise {entreprise}

Génère UNIQUEMENT la lettre, sans introduction ni commentaire."""

    # Select AI provider
    api_key = None
    provider = None
    
    # Check user keys first
    if user.get("openai_key"):
        api_key = user["openai_key"]
        provider = "openai"
    elif user.get("google_ai_key"):
        api_key = user["google_ai_key"]
        provider = "google"
    elif user.get("groq_key"):
        api_key = user["groq_key"]
        provider = "groq"
    
    # Fallback to env keys
    if not api_key:
        api_key = os.environ.get("EMERGENT_LLM_KEY") or os.environ.get("OPENAI_API_KEY")
        if api_key:
            provider = "openai"
    
    if not api_key:
        api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
        if api_key:
            provider = "google"
    
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Aucune clé API configurée. Configurez une clé OpenAI, Google ou Groq dans les paramètres."
        )
    
    # Call AI
    try:
        content = ""
        
        if provider == "openai":
            try:
                from emergentintegrations.llm.chat import LlmChat, UserMessage
                chat = LlmChat(api_key=api_key, session_id=str(uuid.uuid4()))
                chat = chat.with_model("openai", "gpt-4o-mini")
                content = await chat.send_message(UserMessage(text=prompt))
            except ImportError:
                from openai import OpenAI
                client = OpenAI(api_key=api_key)
                response = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[{"role": "user", "content": prompt}]
                )
                content = response.choices[0].message.content
                
        elif provider == "google":
            try:
                from emergentintegrations.llm.chat import LlmChat, UserMessage
                chat = LlmChat(api_key=api_key, session_id=str(uuid.uuid4()))
                chat = chat.with_model("gemini", "gemini-2.0-flash")
                content = await chat.send_message(UserMessage(text=prompt))
            except ImportError:
                from google import genai
                client = genai.Client(api_key=api_key)
                response = client.models.generate_content(model="gemini-2.0-flash", contents=prompt)
                content = response.text
                
        elif provider == "groq":
            from groq import Groq
            client = Groq(api_key=api_key)
            response = client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[{"role": "user", "content": prompt}]
            )
            content = response.choices[0].message.content
        
        # Save generated letter
        letter_id = str(uuid.uuid4())
        letter = {
            "id": letter_id,
            "user_id": user_id,
            "application_id": application_id,
            "template_id": None,
            "entreprise": entreprise,
            "poste": poste,
            "content": content,
            "generated_by": "ai",
            "tone": tone,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.generated_cover_letters.insert_one(letter)
        
        return {
            "id": letter_id,
            "content": content,
            "entreprise": entreprise,
            "poste": poste,
            "tone": tone,
            "generated_by": "ai",
            "created_at": letter["created_at"]
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur de génération IA: {str(e)}"
        )

