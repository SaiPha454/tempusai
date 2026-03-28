from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.resource import Course
from app.repositories.course_repository import CourseRepository
from app.repositories.program_repository import ProgramRepository
from app.schemas.course import CourseCreate, CourseRead, CourseUpdate
from app.services.errors import bad_request, conflict, not_found


class CourseService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repo = CourseRepository(db)
        self.program_repo = ProgramRepository(db)

    def _resolve_program_id(self, study_program: str | None) -> UUID | None:
        if not study_program or study_program == "all-programs":
            return None
        program = self.program_repo.get_by_value(study_program)
        if not program:
            raise bad_request("Study program does not exist")
        return program.id

    def _to_read(self, course: Course) -> CourseRead:
        return CourseRead(
            id=course.id,
            code=course.code,
            name=course.name,
            study_program=course.program.value if course.program else None,
        )

    def list(self, study_program: str | None = None, search: str | None = None) -> list[CourseRead]:
        return [self._to_read(item) for item in self.repo.list(study_program=study_program, search=search)]

    def get(self, course_id: UUID) -> CourseRead:
        course = self.repo.get(course_id)
        if not course:
            raise not_found("Course")
        return self._to_read(course)

    def create(self, payload: CourseCreate) -> CourseRead:
        course = Course(
            code=payload.code.strip(),
            name=payload.name.strip(),
            program_id=self._resolve_program_id(payload.study_program),
        )
        try:
            created = self.repo.create(course)
            self.db.commit()
            self.db.refresh(created)
            return self._to_read(created)
        except IntegrityError:
            self.db.rollback()
            raise conflict("Course code already exists")

    def update(self, course_id: UUID, payload: CourseUpdate) -> CourseRead:
        course = self.repo.get(course_id)
        if not course:
            raise not_found("Course")

        course.code = payload.code.strip()
        course.name = payload.name.strip()
        course.program_id = self._resolve_program_id(payload.study_program)

        try:
            self.db.flush()
            self.db.commit()
            self.db.refresh(course)
            return self._to_read(course)
        except IntegrityError:
            self.db.rollback()
            raise conflict("Course code already exists")

    def delete(self, course_id: UUID) -> None:
        course = self.repo.get(course_id)
        if not course:
            raise not_found("Course")

        self.repo.delete(course)
        self.db.commit()
