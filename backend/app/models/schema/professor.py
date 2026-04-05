import uuid

from sqlalchemy import Boolean, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Professor(Base):
    __tablename__ = "professors"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    is_any_time: Mapped[bool] = mapped_column(Boolean, default=True)

    available_timeslots: Mapped[list["ProfessorAvailability"]] = relationship(back_populates="professor", cascade="all, delete-orphan")
    year_plan_courses: Mapped[list["ProgramYearCourse"]] = relationship(back_populates="professor")
