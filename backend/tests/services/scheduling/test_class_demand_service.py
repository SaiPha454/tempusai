from __future__ import annotations

from uuid import uuid4

from app.services.scheduling.class_demand_service import ClassDemandService
from conftest import FakeSession


class TestClassDemandService:
    """Validate class demand aggregation with base enrollment and special-enrollment adjustments."""

    def test_build_course_demand_map_combines_base_and_cross_program_special_enrollments(self):
        # Arrange
        program_id = uuid4()
        other_program_id = uuid4()
        course_a = uuid4()
        course_b = uuid4()
        student_same_program = uuid4()
        student_other_program = uuid4()

        db = FakeSession(
            execute_rows_queue=[
                [(1, 40), (2, 35)],
                [
                    (course_a, student_same_program, program_id, 1),
                    (course_a, student_other_program, other_program_id, 3),
                ],
            ]
        )
        service = ClassDemandService(db)

        # Act
        result = service.build_course_demand_map(
            program_id=program_id,
            course_year_pairs={(course_a, 1), (course_b, 2)},
        )

        # Assert
        assert result[(course_a, 1)] == 41
        assert result[(course_b, 2)] == 35

    def test_build_course_demand_map_returns_empty_for_empty_course_year_pairs(self):
        # Arrange
        service = ClassDemandService(FakeSession())

        # Act
        result = service.build_course_demand_map(program_id=uuid4(), course_year_pairs=set())

        # Assert
        assert result == {}
