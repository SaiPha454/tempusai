from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.core.security import hash_password
from app.schemas.auth import ChangePasswordRequest, CreateAdminUserRequest, SignInRequest
from app.services.auth_service import AuthService
from conftest import FakeSession


class TestAuthService:
    def test_sign_in_returns_token_when_credentials_are_valid(self):
        db = FakeSession()
        service = AuthService(db)
        now = datetime.now(timezone.utc)

        user = SimpleNamespace(
            id=uuid4(),
            email="superadmin@tempusai.local",
            display_name="System Super Admin",
            role="SUPER_ADMIN",
            status="ACTIVE",
            password_hash=hash_password("Tempus@123"),
            created_at=now,
            updated_at=now,
        )
        service.repo = SimpleNamespace(get_by_email=lambda _email: user)

        result = service.sign_in(SignInRequest(email="superadmin@tempusai.local", password="Tempus@123"))

        assert result.access_token
        assert result.expires_in > 0
        assert result.user.email == "superadmin@tempusai.local"

    def test_sign_in_rejects_invalid_credentials(self):
        db = FakeSession()
        service = AuthService(db)
        now = datetime.now(timezone.utc)

        user = SimpleNamespace(
            id=uuid4(),
            email="superadmin@tempusai.local",
            display_name="System Super Admin",
            role="SUPER_ADMIN",
            status="ACTIVE",
            password_hash=hash_password("Tempus@123"),
            created_at=now,
            updated_at=now,
        )
        service.repo = SimpleNamespace(get_by_email=lambda _email: user)

        with pytest.raises(HTTPException) as exc:
            service.sign_in(SignInRequest(email="superadmin@tempusai.local", password="wrong-password"))

        assert exc.value.status_code == 401

    def test_create_admin_user_rejects_unsupported_role(self):
        service = AuthService(FakeSession())

        with pytest.raises(HTTPException) as exc:
            service.create_admin_user(
                CreateAdminUserRequest(
                    display_name="New User",
                    email="new@tempusai.local",
                    role="EDITOR",
                    initial_password="Tempus@123",
                )
            )

        assert exc.value.status_code == 400
        assert exc.value.detail == "Role must be SUPER_ADMIN or ADMIN"

    def test_remove_admin_user_rejects_deleting_last_super_admin(self):
        db = FakeSession()
        service = AuthService(db)

        super_admin_id = uuid4()
        service.repo = SimpleNamespace(
            get=lambda _user_id: SimpleNamespace(id=super_admin_id, role="SUPER_ADMIN"),
            count_by_role=lambda _role: 1,
            delete=lambda _user: None,
        )

        with pytest.raises(HTTPException) as exc:
            service.remove_admin_user(actor_user_id=uuid4(), target_user_id=super_admin_id)

        assert exc.value.status_code == 400
        assert exc.value.detail == "At least one super admin must remain"

    def test_change_password_rejects_wrong_current_password(self):
        db = FakeSession()
        service = AuthService(db)

        user = SimpleNamespace(
            id=uuid4(),
            password_hash=hash_password("Tempus@123"),
        )
        service.repo = SimpleNamespace(get=lambda _user_id: user)

        with pytest.raises(HTTPException) as exc:
            service.change_password(
                user_id=user.id,
                payload=ChangePasswordRequest(current_password="wrong", new_password="NewPass@123"),
            )

        assert exc.value.status_code == 400
        assert exc.value.detail == "Current password is incorrect"
