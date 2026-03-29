from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class ClassScheduleGenerateRequest(BaseModel):
    program_value: str = Field(min_length=1)
    selected_room_names: list[str] = Field(default_factory=list)
    constraints: dict[str, bool] = Field(default_factory=dict)
    preferred_timeslot_by_course_id: dict[str, list[str]] = Field(default_factory=dict)


class ClassScheduleJobRead(BaseModel):
    job_id: UUID
    snapshot_id: UUID | None
    status: str
    error_message: str | None = None


class ProgramDraftSummaryRead(BaseModel):
    program_value: str
    program_label: str
    draft_count: int


class ProgramConfirmedScheduleSummaryRead(BaseModel):
    program_value: str
    program_label: str
    confirmed_count: int


class ScheduleConflictRead(BaseModel):
    code: str
    message: str


class ScheduleClassEntryRead(BaseModel):
    id: UUID
    course_id: UUID
    course_code: str
    course_name: str
    professor_id: UUID | None
    professor_name: str | None
    year: int
    timeslot_id: UUID | None
    timeslot_label: str | None
    day: str | None
    room_id: UUID | None
    room_name: str | None
    manually_adjusted: bool
    conflicts: list[ScheduleConflictRead] = Field(default_factory=list)


class ConfirmedOccupancyRead(BaseModel):
    room_id: UUID
    timeslot_id: UUID
    course_code: str
    course_name: str


class ClassScheduleDraftRead(ORMModel):
    id: UUID
    program_id: UUID
    program_value: str
    program_label: str
    status: str
    constraints: dict[str, bool]
    selected_room_names: list[str]
    entries: list[ScheduleClassEntryRead]
    confirmed_occupancies: list[ConfirmedOccupancyRead] = Field(default_factory=list)
    conflict_count: int
    created_at: datetime
    updated_at: datetime


class ScheduleClassEntryPatch(BaseModel):
    id: UUID
    timeslot_id: UUID | None = None
    room_id: UUID | None = None


class SaveClassScheduleDraftRequest(BaseModel):
    entries: list[ScheduleClassEntryPatch] = Field(default_factory=list)
