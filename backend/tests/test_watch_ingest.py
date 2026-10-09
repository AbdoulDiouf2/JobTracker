"""
Tests de l'ingestion de la veille ChatGPT (Lot 2) contre une MongoDB éphémère :
idempotence, rejeu, reprise après interruption, quotas atomiques sous concurrence
(§7.3 à §7.5 de la spécification), isolation, rapport et statut.
"""

import asyncio
import uuid
from datetime import datetime, timedelta, timezone

import pytest

from models import OpportunityCreate
from models.watch import WatchPreferencesUpdate
from services import opportunity_service
from services import watch_ingest_service as svc
from services import watch_preferences_service as prefs_svc
from services.watch_ingest_service import WatchNotEnabled, WatchRequestError

pytestmark = pytest.mark.anyio

UTC = timezone.utc
NOW = datetime(2026, 10, 9, 6, 5, tzinfo=UTC)  # 08:05, heure de Paris
RUN = "veille-20261009-0800-prog"
REPEAT = 20  # répétitions des tests de concurrence


async def new_user(db, enabled=True) -> str:
    user_id = f"user-{uuid.uuid4().hex[:8]}"
    await db.users.insert_one({"id": user_id, "email": f"{user_id}@test.local", "is_active": True,
                               "role": "standard", "watch_enabled": enabled})
    return user_id


def offer(n=None, **overrides) -> dict:
    n = n if n is not None else uuid.uuid4().hex[:8]
    data = {
        "title": f"Data Engineer Junior {n}",
        "company": "Orange",
        "url": f"https://careers.orange.com/jobs/{n}",
        "country": "FR",
        "location": "Paris",
        "contract_type": "CDI",
        "seniority": "junior",
        "relevance_score": 86,
        "relevance_reasons": ["CDI à Paris", "Poste junior"],
    }
    data.update(overrides)
    return data


def batch(*offers, run_id=RUN, **extra) -> dict:
    return {"run_id": run_id, "opportunities": list(offers), **extra}


async def ingest(db, user_id, *offers, run_id=RUN, now=NOW):
    return await svc.ingest_batch(db, user_id, batch(*offers, run_id=run_id), now=now)


async def opp_count(db, user_id) -> int:
    return await db.opportunities.count_documents({"user_id": user_id})


async def run_doc(db, user_id, run_id=RUN) -> dict:
    return await db[svc.RUNS].find_one({"user_id": user_id, "run_id": run_id})


async def usage(db, user_id, day="2026-10-09") -> int:
    return await svc._creations_on(db, user_id, day)


# ============================================
# Création, stockage, résultat
# ============================================

async def test_created_opportunity_is_stored_with_watch_metadata(db):
    user = await new_user(db)
    res = await svc.ingest_batch(db, user, batch(offer("a1", external_id="orange:1"), preferences_version=1), now=NOW)
    assert res.summary.model_dump() == {"received": 1, "replayed": 0, "created": 1, "duplicate": 0, "rejected": 0, "error": 0}
    assert res.run_totals.model_dump() == {"created": 1, "remaining_for_run": 19, "remaining_today": 39}
    item = res.results[0]
    assert item.status == "created" and item.index == 0 and item.replayed is False

    doc = await db.opportunities.find_one({"id": item.opportunity_id}, {"_id": 0})
    assert doc["user_id"] == user and doc["source"] == "chatgpt_watch" and doc["status"] == "new"
    assert doc["country"] == "FR" and doc["external_id"] == "orange:1"
    assert doc["watch"]["run_id"] == RUN and doc["watch"]["relevance_score"] == 86
    assert doc["watch"]["preferences_version"] == 1 and doc["watch"]["contract_category"] == "permanent"

    run = await run_doc(db, user)
    assert run["kind"] == "prog" and run["quota_day"] == "2026-10-09"
    assert run["scheduled_for"] == "2026-10-09T06:00:00+00:00"
    assert run["observed"] == {"created": 1, "duplicate": 0, "rejected": 0, "error": 0} and run["reserved"] == 1
    assert await usage(db, user) == 1


async def test_lot1_ingestion_without_watch_is_unchanged(db):
    user = await new_user(db)
    data = OpportunityCreate(title="T", company="C", url="https://c.com/j/1", source="manual")
    res = await opportunity_service.ingest_opportunity(db, user, data)
    doc = await db.opportunities.find_one({"id": res.opportunity_id})
    assert "watch" not in doc


async def test_rejections_are_per_item_and_cost_nothing(db):
    user = await new_user(db)
    res = await ingest(db, user, offer("ok"), offer("low", relevance_score=40), offer("de", country="DE"),
                       offer("http", url="http://x.com/1"), {"title": "only"}, "not-an-object")
    assert [r.status for r in res.results] == ["created", "rejected", "rejected", "rejected", "rejected", "rejected"]
    assert res.results[1].reasons == ["score_below_threshold"]
    assert res.results[2].reasons == ["country_not_targeted"]
    assert res.results[3].reasons == ["invalid_url"]
    assert res.results[5].reasons == ["invalid_item"]
    assert await opp_count(db, user) == 1 and await usage(db, user) == 1
    assert (await run_doc(db, user))["reserved"] == 1


async def test_slot_not_in_schedule_is_accepted_with_warning(db):
    user = await new_user(db)
    res = await ingest(db, user, offer(), run_id="veille-20261009-0900-prog", now=NOW + timedelta(hours=1))
    assert res.results[0].status == "created" and res.warnings == ["slot_not_in_schedule"]


# ============================================
# Refus de l'appel entier
# ============================================

@pytest.mark.parametrize("payload, code", [
    ({"run_id": "3f2b5a8e-1c2d-4e5f-9a8b-7c6d5e4f3a2b", "opportunities": [{}]}, "invalid_run_id"),
    ({"run_id": "veille-20261001-0800-prog", "opportunities": [{}]}, "run_id_out_of_window"),
    ({"run_id": RUN, "opportunities": []}, "invalid_arguments"),
    ({"run_id": RUN, "opportunities": [{}] * 21}, "invalid_arguments"),
    ({"run_id": RUN, "opportunities": [{}], "user_id": "victim"}, "invalid_arguments"),
    ({"opportunities": [{}]}, "invalid_arguments"),
])
async def test_whole_call_refusals(db, payload, code):
    user = await new_user(db)
    with pytest.raises(WatchRequestError) as e:
        await svc.ingest_batch(db, user, payload, now=NOW)
    assert e.value.code == code
    assert "victim" not in repr(e.value.details)
    assert await opp_count(db, user) == 0


async def test_disabled_or_unknown_user_is_refused(db):
    disabled = await new_user(db, enabled=False)
    for user in (disabled, "unknown-user"):
        with pytest.raises(WatchNotEnabled):
            await ingest(db, user, offer())
        with pytest.raises(WatchNotEnabled):
            await svc.report_watch_run(db, user, {"run_id": RUN, "status": "completed"}, now=NOW)
    assert await db.opportunities.count_documents({}) == 0


async def test_paused_watch_rejects_everything(db):
    user = await new_user(db)
    current = await prefs_svc.get_or_create(db, user)
    data = current.model_dump(exclude={"preferences_version", "updated_at"})
    await prefs_svc.update(db, user, WatchPreferencesUpdate(**{**data, "active": False, "expected_version": 1}))
    res = await ingest(db, user, offer(), offer())
    assert [r.reasons for r in res.results] == [["watch_paused"], ["watch_paused"]]
    assert await opp_count(db, user) == 0 and await usage(db, user) == 0


# ============================================
# Rejeu et répétitions (§7.4)
# ============================================

async def test_replay_three_times_writes_nothing(db):
    user = await new_user(db)
    offers = [offer(i) for i in range(3)] + [offer("bad", relevance_score=1)]
    first = await ingest(db, user, *offers)
    ids = [r.opportunity_id for r in first.results]
    for _ in range(3):
        again = await ingest(db, user, *offers, now=NOW + timedelta(minutes=10))
        assert [r.status for r in again.results] == ["created"] * 3 + ["rejected"]
        assert all(r.replayed for r in again.results) and again.summary.replayed == 4
        assert [r.opportunity_id for r in again.results] == ids
    assert await opp_count(db, user) == 3 and await usage(db, user) == 3
    run = await run_doc(db, user)
    assert run["reserved"] == 3 and run["observed"] == {"created": 3, "duplicate": 0, "rejected": 1, "error": 0}


async def test_same_item_twice_in_one_call_is_created_once(db):
    user = await new_user(db)
    o = offer("dup")
    res = await ingest(db, user, o, o)
    assert [r.status for r in res.results] == ["created", "created"]
    assert [r.replayed for r in res.results] == [False, True]
    assert await opp_count(db, user) == 1 and await usage(db, user) == 1


async def test_manual_then_scheduled_runs_only_create_new_offers(db):
    user = await new_user(db)
    manual = "veille-20261009-0803-manuel-k3x9q2"
    await ingest(db, user, offer("x"), offer("y"), run_id=manual, now=NOW)
    res = await ingest(db, user, offer("x"), offer("y"), offer("z"), run_id=RUN, now=NOW + timedelta(minutes=1))
    assert [r.status for r in res.results] == ["duplicate", "duplicate", "created"]
    assert await opp_count(db, user) == 3 and await usage(db, user) == 3
    assert (await run_doc(db, user, RUN))["reserved"] == 1


async def test_ignored_or_converted_offer_is_not_reactivated(db):
    user = await new_user(db)
    res = await ingest(db, user, offer("ign"))
    await opportunity_service.ignore_opportunity(db, user, res.results[0].opportunity_id)
    again = await ingest(db, user, offer("ign"), run_id="veille-20261009-1800-prog", now=NOW + timedelta(hours=10))
    assert again.results[0].status == "duplicate"
    doc = await db.opportunities.find_one({"id": res.results[0].opportunity_id})
    assert doc["status"] == "ignored"


async def test_duplicate_costs_nothing_even_when_quota_exhausted(db):
    user = await new_user(db)
    await opportunity_service.ingest_opportunity(
        db, user, OpportunityCreate(title="T", company="C", url="https://careers.orange.com/jobs/known", source="manual"),
    )
    await db[svc.USAGE].insert_one({"user_id": user, "day": "2026-10-09", "creations": 40})
    res = await ingest(db, user, offer("known"), offer("new"))
    assert res.results[0].status == "duplicate"
    assert res.results[1].reasons == ["daily_quota_reached"]
    assert await usage(db, user) == 40 and (await run_doc(db, user))["reserved"] == 0


# ============================================
# Plafonds
# ============================================

async def test_run_cap_follows_preferences(db):
    user = await new_user(db)
    current = await prefs_svc.get_or_create(db, user)
    data = current.model_dump(exclude={"preferences_version", "updated_at"})
    await prefs_svc.update(db, user, WatchPreferencesUpdate(**{**data, "max_per_run": 2, "expected_version": 1}))
    res = await ingest(db, user, offer(1), offer(2), offer(3))
    assert [r.status for r in res.results] == ["created", "created", "rejected"]
    assert res.results[2].reasons == ["run_limit_reached"]
    assert res.run_totals.remaining_for_run == 0


async def test_daily_quota_is_per_paris_day_of_run_id(db):
    user = await new_user(db)
    # 18:00 Paris le 9, reprise à 00:30 Paris le 10 : quota imputé au 9
    run = "veille-20261009-1800-prog"
    await ingest(db, user, offer("a"), run_id=run, now=datetime(2026, 10, 9, 16, 2, tzinfo=UTC))
    await ingest(db, user, offer("b"), run_id=run, now=datetime(2026, 10, 9, 22, 30, tzinfo=UTC))
    assert await usage(db, user, "2026-10-09") == 2 and await usage(db, user, "2026-10-10") == 0


# ============================================
# Concurrence (répétée)
# ============================================

async def _assert_identical_concurrent_calls(db, user, offers, results):
    """Garanties d'idempotence et de quota, inchangées. Seule tolérance, prévue par la
    spécification (§7.3) : un appel concurrent peut recevoir `in_progress` (retryable) pour un
    élément encore traité par un autre appel. Une reprise renvoie alors le résultat enregistré."""
    n = len(offers)
    assert await opp_count(db, user) == n
    for i in range(n):
        items = [r.results[i] for r in results]
        created = [it for it in items if it.status == "created"]
        others = [it for it in items if it.status != "created"]
        assert sum(not it.replayed for it in created) == 1  # une seule création réelle
        assert len({it.opportunity_id for it in created}) == 1
        for it in others:  # uniquement l'attente prévue, jamais une autre erreur
            assert it.status == "error" and it.reasons == ["in_progress"] and it.retryable is True
            assert it.opportunity_id is None
    run = await run_doc(db, user)
    assert await usage(db, user) == n and run["reserved"] == n
    assert run["observed"] == {"created": n, "duplicate": 0, "rejected": 0, "error": 0}

    # Reprise : chaque élément renvoie son résultat enregistré, sans aucune écriture
    ids = {i: next(r.results[i].opportunity_id for r in results if r.results[i].status == "created") for i in range(n)}
    retry = await ingest(db, user, *offers)
    assert [it.status for it in retry.results] == ["created"] * n
    assert all(it.replayed for it in retry.results)
    assert {i: it.opportunity_id for i, it in enumerate(retry.results)} == ids
    assert await opp_count(db, user) == n and await usage(db, user) == n
    assert (await run_doc(db, user))["observed"]["created"] == n


@pytest.mark.parametrize("attempt", range(REPEAT))
async def test_concurrent_identical_calls_create_each_offer_once(db, attempt):
    user = await new_user(db)
    offers = [offer(f"same-{i}") for i in range(5)]
    results = await asyncio.gather(*[ingest(db, user, *offers) for _ in range(8)])
    await _assert_identical_concurrent_calls(db, user, offers, results)


@pytest.mark.parametrize("attempt", range(5))
async def test_concurrent_identical_calls_with_forced_in_progress(db, monkeypatch, attempt):
    """Attente nulle : les appels concurrents reçoivent `in_progress` de façon systématique,
    ce qui exerce à chaque exécution le chemin observé de façon intermittente sous charge."""
    monkeypatch.setattr(svc, "ITEM_WAIT_SECONDS", 0.0)
    user = await new_user(db)
    offers = [offer(f"busy-{i}") for i in range(5)]
    results = await asyncio.gather(*[ingest(db, user, *offers) for _ in range(8)])
    # Le chemin `in_progress` est bien exercé (sinon ce test ne prouverait rien)
    assert any(it.reasons == ["in_progress"] for r in results for it in r.results)
    await _assert_identical_concurrent_calls(db, user, offers, results)


@pytest.mark.parametrize("attempt", range(REPEAT))
async def test_thirty_parallel_offers_on_one_run_create_exactly_twenty(db, attempt):
    user = await new_user(db)
    results = await asyncio.gather(*[ingest(db, user, offer(f"p{i}")) for i in range(30)])
    statuses = [r.results[0].status for r in results]
    assert statuses.count("created") == 20
    assert all(r.results[0].reasons == ["run_limit_reached"] for r in results if r.results[0].status != "created")
    assert await opp_count(db, user) == 20 and await usage(db, user) == 20
    run = await run_doc(db, user)
    assert run["reserved"] == 20 and run["observed"]["created"] == 20


@pytest.mark.parametrize("attempt", range(REPEAT))
async def test_three_parallel_runs_respect_daily_quota_of_forty(db, attempt):
    user = await new_user(db)
    runs = [RUN, "veille-20261009-0802-manuel-aaaaaa", "veille-20261009-0802-manuel-bbbbbb"]
    calls = [ingest(db, user, offer(f"{r[-6:]}-{i}"), run_id=r) for r in runs for i in range(20)]
    results = await asyncio.gather(*calls)
    statuses = [r.results[0].status for r in results]
    assert statuses.count("created") == 40
    assert all(r.results[0].reasons == ["daily_quota_reached"] for r in results if r.results[0].status != "created")
    assert await opp_count(db, user) == 40 and await usage(db, user) == 40
    reserved = [(await run_doc(db, user, r))["reserved"] for r in runs]
    created = [(await run_doc(db, user, r))["observed"]["created"] for r in runs]
    assert reserved == created and sum(created) == 40


@pytest.mark.parametrize("attempt", range(REPEAT))
async def test_same_offer_in_parallel_runs_is_created_once(db, attempt):
    user = await new_user(db)
    runs = [RUN] + [f"veille-20261009-0802-manuel-{c * 6}" for c in "abcde"]
    results = await asyncio.gather(*[ingest(db, user, offer("shared"), run_id=r) for r in runs])
    statuses = sorted(r.results[0].status for r in results)
    assert statuses == ["created"] + ["duplicate"] * 5
    assert await opp_count(db, user) == 1 and await usage(db, user) == 1
    assert sum([(await run_doc(db, user, r))["reserved"] for r in runs]) == 1


# ============================================
# Interruption et reprise
# ============================================

async def _simulate_interrupted_item(db, user, o, *, age_seconds, reserved=True):
    """État laissé par un traitement interrompu APRÈS la réservation des quotas."""
    prefs = (await prefs_svc.get_or_create(db, user)).model_dump()
    await svc.ensure_indexes(db)
    run = await svc._open_run(db, user, RUN, prefs, NOW)
    from utils.watch_validation import check_item
    check = check_item(o, prefs, RUN)
    doc = {"user_id": user, "run_id": RUN, "item_key": check.item_key, "state": "pending",
           "claim_id": "crashed", "claimed_at": datetime.now(UTC) - timedelta(seconds=age_seconds),
           "expires_at": datetime.now(UTC) + timedelta(days=1)}
    if reserved:
        doc.update(reserved_run=True, reserved_day=True)
        assert await svc._reserve_run(db, user, RUN, 20)
        assert await svc._reserve_day(db, user, run.quota_day, 40)
    await db[svc.ITEMS].insert_one(doc)
    return check


async def test_resume_after_interruption_reuses_reservations(db):
    user = await new_user(db)
    o = offer("crash")
    await _simulate_interrupted_item(db, user, o, age_seconds=120)
    res = await ingest(db, user, o, now=NOW + timedelta(minutes=5))
    assert res.results[0].status == "created" and res.results[0].replayed is False
    assert await opp_count(db, user) == 1 and await usage(db, user) == 1
    run = await run_doc(db, user)
    assert run["reserved"] == 1 and run["observed"]["created"] == 1


async def test_resume_after_crash_between_creation_and_finalization(db):
    user = await new_user(db)
    o = offer("crash-late")
    check = await _simulate_interrupted_item(db, user, o, age_seconds=120)
    # L'offre a été créée par le traitement interrompu, sans finalisation
    await opportunity_service.ingest_opportunity(
        db, user, OpportunityCreate(**check.opportunity, source="chatgpt_watch"), watch=check.watch,
    )
    res = await ingest(db, user, o, now=NOW + timedelta(minutes=5))
    assert res.results[0].status == "created"
    assert await opp_count(db, user) == 1 and await usage(db, user) == 1
    assert (await run_doc(db, user))["reserved"] == 1


async def test_recent_pending_item_answers_in_progress(db):
    user = await new_user(db)
    o = offer("busy")
    await _simulate_interrupted_item(db, user, o, age_seconds=0, reserved=False)
    res = await ingest(db, user, o)
    assert res.results[0].status == "error" and res.results[0].reasons == ["in_progress"]
    assert res.results[0].retryable is True and await opp_count(db, user) == 0


async def test_ingestion_error_releases_quotas_and_item(db, monkeypatch):
    user = await new_user(db)

    async def boom(*args, **kwargs):
        raise RuntimeError("base indisponible")

    monkeypatch.setattr(opportunity_service, "ingest_opportunity", boom)
    res = await ingest(db, user, offer("err"))
    assert res.results[0].status == "error" and res.results[0].retryable is True
    assert res.results[0].reasons == ["temporarily_unavailable"]
    assert await usage(db, user) == 0 and (await run_doc(db, user))["reserved"] == 0
    assert await db[svc.ITEMS].count_documents({"user_id": user}) == 0

    monkeypatch.undo()
    retry = await ingest(db, user, offer("err"))
    assert retry.results[0].status == "created" and await usage(db, user) == 1


async def test_crash_during_release_leaves_a_blocked_place_never_an_excess(db, monkeypatch):
    """Arrêt brutal entre l'effacement de l'indicateur et la restitution de la place :
    la place reste bloquée (prudent) ; la reprise réserve à nouveau et ne dépasse rien."""
    user = await new_user(db)

    async def boom(*args, **kwargs):
        raise RuntimeError("base indisponible")

    async def crash(*args, **kwargs):
        raise RuntimeError("arrêt brutal")

    monkeypatch.setattr(opportunity_service, "ingest_opportunity", boom)
    monkeypatch.setattr(svc, "_release_run", crash)
    with pytest.raises(RuntimeError):
        await ingest(db, user, offer("c"))
    item = await db[svc.ITEMS].find_one({"user_id": user})
    assert item["state"] == "pending" and item["reserved_run"] is False and item["reserved_day"] is True
    assert (await run_doc(db, user))["reserved"] == 1  # place bloquée, non rattachée

    monkeypatch.undo()
    await db[svc.ITEMS].update_one(
        {"_id": item["_id"]}, {"$set": {"claimed_at": datetime.now(UTC) - timedelta(seconds=120)}},
    )
    res = await ingest(db, user, offer("c"), now=NOW + timedelta(minutes=5))
    assert res.results[0].status == "created"
    run = await run_doc(db, user)
    assert run["observed"]["created"] == 1 and run["reserved"] == 2  # 1 création + 1 place bloquée
    assert await usage(db, user) == 1  # réservation du jour reprise, pas dupliquée


async def test_blocked_places_reduce_capacity_without_exceeding(db):
    user = await new_user(db)
    await ingest(db, user, offer("first"))
    # 19 places bloquées par des interruptions : la capacité restante est nulle
    await db[svc.RUNS].update_one({"user_id": user, "run_id": RUN}, {"$inc": {"reserved": 19}})
    res = await ingest(db, user, offer("next"))
    assert res.results[0].reasons == ["run_limit_reached"]
    assert await opp_count(db, user) == 1 and (await run_doc(db, user))["reserved"] == 20


# ============================================
# Isolation
# ============================================

async def test_users_are_isolated(db):
    a, b = await new_user(db), await new_user(db)
    ra = await ingest(db, a, offer("shared"))
    rb = await ingest(db, b, offer("shared"))
    assert ra.results[0].status == rb.results[0].status == "created"
    assert ra.results[0].opportunity_id != rb.results[0].opportunity_id
    assert await usage(db, a) == 1 and await usage(db, b) == 1
    assert [r.run_id for r in (await svc.list_runs(db, b)).items] == [RUN]
    assert await db[svc.RUNS].count_documents({"run_id": RUN}) == 2


# ============================================
# Rapport et statut
# ============================================

async def test_report_last_one_wins_and_observed_counters_are_servers(db):
    user = await new_user(db)
    await ingest(db, user, offer(1), offer(2, relevance_score=1))
    r1 = await svc.report_watch_run(db, user, {"run_id": RUN, "status": "partial", "sent": 99}, now=NOW)
    r2 = await svc.report_watch_run(
        db, user, {"run_id": RUN, "status": "completed", "searched_sources": 12, "candidates_considered": 35,
                   "sent": 50, "notes": "RAS"}, now=NOW + timedelta(minutes=1),
    )
    assert r1.observed == r2.observed
    assert r2.observed.model_dump() == {"created": 1, "duplicate": 0, "rejected": 1, "error": 0}
    run = await run_doc(db, user)
    assert run["report"]["status"] == "completed" and run["report"]["sent"] == 50 and run["report_count"] == 2


async def test_report_for_run_without_offers_records_the_run(db):
    user = await new_user(db)
    r = await svc.report_watch_run(db, user, {"run_id": RUN, "status": "failed", "notes": "Erreur web"}, now=NOW)
    assert r.observed.model_dump() == {"created": 0, "duplicate": 0, "rejected": 0, "error": 0}
    assert (await run_doc(db, user))["report"]["status"] == "failed"


@pytest.mark.parametrize("payload", [
    {"run_id": RUN, "status": "done"},
    {"run_id": RUN, "status": "completed", "notes": "x" * 501},
    {"run_id": RUN, "status": "completed", "user_id": "victim"},
    {"run_id": RUN, "status": "completed", "sent": -1},
])
async def test_invalid_reports_are_refused(db, payload):
    user = await new_user(db)
    with pytest.raises(WatchRequestError) as e:
        await svc.report_watch_run(db, user, payload, now=NOW)
    assert e.value.code == "invalid_arguments"


async def test_status_reports_facts_and_presumed_missing_slots(db):
    user = await new_user(db)
    await ingest(db, user, offer(1))  # créneau de 08:00 reçu
    now = datetime(2026, 10, 9, 17, 0, tzinfo=UTC)  # 19:00 Paris : 18:00 passé de 60 min
    st = await svc.get_status(db, user, now=now)
    assert st.active is True and st.max_per_run == 20 and st.daily_quota == 40
    assert st.remaining_today == 39
    assert st.last_run.run_id == RUN and st.last_run.observed.created == 1
    assert st.presumed_missing_slots == [datetime(2026, 10, 9, 16, 0, tzinfo=UTC)]

    # 18:20 Paris : le créneau de 18:00 est dans le délai de grâce de 30 min ;
    # celui de la veille à 18:00 est hors de la fenêtre de 24 h
    early = await svc.get_status(db, user, now=datetime(2026, 10, 9, 16, 20, tzinfo=UTC))
    assert early.presumed_missing_slots == []

    # 08:20 Paris le 10 : le 18:00 du 9 manque toujours, le 08:00 du 10 est encore en délai de grâce
    next_day = await svc.get_status(db, user, now=datetime(2026, 10, 10, 6, 20, tzinfo=UTC))
    assert next_day.presumed_missing_slots == [datetime(2026, 10, 9, 16, 0, tzinfo=UTC)]
