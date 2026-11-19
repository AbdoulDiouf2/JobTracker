"""Recherche REST des candidatures : couverture des champs et enrichissement groupé."""

from datetime import datetime, timedelta, timezone

import pytest

pytestmark = pytest.mark.anyio


async def _application(db, user_id: str, app_id: str, **fields):
    document = {
        "id": app_id,
        "user_id": user_id,
        "entreprise": "Entreprise",
        "poste": "Poste",
        "date_candidature": "2026-11-01T10:00:00+00:00",
        "created_at": "2026-11-01T10:00:00+00:00",
        "updated_at": "2026-11-01T10:00:00+00:00",
        **fields,
    }
    await db.applications.insert_one(document)


@pytest.mark.parametrize(("field", "value", "query"), [
    ("commentaire", "Échange au salon Tech", "salon"),
    ("type_poste", "alternance", "alternance"),
    ("moyen", "welcome_to_the_jungle", "jungle"),
    ("lien", "https://jobs.example.test/rare-slug", "rare-slug"),
    ("reponse", "positive", "positive"),
    ("source", "extension", "extension"),
    ("contact_email", "talent@exemple.test", "talent@"),
    ("competences", ["FastAPI", "MongoDB"], "mongodb"),
    ("salaire_min", 65000, "65000"),
])
async def test_search_covers_application_text_fields(api, db, field, value, query):
    await _application(db, api.users["a"], f"match-{field}", **{field: value})
    await _application(db, api.users["a"], f"other-{field}")

    response = await api.get(
        "/api/applications",
        params={"search": query},
        headers=api.headers_for("a"),
    )

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["total"] == 1
    assert payload["items"][0]["id"] == f"match-{field}"


async def test_search_words_can_match_different_fields_in_any_order(api, db):
    await _application(
        db, api.users["a"], "cross-fields",
        entreprise="Acme", poste="Data Engineer",
    )

    response = await api.get(
        "/api/applications",
        params={"search": "engineer acme"},
        headers=api.headers_for("a"),
    )

    assert response.status_code == 200
    assert [item["id"] for item in response.json()["items"]] == ["cross-fields"]


async def test_application_interviews_are_enriched_without_cross_user_data(api, db):
    await _application(db, api.users["a"], "with-interviews")
    future = datetime.now(timezone.utc) + timedelta(days=2)
    earlier = datetime.now(timezone.utc) + timedelta(days=1)
    await db.interviews.insert_many([
        {
            "id": "later", "user_id": api.users["a"], "candidature_id": "with-interviews",
            "statut": "planned", "date_entretien": future.isoformat(),
        },
        {
            "id": "earlier", "user_id": api.users["a"], "candidature_id": "with-interviews",
            "statut": "planned", "date_entretien": earlier.isoformat(),
        },
        {
            "id": "foreign", "user_id": api.users["b"], "candidature_id": "with-interviews",
            "statut": "planned", "date_entretien": earlier.isoformat(),
        },
    ])

    response = await api.get("/api/applications", headers=api.headers_for("a"))

    assert response.status_code == 200
    item = response.json()["items"][0]
    assert item["interviews_count"] == 2
    assert item["next_interview"] == earlier.isoformat()
