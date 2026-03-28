from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.resource import Room
from app.repositories.room_repository import RoomRepository
from app.schemas.room import RoomCreate, RoomUpdate
from app.services.errors import conflict, not_found


class RoomService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repo = RoomRepository(db)

    def list(self) -> list[Room]:
        return self.repo.list()

    def get(self, room_id: UUID) -> Room:
        room = self.repo.get(room_id)
        if not room:
            raise not_found("Room")
        return room

    def create(self, payload: RoomCreate) -> Room:
        room = Room(name=payload.name.strip().upper(), capacity=payload.capacity)
        try:
            created = self.repo.create(room)
            self.db.commit()
            return created
        except IntegrityError:
            self.db.rollback()
            raise conflict("Room name already exists")

    def update(self, room_id: UUID, payload: RoomUpdate) -> Room:
        room = self.get(room_id)
        room.name = payload.name.strip().upper()
        room.capacity = payload.capacity

        try:
            self.db.flush()
            self.db.commit()
            self.db.refresh(room)
            return room
        except IntegrityError:
            self.db.rollback()
            raise conflict("Room name already exists")

    def delete(self, room_id: UUID) -> None:
        room = self.get(room_id)
        self.repo.delete(room)
        self.db.commit()
