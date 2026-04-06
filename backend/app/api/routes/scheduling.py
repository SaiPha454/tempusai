from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps import db_dependency
from app.schemas.scheduling import (
    ClassDraftScheduleSummaryRead,
    ClassScheduleDraftRead,
    ClassScheduleGenerateRequest,
    ClassScheduleJobRead,
    ExamDraftScheduleSummaryRead,
    ExamScheduleDraftRead,
    ExamScheduleGenerateRequest,
    ExamScheduleJobRead,
    ExamScheduleSummaryRead,
    ProgramConfirmedScheduleSummaryRead,
    ProgramDraftSummaryRead,
    SaveExamScheduleDraftRequest,
    SaveClassScheduleDraftRequest,
)
from app.services.exam_scheduling_service import ExamSchedulingService
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
    "/class/drafts",
    response_model=list[ClassDraftScheduleSummaryRead],
    summary="List class drafts",
)
def list_class_drafts(db: Session = Depends(db_dependency)) -> list[ClassDraftScheduleSummaryRead]:
    return SchedulingService(db).list_class_draft_summaries()


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


@router.post(
    "/class/schedules/{snapshot_id}/make-draft",
    response_model=ClassScheduleDraftRead,
    summary="Convert class schedule snapshot to draft",
)
def make_class_schedule_as_draft(snapshot_id: UUID, db: Session = Depends(db_dependency)) -> ClassScheduleDraftRead:
    return SchedulingService(db).make_class_schedule_as_draft(snapshot_id)


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


@router.post(
    "/class/drafts/{snapshot_id}/commit",
    response_model=ClassScheduleDraftRead,
    summary="Commit class scheduling draft",
)
def commit_class_schedule_draft(
    snapshot_id: UUID,
    payload: SaveClassScheduleDraftRequest,
    db: Session = Depends(db_dependency),
) -> ClassScheduleDraftRead:
    return SchedulingService(db).commit_class_draft(snapshot_id, payload)


@router.delete(
    "/class/drafts/{snapshot_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete class scheduling draft",
)
def delete_class_schedule_draft(snapshot_id: UUID, db: Session = Depends(db_dependency)) -> Response:
    SchedulingService(db).delete_class_draft(snapshot_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/exam/jobs",
    response_model=ExamScheduleJobRead,
    status_code=status.HTTP_201_CREATED,
    summary="Generate exam scheduling draft job",
    tags=["scheduling-exam"],
)
def generate_exam_schedule_job(
    payload: ExamScheduleGenerateRequest,
    db: Session = Depends(db_dependency),
) -> ExamScheduleJobRead:
    return ExamSchedulingService(db).create_exam_generation_job(payload)


@router.get(
    "/exam/jobs/{job_id}",
    response_model=ExamScheduleJobRead,
    summary="Get exam scheduling job status",
    tags=["scheduling-exam"],
)
def get_exam_schedule_job(job_id: UUID, db: Session = Depends(db_dependency)) -> ExamScheduleJobRead:
    return ExamSchedulingService(db).get_job(job_id)


@router.get(
    "/exam/schedules/summary",
    response_model=list[ExamScheduleSummaryRead],
    summary="List confirmed exam schedules",
    tags=["scheduling-exam"],
)
def list_confirmed_exam_schedules(db: Session = Depends(db_dependency)) -> list[ExamScheduleSummaryRead]:
    return ExamSchedulingService(db).list_confirmed_exam_summaries()


@router.get(
    "/exam/drafts/summary",
    response_model=list[ExamDraftScheduleSummaryRead],
    summary="List exam draft schedules",
    tags=["scheduling-exam"],
)
def list_exam_drafts(db: Session = Depends(db_dependency)) -> list[ExamDraftScheduleSummaryRead]:
    return ExamSchedulingService(db).list_draft_exam_summaries()


@router.get(
    "/exam/drafts/{snapshot_id}",
    response_model=ExamScheduleDraftRead,
    summary="Get exam scheduling draft",
    tags=["scheduling-exam"],
)
def get_exam_schedule_draft(snapshot_id: UUID, db: Session = Depends(db_dependency)) -> ExamScheduleDraftRead:
    return ExamSchedulingService(db).get_exam_draft(snapshot_id)


@router.put(
    "/exam/drafts/{snapshot_id}",
    response_model=ExamScheduleDraftRead,
    summary="Save exam scheduling draft",
    tags=["scheduling-exam"],
)
def save_exam_schedule_draft(
    snapshot_id: UUID,
    payload: SaveExamScheduleDraftRequest,
    db: Session = Depends(db_dependency),
) -> ExamScheduleDraftRead:
    return ExamSchedulingService(db).save_exam_draft(snapshot_id, payload)


@router.post(
    "/exam/drafts/{snapshot_id}/commit",
    response_model=ExamScheduleDraftRead,
    summary="Commit exam scheduling draft",
    tags=["scheduling-exam"],
)
def commit_exam_schedule_draft(
    snapshot_id: UUID,
    payload: SaveExamScheduleDraftRequest,
    db: Session = Depends(db_dependency),
) -> ExamScheduleDraftRead:
    return ExamSchedulingService(db).commit_exam_draft(snapshot_id, payload)


@router.delete(
    "/exam/drafts/{snapshot_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete exam scheduling draft",
    tags=["scheduling-exam"],
)
def delete_exam_schedule_draft(snapshot_id: UUID, db: Session = Depends(db_dependency)) -> Response:
    ExamSchedulingService(db).delete_exam_draft(snapshot_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/exam/schedules/{snapshot_id}/make-draft",
    response_model=ExamScheduleDraftRead,
    summary="Convert exam schedule snapshot to draft",
    tags=["scheduling-exam"],
)
def make_exam_schedule_as_draft(snapshot_id: UUID, db: Session = Depends(db_dependency)) -> ExamScheduleDraftRead:
    return ExamSchedulingService(db).make_exam_schedule_as_draft(snapshot_id)


@router.delete(
    "/exam/schedules/{snapshot_id}/programs/{program_value}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete exam schedule for a program from snapshot",
    tags=["scheduling-exam"],
)
def delete_exam_schedule_program(snapshot_id: UUID, program_value: str, db: Session = Depends(db_dependency)) -> Response:
    ExamSchedulingService(db).delete_exam_schedule_program(snapshot_id, program_value)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
