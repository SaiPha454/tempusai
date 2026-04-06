from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError

from app.schemas.course import CourseCreate
from app.services.course_service import CourseService
from conftest import FakeSession


class TestCourseService:
    """Validate course service program resolution and duplicate code handling."""

    def test_resolve_program_id_handles_all_programs_and_invalid_program(self):
        # Arrange
        service = CourseService(FakeSession())
        service.program_repo = SimpleNamespace(get_by_value=lambda _value: None)

        # Act / Assert
        assert service._resolve_program_id(None) is None
        assert service._resolve_program_id("all-programs") is None

        with pytest.raises(HTTPException) as exc:
            service._resolve_program_id("software-engineering")
        assert exc.value.status_code == 400
        assert exc.value.detail == "Study program does not exist"

    def test_create_rolls_back_and_raises_conflict_on_duplicate_course_code(self):
        # Arrange
        db = FakeSession()
        service = CourseService(db)
        service.program_repo = SimpleNamespace(get_by_value=lambda _value: SimpleNamespace(id=uuid4()))
        service.repo = SimpleNamespace(create=lambda _course: (_ for _ in ()).throw(IntegrityError("dup", None, None)))

        payload = CourseCreate(code=" CS101 ", name=" Intro ", study_program="software-engineering")

        # Act / Assert
        with pytest.raises(HTTPException) as exc:
            service.create(payload)
        assert exc.value.status_code == 409
        assert exc.value.detail == "Course code already exists"
        assert db.rollback_calls == 1

    def test_update_raises_not_found_when_course_does_not_exist(self):
        # Arrange
        service = CourseService(FakeSession())
        service.repo = SimpleNamespace(get=lambda _course_id: None)

        # Act / Assert
        with pytest.raises(HTTPException) as exc:
            service.update(uuid4(), CourseCreate(code="CS201", name="Algo", study_program=None))
        assert exc.value.status_code == 404
        assert exc.value.detail == "Course not found"
