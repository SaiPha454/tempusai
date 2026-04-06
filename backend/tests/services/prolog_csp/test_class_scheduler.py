from __future__ import annotations

import subprocess
from uuid import uuid4

import pytest

from app.services.prolog_csp.class_scheduler import PrologClassScheduler, PrologCourseRow


class TestPrologClassScheduler:
    """Validate Prolog class scheduler adapter behavior around fact generation and subprocess boundaries."""

    def test_solve_raises_runtime_error_when_swipl_is_missing(self):
        # Arrange
        scheduler = PrologClassScheduler()
        scheduler._swipl = None

        # Act / Assert
        with pytest.raises(RuntimeError, match="SWI-Prolog executable 'swipl' was not found"):
            scheduler.solve(
                course_rows=[PrologCourseRow(course_id=uuid4(), professor_id=None, year=1, required_capacity=10)],
                room_capacity_by_id={},
                timeslot_ids=[],
                preferred_timeslots_by_course_id={},
                occupied_room_slots=set(),
                occupied_professor_slots=set(),
                professor_no_overlap=True,
                student_groups_no_overlap=True,
                room_capacity_check=True,
            )

    def test_solve_returns_assignments_when_subprocess_succeeds(self, monkeypatch):
        # Arrange
        scheduler = PrologClassScheduler(timeout_seconds=10)
        scheduler._swipl = "swipl"

        course_id = uuid4()
        room_id = uuid4()
        slot_id = uuid4()
        row = PrologCourseRow(course_id=course_id, professor_id=None, year=1, required_capacity=30)

        output = (
            f"'{course_id}'\t'none-{course_id}'\t1\t'{room_id}'\t'{slot_id}'\n"
        )

        def fake_run(*_args, **_kwargs):
            return subprocess.CompletedProcess(args=[], returncode=0, stdout=output, stderr="")

        monkeypatch.setattr(subprocess, "run", fake_run)

        # Act
        assignments = scheduler.solve(
            course_rows=[row],
            room_capacity_by_id={room_id: 50},
            timeslot_ids=[slot_id],
            preferred_timeslots_by_course_id={course_id: [slot_id]},
            occupied_room_slots=set(),
            occupied_professor_slots=set(),
            professor_no_overlap=True,
            student_groups_no_overlap=True,
            room_capacity_check=True,
        )

        # Assert
        assert assignments == {course_id: (room_id, slot_id)}

    def test_solve_raises_runtime_error_on_non_zero_exit(self, monkeypatch):
        # Arrange
        scheduler = PrologClassScheduler()
        scheduler._swipl = "swipl"

        def fake_run(*_args, **_kwargs):
            return subprocess.CompletedProcess(args=[], returncode=1, stdout="", stderr="prolog failed")

        monkeypatch.setattr(subprocess, "run", fake_run)

        # Act / Assert
        with pytest.raises(RuntimeError, match="prolog failed"):
            scheduler.solve(
                course_rows=[PrologCourseRow(course_id=uuid4(), professor_id=None, year=1, required_capacity=10)],
                room_capacity_by_id={},
                timeslot_ids=[uuid4()],
                preferred_timeslots_by_course_id={},
                occupied_room_slots=set(),
                occupied_professor_slots=set(),
                professor_no_overlap=True,
                student_groups_no_overlap=True,
                room_capacity_check=True,
            )

    def test_solve_returns_partial_assignments_on_timeout(self, monkeypatch):
        # Arrange
        scheduler = PrologClassScheduler()
        scheduler._swipl = "swipl"

        course_id = uuid4()
        room_id = uuid4()
        slot_id = uuid4()
        partial = f"'{course_id}'\t'none-{course_id}'\t1\t'{room_id}'\t'{slot_id}'\n"

        def fake_run(*_args, **_kwargs):
            raise subprocess.TimeoutExpired(cmd="swipl", timeout=5, output=partial)

        monkeypatch.setattr(subprocess, "run", fake_run)

        # Act
        assignments = scheduler.solve(
            course_rows=[PrologCourseRow(course_id=course_id, professor_id=None, year=1, required_capacity=10)],
            room_capacity_by_id={room_id: 100},
            timeslot_ids=[slot_id],
            preferred_timeslots_by_course_id={},
            occupied_room_slots=set(),
            occupied_professor_slots=set(),
            professor_no_overlap=True,
            student_groups_no_overlap=True,
            room_capacity_check=True,
        )

        # Assert
        assert assignments == {course_id: (room_id, slot_id)}

    def test_parse_output_skips_malformed_lines(self):
        # Arrange
        scheduler = PrologClassScheduler()
        course_id = uuid4()
        room_id = uuid4()
        slot_id = uuid4()
        output = "\n".join(
            [
                "bad-line",
                f"'{course_id}'\t'prof'\t1\t'{room_id}'\t'{slot_id}'",
                "'x'\t'too'\t'short'",
            ]
        )

        # Act
        parsed = scheduler._parse_output(output)

        # Assert
        assert parsed == {course_id: (room_id, slot_id)}

    def test_write_facts_writes_expected_constraints_and_facts(self, tmp_path):
        # Arrange
        scheduler = PrologClassScheduler()
        file_path = tmp_path / "facts.pl"

        course_id = uuid4()
        professor_id = uuid4()
        room_id = uuid4()
        slot_id = uuid4()

        # Act
        scheduler._write_facts(
            file_path=file_path,
            course_rows=[
                PrologCourseRow(
                    course_id=course_id,
                    professor_id=professor_id,
                    year=2,
                    required_capacity=45,
                )
            ],
            room_capacity_by_id={room_id: 60},
            timeslot_ids=[slot_id],
            preferred_timeslots_by_course_id={course_id: [slot_id]},
            occupied_room_slots={(room_id, slot_id)},
            occupied_professor_slots={(professor_id, slot_id)},
            professor_no_overlap=True,
            student_groups_no_overlap=False,
            room_capacity_check=True,
        )

        # Assert
        text = file_path.read_text(encoding="utf-8")
        assert "constraint_professor_no_overlap(true)." in text
        assert "constraint_student_groups_no_overlap(false)." in text
        assert "constraint_room_capacity_check(true)." in text
        assert f"room('{room_id}', 60)." in text
        assert f"time_slot('{slot_id}')." in text
        assert f"preferred_slot('{course_id}', '{slot_id}')." in text
        assert f"reserved_room('{room_id}', '{slot_id}')." in text
        assert f"reserved_prof('{professor_id}', '{slot_id}')." in text

    def test_professor_key_uses_synthetic_value_when_professor_is_none(self):
        # Arrange
        course_id = uuid4()

        # Act
        key = PrologClassScheduler._professor_key(course_id, None)

        # Assert
        assert key == f"none-{course_id}"
