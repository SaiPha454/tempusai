from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError

from app.schemas.professor import ProfessorCreate
from app.services.professor_service import ANY_TIME_SENTINEL, ProfessorService
from conftest import FakeSession


class TestProfessorService:
    """Validate professor availability normalization and create conflict handling."""

    def test_normalize_slots_supports_any_time_and_validates_timeslot_ids(self):
        # Arrange
        slot_id = uuid4()
        service = ProfessorService(FakeSession())
        service.timeslot_repo = SimpleNamespace(get=lambda value: SimpleNamespace(id=value) if value == slot_id else None)

        # Act
        any_time, any_slots = service._normalize_slots([ANY_TIME_SENTINEL])
        explicit_time, explicit_slots = service._normalize_slots([str(slot_id)])

        # Assert
        assert any_time is True
        assert any_slots == []
        assert explicit_time is False
        assert explicit_slots == [slot_id]

    def test_normalize_slots_raises_bad_request_for_invalid_or_unknown_timeslot(self):
        # Arrange
        service = ProfessorService(FakeSession())
        service.timeslot_repo = SimpleNamespace(get=lambda _value: None)

        # Act / Assert - invalid UUID format
        with pytest.raises(HTTPException) as exc_invalid:
            service._normalize_slots(["not-a-uuid"])
        assert exc_invalid.value.status_code == 400
        assert "Invalid timeslot id" in exc_invalid.value.detail

        # Act / Assert - unknown UUID in repository
        missing_slot = uuid4()
        with pytest.raises(HTTPException) as exc_missing:
            service._normalize_slots([str(missing_slot)])
        assert exc_missing.value.status_code == 400
        assert exc_missing.value.detail == f"Timeslot not found: {missing_slot}"

    def test_create_rolls_back_and_raises_conflict_when_professor_name_is_duplicate(self):
        # Arrange
        db = FakeSession()
        service = ProfessorService(db)
        service.timeslot_repo = SimpleNamespace(get=lambda _value: None)

        def raise_integrity(_professor):
            raise IntegrityError("duplicate", params=None, orig=None)

        service.repo = SimpleNamespace(create=raise_integrity)
        payload = ProfessorCreate(name=" Prof A ", available_slot_ids=[ANY_TIME_SENTINEL])

        # Act / Assert
        with pytest.raises(HTTPException) as exc:
            service.create(payload)
        assert exc.value.status_code == 409
        assert exc.value.detail == "Professor name already exists"
        assert db.rollback_calls == 1
