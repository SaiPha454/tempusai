import uuid

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


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
