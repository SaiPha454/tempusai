from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.api.deps import current_user_dependency, db_dependency, super_admin_dependency
from app.models.schema.admin_user import AdminUser
from app.schemas.auth import (
    AdminUserRead,
    ChangePasswordRequest,
    CreateAdminUserRequest,
    SignInRequest,
    SignInResponse,
    UpdateProfileRequest,
)
from app.services.auth_service import AuthService

router = APIRouter(tags=["auth"])


@router.post("/sign-in", response_model=SignInResponse, summary="Sign in admin user")
def sign_in(payload: SignInRequest, db: Session = Depends(db_dependency)) -> SignInResponse:
    return AuthService(db).sign_in(payload)


@router.get("/me", response_model=AdminUserRead, summary="Get current authenticated admin user")
def get_me(current_user: AdminUser = Depends(current_user_dependency)) -> AdminUserRead:
    return current_user


@router.patch("/me", response_model=AdminUserRead, summary="Update current user profile")
def update_me(
    payload: UpdateProfileRequest,
    db: Session = Depends(db_dependency),
    current_user: AdminUser = Depends(current_user_dependency),
) -> AdminUserRead:
    return AuthService(db).update_profile(current_user.id, payload)


@router.post("/me/change-password", status_code=status.HTTP_204_NO_CONTENT, summary="Change current user password")
def change_my_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(db_dependency),
    current_user: AdminUser = Depends(current_user_dependency),
) -> Response:
    AuthService(db).change_password(current_user.id, payload)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/admin-users", response_model=list[AdminUserRead], summary="List admin users")
def list_admin_users(
    db: Session = Depends(db_dependency),
    _current_user: AdminUser = Depends(super_admin_dependency),
) -> list[AdminUserRead]:
    return AuthService(db).list_admin_users()


@router.post(
    "/admin-users",
    response_model=AdminUserRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create admin user",
)
def create_admin_user(
    payload: CreateAdminUserRequest,
    db: Session = Depends(db_dependency),
    _current_user: AdminUser = Depends(super_admin_dependency),
) -> AdminUserRead:
    return AuthService(db).create_admin_user(payload)


@router.delete("/admin-users/{user_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Remove admin user")
def remove_admin_user(
    user_id: UUID,
    db: Session = Depends(db_dependency),
    current_user: AdminUser = Depends(super_admin_dependency),
) -> Response:
    AuthService(db).remove_admin_user(actor_user_id=current_user.id, target_user_id=user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
