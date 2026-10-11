"""Lot 1 interview service and REST contracts on the disposable Mongo fixture."""

import asyncio
from datetime import datetime, timezone

import pytest
from fastapi import HTTPException

from models import InterviewCreate, InterviewUpdate
from services import interview_service as service

pytestmark = pytest.mark.anyio


async def _app(db, user_id, app_id="application-1"):
    await db.applications.insert_one({"id": app_id, "user_id": user_id,
                                      "entreprise": "Example", "poste": "Engineer"})
    return app_id


def _data(app_id, date="2026-10-20T09:00:00+02:00"):
    return InterviewCreate(candidature_id=app_id, date_entretien=date,
                           type_entretien="technical", format_entretien="video")


async def test_rest_crud_history_and_isolation(api, db):
    alice, bob = api.users["a"], api.users["b"]
    app_id = await _app(db, alice)
    data = _data(app_id).model_dump(mode="json")
    created = await api.post("/api/interviews", json=data, headers=api.headers_for("a"))
    assert created.status_code == 201, created.text
    interview_id = created.json()["id"]
    assert created.json()["entreprise"] == "Example"
    assert (await db.interviews.find_one({"id": interview_id}))["status_history"][0]["event_type"] == "created"
    assert (await api.get("/api/interviews", headers=api.headers_for("a"))).json()[0]["id"] == interview_id
    assert (await api.get(f"/api/interviews/{interview_id}", headers=api.headers_for("b"))).status_code == 404
    assert (await api.put(f"/api/interviews/{interview_id}", json={"statut": "completed"},
                          headers=api.headers_for("b"))).status_code == 404
    changed = await api.put(f"/api/interviews/{interview_id}", json={"statut": "completed"},
                            headers=api.headers_for("a"))
    assert changed.status_code == 200, changed.text
    await api.put(f"/api/interviews/{interview_id}", json={"statut": "completed"},
                  headers=api.headers_for("a"))
    history = (await db.interviews.find_one({"id": interview_id}))["status_history"]
    assert [e["event_type"] for e in history] == ["created", "status_changed"]
    assert (await api.delete(f"/api/interviews/{interview_id}", headers=api.headers_for("b"))).status_code == 404
    assert (await api.delete(f"/api/interviews/{interview_id}", headers=api.headers_for("a"))).status_code == 204
    assert (await api.delete(f"/api/interviews/{interview_id}", headers=api.headers_for("a"))).status_code == 404
    assert await db.applications.count_documents({"id": app_id, "user_id": alice}) == 1


async def test_enrichment_never_reads_foreign_application(db):
    await _app(db, "bob", "foreign")
    await db.interviews.insert_one({"id": "orphan", "user_id": "alice", "candidature_id": "foreign",
                                    "date_entretien": "2026-10-20T07:00:00+00:00", "statut": "planned",
                                    "type_entretien": "technical", "format_entretien": "video"})
    item = await service.get_interview(db, "alice", "orphan")
    assert item["entreprise"] == "N/A"
    items, total = await service.list_interviews(db, "alice", {})
    assert total == 1 and items[0]["entreprise"] == "N/A"


async def test_partial_null_dates_and_history(db):
    app_id = await _app(db, "alice")
    created, _ = await service.create_interview(db, "alice", _data(app_id))
    interview_id = created["id"]
    await service.update_interview(db, "alice", interview_id,
                                   InterviewUpdate(lieu_entretien="Somewhere"))
    updated = await service.update_interview(db, "alice", interview_id,
                                   InterviewUpdate(lieu_entretien=None, statut="cancelled"))
    assert updated["lieu_entretien"] is None and updated["statut"] == "cancelled"
    assert len((await service.get_interview(db, "alice", interview_id, history=True))["status_history"]) == 2
    with pytest.raises(service.InterviewError) as exc:
        await service.update_interview(db, "alice", interview_id, InterviewUpdate(statut=None))
    assert exc.value.code == "invalid_arguments"
    with pytest.raises(service.InterviewError):
        await service.create_interview(db, "alice", _data(app_id, "2026-10-20T09:00:00"), require_offset=True)
    assert service.utc_date("2026-10-20T09:00:00") == datetime(2026, 10, 20, 9, tzinfo=timezone.utc)
    assert service.utc_date("bad-date") is None


async def test_rest_explicit_null_and_empty_string(api, db):
    await _app(db, api.users["a"])
    created = await api.post("/api/interviews", json=_data("application-1").model_dump(mode="json"),
                             headers=api.headers_for("a"))
    interview_id = created.json()["id"]
    base = f"/api/interviews/{interview_id}"
    set_value = await api.put(base, json={"commentaire": "note"}, headers=api.headers_for("a"))
    assert set_value.status_code == 200 and set_value.json()["commentaire"] == "note"
    empty = await api.put(base, json={"commentaire": ""}, headers=api.headers_for("a"))
    assert empty.status_code == 200 and empty.json()["commentaire"] == ""
    cleared = await api.put(base, json={"commentaire": None}, headers=api.headers_for("a"))
    assert cleared.status_code == 200 and cleared.json()["commentaire"] is None
    invalid = await api.put(base, json={"statut": None}, headers=api.headers_for("a"))
    assert invalid.status_code == 400


async def test_creation_rejects_foreign_or_deleting_application(db):
    await _app(db, "bob", "foreign")
    await _app(db, "alice", "deleting")
    await db.applications.update_one({"id": "deleting"}, {"$set": {"deleting": True}})
    for app_id in ("foreign", "deleting", "absent"):
        with pytest.raises(service.InterviewError) as exc:
            await service.create_interview(db, "alice", _data(app_id))
        assert exc.value.code == "not_found"
    assert await db.interviews.count_documents({"user_id": "alice"}) == 0


async def test_creation_rolls_back_when_application_deletion_starts(db, monkeypatch):
    await _app(db, "alice")
    original = service._application
    active_reads = 0

    async def application_with_deletion(database, user_id, candidature_id, *, active=False):
        nonlocal active_reads
        if active:
            active_reads += 1
            if active_reads == 2:
                await database.applications.update_one(
                    {"id": candidature_id, "user_id": user_id}, {"$set": {"deleting": True}})
        return await original(database, user_id, candidature_id, active=active)

    monkeypatch.setattr(service, "_application", application_with_deletion)
    with pytest.raises(service.InterviewError) as exc:
        await service.create_interview(db, "alice", _data("application-1"))
    assert exc.value.code == "not_found"
    assert await db.interviews.count_documents({"user_id": "alice"}) == 0


async def test_idempotent_create_and_replay_after_delete(db):
    app_id = await _app(db, "alice")
    one, replayed = await service.create_interview(db, "alice", _data(app_id), request_id="same")
    await service.update_interview(db, "alice", one["id"], InterviewUpdate(
        date_entretien="2026-10-22T10:00:00Z", statut="completed", commentaire="Changed"))
    two, replayed_again = await service.create_interview(db, "alice", _data(app_id, "2026-10-20T07:00:00Z"), request_id="same")
    assert not replayed and replayed_again and one == two
    stored = await service.get_interview(db, "alice", one["id"])
    assert stored["statut"] == "completed"
    assert stored["commentaire"] == "Changed"
    assert stored["date_entretien"] == "2026-10-22T10:00:00+00:00"
    assert await db.interviews.count_documents({"user_id": "alice"}) == 1
    receipt = await db.interview_idempotency.find_one({"request_id": "same"})
    assert receipt["status"] == "complete" and receipt["initial_result"] == one
    assert not {"user_id", "_id", "status_history", "revision"} & receipt["initial_result"].keys()
    with pytest.raises(service.InterviewError) as exc:
        await service.create_interview(db, "alice", _data(app_id, "2026-10-21T07:00:00Z"), request_id="same")
    assert exc.value.code == "conflict"
    await service.delete_interview(db, "alice", one["id"])
    with pytest.raises(service.InterviewError) as exc:
        await service.create_interview(db, "alice", _data(app_id), request_id="same")
    assert exc.value.code == "conflict"


async def test_concurrent_key_creates_once(db):
    app_id = await _app(db, "alice")
    results = await asyncio.gather(*[
        service.create_interview(db, "alice", _data(app_id), request_id="concurrent")
        for _ in range(2)
    ])
    assert results[0][0]["id"] == results[1][0]["id"]
    assert await db.interviews.count_documents({"user_id": "alice"}) == 1


async def test_chronological_pagination_and_invalid_date(api, db):
    await _app(db, api.users["a"])
    for interview_id, value in (("b", "2026-10-20T09:00:00+02:00"),
                                ("a", "2026-10-20T07:00:00Z"),
                                ("c", "2026-10-20T08:00:00"),
                                ("z", "not-a-date")):
        await db.interviews.insert_one({"id": interview_id, "user_id": api.users["a"],
                                        "candidature_id": "application-1", "date_entretien": value,
                                        "type_entretien": "technical", "format_entretien": "video",
                                        "statut": "planned"})
    first, total = await service.list_interviews(db, api.users["a"], {}, page=1, per_page=2)
    second, _ = await service.list_interviews(db, api.users["a"], {}, page=2, per_page=2)
    assert total == 4
    assert [r["id"] for r in first + second] == ["a", "b", "c", "z"]
    assert second[-1]["date_warning"] == "invalid_historical_date"
    rest = await api.get("/api/interviews", headers=api.headers_for("a"))
    assert rest.status_code == 200 and rest.json()[-1]["date_warning"] == "invalid_historical_date"
    assert rest.json()[-1]["date_entretien"] is None


async def test_foreign_application_not_counted_or_exported(api, db):
    alice = api.users["a"]
    await _app(db, alice)
    await db.interviews.insert_one({"id": "foreign-interview", "user_id": api.users["b"],
                                    "candidature_id": "application-1", "date_entretien": "2026-10-20T07:00:00Z",
                                    "type_entretien": "technical", "format_entretien": "video", "statut": "planned"})
    response = await api.get("/api/applications", headers=api.headers_for("a"))
    assert response.status_code == 200
    assert response.json()["items"][0]["interviews_count"] == 0
    exported = await api.get("/api/export/json", headers=api.headers_for("a"))
    assert exported.status_code == 200
    assert exported.json()["applications"][0]["entretiens"] == []


async def test_calendar_sync_checks_owner_and_uses_interview_location(db, monkeypatch):
    from routes import calendar
    await _app(db, "alice")
    created, _ = await service.create_interview(db, "alice", _data("application-1"))
    await db.interviews.update_one({"id": created["id"]}, {"$set": {"lieu_entretien": "Room 4"}})
    seen = {}

    async def capture(event, current_user, database):
        seen["location"] = event.location
        seen["title"] = event.title
        return {"id": "calendar-test"}

    monkeypatch.setattr(calendar, "create_calendar_event", capture)
    with pytest.raises(HTTPException) as exc:
        await calendar.sync_interview_to_calendar(created["id"], {"user_id": "bob"}, db)
    assert exc.value.status_code == 404
    await calendar.sync_interview_to_calendar(created["id"], {"user_id": "alice"}, db)
    assert seen == {"location": "Room 4", "title": "Entretien - Example"}


async def test_idempotency_recovery_and_expiration(db):
    from datetime import timedelta
    await _app(db, "alice")
    data = _data("application-1")
    receipt, claimed = await service._reserve(db, "alice", "before-insert", service._fingerprint(data), None)
    assert claimed
    await db.interview_idempotency.update_one({"_id": receipt["_id"]},
        {"$set": {"lease_until": datetime.now(timezone.utc) - timedelta(seconds=1)}})
    created, replayed = await service.create_interview(db, "alice", data, request_id="before-insert")
    assert not replayed and created["id"] == receipt["interview_id"]
    await db.interview_idempotency.update_one({"request_id": "before-insert"},
        {"$set": {"status": "pending", "lease_until": datetime.now(timezone.utc) - timedelta(seconds=1)}})
    again, replayed = await service.create_interview(db, "alice", data, request_id="before-insert")
    assert replayed and again["id"] == created["id"]
    assert await db.interviews.count_documents({"id": created["id"]}) == 1
    await db.interview_idempotency.update_one({"request_id": "before-insert"},
        {"$set": {"expires_at": datetime.now(timezone.utc) - timedelta(seconds=1)}})
    renewed, replayed = await service.create_interview(db, "alice", data, request_id="before-insert")
    assert not replayed and renewed["id"] != created["id"]


async def test_interrupted_finalization_preserves_original_result(db, monkeypatch):
    from datetime import timedelta
    await _app(db, "alice")
    data = _data("application-1")
    original = service._complete_receipt

    async def interrupted(*args):
        raise RuntimeError("simulated process stop before receipt finalization")

    monkeypatch.setattr(service, "_complete_receipt", interrupted)
    with pytest.raises(RuntimeError):
        await service.create_interview(db, "alice", data, request_id="interrupted")
    receipt = await db.interview_idempotency.find_one({"request_id": "interrupted"})
    assert receipt["status"] == "pending" and receipt["initial_result"]
    initial = receipt["initial_result"]
    assert await db.interviews.count_documents({"id": receipt["interview_id"]}) == 1
    monkeypatch.setattr(service, "_complete_receipt", original)
    await service.update_interview(db, "alice", receipt["interview_id"],
                                   InterviewUpdate(statut="cancelled", commentaire="Later"))
    await db.interview_idempotency.update_one({"_id": receipt["_id"]},
        {"$set": {"lease_until": datetime.now(timezone.utc) - timedelta(seconds=1)}})
    recovered, replayed = await service.create_interview(db, "alice", data, request_id="interrupted")
    assert replayed and recovered == initial
    assert await db.interviews.count_documents({"id": receipt["interview_id"]}) == 1
    assert (await db.interviews.find_one({"id": receipt["interview_id"]}))["statut"] == "cancelled"
    complete = await db.interview_idempotency.find_one({"_id": receipt["_id"]})
    assert complete["status"] == "complete" and complete["initial_result"] == initial


async def test_concurrent_status_changes_are_recorded_atomically(db):
    await _app(db, "alice")
    created, _ = await service.create_interview(db, "alice", _data("application-1"))
    await asyncio.gather(
        service.update_interview(db, "alice", created["id"], InterviewUpdate(statut="completed")),
        service.update_interview(db, "alice", created["id"], InterviewUpdate(statut="cancelled")),
    )
    row = await db.interviews.find_one({"id": created["id"], "user_id": "alice"})
    assert len(row["status_history"]) == 3
    assert row["status_history"][1]["previous_status"] == "planned"
    assert row["status_history"][2]["previous_status"] == row["status_history"][1]["new_status"]
    assert row["statut"] == row["status_history"][-1]["new_status"]


async def test_upcoming_and_statistics_use_instants_not_iso_string_order(db):
    from datetime import timedelta
    from routes import notifications
    now = datetime.now(timezone.utc)
    future = now + timedelta(hours=2)
    past = now - timedelta(hours=2)
    for interview_id, date in (("future", future.astimezone(timezone(timedelta(hours=2))).isoformat()),
                               ("past", past.astimezone(timezone(timedelta(hours=-5))).isoformat()),
                               ("invalid", "bad-date")):
        await db.interviews.insert_one({"id": interview_id, "user_id": "alice", "statut": "planned",
                                        "candidature_id": "none", "date_entretien": date,
                                        "type_entretien": "technical", "format_entretien": "video"})
    upcoming = await service.upcoming_interviews(db, "alice", 5)
    assert [row["id"] for row in upcoming] == ["future"]
    widget = await notifications.get_upcoming_reminders({"user_id": "alice"}, db)
    assert [row["id"] for row in widget] == ["future"]
    count = await service.count_interviews_between(db, "alice", now, now + timedelta(hours=24))
    assert count == 1


async def test_export_orders_mixed_offsets_chronologically(db):
    from routes.export import _sorted_interviews
    for interview_id, date in (("early", "2026-10-20T09:00:00+02:00"),
                               ("late", "2026-10-20T08:00:00Z"),
                               ("invalid", "bad-date")):
        await db.interviews.insert_one({"id": interview_id, "user_id": "alice", "date_entretien": date})
    rows = await _sorted_interviews(db, "alice")
    assert [row["id"] for row in rows] == ["late", "early", "invalid"]
