"""seed timeslots for resources module

Revision ID: 20260405_0103
Revises: 20260405_0102
Create Date: 2026-04-05 11:10:00
"""

from typing import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260405_0103"
down_revision: str | None = "20260405_0102"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        WITH day_seed AS (
          SELECT day
          FROM (VALUES ('Mon'), ('Tue'), ('Wed'), ('Thu'), ('Fri')) AS d(day)
        ),
        slot_seed AS (
          SELECT label
          FROM (VALUES ('09:00 AM - 12:00 PM'), ('01:00 PM - 04:00 PM')) AS s(label)
        )
        INSERT INTO timeslots (id, day, label)
        SELECT gen_random_uuid(), d.day, s.label
        FROM day_seed d
        CROSS JOIN slot_seed s
        ON CONFLICT (day, label) DO NOTHING;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DELETE FROM timeslots
        WHERE day IN ('Mon', 'Tue', 'Wed', 'Thu', 'Fri')
          AND label IN ('09:00 AM - 12:00 PM', '01:00 PM - 04:00 PM');
        """
    )
