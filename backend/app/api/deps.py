from collections.abc import Generator

from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.exam_scheduling_service import ExamSchedulingService
from app.services.scheduling_service import SchedulingService


def db_dependency() -> Generator[Session, None, None]:
    yield from get_db()


def scheduling_service_dependency(db: Session = Depends(db_dependency)) -> SchedulingService:
    return SchedulingService(db)


def exam_scheduling_service_dependency(db: Session = Depends(db_dependency)) -> ExamSchedulingService:
    return ExamSchedulingService(db)
