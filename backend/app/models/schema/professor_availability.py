import uuid

from sqlalchemy import ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class ProfessorAvailability(Base):
    __tablename__ = "professor_availabilities"

    professor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("professors.id", ondelete="CASCADE"), primary_key=True)
    timeslot_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("timeslots.id", ondelete="CASCADE"), primary_key=True)

    professor: Mapped["Professor"] = relationship(back_populates="available_timeslots")
    timeslot: Mapped["Timeslot"] = relationship(back_populates="professor_links")
