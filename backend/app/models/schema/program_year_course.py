import uuid

from sqlalchemy import CheckConstraint, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


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
