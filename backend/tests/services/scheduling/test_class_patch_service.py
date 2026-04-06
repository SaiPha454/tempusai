from __future__ import annotations

from datetime import date
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.models.resource import Room, Timeslot
from app.schemas.scheduling import ScheduleClassEntryPatch
from app.services.scheduling.class_patch_service import ClassDraftPatchService
from conftest import FakeSession


class TestClassDraftPatchService:
    """Validate class draft patching behavior and reference validation paths."""

    def test_apply_entry_patches_updates_entry_and_marks_manual_adjustment(self):
        # Arrange
        entry_id = uuid4()
        slot_id = uuid4()
        room_id = uuid4()

        db = FakeSession(
            get_map={
                (Timeslot, slot_id): SimpleNamespace(id=slot_id),
                (Room, room_id): SimpleNamespace(id=room_id),
            }
        )
        service = ClassDraftPatchService(db)
        entry = SimpleNamespace(timeslot_id=None, room_id=None, manually_adjusted=False)
        patch = ScheduleClassEntryPatch(id=entry_id, timeslot_id=slot_id, room_id=room_id)

        # Act
        service.apply_entry_patches(entry_by_id={entry_id: entry}, patches=[patch])

        # Assert
        assert entry.timeslot_id == slot_id
        assert entry.room_id == room_id
        assert entry.manually_adjusted is True

    def test_apply_entry_patches_raises_bad_request_for_unknown_entry(self):
        # Arrange
        db = FakeSession()
        service = ClassDraftPatchService(db)
        patch = ScheduleClassEntryPatch(id=uuid4(), timeslot_id=None, room_id=None)

        # Act / Assert
        with pytest.raises(HTTPException) as exc:
            service.apply_entry_patches(entry_by_id={}, patches=[patch])
        assert exc.value.status_code == 400
        assert exc.value.detail == "Draft entry does not belong to this snapshot"

    def test_apply_entry_patches_raises_bad_request_for_invalid_room_or_timeslot_reference(self):
        # Arrange
        entry_id = uuid4()
        slot_id = uuid4()
        room_id = uuid4()

        db = FakeSession(get_map={(Timeslot, slot_id): None, (Room, room_id): None})
        service = ClassDraftPatchService(db)
        entry = SimpleNamespace(timeslot_id=None, room_id=None, manually_adjusted=False)

        # Act / Assert - invalid timeslot
        with pytest.raises(HTTPException) as exc_slot:
            service.apply_entry_patches(
                entry_by_id={entry_id: entry},
                patches=[ScheduleClassEntryPatch(id=entry_id, timeslot_id=slot_id, room_id=None)],
            )
        assert exc_slot.value.status_code == 400
        assert exc_slot.value.detail == "Timeslot does not exist"

        # Act / Assert - invalid room
        with pytest.raises(HTTPException) as exc_room:
            service.apply_entry_patches(
                entry_by_id={entry_id: entry},
                patches=[ScheduleClassEntryPatch(id=entry_id, timeslot_id=None, room_id=room_id)],
            )
        assert exc_room.value.status_code == 400
        assert exc_room.value.detail == "Room does not exist"
