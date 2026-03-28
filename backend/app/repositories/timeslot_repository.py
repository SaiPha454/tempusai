from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.resource import Timeslot


class TimeslotRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list(self) -> list[Timeslot]:
        return list(self.db.scalars(select(Timeslot).order_by(Timeslot.day.asc(), Timeslot.label.asc())))

    def get(self, timeslot_id: UUID) -> Timeslot | None:
        return self.db.get(Timeslot, timeslot_id)

    def create(self, timeslot: Timeslot) -> Timeslot:
        self.db.add(timeslot)
        self.db.flush()
        self.db.refresh(timeslot)
        return timeslot

    def delete(self, timeslot: Timeslot) -> None:
        self.db.delete(timeslot)
