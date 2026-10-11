"""MCP adapter for the existing application API and business rules."""

from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from models import ApplicationStatus, JobApplicationCreate, JobApplicationUpdate
from routes import applications as application_routes
from services.application_service import create_application_record


class ApplicationToolError(Exception):
    def __init__(self, code: str, details: Optional[list] = None):
        self.code = code
        self.details = details or []


def _parse(model, arguments):
    try:
        return model.model_validate(arguments)
    except ValidationError as exc:
        raise ApplicationToolError("invalid_arguments", [
            {"loc": [str(p) for p in item["loc"]], "type": item["type"]}
            for item in exc.errors()
        ]) from exc


def _known_fields(model, data, prefix):
    unknown = data.keys() - model.model_fields.keys()
    if unknown:
        raise ApplicationToolError("invalid_arguments", [
            {"loc": [prefix, key], "type": "extra_forbidden"} for key in sorted(unknown)
        ])


def _route_error(exc: HTTPException):
    code = "not_found" if exc.status_code == 404 else "invalid_arguments"
    raise ApplicationToolError(code, [{"message": str(exc.detail)}]) from exc


class ListArgs(BaseModel):
    model_config = ConfigDict(extra="forbid")
    page: int = Field(1, ge=1, strict=True)
    per_page: int = Field(20, ge=1, le=100, strict=True)
    search: Optional[str] = Field(None, max_length=200)
    status: Optional[ApplicationStatus] = None
    job_type: Optional[str] = Field(None, max_length=50)
    method: Optional[str] = Field(None, max_length=50)
    is_favorite: Optional[bool] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None


class IdArgs(BaseModel):
    model_config = ConfigDict(extra="forbid")
    application_id: str = Field(min_length=1, max_length=100)


class CreateArgs(BaseModel):
    model_config = ConfigDict(extra="forbid")
    application: dict
    status: ApplicationStatus


class UpdateArgs(IdArgs):
    changes: dict


async def list_applications(db, user_id: str, arguments: dict) -> dict:
    args = _parse(ListArgs, arguments)
    def utc(value):
        return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)
    if args.date_from and args.date_to and utc(args.date_from) > utc(args.date_to):
        raise ApplicationToolError("invalid_arguments", [{"loc": ["date_from"], "type": "date_range"}])
    result = await application_routes.list_applications(
        page=args.page, per_page=args.per_page, sort_by="date_candidature", sort_order="desc",
        search=args.search, status=args.status, job_type=args.job_type, method=args.method,
        is_favorite=args.is_favorite,
        date_from=args.date_from.isoformat() if args.date_from else None,
        date_to=args.date_to.isoformat() if args.date_to else None,
        needs_followup=None, current_user={"user_id": user_id}, db=db,
    )
    return result.model_dump(mode="json")


async def get_application(db, user_id: str, arguments: dict) -> dict:
    args = _parse(IdArgs, arguments)
    try:
        return await application_routes.get_application(args.application_id, {"user_id": user_id}, db)
    except HTTPException as exc:
        _route_error(exc)


async def create_application(db, user_id: str, arguments: dict) -> dict:
    args = _parse(CreateArgs, arguments)
    if args.status not in (ApplicationStatus.TO_APPLY, ApplicationStatus.PENDING):
        raise ApplicationToolError("invalid_arguments", [{"loc": ["status"], "type": "unsupported_status"}])
    data = dict(args.application)
    _known_fields(JobApplicationCreate, data, "application")
    if "source" in data:
        raise ApplicationToolError("invalid_arguments", [{"loc": ["application", "source"], "type": "extra_forbidden"}])
    if args.status == ApplicationStatus.TO_APPLY:
        # The legacy model needs a technical date; it does not represent a sent application.
        data["date_candidature"] = datetime.now(timezone.utc)
    elif not data.get("date_candidature"):
        raise ApplicationToolError("invalid_arguments", [{"loc": ["application", "date_candidature"], "type": "missing"}])
    data["source"] = "mcp"
    application = _parse(JobApplicationCreate, data)
    record = await create_application_record(db, user_id, application, default_source="mcp", reponse=args.status)
    return record.model_dump(mode="json")


async def update_application(db, user_id: str, arguments: dict) -> dict:
    args = _parse(UpdateArgs, arguments)
    _known_fields(JobApplicationUpdate, args.changes, "changes")
    changes = _parse(JobApplicationUpdate, args.changes)
    try:
        result = await application_routes.update_application(args.application_id, changes,
                                                              {"user_id": user_id}, db)
        return result if isinstance(result, dict) else result.model_dump(mode="json")
    except HTTPException as exc:
        _route_error(exc)


async def delete_application(db, user_id: str, arguments: dict) -> dict:
    args = _parse(IdArgs, arguments)
    try:
        await application_routes.delete_application(args.application_id, {"user_id": user_id}, db)
    except HTTPException as exc:
        _route_error(exc)
    return {"deleted": True, "application_id": args.application_id}
