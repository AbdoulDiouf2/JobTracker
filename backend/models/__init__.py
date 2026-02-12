"""
JobTracker SaaS - Modèles Pydantic
"""

from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import Optional, List
from datetime import datetime, timezone
from enum import Enum
import uuid


# ============================================
# ENUMS - Statuts et Types
# ============================================

class UserRole(str, Enum):
    ADMIN = "admin"
    STANDARD = "standard"
    PREMIUM = "premium"

    @property
    def label_fr(self) -> str:
        labels = {
            "admin": "Administrateur",
            "standard": "Standard",
            "premium": "Premium"
        }
        return labels.get(self.value, self.value)


class ApplicationStatus(str, Enum):
    PENDING = "pending"
    POSITIVE = "positive"
    NEGATIVE = "negative"
    NO_RESPONSE = "no_response"
    CANCELLED = "cancelled"

    @property
    def label_fr(self) -> str:
        labels = {
            "pending": "⏳ En attente",
            "positive": "✅ Réponse positive",
            "negative": "❌ Réponse négative",
            "no_response": "🔇 Pas de réponse",
            "cancelled": "❌ Annulé"
        }
        return labels.get(self.value, self.value)
    
    @property
    def label_en(self) -> str:
        labels = {
            "pending": "⏳ Pending",
            "positive": "✅ Positive response",
            "negative": "❌ Negative response",
            "no_response": "🔇 No response",
            "cancelled": "❌ Cancelled"
        }
        return labels.get(self.value, self.value)


class JobType(str, Enum):
    CDI = "cdi"
    CDD = "cdd"
    STAGE = "stage"
    ALTERNANCE = "alternance"
    FREELANCE = "freelance"
    INTERIM = "interim"

    @property
    def label_fr(self) -> str:
        labels = {
            "cdi": "CDI",
            "cdd": "CDD",
            "stage": "Stage",
            "alternance": "Alternance",
            "freelance": "Freelance",
            "interim": "Intérim"
        }
        return labels.get(self.value, self.value)


class ApplicationMethod(str, Enum):
    LINKEDIN = "linkedin"
    SITE_ENTREPRISE = "company_website"
    EMAIL = "email"
    INDEED = "indeed"
    APEC = "apec"
    POLE_EMPLOI = "pole_emploi"
    WELCOME_TO_JUNGLE = "welcome_to_jungle"
    AUTRE = "other"

    @property
    def label_fr(self) -> str:
        labels = {
            "linkedin": "LinkedIn",
            "company_website": "Site entreprise",
            "email": "Email direct",
            "indeed": "Indeed",
            "apec": "APEC",
            "pole_emploi": "France Travail",
            "welcome_to_jungle": "Welcome to the Jungle",
            "other": "Autre"
        }
        return labels.get(self.value, self.value)


class InterviewType(str, Enum):
    RH = "rh"
    TECHNIQUE = "technical"
    MANAGER = "manager"
    FINAL = "final"
    OTHER = "other"

    @property
    def label_fr(self) -> str:
        labels = {
            "rh": "RH",
            "technical": "Technique",
            "manager": "Manager",
            "final": "Final",
            "other": "Autre"
        }
        return labels.get(self.value, self.value)


class InterviewFormat(str, Enum):
    PHONE = "phone"
    VIDEO = "video"
    IN_PERSON = "in_person"

    @property
    def label_fr(self) -> str:
        labels = {
            "phone": "📞 Téléphonique",
            "video": "💻 Visioconférence",
            "in_person": "🏢 Présentiel"
        }
        return labels.get(self.value, self.value)


class InterviewStatus(str, Enum):
    PLANNED = "planned"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

    @property
    def label_fr(self) -> str:
        labels = {
            "planned": "🔄 Planifié",
            "completed": "✅ Effectué",
            "cancelled": "❌ Annulé"
        }
        return labels.get(self.value, self.value)


# ============================================
# USER MODELS
# ============================================

class UserBase(BaseModel):
    email: EmailStr
    full_name: str


class UserCreate(UserBase):
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    google_ai_key: Optional[str] = None
    openai_key: Optional[str] = None


class User(UserBase):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    hashed_password: str
    role: UserRole = UserRole.STANDARD
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_login: Optional[datetime] = None
    is_active: bool = True
    google_ai_key: Optional[str] = None
    openai_key: Optional[str] = None


class UserResponse(UserBase):
    id: str
    role: UserRole = UserRole.STANDARD
    created_at: datetime
    last_login: Optional[datetime] = None
    is_active: bool
    has_google_ai_key: bool = False
    has_openai_key: bool = False


class UserAdminResponse(UserResponse):
    """Extended user response for admin panel"""
    applications_count: int = 0
    interviews_count: int = 0


# ============================================
# JOB APPLICATION MODELS
# ============================================

class JobApplicationBase(BaseModel):
    entreprise: str = Field(..., min_length=1, max_length=200)
    poste: str = Field(..., min_length=1, max_length=200)
    type_poste: JobType = JobType.CDI
    lieu: Optional[str] = Field(None, max_length=100)
    moyen: Optional[ApplicationMethod] = None
    date_candidature: datetime
    lien: Optional[str] = Field(None, max_length=500)
    commentaire: Optional[str] = Field(None, max_length=2000)
    # Nouveaux champs pour le matching et le suivi
    description_poste: Optional[str] = Field(None, max_length=5000, description="Description du poste pour le matching IA")
    contact_email: Optional[str] = Field(None, max_length=200, description="Email du recruteur pour les relances")
    contact_name: Optional[str] = Field(None, max_length=100, description="Nom du contact/recruteur")
    salaire_min: Optional[int] = Field(None, description="Salaire minimum proposé")
    salaire_max: Optional[int] = Field(None, description="Salaire maximum proposé")
    days_before_reminder: Optional[int] = Field(default=7, description="Jours avant rappel de relance")


class JobApplicationCreate(JobApplicationBase):
    pass


class JobApplicationUpdate(BaseModel):
    entreprise: Optional[str] = Field(None, min_length=1, max_length=200)
    poste: Optional[str] = Field(None, min_length=1, max_length=200)
    type_poste: Optional[JobType] = None
    lieu: Optional[str] = Field(None, max_length=100)
    moyen: Optional[ApplicationMethod] = None
    date_candidature: Optional[datetime] = None
    lien: Optional[str] = Field(None, max_length=500)
    reponse: Optional[ApplicationStatus] = None
    date_reponse: Optional[datetime] = None
    commentaire: Optional[str] = Field(None, max_length=2000)
    is_favorite: Optional[bool] = None
    # Nouveaux champs
    description_poste: Optional[str] = Field(None, max_length=5000)
    contact_email: Optional[str] = Field(None, max_length=200)
    contact_name: Optional[str] = Field(None, max_length=100)
    salaire_min: Optional[int] = None
    salaire_max: Optional[int] = None
    days_before_reminder: Optional[int] = None


# ============================================
# APPLICATION HISTORY (Timeline)
# ============================================

class ApplicationHistoryEvent(BaseModel):
    """Un événement dans l'historique d'une candidature"""
    event_type: str  # status_change, interview_scheduled, interview_completed, note_added, reminder_sent, followup_sent
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    details: Optional[str] = None


class JobApplication(JobApplicationBase):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    reponse: ApplicationStatus = ApplicationStatus.PENDING
    date_reponse: Optional[datetime] = None
    is_favorite: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    user_id: str
    # Timeline / Historique
    history: List[ApplicationHistoryEvent] = Field(default_factory=list)
    # Matching score (calculé par IA)
    match_score: Optional[int] = Field(None, ge=0, le=100, description="Score de matching CV vs offre")
    match_details: Optional[dict] = Field(None, description="Détails du matching IA")
    # Rappels
    last_reminder_sent: Optional[datetime] = None
    followup_count: int = 0


class JobApplicationResponse(JobApplication):
    interviews_count: int = 0
    next_interview: Optional[datetime] = None
    needs_followup: bool = False  # Indique si une relance est recommandée


class BulkUpdateRequest(BaseModel):
    application_ids: List[str]
    reponse: ApplicationStatus


# ============================================
# FOLLOWUP / RELANCE MODELS
# ============================================

class FollowupEmailRequest(BaseModel):
    """Demande de génération d'email de relance"""
    application_id: str
    tone: str = Field(default="professional", description="Ton de l'email: professional, friendly, formal")
    language: str = Field(default="fr", description="Langue: fr, en")


class FollowupEmailResponse(BaseModel):
    """Réponse avec l'email de relance généré"""
    subject: str
    body: str
    recipient_email: Optional[str] = None
    recipient_name: Optional[str] = None


class MatchingScoreRequest(BaseModel):
    """Demande de calcul du score de matching"""
    application_id: str
    cv_text: Optional[str] = None  # Si non fourni, utilise le dernier CV analysé


class MatchingScoreResponse(BaseModel):
    """Résultat du score de matching"""
    score: int = Field(ge=0, le=100)
    summary: str
    strengths: List[str] = []
    gaps: List[str] = []
    recommendations: List[str] = []
    keywords_matched: List[str] = []
    keywords_missing: List[str] = []


# ============================================
# INTERVIEW MODELS
# ============================================

class InterviewBase(BaseModel):
    candidature_id: str
    date_entretien: datetime
    type_entretien: InterviewType
    format_entretien: InterviewFormat
    lieu_entretien: Optional[str] = Field(None, max_length=500)
    interviewer: Optional[str] = Field(None, max_length=200)
    commentaire: Optional[str] = Field(None, max_length=2000)


class InterviewCreate(InterviewBase):
    pass


class InterviewUpdate(BaseModel):
    date_entretien: Optional[datetime] = None
    type_entretien: Optional[InterviewType] = None
    format_entretien: Optional[InterviewFormat] = None
    lieu_entretien: Optional[str] = Field(None, max_length=500)
    statut: Optional[InterviewStatus] = None
    interviewer: Optional[str] = Field(None, max_length=200)
    commentaire: Optional[str] = Field(None, max_length=2000)


class Interview(InterviewBase):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    statut: InterviewStatus = InterviewStatus.PLANNED
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    user_id: str

    @property
    def est_passe(self) -> bool:
        """Vérifie si l'entretien est passé"""
        return datetime.now(timezone.utc) > self.date_entretien


class InterviewResponse(Interview):
    entreprise: Optional[str] = None
    poste: Optional[str] = None
    time_remaining: Optional[str] = None
    urgency: Optional[str] = None  # "danger", "warning", "info"


# ============================================
# STATISTICS MODELS
# ============================================

class DashboardStats(BaseModel):
    total_applications: int = 0
    pending: int = 0
    with_interview: int = 0
    positive: int = 0
    negative: int = 0
    no_response: int = 0
    cancelled: int = 0
    response_rate: float = 0.0
    favorites_count: int = 0


class TimelineDataPoint(BaseModel):
    date: str
    count: int
    cumulative: int


class StatusDistribution(BaseModel):
    status: str
    label: str
    count: int
    percentage: float


class TypeDistribution(BaseModel):
    type: str
    label: str
    count: int
    percentage: float


class MethodDistribution(BaseModel):
    method: str
    label: str
    count: int
    percentage: float


class StatisticsOverview(BaseModel):
    dashboard: DashboardStats
    timeline: List[TimelineDataPoint] = []
    by_status: List[StatusDistribution] = []
    by_type: List[TypeDistribution] = []
    by_method: List[MethodDistribution] = []
    avg_response_time_days: Optional[float] = None
    interviews_stats: dict = {}


# ============================================
# AI MODELS
# ============================================

class AIAdviceRequest(BaseModel):
    advice_type: str  # "cv", "cover_letter", "interview_prep", "analysis", "suggestions"
    context: Optional[str] = None
    cv_text: Optional[str] = None


class AIAdviceResponse(BaseModel):
    advice: str
    advice_type: str
    generated_at: datetime


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ChatRequest(BaseModel):
    message: str
    conversation_history: List[ChatMessage] = []


class ChatResponse(BaseModel):
    message: str
    conversation_history: List[ChatMessage]


# ============================================
# AUTH MODELS
# ============================================

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: Optional[str] = None


# ============================================
# PAGINATION & FILTERS
# ============================================

class PaginationParams(BaseModel):
    page: int = 1
    per_page: int = 20
    sort_by: str = "date_candidature"
    sort_order: str = "desc"


class ApplicationFilters(BaseModel):
    search: Optional[str] = None
    status: Optional[ApplicationStatus] = None
    job_type: Optional[JobType] = None
    method: Optional[ApplicationMethod] = None
    is_favorite: Optional[bool] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None


class PaginatedResponse(BaseModel):
    items: List
    total: int
    page: int
    per_page: int
    total_pages: int


# ============================================
# ADMIN MODELS
# ============================================

class AdminDashboardStats(BaseModel):
    """Statistiques globales pour le panel admin"""
    total_users: int = 0
    active_users: int = 0  # Connectés dans les 7 derniers jours
    new_users_this_week: int = 0
    new_users_this_month: int = 0
    total_applications: int = 0
    total_interviews: int = 0
    applications_this_week: int = 0
    interviews_this_week: int = 0


class AdminUserUpdate(BaseModel):
    """Modèle pour la mise à jour admin d'un utilisateur"""
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None


class UserGrowthDataPoint(BaseModel):
    """Point de données pour le graphique de croissance"""
    date: str
    count: int
    cumulative: int


class ActivityDataPoint(BaseModel):
    """Point de données pour le graphique d'activité"""
    date: str
    applications: int
    interviews: int

