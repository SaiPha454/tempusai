from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps import db_dependency
from app.schemas.scheduling import (
    ClassScheduleDraftRead,
    ClassScheduleGenerateRequest,
    ClassScheduleJobRead,
    ProgramConfirmedScheduleSummaryRead,
    ProgramDraftSummaryRead,
    SaveClassScheduleDraftRequest,
)
from app.services.scheduling_service import SchedulingService

router = APIRouter(tags=["scheduling-class"])


@router.post(
    "/class/jobs",
    response_model=ClassScheduleJobRead,
    status_code=status.HTTP_201_CREATED,
    summary="Generate class scheduling draft job",
)
def generate_class_schedule_job(
    payload: ClassScheduleGenerateRequest,
    db: Session = Depends(db_dependency),
) -> ClassScheduleJobRead:
    return SchedulingService(db).create_class_generation_job(payload)


@router.get("/class/jobs/{job_id}", response_model=ClassScheduleJobRead, summary="Get class scheduling job status")
def get_class_schedule_job(job_id: UUID, db: Session = Depends(db_dependency)) -> ClassScheduleJobRead:
    return SchedulingService(db).get_job(job_id)


@router.get(
    "/class/drafts/summary",
    response_model=list[ProgramDraftSummaryRead],
    summary="List class draft counts by program",
)
def list_class_draft_summary(db: Session = Depends(db_dependency)) -> list[ProgramDraftSummaryRead]:
    return SchedulingService(db).list_program_draft_summary()


@router.get(
    "/class/schedules/summary",
    response_model=list[ProgramConfirmedScheduleSummaryRead],
    summary="List confirmed class schedule counts by program",
)
def list_class_schedule_summary(db: Session = Depends(db_dependency)) -> list[ProgramConfirmedScheduleSummaryRead]:
    return SchedulingService(db).list_program_confirmed_schedule_summary()


@router.get(
    "/class/schedules/latest",
    response_model=ClassScheduleDraftRead,
    summary="Get latest confirmed class schedule by program",
)
def get_latest_confirmed_class_schedule(
    program_value: str = Query(..., min_length=1),
    db: Session = Depends(db_dependency),
) -> ClassScheduleDraftRead:
    return SchedulingService(db).get_latest_confirmed_class_schedule(program_value)


@router.delete(
    "/class/schedules/latest",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete latest confirmed class schedule by program",
)
def delete_latest_confirmed_class_schedule(
    program_value: str = Query(..., min_length=1),
    db: Session = Depends(db_dependency),
) -> Response:
    SchedulingService(db).delete_latest_confirmed_class_schedule(program_value)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/class/drafts/latest",
    response_model=ClassScheduleDraftRead,
    summary="Get latest class scheduling draft by program",
)
def get_latest_class_schedule_draft(
    program_value: str = Query(..., min_length=1),
    db: Session = Depends(db_dependency),
) -> ClassScheduleDraftRead:
    return SchedulingService(db).get_latest_class_draft(program_value)


@router.get("/class/drafts/{snapshot_id}", response_model=ClassScheduleDraftRead, summary="Get class scheduling draft")
def get_class_schedule_draft(snapshot_id: UUID, db: Session = Depends(db_dependency)) -> ClassScheduleDraftRead:
    return SchedulingService(db).get_class_draft(snapshot_id)


@router.put("/class/drafts/{snapshot_id}", response_model=ClassScheduleDraftRead, summary="Save class scheduling draft")
def save_class_schedule_draft(
    snapshot_id: UUID,
    payload: SaveClassScheduleDraftRequest,
    db: Session = Depends(db_dependency),
) -> ClassScheduleDraftRead:
    return SchedulingService(db).save_class_draft(snapshot_id, payload)


@router.delete(
    "/class/drafts/{snapshot_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete class scheduling draft",
)
def delete_class_schedule_draft(snapshot_id: UUID, db: Session = Depends(db_dependency)) -> Response:
    SchedulingService(db).delete_class_draft(snapshot_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
