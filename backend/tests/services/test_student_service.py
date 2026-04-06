from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError

from app.schemas.student import StudentCreate
from app.services.student_service import StudentService
from conftest import FakeSession


class TestStudentService:
    """Validate student service business validation and conflict handling behavior."""

    def test_resolve_program_id_raises_bad_request_when_program_does_not_exist(self):
        # Arrange
        service = StudentService(FakeSession())
        service.program_repo = SimpleNamespace(get_by_value=lambda _value: None)

        # Act / Assert
        with pytest.raises(HTTPException) as exc:
            service._resolve_program_id("software-engineering")
        assert exc.value.status_code == 400
        assert exc.value.detail == "Study program does not exist"

    def test_create_rolls_back_and_raises_conflict_on_duplicate_student_id(self):
        # Arrange
        db = FakeSession()
        service = StudentService(db)
        service.program_repo = SimpleNamespace(get_by_value=lambda _value: SimpleNamespace(id=uuid4()))

        def raise_integrity(_student):
            raise IntegrityError("duplicate", params=None, orig=None)

        service.repo = SimpleNamespace(create=raise_integrity)
        payload = StudentCreate(
            student_id=" 65010001 ",
            name=" Alice ",
            study_program="software-engineering",
            year=2,
        )

        # Act / Assert
        with pytest.raises(HTTPException) as exc:
            service.create(payload)
        assert exc.value.status_code == 409
        assert exc.value.detail == "Student ID already exists"
        assert db.rollback_calls == 1
