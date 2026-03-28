from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import db_dependency
from app.schemas.room import RoomCreate, RoomRead, RoomUpdate
from app.services.room_service import RoomService

router = APIRouter(tags=["resources-rooms"])


@router.get("", response_model=list[RoomRead], summary="List rooms")
def list_rooms(db: Session = Depends(db_dependency)) -> list[RoomRead]:
    return RoomService(db).list()


@router.get("/{room_id}", response_model=RoomRead, summary="Get room by ID")
def get_room(room_id: UUID, db: Session = Depends(db_dependency)) -> RoomRead:
    return RoomService(db).get(room_id)


@router.post("", response_model=RoomRead, status_code=status.HTTP_201_CREATED, summary="Create room")
def create_room(payload: RoomCreate, db: Session = Depends(db_dependency)) -> RoomRead:
    return RoomService(db).create(payload)


@router.put("/{room_id}", response_model=RoomRead, summary="Update room")
def update_room(room_id: UUID, payload: RoomUpdate, db: Session = Depends(db_dependency)) -> RoomRead:
    return RoomService(db).update(room_id, payload)


@router.delete("/{room_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete room")
def delete_room(room_id: UUID, db: Session = Depends(db_dependency)) -> None:
    RoomService(db).delete(room_id)
