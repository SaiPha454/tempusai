from __future__ import annotations

from collections import defaultdict
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.resource import SpecialEnrollment, SpecialEnrollmentCourse, Student


class ClassDemandService:
    """Compute class demand per (course_id, year) for scheduling validation and solver input."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def build_course_demand_map(
        self,
        *,
        program_id: UUID,
        course_year_pairs: set[tuple[UUID, int]],
    ) -> dict[tuple[UUID, int], int]:
        if not course_year_pairs:
            return {}

        years = {year for _, year in course_year_pairs}
        course_ids = {course_id for course_id, _ in course_year_pairs}

        base_counts = self.db.execute(
            select(Student.year, func.count(Student.id))
            .where(
                Student.program_id == program_id,
                Student.year.in_(years),
            )
            .group_by(Student.year)
        ).all()
        base_students_by_year = {year: count for year, count in base_counts}

        special_rows = self.db.execute(
            select(
                SpecialEnrollmentCourse.course_id,
                Student.id,
                Student.program_id,
                Student.year,
            )
            .join(
                SpecialEnrollment,
                SpecialEnrollment.id == SpecialEnrollmentCourse.enrollment_id,
            )
            .join(Student, Student.id == SpecialEnrollment.student_id)
            .where(SpecialEnrollmentCourse.course_id.in_(course_ids))
        ).all()

        special_students_by_course: dict[UUID, dict[UUID, tuple[UUID, int]]] = defaultdict(dict)
        for course_id, student_id, student_program_id, student_year in special_rows:
            special_students_by_course[course_id][student_id] = (student_program_id, student_year)

        demand_by_pair: dict[tuple[UUID, int], int] = {}
        for course_id, year in course_year_pairs:
            base_demand = base_students_by_year.get(year, 0)
            additional_demand = sum(
                1
                for student_program_id, student_year in special_students_by_course.get(course_id, {}).values()
                if not (student_program_id == program_id and student_year == year)
            )
            demand_by_pair[(course_id, year)] = base_demand + additional_demand

        return demand_by_pair
