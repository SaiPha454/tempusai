"""add job name to exam snapshots

Revision ID: 20260405_0006
Revises: 20260402_0005
Create Date: 2026-04-05 10:00:00
"""

from typing import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260405_0006"
down_revision: str | None = "20260402_0005"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "schedule_exam_snapshots",
        sa.Column("job_name", sa.String(length=120), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("schedule_exam_snapshots", "job_name")
