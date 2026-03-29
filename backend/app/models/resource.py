import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, CheckConstraint, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Program(Base):
    __tablename__ = "programs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    value: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    label: Mapped[str] = mapped_column(String(255), unique=True, index=True)

    courses: Mapped[list["Course"]] = relationship(back_populates="program")
    students: Mapped[list["Student"]] = relationship(back_populates="program")
    year_plan_courses: Mapped[list["ProgramYearCourse"]] = relationship(back_populates="program")


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    program_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("programs.id", ondelete="SET NULL"),
        nullable=True,
    )

    program: Mapped["Program | None"] = relationship(back_populates="courses")
    enrollment_links: Mapped[list["SpecialEnrollmentCourse"]] = relationship(back_populates="course", cascade="all, delete-orphan")
    year_plan_links: Mapped[list["ProgramYearCourse"]] = relationship(back_populates="course")


class Room(Base):
    __tablename__ = "rooms"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    capacity: Mapped[int] = mapped_column(Integer)

    __table_args__ = (CheckConstraint("capacity > 0", name="ck_rooms_capacity_positive"),)


class Timeslot(Base):
    __tablename__ = "timeslots"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    day: Mapped[str] = mapped_column(String(16), index=True)
    label: Mapped[str] = mapped_column(String(64), index=True)

    __table_args__ = (
        UniqueConstraint("day", "label", name="uq_timeslots_day_label"),
    )

    professor_links: Mapped[list["ProfessorAvailability"]] = relationship(back_populates="timeslot", cascade="all, delete-orphan")


class Professor(Base):
    __tablename__ = "professors"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    is_any_time: Mapped[bool] = mapped_column(Boolean, default=True)

    available_timeslots: Mapped[list["ProfessorAvailability"]] = relationship(back_populates="professor", cascade="all, delete-orphan")
    year_plan_courses: Mapped[list["ProgramYearCourse"]] = relationship(back_populates="professor")


class ProfessorAvailability(Base):
    __tablename__ = "professor_availabilities"

    professor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("professors.id", ondelete="CASCADE"), primary_key=True)
    timeslot_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("timeslots.id", ondelete="CASCADE"), primary_key=True)

    professor: Mapped["Professor"] = relationship(back_populates="available_timeslots")
    timeslot: Mapped["Timeslot"] = relationship(back_populates="professor_links")


class Student(Base):
    __tablename__ = "students"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    program_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("programs.id", ondelete="RESTRICT"), index=True)
    year: Mapped[int] = mapped_column(Integer)

    __table_args__ = (CheckConstraint("year BETWEEN 1 AND 4", name="ck_students_year_1_4"),)

    program: Mapped["Program"] = relationship(back_populates="students")
    enrollments: Mapped[list["SpecialEnrollment"]] = relationship(back_populates="student", cascade="all, delete-orphan")


class SpecialEnrollment(Base):
    __tablename__ = "special_enrollments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), index=True)

    student: Mapped["Student"] = relationship(back_populates="enrollments")
    courses: Mapped[list["SpecialEnrollmentCourse"]] = relationship(back_populates="enrollment", cascade="all, delete-orphan")


class SpecialEnrollmentCourse(Base):
    __tablename__ = "special_enrollment_courses"

    enrollment_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("special_enrollments.id", ondelete="CASCADE"), primary_key=True)
    course_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), primary_key=True)

    enrollment: Mapped["SpecialEnrollment"] = relationship(back_populates="courses")
    course: Mapped["Course"] = relationship(back_populates="enrollment_links")


class ProgramYearCourse(Base):
    __tablename__ = "program_year_courses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    program_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("programs.id", ondelete="CASCADE"), index=True)
    year: Mapped[int] = mapped_column(Integer)
    course_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), index=True)
    professor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("professors.id", ondelete="SET NULL"), nullable=True)

    __table_args__ = (
        CheckConstraint("year BETWEEN 1 AND 4", name="ck_program_year_courses_year_1_4"),
    )

    program: Mapped["Program"] = relationship(back_populates="year_plan_courses")
    course: Mapped["Course"] = relationship(back_populates="year_plan_links")
    professor: Mapped["Professor | None"] = relationship(back_populates="year_plan_courses")


class ScheduleClassSnapshot(Base):
    __tablename__ = "schedule_class_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    program_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("programs.id", ondelete="CASCADE"),
        index=True,
    )
    status: Mapped[str] = mapped_column(String(32), default="draft", index=True)
    constraints: Mapped[dict[str, bool]] = mapped_column(JSON, default=dict)
    selected_room_names: Mapped[list[str]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    program: Mapped["Program"] = relationship()
    entries: Mapped[list["ScheduleClassEntry"]] = relationship(
        back_populates="snapshot",
        cascade="all, delete-orphan",
    )


class ScheduleClassEntry(Base):
    __tablename__ = "schedule_class_entries"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    snapshot_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("schedule_class_snapshots.id", ondelete="CASCADE"),
        index=True,
    )
    course_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), index=True)
    professor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("professors.id", ondelete="SET NULL"),
        nullable=True,
    )
    year: Mapped[int] = mapped_column(Integer)
    timeslot_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("timeslots.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    room_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("rooms.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    manually_adjusted: Mapped[bool] = mapped_column(Boolean, default=False)

    __table_args__ = (
        CheckConstraint("year BETWEEN 1 AND 4", name="ck_schedule_class_entries_year_1_4"),
    )

    snapshot: Mapped["ScheduleClassSnapshot"] = relationship(back_populates="entries")
    course: Mapped["Course"] = relationship()
    professor: Mapped["Professor | None"] = relationship()
    timeslot: Mapped["Timeslot | None"] = relationship()
    room: Mapped["Room | None"] = relationship()


class ScheduleGenerationJob(Base):
    __tablename__ = "schedule_generation_jobs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    snapshot_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("schedule_class_snapshots.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    job_type: Mapped[str] = mapped_column(String(32), default="class", index=True)
    status: Mapped[str] = mapped_column(String(32), default="queued", index=True)
    error_message: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    snapshot: Mapped["ScheduleClassSnapshot | None"] = relationship()
