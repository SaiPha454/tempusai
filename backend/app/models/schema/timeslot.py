import uuid

from sqlalchemy import String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Timeslot(Base):
    __tablename__ = "timeslots"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    day: Mapped[str] = mapped_column(String(16), index=True)
    label: Mapped[str] = mapped_column(String(64), index=True)

    __table_args__ = (
        UniqueConstraint("day", "label", name="uq_timeslots_day_label"),
    )

    professor_links: Mapped[list["ProfessorAvailability"]] = relationship(back_populates="timeslot", cascade="all, delete-orphan")
