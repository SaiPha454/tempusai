from __future__ import annotations

import subprocess
from uuid import uuid4

import pytest

from app.services.prolog_csp.exam_scheduler import PrologExamRow, PrologExamScheduler


class TestPrologExamScheduler:
    """Validate Prolog exam scheduler adapter behavior around fact generation and subprocess boundaries."""

    def test_solve_raises_runtime_error_when_swipl_is_missing(self):
        # Arrange
        scheduler = PrologExamScheduler()
        scheduler._swipl = None

        # Act / Assert
        with pytest.raises(RuntimeError, match="SWI-Prolog executable 'swipl' was not found"):
            scheduler.solve(
                exam_rows=[
                    PrologExamRow(
                        exam_idx=0,
                        program_id=uuid4(),
                        year=1,
                        required_capacity=10,
                        allowed_slot_keys=["2026-05-20|morning-exam"],
                        preferred_slot_keys=[],
                    )
                ],
                room_capacity_by_id={},
                reserved_room_slot_keys=set(),
                student_conflict_pairs=set(),
                no_same_program_year_day_timeslot=True,
                no_student_overlap=True,
                room_capacity_check=True,
                prefer_day_timeslot=True,
                allow_flexible_fallback=True,
                minimize_same_program_year_same_day=True,
            )

    def test_solve_returns_assignments_when_subprocess_succeeds(self, monkeypatch):
        # Arrange
        scheduler = PrologExamScheduler(timeout_seconds=10)
        scheduler._swipl = "swipl"

        program_id = uuid4()
        room_id = uuid4()
        slot_key = "2026-05-20|morning-exam"

        output = f"0\t'{program_id}'\t1\t'{room_id}'\t'{slot_key}'\t0\n"

        def fake_run(*_args, **_kwargs):
            return subprocess.CompletedProcess(args=[], returncode=0, stdout=output, stderr="")

        monkeypatch.setattr(subprocess, "run", fake_run)

        # Act
        assignments = scheduler.solve(
            exam_rows=[
                PrologExamRow(
                    exam_idx=0,
                    program_id=program_id,
                    year=1,
                    required_capacity=30,
                    allowed_slot_keys=[slot_key],
                    preferred_slot_keys=[slot_key],
                )
            ],
            room_capacity_by_id={room_id: 40},
            reserved_room_slot_keys=set(),
            student_conflict_pairs=set(),
            no_same_program_year_day_timeslot=True,
            no_student_overlap=True,
            room_capacity_check=True,
            prefer_day_timeslot=True,
            allow_flexible_fallback=True,
            minimize_same_program_year_same_day=True,
        )

        # Assert
        assert assignments == {0: (room_id, slot_key)}

    def test_solve_raises_runtime_error_on_non_zero_exit(self, monkeypatch):
        # Arrange
        scheduler = PrologExamScheduler()
        scheduler._swipl = "swipl"

        def fake_run(*_args, **_kwargs):
            return subprocess.CompletedProcess(args=[], returncode=1, stdout="", stderr="exam solver failed")

        monkeypatch.setattr(subprocess, "run", fake_run)

        # Act / Assert
        with pytest.raises(RuntimeError, match="exam solver failed"):
            scheduler.solve(
                exam_rows=[
                    PrologExamRow(
                        exam_idx=0,
                        program_id=uuid4(),
                        year=1,
                        required_capacity=10,
                        allowed_slot_keys=["2026-05-20|morning-exam"],
                        preferred_slot_keys=[],
                    )
                ],
                room_capacity_by_id={},
                reserved_room_slot_keys=set(),
                student_conflict_pairs=set(),
                no_same_program_year_day_timeslot=True,
                no_student_overlap=True,
                room_capacity_check=True,
                prefer_day_timeslot=True,
                allow_flexible_fallback=True,
                minimize_same_program_year_same_day=True,
            )

    def test_solve_returns_partial_assignments_on_timeout(self, monkeypatch):
        # Arrange
        scheduler = PrologExamScheduler()
        scheduler._swipl = "swipl"

        program_id = uuid4()
        room_id = uuid4()
        slot_key = "2026-05-20|afternoon-exam"
        partial = f"0\t'{program_id}'\t1\t'{room_id}'\t'{slot_key}'\t1\n"

        def fake_run(*_args, **_kwargs):
            raise subprocess.TimeoutExpired(cmd="swipl", timeout=5, output=partial)

        monkeypatch.setattr(subprocess, "run", fake_run)

        # Act
        assignments = scheduler.solve(
            exam_rows=[
                PrologExamRow(
                    exam_idx=0,
                    program_id=program_id,
                    year=1,
                    required_capacity=10,
                    allowed_slot_keys=[slot_key],
                    preferred_slot_keys=[],
                )
            ],
            room_capacity_by_id={room_id: 80},
            reserved_room_slot_keys=set(),
            student_conflict_pairs=set(),
            no_same_program_year_day_timeslot=True,
            no_student_overlap=True,
            room_capacity_check=True,
            prefer_day_timeslot=True,
            allow_flexible_fallback=True,
            minimize_same_program_year_same_day=True,
        )

        # Assert
        assert assignments == {0: (room_id, slot_key)}

    def test_parse_output_skips_malformed_lines(self):
        # Arrange
        scheduler = PrologExamScheduler()
        program_id = uuid4()
        room_id = uuid4()
        line = f"0\t'{program_id}'\t1\t'{room_id}'\t'2026-05-20|morning-exam'\t0"
        output = "\n".join(["bad", line, "1\ttoo\tshort"])

        # Act
        parsed = scheduler._parse_output(output)

        # Assert
        assert parsed == {0: (room_id, "2026-05-20|morning-exam")}

    def test_write_facts_writes_constraints_slots_and_conflicts(self, tmp_path):
        # Arrange
        scheduler = PrologExamScheduler()
        facts_path = tmp_path / "facts.pl"

        program_id = uuid4()
        room_id = uuid4()
        slot_key = "2026-05-21|morning-exam"

        # Act
        scheduler._write_facts(
            file_path=facts_path,
            exam_rows=[
                PrologExamRow(
                    exam_idx=0,
                    program_id=program_id,
                    year=2,
                    required_capacity=55,
                    allowed_slot_keys=[slot_key],
                    preferred_slot_keys=[slot_key],
                )
            ],
            room_capacity_by_id={room_id: 60},
            reserved_room_slot_keys={(room_id, slot_key)},
            student_conflict_pairs={(0, 1)},
            no_same_program_year_day_timeslot=True,
            no_student_overlap=False,
            room_capacity_check=True,
            prefer_day_timeslot=True,
            allow_flexible_fallback=False,
            minimize_same_program_year_same_day=True,
        )

        # Assert
        text = facts_path.read_text(encoding="utf-8")
        assert "constraint_no_same_program_year_day_timeslot(true)." in text
        assert "constraint_no_student_overlap(false)." in text
        assert "constraint_allow_flexible_fallback(false)." in text
        assert f"room('{room_id}', 60)." in text
        assert "slot_day('2026-05-21|morning-exam', '2026-05-21')." in text
        assert "slot_code('2026-05-21|morning-exam', 'morning-exam')." in text
        assert "preferred_exam_slot('0', '2026-05-21|morning-exam')." in text
        assert f"reserved_room_slot('{room_id}', '2026-05-21|morning-exam')." in text
        assert "student_conflict('0', '1')." in text
