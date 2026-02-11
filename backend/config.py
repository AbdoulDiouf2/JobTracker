"""
JobTracker SaaS - Configuration
"""

from pydantic_settings import BaseSettings
from typing import Optional
import os


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
    GOOGLE_AI_API_KEY: Optional[str] = os.environ.get('GOOGLE_AI_API_KEY')
    OPENAI_API_KEY: Optional[str] = os.environ.get('OPENAI_API_KEY')
    
    # App
    APP_NAME: str = "JobTracker SaaS"
    DEBUG: bool = os.environ.get('DEBUG', 'false').lower() == 'true'
    
    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
