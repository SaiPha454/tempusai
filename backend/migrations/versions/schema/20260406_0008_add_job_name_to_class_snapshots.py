"""add job name to class snapshots

Revision ID: 20260406_0008
Revises: 20260406_0007
Create Date: 2026-04-06 11:30:00
"""

from typing import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260406_0008"
down_revision: str | None = "20260406_0007"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "schedule_class_snapshots",
        sa.Column("job_name", sa.String(length=120), nullable=True),
    )

    op.execute("UPDATE schedule_class_snapshots SET job_name = 'N/A' WHERE job_name IS NULL")

    op.alter_column("schedule_class_snapshots", "job_name", nullable=False)


def downgrade() -> None:
    op.drop_column("schedule_class_snapshots", "job_name")
