from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.resource import Student
from app.repositories.program_repository import ProgramRepository
from app.repositories.student_repository import StudentRepository
from app.schemas.student import StudentCreate, StudentRead, StudentUpdate
from app.services.errors import bad_request, conflict, not_found


class StudentService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repo = StudentRepository(db)
        self.program_repo = ProgramRepository(db)

    def _resolve_program_id(self, program_value: str) -> UUID:
        program = self.program_repo.get_by_value(program_value)
        if not program:
            raise bad_request("Study program does not exist")
        return program.id

    def _to_read(self, student: Student) -> StudentRead:
        return StudentRead(
            id=student.id,
            student_id=student.student_id,
            name=student.name,
            study_program=student.program.value,
            year=student.year,
        )

    def list(self, study_program: str | None = None, year: int | None = None) -> list[StudentRead]:
        return [self._to_read(item) for item in self.repo.list(study_program=study_program, year=year)]

    def get(self, student_pk: UUID) -> StudentRead:
        student = self.repo.get(student_pk)
        if not student:
            raise not_found("Student")
        return self._to_read(student)

    def create(self, payload: StudentCreate) -> StudentRead:
        student = Student(
            student_id=payload.student_id.strip(),
            name=payload.name.strip(),
            year=payload.year,
            program_id=self._resolve_program_id(payload.study_program),
        )
        try:
            created = self.repo.create(student)
            self.db.commit()
            self.db.refresh(created)
            return self._to_read(created)
        except IntegrityError:
            self.db.rollback()
            raise conflict("Student ID already exists")

    def update(self, student_pk: UUID, payload: StudentUpdate) -> StudentRead:
        student = self.repo.get(student_pk)
        if not student:
            raise not_found("Student")

        student.student_id = payload.student_id.strip()
        student.name = payload.name.strip()
        student.year = payload.year
        student.program_id = self._resolve_program_id(payload.study_program)

        try:
            self.db.flush()
            self.db.commit()
            self.db.refresh(student)
            return self._to_read(student)
        except IntegrityError:
            self.db.rollback()
            raise conflict("Student ID already exists")

    def delete(self, student_pk: UUID) -> None:
        student = self.repo.get(student_pk)
        if not student:
            raise not_found("Student")
        self.repo.delete(student)
        self.db.commit()
