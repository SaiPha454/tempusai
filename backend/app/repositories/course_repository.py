from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.resource import Course


class CourseRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list(self, study_program: str | None = None, search: str | None = None) -> list[Course]:
        stmt = select(Course).order_by(Course.code.asc())

        if study_program:
            stmt = stmt.where(Course.program.has(value=study_program))

        if search:
            pattern = f"%{search.strip()}%"
            stmt = stmt.where(or_(Course.code.ilike(pattern), Course.name.ilike(pattern)))

        return list(self.db.scalars(stmt))

    def get(self, course_id: UUID) -> Course | None:
        return self.db.get(Course, course_id)

    def get_by_code(self, code: str) -> Course | None:
        return self.db.scalar(select(Course).where(Course.code == code))

    def create(self, course: Course) -> Course:
        self.db.add(course)
        self.db.flush()
        self.db.refresh(course)
        return course

    def delete(self, course: Course) -> None:
        self.db.delete(course)
