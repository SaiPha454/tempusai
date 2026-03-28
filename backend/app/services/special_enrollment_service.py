from uuid import UUID

from sqlalchemy.orm import Session

from app.models.resource import SpecialEnrollment
from app.repositories.course_repository import CourseRepository
from app.repositories.special_enrollment_repository import SpecialEnrollmentRepository
from app.repositories.student_repository import StudentRepository
from app.schemas.special_enrollment import SpecialEnrollmentCreate, SpecialEnrollmentRead, SpecialEnrollmentUpdate
from app.services.errors import bad_request, not_found


class SpecialEnrollmentService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repo = SpecialEnrollmentRepository(db)
        self.student_repo = StudentRepository(db)
        self.course_repo = CourseRepository(db)

    def _resolve_student_pk(self, student_id: str) -> UUID:
        student = self.student_repo.get_by_student_id(student_id)
        if not student:
            raise bad_request("Student not found")
        return student.id

    def _resolve_course_ids(self, course_codes: list[str]) -> list[UUID]:
        resolved: list[UUID] = []
        for code in course_codes:
            course = self.course_repo.get_by_code(code.strip())
            if not course:
                raise bad_request(f"Course not found: {code}")
            resolved.append(course.id)
        return resolved

    def _to_read(self, row: SpecialEnrollment) -> SpecialEnrollmentRead:
        course_codes = [item.course.code for item in row.courses]
        return SpecialEnrollmentRead(id=row.id, student_id=row.student.student_id, course_codes=course_codes)

    def list(self, program: str | None = None, course_code: str | None = None) -> list[SpecialEnrollmentRead]:
        rows = self.repo.list()
        filtered: list[SpecialEnrollment] = []

        for row in rows:
            by_program = program is None or row.student.program.value == program
            by_course = course_code is None or any(item.course.code == course_code for item in row.courses)
            if by_program and by_course:
                filtered.append(row)

        return [self._to_read(item) for item in filtered]

    def get(self, enrollment_id: UUID) -> SpecialEnrollmentRead:
        row = self.repo.get(enrollment_id)
        if not row:
            raise not_found("Special enrollment")
        return self._to_read(row)

    def create(self, payload: SpecialEnrollmentCreate) -> SpecialEnrollmentRead:
        row = SpecialEnrollment(student_id=self._resolve_student_pk(payload.student_id.strip()))
        created = self.repo.create(row)
        self.repo.replace_courses(created, self._resolve_course_ids(payload.course_codes))
        self.db.commit()
        return self.get(created.id)

    def update(self, enrollment_id: UUID, payload: SpecialEnrollmentUpdate) -> SpecialEnrollmentRead:
        row = self.repo.get(enrollment_id)
        if not row:
            raise not_found("Special enrollment")

        row.student_id = self._resolve_student_pk(payload.student_id.strip())
        self.repo.replace_courses(row, self._resolve_course_ids(payload.course_codes))
        self.db.commit()
        return self.get(enrollment_id)

    def delete(self, enrollment_id: UUID) -> None:
        row = self.repo.get(enrollment_id)
        if not row:
            raise not_found("Special enrollment")
        self.repo.delete(row)
        self.db.commit()
