from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.resource import Room, ScheduleClassEntry, Timeslot
from app.schemas.scheduling import ScheduleClassEntryPatch
from app.services.errors import bad_request


class ClassDraftPatchService:
    """Apply class draft entry patches while validating referenced resources."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def apply_entry_patches(
        self,
        *,
        entry_by_id: dict,
        patches: list[ScheduleClassEntryPatch],
    ) -> None:
        for patch in patches:
            entry = entry_by_id.get(patch.id)
            if not entry:
                raise bad_request("Draft entry does not belong to this snapshot")

            self._apply_single_patch(entry=entry, patch=patch)

    def _apply_single_patch(self, *, entry: ScheduleClassEntry, patch: ScheduleClassEntryPatch) -> None:
        if patch.timeslot_id is not None:
            slot = self.db.get(Timeslot, patch.timeslot_id)
            if not slot:
                raise bad_request("Timeslot does not exist")
            entry.timeslot_id = slot.id
        else:
            entry.timeslot_id = None

        if patch.room_id is not None:
            room = self.db.get(Room, patch.room_id)
            if not room:
                raise bad_request("Room does not exist")
            entry.room_id = room.id
        else:
            entry.room_id = None

        entry.manually_adjusted = True
