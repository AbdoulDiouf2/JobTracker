"""
JobTracker SaaS - Routes
"""

from .auth import router as auth_router
from .applications import router as applications_router
from .interviews import router as interviews_router
from .statistics import router as statistics_router
from .export import router as export_router

__all__ = [
    'auth_router',
    'applications_router', 
    'interviews_router',
    'statistics_router',
    'export_router'
]
