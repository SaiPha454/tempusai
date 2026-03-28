from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.resource import SpecialEnrollment, SpecialEnrollmentCourse


class SpecialEnrollmentRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list(self) -> list[SpecialEnrollment]:
        stmt = (
            select(SpecialEnrollment)
            .options(selectinload(SpecialEnrollment.student), selectinload(SpecialEnrollment.courses).selectinload(SpecialEnrollmentCourse.course))
            .order_by(SpecialEnrollment.id.asc())
        )
        return list(self.db.scalars(stmt))

    def get(self, enrollment_id: UUID) -> SpecialEnrollment | None:
        stmt = (
            select(SpecialEnrollment)
            .options(selectinload(SpecialEnrollment.student), selectinload(SpecialEnrollment.courses).selectinload(SpecialEnrollmentCourse.course))
            .where(SpecialEnrollment.id == enrollment_id)
        )
        return self.db.scalar(stmt)

    def create(self, enrollment: SpecialEnrollment) -> SpecialEnrollment:
        self.db.add(enrollment)
        self.db.flush()
        self.db.refresh(enrollment)
        return enrollment

    def replace_courses(self, enrollment: SpecialEnrollment, course_ids: list[UUID]) -> None:
        enrollment.courses = [SpecialEnrollmentCourse(course_id=course_id) for course_id in course_ids]
        self.db.flush()

    def delete(self, enrollment: SpecialEnrollment) -> None:
        self.db.delete(enrollment)
