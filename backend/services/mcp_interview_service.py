"""Strict MCP adapter for the shared interview service; no transport or REST calls."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator, model_validator

from models import InterviewCreate, InterviewFormat, InterviewStatus, InterviewType, InterviewUpdate
from services import interview_service


class InterviewToolError(Exception):
    def __init__(self, code: str, details: Optional[list] = None):
        self.code = code
        self.details = details or []
        super().__init__(code)


def _parse(model, arguments: dict):
    try:
        return model.model_validate(arguments)
    except ValidationError as exc:
        details = [{"loc": [str(part) for part in error["loc"]], "type": error["type"]}
                   for error in exc.errors()]
        raise InterviewToolError("invalid_arguments", details) from exc


class _StrictArgs(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ListArgs(_StrictArgs):
    status: Optional[InterviewStatus] = None
    interview_type: Optional[InterviewType] = None
    interview_format: Optional[InterviewFormat] = None
    candidature_id: Optional[str] = Field(None, min_length=1)
    page: int = Field(1, ge=1, strict=True)
    per_page: int = Field(20, ge=1, le=100, strict=True)

    @model_validator(mode="before")
    @classmethod
    def reject_explicit_null(cls, value):
        if isinstance(value, dict) and any(value.get(key) is None for key in value):
            raise ValueError("null_filter_not_allowed")
        return value


class IdArgs(_StrictArgs):
    interview_id: str = Field(min_length=1, strict=True)


class InterviewFields(_StrictArgs):
    candidature_id: str = Field(min_length=1, strict=True)
    date_entretien: datetime
    type_entretien: InterviewType
    format_entretien: InterviewFormat
    lieu_entretien: Optional[str] = Field(None, max_length=500)
    interviewer: Optional[str] = Field(None, max_length=200)
    commentaire: Optional[str] = Field(None, max_length=2000)

    @field_validator("date_entretien", mode="before")
    @classmethod
    def date_must_be_string(cls, value):
        if not isinstance(value, str):
            raise ValueError("date_time_string_required")
        return value


class CreateArgs(_StrictArgs):
    interview: InterviewFields
    request_id: str = Field(default=None, min_length=1, max_length=128, strict=True)


class Changes(_StrictArgs):
    date_entretien: Optional[datetime] = None
    type_entretien: Optional[InterviewType] = None
    format_entretien: Optional[InterviewFormat] = None
    lieu_entretien: Optional[str] = Field(None, max_length=500)
    interviewer: Optional[str] = Field(None, max_length=200)
    commentaire: Optional[str] = Field(None, max_length=2000)
    statut: Optional[InterviewStatus] = None

    @field_validator("date_entretien", mode="before")
    @classmethod
    def date_must_be_string_or_null(cls, value):
        if value is not None and not isinstance(value, str):
            raise ValueError("date_time_string_required")
        return value


class UpdateArgs(IdArgs):
    changes: Changes


_FIELDS = ("id", "candidature_id", "entreprise", "poste", "date_entretien",
           "type_entretien", "format_entretien", "lieu_entretien", "interviewer",
           "commentaire", "statut", "time_remaining", "urgency")
_EVENT_FIELDS = ("event_id", "event_type", "previous_status", "new_status",
                 "changed_at", "source", "client_id")
_EVENT_TYPES = {"created", "status_changed"}
_STATUSES = {status.value for status in InterviewStatus}


def _public_history(history) -> list[dict]:
    """Keep only complete, valid events and the fields declared by the MCP contract."""
    if not isinstance(history, list):
        return []
    events = []
    for raw in history:
        if not isinstance(raw, dict):
            continue
        event = {field: raw.get(field) for field in _EVENT_FIELDS}
        if (not isinstance(event["event_id"], str) or not event["event_id"]
                or not isinstance(event["event_type"], str) or event["event_type"] not in _EVENT_TYPES
                or not isinstance(event["new_status"], str) or event["new_status"] not in _STATUSES
                or event["previous_status"] is not None and (
                    not isinstance(event["previous_status"], str)
                    or event["previous_status"] not in _STATUSES)
                or not isinstance(event["changed_at"], str)
                or not isinstance(event["source"], str) or not event["source"]
                or event["client_id"] is not None and not isinstance(event["client_id"], str)):
            continue
        try:
            if datetime.fromisoformat(event["changed_at"].replace("Z", "+00:00")).tzinfo is None:
                continue
        except ValueError:
            continue
        events.append(event)
    return events


def serialize_interview(record: dict, *, detail: bool = False) -> dict:
    """Explicit output allowlist; never serialize a REST response or Mongo document."""
    output = {key: record.get(key) for key in _FIELDS}
    created = interview_service.utc_date(record.get("created_at"))
    output["created_at"] = created.isoformat() if created else None
    if record.get("date_warning") == "invalid_historical_date":
        output["date_warning"] = "invalid_historical_date"
    if detail:
        output["status_history"] = _public_history(record.get("status_history"))
    return output


async def list_interviews(db, user_id: str, arguments: dict, client_id: str) -> dict:
    args = _parse(ListArgs, arguments)
    items, total = await interview_service.list_interviews(
        db, user_id, args.model_dump(exclude_none=True), page=args.page, per_page=args.per_page)
    return {"items": [serialize_interview(item) for item in items],
            "page": args.page, "per_page": args.per_page, "total": total}


async def get_interview(db, user_id: str, arguments: dict, client_id: str) -> dict:
    args = _parse(IdArgs, arguments)
    record = await interview_service.get_interview(db, user_id, args.interview_id, history=True)
    return {"interview": serialize_interview(record, detail=True)}


async def create_interview(db, user_id: str, arguments: dict, client_id: str) -> dict:
    args = _parse(CreateArgs, arguments)
    data = InterviewCreate.model_validate(args.interview.model_dump())
    record, replayed = await interview_service.create_interview(
        db, user_id, data, source="mcp", client_id=client_id,
        request_id=args.request_id, require_offset=True)
    return {"interview": serialize_interview(record), "created": not replayed, "replayed": replayed}


async def update_interview(db, user_id: str, arguments: dict, client_id: str) -> dict:
    args = _parse(UpdateArgs, arguments)
    changes = InterviewUpdate.model_validate(args.changes.model_dump(exclude_unset=True))
    record = await interview_service.update_interview(
        db, user_id, args.interview_id, changes, source="mcp", client_id=client_id,
        require_offset=True)
    return {"interview": serialize_interview(record)}


async def delete_interview(db, user_id: str, arguments: dict, client_id: str) -> dict:
    args = _parse(IdArgs, arguments)
    await interview_service.delete_interview(db, user_id, args.interview_id)
    return {"deleted": True, "interview_id": args.interview_id}
