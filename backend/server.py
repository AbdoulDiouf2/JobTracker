"""
JobTracker SaaS - Serveur Principal FastAPI
"""

from fastapi import FastAPI, APIRouter, Depends
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from contextlib import asynccontextmanager
import os
import logging

from config import settings
from routes import (
    auth_router, 
    applications_router, 
    interviews_router,
    statistics_router,
    export_router
)
from routes.ai import router as ai_router
from routes.data_import import router as import_router
from routes.notifications import router as notifications_router
from routes.admin import router as admin_router
from routes.tracking import router as tracking_router
from routes.documents import router as documents_router
from routes.calendar import router as calendar_router
from routes.auth import get_db as auth_get_db
from routes.applications import get_db as app_get_db
from routes.interviews import get_db as interview_get_db
from routes.statistics import get_db as stats_get_db
from routes.export import get_db as export_get_db
from routes.ai import get_db as ai_get_db
from routes.data_import import get_db as import_get_db
from routes.notifications import get_db as notif_get_db
from routes.admin import get_db as admin_get_db
from routes.tracking import get_db as tracking_get_db
from routes.documents import get_db as documents_get_db
from routes.calendar import get_db as calendar_get_db
from routes.reminders import router as reminders_router
from routes.reminders import get_db as reminders_get_db
from utils.auth import get_current_user, security
from utils.scheduler import setup_scheduler, shutdown_scheduler

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# MongoDB client
client = None
db = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager pour la connexion MongoDB"""
    global client, db
    
    logger.info("Connexion à MongoDB...")
    client = AsyncIOMotorClient(settings.MONGO_URL)
    db = client[settings.DB_NAME]
    
    # Créer les index
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.applications.create_index("user_id")
    await db.applications.create_index("id", unique=True)
    await db.applications.create_index([("user_id", 1), ("date_candidature", -1)])
    await db.interviews.create_index("user_id")
    await db.interviews.create_index("candidature_id")
    await db.interviews.create_index("id", unique=True)
    # Documents indexes
    await db.documents.create_index("user_id")
    await db.documents.create_index("id", unique=True)
    await db.documents.create_index([("user_id", 1), ("document_type", 1)])
    await db.cover_letter_templates.create_index("user_id")
    await db.application_documents.create_index("application_id")
    # Reminders indexes
    await db.sent_reminders.create_index([("user_id", 1), ("reminder_key", 1)], unique=True)
    await db.push_subscriptions.create_index([("user_id", 1), ("subscription.endpoint", 1)])
    
    logger.info(f"Connecté à MongoDB: {settings.DB_NAME}")
    
    yield
    
    logger.info("Fermeture connexion MongoDB...")
    client.close()


# Create FastAPI app
app = FastAPI(
    title="JobTracker SaaS API",
    description="API pour l'application de suivi de candidatures JobTracker",
    version="2.0.0",
    lifespan=lifespan
)

# Create API router with /api prefix
api_router = APIRouter(prefix="/api")


# Dependency pour obtenir la DB
def get_database():
    return db


# Override les dépendances get_db dans chaque router
def override_get_db():
    return db


# Root endpoint
@api_router.get("/")
async def root():
    return {
        "message": "JobTracker SaaS API",
        "version": "2.0.0",
        "status": "running"
    }


# Health check
@api_router.get("/health")
async def health_check():
    try:
        # Vérifier la connexion MongoDB
        await db.command("ping")
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        return {"status": "unhealthy", "database": "disconnected", "error": str(e)}


# Include routers
api_router.include_router(auth_router)
api_router.include_router(applications_router)
api_router.include_router(interviews_router)
api_router.include_router(statistics_router)
api_router.include_router(export_router)
api_router.include_router(ai_router)
api_router.include_router(import_router)
api_router.include_router(notifications_router)
api_router.include_router(admin_router)
api_router.include_router(tracking_router)
api_router.include_router(documents_router)
api_router.include_router(calendar_router)
api_router.include_router(reminders_router)

# Include main router
app.include_router(api_router)

# Override dependencies
app.dependency_overrides[auth_get_db] = override_get_db
app.dependency_overrides[app_get_db] = override_get_db
app.dependency_overrides[interview_get_db] = override_get_db
app.dependency_overrides[stats_get_db] = override_get_db
app.dependency_overrides[export_get_db] = override_get_db
app.dependency_overrides[ai_get_db] = override_get_db
app.dependency_overrides[import_get_db] = override_get_db
app.dependency_overrides[notif_get_db] = override_get_db
app.dependency_overrides[admin_get_db] = override_get_db
app.dependency_overrides[tracking_get_db] = override_get_db
app.dependency_overrides[documents_get_db] = override_get_db
app.dependency_overrides[calendar_get_db] = override_get_db
app.dependency_overrides[reminders_get_db] = override_get_db

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=settings.CORS_ORIGINS.split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    logger.info("JobTracker SaaS API démarrée")


@app.on_event("shutdown")
async def shutdown_event():
    logger.info("JobTracker SaaS API arrêtée")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
