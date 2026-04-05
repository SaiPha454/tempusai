"""seed rooms for resources module

Revision ID: 20260405_0102
Revises: 20260405_0101
Create Date: 2026-04-05 11:05:00
"""

from typing import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260405_0102"
down_revision: str | None = "20260405_0101"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        WITH ecc_rooms AS (
          SELECT
            format('ECC-%s%s', floor_no, lpad(room_no::text, 2, '0')) AS name,
            96 - (room_no * 4) AS capacity
          FROM (VALUES (7), (8)) AS floors(floor_no)
          CROSS JOIN generate_series(1, 8) AS room_no
        ),
        hm_rooms AS (
          SELECT
            format('HM-%s%s', floor_no, lpad(room_no::text, 2, '0')) AS name,
            72 - (room_no * 3) AS capacity
          FROM generate_series(3, 6) AS floor_no
          CROSS JOIN generate_series(1, 8) AS room_no
        ),
        room_seed AS (
          SELECT name, capacity FROM ecc_rooms
          UNION ALL
          SELECT name, capacity FROM hm_rooms
        )
        INSERT INTO rooms (id, name, capacity)
        SELECT gen_random_uuid(), rs.name, rs.capacity
        FROM room_seed rs
        ON CONFLICT (name) DO UPDATE
          SET capacity = EXCLUDED.capacity;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        WITH ecc_rooms AS (
          SELECT format('ECC-%s%s', floor_no, lpad(room_no::text, 2, '0')) AS name
          FROM (VALUES (7), (8)) AS floors(floor_no)
          CROSS JOIN generate_series(1, 8) AS room_no
        ),
        hm_rooms AS (
          SELECT format('HM-%s%s', floor_no, lpad(room_no::text, 2, '0')) AS name
          FROM generate_series(3, 6) AS floor_no
          CROSS JOIN generate_series(1, 8) AS room_no
        ),
        room_seed AS (
          SELECT name FROM ecc_rooms
          UNION ALL
          SELECT name FROM hm_rooms
        )
        DELETE FROM rooms r
        USING room_seed rs
        WHERE r.name = rs.name;
        """
    )
