from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import db_dependency
from app.schemas.special_enrollment import (
    SpecialEnrollmentCreate,
    SpecialEnrollmentRead,
    SpecialEnrollmentUpdate,
)
from app.services.special_enrollment_service import SpecialEnrollmentService

router = APIRouter(tags=["resources-special-enrollments"])


@router.get("", response_model=list[SpecialEnrollmentRead], summary="List special enrollments")
def list_special_enrollments(
    study_program: str | None = Query(default=None, description="Filter by student's program value"),
    course_code: str | None = Query(default=None, description="Filter enrollments that include a specific course code"),
    db: Session = Depends(db_dependency),
) -> list[SpecialEnrollmentRead]:
    return SpecialEnrollmentService(db).list(program=study_program, course_code=course_code)


@router.get("/{enrollment_id}", response_model=SpecialEnrollmentRead, summary="Get special enrollment by ID")
def get_special_enrollment(enrollment_id: UUID, db: Session = Depends(db_dependency)) -> SpecialEnrollmentRead:
    return SpecialEnrollmentService(db).get(enrollment_id)


@router.post("", response_model=SpecialEnrollmentRead, status_code=status.HTTP_201_CREATED, summary="Create special enrollment")
def create_special_enrollment(payload: SpecialEnrollmentCreate, db: Session = Depends(db_dependency)) -> SpecialEnrollmentRead:
    return SpecialEnrollmentService(db).create(payload)


@router.put("/{enrollment_id}", response_model=SpecialEnrollmentRead, summary="Update special enrollment")
def update_special_enrollment(
    enrollment_id: UUID,
    payload: SpecialEnrollmentUpdate,
    db: Session = Depends(db_dependency),
) -> SpecialEnrollmentRead:
    return SpecialEnrollmentService(db).update(enrollment_id, payload)


@router.delete("/{enrollment_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete special enrollment")
def delete_special_enrollment(enrollment_id: UUID, db: Session = Depends(db_dependency)) -> None:
    SpecialEnrollmentService(db).delete(enrollment_id)
