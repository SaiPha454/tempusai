from __future__ import annotations

from datetime import date
from uuid import uuid4

import pytest

from app.models.resource import Program, Room, ScheduleExamEntry, ScheduleExamSnapshot
from app.services.exam_scheduling_service import EXAM_SLOT_LABELS, ExamItem, ExamSchedulingService
from app.schemas.scheduling import (
    ExamCoursePreferenceRequest,
    ExamProgramPlanRequest,
    ExamProgramYearRequest,
    ExamScheduleGenerateRequest,
    SaveExamScheduleDraftRequest,
)
from conftest import FakeSession


class TestExamSchedulingServiceHelpers:
    """Validate deterministic helper logic used by exam scheduling orchestration."""

    def test_parse_exam_dates_filters_invalid_deduplicates_and_sorts(self):
        # Arrange / Act
        parsed = ExamSchedulingService._parse_exam_dates(
            ["2026-05-20", "invalid", "2026-05-18", "2026-05-20"]
        )

        # Assert
        assert parsed == [date(2026, 5, 18), date(2026, 5, 20)]

    def test_build_slot_candidates_respects_preference_and_fallback_flags(self):
        # Arrange
        exam_dates = [date(2026, 5, 18), date(2026, 5, 19)]
        all_slot_codes = list(EXAM_SLOT_LABELS.keys())
        preferred_dates = [date(2026, 5, 19)]
        preferred_slots = ["afternoon-exam"]

        # Act
        strict = ExamSchedulingService._build_slot_candidates(
            exam_dates=exam_dates,
            all_slot_codes=all_slot_codes,
            preferred_dates=preferred_dates,
            preferred_slots=preferred_slots,
            prefer_day_timeslot=True,
            allow_flexible_fallback=False,
        )
        flexible = ExamSchedulingService._build_slot_candidates(
            exam_dates=exam_dates,
            all_slot_codes=all_slot_codes,
            preferred_dates=preferred_dates,
            preferred_slots=preferred_slots,
            prefer_day_timeslot=True,
            allow_flexible_fallback=True,
        )
        all_slots = ExamSchedulingService._build_slot_candidates(
            exam_dates=exam_dates,
            all_slot_codes=all_slot_codes,
            preferred_dates=preferred_dates,
            preferred_slots=preferred_slots,
            prefer_day_timeslot=False,
            allow_flexible_fallback=False,
        )

        # Assert
        assert strict == [(date(2026, 5, 19), "afternoon-exam")]
        assert flexible[0] == (date(2026, 5, 19), "afternoon-exam")
        assert len(flexible) == len(exam_dates) * len(all_slot_codes)
        assert len(all_slots) == len(exam_dates) * len(all_slot_codes)

    def test_build_student_overlap_edges_combines_home_cohort_and_special_enrollment_edges(self):
        # Arrange
        program_a = "00000000-0000-0000-0000-0000000000a1"
        program_b = "00000000-0000-0000-0000-0000000000b1"
        course_x = "00000000-0000-0000-0000-0000000000c1"
        course_y = "00000000-0000-0000-0000-0000000000c2"

        item0 = ExamItem(
            idx=0,
            program_id=program_a,
            program_value="se",
            program_label="SE",
            program_year_course_id="00000000-0000-0000-0000-0000000000d1",
            course_id=course_x,
            course_code="CS101",
            course_name="Intro",
            year=2,
            semester="1",
            exam_type="final",
            demand=10,
            slot_candidates=[],
            preferred_slot_candidates=[],
        )
        item1 = ExamItem(
            idx=1,
            program_id=program_a,
            program_value="se",
            program_label="SE",
            program_year_course_id="00000000-0000-0000-0000-0000000000d2",
            course_id=course_y,
            course_code="CS201",
            course_name="Algo",
            year=2,
            semester="1",
            exam_type="final",
            demand=10,
            slot_candidates=[],
            preferred_slot_candidates=[],
        )
        item2 = ExamItem(
            idx=2,
            program_id=program_b,
            program_value="it",
            program_label="IT",
            program_year_course_id="00000000-0000-0000-0000-0000000000d3",
            course_id=course_y,
            course_code="CS201",
            course_name="Algo",
            year=3,
            semester="1",
            exam_type="final",
            demand=10,
            slot_candidates=[],
            preferred_slot_candidates=[],
        )

        db = FakeSession(
            execute_rows_queue=[
                [
                    (
                        "00000000-0000-0000-0000-0000000000e1",
                        program_a,
                        2,
                        course_y,
                    )
                ]
            ]
        )
        service = ExamSchedulingService(db)

        # Act
        edges = service._build_student_overlap_edges([item0, item1, item2])

        # Assert
        assert 1 in edges[0]
        assert 0 in edges[1]
        assert 2 in edges[0]
        assert 0 in edges[2]


class TestExamSchedulingServiceOrchestration:
    """Validate exam scheduling orchestration safeguards and lifecycle branches."""

    def test_create_exam_generation_job_rejects_mixed_confirmed_and_non_confirmed_programs(self, monkeypatch):
        # Arrange
        db = FakeSession()
        service = ExamSchedulingService(db)
        monkeypatch.setattr(service, "_list_confirmed_programs", lambda _values: [("se", "Software Engineering")])

        payload = ExamScheduleGenerateRequest(
            job_name="Exam Job",
            exam_dates=["2026-05-20"],
            selected_room_names=["R101"],
            program_plans=[
                ExamProgramPlanRequest(program_value="se", semester="2", exam_type="final", years=[]),
                ExamProgramPlanRequest(program_value="it", semester="2", exam_type="final", years=[]),
            ],
        )

        # Act / Assert
        with pytest.raises(Exception) as error:
            service.create_exam_generation_job(payload)
        assert getattr(error.value, "status_code", None) == 400
        assert "Cannot mix programs with confirmed schedules" in str(getattr(error.value, "detail", ""))

    def test_create_exam_generation_job_records_solver_fallback_and_partial_note(self, monkeypatch):
        # Arrange
        program_id = uuid4()
        room = Room(id=uuid4(), name="R101", capacity=120)

        db = FakeSession(scalars_queue=[[room]])
        original_add = db.add

        def add_with_id(value):
            if getattr(value, "id", None) is None:
                value.id = uuid4()
            original_add(value)

        db.add = add_with_id
        service = ExamSchedulingService(db)

        item = ExamItem(
            idx=0,
            program_id=program_id,
            program_value="se",
            program_label="Software Engineering",
            program_year_course_id=uuid4(),
            course_id=uuid4(),
            course_code="CS300",
            course_name="Compiler",
            year=3,
            semester="2",
            exam_type="final",
            demand=80,
            slot_candidates=[(date(2026, 5, 20), "morning-exam")],
            preferred_slot_candidates=[(date(2026, 5, 20), "morning-exam")],
        )

        monkeypatch.setattr(service, "_build_exam_items", lambda **_kwargs: [item])
        monkeypatch.setattr(
            service._occupancy_repository,
            "get_confirmed_exam_room_slots",
            lambda **_kwargs: set(),
        )

        class FailingSolver:
            def __init__(self, timeout_seconds=100):
                self.timeout_seconds = timeout_seconds

            def solve(self, **_kwargs):
                raise RuntimeError("solver crashed")

        monkeypatch.setattr("app.services.exam_scheduling_service.PrologExamScheduler", FailingSolver)

        payload = ExamScheduleGenerateRequest(
            job_name="Exam Draft",
            exam_dates=["2026-05-20"],
            selected_room_names=["R101"],
            program_plans=[
                ExamProgramPlanRequest(
                    program_value="se",
                    semester="2",
                    exam_type="final",
                    years=[
                        ExamProgramYearRequest(
                            year=3,
                            courses=[
                                ExamCoursePreferenceRequest(
                                    program_year_course_id=item.program_year_course_id,
                                    course_code=item.course_code,
                                    course_name=item.course_name,
                                )
                            ],
                        )
                    ],
                )
            ],
        )

        # Act
        result = service.create_exam_generation_job(payload)

        # Assert
        assert result.status == "succeeded"
        assert db.commit_calls == 1

        jobs = [added for added in db.added if added.__class__.__name__ == "ScheduleGenerationJob"]
        entries = [added for added in db.added if added.__class__.__name__ == "ScheduleExamEntry"]
        assert len(jobs) == 1
        assert len(entries) == 1
        assert jobs[0].error_message is not None
        assert "Prolog solver fallback: solver crashed" in jobs[0].error_message
        assert "Partial assignment 0/1" in jobs[0].error_message
        assert entries[0].exam_date is None
        assert entries[0].timeslot_code is None
        assert entries[0].room_id is None

    def test_create_exam_generation_job_rejects_when_room_date_slots_are_insufficient(self, monkeypatch):
        # Arrange
        program_id = uuid4()
        room = Room(id=uuid4(), name="R101", capacity=120)

        item1 = ExamItem(
            idx=0,
            program_id=program_id,
            program_value="se",
            program_label="Software Engineering",
            program_year_course_id=uuid4(),
            course_id=uuid4(),
            course_code="CS301",
            course_name="OS",
            year=3,
            semester="2",
            exam_type="final",
            demand=40,
            slot_candidates=[(date(2026, 5, 20), "morning-exam")],
            preferred_slot_candidates=[],
        )
        item2 = ExamItem(
            idx=1,
            program_id=program_id,
            program_value="se",
            program_label="Software Engineering",
            program_year_course_id=uuid4(),
            course_id=uuid4(),
            course_code="CS302",
            course_name="Networks",
            year=3,
            semester="2",
            exam_type="final",
            demand=35,
            slot_candidates=[(date(2026, 5, 20), "morning-exam")],
            preferred_slot_candidates=[],
        )

        db = FakeSession(scalars_queue=[[room]])
        service = ExamSchedulingService(db)
        monkeypatch.setattr(service, "_list_confirmed_programs", lambda _values: [])
        monkeypatch.setattr(service, "_build_exam_items", lambda **_kwargs: [item1, item2])
        monkeypatch.setattr(
            service._occupancy_repository,
            "get_confirmed_exam_room_slots",
            lambda **_kwargs: set(),
        )

        class SolverMustNotRun:
            def __init__(self, timeout_seconds=100):
                self.timeout_seconds = timeout_seconds

            def solve(self, **_kwargs):
                raise AssertionError("Solver should not run when feasibility pre-check fails")

        monkeypatch.setattr("app.services.exam_scheduling_service.PrologExamScheduler", SolverMustNotRun)

        payload = ExamScheduleGenerateRequest(
            job_name="Exam Feasibility",
            exam_dates=["2026-05-20"],
            selected_room_names=["R101"],
            program_plans=[
                ExamProgramPlanRequest(program_value="se", semester="2", exam_type="final", years=[])
            ],
        )

        # Act / Assert
        with pytest.raises(Exception) as error:
            service.create_exam_generation_job(payload)

        assert getattr(error.value, "status_code", None) == 400
        assert "Available room-date-slot combinations" in str(getattr(error.value, "detail", ""))
        assert db.commit_calls == 0

    def test_create_exam_generation_job_rejects_when_program_year_needs_more_distinct_slots(self, monkeypatch):
        # Arrange
        program_id = uuid4()
        room1 = Room(id=uuid4(), name="R101", capacity=120)
        room2 = Room(id=uuid4(), name="R102", capacity=120)

        # Two exams in same program/year can both fit by room capacity, but only one distinct day-slot exists.
        item1 = ExamItem(
            idx=0,
            program_id=program_id,
            program_value="se",
            program_label="Software Engineering",
            program_year_course_id=uuid4(),
            course_id=uuid4(),
            course_code="CS401",
            course_name="AI",
            year=4,
            semester="2",
            exam_type="final",
            demand=20,
            slot_candidates=[(date(2026, 5, 21), "afternoon-exam")],
            preferred_slot_candidates=[],
        )
        item2 = ExamItem(
            idx=1,
            program_id=program_id,
            program_value="se",
            program_label="Software Engineering",
            program_year_course_id=uuid4(),
            course_id=uuid4(),
            course_code="CS402",
            course_name="ML",
            year=4,
            semester="2",
            exam_type="final",
            demand=20,
            slot_candidates=[(date(2026, 5, 21), "afternoon-exam")],
            preferred_slot_candidates=[],
        )

        db = FakeSession(scalars_queue=[[room1, room2]])
        service = ExamSchedulingService(db)
        monkeypatch.setattr(service, "_list_confirmed_programs", lambda _values: [])
        monkeypatch.setattr(service, "_build_exam_items", lambda **_kwargs: [item1, item2])
        monkeypatch.setattr(
            service._occupancy_repository,
            "get_confirmed_exam_room_slots",
            lambda **_kwargs: set(),
        )

        class SolverMustNotRun:
            def __init__(self, timeout_seconds=100):
                self.timeout_seconds = timeout_seconds

            def solve(self, **_kwargs):
                raise AssertionError("Solver should not run when feasibility pre-check fails")

        monkeypatch.setattr("app.services.exam_scheduling_service.PrologExamScheduler", SolverMustNotRun)

        payload = ExamScheduleGenerateRequest(
            job_name="Exam Program-Year Feasibility",
            exam_dates=["2026-05-21"],
            selected_room_names=["R101", "R102"],
            program_plans=[
                ExamProgramPlanRequest(program_value="se", semester="2", exam_type="final", years=[])
            ],
        )

        # Act / Assert
        with pytest.raises(Exception) as error:
            service.create_exam_generation_job(payload)

        assert getattr(error.value, "status_code", None) == 400
        assert "same-year overlap constraints" in str(getattr(error.value, "detail", ""))
        assert "Program se year 4" in str(getattr(error.value, "detail", ""))
        assert db.commit_calls == 0

    def test_commit_exam_draft_rejects_unassigned_entries(self, monkeypatch):
        # Arrange
        snapshot = ScheduleExamSnapshot(
            id=uuid4(),
            job_name="draft",
            status="draft",
            constraints={},
            selected_room_names=["R101"],
            exam_dates=["2026-05-20"],
            program_values=["se"],
        )
        entry = ScheduleExamEntry(
            id=uuid4(),
            snapshot_id=snapshot.id,
            program_id=uuid4(),
            program_year_course_id=uuid4(),
            course_id=uuid4(),
            year=3,
            semester="2",
            exam_type="final",
            exam_date=None,
            timeslot_code=None,
            room_id=None,
            manually_adjusted=False,
        )
        snapshot.entries = [entry]

        db = FakeSession()
        service = ExamSchedulingService(db)
        monkeypatch.setattr(service, "_get_exam_snapshot", lambda *_args, **_kwargs: snapshot)
        monkeypatch.setattr(service._patch_service, "apply_entry_patches", lambda **_kwargs: None)

        # Act / Assert
        with pytest.raises(Exception) as error:
            service.commit_exam_draft(snapshot.id, SaveExamScheduleDraftRequest(entries=[]))
        assert getattr(error.value, "status_code", None) == 400
        assert "some exams are unassigned" in str(getattr(error.value, "detail", ""))

    def test_delete_exam_schedule_program_deletes_snapshot_when_program_is_last_remaining(self, monkeypatch):
        # Arrange
        target_program = Program(id=uuid4(), value="se", label="Software Engineering")
        snapshot = ScheduleExamSnapshot(
            id=uuid4(),
            job_name="confirmed exam",
            status="confirmed",
            constraints={},
            selected_room_names=["R101"],
            exam_dates=["2026-05-20"],
            program_values=["se"],
        )
        snapshot.entries = [
            ScheduleExamEntry(
                id=uuid4(),
                snapshot_id=snapshot.id,
                program_id=target_program.id,
                program_year_course_id=uuid4(),
                course_id=uuid4(),
                year=2,
                semester="2",
                exam_type="final",
                exam_date=date(2026, 5, 20),
                timeslot_code="morning-exam",
                room_id=uuid4(),
                manually_adjusted=False,
            )
        ]

        db = FakeSession(scalar_queue=[target_program])
        service = ExamSchedulingService(db)
        monkeypatch.setattr(service, "_get_exam_snapshot", lambda *_args, **_kwargs: snapshot)

        # Act
        service.delete_exam_schedule_program(snapshot.id, "se")

        # Assert
        assert any(item is snapshot for item in db.deleted)
        assert db.commit_calls == 1
