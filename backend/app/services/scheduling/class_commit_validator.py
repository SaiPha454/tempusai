from __future__ import annotations

from uuid import UUID

from app.models.resource import ScheduleClassSnapshot


class ClassCommitValidator:
    """Validate class snapshot commit preconditions and return all blocking messages."""

    @staticmethod
    def validate(
        *,
        snapshot: ScheduleClassSnapshot,
        occupied_room_slots: set[tuple[UUID, UUID]],
        occupied_professor_slots: set[tuple[UUID, UUID]],
        has_existing_confirmed_snapshot: bool,
    ) -> list[str]:
        errors: list[str] = []

        has_unassigned_entry = any(not entry.timeslot_id or not entry.room_id for entry in snapshot.entries)
        if has_unassigned_entry:
            errors.append("Cannot save schedule while some courses are unassigned. Assign room and timeslot for all courses.")

        for entry in snapshot.entries:
            if not entry.timeslot_id:
                continue
            if entry.room_id and (entry.room_id, entry.timeslot_id) in occupied_room_slots:
                errors.append("Cannot save schedule due to room overlap with an existing confirmed schedule")
                break

        for entry in snapshot.entries:
            if (
                snapshot.constraints.get("professorNoOverlap", True)
                and entry.professor_id
                and entry.timeslot_id
                and (entry.professor_id, entry.timeslot_id) in occupied_professor_slots
            ):
                errors.append("Cannot save schedule due to professor overlap with an existing confirmed schedule")
                break

        if has_existing_confirmed_snapshot:
            errors.append(
                "This program already has a committed schedule. Delete it or convert it to draft before committing another schedule."
            )

        return errors
