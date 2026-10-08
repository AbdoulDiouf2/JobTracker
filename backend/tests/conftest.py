"""
Fixtures de test backend.

Les tests marqués `mongo` s'exécutent contre une base MongoDB ÉPHÉMÈRE
(conteneur Docker jetable, cf. tests/run_mongo_tests.sh). Jamais contre une
base dev/prod :
- MONGO_TEST_URL doit pointer vers localhost/127.0.0.1 ;
- chaque session utilise une base `jobtracker_test_<random>` supprimée à la fin.

Sans MONGO_TEST_URL, ces tests sont ignorés (skip).
"""

import os
import sys
import uuid
from urllib.parse import urlsplit

import pytest

# Environnement de test EXPLICITE : un secret absent ou faible y est remplacé par un
# secret éphémère aléatoire (jamais une valeur fixe). Doit précéder tout import de config.
os.environ.setdefault("APP_ENV", "test")

# Rendre importables les modules du backend (models, services, routes, utils)
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

MONGO_TEST_URL = os.environ.get("MONGO_TEST_URL")
SAFE_HOSTS = {"localhost", "127.0.0.1"}


def _assert_safe_test_url(url: str) -> None:
    host = urlsplit(url).hostname
    if host not in SAFE_HOSTS:
        pytest.exit(f"MONGO_TEST_URL doit pointer vers une base locale jetable (reçu: {host})", returncode=2)


@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"


@pytest.fixture(scope="session")
def mongo_test_db_name():
    if not MONGO_TEST_URL:
        pytest.skip("MONGO_TEST_URL non défini : lancer tests/run_mongo_tests.sh")
    _assert_safe_test_url(MONGO_TEST_URL)

    name = f"jobtracker_test_{uuid.uuid4().hex[:10]}"
    yield name

    # Nettoyage final : suppression de la base de test
    from pymongo import MongoClient
    client = MongoClient(MONGO_TEST_URL, serverSelectionTimeoutMS=3000)
    try:
        client.drop_database(name)
    finally:
        client.close()


@pytest.fixture
async def db(mongo_test_db_name):
    """Base de test vidée après chaque test (les index sont conservés)."""
    from motor.motor_asyncio import AsyncIOMotorClient

    client = AsyncIOMotorClient(MONGO_TEST_URL, serverSelectionTimeoutMS=3000)
    database = client[mongo_test_db_name]
    try:
        yield database
    finally:
        for name in await database.list_collection_names():
            await database[name].delete_many({})
        client.close()


@pytest.fixture
async def api(db):
    """Client HTTP sur l'app FastAPI réelle (ASGI en mémoire), base de test injectée.
    Deux utilisateurs a/b ; api.headers_for(name, source=None) fournit un vrai JWT."""
    import httpx
    import server
    from utils.auth import create_access_token

    previous = (server.client, server.db)
    server.client, server.db = db.client, db

    users = {}
    for name in ("a", "b"):
        user_id = f"user-{name}-{uuid.uuid4().hex[:6]}"
        await db.users.insert_one({
            "id": user_id, "email": f"{user_id}@test.local", "full_name": name,
            "is_active": True, "role": "standard",
        })
        users[name] = user_id

    def headers(name, source=None):
        claims = {"sub": users[name]}
        if source:
            claims["source"] = source
        return {"Authorization": f"Bearer {create_access_token(claims)}"}

    transport = httpx.ASGITransport(app=server.app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        client.users = users
        client.headers_for = headers
        yield client

    server.client, server.db = previous
