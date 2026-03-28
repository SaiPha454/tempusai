from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import db_dependency
from app.schemas.program import ProgramCreate, ProgramRead, ProgramUpdate
from app.services.program_service import ProgramService

router = APIRouter(tags=["resources-programs"])


@router.get("", response_model=list[ProgramRead], summary="List programs")
def list_programs(db: Session = Depends(db_dependency)) -> list[ProgramRead]:
    return ProgramService(db).list()


@router.get("/{program_id}", response_model=ProgramRead, summary="Get program by ID")
def get_program(program_id: UUID, db: Session = Depends(db_dependency)) -> ProgramRead:
    return ProgramService(db).get(program_id)


@router.post("", response_model=ProgramRead, status_code=status.HTTP_201_CREATED, summary="Create program")
def create_program(payload: ProgramCreate, db: Session = Depends(db_dependency)) -> ProgramRead:
    return ProgramService(db).create(payload)


@router.put("/{program_id}", response_model=ProgramRead, summary="Update program")
def update_program(program_id: UUID, payload: ProgramUpdate, db: Session = Depends(db_dependency)) -> ProgramRead:
    return ProgramService(db).update(program_id, payload)


@router.delete("/{program_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete program")
def delete_program(program_id: UUID, db: Session = Depends(db_dependency)) -> None:
    ProgramService(db).delete(program_id)
