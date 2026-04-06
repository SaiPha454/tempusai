from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4

from app.services.scheduling.class_conflict_detector import ClassConflictDetector


def make_class_entry(**overrides):
    base = {
        "id": uuid4(),
        "course_id": uuid4(),
        "year": 1,
        "timeslot_id": uuid4(),
        "room_id": uuid4(),
        "professor_id": uuid4(),
        "room": SimpleNamespace(capacity=40),
    }
    base.update(overrides)
    return SimpleNamespace(**base)


class TestClassConflictDetector:
    """Validate class hard-constraint conflict detection for entries and candidates."""

    def test_compute_entry_conflicts_reports_unassigned_capacity_and_overlap_conflicts(self):
        # Arrange
        slot_id = uuid4()
        room_id = uuid4()
        professor_id = uuid4()

        entry_unassigned = make_class_entry(timeslot_id=None, room_id=None)
        entry_conflicted = make_class_entry(
            timeslot_id=slot_id,
            room_id=room_id,
            professor_id=professor_id,
            year=2,
            room=SimpleNamespace(capacity=10),
        )
        entry_duplicate = make_class_entry(
            timeslot_id=slot_id,
            room_id=room_id,
            professor_id=professor_id,
            year=2,
            room=SimpleNamespace(capacity=100),
        )

        occupied_room_slots = {(room_id, slot_id)}
        occupied_professor_slots = {(professor_id, slot_id)}
        course_demand = {
            (entry_conflicted.course_id, entry_conflicted.year): 30,
            (entry_duplicate.course_id, entry_duplicate.year): 5,
        }

        # Act
        conflicts = ClassConflictDetector.compute_entry_conflicts(
            entries=[entry_unassigned, entry_conflicted, entry_duplicate],
            constraints={
                "roomCapacityCheck": True,
                "professorNoOverlap": True,
                "studentGroupsNoOverlap": True,
            },
            course_demand_by_pair=course_demand,
            occupied_room_slots=occupied_room_slots,
            occupied_professor_slots=occupied_professor_slots,
        )

        # Assert
        assert "unassigned" in conflicts[entry_unassigned.id]
        assert "room_capacity_exceeded" in conflicts[entry_conflicted.id]
        assert "room_overlap" in conflicts[entry_conflicted.id]
        assert "professor_overlap" in conflicts[entry_conflicted.id]
        assert "year_overlap" in conflicts[entry_conflicted.id]
        assert "room_overlap" in conflicts[entry_duplicate.id]
        assert "professor_overlap" in conflicts[entry_duplicate.id]
        assert "year_overlap" in conflicts[entry_duplicate.id]

    def test_compute_candidate_conflict_codes_respects_constraints_and_existing_entries(self):
        # Arrange
        timeslot_id = uuid4()
        room_id = uuid4()
        professor_id = uuid4()
        existing = make_class_entry(
            timeslot_id=timeslot_id,
            room_id=room_id,
            professor_id=professor_id,
            year=3,
        )

        # Act
        codes_with_constraints = ClassConflictDetector.compute_candidate_conflict_codes(
            entries=[existing],
            year=3,
            professor_id=professor_id,
            timeslot_id=timeslot_id,
            room_id=room_id,
            constraints={"professorNoOverlap": True, "studentGroupsNoOverlap": True},
            occupied_room_slots={(room_id, timeslot_id)},
            occupied_professor_slots={(professor_id, timeslot_id)},
        )
        codes_without_constraints = ClassConflictDetector.compute_candidate_conflict_codes(
            entries=[existing],
            year=3,
            professor_id=professor_id,
            timeslot_id=timeslot_id,
            room_id=room_id,
            constraints={"professorNoOverlap": False, "studentGroupsNoOverlap": False},
            occupied_room_slots=set(),
            occupied_professor_slots=set(),
        )

        # Assert
        assert "room_overlap" in codes_with_constraints
        assert "professor_overlap" in codes_with_constraints
        assert "year_overlap" in codes_with_constraints
        assert "room_overlap" in codes_without_constraints
        assert "professor_overlap" not in codes_without_constraints
        assert "year_overlap" not in codes_without_constraints
