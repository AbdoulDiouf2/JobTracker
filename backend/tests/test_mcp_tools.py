"""
Lot 2 — Les cinq outils MCP métier, de bout en bout par HTTP (`/api/mcp`, transport réel,
jetons OAuth réels émis par le service, MongoDB éphémère). Aucun réseau, aucune donnée réelle.

Couvre : catalogue et annotations, scopes, isolation des comptes (user_id toujours issu du
grant), écritures, doublons (même exécution, autre exécution, offre déjà connue), rejeu,
quotas (exécution et jour), veille en pause, run_id invalide ou hors fenêtre, lecture
minimale, statut, rapport (dernier fait foi), rafale par grant, base indisponible,
journaux sans contenu d'offre, appels concurrents.
"""

import asyncio
import json
import logging
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import pytest
from pymongo.errors import ServerSelectionTimeoutError

from config import settings
from models.watch import WatchPreferencesUpdate
from services import mcp_tools, oauth_service as svc, watch_preferences_service
from utils import mcp_transport

pytestmark = pytest.mark.anyio

ISSUER = "https://jobtracker.maadec.com"
HOST = "jobtracker.maadec.com"
MCP_HEADERS = {"Accept": "application/json, text/event-stream", "Content-Type": "application/json", "Host": HOST}
BOTH = ("watch:read", "opportunities:write")
BUSINESS = ["get_watch_preferences", "create_opportunities", "list_recent_opportunities",
            "get_watch_status", "report_watch_run"]


@pytest.fixture(autouse=True)
async def mcp_on(monkeypatch, db):
    monkeypatch.setattr(settings, "MCP_ENABLED", True)
    monkeypatch.setattr(settings, "MCP_ALLOWED_HOSTS", HOST)
    monkeypatch.setattr(settings, "OAUTH_ISSUER", ISSUER)
    monkeypatch.delenv("VERCEL_ENV", raising=False)
    mcp_transport.reset_for_tests()
    await svc.set_kill_switch(db, False, "tests")
    yield
    mcp_transport.reset_for_tests()


async def owner(db, scopes=BOTH, watch_enabled=True) -> dict:
    """Compte éligible + client actif + grant + jeton d'accès réel (service OAuth)."""
    user_id = "owner-" + uuid.uuid4().hex[:8]
    await db.users.insert_one({"id": user_id, "email": f"{user_id}@test.local", "is_active": True,
                               "role": "standard", "watch_enabled": watch_enabled})
    client = await svc.create_client(db, "ChatGPT", [svc.CHATGPT_DEFAULT_REDIRECT])
    now = datetime.now(timezone.utc)
    grant = {"id": str(uuid.uuid4()), "user_id": user_id, "client_id": client["client_id"], "scopes": list(scopes),
             "resource": svc.canonical_resource(), "status": "active", "created_at": now,
             "absolute_expires_at": now + timedelta(days=90)}
    await db[svc.GRANTS].insert_one(dict(grant))
    tokens = await svc._issue_tokens(db, grant)
    return {"user_id": user_id, "token": tokens["access_token"], "grant_id": grant["id"]}


def run_id(kind="manuel", minutes_ago=0) -> str:
    now = datetime.now(ZoneInfo("Europe/Paris")) - timedelta(minutes=minutes_ago)
    suffix = "prog" if kind == "prog" else "manuel-" + secrets.token_hex(3)
    return f"veille-{now:%Y%m%d}-{now:%H%M}-{suffix}"


def offer(n=1, **over) -> dict:
    item = {"title": f"Data Engineer Junior {n}", "company": "Orange", "url": f"https://careers.orange.com/jobs/{n}",
            "country": "FR", "location": "Paris", "contract_type": "CDI", "seniority": "junior",
            "description": f"Pipelines Spark {n}", "relevance_score": 86, "relevance_reasons": ["CDI à Paris"]}
    item.update(over)
    return item


async def rpc(api, token, method, params=None):
    return await api.post("/api/mcp", json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params or {}},
                          headers={**MCP_HEADERS, "Authorization": f"Bearer {token}"})


async def call(api, who, name, arguments=None):
    """Appel d'outil ; renvoie (is_error, contenu JSON). Échoue si la réponse n'est pas HTTP 200."""
    r = await rpc(api, who["token"], "tools/call", {"name": name, "arguments": arguments or {}})
    assert r.status_code == 200, r.text
    result = r.json()["result"]
    content = json.loads(result["content"][0]["text"])
    if not result["isError"]:
        assert result["structuredContent"] == content
    return result["isError"], content


async def create(api, who, items, rid=None):
    error, out = await call(api, who, "create_opportunities", {"run_id": rid or run_id(), "opportunities": items})
    assert error is False, out
    return out


# ============================================
# Catalogue
# ============================================

async def test_catalogue_annotations_and_schemas(api, db):
    who = await owner(db)
    tools = {t["name"]: t for t in (await rpc(api, who["token"], "tools/list")).json()["result"]["tools"]}
    assert list(tools) == ["jobtracker_ping"] + BUSINESS
    for name in ("get_watch_preferences", "list_recent_opportunities", "get_watch_status"):
        assert tools[name]["annotations"]["readOnlyHint"] is True
    for name in ("create_opportunities", "report_watch_run"):
        assert tools[name]["annotations"]["readOnlyHint"] is False
        assert tools[name]["annotations"]["destructiveHint"] is False
    for name in BUSINESS:
        schema = tools[name]["inputSchema"]
        assert schema["additionalProperties"] is False and "user_id" not in json.dumps(schema)
    item = tools["create_opportunities"]["inputSchema"]["properties"]["opportunities"]
    assert item["maxItems"] == 20 and item["items"]["additionalProperties"] is False
    # Le diagnostic est conservé
    error, out = await call(api, who, "jobtracker_ping")
    assert error is False and out["authenticated"] is True


# ============================================
# get_watch_preferences / get_watch_status / list_recent_opportunities
# ============================================

async def test_get_watch_preferences(api, db):
    who = await owner(db)
    error, prefs = await call(api, who, "get_watch_preferences")
    assert error is False
    assert prefs["active"] is True and prefs["preferences_version"] == 1
    assert prefs["schedule"] == {"timezone": "Europe/Paris", "times": ["08:00", "18:00"]}
    assert prefs["min_score"] == 75 and "FR" in prefs["countries"] and "user_id" not in prefs
    error, out = await call(api, who, "get_watch_preferences", {"verbose": True})
    assert error is True and out["error"]["code"] == "invalid_arguments"


async def test_get_watch_status_reflects_creations(api, db):
    who = await owner(db)
    error, before = await call(api, who, "get_watch_status")
    assert error is False and before["service"] == "ok" and before["active"] is True
    assert before["remaining_today"] == settings.WATCH_DAILY_CREATE_QUOTA and before["last_run"] is None
    rid = run_id()
    await create(api, who, [offer(1), offer(2)], rid)
    _, after = await call(api, who, "get_watch_status")
    assert after["remaining_today"] == before["remaining_today"] - 2
    assert after["last_run"]["run_id"] == rid and after["last_run"]["observed"]["created"] == 2


async def test_list_recent_is_minimal_and_validated(api, db):
    who = await owner(db)
    await create(api, who, [offer(1), offer(2)])
    error, out = await call(api, who, "list_recent_opportunities", {"days": 7, "limit": 1})
    assert error is False and out["total"] == 2 and len(out["items"]) == 1
    assert set(out["items"][0]) == {"title", "company", "url", "status", "discovered_at"}
    assert out["items"][0]["status"] == "new" and "Pipelines" not in json.dumps(out)
    # Fenêtre `days` : une offre découverte il y a 30 jours n'apparaît qu'avec days >= 30
    from models import OpportunityCreate
    from services import opportunity_service
    await opportunity_service.ingest_opportunity(db, who["user_id"], OpportunityCreate(
        title="Ancienne", company="Y", url="https://jobs.example-corp.fr/old",
        discovered_at=datetime.now(timezone.utc) - timedelta(days=30)))
    _, recent = await call(api, who, "list_recent_opportunities", {"days": 14})
    assert recent["total"] == 2 and "Ancienne" not in json.dumps(recent)
    _, wide = await call(api, who, "list_recent_opportunities", {"days": 60})
    assert wide["total"] == 3 and wide["items"][-1]["title"] == "Ancienne"
    for bad in ({"days": 0}, {"days": 61}, {"limit": 101}, {"limit": "5"}, {"other": 1}):
        error, out = await call(api, who, "list_recent_opportunities", bad)
        assert error is True and out["error"]["code"] == "invalid_arguments"
        assert all(set(d) == {"loc", "type"} for d in out["error"]["details"])  # aucun écho des valeurs


# ============================================
# create_opportunities : écritures et règles
# ============================================

async def test_create_writes_new_opportunities_for_the_grant_owner(api, db):
    who = await owner(db)
    rid = run_id()
    out = await create(api, who, [offer(1), offer(2, relevance_score=40), offer(3, country="US")], rid)
    assert out["summary"] == {"received": 3, "replayed": 0, "created": 1, "duplicate": 0, "rejected": 2, "error": 0}
    assert [r["status"] for r in out["results"]] == ["created", "rejected", "rejected"]
    assert out["results"][1]["reasons"] == ["score_below_threshold"]
    assert out["results"][2]["reasons"] == ["country_not_targeted"]
    assert out["run_totals"]["remaining_for_run"] == 19

    [doc] = await db.opportunities.find({}).to_list(10)
    assert doc["user_id"] == who["user_id"] and doc["source"] == "chatgpt_watch" and doc["status"] == "new"
    assert doc["id"] == out["results"][0]["opportunity_id"]
    assert doc["watch"]["run_id"] == rid and doc["watch"]["relevance_score"] == 86


async def test_user_id_or_source_are_refused(api, db):
    who = await owner(db)
    other = await owner(db)
    error, out = await call(api, who, "create_opportunities",
                            {"run_id": run_id(), "user_id": other["user_id"], "opportunities": [offer(1)]})
    assert error is True and out["error"]["code"] == "invalid_arguments"
    out = await create(api, who, [offer(1, user_id=other["user_id"]), offer(2, source="manual")])
    assert [r["status"] for r in out["results"]] == ["rejected", "rejected"]
    assert await db.opportunities.count_documents({}) == 0


async def test_replay_same_call_writes_nothing(api, db):
    who = await owner(db)
    rid = run_id()
    first = await create(api, who, [offer(1), offer(2)], rid)
    for _ in range(3):
        again = await create(api, who, [offer(1), offer(2)], rid)
        assert again["summary"]["replayed"] == 2 and again["summary"]["created"] == 2
        assert [r["opportunity_id"] for r in again["results"]] == [r["opportunity_id"] for r in first["results"]]
        assert again["run_totals"]["remaining_for_run"] == first["run_totals"]["remaining_for_run"]
    assert await db.opportunities.count_documents({}) == 2
    _, status = await call(api, who, "get_watch_status")
    assert status["remaining_today"] == settings.WATCH_DAILY_CREATE_QUOTA - 2


async def test_duplicates_across_runs_and_existing_offers_cost_nothing(api, db):
    who = await owner(db)
    await create(api, who, [offer(1)])
    # Offre déjà connue par une autre voie (ajout manuel, Lot 1), URL avec traqueur
    from models import OpportunityCreate
    from services import opportunity_service
    await opportunity_service.ingest_opportunity(
        db, who["user_id"], OpportunityCreate(title="Déjà vue", company="X", url="https://careers.orange.com/jobs/9"))
    out = await create(api, who, [offer(1), offer(9, url="https://careers.orange.com/jobs/9?utm_source=x"), offer(3)])
    assert [r["status"] for r in out["results"]] == ["duplicate", "duplicate", "created"]
    assert out["results"][0]["duplicate_reason"] == "url"
    assert await db.opportunities.count_documents({}) == 3
    _, status = await call(api, who, "get_watch_status")
    assert status["remaining_today"] == settings.WATCH_DAILY_CREATE_QUOTA - 2  # les doublons ne coûtent rien
    # Même offre deux fois dans un envoi : une seule opportunité, la seconde rejoue la première
    out = await create(api, who, [offer(4), offer(4)])
    assert out["results"][0]["status"] == "created"
    assert out["results"][1]["opportunity_id"] == out["results"][0]["opportunity_id"]
    assert await db.opportunities.count_documents({"url": "https://careers.orange.com/jobs/4"}) == 1


async def test_concurrent_identical_calls_create_once(api, db):
    who = await owner(db)
    rid = run_id()
    outs = await asyncio.gather(*[call(api, who, "create_opportunities", {"run_id": rid, "opportunities": [offer(1)]})
                                  for _ in range(4)])
    assert all(error is False for error, _ in outs)
    assert await db.opportunities.count_documents({}) == 1
    statuses = {o["results"][0]["status"] for _, o in outs}
    assert statuses <= {"created", "duplicate", "error"} and "created" in statuses


async def test_run_and_daily_quotas(api, db, monkeypatch):
    who = await owner(db)
    prefs = await watch_preferences_service.get_or_create(db, who["user_id"])
    fields = {k: v for k, v in prefs.model_dump().items() if k not in ("preferences_version", "updated_at")}
    await watch_preferences_service.update(
        db, who["user_id"], WatchPreferencesUpdate(**{**fields, "max_per_run": 2, "expected_version": 1}))
    out = await create(api, who, [offer(1), offer(2), offer(3)])
    assert [r["status"] for r in out["results"]] == ["created", "created", "rejected"]
    assert out["results"][2]["reasons"] == ["run_limit_reached"]

    monkeypatch.setattr(settings, "WATCH_DAILY_CREATE_QUOTA", 3)
    out = await create(api, who, [offer(4), offer(5)])
    assert [r["status"] for r in out["results"]] == ["created", "rejected"]
    assert out["results"][1]["reasons"] == ["daily_quota_reached"]
    assert out["run_totals"]["remaining_today"] == 0
    assert await db.opportunities.count_documents({}) == 3


async def test_paused_watch_rejects_everything(api, db):
    who = await owner(db)
    prefs = await watch_preferences_service.get_or_create(db, who["user_id"])
    fields = {k: v for k, v in prefs.model_dump().items() if k not in ("preferences_version", "updated_at")}
    await watch_preferences_service.update(
        db, who["user_id"], WatchPreferencesUpdate(**{**fields, "active": False, "expected_version": 1}))
    out = await create(api, who, [offer(1), offer(2)])
    assert all(r["status"] == "rejected" and r["reasons"] == ["watch_paused"] for r in out["results"])
    assert await db.opportunities.count_documents({}) == 0


@pytest.mark.parametrize("rid, code", [
    (str(uuid.uuid4()), "invalid_run_id"),
    ("veille-20261009-0800", "invalid_run_id"),
    ("veille-20200101-0800-prog", "run_id_out_of_window"),
])
async def test_bad_run_id_is_refused_without_writing(api, db, rid, code):
    who = await owner(db)
    error, out = await call(api, who, "create_opportunities", {"run_id": rid, "opportunities": [offer(1)]})
    assert error is True and out["error"]["code"] == code
    assert rid not in json.dumps(out)
    assert await db.opportunities.count_documents({}) == 0 and await db.watch_runs.count_documents({}) == 0


@pytest.mark.parametrize("args", [{"run_id": run_id(), "opportunities": []},
                                  {"run_id": run_id(), "opportunities": [offer(i) for i in range(21)]},
                                  {"opportunities": [offer(1)]}])
async def test_invalid_envelope(api, db, args):
    who = await owner(db)
    error, out = await call(api, who, "create_opportunities", args)
    assert error is True and out["error"]["code"] == "invalid_arguments"
    assert await db.opportunities.count_documents({}) == 0


# ============================================
# report_watch_run
# ============================================

async def test_report_last_one_wins_with_observed_counts(api, db):
    who = await owner(db)
    rid = run_id()
    await create(api, who, [offer(1), offer(2, relevance_score=10)], rid)
    error, out = await call(api, who, "report_watch_run", {"run_id": rid, "status": "partial", "sent": 2})
    assert error is False and out["recorded"] is True
    assert out["observed"] == {"created": 1, "duplicate": 0, "rejected": 1, "error": 0}
    error, out = await call(api, who, "report_watch_run",
                            {"run_id": rid, "status": "completed", "sent": 2, "notes": "Fin."})
    assert error is False
    run = await db.watch_runs.find_one({"user_id": who["user_id"], "public_run_id": rid})
    assert run["report"]["status"] == "completed" and run["report_count"] == 2
    assert await db.opportunities.count_documents({}) == 1  # un rapport n'écrit aucune offre


async def test_report_without_offers_and_invalid_report(api, db):
    who = await owner(db)
    error, out = await call(api, who, "report_watch_run", {"run_id": run_id(), "status": "failed", "notes": "Erreur."})
    assert error is False and out["observed"]["created"] == 0
    for bad in ({"run_id": run_id(), "status": "done"}, {"run_id": run_id(), "status": "completed", "notes": "x" * 501},
                {"status": "completed"}):
        error, out = await call(api, who, "report_watch_run", bad)
        assert error is True and out["error"]["code"] == "invalid_arguments"


# ============================================
# Accès : scopes, isolation, éligibilité, rafale
# ============================================

@pytest.mark.parametrize("granted, tool, allowed", [
    (("watch:read",), "get_watch_preferences", True),
    (("watch:read",), "list_recent_opportunities", True),
    (("watch:read",), "get_watch_status", True),
    (("watch:read",), "create_opportunities", False),
    (("watch:read",), "report_watch_run", False),
    (("opportunities:write",), "get_watch_preferences", False),
    (("opportunities:write",), "report_watch_run", True),
])
async def test_scopes(api, db, granted, tool, allowed):
    who = await owner(db, scopes=granted)
    args = {"run_id": run_id(), "status": "completed"} if tool == "report_watch_run" else {}
    r = await rpc(api, who["token"], "tools/call", {"name": tool, "arguments": args})
    if allowed:
        assert r.status_code == 200 and r.json()["result"]["isError"] is False
    else:
        assert r.status_code == 403 and r.json()["error"] == "insufficient_scope"
        assert 'error="insufficient_scope"' in r.headers["www-authenticate"]
    assert await db.opportunities.count_documents({}) == 0


async def test_scope_rechecked_at_tool_level(api, db, monkeypatch):
    """Défense en profondeur : si le contrôle du transport était contourné, l'outil refuse."""
    monkeypatch.setattr(mcp_transport, "_missing_scope", lambda body, granted: None)
    who = await owner(db, scopes=("watch:read",))
    error, out = await call(api, who, "create_opportunities", {"run_id": run_id(), "opportunities": [offer(1)]})
    assert error is True and out["error"] == {"code": "insufficient_scope", "scope": "opportunities:write"}
    assert await db.opportunities.count_documents({}) == 0


async def test_accounts_are_isolated(api, db):
    a = await owner(db)
    b = await owner(db)
    await create(api, a, [offer(1), offer(2)])
    _, recent_b = await call(api, b, "list_recent_opportunities")
    assert recent_b == {"items": [], "total": 0, "days": 14}
    _, status_b = await call(api, b, "get_watch_status")
    assert status_b["remaining_today"] == settings.WATCH_DAILY_CREATE_QUOTA and status_b["last_run"] is None
    # La même offre chez B : création distincte, rien ne fuit ni ne se mélange
    out = await create(api, b, [offer(1)])
    assert out["results"][0]["status"] == "created"
    assert await db.opportunities.count_documents({"user_id": a["user_id"]}) == 2
    assert await db.opportunities.count_documents({"user_id": b["user_id"]}) == 1


async def test_owner_no_longer_eligible_is_refused(api, db):
    who = await owner(db)
    await db.users.update_one({"id": who["user_id"]}, {"$set": {"watch_enabled": False}})
    r = await rpc(api, who["token"], "tools/call", {"name": "create_opportunities",
                                                  "arguments": {"run_id": run_id(), "opportunities": [offer(1)]}})
    assert r.status_code == 401
    assert await db.opportunities.count_documents({}) == 0


async def test_watch_not_enabled_in_service_layer(db):
    """Défense en profondeur : le service refuse même si l'appel l'atteignait."""
    payload, is_error = await mcp_tools.call_tool(db, "inconnu", "get_watch_preferences", {})
    assert is_error and payload == {"error": {"code": "watch_not_enabled"}}


async def test_kill_switch_cuts_tools(api, db):
    who = await owner(db)
    await svc.set_kill_switch(db, True, "tests")
    r = await rpc(api, who["token"], "tools/call", {"name": "get_watch_status", "arguments": {}})
    assert r.status_code == 503


async def test_rate_limit_per_grant(api, db, monkeypatch):
    monkeypatch.setattr(settings, "MCP_RATE_LIMIT_PER_MINUTE", 5)
    a = await owner(db)
    b = await owner(db)
    for _ in range(5):
        assert (await rpc(api, a["token"], "tools/list")).status_code == 200
    limited = await rpc(api, a["token"], "tools/list")
    assert limited.status_code == 429 and int(limited.headers["retry-after"]) >= 1
    assert (await rpc(api, b["token"], "tools/list")).status_code == 200  # autre connexion non affectée


# ============================================
# Robustesse et journaux
# ============================================

async def test_database_unavailable_is_retryable(db, monkeypatch):
    who = await owner(db)

    async def broken(*args, **kwargs):
        raise ServerSelectionTimeoutError("down")
    monkeypatch.setattr(watch_preferences_service, "get_or_create", broken)
    payload, is_error = await mcp_tools.call_tool(db, who["user_id"], "get_watch_preferences", {})
    assert is_error and payload == {"error": {"code": "temporarily_unavailable", "retryable": True}}


async def test_logs_never_contain_offer_content_or_token(api, db, caplog):
    # Niveau de production (INFO) pour tout, DEBUG pour les journaux de l'application
    caplog.set_level(logging.INFO)
    caplog.set_level(logging.DEBUG, logger="jobtracker")
    who = await owner(db)
    await create(api, who, [offer(1, title="Titre-Confidentiel", description="Desc-Confidentielle")])
    text = caplog.text
    assert "Titre-Confidentiel" not in text and "Desc-Confidentielle" not in text
    assert "careers.orange.com/jobs/1" not in text and who["token"] not in text
    assert "mcp_tool name=create_opportunities" in text
