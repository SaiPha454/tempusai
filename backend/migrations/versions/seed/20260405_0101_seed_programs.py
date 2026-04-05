"""seed programs for resources module

Revision ID: 20260405_0101
Revises: 20260329_0001
Create Date: 2026-04-05 11:00:00
"""

from typing import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260405_0101"
down_revision: str | None = "20260329_0001"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO programs (id, value, label)
        VALUES
          (gen_random_uuid(), 'software-engineering', 'Software Engineering'),
          (gen_random_uuid(), 'computer-engineering', 'Computer Engineering'),
          (gen_random_uuid(), 'mechanical-engineering', 'Mechanical Engineering'),
          (gen_random_uuid(), 'chemical-engineering', 'Chemical Engineering')
        ON CONFLICT (value) DO UPDATE
          SET label = EXCLUDED.label;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DELETE FROM programs
        WHERE value IN (
          'software-engineering',
          'computer-engineering',
          'mechanical-engineering',
          'chemical-engineering'
        );
        """
    )
