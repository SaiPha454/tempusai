from __future__ import annotations

from uuid import uuid4

import pytest

from app.models.resource import (
    Course,
    Professor,
    ProfessorAvailability,
    Program,
    ProgramYearCourse,
    Room,
    ScheduleClassSnapshot,
    Timeslot,
)
from app.schemas.scheduling import ClassScheduleGenerateRequest, SaveClassScheduleDraftRequest
from app.services.scheduling_service import _normalize_day
from app.services.scheduling_service import SchedulingService
from conftest import FakeSession


class TestSchedulingServiceHelpers:
    """Validate scheduling helper normalization behavior."""

    def test_normalize_day_maps_known_weekdays_and_handles_unknown_values(self):
        # Arrange / Act / Assert
        assert _normalize_day("Monday") == 1
        assert _normalize_day("sunday") == 7
        assert _normalize_day("unknown") == 999
        assert _normalize_day(None) == 999


class TestSchedulingServiceOrchestration:
    """Validate core class scheduling orchestration branches and guardrails."""

    def test_create_class_generation_job_reuses_existing_snapshot_without_user_inputs(self, monkeypatch):
        # Arrange
        program = Program(id=uuid4(), value="se", label="Software Engineering")
        existing_snapshot = ScheduleClassSnapshot(
            id=uuid4(),
            job_name="existing",
            program_id=program.id,
            status="draft",
            constraints={},
            selected_room_names=[],
        )
        db = FakeSession(scalar_queue=[program])
        original_add = db.add

        def add_with_id(value):
            if getattr(value, "id", None) is None:
                value.id = uuid4()
            original_add(value)

        db.add = add_with_id
        service = SchedulingService(db)
        monkeypatch.setattr(service, "_get_latest_program_snapshot", lambda *_args, **_kwargs: existing_snapshot)

        payload = ClassScheduleGenerateRequest(
            job_name=" Reuse draft ",
            program_value=" se ",
            selected_room_names=[],
            constraints={},
            preferred_timeslot_by_course_id={},
        )

        # Act
        result = service.create_class_generation_job(payload)

        # Assert
        assert result.snapshot_id == existing_snapshot.id
        assert result.status == "succeeded"
        assert db.commit_calls == 1
        jobs = [item for item in db.added if item.__class__.__name__ == "ScheduleGenerationJob"]
        assert len(jobs) == 1
        assert jobs[0].snapshot_id == existing_snapshot.id
        assert jobs[0].job_type == "class"

    def test_create_class_generation_job_wraps_solver_failure_as_bad_request(self, monkeypatch):
        # Arrange
        program = Program(id=uuid4(), value="se", label="Software Engineering")
        room = Room(id=uuid4(), name="R101", capacity=60)
        timeslot = Timeslot(id=uuid4(), day="Monday", label="09:00 - 12:00")
        course = Course(id=uuid4(), code="CS101", name="Intro Programming", program_id=program.id)
        plan_row = ProgramYearCourse(
            id=uuid4(),
            program_id=program.id,
            year=1,
            course_id=course.id,
            professor_id=None,
        )
        plan_row.course = course
        plan_row.professor = None

        db = FakeSession(
            scalar_queue=[program],
            scalars_queue=[[room], [timeslot], [plan_row]],
        )
        service = SchedulingService(db)
        monkeypatch.setattr(service, "_get_latest_program_snapshot", lambda *_args, **_kwargs: None)
        monkeypatch.setattr(
            service._demand_service,
            "build_course_demand_map",
            lambda **_kwargs: {(course.id, 1): 50},
        )
        monkeypatch.setattr(
            service._occupancy_repository,
            "get_confirmed_class_resource_occupancy",
            lambda **_kwargs: (set(), set()),
        )

        class FailingSolver:
            def solve(self, **_kwargs):
                raise RuntimeError("solver failed")

        monkeypatch.setattr("app.services.scheduling_service.PrologClassScheduler", FailingSolver)

        payload = ClassScheduleGenerateRequest(
            job_name="Test",
            program_value="se",
            selected_room_names=["R101"],
            constraints={},
            preferred_timeslot_by_course_id={},
        )

        # Act / Assert
        with pytest.raises(Exception) as error:
            service.create_class_generation_job(payload)
        assert getattr(error.value, "status_code", None) == 400
        assert "Unable to generate schedule using Prolog CSP solver" in str(getattr(error.value, "detail", ""))

    def test_create_class_generation_job_rejects_when_available_room_slots_are_insufficient(self, monkeypatch):
        # Arrange
        program = Program(id=uuid4(), value="se", label="Software Engineering")
        room = Room(id=uuid4(), name="R101", capacity=120)
        timeslot = Timeslot(id=uuid4(), day="Monday", label="09:00 - 12:00")

        course1 = Course(id=uuid4(), code="CS101", name="Intro Programming", program_id=program.id)
        course2 = Course(id=uuid4(), code="CS102", name="Discrete Math", program_id=program.id)

        row1 = ProgramYearCourse(id=uuid4(), program_id=program.id, year=1, course_id=course1.id, professor_id=None)
        row2 = ProgramYearCourse(id=uuid4(), program_id=program.id, year=1, course_id=course2.id, professor_id=None)
        row1.course = course1
        row2.course = course2
        row1.professor = None
        row2.professor = None

        db = FakeSession(
            scalar_queue=[program],
            scalars_queue=[[room], [timeslot], [row1, row2]],
        )
        service = SchedulingService(db)
        monkeypatch.setattr(service, "_get_latest_program_snapshot", lambda *_args, **_kwargs: None)
        monkeypatch.setattr(
            service._demand_service,
            "build_course_demand_map",
            lambda **_kwargs: {(course1.id, 1): 30, (course2.id, 1): 25},
        )
        monkeypatch.setattr(
            service._occupancy_repository,
            "get_confirmed_class_resource_occupancy",
            lambda **_kwargs: (set(), set()),
        )

        class SolverMustNotRun:
            def solve(self, **_kwargs):
                raise AssertionError("Solver should not run when feasibility pre-check fails")

        monkeypatch.setattr("app.services.scheduling_service.PrologClassScheduler", SolverMustNotRun)

        payload = ClassScheduleGenerateRequest(
            job_name="Class Feasibility",
            program_value="se",
            selected_room_names=["R101"],
            constraints={},
            preferred_timeslot_by_course_id={},
        )

        # Act / Assert
        with pytest.raises(Exception) as error:
            service.create_class_generation_job(payload)

        assert getattr(error.value, "status_code", None) == 400
        assert "Available room-timeslot combinations" in str(getattr(error.value, "detail", ""))
        assert db.commit_calls == 0

    def test_create_class_generation_job_does_not_precheck_course_candidate_feasibility(self, monkeypatch):
        # Arrange
        program = Program(id=uuid4(), value="se", label="Software Engineering")
        room = Room(id=uuid4(), name="R101", capacity=20)
        timeslot = Timeslot(id=uuid4(), day="Monday", label="09:00 - 12:00")
        course = Course(id=uuid4(), code="CS201", name="Algorithms", program_id=program.id)
        row = ProgramYearCourse(id=uuid4(), program_id=program.id, year=2, course_id=course.id, professor_id=None)
        row.course = course
        row.professor = None

        db = FakeSession(
            scalar_queue=[program],
            scalars_queue=[[room], [timeslot], [row]],
        )
        original_add = db.add

        def add_with_id(value):
            if getattr(value, "id", None) is None:
                value.id = uuid4()
            original_add(value)

        db.add = add_with_id
        service = SchedulingService(db)
        monkeypatch.setattr(service, "_get_latest_program_snapshot", lambda *_args, **_kwargs: None)
        monkeypatch.setattr(
            service._demand_service,
            "build_course_demand_map",
            lambda **_kwargs: {(course.id, 2): 120},
        )
        monkeypatch.setattr(
            service._occupancy_repository,
            "get_confirmed_class_resource_occupancy",
            lambda **_kwargs: (set(), set()),
        )

        class CapturingSolver:
            called = False

            def __init__(self, *args, **kwargs):
                pass

            def solve(self, **_kwargs):
                CapturingSolver.called = True
                return {}

        monkeypatch.setattr("app.services.scheduling_service.PrologClassScheduler", CapturingSolver)

        payload = ClassScheduleGenerateRequest(
            job_name="Class Capacity Infeasible",
            program_value="se",
            selected_room_names=["R101"],
            constraints={},
            preferred_timeslot_by_course_id={},
        )

        # Act
        result = service.create_class_generation_job(payload)

        # Assert
        assert result.status == "succeeded"
        assert CapturingSolver.called is True
        assert db.commit_calls == 1

    def test_create_class_generation_job_does_not_precheck_professor_availability_occupancy(self, monkeypatch):
        # Arrange
        program = Program(id=uuid4(), value="se", label="Software Engineering")
        room = Room(id=uuid4(), name="R101", capacity=120)
        slot_a = Timeslot(id=uuid4(), day="Monday", label="09:00 - 12:00")
        slot_b = Timeslot(id=uuid4(), day="Tuesday", label="09:00 - 12:00")

        professor = Professor(id=uuid4(), name="Prof A", is_any_time=False)
        professor.available_timeslots = [ProfessorAvailability(professor_id=professor.id, timeslot_id=slot_a.id)]

        course = Course(id=uuid4(), code="CS301", name="Operating Systems", program_id=program.id)
        row = ProgramYearCourse(
            id=uuid4(),
            program_id=program.id,
            year=3,
            course_id=course.id,
            professor_id=professor.id,
        )
        row.course = course
        row.professor = professor

        db = FakeSession(
            scalar_queue=[program],
            scalars_queue=[[room], [slot_a, slot_b], [row]],
        )
        original_add = db.add

        def add_with_id(value):
            if getattr(value, "id", None) is None:
                value.id = uuid4()
            original_add(value)

        db.add = add_with_id
        service = SchedulingService(db)
        monkeypatch.setattr(service, "_get_latest_program_snapshot", lambda *_args, **_kwargs: None)
        monkeypatch.setattr(
            service._demand_service,
            "build_course_demand_map",
            lambda **_kwargs: {(course.id, 3): 40},
        )
        monkeypatch.setattr(
            service._occupancy_repository,
            "get_confirmed_class_resource_occupancy",
            lambda **_kwargs: (set(), {(professor.id, slot_a.id)}),
        )

        class CapturingSolver:
            called = False

            def __init__(self, *args, **kwargs):
                pass

            def solve(self, **_kwargs):
                CapturingSolver.called = True
                return {}

        monkeypatch.setattr("app.services.scheduling_service.PrologClassScheduler", CapturingSolver)

        payload = ClassScheduleGenerateRequest(
            job_name="Professor Availability Infeasible",
            program_value="se",
            selected_room_names=["R101"],
            constraints={"professorNoOverlap": True},
            preferred_timeslot_by_course_id={},
        )

        # Act
        result = service.create_class_generation_job(payload)

        # Assert
        assert result.status == "succeeded"
        assert CapturingSolver.called is True
        assert db.commit_calls == 1

    def test_create_class_generation_job_passes_professor_allowed_slots_to_solver(self, monkeypatch):
        # Arrange
        program = Program(id=uuid4(), value="se", label="Software Engineering")
        room = Room(id=uuid4(), name="R101", capacity=120)
        slot_a = Timeslot(id=uuid4(), day="Monday", label="09:00 - 12:00")
        slot_b = Timeslot(id=uuid4(), day="Tuesday", label="09:00 - 12:00")

        professor = Professor(id=uuid4(), name="Prof B", is_any_time=False)
        professor.available_timeslots = [ProfessorAvailability(professor_id=professor.id, timeslot_id=slot_a.id)]

        course = Course(id=uuid4(), code="CS302", name="Computer Networks", program_id=program.id)
        row = ProgramYearCourse(
            id=uuid4(),
            program_id=program.id,
            year=3,
            course_id=course.id,
            professor_id=professor.id,
        )
        row.course = course
        row.professor = professor

        db = FakeSession(
            scalar_queue=[program],
            scalars_queue=[[room], [slot_a, slot_b], [row]],
        )
        original_add = db.add

        def add_with_id(value):
            if getattr(value, "id", None) is None:
                value.id = uuid4()
            original_add(value)

        db.add = add_with_id
        service = SchedulingService(db)
        monkeypatch.setattr(service, "_get_latest_program_snapshot", lambda *_args, **_kwargs: None)
        monkeypatch.setattr(
            service._demand_service,
            "build_course_demand_map",
            lambda **_kwargs: {(course.id, 3): 35},
        )
        monkeypatch.setattr(
            service._occupancy_repository,
            "get_confirmed_class_resource_occupancy",
            lambda **_kwargs: (set(), set()),
        )

        class CapturingSolver:
            last_kwargs: dict | None = None

            def __init__(self, *args, **kwargs):
                pass

            def solve(self, **kwargs):
                CapturingSolver.last_kwargs = kwargs
                return {course.id: (room.id, slot_a.id)}

        monkeypatch.setattr("app.services.scheduling_service.PrologClassScheduler", CapturingSolver)

        payload = ClassScheduleGenerateRequest(
            job_name="Professor Availability Enforced",
            program_value="se",
            selected_room_names=["R101"],
            constraints={"professorNoOverlap": True},
            preferred_timeslot_by_course_id={},
        )

        # Act
        result = service.create_class_generation_job(payload)

        # Assert
        assert result.status == "succeeded"
        assert CapturingSolver.last_kwargs is not None
        restrictions = CapturingSolver.last_kwargs.get("professor_allowed_slot_ids_by_professor", {})
        assert restrictions.get(professor.id) == {slot_a.id}

    def test_create_class_generation_job_excludes_same_program_confirmed_occupancy(self, monkeypatch):
        # Arrange
        program = Program(id=uuid4(), value="se", label="Software Engineering")
        room = Room(id=uuid4(), name="R101", capacity=120)
        slot_a = Timeslot(id=uuid4(), day="Monday", label="09:00 - 12:00")
        slot_b = Timeslot(id=uuid4(), day="Tuesday", label="09:00 - 12:00")

        course = Course(id=uuid4(), code="CS401", name="Capstone", program_id=program.id)
        row = ProgramYearCourse(
            id=uuid4(),
            program_id=program.id,
            year=4,
            course_id=course.id,
            professor_id=None,
        )
        row.course = course
        row.professor = None

        db = FakeSession(
            scalar_queue=[program],
            scalars_queue=[[room], [slot_a, slot_b], [row]],
        )
        original_add = db.add

        def add_with_id(value):
            if getattr(value, "id", None) is None:
                value.id = uuid4()
            original_add(value)

        db.add = add_with_id

        service = SchedulingService(db)
        monkeypatch.setattr(service, "_get_latest_program_snapshot", lambda *_args, **_kwargs: None)
        monkeypatch.setattr(
            service._demand_service,
            "build_course_demand_map",
            lambda **_kwargs: {(course.id, 4): 30},
        )

        # Simulate one same-program occupied slot and one truly external occupied slot.
        same_program_room_slot = (room.id, slot_a.id)
        external_room_slot = (room.id, slot_b.id)
        monkeypatch.setattr(
            service._occupancy_repository,
            "get_confirmed_class_resource_occupancy",
            lambda **_kwargs: ({same_program_room_slot, external_room_slot}, set()),
        )
        monkeypatch.setattr(
            service,
            "_get_confirmed_occupancy_for_program",
            lambda *_args, **_kwargs: ({same_program_room_slot}, set()),
        )

        class CapturingSolver:
            last_kwargs: dict | None = None

            def __init__(self, *args, **kwargs):
                pass

            def solve(self, **kwargs):
                CapturingSolver.last_kwargs = kwargs
                return {course.id: (room.id, slot_a.id)}

        monkeypatch.setattr("app.services.scheduling_service.PrologClassScheduler", CapturingSolver)

        payload = ClassScheduleGenerateRequest(
            job_name="Regenerate without self-conflict",
            program_value="se",
            selected_room_names=["R101"],
            constraints={},
            preferred_timeslot_by_course_id={},
        )

        # Act
        result = service.create_class_generation_job(payload)

        # Assert
        assert result.status == "succeeded"
        assert CapturingSolver.last_kwargs is not None
        remaining_occupied_room_slots = CapturingSolver.last_kwargs.get("occupied_room_slots")
        assert remaining_occupied_room_slots == {external_room_slot}

    def test_commit_class_draft_raises_first_validation_error(self, monkeypatch):
        # Arrange
        snapshot = ScheduleClassSnapshot(
            id=uuid4(),
            job_name="draft",
            program_id=uuid4(),
            status="draft",
            constraints={},
            selected_room_names=[],
        )
        snapshot.entries = []

        db = FakeSession(scalar_queue=[None])
        service = SchedulingService(db)
        monkeypatch.setattr(service, "_get_snapshot", lambda *_args, **_kwargs: snapshot)
        monkeypatch.setattr(service._patch_service, "apply_entry_patches", lambda **_kwargs: None)
        monkeypatch.setattr(
            service._occupancy_repository,
            "get_confirmed_class_resource_occupancy",
            lambda **_kwargs: (set(), set()),
        )
        monkeypatch.setattr(
            service._commit_validator,
            "validate",
            lambda **_kwargs: ["Room has another class at this timeslot."],
        )

        # Act / Assert
        with pytest.raises(Exception) as error:
            service.commit_class_draft(snapshot.id, SaveClassScheduleDraftRequest(entries=[]))
        assert getattr(error.value, "status_code", None) == 400
        assert "Room has another class" in str(getattr(error.value, "detail", ""))
        assert snapshot.status == "draft"
        assert db.commit_calls == 0
