"""seed initial dummy data

Revision ID: 20260329_0002
Revises: 20260329_0001
Create Date: 2026-03-29 00:10:00
"""

from typing import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260329_0002"
down_revision: str | None = "20260329_0001"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO programs (id, value, label) VALUES
          (gen_random_uuid(), 'computer-engineering', 'Computer Engineering'),
          (gen_random_uuid(), 'software-engineering', 'Software Engineering'),
          (gen_random_uuid(), 'computer-science', 'Computer Science'),
          (gen_random_uuid(), 'information-technology', 'Information Technology')
        ON CONFLICT (value) DO NOTHING;
        """
    )

    op.execute(
        """
        INSERT INTO rooms (id, name, capacity) VALUES
          (gen_random_uuid(), 'HM-301', 60),
          (gen_random_uuid(), 'HM-302', 60),
          (gen_random_uuid(), 'HM-303', 55),
          (gen_random_uuid(), 'ENG-201', 45)
        ON CONFLICT (name) DO NOTHING;
        """
    )

    op.execute(
        """
        INSERT INTO timeslots (id, day, label) VALUES
          (gen_random_uuid(), 'Mon', '9:00 AM - 12:00 PM'),
          (gen_random_uuid(), 'Mon', '1:00 PM - 4:00 PM'),
          (gen_random_uuid(), 'Tue', '9:00 AM - 12:00 PM'),
          (gen_random_uuid(), 'Tue', '1:00 PM - 4:00 PM')
        ON CONFLICT (day, label) DO NOTHING;
        """
    )

    op.execute(
        """
        INSERT INTO professors (id, name, is_any_time) VALUES
          (gen_random_uuid(), 'Prof. Anan Chaiyasit', true),
          (gen_random_uuid(), 'Prof. Narin Rattanakul', true),
          (gen_random_uuid(), 'Prof. Pimchanok Srisuk', true)
        ON CONFLICT (name) DO NOTHING;
        """
    )

    op.execute(
        """
        INSERT INTO courses (id, code, name, program_id)
        SELECT gen_random_uuid(), c.code, c.name, p.id
        FROM (
          VALUES
            ('CE1101', 'Calculus for Engineers', 'computer-engineering'),
            ('CE1104', 'Programming Fundamentals', 'computer-engineering'),
            ('SE1101', 'Introduction to Software Engineering', 'software-engineering'),
            ('CS2101', 'Computer Networks', 'computer-science'),
            ('IT2202', 'Web Application Development', 'information-technology')
        ) AS c(code, name, program_value)
        JOIN programs p ON p.value = c.program_value
        ON CONFLICT (code) DO NOTHING;
        """
    )


def downgrade() -> None:
    op.execute("DELETE FROM courses WHERE code IN ('CE1101','CE1104','SE1101','CS2101','IT2202')")
    op.execute("DELETE FROM professors WHERE name IN ('Prof. Anan Chaiyasit','Prof. Narin Rattanakul','Prof. Pimchanok Srisuk')")
    op.execute("DELETE FROM timeslots WHERE (day, label) IN (('Mon','9:00 AM - 12:00 PM'),('Mon','1:00 PM - 4:00 PM'),('Tue','9:00 AM - 12:00 PM'),('Tue','1:00 PM - 4:00 PM'))")
    op.execute("DELETE FROM rooms WHERE name IN ('HM-301','HM-302','HM-303','ENG-201')")
    op.execute("DELETE FROM programs WHERE value IN ('computer-engineering','software-engineering','computer-science','information-technology')")
