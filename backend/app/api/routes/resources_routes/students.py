from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import db_dependency
from app.schemas.student import StudentCreate, StudentRead, StudentUpdate
from app.services.student_service import StudentService

router = APIRouter(tags=["resources-students"])


@router.get("", response_model=list[StudentRead], summary="List students")
def list_students(
    study_program: str | None = Query(default=None, description="Filter by program value"),
    year: int | None = Query(default=None, description="Filter by study year (1-4)"),
    db: Session = Depends(db_dependency),
) -> list[StudentRead]:
    return StudentService(db).list(study_program=study_program, year=year)


@router.get("/{student_pk}", response_model=StudentRead, summary="Get student by ID")
def get_student(student_pk: UUID, db: Session = Depends(db_dependency)) -> StudentRead:
    return StudentService(db).get(student_pk)


@router.post("", response_model=StudentRead, status_code=status.HTTP_201_CREATED, summary="Create student")
def create_student(payload: StudentCreate, db: Session = Depends(db_dependency)) -> StudentRead:
    return StudentService(db).create(payload)


@router.put("/{student_pk}", response_model=StudentRead, summary="Update student")
def update_student(student_pk: UUID, payload: StudentUpdate, db: Session = Depends(db_dependency)) -> StudentRead:
    return StudentService(db).update(student_pk, payload)


@router.delete("/{student_pk}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete student")
def delete_student(student_pk: UUID, db: Session = Depends(db_dependency)) -> None:
    StudentService(db).delete(student_pk)
