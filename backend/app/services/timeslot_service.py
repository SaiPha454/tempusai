from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.resource import Timeslot
from app.repositories.timeslot_repository import TimeslotRepository
from app.schemas.timeslot import TimeslotCreate, TimeslotUpdate
from app.services.errors import conflict, not_found


class TimeslotService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repo = TimeslotRepository(db)

    def list(self) -> list[Timeslot]:
        return self.repo.list()

    def get(self, timeslot_id: UUID) -> Timeslot:
        slot = self.repo.get(timeslot_id)
        if not slot:
            raise not_found("Timeslot")
        return slot

    def create(self, payload: TimeslotCreate) -> Timeslot:
        slot = Timeslot(day=payload.day.strip(), label=payload.label.strip())
        try:
            created = self.repo.create(slot)
            self.db.commit()
            return created
        except IntegrityError:
            self.db.rollback()
            raise conflict("Timeslot with this day and label already exists")

    def update(self, timeslot_id: UUID, payload: TimeslotUpdate) -> Timeslot:
        slot = self.get(timeslot_id)
        slot.day = payload.day.strip()
        slot.label = payload.label.strip()
        try:
            self.db.flush()
            self.db.commit()
            self.db.refresh(slot)
            return slot
        except IntegrityError:
            self.db.rollback()
            raise conflict("Timeslot with this day and label already exists")

    def delete(self, timeslot_id: UUID) -> None:
        slot = self.get(timeslot_id)
        self.repo.delete(slot)
        self.db.commit()
