from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.resource import Professor, ProfessorAvailability


class ProfessorRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list(self, search: str | None = None) -> list[Professor]:
        stmt = select(Professor).options(selectinload(Professor.available_timeslots)).order_by(Professor.name.asc())
        if search:
            stmt = stmt.where(Professor.name.ilike(f"%{search.strip()}%"))
        return list(self.db.scalars(stmt))

    def get(self, professor_id: UUID) -> Professor | None:
        stmt = (
            select(Professor)
            .options(selectinload(Professor.available_timeslots))
            .where(Professor.id == professor_id)
        )
        return self.db.scalar(stmt)

    def get_by_name(self, name: str) -> Professor | None:
        return self.db.scalar(select(Professor).where(Professor.name == name))

    def create(self, professor: Professor) -> Professor:
        self.db.add(professor)
        self.db.flush()
        self.db.refresh(professor)
        return professor

    def replace_availability(self, professor: Professor, slot_ids: list[UUID]) -> None:
        professor.available_timeslots = [ProfessorAvailability(timeslot_id=slot_id) for slot_id in slot_ids]
        self.db.flush()

    def delete(self, professor: Professor) -> None:
        self.db.delete(professor)
