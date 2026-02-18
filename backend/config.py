"""
JobTracker SaaS - Configuration
"""

from pydantic_settings import BaseSettings
from typing import Optional
from dotenv import load_dotenv
import os

# Load .env file
load_dotenv()


class Settings(BaseSettings):
    # Database
    MONGO_URL: str = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    DB_NAME: str = os.environ.get('DB_NAME', 'jobtracker')
    
    # JWT
    JWT_SECRET: str = os.environ.get('JWT_SECRET', 'super-secret-key-change-in-production')
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # CORS
    CORS_ORIGINS: str = os.environ.get('CORS_ORIGINS', '*')
    
    # AI APIs
    EMERGENT_LLM_KEY: Optional[str] = os.environ.get('EMERGENT_LLM_KEY')
    GOOGLE_AI_API_KEY: Optional[str] = os.environ.get('GOOGLE_AI_API_KEY')
    OPENAI_API_KEY: Optional[str] = os.environ.get('OPENAI_API_KEY')
    
    # Google Calendar
    GOOGLE_CALENDAR_CLIENT_ID: Optional[str] = os.environ.get('GOOGLE_CALENDAR_CLIENT_ID')
    GOOGLE_CALENDAR_CLIENT_SECRET: Optional[str] = os.environ.get('GOOGLE_CALENDAR_CLIENT_SECRET')

    # Google OAuth (Native)
    GOOGLE_CLIENT_ID: Optional[str] = os.environ.get('GOOGLE_CLIENT_ID')
    GOOGLE_CLIENT_SECRET: Optional[str] = os.environ.get('GOOGLE_CLIENT_SECRET')
    SECRET_KEY: str = os.environ.get('SECRET_KEY', 'super-secret-session-key') # For SessionMiddleware
    
    # URLs
    BACKEND_URL: str = os.environ.get('BACKEND_URL', 'http://localhost:8001')
    FRONTEND_URL: str = os.environ.get('FRONTEND_URL', 'http://localhost:3000')

    # App
    APP_NAME: str = "JobTracker SaaS"
    DEBUG: bool = os.environ.get('DEBUG', 'false').lower() == 'true'
    
    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
