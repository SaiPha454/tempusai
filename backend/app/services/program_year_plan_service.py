from uuid import UUID

from sqlalchemy.orm import Session

from app.models.resource import ProgramYearCourse
from app.repositories.course_repository import CourseRepository
from app.repositories.professor_repository import ProfessorRepository
from app.repositories.program_repository import ProgramRepository
from app.repositories.program_year_plan_repository import ProgramYearPlanRepository
from app.schemas.program_year_plan import ProgramYearCourseCreate, ProgramYearCourseRead, ProgramYearCourseUpdate
from app.services.errors import bad_request, not_found


class ProgramYearPlanService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repo = ProgramYearPlanRepository(db)
        self.program_repo = ProgramRepository(db)
        self.course_repo = CourseRepository(db)
        self.professor_repo = ProfessorRepository(db)

    def _resolve_ids(self, program_value: str, course_code: str, professor_name: str | None) -> tuple[UUID, UUID, UUID | None]:
        program = self.program_repo.get_by_value(program_value)
        if not program:
            raise bad_request("Program does not exist")

        course = self.course_repo.get_by_code(course_code)
        if not course:
            raise bad_request("Course does not exist")

        professor_id: UUID | None = None
        if professor_name:
            professor = self.professor_repo.get_by_name(professor_name)
            if not professor:
                raise bad_request("Professor does not exist")
            professor_id = professor.id

        return program.id, course.id, professor_id

    @staticmethod
    def _to_read(row: ProgramYearCourse) -> ProgramYearCourseRead:
        return ProgramYearCourseRead(
            id=row.id,
            program_value=row.program.value,
            year=row.year,
            course_code=row.course.code,
            course_name=row.course.name,
            professor_name=row.professor.name if row.professor else None,
        )

    def list(self, program_value: str | None = None) -> list[ProgramYearCourseRead]:
        return [self._to_read(item) for item in self.repo.list(program_value=program_value)]

    def get(self, row_id: UUID) -> ProgramYearCourseRead:
        row = self.repo.get(row_id)
        if not row:
            raise not_found("Program year plan row")
        return self._to_read(row)

    def create(self, payload: ProgramYearCourseCreate) -> ProgramYearCourseRead:
        program_id, course_id, professor_id = self._resolve_ids(
            payload.program_value.strip(),
            payload.course_code.strip(),
            payload.professor_name.strip() if payload.professor_name else None,
        )
        row = ProgramYearCourse(program_id=program_id, year=payload.year, course_id=course_id, professor_id=professor_id)
        created = self.repo.create(row)
        self.db.commit()
        return self.get(created.id)

    def update(self, row_id: UUID, payload: ProgramYearCourseUpdate) -> ProgramYearCourseRead:
        row = self.repo.get(row_id)
        if not row:
            raise not_found("Program year plan row")

        program_id, course_id, professor_id = self._resolve_ids(
            payload.program_value.strip(),
            payload.course_code.strip(),
            payload.professor_name.strip() if payload.professor_name else None,
        )

        row.program_id = program_id
        row.course_id = course_id
        row.professor_id = professor_id
        row.year = payload.year
        self.db.commit()
        return self.get(row_id)

    def delete(self, row_id: UUID) -> None:
        row = self.repo.get(row_id)
        if not row:
            raise not_found("Program year plan row")
        self.repo.delete(row)
        self.db.commit()
