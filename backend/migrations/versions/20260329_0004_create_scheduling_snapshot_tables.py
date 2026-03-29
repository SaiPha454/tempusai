"""create scheduling snapshot tables

Revision ID: 20260329_0004
Revises: 20260329_0003
Create Date: 2026-03-29 09:00:00
"""

from typing import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "20260329_0004"
down_revision: str | None = "20260329_0003"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "schedule_class_snapshots",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("program_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="draft"),
        sa.Column("constraints", sa.JSON(), nullable=False, server_default=sa.text("'{}'::json")),
        sa.Column("selected_room_names", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.ForeignKeyConstraint(["program_id"], ["programs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_schedule_class_snapshots_program_id",
        "schedule_class_snapshots",
        ["program_id"],
        unique=False,
    )
    op.create_index(
        "ix_schedule_class_snapshots_status",
        "schedule_class_snapshots",
        ["status"],
        unique=False,
    )

    op.create_table(
        "schedule_class_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("snapshot_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("course_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("professor_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("timeslot_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("room_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("manually_adjusted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.CheckConstraint("year BETWEEN 1 AND 4", name="ck_schedule_class_entries_year_1_4"),
        sa.ForeignKeyConstraint(["snapshot_id"], ["schedule_class_snapshots.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["professor_id"], ["professors.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["timeslot_id"], ["timeslots.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["room_id"], ["rooms.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_schedule_class_entries_snapshot_id", "schedule_class_entries", ["snapshot_id"], unique=False)
    op.create_index("ix_schedule_class_entries_course_id", "schedule_class_entries", ["course_id"], unique=False)
    op.create_index("ix_schedule_class_entries_timeslot_id", "schedule_class_entries", ["timeslot_id"], unique=False)
    op.create_index("ix_schedule_class_entries_room_id", "schedule_class_entries", ["room_id"], unique=False)

    op.create_table(
        "schedule_generation_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("snapshot_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("job_type", sa.String(length=32), nullable=False, server_default="class"),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="queued"),
        sa.Column("error_message", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.ForeignKeyConstraint(["snapshot_id"], ["schedule_class_snapshots.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_schedule_generation_jobs_snapshot_id", "schedule_generation_jobs", ["snapshot_id"], unique=False)
    op.create_index("ix_schedule_generation_jobs_job_type", "schedule_generation_jobs", ["job_type"], unique=False)
    op.create_index("ix_schedule_generation_jobs_status", "schedule_generation_jobs", ["status"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_schedule_generation_jobs_status", table_name="schedule_generation_jobs")
    op.drop_index("ix_schedule_generation_jobs_job_type", table_name="schedule_generation_jobs")
    op.drop_index("ix_schedule_generation_jobs_snapshot_id", table_name="schedule_generation_jobs")
    op.drop_table("schedule_generation_jobs")

    op.drop_index("ix_schedule_class_entries_room_id", table_name="schedule_class_entries")
    op.drop_index("ix_schedule_class_entries_timeslot_id", table_name="schedule_class_entries")
    op.drop_index("ix_schedule_class_entries_course_id", table_name="schedule_class_entries")
    op.drop_index("ix_schedule_class_entries_snapshot_id", table_name="schedule_class_entries")
    op.drop_table("schedule_class_entries")

    op.drop_index("ix_schedule_class_snapshots_status", table_name="schedule_class_snapshots")
    op.drop_index("ix_schedule_class_snapshots_program_id", table_name="schedule_class_snapshots")
    op.drop_table("schedule_class_snapshots")
