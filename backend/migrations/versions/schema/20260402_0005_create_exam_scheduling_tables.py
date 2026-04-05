"""create exam scheduling tables

Revision ID: 20260402_0005
Revises: 20260329_0004
Create Date: 2026-04-02 12:00:00
"""

from typing import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "20260402_0005"
down_revision: str | None = "20260329_0004"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "schedule_exam_snapshots",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="draft"),
        sa.Column("constraints", sa.JSON(), nullable=False, server_default=sa.text("'{}'::json")),
        sa.Column("selected_room_names", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
        sa.Column("exam_dates", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
        sa.Column("program_values", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_schedule_exam_snapshots_status", "schedule_exam_snapshots", ["status"], unique=False)

    op.create_table(
        "schedule_exam_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("snapshot_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("program_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("program_year_course_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("course_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("semester", sa.String(length=32), nullable=True),
        sa.Column("exam_type", sa.String(length=32), nullable=True),
        sa.Column("exam_date", sa.Date(), nullable=True),
        sa.Column("timeslot_code", sa.String(length=32), nullable=True),
        sa.Column("room_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("manually_adjusted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.CheckConstraint("year BETWEEN 1 AND 4", name="ck_schedule_exam_entries_year_1_4"),
        sa.ForeignKeyConstraint(["snapshot_id"], ["schedule_exam_snapshots.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["program_id"], ["programs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["program_year_course_id"], ["program_year_courses.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["room_id"], ["rooms.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_schedule_exam_entries_snapshot_id", "schedule_exam_entries", ["snapshot_id"], unique=False)
    op.create_index("ix_schedule_exam_entries_program_id", "schedule_exam_entries", ["program_id"], unique=False)
    op.create_index("ix_schedule_exam_entries_program_year_course_id", "schedule_exam_entries", ["program_year_course_id"], unique=False)
    op.create_index("ix_schedule_exam_entries_course_id", "schedule_exam_entries", ["course_id"], unique=False)
    op.create_index("ix_schedule_exam_entries_exam_date", "schedule_exam_entries", ["exam_date"], unique=False)
    op.create_index("ix_schedule_exam_entries_timeslot_code", "schedule_exam_entries", ["timeslot_code"], unique=False)
    op.create_index("ix_schedule_exam_entries_room_id", "schedule_exam_entries", ["room_id"], unique=False)

    op.add_column(
        "schedule_generation_jobs",
        sa.Column("exam_snapshot_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_sched_jobs_exam_snapshot",
        "schedule_generation_jobs",
        "schedule_exam_snapshots",
        ["exam_snapshot_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_schedule_generation_jobs_exam_snapshot_id",
        "schedule_generation_jobs",
        ["exam_snapshot_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_schedule_generation_jobs_exam_snapshot_id", table_name="schedule_generation_jobs")
    op.drop_constraint(
        "fk_sched_jobs_exam_snapshot",
        "schedule_generation_jobs",
        type_="foreignkey",
    )
    op.drop_column("schedule_generation_jobs", "exam_snapshot_id")

    op.drop_index("ix_schedule_exam_entries_room_id", table_name="schedule_exam_entries")
    op.drop_index("ix_schedule_exam_entries_timeslot_code", table_name="schedule_exam_entries")
    op.drop_index("ix_schedule_exam_entries_exam_date", table_name="schedule_exam_entries")
    op.drop_index("ix_schedule_exam_entries_course_id", table_name="schedule_exam_entries")
    op.drop_index("ix_schedule_exam_entries_program_year_course_id", table_name="schedule_exam_entries")
    op.drop_index("ix_schedule_exam_entries_program_id", table_name="schedule_exam_entries")
    op.drop_index("ix_schedule_exam_entries_snapshot_id", table_name="schedule_exam_entries")
    op.drop_table("schedule_exam_entries")

    op.drop_index("ix_schedule_exam_snapshots_status", table_name="schedule_exam_snapshots")
    op.drop_table("schedule_exam_snapshots")
