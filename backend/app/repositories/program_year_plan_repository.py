from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.resource import ProgramYearCourse


class ProgramYearPlanRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list(self, program_value: str | None = None) -> list[ProgramYearCourse]:
        stmt = (
            select(ProgramYearCourse)
            .options(
                joinedload(ProgramYearCourse.program),
                joinedload(ProgramYearCourse.course),
                joinedload(ProgramYearCourse.professor),
            )
            .order_by(ProgramYearCourse.year.asc())
        )

        if program_value:
            stmt = stmt.where(ProgramYearCourse.program.has(value=program_value))

        return list(self.db.scalars(stmt))

    def get(self, row_id: UUID) -> ProgramYearCourse | None:
        stmt = (
            select(ProgramYearCourse)
            .options(
                joinedload(ProgramYearCourse.program),
                joinedload(ProgramYearCourse.course),
                joinedload(ProgramYearCourse.professor),
            )
            .where(ProgramYearCourse.id == row_id)
        )
        return self.db.scalar(stmt)

    def create(self, row: ProgramYearCourse) -> ProgramYearCourse:
        self.db.add(row)
        self.db.flush()
        self.db.refresh(row)
        return row

    def delete(self, row: ProgramYearCourse) -> None:
        self.db.delete(row)
