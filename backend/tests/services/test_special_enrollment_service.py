from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.services.special_enrollment_service import SpecialEnrollmentService
from conftest import FakeSession


class TestSpecialEnrollmentService:
    """Validate special-enrollment resolution and in-memory filtering behavior."""

    def test_resolve_course_ids_raises_bad_request_for_unknown_course_code(self):
        # Arrange
        service = SpecialEnrollmentService(FakeSession())
        service.course_repo = SimpleNamespace(get_by_code=lambda _value: None)

        # Act / Assert
        with pytest.raises(HTTPException) as exc:
            service._resolve_course_ids(["CS101"])
        assert exc.value.status_code == 400
        assert exc.value.detail == "Course not found: CS101"

    def test_list_filters_by_program_and_course_code(self):
        # Arrange
        service = SpecialEnrollmentService(FakeSession())

        row_kept = SimpleNamespace(
            id=uuid4(),
            student=SimpleNamespace(student_id="65010001", program=SimpleNamespace(value="se")),
            courses=[SimpleNamespace(course=SimpleNamespace(code="CS101"))],
        )
        row_other_program = SimpleNamespace(
            id=uuid4(),
            student=SimpleNamespace(student_id="65010002", program=SimpleNamespace(value="it")),
            courses=[SimpleNamespace(course=SimpleNamespace(code="CS101"))],
        )
        row_other_course = SimpleNamespace(
            id=uuid4(),
            student=SimpleNamespace(student_id="65010003", program=SimpleNamespace(value="se")),
            courses=[SimpleNamespace(course=SimpleNamespace(code="CS202"))],
        )
        service.repo = SimpleNamespace(list=lambda: [row_kept, row_other_program, row_other_course])

        # Act
        result = service.list(program="se", course_code="CS101")

        # Assert
        assert len(result) == 1
        assert result[0].student_id == "65010001"
        assert result[0].course_codes == ["CS101"]
