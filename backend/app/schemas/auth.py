from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class AdminUserRead(ORMModel):
    id: UUID
    email: str
    display_name: str
    role: str
    status: str
    created_at: datetime
    updated_at: datetime


class SignInRequest(BaseModel):
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=1, max_length=128)


class SignInResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: AdminUserRead


class UpdateProfileRequest(BaseModel):
    display_name: str = Field(min_length=1, max_length=120)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class CreateAdminUserRequest(BaseModel):
    display_name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=5, max_length=255)
    role: str = Field(min_length=1, max_length=32)
    initial_password: str = Field(min_length=8, max_length=128)
