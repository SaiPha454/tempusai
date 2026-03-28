from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.resource import Room


class RoomRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list(self) -> list[Room]:
        return list(self.db.scalars(select(Room).order_by(Room.name.asc())))

    def get(self, room_id: UUID) -> Room | None:
        return self.db.get(Room, room_id)

    def create(self, room: Room) -> Room:
        self.db.add(room)
        self.db.flush()
        self.db.refresh(room)
        return room

    def delete(self, room: Room) -> None:
        self.db.delete(room)
