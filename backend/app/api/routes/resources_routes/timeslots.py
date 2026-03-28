from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import db_dependency
from app.schemas.timeslot import TimeslotCreate, TimeslotRead, TimeslotUpdate
from app.services.timeslot_service import TimeslotService

router = APIRouter(tags=["resources-timeslots"])


@router.get("", response_model=list[TimeslotRead], summary="List timeslots")
def list_timeslots(db: Session = Depends(db_dependency)) -> list[TimeslotRead]:
    return TimeslotService(db).list()


@router.get("/{timeslot_id}", response_model=TimeslotRead, summary="Get timeslot by ID")
def get_timeslot(timeslot_id: UUID, db: Session = Depends(db_dependency)) -> TimeslotRead:
    return TimeslotService(db).get(timeslot_id)


@router.post("", response_model=TimeslotRead, status_code=status.HTTP_201_CREATED, summary="Create timeslot")
def create_timeslot(payload: TimeslotCreate, db: Session = Depends(db_dependency)) -> TimeslotRead:
    return TimeslotService(db).create(payload)


@router.put("/{timeslot_id}", response_model=TimeslotRead, summary="Update timeslot")
def update_timeslot(timeslot_id: UUID, payload: TimeslotUpdate, db: Session = Depends(db_dependency)) -> TimeslotRead:
    return TimeslotService(db).update(timeslot_id, payload)


@router.delete("/{timeslot_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete timeslot")
def delete_timeslot(timeslot_id: UUID, db: Session = Depends(db_dependency)) -> None:
    TimeslotService(db).delete(timeslot_id)
