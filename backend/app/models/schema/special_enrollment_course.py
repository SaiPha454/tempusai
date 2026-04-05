import uuid

from sqlalchemy import ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class SpecialEnrollmentCourse(Base):
    __tablename__ = "special_enrollment_courses"

    enrollment_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("special_enrollments.id", ondelete="CASCADE"), primary_key=True)
    course_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), primary_key=True)

    enrollment: Mapped["SpecialEnrollment"] = relationship(back_populates="courses")
    course: Mapped["Course"] = relationship(back_populates="enrollment_links")
