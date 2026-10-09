"""
Tests HORS LIGNE des appels aux SDK d'IA (openai, google-genai, groq) avec les versions
figées de requirements.txt (tests T-IA-1 à T-IA-4, avant le déploiement D1).

Aucun réseau, aucune clé réelle : chaque client du SDK est remplacé par un faux qui
  - vérifie les arguments contre la SIGNATURE RÉELLE de la méthode du SDK installé ;
  - renvoie une VRAIE réponse typée du SDK (ChatCompletion, GenerateContentResponse).
Toutes les variables de clé IA sont effacées (config.py charge backend/.env).

Les tests ne figent pas les noms de modèles Gemini (correctif Gemini 1.5 séparé).
"""

import ast
import inspect
import json
import os
import uuid
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

import google.genai
import groq
import openai
from google.genai import types as gtypes
from groq.types.chat import ChatCompletion as GroqChatCompletion
from openai.types.chat import ChatCompletion as OpenAIChatCompletion

pytestmark = pytest.mark.anyio

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AI_KEY_VARS = ("GROQ_API_KEY", "OPENAI_API_KEY", "EMERGENT_LLM_KEY", "GOOGLE_API_KEY",
               "GEMINI_API_KEY", "GOOGLE_AI_API_KEY")

# Signatures réelles des méthodes appelées par JobTracker (SDK figés, instanciés hors ligne)
REAL_OPENAI_CREATE = inspect.signature(openai.OpenAI(api_key="offline").chat.completions.create)
REAL_GROQ_CREATE = inspect.signature(groq.Groq(api_key="offline").chat.completions.create)
_real_genai = google.genai.Client(api_key="offline")
REAL_GENAI_GENERATE = inspect.signature(_real_genai.models.generate_content)


def chat_completion(cls, text):
    return cls.model_validate({
        "id": "offline", "object": "chat.completion", "created": 0, "model": "offline",
        "choices": [{"index": 0, "finish_reason": "stop", "message": {"role": "assistant", "content": text}}],
    })


def genai_response(text):
    if text is None:  # réponse vide (ex. blocage de sécurité) : .text vaut None
        return gtypes.GenerateContentResponse.model_validate({"candidates": []})
    return gtypes.GenerateContentResponse.model_validate(
        {"candidates": [{"content": {"role": "model", "parts": [{"text": text}]}}]})


class Recorder:
    def __init__(self):
        self.calls = []  # (fournisseur, api_key, kwargs)
        self.reply = "réponse IA"

    def last(self, provider):
        matching = [c for c in self.calls if c[0] == provider]
        assert matching, f"aucun appel {provider}"
        return matching[-1]


@pytest.fixture
def ai(monkeypatch):
    """Faux clients pour les trois SDK, clés d'environnement effacées."""
    for var in AI_KEY_VARS:
        monkeypatch.delenv(var, raising=False)
    rec = Recorder()

    def chat_client(provider, signature, response_cls):
        class FakeChatClient:
            def __init__(self, api_key=None, **kwargs):
                self.api_key = api_key

                def create(**call_kwargs):
                    signature.bind(**call_kwargs)  # échoue si un argument n'existe plus
                    rec.calls.append((provider, self.api_key, call_kwargs))
                    return chat_completion(response_cls, rec.reply)

                self.chat = SimpleNamespace(completions=SimpleNamespace(create=create))
        return FakeChatClient

    class FakeGenaiClient:
        def __init__(self, api_key=None, **kwargs):
            def generate_content(**call_kwargs):
                REAL_GENAI_GENERATE.bind(**call_kwargs)
                rec.calls.append(("google", api_key, call_kwargs))
                return genai_response(rec.reply)
            self.models = SimpleNamespace(generate_content=generate_content)

    fake_openai = chat_client("openai", REAL_OPENAI_CREATE, OpenAIChatCompletion)
    fake_groq = chat_client("groq", REAL_GROQ_CREATE, GroqChatCompletion)
    monkeypatch.setattr(openai, "OpenAI", fake_openai)
    monkeypatch.setattr(groq, "Groq", fake_groq)
    monkeypatch.setattr(google.genai, "Client", FakeGenaiClient)
    # Noms importés au niveau module dans routes/ai.py
    import routes.ai as ai_routes
    monkeypatch.setattr(ai_routes, "OpenAI", fake_openai, raising=False)
    monkeypatch.setattr(ai_routes, "Groq", fake_groq, raising=False)
    monkeypatch.setattr(ai_routes, "USE_EMERGENT", False)
    return rec


def assert_chat_messages(kwargs):
    assert isinstance(kwargs["model"], str) and kwargs["model"]
    roles = [m["role"] for m in kwargs["messages"]]
    assert roles and set(roles) <= {"system", "user"} and roles[-1] == "user"
    assert all(isinstance(m["content"], str) and m["content"] for m in kwargs["messages"])


# ============================================
# T-IA-1 : fonctions d'appel (routes/ai.py, routes/data_import.py)
# ============================================

async def test_call_openai(ai):
    from routes.ai import call_openai
    ai.reply = "Conseil OpenAI"
    assert await call_openai("sk-test", "gpt-4o-mini", "Système", "Question") == "Conseil OpenAI"
    provider, key, kwargs = ai.last("openai")
    assert key == "sk-test" and kwargs["model"] == "gpt-4o-mini"
    assert kwargs["messages"] == [{"role": "system", "content": "Système"}, {"role": "user", "content": "Question"}]


async def test_call_groq(ai):
    from routes.ai import call_groq
    ai.reply = "Conseil Groq"
    assert await call_groq("gsk-test", "llama-3.3-70b-versatile", "Système", "Question") == "Conseil Groq"
    _, key, kwargs = ai.last("groq")
    assert key == "gsk-test"
    assert_chat_messages(kwargs)


async def test_call_google(ai):
    from routes.ai import call_google
    ai.reply = "Conseil Gemini"
    assert await call_google("g-test", "un-modele-gemini", "Système", "Question") == "Conseil Gemini"
    _, key, kwargs = ai.last("google")
    assert key == "g-test" and kwargs["model"] == "un-modele-gemini"
    assert "Système" in kwargs["contents"] and "Question" in kwargs["contents"]


@pytest.mark.parametrize("provider", ["openai", "google", "groq"])
async def test_call_ai_dispatches(ai, provider):
    from routes.ai import call_ai
    ai.reply = f"via {provider}"
    assert await call_ai("k", provider, "modele", "S", "U") == f"via {provider}"
    assert ai.calls[-1][0] == provider


async def test_call_ai_unknown_provider(ai):
    from routes.ai import call_ai
    with pytest.raises(HTTPException) as e:
        await call_ai("k", "mistral", "m", "S", "U")
    assert e.value.status_code == 400 and ai.calls == []


@pytest.mark.parametrize("fn, provider", [
    ("analyze_cv_with_openai", "openai"),
    ("analyze_cv_with_google", "google"),
    ("analyze_cv_with_groq", "groq"),
])
async def test_cv_analysis_functions(ai, fn, provider):
    import routes.data_import as di
    ai.reply = '{"score": 70}'
    assert await getattr(di, fn)("cle", "Texte du CV", "contexte") == '{"score": 70}'
    _, key, kwargs = ai.last(provider)
    assert key == "cle" and isinstance(kwargs["model"], str) and kwargs["model"]
    if provider == "google":
        assert kwargs["model"].startswith("gemini-") and "Texte du CV" in kwargs["contents"]
    else:
        assert_chat_messages(kwargs)


async def test_groq_cv_analysis_uses_requested_model(ai):
    import routes.data_import as di
    await di.analyze_cv_with_groq("cle", "CV", "ctx", model="llama-3.1-8b-instant")
    assert ai.last("groq")[2]["model"] == "llama-3.1-8b-instant"


async def test_google_empty_response_returns_none(ai):
    """T-IA-2 : comportement du SDK figé sur une réponse vide (blocage de sécurité, etc.)."""
    from routes.ai import call_google
    ai.reply = None
    assert await call_google("k", "m", "S", "U") is None


# ============================================
# T-IA-1 et T-IA-2 : routes complètes (MongoDB éphémère)
# ============================================

async def make_application(db, user_id, **extra):
    app_id = str(uuid.uuid4())
    await db.applications.insert_one({
        "id": app_id, "user_id": user_id, "entreprise": "Orange", "poste": "Data Engineer",
        "description_poste": "Pipelines Spark et Airflow", "reponse": "pending",
        "date_candidature": datetime(2026, 9, 20, tzinfo=timezone.utc).isoformat(),
        "type_poste": "cdi", "lieu": "Paris", **extra,
    })
    return app_id


MATCH_JSON = {"score": 82, "summary": "Bon profil", "strengths": ["Spark"], "gaps": [],
              "recommendations": ["Airflow"], "keywords_matched": ["Spark"], "keywords_missing": []}
ENV_KEY = {"groq": "GROQ_API_KEY", "openai": "OPENAI_API_KEY", "google": "GOOGLE_API_KEY"}


@pytest.mark.parametrize("provider", ["groq", "openai", "google"])
async def test_matching_route_per_provider(api, db, ai, monkeypatch, provider):
    monkeypatch.setenv(ENV_KEY[provider], f"cle-{provider}")
    app_id = await make_application(db, api.users["a"])
    ai.reply = json.dumps(MATCH_JSON)
    r = await api.post(f"/api/applications/{app_id}/matching/calculate",
                       params={"cv_text": "Expérience Spark", "model_provider": provider},
                       headers=api.headers_for("a"))
    assert r.status_code == 200, r.text
    assert r.json()["score"] == 82 and r.json()["strengths"] == ["Spark"]
    _, key, kwargs = ai.last(provider)
    assert key == f"cle-{provider}"
    if provider == "google":
        assert "Pipelines Spark" in kwargs["contents"]
    else:
        assert kwargs["response_format"] == {"type": "json_object"}
        assert_chat_messages(kwargs)
    stored = await db.applications.find_one({"id": app_id})
    assert stored["match_score"] == 82


async def test_matching_route_accepts_fenced_json(api, db, ai, monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "k")
    app_id = await make_application(db, api.users["a"])
    ai.reply = "```json\n" + json.dumps(MATCH_JSON) + "\n```"
    r = await api.post(f"/api/applications/{app_id}/matching/calculate",
                       params={"cv_text": "CV"}, headers=api.headers_for("a"))
    assert r.status_code == 200 and r.json()["score"] == 82


@pytest.mark.parametrize("provider, reply", [("groq", "pas du JSON"), ("google", None)])
async def test_matching_route_bad_ai_output_is_a_clean_error(api, db, ai, monkeypatch, provider, reply):
    """T-IA-2 : JSON invalide ou réponse Gemini vide -> erreur 500 contrôlée, rien d'enregistré."""
    monkeypatch.setenv(ENV_KEY[provider], "k")
    app_id = await make_application(db, api.users["a"])
    ai.reply = reply
    r = await api.post(f"/api/applications/{app_id}/matching/calculate",
                       params={"cv_text": "CV", "model_provider": provider}, headers=api.headers_for("a"))
    assert r.status_code == 500 and r.json()["detail"].startswith("Erreur lors du calcul du matching")
    assert "match_score" not in await db.applications.find_one({"id": app_id})


async def test_followup_route_with_gemini(api, db, ai, monkeypatch):
    monkeypatch.setenv("GOOGLE_API_KEY", "cle-google")
    app_id = await make_application(db, api.users["a"])
    ai.reply = json.dumps({"subject": "Suivi de ma candidature", "body": "Bonjour, ..."})
    r = await api.post(f"/api/applications/{app_id}/followup/generate",
                       json={"application_id": app_id}, headers=api.headers_for("a"))
    assert r.status_code == 200
    assert r.json()["subject"] == "Suivi de ma candidature"
    assert ai.last("google")[1] == "cle-google"


@pytest.mark.parametrize("reply", [None, "pas du JSON"])
async def test_followup_route_falls_back_to_template(api, db, ai, monkeypatch, reply):
    """T-IA-2 : réponse vide ou invalide -> modèle de relance de secours (200)."""
    monkeypatch.setenv("GOOGLE_API_KEY", "k")
    app_id = await make_application(db, api.users["a"])
    ai.reply = reply
    r = await api.post(f"/api/applications/{app_id}/followup/generate",
                       json={"application_id": app_id}, headers=api.headers_for("a"))
    assert r.status_code == 200 and r.json()["subject"].startswith("Relance")


@pytest.fixture
def no_cloudinary(monkeypatch):
    import routes.documents as docs

    async def fake_upload(*args, **kwargs):
        return None
    monkeypatch.setattr(docs, "upload_cover_letter_to_cloudinary", fake_upload)


@pytest.mark.parametrize("provider", ["groq", "openai", "google"])
async def test_cover_letter_route_per_provider(api, db, ai, monkeypatch, no_cloudinary, provider):
    monkeypatch.setenv(ENV_KEY[provider], f"cle-{provider}")
    ai.reply = "Madame, Monsieur, je souhaite rejoindre votre équipe."
    r = await api.post("/api/documents/generate-cover-letter-ai",
                       params={"entreprise": "Orange", "poste": "Data Engineer"}, headers=api.headers_for("a"))
    assert r.status_code == 200, r.text
    assert r.json()["content"] == "Madame, Monsieur, je souhaite rejoindre votre équipe."
    _, key, kwargs = ai.last(provider)
    assert key == f"cle-{provider}"
    if provider != "google":
        assert_chat_messages(kwargs)
    saved = await db.generated_cover_letters.find_one({"user_id": api.users["a"]})
    assert saved["content"] == r.json()["content"]


# Correctif IA séparé (Doc/CORRECTIF-GEMINI-MODELES.patch) : présent si utils/ai_models.py existe.
# Sans lui, ce test documente le défaut (xfail strict) ; avec lui, il vérifie la correction.
GEMINI_FIX_APPLIED = os.path.exists(os.path.join(BACKEND_DIR, "utils", "ai_models.py"))


@pytest.mark.xfail(condition=not GEMINI_FIX_APPLIED, strict=True, reason=(
    "Défaut existant documenté (hors Lot 2) : une réponse Gemini vide produit une lettre "
    "enregistrée avec un contenu null et un statut 200. Corrigé par le correctif IA séparé."))
async def test_cover_letter_empty_gemini_response_should_not_save_empty_letter(api, db, ai, monkeypatch, no_cloudinary):
    monkeypatch.setenv("GOOGLE_API_KEY", "k")
    ai.reply = None
    r = await api.post("/api/documents/generate-cover-letter-ai",
                       params={"entreprise": "Orange", "poste": "Data Engineer"}, headers=api.headers_for("a"))
    assert r.status_code >= 400
    assert await db.generated_cover_letters.count_documents({}) == 0


# ============================================
# T-IA-3 : aucun client google-genai non référencé (fermé automatiquement en 2.x)
# ============================================

AI_FILES = ["routes/ai.py", "routes/data_import.py", "routes/documents.py", "routes/tracking.py",
            "routes/statistics.py"]


def _chained_genai_clients(path):
    tree = ast.parse(open(os.path.join(BACKEND_DIR, path), encoding="utf-8").read())
    parents = {child: node for node in ast.walk(tree) for child in ast.iter_child_nodes(node)}
    bad = []
    for node in ast.walk(tree):
        if (isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == "Client"
                and isinstance(node.func.value, ast.Name) and node.func.value.id == "genai"):
            if not isinstance(parents.get(node), (ast.Assign, ast.AnnAssign)):
                bad.append(node.lineno)
    return bad


@pytest.mark.parametrize("path", AI_FILES)
def test_genai_clients_are_always_assigned(path):
    assert _chained_genai_clients(path) == []


def test_chained_genai_client_detector_works(tmp_path):
    sample = tmp_path / "sample.py"
    sample.write_text("from google import genai\nr = genai.Client(api_key='x').models.generate_content(model='m', contents='c')\n")
    tree = ast.parse(sample.read_text())
    parents = {c: n for n in ast.walk(tree) for c in ast.iter_child_nodes(n)}
    calls = [n for n in ast.walk(tree) if isinstance(n, ast.Call) and getattr(n.func, "attr", "") == "Client"]
    assert calls and not isinstance(parents[calls[0]], ast.Assign)


# ============================================
# T-IA-4 : SDK figés instanciables hors ligne, interfaces utilisées présentes
# ============================================

def test_pinned_sdks_expose_the_interfaces_used():
    o, g, c = openai.OpenAI(api_key="x"), groq.Groq(api_key="x"), google.genai.Client(api_key="x")
    for sig in (inspect.signature(o.chat.completions.create), inspect.signature(g.chat.completions.create)):
        sig.bind(model="m", messages=[{"role": "user", "content": "c"}], response_format={"type": "json_object"})
    inspect.signature(c.models.generate_content).bind(model="m", contents="c")
    assert chat_completion(OpenAIChatCompletion, "t").choices[0].message.content == "t"
    assert chat_completion(GroqChatCompletion, "t").choices[0].message.content == "t"
    assert genai_response("t").text == "t" and genai_response(None).text is None


def test_pinned_sdk_versions_match_requirements():
    import importlib.metadata as md
    pins = {}
    for line in open(os.path.join(BACKEND_DIR, "requirements.txt"), encoding="utf-8"):
        line = line.split("#")[0].strip()
        if "==" in line:
            name, version = line.split("==", 1)
            pins[name.split("[")[0].strip().lower()] = version.strip()
    for name in ("openai", "google-genai", "groq"):
        assert md.version(name) == pins[name], f"{name} installé != figé"
