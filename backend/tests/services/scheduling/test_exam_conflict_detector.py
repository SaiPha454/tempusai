from __future__ import annotations

from datetime import date
from types import SimpleNamespace
from uuid import uuid4

from app.services.scheduling.exam_conflict_detector import ExamConflictDetector


def make_exam_entry(**overrides):
    base = {
        "id": uuid4(),
        "program_id": uuid4(),
        "year": 1,
        "exam_date": date(2026, 5, 10),
        "timeslot_code": "morning-exam",
        "room_id": uuid4(),
    }
    base.update(overrides)
    return SimpleNamespace(**base)


class TestExamConflictDetector:
    """Validate exam conflict rules for assignment, overlap, capacity, and student intersections."""

    def test_compute_entry_conflicts_reports_capacity_room_program_year_and_student_overlap(self):
        # Arrange
        room_id = uuid4()
        program_id = uuid4()
        day = date(2026, 5, 10)

        first = make_exam_entry(program_id=program_id, year=2, exam_date=day, timeslot_code="morning-exam", room_id=room_id)
        second = make_exam_entry(program_id=program_id, year=2, exam_date=day, timeslot_code="morning-exam", room_id=room_id)

        # Act
        conflicts = ExamConflictDetector.compute_entry_conflicts(
            entries=[first, second],
            constraints={
                "room_capacity_check": True,
                "no_same_program_year_day_timeslot": True,
                "no_student_overlap": True,
            },
            room_demand={first.id: 100, second.id: 10},
            room_capacity_by_id={room_id: 50},
            confirmed_room_slots={(room_id, day, "morning-exam")},
            student_edges_by_index={0: {1}, 1: {0}},
        )

        # Assert
        assert "room_capacity_exceeded" in conflicts[first.id]
        assert "room_overlap" in conflicts[first.id]
        assert "room_overlap" in conflicts[second.id]
        assert "program_year_overlap" in conflicts[first.id]
        assert "program_year_overlap" in conflicts[second.id]
        assert "student_overlap" in conflicts[first.id]
        assert "student_overlap" in conflicts[second.id]

    def test_compute_entry_conflicts_marks_unassigned_and_respects_disabled_constraints(self):
        # Arrange
        unassigned = make_exam_entry(exam_date=None, timeslot_code=None, room_id=None)

        # Act
        conflicts = ExamConflictDetector.compute_entry_conflicts(
            entries=[unassigned],
            constraints={
                "room_capacity_check": False,
                "no_same_program_year_day_timeslot": False,
                "no_student_overlap": False,
            },
            room_demand={},
            room_capacity_by_id={},
            confirmed_room_slots=set(),
            student_edges_by_index={},
        )

        # Assert
        assert conflicts[unassigned.id] == ["unassigned"]
