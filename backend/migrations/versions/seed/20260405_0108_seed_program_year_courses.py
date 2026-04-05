"""seed program-year course plans for resources module

Revision ID: 20260405_0108
Revises: 20260405_0107
Create Date: 2026-04-05 11:40:00
"""

from typing import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260405_0108"
down_revision: str | None = "20260405_0107"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        WITH target_programs AS (
          SELECT id, value
          FROM programs
          WHERE value IN (
            'software-engineering',
            'computer-engineering',
            'mechanical-engineering',
            'chemical-engineering'
          )
        ),
        course_rows AS (
          SELECT
            tp.id AS program_id,
            tp.value AS program_value,
            c.id AS course_id,
            c.code AS course_code,
            CAST(regexp_replace(c.code, '^[A-Z]+([1-4])[0-9]{3}$', '\\1') AS INTEGER) AS year,
            row_number() OVER (PARTITION BY tp.value ORDER BY c.code) AS row_no
          FROM courses c
          JOIN target_programs tp ON tp.id = c.program_id
          WHERE c.code ~ '^(SE|CE|ME|CHE)[1-4][0-9]{3}$'
        ),
        professor_seed(program_value, professor_name) AS (
          VALUES
            ('software-engineering', 'Prof. Narin Rattanakul'),
            ('software-engineering', 'Prof. Pimchanok Srisuk'),
            ('software-engineering', 'Prof. Kittipong Wattanapong'),
            ('software-engineering', 'Prof. Thanita Phromraksa'),
            ('software-engineering', 'Prof. Chonlathorn Boonmee'),
            ('software-engineering', 'Prof. Supatcha Limsakul'),
            ('software-engineering', 'Prof. Piyawat Techapanich'),
            ('software-engineering', 'Prof. Lalita Jirakul'),
            ('computer-engineering', 'Prof. Anan Chaiyasit'),
            ('computer-engineering', 'Prof. Saran Kiatkarn'),
            ('computer-engineering', 'Prof. Rachata Preechawong'),
            ('computer-engineering', 'Prof. Napatsorn Wichian'),
            ('computer-engineering', 'Prof. Ploy Sirikanya'),
            ('computer-engineering', 'Prof. Arun Preechakul'),
            ('computer-engineering', 'Prof. Tanakorn Meksawat'),
            ('computer-engineering', 'Prof. Chalida Khemthong'),
            ('mechanical-engineering', 'Prof. Worawat Chansri'),
            ('mechanical-engineering', 'Prof. Nattapong Suksomboon'),
            ('mechanical-engineering', 'Prof. Siriporn Udomchai'),
            ('mechanical-engineering', 'Prof. Kanyakorn Rujiravanich'),
            ('mechanical-engineering', 'Prof. Prateep Kraisorn'),
            ('mechanical-engineering', 'Prof. Monthira Chanthra'),
            ('mechanical-engineering', 'Prof. Teerapat Kijmetta'),
            ('mechanical-engineering', 'Prof. Rungnapa Sornchai'),
            ('chemical-engineering', 'Prof. Panuwat Srethong'),
            ('chemical-engineering', 'Prof. Jiratchaya Boonrak'),
            ('chemical-engineering', 'Prof. Kritsada Phusit'),
            ('chemical-engineering', 'Prof. Arisara Ketsiri'),
            ('chemical-engineering', 'Prof. Wichuda Nimsuwan'),
            ('chemical-engineering', 'Prof. Pongsakorn Jantarat'),
            ('chemical-engineering', 'Prof. Nicha Maneewong'),
            ('chemical-engineering', 'Prof. Pattharaphon Kaewdee')
        ),
        professor_rows AS (
          SELECT
            ps.program_value,
            p.id AS professor_id,
            row_number() OVER (PARTITION BY ps.program_value ORDER BY ps.professor_name) AS row_no
          FROM professor_seed ps
          JOIN professors p ON p.name = ps.professor_name
        ),
        plan_rows AS (
          SELECT
            cr.program_id,
            cr.year,
            cr.course_id,
            pr.professor_id
          FROM course_rows cr
          LEFT JOIN professor_rows pr
            ON pr.program_value = cr.program_value
           AND pr.row_no = ((cr.row_no - 1) % 8) + 1
        )
        INSERT INTO program_year_courses (id, program_id, year, course_id, professor_id)
        SELECT gen_random_uuid(), pr.program_id, pr.year, pr.course_id, pr.professor_id
        FROM plan_rows pr
        WHERE pr.year BETWEEN 1 AND 4
          AND NOT EXISTS (
            SELECT 1
            FROM program_year_courses pyc
            WHERE pyc.program_id = pr.program_id
              AND pyc.year = pr.year
              AND pyc.course_id = pr.course_id
          );
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DELETE FROM program_year_courses pyc
        USING programs p, courses c
        WHERE pyc.program_id = p.id
          AND pyc.course_id = c.id
          AND p.value IN (
            'software-engineering',
            'computer-engineering',
            'mechanical-engineering',
            'chemical-engineering'
          )
          AND c.code ~ '^(SE|CE|ME|CHE)[1-4][0-9]{3}$';
        """
    )
