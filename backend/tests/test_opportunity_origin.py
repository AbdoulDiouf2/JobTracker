"""
Provenance des opportunités de la veille MCP : nom du client OAuth VÉRIFIÉ.
MongoDB éphémère, application FastAPI réelle. Aucune donnée réelle.

- création : `watch.client_id` (grant) et copie `watch.client_name` (registre OAuth) ;
- lecture (API de l'interface) : nom ACTUEL du client, même désactivé ; copie si le client a
  disparu ; offres antérieures inchangées ;
- jamais un nom ou un client_id fourni par l'appelant ; réponses MCP inchangées ;
- source, déduplication et quotas inchangés.
"""

import json

import pytest

from config import settings
from services import oauth_service as svc
from utils import mcp_transport
from test_oauth import HOST, ISSUER, enable_watch
from test_p1_multiclient import CHATGPT_REDIRECT, connect, offer, run_id, tool

pytestmark = pytest.mark.anyio

CLAUDE_REDIRECT = "https://claude.ai/api/mcp/auth_callback"


@pytest.fixture(autouse=True)
async def service_on(monkeypatch, db):
    monkeypatch.setattr(settings, "MCP_ENABLED", True)
    monkeypatch.setattr(settings, "MCP_ALLOWED_HOSTS", HOST)
    monkeypatch.setattr(settings, "OAUTH_ISSUER", ISSUER)
    monkeypatch.delenv("VERCEL_ENV", raising=False)
    from routes.oauth import limiter
    limiter.reset()
    mcp_transport.reset_for_tests()
    await svc.set_kill_switch(db, False, "tests")
    yield
    limiter.reset()


async def setup_clients(api, db):
    await enable_watch(db, api)
    chatgpt = await svc.create_client(db, "ChatGPT", [CHATGPT_REDIRECT])
    claude = await svc.create_client(db, "Claude", [CLAUDE_REDIRECT])
    return (chatgpt, await connect(api, db, chatgpt, CHATGPT_REDIRECT),
            claude, await connect(api, db, claude, CLAUDE_REDIRECT))


async def create(api, tokens, n):
    error, out = await tool(api, tokens["access_token"], "create_opportunities",
                            {"run_id": run_id(), "opportunities": [offer(n)]})
    assert error is False and out["results"][0]["status"] == "created", out
    return out


async def listed(api, who="a"):
    r = await api.get("/api/opportunities", headers=api.headers_for(who))
    assert r.status_code == 200
    return {i["id"]: i for i in r.json()["items"]}


async def test_each_opportunity_carries_its_verified_client(api, db):
    chatgpt, t_gpt, claude, t_claude = await setup_clients(api, db)
    by_claude = (await create(api, t_claude, 1))["results"][0]["opportunity_id"]
    by_gpt = (await create(api, t_gpt, 2))["results"][0]["opportunity_id"]

    stored = await db.opportunities.find_one({"id": by_claude})
    assert stored["source"] == "chatgpt_watch"  # inchangé (compatibilité Lot 2)
    assert stored["watch"]["client_id"] == claude["client_id"] and stored["watch"]["client_name"] == "Claude"

    items = await listed(api)
    assert items[by_claude]["watch"]["client_name"] == "Claude"
    assert items[by_gpt]["watch"]["client_name"] == "ChatGPT"
    assert items[by_gpt]["watch"]["client_id"] == chatgpt["client_id"]


async def test_single_read_update_and_ignore_return_the_client_name(api, db):
    _, _, _, t_claude = await setup_clients(api, db)
    opp = (await create(api, t_claude, 1))["results"][0]["opportunity_id"]
    h = api.headers_for("a")
    assert (await api.get(f"/api/opportunities/{opp}", headers=h)).json()["watch"]["client_name"] == "Claude"
    patched = await api.patch(f"/api/opportunities/{opp}", json={"location": "Lyon"}, headers=h)
    assert patched.status_code == 200 and patched.json()["watch"]["client_name"] == "Claude"
    ignored = await api.post(f"/api/opportunities/{opp}/ignore", headers=h)
    assert ignored.status_code == 200 and ignored.json()["watch"]["client_name"] == "Claude"


async def test_name_follows_the_registry_and_survives_deactivation_or_deletion(api, db):
    _, _, claude, t_claude = await setup_clients(api, db)
    opp = (await create(api, t_claude, 1))["results"][0]["opportunity_id"]
    # Client désactivé : toujours identifié
    await svc.deactivate_client(db, claude["client_id"])
    assert (await listed(api))[opp]["watch"]["client_name"] == "Claude"
    # Nom modifié dans le registre : le nom actuel fait foi
    await db.oauth_clients.update_one({"client_id": claude["client_id"]}, {"$set": {"name": "Claude Pro"}})
    assert (await listed(api))[opp]["watch"]["client_name"] == "Claude Pro"
    # Client supprimé du registre : la copie prise à la création est conservée
    await db.oauth_clients.delete_one({"client_id": claude["client_id"]})
    item = (await listed(api))[opp]
    assert item["watch"]["client_name"] == "Claude" and item["watch"]["client_id"] == claude["client_id"]
    stored = await db.opportunities.find_one({"id": opp})
    assert stored["watch"]["client_name"] == "Claude"  # aucune écriture à la lecture


async def test_opportunity_created_before_the_fix_resolves_from_the_registry(api, db):
    """Offre créée entre P1 et ce correctif : client_id sans copie du nom."""
    _, _, claude, t_claude = await setup_clients(api, db)
    opp = (await create(api, t_claude, 1))["results"][0]["opportunity_id"]
    await db.opportunities.update_one({"id": opp}, {"$unset": {"watch.client_name": ""}})
    assert (await listed(api))[opp]["watch"]["client_name"] == "Claude"
    # Et si ce client a disparu : identifiant conservé, nom inconnu (pas d'invention)
    await db.oauth_clients.delete_one({"client_id": claude["client_id"]})
    item = (await listed(api))[opp]
    assert item["watch"]["client_id"] == claude["client_id"] and item["watch"]["client_name"] is None


async def test_legacy_opportunities_without_client_are_untouched(api, db):
    _, t_gpt, _, _ = await setup_clients(api, db)
    opp = (await create(api, t_gpt, 1))["results"][0]["opportunity_id"]
    await db.opportunities.update_one({"id": opp}, {"$unset": {"watch.client_id": "", "watch.client_name": ""}})
    item = (await listed(api))[opp]
    assert item["source"] == "chatgpt_watch"
    assert item["watch"]["client_id"] is None and item["watch"]["client_name"] is None
    # Offre hors veille (Lot 1) : pas de sous-document watch
    r = await api.post("/api/opportunities", json={"title": "Manuel", "company": "X",
                                                     "url": "https://jobs.example-corp.fr/1"},
                       headers=api.headers_for("a"))
    assert r.status_code == 201
    assert (await listed(api))[r.json()["opportunity_id"]].get("watch") is None


async def test_caller_cannot_supply_the_client_name(api, db):
    _, t_gpt, _, _ = await setup_clients(api, db)
    error, out = await tool(api, t_gpt["access_token"], "create_opportunities",
                            {"run_id": run_id(), "opportunities": [{**offer(1), "client_name": "Usurpateur"}]})
    assert error is False and out["results"][0]["status"] == "rejected"
    error, out = await tool(api, t_gpt["access_token"], "create_opportunities",
                            {"run_id": run_id(), "client_name": "Usurpateur", "opportunities": [offer(2)]})
    assert error is True and out["error"]["code"] == "invalid_arguments"
    assert await db.opportunities.count_documents({"watch.client_name": "Usurpateur"}) == 0


async def test_mcp_responses_and_dedup_unchanged(api, db):
    _, t_gpt, _, t_claude = await setup_clients(api, db)
    out = await create(api, t_claude, 1)
    assert "client_name" not in json.dumps(out) and "client_id" not in json.dumps(out)
    _, recent = await tool(api, t_gpt["access_token"], "list_recent_opportunities", {})
    assert set(recent["items"][0]) == {"title", "company", "url", "status", "discovered_at"}
    # La même offre envoyée par l'autre client reste un doublon (même compte), sans coût
    _, dup = await tool(api, t_gpt["access_token"], "create_opportunities",
                        {"run_id": run_id(), "opportunities": [offer(1)]})
    assert dup["results"][0]["status"] == "duplicate"
    assert await db.opportunities.count_documents({}) == 1
    stored = await db.opportunities.find_one({})
    assert stored["watch"]["client_name"] == "Claude"  # la provenance d'origine est conservée


async def test_isolation_between_users(api, db):
    _, _, _, t_claude = await setup_clients(api, db)
    await create(api, t_claude, 1)
    assert await listed(api, "b") == {}


# ============================================
# Sous-lot A : provenance calculée par le serveur (`origin`)
# ============================================

async def test_origin_is_consistent_for_every_kind_of_opportunity(api, db):
    chatgpt, t_gpt, claude, t_claude = await setup_clients(api, db)
    by_claude = (await create(api, t_claude, 1))["results"][0]["opportunity_id"]
    by_gpt = (await create(api, t_gpt, 2))["results"][0]["opportunity_id"]
    legacy = (await create(api, t_gpt, 3))["results"][0]["opportunity_id"]
    await db.opportunities.update_one({"id": legacy}, {"$unset": {"watch.client_id": "", "watch.client_name": ""}})
    manual = (await api.post("/api/opportunities", json={"title": "M", "company": "X", "url": "https://jobs.example-corp.fr/m"},
                             headers=api.headers_for("a"))).json()["opportunity_id"]
    items = await listed(api)
    assert items[by_claude]["origin"] == {"kind": "client", "key": f"client:{claude['client_id']}",
                                          "client_id": claude["client_id"], "client_name": "Claude", "source": None}
    assert items[by_gpt]["origin"]["client_name"] == "ChatGPT"
    assert items[legacy]["origin"] == {"kind": "watch_legacy", "key": "watch_legacy",
                                       "client_id": None, "client_name": None, "source": None}
    assert items[manual]["origin"] == {"kind": "source", "key": "source:manual",
                                       "client_id": None, "client_name": None, "source": "manual"}
    # Détail, modification, ignorer : même provenance
    h = api.headers_for("a")
    assert (await api.get(f"/api/opportunities/{by_claude}", headers=h)).json()["origin"] == items[by_claude]["origin"]
    assert (await api.post(f"/api/opportunities/{by_claude}/ignore", headers=h)).json()["origin"]["client_name"] == "Claude"
    # Aucun secret ni haché OAuth exposé
    body = json.dumps(list(items.values()))
    assert "jt_ocs_" not in body and "secret" not in body


async def test_origin_for_deactivated_and_deleted_clients(api, db):
    _, _, claude, t_claude = await setup_clients(api, db)
    opp = (await create(api, t_claude, 1))["results"][0]["opportunity_id"]
    await svc.deactivate_client(db, claude["client_id"])
    assert (await listed(api))[opp]["origin"]["client_name"] == "Claude"
    await db.oauth_clients.delete_one({"client_id": claude["client_id"]})
    assert (await listed(api))[opp]["origin"]["client_name"] == "Claude"  # copie conservée
    await db.opportunities.update_one({"id": opp}, {"$unset": {"watch.client_name": ""}})
    origin = (await listed(api))[opp]["origin"]
    assert origin["kind"] == "client" and origin["client_id"] == claude["client_id"] and origin["client_name"] is None
