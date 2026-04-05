import uuid
from datetime import date

from sqlalchemy import Boolean, CheckConstraint, Date, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class ScheduleExamEntry(Base):
    __tablename__ = "schedule_exam_entries"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    snapshot_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("schedule_exam_snapshots.id", ondelete="CASCADE"),
        index=True,
    )
    program_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("programs.id", ondelete="CASCADE"),
        index=True,
    )
    program_year_course_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("program_year_courses.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    course_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("courses.id", ondelete="CASCADE"),
        index=True,
    )
    year: Mapped[int] = mapped_column(Integer)
    semester: Mapped[str | None] = mapped_column(String(32), nullable=True)
    exam_type: Mapped[str | None] = mapped_column(String(32), nullable=True)
    exam_date: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    timeslot_code: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    room_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("rooms.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    manually_adjusted: Mapped[bool] = mapped_column(Boolean, default=False)

    __table_args__ = (
        CheckConstraint("year BETWEEN 1 AND 4", name="ck_schedule_exam_entries_year_1_4"),
    )

    snapshot: Mapped["ScheduleExamSnapshot"] = relationship(back_populates="entries")
    program: Mapped["Program"] = relationship()
    program_year_course: Mapped["ProgramYearCourse | None"] = relationship()
    course: Mapped["Course"] = relationship()
    room: Mapped["Room | None"] = relationship()
