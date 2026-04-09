from collections.abc import Generator
from uuid import UUID

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.models.schema.admin_user import AdminUser
from app.repositories.admin_user_repository import AdminUserRepository
from app.core.database import get_db
from app.services.auth_service import ensure_super_admin
from app.services.exam_scheduling_service import ExamSchedulingService
from app.services.errors import unauthorized
from app.services.scheduling_service import SchedulingService


bearer_scheme = HTTPBearer(auto_error=False)


def db_dependency() -> Generator[Session, None, None]:
    yield from get_db()


def scheduling_service_dependency(db: Session = Depends(db_dependency)) -> SchedulingService:
    return SchedulingService(db)


def exam_scheduling_service_dependency(db: Session = Depends(db_dependency)) -> ExamSchedulingService:
    return ExamSchedulingService(db)


def current_user_dependency(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(db_dependency),
) -> AdminUser:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise unauthorized()

    try:
        payload = decode_access_token(credentials.credentials)
        user_id = UUID(str(payload["sub"]))
    except (ValueError, KeyError):
        raise unauthorized()

    user = AdminUserRepository(db).get(user_id)
    if not user or user.status != "ACTIVE":
        raise unauthorized()

    return user


def super_admin_dependency(current_user: AdminUser = Depends(current_user_dependency)) -> AdminUser:
    return ensure_super_admin(current_user)
