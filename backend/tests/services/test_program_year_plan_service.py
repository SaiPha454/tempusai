from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.schemas.program_year_plan import ProgramYearCourseCreate
from app.services.program_year_plan_service import ProgramYearPlanService
from conftest import FakeSession


class TestProgramYearPlanService:
    """Validate program-year-plan ID resolution rules and not-found behavior."""

    def test_resolve_ids_raises_bad_request_when_program_course_or_professor_is_missing(self):
        # Arrange
        service = ProgramYearPlanService(FakeSession())
        service.program_repo = SimpleNamespace(get_by_value=lambda _value: None)
        service.course_repo = SimpleNamespace(get_by_code=lambda _value: None)
        service.professor_repo = SimpleNamespace(get_by_name=lambda _value: None)

        # Act / Assert - missing program
        with pytest.raises(HTTPException) as exc_program:
            service._resolve_ids("se", "CS101", None)
        assert exc_program.value.status_code == 400
        assert exc_program.value.detail == "Program does not exist"

        # Arrange program exists but course missing
        service.program_repo = SimpleNamespace(get_by_value=lambda _value: SimpleNamespace(id=uuid4()))
        with pytest.raises(HTTPException) as exc_course:
            service._resolve_ids("se", "CS101", None)
        assert exc_course.value.status_code == 400
        assert exc_course.value.detail == "Course does not exist"

        # Arrange course exists but professor missing
        service.course_repo = SimpleNamespace(get_by_code=lambda _value: SimpleNamespace(id=uuid4()))
        with pytest.raises(HTTPException) as exc_prof:
            service._resolve_ids("se", "CS101", "Prof X")
        assert exc_prof.value.status_code == 400
        assert exc_prof.value.detail == "Professor does not exist"

    def test_update_raises_not_found_when_row_does_not_exist(self):
        # Arrange
        service = ProgramYearPlanService(FakeSession())
        service.repo = SimpleNamespace(get=lambda _row_id: None)

        payload = ProgramYearCourseCreate(
            program_value="se",
            year=2,
            course_code="CS201",
            professor_name=None,
        )

        # Act / Assert
        with pytest.raises(HTTPException) as exc:
            service.update(uuid4(), payload)
        assert exc.value.status_code == 404
        assert exc.value.detail == "Program year plan row not found"
