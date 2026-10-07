"""
Lot 1 Opportunités — scénario métier de bout en bout (HTTP, MongoDB éphémère).

Agent externe -> POST /api/agent/opportunities -> Opportunity:new -> conversion
-> Application:to_apply (hors métriques) -> envoi réel (pending + date explicite)
-> entrée dans les métriques. Plus : ignored -> candidater plus tard, converted ->
même candidature, et isolation complète entre deux utilisateurs.
"""

import uuid

import pytest

pytestmark = pytest.mark.anyio

AGENT_URL = "/api/agent/opportunities"


def bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def offer(**overrides) -> dict:
    data = {
        "title": "Data Engineer Junior",
        "company": "Orange",
        "url": f"https://careers.orange.com/jobs/{uuid.uuid4().hex[:8]}?utm_source=veille",
        "location": "Paris",
        "country": "France",
        "contract_type": "CDI",
        "description": "Pipelines Spark / Airflow.",
        "source": "chatgpt_watch",
        "external_id": f"ext-{uuid.uuid4().hex[:6]}",
    }
    data.update(overrides)
    return data


async def dashboard(api, who="a") -> dict:
    r = await api.get("/api/statistics/dashboard", headers=api.headers_for(who))
    assert r.status_code == 200
    return r.json()


async def test_full_business_workflow(api, db):
    # 1-2. Utilisateur (fixture) + token agent
    r = await api.post("/api/agent-tokens", json={"name": "ChatGPT Watch"}, headers=api.headers_for("a"))
    assert r.status_code == 201
    agent_token = r.json()["token"]

    stats_initial = await dashboard(api)

    # 3. Ingestion via token
    payload = offer()
    r = await api.post(AGENT_URL, json=payload, headers=bearer(agent_token))
    assert r.status_code == 201 and r.json()["created"] is True
    opportunity_id = r.json()["opportunity_id"]

    # 4. Compteur
    assert (await api.get("/api/opportunities/count", headers=api.headers_for("a"))).json() == {"new": 1}

    # 5. Lecture via JWT
    r = await api.get(f"/api/opportunities/{opportunity_id}", headers=api.headers_for("a"))
    assert r.status_code == 200
    assert r.json()["status"] == "new" and r.json()["source"] == "chatgpt_watch"

    # 6. Conversion
    r = await api.post(f"/api/opportunities/{opportunity_id}/convert", headers=api.headers_for("a"))
    assert r.status_code == 200 and r.json()["created"] is True
    application_id = r.json()["application_id"]
    assert (await api.get("/api/opportunities/count", headers=api.headers_for("a"))).json() == {"new": 0}

    # 7. Application to_apply
    app = (await api.get(f"/api/applications/{application_id}", headers=api.headers_for("a"))).json()
    assert app["reponse"] == "to_apply"
    assert app["poste"] == "Data Engineer Junior" and app["lieu"] == "Paris, France"

    # 8. Statistiques inchangées (to_apply hors métriques)
    assert await dashboard(api) == stats_initial

    # 9. Envoi réel : pending + date explicite (sans date -> 422, garde-fou)
    r = await api.put(f"/api/applications/{application_id}", json={"reponse": "pending"}, headers=api.headers_for("a"))
    assert r.status_code == 422
    r = await api.put(
        f"/api/applications/{application_id}",
        json={"reponse": "pending", "date_candidature": "2026-10-06T12:00:00+00:00"},
        headers=api.headers_for("a"),
    )
    assert r.status_code == 200
    assert r.json()["reponse"] == "pending"
    assert r.json()["date_candidature"].startswith("2026-10-06T12:00:00")

    # 10. Elle entre dans les métriques
    stats_after = await dashboard(api)
    assert stats_after["total_applications"] == stats_initial["total_applications"] + 1
    assert stats_after["pending"] == stats_initial["pending"] + 1

    # 11-12. Réenvoi de la même offre (URL avec tracking différent) : aucune duplication
    resend = {**payload, "url": payload["url"].replace("utm_source=veille", "utm_source=autre")}
    r = await api.post(AGENT_URL, json=resend, headers=bearer(agent_token))
    assert r.status_code == 200 and r.json()["duplicate"] is True and r.json()["opportunity_id"] == opportunity_id
    assert await db.opportunities.count_documents({"user_id": api.users["a"]}) == 1
    assert await db.applications.count_documents({"user_id": api.users["a"]}) == 1
    # L'opportunité reste convertie (pas réinitialisée par le réenvoi)
    opp = (await api.get(f"/api/opportunities/{opportunity_id}", headers=api.headers_for("a"))).json()
    assert opp["status"] == "converted" and opp["converted_application_id"] == application_id
    # Quota : 1 seule création consommée
    from services.agent_token_service import get_creations_today
    token_id = (await api.get("/api/agent-tokens", headers=api.headers_for("a"))).json()[0]["id"]
    assert await get_creations_today(db, token_id) == 1


async def test_ignored_then_apply_later(api, db):
    r = await api.post("/api/opportunities", json=offer(), headers=api.headers_for("a"))
    opportunity_id = r.json()["opportunity_id"]

    r = await api.post(f"/api/opportunities/{opportunity_id}/ignore", headers=api.headers_for("a"))
    assert r.json()["status"] == "ignored"
    assert (await api.get("/api/opportunities", params={"status": "new"}, headers=api.headers_for("a"))).json()["total"] == 0

    r = await api.post(f"/api/opportunities/{opportunity_id}/convert", headers=api.headers_for("a"))
    assert r.status_code == 200 and r.json()["created"] is True
    opp = (await api.get(f"/api/opportunities/{opportunity_id}", headers=api.headers_for("a"))).json()
    assert opp["status"] == "converted"


async def test_converted_view_application_never_duplicates(api, db):
    opportunity_id = (await api.post("/api/opportunities", json=offer(), headers=api.headers_for("a"))).json()["opportunity_id"]
    first = (await api.post(f"/api/opportunities/{opportunity_id}/convert", headers=api.headers_for("a"))).json()

    # « Voir candidature » = converted_application_id ; reconvertir renvoie la même
    opp = (await api.get(f"/api/opportunities/{opportunity_id}", headers=api.headers_for("a"))).json()
    again = (await api.post(f"/api/opportunities/{opportunity_id}/convert", headers=api.headers_for("a"))).json()
    assert opp["converted_application_id"] == first["application_id"] == again["application_id"]
    assert again["created"] is False
    assert await db.applications.count_documents({"user_id": api.users["a"]}) == 1


async def test_two_users_full_isolation(api, db):
    # Données de B : une opportunité + un token
    token_b = (await api.post("/api/agent-tokens", json={"name": "B"}, headers=api.headers_for("b"))).json()
    opp_b = (await api.post(AGENT_URL, json=offer(), headers=bearer(token_b["token"]))).json()["opportunity_id"]
    token_a = (await api.post("/api/agent-tokens", json={"name": "A"}, headers=api.headers_for("a"))).json()

    a = api.headers_for("a")
    # A ne peut ni lire, ni modifier, ni ignorer, ni convertir l'opportunité de B
    assert (await api.get(f"/api/opportunities/{opp_b}", headers=a)).status_code == 404
    assert (await api.patch(f"/api/opportunities/{opp_b}", json={"title": "x"}, headers=a)).status_code == 404
    assert (await api.post(f"/api/opportunities/{opp_b}/ignore", headers=a)).status_code == 404
    assert (await api.post(f"/api/opportunities/{opp_b}/convert", headers=a)).status_code == 404
    assert (await api.get("/api/opportunities", headers=a)).json()["total"] == 0
    assert (await api.get("/api/opportunities/count", headers=a)).json() == {"new": 0}

    # A ne voit ni ne révoque le token de B
    assert token_b["id"] not in [t["id"] for t in (await api.get("/api/agent-tokens", headers=a)).json()]
    assert (await api.delete(f"/api/agent-tokens/{token_b['id']}", headers=a)).status_code == 404

    # Le token de A n'écrit jamais chez B, même en injectant user_id
    r = await api.post(AGENT_URL, json={**offer(), "user_id": api.users["b"]}, headers=bearer(token_a["token"]))
    assert r.status_code == 422
    r = await api.post(AGENT_URL, json=offer(), headers=bearer(token_a["token"]))
    assert r.status_code == 201
    assert await db.opportunities.count_documents({"user_id": api.users["b"]}) == 1
    assert await db.opportunities.count_documents({"user_id": api.users["a"]}) == 1

    # B intact
    b_opp = (await api.get(f"/api/opportunities/{opp_b}", headers=api.headers_for("b"))).json()
    assert b_opp["status"] == "new" and b_opp["title"] == "Data Engineer Junior"
    assert await db.applications.count_documents({}) == 0
