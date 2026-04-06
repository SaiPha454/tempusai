from __future__ import annotations

from datetime import date
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.models.resource import Room
from app.schemas.scheduling import ScheduleExamEntryPatch
from app.services.scheduling.exam_patch_service import ExamDraftPatchService
from conftest import FakeSession


class TestExamDraftPatchService:
    """Validate exam entry patching and room reference validation behavior."""

    def test_apply_entry_patches_updates_exam_fields_and_room_assignment(self):
        # Arrange
        entry_id = uuid4()
        room_id = uuid4()
        room = SimpleNamespace(id=room_id)
        entry = SimpleNamespace(
            exam_date=None,
            timeslot_code=None,
            room_id=None,
            room=None,
            manually_adjusted=False,
        )
        patch = ScheduleExamEntryPatch(
            id=entry_id,
            exam_date=date(2026, 5, 15),
            timeslot_code="afternoon-exam",
            room_id=room_id,
        )
        service = ExamDraftPatchService(FakeSession(get_map={(Room, room_id): room}))

        # Act
        service.apply_entry_patches(entry_by_id={entry_id: entry}, patches=[patch])

        # Assert
        assert entry.exam_date == date(2026, 5, 15)
        assert entry.timeslot_code == "afternoon-exam"
        assert entry.room_id == room_id
        assert entry.room is room
        assert entry.manually_adjusted is True

    def test_apply_entry_patches_clears_room_when_room_id_is_none(self):
        # Arrange
        entry_id = uuid4()
        entry = SimpleNamespace(
            exam_date=date(2026, 5, 11),
            timeslot_code="morning-exam",
            room_id=uuid4(),
            room=SimpleNamespace(id=uuid4()),
            manually_adjusted=False,
        )
        patch = ScheduleExamEntryPatch(id=entry_id, exam_date=None, timeslot_code=None, room_id=None)
        service = ExamDraftPatchService(FakeSession())

        # Act
        service.apply_entry_patches(entry_by_id={entry_id: entry}, patches=[patch])

        # Assert
        assert entry.exam_date is None
        assert entry.timeslot_code is None
        assert entry.room_id is None
        assert entry.room is None
        assert entry.manually_adjusted is True

    def test_apply_entry_patches_raises_bad_request_for_invalid_entry_or_room(self):
        # Arrange
        entry_id = uuid4()
        patch_for_missing_entry = ScheduleExamEntryPatch(id=entry_id, exam_date=None, timeslot_code=None, room_id=None)
        service = ExamDraftPatchService(FakeSession())

        # Act / Assert - missing entry
        with pytest.raises(HTTPException) as exc_missing_entry:
            service.apply_entry_patches(entry_by_id={}, patches=[patch_for_missing_entry])
        assert exc_missing_entry.value.status_code == 400
        assert exc_missing_entry.value.detail == "Draft entry does not belong to this exam snapshot"

        # Act / Assert - missing room
        patch_with_invalid_room = ScheduleExamEntryPatch(
            id=entry_id,
            exam_date=date(2026, 5, 20),
            timeslot_code="morning-exam",
            room_id=uuid4(),
        )
        with pytest.raises(HTTPException) as exc_missing_room:
            service.apply_entry_patches(
                entry_by_id={
                    entry_id: SimpleNamespace(
                        exam_date=None,
                        timeslot_code=None,
                        room_id=None,
                        room=None,
                        manually_adjusted=False,
                    )
                },
                patches=[patch_with_invalid_room],
            )
        assert exc_missing_room.value.status_code == 400
        assert exc_missing_room.value.detail == "Room does not exist"
