import uuid

from sqlalchemy import String
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
