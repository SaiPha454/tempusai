from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.resource import Room, ScheduleExamEntry
from app.schemas.scheduling import ScheduleExamEntryPatch
from app.services.errors import bad_request


class ExamDraftPatchService:
    """Apply exam draft entry patches while validating room references."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def apply_entry_patches(self, *, entry_by_id: dict, patches: list[ScheduleExamEntryPatch]) -> None:
        for patch in patches:
            entry = entry_by_id.get(patch.id)
            if not entry:
                raise bad_request("Draft entry does not belong to this exam snapshot")

            self._apply_single_patch(entry=entry, patch=patch)

    def _apply_single_patch(self, *, entry: ScheduleExamEntry, patch: ScheduleExamEntryPatch) -> None:
        entry.exam_date = patch.exam_date
        entry.timeslot_code = patch.timeslot_code

        if patch.room_id is not None:
            room = self.db.get(Room, patch.room_id)
            if not room:
                raise bad_request("Room does not exist")
            entry.room_id = room.id
            entry.room = room
        else:
            entry.room_id = None
            entry.room = None

        entry.manually_adjusted = True
