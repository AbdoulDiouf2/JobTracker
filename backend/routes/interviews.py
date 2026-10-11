"""REST adapter for the shared interview service."""
from datetime import datetime, timezone
from typing import List, Literal, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict
from models import InterviewCreate, InterviewFormat, InterviewResponse, InterviewStatus, InterviewType, InterviewUpdate
from services import interview_service
from utils.auth import get_current_user

router = APIRouter(prefix="/interviews", tags=["Interviews"])

def get_db():
    pass

def calculate_time_remaining(interview_date: datetime) -> tuple:
    return interview_service.calculate_time_remaining(interview_date)

def _http_error(exc: interview_service.InterviewError):
    code = {"not_found": 404, "invalid_arguments": 400, "conflict": 409,
            "temporarily_unavailable": 503}.get(exc.code, 500)
    raise HTTPException(status_code=code, detail=str(exc)) from exc

def _legacy(item, user_id):
    return {**item, "user_id": user_id}

class HistoricalInterviewResponse(BaseModel):
    """Validate legacy rows which may lack newer required response fields."""
    model_config = ConfigDict(extra="allow")
    id: str
    user_id: str
    candidature_id: str
    statut: InterviewStatus
    type_entretien: InterviewType
    format_entretien: InterviewFormat
    date_entretien: datetime

class InvalidHistoricalInterviewResponse(HistoricalInterviewResponse):
    """Validate the existing anomaly response without changing normal REST schemas."""
    date_entretien: None
    date_warning: Literal["invalid_historical_date"]

def _rest_result(value):
    items = value if isinstance(value, list) else [value]
    if any("date_warning" in item for item in items):
        for item in items:
            model = InvalidHistoricalInterviewResponse if "date_warning" in item else HistoricalInterviewResponse
            model.model_validate(item)
        return JSONResponse(content=jsonable_encoder(value))
    return value

@router.get("", response_model=List[InterviewResponse])
async def list_interviews(status: Optional[InterviewStatus] = None,
                          interview_type: Optional[InterviewType] = None,
                          interview_format: Optional[InterviewFormat] = None,
                          candidature_id: Optional[str] = None,
                          current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    items, _ = await interview_service.list_interviews(
        db, current_user["user_id"], {"status": status, "interview_type": interview_type,
                                      "interview_format": interview_format, "candidature_id": candidature_id})
    return _rest_result([_legacy(item, current_user["user_id"]) for item in items])

@router.get("/upcoming", response_model=List[InterviewResponse])
async def get_upcoming_interviews(limit: int = Query(5, ge=1, le=20),
                                  current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    items = await interview_service.upcoming_interviews(db, current_user["user_id"], limit)
    return _rest_result([_legacy(item, current_user["user_id"]) for item in items])

@router.post("", response_model=InterviewResponse, status_code=status.HTTP_201_CREATED)
async def create_interview(interview_data: InterviewCreate,
                           current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    try:
        result, _ = await interview_service.create_interview(db, current_user["user_id"], interview_data)
        return _legacy(result, current_user["user_id"])
    except interview_service.InterviewError as exc:
        _http_error(exc)

@router.get("/{interview_id}", response_model=InterviewResponse)
async def get_interview(interview_id: str, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    try:
        return _rest_result(_legacy(await interview_service.get_interview(db, current_user["user_id"], interview_id), current_user["user_id"]))
    except interview_service.InterviewError as exc:
        _http_error(exc)

@router.put("/{interview_id}", response_model=InterviewResponse)
async def update_interview(interview_id: str, interview_update: InterviewUpdate,
                           current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    try:
        return _rest_result(_legacy(await interview_service.update_interview(db, current_user["user_id"], interview_id, interview_update), current_user["user_id"]))
    except interview_service.InterviewError as exc:
        _http_error(exc)

@router.delete("/{interview_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_interview(interview_id: str, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    try:
        await interview_service.delete_interview(db, current_user["user_id"], interview_id)
    except interview_service.InterviewError as exc:
        _http_error(exc)

@router.delete("/reset/all", status_code=status.HTTP_200_OK)
async def reset_all_interviews(current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    result = await db.interviews.delete_many({"user_id": current_user["user_id"]})
    return {"success": True, "deleted_interviews": result.deleted_count,
            "message": f"{result.deleted_count} entretien(s) supprimé(s)"}
