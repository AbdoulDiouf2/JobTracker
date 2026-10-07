"""
Tests HTTP de l'API utilisateur /api/opportunities (+ non-régression POST /api/applications).

L'application FastAPI réelle est appelée en mémoire (httpx ASGITransport) avec
de vrais JWT, contre la MongoDB éphémère. Le lifespan (scheduler) n'est pas lancé.
"""

import asyncio
import uuid

import pytest

pytestmark = pytest.mark.anyio


def offer(**overrides) -> dict:
    data = {
        "title": "Data Engineer Junior",
        "company": "Orange",
        "url": f"https://company.com/jobs/{uuid.uuid4().hex[:8]}",
        "location": "Paris",
        "country": "France",
        "contract_type": "CDI",
        "description": "Description",
        "source": "manual",
    }
    data.update(overrides)
    return data


async def create(api, who="a", **overrides) -> dict:
    r = await api.post("/api/opportunities", json=offer(**overrides), headers=api.headers_for(who))
    assert r.status_code in (200, 201), r.text
    return r.json()


# ============================================
# Authentification
# ============================================

@pytest.mark.parametrize("method,path", [
    ("get", "/api/opportunities"),
    ("get", "/api/opportunities/count"),
    ("post", "/api/opportunities"),
    ("get", "/api/opportunities/x"),
    ("patch", "/api/opportunities/x"),
    ("post", "/api/opportunities/x/ignore"),
    ("post", "/api/opportunities/x/convert"),
])
async def test_routes_require_jwt(api, method, path):
    r = await api.request(method.upper(), path, json={})
    assert r.status_code in (401, 403)


# ============================================
# Création / validation
# ============================================

async def test_create_returns_201_then_200_on_duplicate(api):
    url = "https://company.com/jobs/123"
    r1 = await api.post("/api/opportunities", json=offer(url=url), headers=api.headers_for("a"))
    r2 = await api.post(
        "/api/opportunities", json=offer(url=url + "?utm_source=linkedin"), headers=api.headers_for("a")
    )
    assert r1.status_code == 201
    assert r1.json()["created"] is True and r1.json()["duplicate"] is False
    assert r2.status_code == 200
    assert r2.json() == {
        "created": False, "duplicate": True,
        "opportunity_id": r1.json()["opportunity_id"], "duplicate_reason": "url",
    }


@pytest.mark.parametrize("payload_patch", [
    {"url": "javascript:alert(1)"},
    {"url": "not-a-url"},
    {"title": ""},
    {"user_id": "someone-else"},
    {"status": "converted"},
], ids=["javascript-url", "relative-url", "empty-title", "injected-user-id", "injected-status"])
async def test_create_validation_errors(api, payload_patch):
    r = await api.post("/api/opportunities", json=offer(**payload_patch), headers=api.headers_for("a"))
    assert r.status_code == 422
    assert (await api.get("/api/opportunities", headers=api.headers_for("a"))).json()["total"] == 0


async def test_create_missing_required_field(api):
    payload = offer()
    del payload["company"]
    r = await api.post("/api/opportunities", json=payload, headers=api.headers_for("a"))
    assert r.status_code == 422


# ============================================
# Lecture / scoping
# ============================================

async def test_list_get_and_count(api):
    created = await create(api, title="Data Engineer")
    await create(api, title="Backend Dev", company="Thales")
    await create(api, who="b")

    r = await api.get("/api/opportunities", headers=api.headers_for("a"))
    body = r.json()
    assert r.status_code == 200 and body["total"] == 2
    assert all("url_normalized" not in i and "user_id" not in i for i in body["items"])

    r = await api.get("/api/opportunities", params={"search": "thales"}, headers=api.headers_for("a"))
    assert [i["company"] for i in r.json()["items"]] == ["Thales"]

    r = await api.get(f"/api/opportunities/{created['opportunity_id']}", headers=api.headers_for("a"))
    assert r.status_code == 200 and r.json()["title"] == "Data Engineer" and r.json()["status"] == "new"

    r = await api.get("/api/opportunities/count", headers=api.headers_for("a"))
    assert r.json() == {"new": 2}


async def test_invalid_status_filter(api):
    r = await api.get("/api/opportunities", params={"status": "foo"}, headers=api.headers_for("a"))
    assert r.status_code == 422


@pytest.mark.parametrize("method,suffix,body", [
    ("GET", "", None),
    ("PATCH", "", {"title": "Piraté"}),
    ("POST", "/ignore", None),
    ("POST", "/convert", None),
])
async def test_other_user_gets_404(api, db, method, suffix, body):
    created = await create(api, who="a")
    opp_id = created["opportunity_id"]

    r = await api.request(method, f"/api/opportunities/{opp_id}{suffix}", json=body, headers=api.headers_for("b"))
    assert r.status_code == 404

    r = await api.get(f"/api/opportunities/{opp_id}", headers=api.headers_for("a"))
    assert r.json()["status"] == "new" and r.json()["title"] == "Data Engineer Junior"
    assert await db.applications.count_documents({}) == 0


async def test_unknown_id_404(api):
    r = await api.get("/api/opportunities/does-not-exist", headers=api.headers_for("a"))
    assert r.status_code == 404


# ============================================
# PATCH / ignore
# ============================================

async def test_patch_fields_and_status(api):
    created = await create(api)
    opp_id = created["opportunity_id"]

    r = await api.patch(f"/api/opportunities/{opp_id}", json={"location": "Lyon"}, headers=api.headers_for("a"))
    assert r.status_code == 200 and r.json()["location"] == "Lyon"

    r = await api.patch(f"/api/opportunities/{opp_id}", json={"status": "ignored"}, headers=api.headers_for("a"))
    assert r.json()["status"] == "ignored"
    r = await api.patch(f"/api/opportunities/{opp_id}", json={"status": "new"}, headers=api.headers_for("a"))
    assert r.json()["status"] == "new"


@pytest.mark.parametrize("body", [
    {"status": "converted"}, {"url": "https://other.com/1"}, {"user_id": "x"}, {"title": ""},
])
async def test_patch_rejects_forbidden_changes(api, body):
    created = await create(api)
    r = await api.patch(f"/api/opportunities/{created['opportunity_id']}", json=body, headers=api.headers_for("a"))
    assert r.status_code == 422


async def test_ignore_moves_from_new_to_ignored_list(api):
    created = await create(api)
    opp_id = created["opportunity_id"]

    r = await api.post(f"/api/opportunities/{opp_id}/ignore", headers=api.headers_for("a"))
    assert r.status_code == 200 and r.json()["status"] == "ignored"
    r = await api.post(f"/api/opportunities/{opp_id}/ignore", headers=api.headers_for("a"))
    assert r.status_code == 200  # idempotent

    new = await api.get("/api/opportunities", params={"status": "new"}, headers=api.headers_for("a"))
    ignored = await api.get("/api/opportunities", params={"status": "ignored"}, headers=api.headers_for("a"))
    assert new.json()["total"] == 0
    assert [i["id"] for i in ignored.json()["items"]] == [opp_id]
    assert (await api.get("/api/opportunities/count", headers=api.headers_for("a"))).json() == {"new": 0}


# ============================================
# Conversion
# ============================================

async def test_convert_creates_to_apply_application(api):
    created = await create(api, url="https://www.linkedin.com/jobs/view/4012345678/")
    opp_id = created["opportunity_id"]

    r = await api.post(f"/api/opportunities/{opp_id}/convert", headers=api.headers_for("a"))
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True and body["created"] is True and body["opportunity_id"] == opp_id

    # La candidature est lisible via l'API existante
    app = (await api.get(f"/api/applications/{body['application_id']}", headers=api.headers_for("a"))).json()
    assert app["reponse"] == "to_apply"
    assert app["poste"] == "Data Engineer Junior" and app["entreprise"] == "Orange"
    assert app["moyen"] == "linkedin" and app["lieu"] == "Paris, France"

    opp = (await api.get(f"/api/opportunities/{opp_id}", headers=api.headers_for("a"))).json()
    assert opp["status"] == "converted"
    assert opp["converted_application_id"] == body["application_id"]
    assert opp["converted_at"] is not None


async def test_convert_twice_returns_same_application(api):
    opp_id = (await create(api))["opportunity_id"]
    r1 = await api.post(f"/api/opportunities/{opp_id}/convert", headers=api.headers_for("a"))
    r2 = await api.post(f"/api/opportunities/{opp_id}/convert", headers=api.headers_for("a"))
    assert r1.json()["application_id"] == r2.json()["application_id"]
    assert r2.json()["created"] is False
    apps = (await api.get("/api/applications", headers=api.headers_for("a"))).json()
    assert apps["total"] == 1


async def test_concurrent_http_conversions(api):
    opp_id = (await create(api))["opportunity_id"]
    responses = await asyncio.gather(*[
        api.post(f"/api/opportunities/{opp_id}/convert", headers=api.headers_for("a")) for _ in range(15)
    ])
    assert all(r.status_code == 200 for r in responses)
    assert len({r.json()["application_id"] for r in responses}) == 1
    assert sum(r.json()["created"] for r in responses) == 1
    apps = (await api.get("/api/applications", headers=api.headers_for("a"))).json()
    assert apps["total"] == 1


async def test_converted_opportunity_protected_via_api(api):
    opp_id = (await create(api))["opportunity_id"]
    await api.post(f"/api/opportunities/{opp_id}/convert", headers=api.headers_for("a"))

    r = await api.post(f"/api/opportunities/{opp_id}/ignore", headers=api.headers_for("a"))
    assert r.status_code == 409
    r = await api.patch(f"/api/opportunities/{opp_id}", json={"status": "new"}, headers=api.headers_for("a"))
    assert r.status_code == 409
    r = await api.patch(f"/api/opportunities/{opp_id}", json={"location": "Lyon"}, headers=api.headers_for("a"))
    assert r.status_code == 200 and r.json()["status"] == "converted"


async def test_converted_application_does_not_count_in_stats(api):
    before = (await api.get("/api/statistics/dashboard", headers=api.headers_for("a"))).json()
    opp_id = (await create(api))["opportunity_id"]
    await api.post(f"/api/opportunities/{opp_id}/convert", headers=api.headers_for("a"))
    after = (await api.get("/api/statistics/dashboard", headers=api.headers_for("a"))).json()
    assert after == before


async def test_leaving_to_apply_via_api_requires_date(api):
    opp_id = (await create(api))["opportunity_id"]
    app_id = (await api.post(f"/api/opportunities/{opp_id}/convert", headers=api.headers_for("a"))).json()["application_id"]

    r = await api.put(f"/api/applications/{app_id}", json={"reponse": "pending"}, headers=api.headers_for("a"))
    assert r.status_code == 422
    assert isinstance(r.json()["detail"], str)  # message lisible côté UI (toast)

    r = await api.put(
        f"/api/applications/{app_id}",
        json={"reponse": "pending", "date_candidature": "2026-10-01T10:00:00+00:00"},
        headers=api.headers_for("a"),
    )
    assert r.status_code == 200
    assert r.json()["reponse"] == "pending"
    assert r.json()["date_candidature"].startswith("2026-10-01T10:00:00")


# ============================================
# Non-régression POST /api/applications
# ============================================

EXPECTED_APPLICATION_KEYS = {
    "_id", "id", "user_id", "entreprise", "poste", "type_poste", "lieu", "moyen", "date_candidature",
    "lien", "commentaire", "description_poste", "contact_email", "contact_name", "salaire_min",
    "salaire_max", "days_before_reminder", "competences", "experience_requise", "cv_id", "source",
    "reponse", "date_reponse", "is_favorite", "created_at", "updated_at", "history", "match_score",
    "match_details", "last_reminder_sent", "followup_count",
}


async def test_post_applications_unchanged(api, db):
    payload = {
        "entreprise": "Thales", "poste": "Backend Dev", "type_poste": "cdd", "lieu": "Paris",
        "moyen": "indeed", "date_candidature": "2026-10-05T09:00:00+00:00", "lien": "https://t.com/1",
    }
    r = await api.post("/api/applications", json=payload, headers=api.headers_for("a"))
    assert r.status_code == 201
    body = r.json()
    assert body["reponse"] == "pending"
    assert body["source"] == "webapp"
    assert body["interviews_count"] == 0 and body["next_interview"] is None
    assert body["user_id"] == api.users["a"]

    doc = await db.applications.find_one({"id": body["id"]})
    assert set(doc.keys()) == EXPECTED_APPLICATION_KEYS
    assert doc["reponse"] == "pending" and doc["type_poste"] == "cdd" and doc["moyen"] == "indeed"
    assert doc["date_candidature"] == "2026-10-05T09:00:00+00:00"
    assert isinstance(doc["created_at"], str) and isinstance(doc["updated_at"], str)
    assert doc["date_reponse"] is None


async def test_post_applications_extension_source_from_jwt(api, db):
    payload = {"entreprise": "E", "poste": "P", "date_candidature": "2026-10-05T09:00:00+00:00"}
    r = await api.post("/api/applications", json=payload, headers=api.headers_for("a", source="extension"))
    assert r.status_code == 201
    # Comportement historique : la source du payload (défaut "webapp") prime ;
    # la source du JWT ne sert que si le payload envoie une source vide.
    assert r.json()["source"] == "webapp"

    payload["source"] = ""
    r = await api.post("/api/applications", json=payload, headers=api.headers_for("a", source="extension"))
    assert r.json()["source"] == "extension"


async def test_post_applications_validation_unchanged(api):
    r = await api.post("/api/applications", json={"entreprise": "E"}, headers=api.headers_for("a"))
    assert r.status_code == 422
