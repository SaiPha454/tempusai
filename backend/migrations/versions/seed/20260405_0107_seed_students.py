"""seed students for resources module

Revision ID: 20260405_0107
Revises: 20260405_0106
Create Date: 2026-04-05 11:35:00
"""

from typing import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260405_0107"
down_revision: str | None = "20260405_0106"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        WITH program_seed(program_value, program_label, prefix) AS (
          VALUES
            ('software-engineering', 'Software Engineering', 'SE'),
            ('computer-engineering', 'Computer Engineering', 'CE'),
            ('mechanical-engineering', 'Mechanical Engineering', 'ME'),
            ('chemical-engineering', 'Chemical Engineering', 'CHE')
        ),
        student_seed AS (
          SELECT
            ps.program_value,
            format('%s-%s-%s', ps.prefix, year_no, lpad(student_no::text, 2, '0')) AS student_id,
            format('%s Year %s Student %s', ps.program_label, year_no, lpad(student_no::text, 2, '0')) AS name,
            year_no AS year
          FROM program_seed ps
          CROSS JOIN generate_series(1, 4) AS year_no
          CROSS JOIN generate_series(1, 7) AS student_no
        )
        INSERT INTO students (id, student_id, name, program_id, year)
        SELECT gen_random_uuid(), ss.student_id, ss.name, p.id, ss.year
        FROM student_seed ss
        JOIN programs p ON p.value = ss.program_value
        ON CONFLICT (student_id) DO UPDATE
          SET name = EXCLUDED.name,
              program_id = EXCLUDED.program_id,
              year = EXCLUDED.year;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        WITH prefix_seed(prefix) AS (
          VALUES ('SE'), ('CE'), ('ME'), ('CHE')
        ),
        student_keys AS (
          SELECT format('%s-%s-%s', ps.prefix, year_no, lpad(student_no::text, 2, '0')) AS student_id
          FROM prefix_seed ps
          CROSS JOIN generate_series(1, 4) AS year_no
          CROSS JOIN generate_series(1, 7) AS student_no
        )
        DELETE FROM students s
        USING student_keys sk
        WHERE s.student_id = sk.student_id;
        """
    )
