from __future__ import annotations

import re
from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password, verify_password
from app.models.schema.admin_user import AdminUser
from app.repositories.admin_user_repository import AdminUserRepository
from app.schemas.auth import (
    ChangePasswordRequest,
    CreateAdminUserRequest,
    SignInRequest,
    SignInResponse,
    UpdateProfileRequest,
)
from app.services.errors import bad_request, conflict, forbidden, not_found, unauthorized

ROLE_SUPER_ADMIN = "SUPER_ADMIN"
ROLE_ADMIN = "ADMIN"
ALLOWED_ROLES = {ROLE_SUPER_ADMIN, ROLE_ADMIN}
STATUS_ACTIVE = "ACTIVE"
EMAIL_REGEX = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


class AuthService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repo = AdminUserRepository(db)

    def sign_in(self, payload: SignInRequest) -> SignInResponse:
        email = payload.email.strip().lower()
        if not EMAIL_REGEX.match(email):
            raise bad_request("Email format is invalid")

        user = self.repo.get_by_email(email)

        if not user or user.status != STATUS_ACTIVE:
            raise unauthorized("Invalid email or password")

        if not verify_password(payload.password, user.password_hash):
            raise unauthorized("Invalid email or password")

        token, expires_in = create_access_token(subject=str(user.id), role=user.role)
        return SignInResponse(access_token=token, expires_in=expires_in, user=user)

    def get_user(self, user_id: UUID) -> AdminUser:
        user = self.repo.get(user_id)
        if not user:
            raise not_found("Admin user")
        return user

    def list_admin_users(self) -> list[AdminUser]:
        return self.repo.list()

    def create_admin_user(self, payload: CreateAdminUserRequest) -> AdminUser:
        role = payload.role.strip().upper()
        if role not in ALLOWED_ROLES:
            raise bad_request("Role must be SUPER_ADMIN or ADMIN")

        email = payload.email.strip().lower()
        if not EMAIL_REGEX.match(email):
            raise bad_request("Email format is invalid")

        if self.repo.get_by_email(email):
            raise conflict("Email is already used by another admin user")

        user = AdminUser(
            email=email,
            display_name=payload.display_name.strip(),
            role=role,
            status=STATUS_ACTIVE,
            password_hash=hash_password(payload.initial_password),
        )

        try:
            created = self.repo.create(user)
            self.db.commit()
            return created
        except IntegrityError:
            self.db.rollback()
            raise conflict("Unable to create admin user due to duplicate data")

    def remove_admin_user(self, *, actor_user_id: UUID, target_user_id: UUID) -> None:
        if actor_user_id == target_user_id:
            raise bad_request("You cannot remove your own account")

        target_user = self.repo.get(target_user_id)
        if not target_user:
            raise not_found("Admin user")

        if target_user.role == ROLE_SUPER_ADMIN and self.repo.count_by_role(ROLE_SUPER_ADMIN) <= 1:
            raise bad_request("At least one super admin must remain")

        self.repo.delete(target_user)
        self.db.commit()

    def update_profile(self, user_id: UUID, payload: UpdateProfileRequest) -> AdminUser:
        user = self.get_user(user_id)
        user.display_name = payload.display_name.strip()
        self.db.flush()
        self.db.commit()
        self.db.refresh(user)
        return user

    def change_password(self, user_id: UUID, payload: ChangePasswordRequest) -> None:
        if payload.current_password == payload.new_password:
            raise bad_request("New password must be different from current password")

        user = self.get_user(user_id)

        if not verify_password(payload.current_password, user.password_hash):
            raise bad_request("Current password is incorrect")

        user.password_hash = hash_password(payload.new_password)
        self.db.flush()
        self.db.commit()


def ensure_super_admin(user: AdminUser) -> AdminUser:
    if user.role != ROLE_SUPER_ADMIN:
        raise forbidden("Super admin permission is required")
    return user
