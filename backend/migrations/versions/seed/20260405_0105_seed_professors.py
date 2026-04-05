"""seed professors for resources module

Revision ID: 20260405_0105
Revises: 20260405_0104
Create Date: 2026-04-05 11:25:00
"""

from typing import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260405_0105"
down_revision: str | None = "20260405_0104"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        WITH professor_seed(program_value, name, is_any_time) AS (
          VALUES
            ('software-engineering', 'Prof. Narin Rattanakul', true),
            ('software-engineering', 'Prof. Pimchanok Srisuk', true),
            ('software-engineering', 'Prof. Kittipong Wattanapong', true),
            ('software-engineering', 'Prof. Thanita Phromraksa', true),
            ('software-engineering', 'Prof. Chonlathorn Boonmee', false),
            ('software-engineering', 'Prof. Supatcha Limsakul', false),
            ('software-engineering', 'Prof. Piyawat Techapanich', false),
            ('software-engineering', 'Prof. Lalita Jirakul', false),
            ('computer-engineering', 'Prof. Anan Chaiyasit', true),
            ('computer-engineering', 'Prof. Saran Kiatkarn', true),
            ('computer-engineering', 'Prof. Rachata Preechawong', true),
            ('computer-engineering', 'Prof. Napatsorn Wichian', true),
            ('computer-engineering', 'Prof. Ploy Sirikanya', false),
            ('computer-engineering', 'Prof. Arun Preechakul', false),
            ('computer-engineering', 'Prof. Tanakorn Meksawat', false),
            ('computer-engineering', 'Prof. Chalida Khemthong', false),
            ('mechanical-engineering', 'Prof. Worawat Chansri', true),
            ('mechanical-engineering', 'Prof. Nattapong Suksomboon', true),
            ('mechanical-engineering', 'Prof. Siriporn Udomchai', true),
            ('mechanical-engineering', 'Prof. Kanyakorn Rujiravanich', true),
            ('mechanical-engineering', 'Prof. Prateep Kraisorn', false),
            ('mechanical-engineering', 'Prof. Monthira Chanthra', false),
            ('mechanical-engineering', 'Prof. Teerapat Kijmetta', false),
            ('mechanical-engineering', 'Prof. Rungnapa Sornchai', false),
            ('chemical-engineering', 'Prof. Panuwat Srethong', true),
            ('chemical-engineering', 'Prof. Jiratchaya Boonrak', true),
            ('chemical-engineering', 'Prof. Kritsada Phusit', true),
            ('chemical-engineering', 'Prof. Arisara Ketsiri', true),
            ('chemical-engineering', 'Prof. Wichuda Nimsuwan', false),
            ('chemical-engineering', 'Prof. Pongsakorn Jantarat', false),
            ('chemical-engineering', 'Prof. Nicha Maneewong', false),
            ('chemical-engineering', 'Prof. Pattharaphon Kaewdee', false)
        )
        INSERT INTO professors (id, name, is_any_time)
        SELECT gen_random_uuid(), ps.name, ps.is_any_time
        FROM professor_seed ps
        ON CONFLICT (name) DO UPDATE
          SET is_any_time = EXCLUDED.is_any_time;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DELETE FROM professors
        WHERE name IN (
          'Prof. Narin Rattanakul',
          'Prof. Pimchanok Srisuk',
          'Prof. Kittipong Wattanapong',
          'Prof. Thanita Phromraksa',
          'Prof. Chonlathorn Boonmee',
          'Prof. Supatcha Limsakul',
          'Prof. Piyawat Techapanich',
          'Prof. Lalita Jirakul',
          'Prof. Anan Chaiyasit',
          'Prof. Saran Kiatkarn',
          'Prof. Rachata Preechawong',
          'Prof. Napatsorn Wichian',
          'Prof. Ploy Sirikanya',
          'Prof. Arun Preechakul',
          'Prof. Tanakorn Meksawat',
          'Prof. Chalida Khemthong',
          'Prof. Worawat Chansri',
          'Prof. Nattapong Suksomboon',
          'Prof. Siriporn Udomchai',
          'Prof. Kanyakorn Rujiravanich',
          'Prof. Prateep Kraisorn',
          'Prof. Monthira Chanthra',
          'Prof. Teerapat Kijmetta',
          'Prof. Rungnapa Sornchai',
          'Prof. Panuwat Srethong',
          'Prof. Jiratchaya Boonrak',
          'Prof. Kritsada Phusit',
          'Prof. Arisara Ketsiri',
          'Prof. Wichuda Nimsuwan',
          'Prof. Pongsakorn Jantarat',
          'Prof. Nicha Maneewong',
          'Prof. Pattharaphon Kaewdee'
        );
        """
    )
