"""Application MCP CRUD through the real OAuth-backed transport."""

import asyncio

import pytest
from fastapi import HTTPException

from models import JobApplicationUpdate
from routes import applications as application_routes
from services import mcp_application_service as application_service, mcp_tools, oauth_service as oauth
from test_mcp_tools import call, mcp_on, owner, rpc  # shared HTTP/Mongo fixtures

pytestmark = pytest.mark.anyio

APP_SCOPES = ("applications:read", "applications:write")


async def test_crud_filters_and_isolation(api, db):
    alice = await owner(db, scopes=APP_SCOPES, watch_enabled=False)
    bob = await owner(db, scopes=APP_SCOPES, watch_enabled=False)
    error, created = await call(api, alice, "create_application", {
        "status": "to_apply", "application": {"entreprise": "Acme", "poste": "Data Engineer",
            "commentaire": "Note privée", "contact_email": "rh@example.com"},
    })
    assert not error and created["reponse"] == "to_apply" and created["source"] == "mcp"
    app_id = created["id"]
    error, listed = await call(api, alice, "list_applications", {"search": "Acme", "page": 1, "per_page": 1})
    assert not error and listed["total"] == 1 and listed["items"][0]["id"] == app_id
    error, detail = await call(api, alice, "get_application", {"application_id": app_id})
    assert not error and detail["commentaire"] == "Note privée" and detail["contact_email"] == "rh@example.com"
    error, other = await call(api, bob, "get_application", {"application_id": app_id})
    assert error and other["error"]["code"] == "not_found"
    error, other = await call(api, bob, "update_application", {"application_id": app_id, "changes": {"poste": "X"}})
    assert error and other["error"]["code"] == "not_found"
    error, other = await call(api, bob, "delete_application", {"application_id": app_id})
    assert error and other["error"]["code"] == "not_found"

    error, invalid = await call(api, alice, "update_application", {
        "application_id": app_id, "changes": {"reponse": "pending"}})
    assert error and invalid["error"]["code"] == "invalid_arguments"
    error, updated = await call(api, alice, "update_application", {
        "application_id": app_id, "changes": {"reponse": "pending", "date_candidature": "2026-10-10T12:00:00Z"}})
    assert not error and updated["reponse"] == "pending"
    assert updated["history"][-1]["event_type"] == "status_change"

    await db.interviews.insert_one({"candidature_id": app_id, "user_id": alice["user_id"]})
    error, deleted = await call(api, alice, "delete_application", {"application_id": app_id})
    assert not error and deleted["deleted"]
    assert await db.applications.count_documents({"id": app_id}) == 0
    assert await db.interviews.count_documents({"candidature_id": app_id}) == 0


async def test_scopes_and_create_validation(api, db):
    old = await owner(db, scopes=("watch:read", "opportunities:write"))
    response = await rpc(api, old["token"], "tools/call", {"name": "list_applications", "arguments": {}})
    assert response.status_code == 403
    alice = await owner(db, scopes=APP_SCOPES, watch_enabled=False)
    error, result = await call(api, alice, "create_application", {
        "status": "pending", "application": {"entreprise": "Acme", "poste": "Analyst"}})
    assert error and result["error"]["code"] == "invalid_arguments"
    error, result = await call(api, alice, "create_application", {
        "status": "pending", "application": {"entreprise": "Acme", "poste": "Analyst",
            "date_candidature": "2026-10-10T12:00:00Z"}})
    assert not error and result["reponse"] == "pending"
    error, result = await call(api, alice, "list_applications", {"status": "pending"})
    assert not error and result["total"] == 1
    assert oauth.client_scopes({}) == ["watch:read", "opportunities:write"]
    assert mcp_tools.TOOLS_BY_NAME["delete_application"].destructive is True


async def test_read_and_write_scopes_are_separate(api, db):
    reader = await owner(db, scopes=("applications:read",), watch_enabled=False)
    writer = await owner(db, scopes=("applications:write",), watch_enabled=False)
    for who, name, args in (
        (reader, "create_application", {"status": "to_apply", "application": {"entreprise": "A", "poste": "B"}}),
        (reader, "update_application", {"application_id": "missing", "changes": {"poste": "B"}}),
        (reader, "delete_application", {"application_id": "missing"}),
        (writer, "list_applications", {}),
        (writer, "get_application", {"application_id": "missing"}),
    ):
        response = await rpc(api, who["token"], "tools/call", {"name": name, "arguments": args})
        assert response.status_code == 403 and response.json()["error"] == "insufficient_scope"


async def test_partial_fields_identity_and_dates(api, db):
    who = await owner(db, scopes=APP_SCOPES, watch_enabled=False)
    first = await application_service.create_application(db, who["user_id"], {
        "status": "pending", "application": {"entreprise": "A", "poste": "One",
            "date_candidature": "2026-10-10T12:00:00+02:00", "commentaire": "clear me"}})
    second = await application_service.create_application(db, who["user_id"], {
        "status": "pending", "application": {"entreprise": "B", "poste": "Two",
            "date_candidature": "2026-10-10T09:30:00Z"}})
    result = await application_service.list_applications(db, who["user_id"], {
        "date_from": "2026-10-10T09:45:00Z", "date_to": "2026-10-10T12:00:00+02:00"})
    assert result["total"] == 1 and result["items"][0]["id"] == first["id"]
    assert second["id"] not in [item["id"] for item in result["items"]]
    result = await application_service.update_application(db, who["user_id"], {
        "application_id": first["id"], "changes": {"commentaire": None}})
    assert result["commentaire"] is None and result["poste"] == "One"
    for changes in ({"poste": None}, {"user_id": "other"}, {"source": "webapp"}, {"unknown": "x"}):
        with pytest.raises(application_service.ApplicationToolError) as error:
            await application_service.update_application(db, who["user_id"], {
                "application_id": first["id"], "changes": changes})
        assert error.value.code == "invalid_arguments"
    for payload in ({"user_id": "other"}, {"source": "webapp"}, {"unknown": "x"}):
        with pytest.raises(application_service.ApplicationToolError):
            await application_service.create_application(db, who["user_id"], {
                "status": "to_apply", "application": {"entreprise": "A", "poste": "B", **payload}})


async def test_status_transition_rechecks_after_concurrent_write(db):
    await db.applications.insert_one({"id": "race", "user_id": "alice", "entreprise": "A", "poste": "B",
        "reponse": "pending", "date_candidature": "2026-10-10T12:00:00+00:00", "history": []})
    paused, resume = asyncio.Event(), asyncio.Event()

    class CollectionProxy:
        def __init__(self, coll):
            self.coll = coll
        def __getattr__(self, name):
            return getattr(self.coll, name)
        async def update_one(self, *args, **kwargs):
            if asyncio.current_task().get_name() == "stale":
                paused.set()
                await resume.wait()
            return await self.coll.update_one(*args, **kwargs)

    class DbProxy:
        applications = CollectionProxy(db.applications)
        interviews = db.interviews

    stale = asyncio.create_task(application_routes.update_application(
        "race", JobApplicationUpdate(reponse="pending"), {"user_id": "alice"}, DbProxy()), name="stale")
    await paused.wait()
    await application_routes.update_application(
        "race", JobApplicationUpdate(reponse="to_apply"), {"user_id": "alice"}, db)
    resume.set()
    with pytest.raises(HTTPException) as error:
        await stale
    assert error.value.status_code == 422
    assert (await db.applications.find_one({"id": "race"}))["reponse"] == "to_apply"


async def test_delete_recovers_from_interview_failure(db):
    await db.applications.insert_one({"id": "delete-me", "user_id": "alice", "entreprise": "A", "poste": "B"})
    await db.interviews.insert_many([
        {"id": "own", "candidature_id": "delete-me", "user_id": "alice"},
        {"id": "other", "candidature_id": "delete-me", "user_id": "bob"},
    ])

    class InterviewsProxy:
        def __init__(self, coll):
            self.coll, self.fail = coll, True
        async def delete_many(self, query):
            if self.fail:
                self.fail = False
                raise RuntimeError("injected failure")
            return await self.coll.delete_many(query)

    class DbProxy:
        applications = db.applications
        interviews = InterviewsProxy(db.interviews)
        application_deletion_receipts = db.application_deletion_receipts

    with pytest.raises(RuntimeError):
        await application_routes.delete_application("delete-me", {"user_id": "alice"}, DbProxy())
    assert (await db.applications.find_one({"id": "delete-me"}))["deleting"] is True
    await application_routes.delete_application("delete-me", {"user_id": "alice"}, DbProxy())
    await application_routes.delete_application("delete-me", {"user_id": "alice"}, DbProxy())
    assert await db.applications.count_documents({"id": "delete-me"}) == 0
    assert await db.interviews.count_documents({"id": "own"}) == 0
    assert await db.interviews.count_documents({"id": "other"}) == 1


async def test_delete_recovers_after_receipt_before_final_delete(db):
    await db.applications.insert_one({"id": "late-failure", "user_id": "alice",
                                      "entreprise": "A", "poste": "B"})
    await db.interviews.insert_one({"id": "interview", "candidature_id": "late-failure", "user_id": "alice"})

    class ApplicationsProxy:
        def __init__(self, coll):
            self.coll, self.fail = coll, True
        def __getattr__(self, name):
            return getattr(self.coll, name)
        async def delete_one(self, query):
            if self.fail:
                self.fail = False
                raise RuntimeError("injected final-delete failure")
            return await self.coll.delete_one(query)

    class DbProxy:
        applications = ApplicationsProxy(db.applications)
        interviews = db.interviews
        application_deletion_receipts = db.application_deletion_receipts

    with pytest.raises(RuntimeError):
        await application_routes.delete_application("late-failure", {"user_id": "alice"}, DbProxy())
    assert (await db.applications.find_one({"id": "late-failure"}))["deleting"] is True
    assert await db.interviews.count_documents({"id": "interview"}) == 0
    assert await db.application_deletion_receipts.count_documents({"application_id": "late-failure"}) == 1
    await application_routes.delete_application("late-failure", {"user_id": "alice"}, DbProxy())
    await application_routes.delete_application("late-failure", {"user_id": "alice"}, DbProxy())
    with pytest.raises(HTTPException) as error:
        await application_routes.delete_application("late-failure", {"user_id": "bob"}, DbProxy())
    assert error.value.status_code == 404
    assert await db.applications.count_documents({"id": "late-failure"}) == 0
