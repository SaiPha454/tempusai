from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import db_dependency
from app.schemas.program_year_plan import ProgramYearCourseCreate, ProgramYearCourseRead, ProgramYearCourseUpdate
from app.services.program_year_plan_service import ProgramYearPlanService

router = APIRouter(tags=["resources-program-year-plans"])


@router.get("", response_model=list[ProgramYearCourseRead], summary="List program-year plan rows")
def list_program_year_plan_rows(
    program_value: str | None = Query(default=None, description="Filter by program value"),
    db: Session = Depends(db_dependency),
) -> list[ProgramYearCourseRead]:
    return ProgramYearPlanService(db).list(program_value=program_value)


@router.get("/{row_id}", response_model=ProgramYearCourseRead, summary="Get plan row by ID")
def get_program_year_plan_row(row_id: UUID, db: Session = Depends(db_dependency)) -> ProgramYearCourseRead:
    return ProgramYearPlanService(db).get(row_id)


@router.post("", response_model=ProgramYearCourseRead, status_code=status.HTTP_201_CREATED, summary="Create plan row")
def create_program_year_plan_row(
    payload: ProgramYearCourseCreate,
    db: Session = Depends(db_dependency),
) -> ProgramYearCourseRead:
    return ProgramYearPlanService(db).create(payload)


@router.put("/{row_id}", response_model=ProgramYearCourseRead, summary="Update plan row")
def update_program_year_plan_row(
    row_id: UUID,
    payload: ProgramYearCourseUpdate,
    db: Session = Depends(db_dependency),
) -> ProgramYearCourseRead:
    return ProgramYearPlanService(db).update(row_id, payload)


@router.delete("/{row_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete plan row")
def delete_program_year_plan_row(row_id: UUID, db: Session = Depends(db_dependency)) -> None:
    ProgramYearPlanService(db).delete(row_id)
