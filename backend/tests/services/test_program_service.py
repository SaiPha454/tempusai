from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError

from app.schemas.program import ProgramCreate
from app.services.program_service import ProgramService
from conftest import FakeSession


class TestProgramService:
    """Validate program service normalization and conflict/error behavior."""

    def test_create_generates_slug_when_value_is_missing(self):
        # Arrange
        db = FakeSession()
        service = ProgramService(db)
        service.repo = SimpleNamespace(create=lambda program: program)

        # Act
        created = service.create(ProgramCreate(label=" Software Engineering ", value=None))

        # Assert
        assert created.label == "Software Engineering"
        assert created.value == "software-engineering"
        assert db.commit_calls == 1

    def test_create_raises_bad_request_when_generated_value_is_empty(self):
        # Arrange
        service = ProgramService(FakeSession())

        # Act / Assert
        with pytest.raises(HTTPException) as exc:
            service.create(ProgramCreate(label=" !!! ", value=None))
        assert exc.value.status_code == 400
        assert exc.value.detail == "Program value cannot be empty"

    def test_delete_rolls_back_and_raises_conflict_when_program_is_referenced(self):
        # Arrange
        db = FakeSession()
        service = ProgramService(db)
        existing = SimpleNamespace(id=uuid4())
        service.repo = SimpleNamespace(get=lambda _id: existing, delete=lambda _program: (_ for _ in ()).throw(IntegrityError("fk", None, None)))

        # Act / Assert
        with pytest.raises(HTTPException) as exc:
            service.delete(existing.id)
        assert exc.value.status_code == 409
        assert exc.value.detail == "Program is referenced by other resources"
        assert db.rollback_calls == 1
