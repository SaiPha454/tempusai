import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class ScheduleExamSnapshot(Base):
    __tablename__ = "schedule_exam_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="draft", index=True)
    constraints: Mapped[dict[str, bool]] = mapped_column(JSON, default=dict)
    selected_room_names: Mapped[list[str]] = mapped_column(JSON, default=list)
    exam_dates: Mapped[list[str]] = mapped_column(JSON, default=list)
    program_values: Mapped[list[str]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    entries: Mapped[list["ScheduleExamEntry"]] = relationship(
        back_populates="snapshot",
        cascade="all, delete-orphan",
    )
