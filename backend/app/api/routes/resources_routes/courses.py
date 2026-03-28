from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import db_dependency
from app.schemas.course import CourseCreate, CourseRead, CourseUpdate
from app.services.course_service import CourseService

router = APIRouter(tags=["resources-courses"])


@router.get("", response_model=list[CourseRead], summary="List courses")
def list_courses(
    study_program: str | None = Query(default=None, description="Filter by program value, e.g. computer-engineering"),
    search: str | None = Query(default=None, description="Search by course code or name"),
    db: Session = Depends(db_dependency),
) -> list[CourseRead]:
    return CourseService(db).list(study_program=study_program, search=search)


@router.get("/{course_id}", response_model=CourseRead, summary="Get course by ID")
def get_course(course_id: UUID, db: Session = Depends(db_dependency)) -> CourseRead:
    return CourseService(db).get(course_id)


@router.post("", response_model=CourseRead, status_code=status.HTTP_201_CREATED, summary="Create course")
def create_course(payload: CourseCreate, db: Session = Depends(db_dependency)) -> CourseRead:
    return CourseService(db).create(payload)


@router.put("/{course_id}", response_model=CourseRead, summary="Update course")
def update_course(course_id: UUID, payload: CourseUpdate, db: Session = Depends(db_dependency)) -> CourseRead:
    return CourseService(db).update(course_id, payload)


@router.delete("/{course_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete course")
def delete_course(course_id: UUID, db: Session = Depends(db_dependency)) -> None:
    CourseService(db).delete(course_id)
