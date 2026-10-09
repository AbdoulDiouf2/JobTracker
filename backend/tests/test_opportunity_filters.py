"""
Opportunités : filtres serveur, tri, pagination et facettes (sous-lot B).
MongoDB éphémère, application FastAPI réelle. Aucune donnée réelle.
"""

import uuid
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import pytest

from models import OpportunityCreate
from services import oauth_service as svc, opportunity_service

pytestmark = pytest.mark.anyio

PARIS = ZoneInfo("Europe/Paris")
NOW = datetime.now(timezone.utc)


async def seed(db, user_id, title, *, source="chatgpt_watch", client_id=None, client_name=None, score=None,
               country="FR", contract="CDI", contract_category="permanent", seniority=None, location="Paris",
               company="Orange", discovered_at=None, status="new"):
    """Crée une opportunité au format réel (service du Lot 1) ; `watch` seulement pour la veille."""
    watch = None
    if source == "chatgpt_watch":
        watch = {"run_id": "veille-20261010-0800-prog", "relevance_score": score if score is not None else 80,  # toujours présent pour la veille
                 "relevance_reasons": ["x"], "contract_category": contract_category, "seniority": seniority}
        if client_id:
            watch.update({"client_id": client_id, "client_name": client_name})
    data = OpportunityCreate(title=title, company=company, url=f"https://jobs.example-corp.fr/{uuid.uuid4().hex}",
                             country=country, contract_type=contract, location=location, source=source,
                             discovered_at=discovered_at or NOW)
    result = await opportunity_service.ingest_opportunity(db, user_id, data, watch=watch)
    if status != "new":
        await db.opportunities.update_one({"id": result.opportunity_id}, {"$set": {"status": status}})
    return result.opportunity_id


async def query(api, who="a", **params):
    items = []
    for key, value in params.items():
        for v in (value if isinstance(value, list) else [value]):
            items.append((key, v))
    r = await api.get("/api/opportunities", params=items, headers=api.headers_for(who))
    assert r.status_code == 200, r.text
    return r.json()


def titles(body):
    return [i["title"] for i in body["items"]]


@pytest.fixture
async def clients(db):
    claude = await svc.create_client(db, "Claude", ["https://claude.ai/api/mcp/auth_callback"])
    chatgpt = await svc.create_client(db, "ChatGPT", [svc.CHATGPT_DEFAULT_REDIRECT])
    return chatgpt["client_id"], claude["client_id"]


@pytest.fixture
async def dataset(api, db, clients):
    """Jeu varié pour le compte a, plus une offre du compte b."""
    gpt, claude = clients
    a = api.users["a"]
    ids = {
        "claude_ch_92": await seed(db, a, "Claude CH 92", client_id=claude, client_name="Claude", score=92,
                                   country="CH", location="Genève", company="Nestlé",
                                   discovered_at=NOW - timedelta(days=2), seniority="junior"),
        "claude_fr_78": await seed(db, a, "Claude FR 78", client_id=claude, client_name="Claude", score=78,
                                   country="FR", company="axa", discovered_at=NOW - timedelta(days=10),
                                   contract="CDD", contract_category="fixed_term"),
        "gpt_be_88": await seed(db, a, "GPT BE 88", client_id=gpt, client_name="ChatGPT", score=88,
                                country="BE", location="Bruxelles", company="Bpost",
                                discovered_at=NOW - timedelta(days=1), seniority="graduate"),
        "legacy_fr_95": await seed(db, a, "Legacy FR 95", score=95, country="FR", company="Thales",
                                   discovered_at=NOW - timedelta(days=40)),
        "manual_france": await seed(db, a, "Manuel France", source="manual", country="France", contract="CDI",
                                    company="Capgemini", discovered_at=NOW - timedelta(days=3), location="Lyon"),
        "ext_unknown": await seed(db, a, "Extension Pays inconnu", source="chrome_extension", country="Atlantide",
                                  contract="Stage", company="zeta", discovered_at=NOW - timedelta(days=5),
                                  status="ignored"),
    }
    ids["other_user"] = await seed(db, api.users["b"], "Compte B", client_id=claude, client_name="Claude",
                                   score=99, country="CH")
    return ids


# ============================================
# Filtres individuels
# ============================================

async def test_origin_filter_single_and_multiple(api, db, dataset, clients):
    gpt, claude = clients
    assert sorted(titles(await query(api, origin=f"client:{claude}"))) == ["Claude CH 92", "Claude FR 78"]
    assert titles(await query(api, origin="watch_legacy")) == ["Legacy FR 95"]
    assert titles(await query(api, origin="source:manual")) == ["Manuel France"]
    both = await query(api, origin=[f"client:{gpt}", "source:chrome_extension"])
    assert sorted(titles(both)) == ["Extension Pays inconnu", "GPT BE 88"] and both["total"] == 2


async def test_country_filter_normalizes_free_text_without_writing(api, db, dataset):
    body = await query(api, country="FR")
    assert sorted(titles(body)) == ["Claude FR 78", "Legacy FR 95", "Manuel France"]
    assert sorted(titles(await query(api, country=["ch", "BE"]))) == ["Claude CH 92", "GPT BE 88"]
    assert (await db.opportunities.find_one({"id": dataset["manual_france"]}))["country"] == "France"


async def test_score_filter_is_inclusive_and_excludes_unscored(api, db, dataset):
    assert sorted(titles(await query(api, min_score=88))) == ["Claude CH 92", "GPT BE 88", "Legacy FR 95"]
    assert sorted(titles(await query(api, min_score=78, max_score=88))) == ["Claude FR 78", "GPT BE 88"]
    assert titles(await query(api, min_score=95, max_score=95)) == ["Legacy FR 95"]
    # Sans filtre de score, les offres sans score restent visibles
    assert "Manuel France" in titles(await query(api))


async def test_discovered_dates_are_inclusive_paris_days(api, db):
    a = api.users["a"]
    # 9 octobre 2026, heure d'été (UTC+2) : 23:59:59 à Paris = 21:59:59 UTC
    await seed(db, a, "Fin du 9", discovered_at=datetime(2026, 10, 9, 21, 59, 59, tzinfo=timezone.utc))
    await seed(db, a, "Début du 10", discovered_at=datetime(2026, 10, 9, 22, 0, 0, tzinfo=timezone.utc))
    await seed(db, a, "Fin du 10", discovered_at=datetime(2026, 10, 10, 21, 59, 59, 999000, tzinfo=timezone.utc))
    await seed(db, a, "Début du 11", discovered_at=datetime(2026, 10, 10, 22, 0, 0, tzinfo=timezone.utc))
    assert sorted(titles(await query(api, discovered_from="2026-10-10", discovered_to="2026-10-10"))) == \
        ["Début du 10", "Fin du 10"]
    assert sorted(titles(await query(api, discovered_from="2026-10-10"))) == ["Début du 10", "Début du 11", "Fin du 10"]
    assert sorted(titles(await query(api, discovered_to="2026-10-09"))) == ["Fin du 9"]


async def test_contract_filter_uses_normalized_categories(api, db, dataset):
    permanent = sorted(titles(await query(api, contract="permanent")))
    assert permanent == ["Claude CH 92", "GPT BE 88", "Legacy FR 95", "Manuel France"]  # « CDI » manuel inclus
    assert titles(await query(api, contract="fixed_term")) == ["Claude FR 78"]
    assert titles(await query(api, contract="internship")) == ["Extension Pays inconnu"]  # « Stage »


async def test_missing_seniority_is_never_assumed(api, db, dataset):
    assert titles(await query(api, seniority="junior")) == ["Claude CH 92"]
    assert sorted(titles(await query(api, seniority=["junior", "graduate"]))) == ["Claude CH 92", "GPT BE 88"]
    assert titles(await query(api, seniority="mid")) == []


async def test_location_is_a_case_insensitive_literal_search(api, db, dataset):
    assert titles(await query(api, location="genève")) == ["Claude CH 92"]
    assert titles(await query(api, location="BRUX")) == ["GPT BE 88"]
    assert titles(await query(api, location=".*")) == []  # pas d'expression régulière


async def test_existing_status_and_search_filters_still_work(api, db, dataset):
    assert titles(await query(api, status="ignored")) == ["Extension Pays inconnu"]
    assert titles(await query(api, search="nestl")) == ["Claude CH 92"]


# ============================================
# Combinaisons, tri, pagination
# ============================================

async def test_combined_filters(api, db, dataset, clients):
    _, claude = clients
    week_ago = (datetime.now(PARIS) - timedelta(days=6)).date().isoformat()
    body = await query(api, origin=f"client:{claude}", country="CH", discovered_from=week_ago, min_score=85)
    assert titles(body) == ["Claude CH 92"] and body["total"] == 1
    assert (await query(api, origin=f"client:{claude}", country="BE"))["total"] == 0
    assert titles(await query(api, status="new", country="FR", min_score=90)) == ["Legacy FR 95"]


async def test_sorts(api, db, dataset):
    # Par défaut : découverte la plus récente d'abord
    assert titles(await query(api))[:3] == ["GPT BE 88", "Claude CH 92", "Manuel France"]
    by_score = titles(await query(api, sort="relevance"))
    assert by_score[:4] == ["Legacy FR 95", "Claude CH 92", "GPT BE 88", "Claude FR 78"]
    assert set(by_score[4:]) == {"Manuel France", "Extension Pays inconnu"}  # sans score : en dernier
    assert titles(await query(api, sort="company")) == [
        "Claude FR 78", "GPT BE 88", "Manuel France", "Claude CH 92", "Legacy FR 95", "Extension Pays inconnu"]


async def test_pagination_is_stable_with_ties_and_totals_are_filtered(api, db):
    a = api.users["a"]
    same = NOW - timedelta(hours=1)
    for i in range(7):
        await seed(db, a, f"Égal {i}", score=90, discovered_at=same)
    seen = []
    for sort in ("discovered", "relevance", "company"):
        pages = [await query(api, sort=sort, per_page=3, page=p) for p in (1, 2, 3)]
        assert [p["total"] for p in pages] == [7, 7, 7] and pages[0]["total_pages"] == 3
        flat = [i["id"] for p in pages for i in p["items"]]
        assert len(flat) == 7 and len(set(flat)) == 7  # ni doublon ni oubli entre les pages
        again = [i["id"] for p in [await query(api, sort=sort, per_page=3, page=n) for n in (1, 2, 3)] for i in p["items"]]
        assert again == flat  # ordre déterministe
        seen.append(flat)
    filtered = await query(api, min_score=95, per_page=3)
    assert filtered["total"] == 0 and filtered["total_pages"] == 0


async def test_isolation_between_users(api, db, dataset):
    assert "Compte B" not in titles(await query(api, per_page=100))
    assert titles(await query(api, who="b")) == ["Compte B"]
    assert (await query(api, who="b", country="FR"))["total"] == 0


# ============================================
# Facettes
# ============================================

async def test_facets_are_global_to_the_account(api, db, dataset, clients):
    gpt, claude = clients
    r = await api.get("/api/opportunities/facets", headers=api.headers_for("a"))
    assert r.status_code == 200
    f = r.json()
    assert f["scope"] == "account" and f["total"] == 6  # tous statuts, sans le compte b
    origins = {o["key"]: o for o in f["origins"]}
    assert origins[f"client:{claude}"] == {"kind": "client", "key": f"client:{claude}", "client_id": claude,
                                            "client_name": "Claude", "count": 2}
    assert origins[f"client:{gpt}"]["client_name"] == "ChatGPT" and origins[f"client:{gpt}"]["count"] == 1
    assert origins["watch_legacy"]["count"] == 1 and origins["watch_legacy"]["kind"] == "watch_legacy"
    assert origins["source:manual"]["count"] == 1 and origins["source:chrome_extension"]["count"] == 1
    assert f["countries"] == [{"key": "FR", "count": 3}, {"key": "BE", "count": 1}, {"key": "CH", "count": 1}]
    assert f["countries_unrecognized"] == 1
    assert {c["key"]: c["count"] for c in f["contracts"]} == {"permanent": 4, "fixed_term": 1, "internship": 1}
    assert {s["key"]: s["count"] for s in f["seniorities"]} == {"junior": 1, "graduate": 1}
    assert f["scores"] == {"count": 4, "min": 78, "max": 95}
    # Chaque clé de facette est un filtre valide qui retrouve le même effectif
    for o in f["origins"]:
        assert (await query(api, origin=o["key"]))["total"] == o["count"]
    for c in f["countries"]:
        assert (await query(api, country=c["key"]))["total"] == c["count"]


async def test_facets_follow_deactivated_and_deleted_clients(api, db, dataset, clients):
    _, claude = clients
    await svc.deactivate_client(db, claude)
    f = (await api.get("/api/opportunities/facets", headers=api.headers_for("a"))).json()
    assert {o["key"]: o for o in f["origins"]}[f"client:{claude}"]["client_name"] == "Claude"
    await db.oauth_clients.delete_one({"client_id": claude})
    f = (await api.get("/api/opportunities/facets", headers=api.headers_for("a"))).json()
    entry = {o["key"]: o for o in f["origins"]}[f"client:{claude}"]
    assert entry["client_name"] == "Claude" and entry["count"] == 2  # copie conservée


async def test_facets_for_empty_account_and_auth(api, db):
    f = (await api.get("/api/opportunities/facets", headers=api.headers_for("b"))).json()
    assert f == {"scope": "account", "total": 0, "origins": [], "countries": [], "countries_unrecognized": 0,
                 "contracts": [], "seniorities": [], "scores": {"count": 0, "min": None, "max": None}}
    assert (await api.get("/api/opportunities/facets")).status_code == 401
    assert (await api.get("/api/opportunities")).status_code == 401


# ============================================
# Paramètres invalides
# ============================================

@pytest.mark.parametrize("params", [
    [("origin", "client:")], [("origin", "chatgpt")], [("origin", "source:chatgpt_watch")],
    [("origin", "client:a b")], [("country", "FRA")], [("country", "F1")],
    [("min_score", "101")], [("max_score", "-1")], [("min_score", "90"), ("max_score", "80")],
    [("discovered_from", "2026-10-11"), ("discovered_to", "2026-10-10")], [("discovered_from", "10/10/2026")],
    [("contract", "cdi")], [("seniority", "senior")], [("sort", "price")], [("location", "x" * 101)],
    [("origin", "watch_legacy")] * 21,
])
async def test_invalid_parameters_are_refused(api, db, params):
    r = await api.get("/api/opportunities", params=params, headers=api.headers_for("a"))
    assert r.status_code == 422
