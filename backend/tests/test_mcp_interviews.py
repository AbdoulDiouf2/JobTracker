"""Interview MCP contracts over the real OAuth transport and disposable MongoDB."""

import asyncio
import json
from datetime import datetime, timedelta, timezone

import pytest

from services import mcp_tools, oauth_service as oauth
from test_mcp_tools import call, mcp_on, owner, rpc  # activates MCP only in the disposable test fixture

pytestmark = pytest.mark.anyio

READ = ("interviews:read",)
WRITE = ("interviews:write",)
BOTH = READ + WRITE
NAMES = ("list_interviews", "get_interview", "create_interview", "update_interview", "delete_interview")


async def application(db, user_id, app_id="app-1", **extra):
    await db.applications.insert_one({"id": app_id, "user_id": user_id,
                                      "entreprise": "Example", "poste": "Engineer", **extra})
    return app_id


def payload(app_id="app-1", date="2026-10-20T09:00:00+02:00", **extra):
    return {"candidature_id": app_id, "date_entretien": date,
            "type_entretien": "technical", "format_entretien": "video", **extra}


async def invoke(api, who, name, args):
    error, result = await call(api, who, name, args)
    return error, result


async def test_catalogue_schemas_annotations_and_discovery(api, db):
    who = await owner(db, scopes=READ, watch_enabled=False)
    response = await rpc(api, who["token"], "tools/list")
    assert response.status_code == 200
    tools = {tool["name"]: tool for tool in response.json()["result"]["tools"]}
    assert len(tools) == 16 and set(NAMES) <= tools.keys()
    assert not any("reset" in name or "delete_all" in name for name in tools)
    for name in NAMES:
        tool = tools[name]
        scope = READ[0] if name in NAMES[:2] else WRITE[0]
        assert tool["securitySchemes"] == [{"type": "oauth2", "scopes": [scope]}]
        assert mcp_tools.TOOLS_BY_NAME[name].scope == scope
        assert tool["annotations"]["readOnlyHint"] == (scope == READ[0])
        assert tool["annotations"]["destructiveHint"] == (name == "delete_interview")
        assert tool["inputSchema"]["additionalProperties"] is False
        assert tool["outputSchema"]["additionalProperties"] is False
    assert tools["create_interview"]["inputSchema"]["properties"]["interview"]["additionalProperties"] is False
    assert tools["update_interview"]["inputSchema"]["properties"]["changes"]["additionalProperties"] is False
    assert tools["create_interview"]["annotations"]["idempotentHint"] is False
    assert tools["delete_interview"]["annotations"]["idempotentHint"] is False
    assert "interviews:read" in oauth.SUPPORTED_SCOPES and "interviews:write" in oauth.SUPPORTED_SCOPES
    assert oauth.client_scopes({}) == list(oauth.LEGACY_SCOPES)


async def test_read_list_filters_pagination_dates_and_owner(api, db):
    alice = await owner(db, scopes=BOTH, watch_enabled=False)
    bob = await owner(db, scopes=BOTH, watch_enabled=False)
    assert (await invoke(api, alice, "list_interviews", {})) == (
        False, {"items": [], "page": 1, "per_page": 20, "total": 0})
    await application(db, alice["user_id"])
    await application(db, bob["user_id"], "foreign")
    for interview_id, date, status, app_id, user_id in (
        ("b", "2026-10-20T09:00:00+02:00", "planned", "app-1", alice["user_id"]),
        ("a", "2026-10-20T07:00:00Z", "planned", "app-1", alice["user_id"]),
        ("c", "2026-10-20T08:00:00", "completed", "foreign", alice["user_id"]),
        ("z", "bad-date", "planned", "missing", alice["user_id"]),
        ("other", "2026-10-20T06:00:00Z", "planned", "foreign", bob["user_id"]),
    ):
        await db.interviews.insert_one({"id": interview_id, "user_id": user_id,
            "candidature_id": app_id, "date_entretien": date, "statut": status,
            "type_entretien": "technical", "format_entretien": "video"})
    _, first = await invoke(api, alice, "list_interviews", {"page": 1, "per_page": 2})
    _, second = await invoke(api, alice, "list_interviews", {"page": 2, "per_page": 2})
    assert first["total"] == second["total"] == 4
    assert [item["id"] for item in first["items"] + second["items"]] == ["a", "b", "c", "z"]
    assert second["items"][0]["date_entretien"] == "2026-10-20T08:00:00+00:00"
    assert second["items"][0]["entreprise"] == "N/A"
    assert second["items"][1]["date_entretien"] is None
    assert second["items"][1]["date_warning"] == "invalid_historical_date"
    for item in first["items"] + second["items"]:
        assert not {"user_id", "_id", "revision", "status_history"} & item.keys()
    _, filtered = await invoke(api, alice, "list_interviews", {"status": "completed", "interview_type": "technical",
        "interview_format": "video", "candidature_id": "foreign"})
    assert filtered["total"] == 1 and filtered["items"][0]["id"] == "c"
    error, foreign = await invoke(api, bob, "get_interview", {"interview_id": "a"})
    assert error and foreign["error"]["code"] == "not_found"
    _, detail = await invoke(api, alice, "get_interview", {"interview_id": "z"})
    assert detail["interview"]["status_history"] == []
    assert detail["interview"]["created_at"] is None


async def test_create_update_replay_and_delete(api, db):
    who = await owner(db, scopes=BOTH, watch_enabled=False)
    app_id = await application(db, who["user_id"])
    initial = payload(app_id, commentaire="Original")
    error, created = await invoke(api, who, "create_interview", {"interview": initial, "request_id": "same"})
    assert not error and created["created"] and not created["replayed"]
    interview_id = created["interview"]["id"]
    assert created["interview"]["date_entretien"] == "2026-10-20T07:00:00+00:00"
    assert not {"user_id", "_id", "status_history"} & created["interview"].keys()
    assert (await db.interviews.find_one({"id": interview_id}))["status_history"][0]["source"] == "mcp"
    assert not (await db.interviews.find_one({"id": interview_id})).get("google_calendar_event_id")
    error, updated = await invoke(api, who, "update_interview", {"interview_id": interview_id,
        "changes": {"date_entretien": "2026-10-21T10:00:00Z", "statut": "completed", "commentaire": "Changed"}})
    assert not error and updated["interview"]["statut"] == "completed"
    error, replay = await invoke(api, who, "create_interview", {"interview": initial, "request_id": "same"})
    assert not error and replay == {**created, "created": False, "replayed": True}
    assert (await db.interviews.find_one({"id": interview_id}))["commentaire"] == "Changed"
    _, detail = await invoke(api, who, "get_interview", {"interview_id": interview_id})
    assert [event["event_type"] for event in detail["interview"]["status_history"]] == ["created", "status_changed"]
    assert detail["interview"]["statut"] == "completed"
    error, conflict = await invoke(api, who, "create_interview", {"interview": payload(app_id, "2026-10-22T10:00:00Z"),
        "request_id": "same"})
    assert error and conflict["error"]["code"] == "conflict"
    error, deleted = await invoke(api, who, "delete_interview", {"interview_id": interview_id})
    assert not error and deleted == {"deleted": True, "interview_id": interview_id}
    assert await db.applications.count_documents({"id": app_id}) == 1
    assert await db.interviews.count_documents({"id": interview_id}) == 0
    for name, args in (("delete_interview", {"interview_id": interview_id}),
                       ("create_interview", {"interview": initial, "request_id": "same"})):
        error, result = await invoke(api, who, name, args)
        assert error and result["error"]["code"] in ("not_found", "conflict")


async def test_validation_null_fields_and_missing_owners(api, db):
    who = await owner(db, scopes=BOTH, watch_enabled=False)
    other = await owner(db, scopes=BOTH, watch_enabled=False)
    await application(db, who["user_id"])
    await application(db, who["user_id"], "deleting", deleting=True)
    await application(db, other["user_id"], "foreign")
    for interview in (payload(date="2026-10-20T09:00:00"), payload(type_entretien="bogus"),
                      payload(app_id="missing"), payload(app_id="foreign"), payload(app_id="deleting"),
                      payload(user_id=other["user_id"]), payload(commentaire="x" * 2001)):
        error, result = await invoke(api, who, "create_interview", {"interview": interview})
        assert error and result["error"]["code"] in ("invalid_arguments", "not_found")
    error, created = await invoke(api, who, "create_interview", {"interview": payload(commentaire="clear me")})
    assert not error
    interview_id = created["interview"]["id"]
    for changes in ({}, {"statut": None}, {"date_entretien": None}, {"user_id": "other"},
                    {"candidature_id": "foreign"}, {"unknown": "x"},
                    {"date_entretien": "2026-10-21T10:00:00"}):
        error, result = await invoke(api, who, "update_interview", {"interview_id": interview_id, "changes": changes})
        assert error and result["error"]["code"] == "invalid_arguments"
    error, cleared = await invoke(api, who, "update_interview", {"interview_id": interview_id,
        "changes": {"commentaire": None, "lieu_entretien": None, "interviewer": None}})
    assert not error and cleared["interview"]["commentaire"] is None
    error, foreign = await invoke(api, other, "update_interview", {"interview_id": interview_id,
        "changes": {"statut": "cancelled"}})
    assert error and foreign["error"]["code"] == "not_found"
    error, foreign = await invoke(api, other, "delete_interview", {"interview_id": interview_id})
    assert error and foreign["error"]["code"] == "not_found"


async def test_scopes_tokens_and_grant_isolation(api, db):
    reader = await owner(db, scopes=READ, watch_enabled=False)
    writer = await owner(db, scopes=WRITE, watch_enabled=False)
    legacy = await owner(db, scopes=("applications:read", "applications:write"), watch_enabled=False)
    both = await owner(db, scopes=BOTH, watch_enabled=False)
    for who, name, arguments in (
        (reader, "create_interview", {"interview": payload()}),
        (reader, "update_interview", {"interview_id": "missing", "changes": {"statut": "completed"}}),
        (reader, "delete_interview", {"interview_id": "missing"}),
        (writer, "list_interviews", {}),
        (writer, "get_interview", {"interview_id": "missing"}),
        (legacy, "list_interviews", {}),
        (legacy, "create_interview", {"interview": payload()}),
    ):
        response = await rpc(api, who["token"], "tools/call", {"name": name, "arguments": arguments})
        assert response.status_code == 403 and response.json() == {
            "error": "insufficient_scope", "scope": mcp_tools.TOOLS_BY_NAME[name].scope}
    assert (await rpc(api, both["token"], "tools/call", {"name": "list_interviews", "arguments": {}})).status_code == 200
    grant = await db[oauth.GRANTS].find_one({"id": both["grant_id"]})
    await oauth.set_client_scopes(db, grant["client_id"], ["interviews:read"])
    narrowed = await rpc(api, both["token"], "tools/call", {"name": "create_interview",
        "arguments": {"interview": payload()}})
    assert narrowed.status_code == 403 and narrowed.json()["scope"] == "interviews:write"
    assert (await db[oauth.GRANTS].find_one({"id": both["grant_id"]}))["scopes"] == list(BOTH)
    assert (await rpc(api, "invalid", "tools/call", {"name": "list_interviews", "arguments": {}})).status_code == 401
    await db[oauth.TOKENS].update_one({"token_hash": oauth.hash_secret(both["token"])},
                                      {"$set": {"expires_at": datetime.now(timezone.utc) - timedelta(seconds=1)}})
    assert (await rpc(api, both["token"], "tools/call", {"name": "list_interviews", "arguments": {}})).status_code == 401


async def test_concurrent_key_and_expiration(api, db):
    who = await owner(db, scopes=WRITE, watch_enabled=False)
    await application(db, who["user_id"])
    arguments = {"interview": payload(), "request_id": "concurrent"}
    results = await asyncio.gather(*[invoke(api, who, "create_interview", arguments) for _ in range(2)])
    assert all(not error for error, _ in results)
    assert results[0][1]["interview"]["id"] == results[1][1]["interview"]["id"]
    assert await db.interviews.count_documents({"user_id": who["user_id"]}) == 1
    await db.interview_idempotency.update_one({"request_id": "concurrent"},
        {"$set": {"expires_at": datetime.now(timezone.utc) - timedelta(seconds=1)}})
    error, result = await invoke(api, who, "create_interview", arguments)
    assert not error and result["created"] and not result["replayed"]
    assert await db.interviews.count_documents({"user_id": who["user_id"]}) == 2


async def test_schema_rejections_and_unbounded_mcp_pagination(api, db):
    who = await owner(db, scopes=BOTH, watch_enabled=False)
    for name, args in (
        ("list_interviews", {"page": 0}), ("list_interviews", {"per_page": 101}),
        ("list_interviews", {"per_page": "2"}), ("list_interviews", {"status": "bogus"}),
        ("list_interviews", {"status": None}), ("list_interviews", {"unknown": 1}),
        ("get_interview", {"interview_id": ""}),
        ("create_interview", {"interview": payload(), "request_id": ""}),
        ("create_interview", {"interview": payload(), "request_id": None}),
        ("create_interview", {"interview": payload(), "user_id": "forged"}),
    ):
        error, result = await invoke(api, who, name, args)
        assert error and result["error"]["code"] == "invalid_arguments"
        assert "forged" not in json.dumps(result)
    await application(db, who["user_id"])
    await db.interviews.insert_many([{"id": f"page-{i:03d}", "user_id": who["user_id"],
        "candidature_id": "app-1", "date_entretien": "2026-10-20T07:00:00Z",
        "statut": "planned", "type_entretien": "technical", "format_entretien": "video"}
        for i in range(501)])
    error, last = await invoke(api, who, "list_interviews", {"page": 6, "per_page": 100})
    assert not error and last["total"] == 501
    assert [item["id"] for item in last["items"]] == ["page-500"]


async def test_parallel_status_changes_keep_history_atomic(api, db):
    who = await owner(db, scopes=BOTH, watch_enabled=False)
    await application(db, who["user_id"])
    _, created = await invoke(api, who, "create_interview", {"interview": payload()})
    interview_id = created["interview"]["id"]
    results = await asyncio.gather(
        invoke(api, who, "update_interview", {"interview_id": interview_id, "changes": {"statut": "completed"}}),
        invoke(api, who, "update_interview", {"interview_id": interview_id, "changes": {"statut": "cancelled"}}),
    )
    assert all(not error for error, _ in results)
    row = await db.interviews.find_one({"id": interview_id})
    assert [event["event_type"] for event in row["status_history"]] == ["created", "status_changed", "status_changed"]
    assert row["status_history"][2]["previous_status"] == row["status_history"][1]["new_status"]
    assert row["statut"] == row["status_history"][-1]["new_status"]


async def test_history_allowlist_on_real_mcp_response(api, db):
    reader = await owner(db, scopes=READ, watch_enabled=False)
    outsider = await owner(db, scopes=READ, watch_enabled=False)
    writer = await owner(db, scopes=WRITE, watch_enabled=False)
    await application(db, reader["user_id"])
    first = {"event_id": "first", "event_type": "created", "previous_status": None,
             "new_status": "planned", "changed_at": "2026-10-20T07:00:00+00:00",
             "source": "mcp", "client_id": "oauth-client-id", "user_id": "private-user",
             "_id": "private-id", "internal_debug": "private-debug", "unknown": "private-unknown"}
    second = {"event_id": "second", "event_type": "status_changed", "previous_status": "planned",
              "new_status": "completed", "changed_at": "2026-10-21T07:00:00+00:00",
              "source": "web"}  # legacy event without optional client_id
    malformed = {"event_id": "broken", "event_type": "status_changed", "new_status": {"bad": "shape"},
                 "internal_debug": "private-malformed"}
    await db.interviews.insert_one({"id": "history-test", "user_id": reader["user_id"],
        "candidature_id": "app-1", "date_entretien": "2026-10-20T07:00:00Z",
        "statut": "completed", "type_entretien": "technical", "format_entretien": "video",
        "status_history": [first, malformed, second]})
    stored_before = await db.interviews.find_one({"id": "history-test"})

    response = await rpc(api, reader["token"], "tools/call",
        {"name": "get_interview", "arguments": {"interview_id": "history-test"}})
    assert response.status_code == 200
    result = response.json()["result"]
    assert result["isError"] is False
    content = json.loads(result["content"][0]["text"])
    assert result["structuredContent"] == content
    history = content["interview"]["status_history"]
    assert [event["event_id"] for event in history] == ["first", "second"]
    assert history[0] == {key: first[key] for key in (
        "event_id", "event_type", "previous_status", "new_status", "changed_at", "source", "client_id")}
    assert history[1] == {**second, "client_id": None}
    for representation in (result["structuredContent"], content):
        serialized = json.dumps(representation)
        assert not any(value in serialized for value in (
            "private-user", "private-id", "private-debug", "private-unknown", "private-malformed"))
        assert all(set(event) == set(history[0]) for event in representation["interview"]["status_history"])
    assert await db.interviews.find_one({"id": "history-test"}) == stored_before

    _, listed = await invoke(api, reader, "list_interviews", {})
    assert all("status_history" not in item for item in listed["items"])
    foreign = await rpc(api, outsider["token"], "tools/call",
        {"name": "get_interview", "arguments": {"interview_id": "history-test"}})
    assert foreign.status_code == 200
    assert foreign.json()["result"]["isError"] is True
    assert json.loads(foreign.json()["result"]["content"][0]["text"])["error"]["code"] == "not_found"
    denied = await rpc(api, writer["token"], "tools/call",
        {"name": "get_interview", "arguments": {"interview_id": "history-test"}})
    assert denied.status_code == 403 and denied.json()["scope"] == "interviews:read"


async def test_absent_empty_and_malformed_history_stays_private(api, db):
    who = await owner(db, scopes=READ, watch_enabled=False)
    await application(db, who["user_id"])
    for interview_id, history in (("absent", None), ("empty", []), ("bad", {"secret": "private"})):
        row = {"id": interview_id, "user_id": who["user_id"], "candidature_id": "app-1",
               "date_entretien": "2026-10-20T07:00:00Z", "statut": "planned",
               "type_entretien": "technical", "format_entretien": "video"}
        if history is not None:
            row["status_history"] = history
        await db.interviews.insert_one(row)
        error, detail = await invoke(api, who, "get_interview", {"interview_id": interview_id})
        assert not error and detail["interview"]["status_history"] == []
        assert "private" not in json.dumps(detail)
