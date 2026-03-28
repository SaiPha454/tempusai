from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.resource import Professor
from app.repositories.professor_repository import ProfessorRepository
from app.repositories.timeslot_repository import TimeslotRepository
from app.schemas.professor import ProfessorCreate, ProfessorRead, ProfessorUpdate
from app.services.errors import bad_request, conflict, not_found


ANY_TIME_SENTINEL = "any-time"


class ProfessorService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repo = ProfessorRepository(db)
        self.timeslot_repo = TimeslotRepository(db)

    def _normalize_slots(self, slot_ids: list[UUID | str]) -> tuple[bool, list[UUID]]:
        normalized = [str(item) for item in slot_ids if str(item).strip()]
        if not normalized or ANY_TIME_SENTINEL in normalized:
            return True, []

        parsed_ids: list[UUID] = []
        for raw in normalized:
            try:
                slot_id = UUID(raw)
            except ValueError as exc:
                raise bad_request(f"Invalid timeslot id: {raw}") from exc
            if not self.timeslot_repo.get(slot_id):
                raise bad_request(f"Timeslot not found: {slot_id}")
            parsed_ids.append(slot_id)

        return False, parsed_ids

    def _to_read(self, professor: Professor) -> ProfessorRead:
        slot_ids = [str(item.timeslot_id) for item in professor.available_timeslots]
        if professor.is_any_time:
            slot_ids = [ANY_TIME_SENTINEL]

        return ProfessorRead(id=professor.id, name=professor.name, available_slot_ids=slot_ids)

    def list(self, search: str | None = None) -> list[ProfessorRead]:
        return [self._to_read(item) for item in self.repo.list(search=search)]

    def get(self, professor_id: UUID) -> ProfessorRead:
        professor = self.repo.get(professor_id)
        if not professor:
            raise not_found("Professor")
        return self._to_read(professor)

    def create(self, payload: ProfessorCreate) -> ProfessorRead:
        is_any_time, slot_ids = self._normalize_slots(payload.available_slot_ids)
        professor = Professor(name=payload.name.strip(), is_any_time=is_any_time)

        try:
            created = self.repo.create(professor)
            if not is_any_time:
                self.repo.replace_availability(created, slot_ids)
            self.db.commit()
            self.db.refresh(created)
            return self._to_read(self.repo.get(created.id) or created)
        except IntegrityError:
            self.db.rollback()
            raise conflict("Professor name already exists")

    def update(self, professor_id: UUID, payload: ProfessorUpdate) -> ProfessorRead:
        professor = self.repo.get(professor_id)
        if not professor:
            raise not_found("Professor")

        is_any_time, slot_ids = self._normalize_slots(payload.available_slot_ids)
        professor.name = payload.name.strip()
        professor.is_any_time = is_any_time

        try:
            self.db.flush()
            self.repo.replace_availability(professor, [] if is_any_time else slot_ids)
            self.db.commit()
            updated = self.repo.get(professor_id) or professor
            return self._to_read(updated)
        except IntegrityError:
            self.db.rollback()
            raise conflict("Professor name already exists")

    def delete(self, professor_id: UUID) -> None:
        professor = self.repo.get(professor_id)
        if not professor:
            raise not_found("Professor")
        self.repo.delete(professor)
        self.db.commit()
