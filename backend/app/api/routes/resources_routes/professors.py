from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import db_dependency
from app.schemas.professor import ProfessorCreate, ProfessorRead, ProfessorUpdate
from app.services.professor_service import ProfessorService

router = APIRouter(tags=["resources-professors"])


@router.get("", response_model=list[ProfessorRead], summary="List professors")
def list_professors(
    search: str | None = Query(default=None, description="Case-insensitive search by professor name"),
    db: Session = Depends(db_dependency),
) -> list[ProfessorRead]:
    return ProfessorService(db).list(search=search)


@router.get("/{professor_id}", response_model=ProfessorRead, summary="Get professor by ID")
def get_professor(professor_id: UUID, db: Session = Depends(db_dependency)) -> ProfessorRead:
    return ProfessorService(db).get(professor_id)


@router.post("", response_model=ProfessorRead, status_code=status.HTTP_201_CREATED, summary="Create professor")
def create_professor(payload: ProfessorCreate, db: Session = Depends(db_dependency)) -> ProfessorRead:
    return ProfessorService(db).create(payload)


@router.put("/{professor_id}", response_model=ProfessorRead, summary="Update professor")
def update_professor(professor_id: UUID, payload: ProfessorUpdate, db: Session = Depends(db_dependency)) -> ProfessorRead:
    return ProfessorService(db).update(professor_id, payload)


@router.delete("/{professor_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete professor")
def delete_professor(professor_id: UUID, db: Session = Depends(db_dependency)) -> None:
    ProfessorService(db).delete(professor_id)
