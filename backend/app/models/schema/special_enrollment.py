import uuid

from sqlalchemy import ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class SpecialEnrollment(Base):
    __tablename__ = "special_enrollments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), index=True)

    student: Mapped["Student"] = relationship(back_populates="enrollments")
    courses: Mapped[list["SpecialEnrollmentCourse"]] = relationship(back_populates="enrollment", cascade="all, delete-orphan")
