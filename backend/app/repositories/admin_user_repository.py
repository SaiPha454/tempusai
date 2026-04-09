from __future__ import annotations

from uuid import UUID

from sqlalchemy import Select, select
from sqlalchemy.orm import Session

from app.models.schema.admin_user import AdminUser


class AdminUserRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list(self) -> list[AdminUser]:
        return list(self.db.scalars(select(AdminUser).order_by(AdminUser.display_name.asc())))

    def get(self, user_id: UUID) -> AdminUser | None:
        return self.db.get(AdminUser, user_id)

    def get_by_email(self, email: str) -> AdminUser | None:
        stmt: Select[tuple[AdminUser]] = select(AdminUser).where(AdminUser.email == email)
        return self.db.scalar(stmt)

    def count_by_role(self, role: str) -> int:
        stmt = select(AdminUser).where(AdminUser.role == role)
        return len(list(self.db.scalars(stmt)))

    def create(self, user: AdminUser) -> AdminUser:
        self.db.add(user)
        self.db.flush()
        self.db.refresh(user)
        return user

    def delete(self, user: AdminUser) -> None:
        self.db.delete(user)
