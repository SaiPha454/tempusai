from datetime import date, datetime
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


class ClassDraftScheduleSummaryRead(BaseModel):
    id: UUID
    program_value: str
    program_label: str
    status: str
    entry_count: int
    created_at: datetime
    updated_at: datetime


class ProgramConfirmedScheduleSummaryRead(BaseModel):
    program_value: str
    program_label: str
    confirmed_count: int


class ScheduleConflictRead(BaseModel):
    code: str
    message: str


class ScheduleClassEntryRead(BaseModel):
    id: UUID
    program_year_course_id: UUID | None = None
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
    required_capacity: int | None = None
    manually_adjusted: bool
    conflicts: list[ScheduleConflictRead] = Field(default_factory=list)


class ConfirmedOccupancyRead(BaseModel):
    room_id: UUID
    timeslot_id: UUID
    course_code: str
    course_name: str


class ConfirmedProfessorOccupancyRead(BaseModel):
    professor_id: UUID
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
    confirmed_professor_occupancies: list[ConfirmedProfessorOccupancyRead] = Field(default_factory=list)
    conflict_count: int
    created_at: datetime
    updated_at: datetime


class ScheduleClassEntryPatch(BaseModel):
    id: UUID
    timeslot_id: UUID | None = None
    room_id: UUID | None = None


class SaveClassScheduleDraftRequest(BaseModel):
    entries: list[ScheduleClassEntryPatch] = Field(default_factory=list)


class ExamCoursePreferenceRequest(BaseModel):
    program_year_course_id: UUID
    course_code: str
    course_name: str
    preferred_dates: list[str] = Field(default_factory=list)
    preferred_timeslots: list[str] = Field(default_factory=list)


class ExamProgramYearRequest(BaseModel):
    year: int
    courses: list[ExamCoursePreferenceRequest] = Field(default_factory=list)


class ExamProgramPlanRequest(BaseModel):
    program_value: str = Field(min_length=1)
    semester: str = Field(min_length=1)
    exam_type: str = Field(min_length=1)
    years: list[ExamProgramYearRequest] = Field(default_factory=list)


class ExamConstraintRequest(BaseModel):
    no_same_program_year_day_timeslot: bool = True
    no_student_overlap: bool = True
    room_capacity_check: bool = True
    prefer_day_timeslot: bool = True
    allow_flexible_fallback: bool = True
    minimize_same_program_year_same_day: bool = True


class ExamScheduleGenerateRequest(BaseModel):
    job_name: str = Field(min_length=1, max_length=120)
    exam_dates: list[str] = Field(default_factory=list)
    selected_room_names: list[str] = Field(default_factory=list)
    program_plans: list[ExamProgramPlanRequest] = Field(default_factory=list)
    constraints: ExamConstraintRequest = Field(default_factory=ExamConstraintRequest)


class ExamScheduleJobRead(BaseModel):
    job_id: UUID
    snapshot_id: UUID | None
    status: str
    error_message: str | None = None


class ConfirmedExamOccupancyRead(BaseModel):
    room_id: UUID
    exam_date: date
    timeslot_code: str
    course_code: str
    course_name: str


class ScheduleExamEntryRead(BaseModel):
    id: UUID
    program_id: UUID
    program_value: str
    program_label: str
    program_year_course_id: UUID | None
    course_id: UUID
    course_code: str
    course_name: str
    year: int
    semester: str | None
    exam_type: str | None
    exam_date: date | None
    timeslot_code: str | None
    room_id: UUID | None
    room_name: str | None
    manually_adjusted: bool
    conflicts: list[ScheduleConflictRead] = Field(default_factory=list)


class ExamScheduleDraftRead(ORMModel):
    id: UUID
    job_name: str | None = None
    status: str
    constraints: dict[str, bool]
    selected_room_names: list[str]
    exam_dates: list[str]
    program_values: list[str]
    entries: list[ScheduleExamEntryRead]
    confirmed_occupancies: list[ConfirmedExamOccupancyRead] = Field(default_factory=list)
    conflict_count: int
    created_at: datetime
    updated_at: datetime


class ScheduleExamEntryPatch(BaseModel):
    id: UUID
    exam_date: date | None = None
    timeslot_code: str | None = None
    room_id: UUID | None = None


class SaveExamScheduleDraftRequest(BaseModel):
    entries: list[ScheduleExamEntryPatch] = Field(default_factory=list)


class ExamScheduleSummaryRead(BaseModel):
    id: UUID
    job_name: str | None = None
    status: str
    program_values: list[str]
    exam_dates: list[str]
    entry_count: int
    created_at: datetime
    updated_at: datetime


class ExamDraftScheduleSummaryRead(BaseModel):
    id: UUID
    job_name: str | None = None
    status: str
    program_values: list[str]
    exam_dates: list[str]
    entry_count: int
    created_at: datetime
    updated_at: datetime
