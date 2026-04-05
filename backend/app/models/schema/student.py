import uuid

from sqlalchemy import CheckConstraint, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


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
