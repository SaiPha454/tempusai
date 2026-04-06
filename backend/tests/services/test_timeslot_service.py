from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError

from app.schemas.timeslot import TimeslotCreate, TimeslotUpdate
from app.services.timeslot_service import TimeslotService
from conftest import FakeSession


class TestTimeslotService:
    """Validate timeslot service trimming and duplicate-slot conflict handling."""

    def test_create_trims_day_and_label(self):
        # Arrange
        db = FakeSession()
        service = TimeslotService(db)
        service.repo = SimpleNamespace(create=lambda slot: slot)

        # Act
        created = service.create(TimeslotCreate(day=" Mon ", label=" 9:00 AM - 12:00 PM "))

        # Assert
        assert created.day == "Mon"
        assert created.label == "9:00 AM - 12:00 PM"
        assert db.commit_calls == 1

    def test_get_raises_not_found_for_missing_timeslot(self):
        # Arrange
        service = TimeslotService(FakeSession())
        service.repo = SimpleNamespace(get=lambda _slot_id: None)

        # Act / Assert
        with pytest.raises(HTTPException) as exc:
            service.get(uuid4())
        assert exc.value.status_code == 404
        assert exc.value.detail == "Timeslot not found"

    def test_update_rolls_back_and_raises_conflict_on_duplicate_day_label(self):
        # Arrange
        db = FakeSession()
        existing = SimpleNamespace(id=uuid4(), day="Mon", label="9:00 AM - 12:00 PM")
        service = TimeslotService(db)
        service.repo = SimpleNamespace(get=lambda _slot_id: existing)

        def raise_on_flush():
            raise IntegrityError("dup", None, None)

        db.flush = raise_on_flush

        # Act / Assert
        with pytest.raises(HTTPException) as exc:
            service.update(existing.id, TimeslotUpdate(day="Tue", label="1:00 PM - 4:00 PM"))
        assert exc.value.status_code == 409
        assert exc.value.detail == "Timeslot with this day and label already exists"
        assert db.rollback_calls == 1
