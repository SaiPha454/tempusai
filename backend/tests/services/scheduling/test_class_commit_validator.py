from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4

from app.services.scheduling.class_commit_validator import ClassCommitValidator


def make_entry(**overrides):
    base = {
        "timeslot_id": uuid4(),
        "room_id": uuid4(),
        "professor_id": uuid4(),
    }
    base.update(overrides)
    return SimpleNamespace(**base)


class TestClassCommitValidator:
    """Validate class draft commit guards for unassigned and overlap constraints."""

    def test_validate_returns_all_blocking_errors_when_multiple_constraints_fail(self):
        # Arrange
        slot_id = uuid4()
        room_id = uuid4()
        professor_id = uuid4()

        snapshot = SimpleNamespace(
            constraints={"professorNoOverlap": True},
            entries=[
                make_entry(timeslot_id=None, room_id=None),
                make_entry(timeslot_id=slot_id, room_id=room_id, professor_id=professor_id),
            ],
        )

        # Act
        errors = ClassCommitValidator.validate(
            snapshot=snapshot,
            occupied_room_slots={(room_id, slot_id)},
            occupied_professor_slots={(professor_id, slot_id)},
            has_existing_confirmed_snapshot=True,
        )

        # Assert
        assert "Cannot save schedule while some courses are unassigned. Assign room and timeslot for all courses." in errors
        assert "Cannot save schedule due to room overlap with an existing confirmed schedule" in errors
        assert "Cannot save schedule due to professor overlap with an existing confirmed schedule" in errors
        assert (
            "This program already has a committed schedule. Delete it or convert it to draft before committing another schedule."
            in errors
        )

    def test_validate_skips_professor_overlap_when_constraint_is_disabled(self):
        # Arrange
        slot_id = uuid4()
        professor_id = uuid4()
        snapshot = SimpleNamespace(
            constraints={"professorNoOverlap": False},
            entries=[make_entry(timeslot_id=slot_id, room_id=uuid4(), professor_id=professor_id)],
        )

        # Act
        errors = ClassCommitValidator.validate(
            snapshot=snapshot,
            occupied_room_slots=set(),
            occupied_professor_slots={(professor_id, slot_id)},
            has_existing_confirmed_snapshot=False,
        )

        # Assert
        assert errors == []
