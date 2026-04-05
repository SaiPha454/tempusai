"""create resources tables

Revision ID: 20260329_0001
Revises:
Create Date: 2026-03-29 00:00:00
"""

from typing import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "20260329_0001"
down_revision: str | None = None
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto";')

    op.create_table(
        "programs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("value", sa.String(length=120), nullable=False),
        sa.Column("label", sa.String(length=255), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_programs_value", "programs", ["value"], unique=True)
    op.create_index("ix_programs_label", "programs", ["label"], unique=True)

    op.create_table(
        "rooms",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("capacity", sa.Integer(), nullable=False),
        sa.CheckConstraint("capacity > 0", name="ck_rooms_capacity_positive"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_rooms_name", "rooms", ["name"], unique=True)

    op.create_table(
        "timeslots",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("day", sa.String(length=16), nullable=False),
        sa.Column("label", sa.String(length=64), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("day", "label", name="uq_timeslots_day_label"),
    )
    op.create_index("ix_timeslots_day", "timeslots", ["day"], unique=False)
    op.create_index("ix_timeslots_label", "timeslots", ["label"], unique=False)

    op.create_table(
        "professors",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("is_any_time", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_professors_name", "professors", ["name"], unique=True)

    op.create_table(
        "courses",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("code", sa.String(length=32), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("program_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(["program_id"], ["programs.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_courses_code", "courses", ["code"], unique=True)

    op.create_table(
        "students",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("student_id", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("program_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.CheckConstraint("year BETWEEN 1 AND 4", name="ck_students_year_1_4"),
        sa.ForeignKeyConstraint(["program_id"], ["programs.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_students_student_id", "students", ["student_id"], unique=True)
    op.create_index("ix_students_name", "students", ["name"], unique=False)
    op.create_index("ix_students_program_id", "students", ["program_id"], unique=False)

    op.create_table(
        "special_enrollments",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_special_enrollments_student_id", "special_enrollments", ["student_id"], unique=False)

    op.create_table(
        "professor_availabilities",
        sa.Column("professor_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("timeslot_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(["professor_id"], ["professors.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["timeslot_id"], ["timeslots.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("professor_id", "timeslot_id"),
    )

    op.create_table(
        "special_enrollment_courses",
        sa.Column("enrollment_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("course_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["enrollment_id"], ["special_enrollments.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("enrollment_id", "course_id"),
    )

    op.create_table(
        "program_year_courses",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("program_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("course_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("professor_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.CheckConstraint("year BETWEEN 1 AND 4", name="ck_program_year_courses_year_1_4"),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["professor_id"], ["professors.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["program_id"], ["programs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_program_year_courses_program_id", "program_year_courses", ["program_id"], unique=False)
    op.create_index("ix_program_year_courses_course_id", "program_year_courses", ["course_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_program_year_courses_course_id", table_name="program_year_courses")
    op.drop_index("ix_program_year_courses_program_id", table_name="program_year_courses")
    op.drop_table("program_year_courses")

    op.drop_table("special_enrollment_courses")
    op.drop_table("professor_availabilities")

    op.drop_index("ix_special_enrollments_student_id", table_name="special_enrollments")
    op.drop_table("special_enrollments")

    op.drop_index("ix_students_program_id", table_name="students")
    op.drop_index("ix_students_name", table_name="students")
    op.drop_index("ix_students_student_id", table_name="students")
    op.drop_table("students")

    op.drop_index("ix_courses_code", table_name="courses")
    op.drop_table("courses")

    op.drop_index("ix_professors_name", table_name="professors")
    op.drop_table("professors")

    op.drop_index("ix_timeslots_label", table_name="timeslots")
    op.drop_index("ix_timeslots_day", table_name="timeslots")
    op.drop_table("timeslots")

    op.drop_index("ix_rooms_name", table_name="rooms")
    op.drop_table("rooms")

    op.drop_index("ix_programs_label", table_name="programs")
    op.drop_index("ix_programs_value", table_name="programs")
    op.drop_table("programs")

    op.execute('DROP EXTENSION IF EXISTS "pgcrypto";')

