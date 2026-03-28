from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.resource import Student


class StudentRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list(self, study_program: str | None = None, year: int | None = None) -> list[Student]:
        stmt = select(Student).order_by(Student.student_id.asc())
        if study_program:
            stmt = stmt.where(Student.program.has(value=study_program))
        if year is not None:
            stmt = stmt.where(Student.year == year)
        return list(self.db.scalars(stmt))

    def get(self, student_pk: UUID) -> Student | None:
        return self.db.get(Student, student_pk)

    def get_by_student_id(self, student_id: str) -> Student | None:
        return self.db.scalar(select(Student).where(Student.student_id == student_id))

    def create(self, student: Student) -> Student:
        self.db.add(student)
        self.db.flush()
        self.db.refresh(student)
        return student

    def delete(self, student: Student) -> None:
        self.db.delete(student)
