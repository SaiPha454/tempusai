"""seed professor availabilities for resources module

Revision ID: 20260405_0106
Revises: 20260405_0105
Create Date: 2026-04-05 11:30:00
"""

from typing import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260405_0106"
down_revision: str | None = "20260405_0105"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        WITH availability_seed(professor_name, day, label) AS (
          VALUES
            ('Prof. Chonlathorn Boonmee', 'Mon', '09:00 AM - 12:00 PM'),
            ('Prof. Chonlathorn Boonmee', 'Mon', '01:00 PM - 04:00 PM'),
            ('Prof. Chonlathorn Boonmee', 'Wed', '09:00 AM - 12:00 PM'),
            ('Prof. Chonlathorn Boonmee', 'Wed', '01:00 PM - 04:00 PM'),
            ('Prof. Supatcha Limsakul', 'Tue', '09:00 AM - 12:00 PM'),
            ('Prof. Supatcha Limsakul', 'Tue', '01:00 PM - 04:00 PM'),
            ('Prof. Supatcha Limsakul', 'Thu', '09:00 AM - 12:00 PM'),
            ('Prof. Supatcha Limsakul', 'Thu', '01:00 PM - 04:00 PM'),
            ('Prof. Piyawat Techapanich', 'Mon', '09:00 AM - 12:00 PM'),
            ('Prof. Piyawat Techapanich', 'Wed', '09:00 AM - 12:00 PM'),
            ('Prof. Piyawat Techapanich', 'Fri', '09:00 AM - 12:00 PM'),
            ('Prof. Lalita Jirakul', 'Tue', '01:00 PM - 04:00 PM'),
            ('Prof. Lalita Jirakul', 'Thu', '01:00 PM - 04:00 PM'),
            ('Prof. Lalita Jirakul', 'Fri', '01:00 PM - 04:00 PM'),
            ('Prof. Ploy Sirikanya', 'Mon', '09:00 AM - 12:00 PM'),
            ('Prof. Ploy Sirikanya', 'Mon', '01:00 PM - 04:00 PM'),
            ('Prof. Ploy Sirikanya', 'Tue', '09:00 AM - 12:00 PM'),
            ('Prof. Ploy Sirikanya', 'Tue', '01:00 PM - 04:00 PM'),
            ('Prof. Arun Preechakul', 'Wed', '09:00 AM - 12:00 PM'),
            ('Prof. Arun Preechakul', 'Wed', '01:00 PM - 04:00 PM'),
            ('Prof. Arun Preechakul', 'Thu', '09:00 AM - 12:00 PM'),
            ('Prof. Arun Preechakul', 'Thu', '01:00 PM - 04:00 PM'),
            ('Prof. Tanakorn Meksawat', 'Tue', '09:00 AM - 12:00 PM'),
            ('Prof. Tanakorn Meksawat', 'Thu', '09:00 AM - 12:00 PM'),
            ('Prof. Tanakorn Meksawat', 'Fri', '09:00 AM - 12:00 PM'),
            ('Prof. Chalida Khemthong', 'Mon', '01:00 PM - 04:00 PM'),
            ('Prof. Chalida Khemthong', 'Wed', '01:00 PM - 04:00 PM'),
            ('Prof. Chalida Khemthong', 'Fri', '01:00 PM - 04:00 PM'),
            ('Prof. Prateep Kraisorn', 'Mon', '09:00 AM - 12:00 PM'),
            ('Prof. Prateep Kraisorn', 'Mon', '01:00 PM - 04:00 PM'),
            ('Prof. Prateep Kraisorn', 'Thu', '09:00 AM - 12:00 PM'),
            ('Prof. Prateep Kraisorn', 'Thu', '01:00 PM - 04:00 PM'),
            ('Prof. Monthira Chanthra', 'Tue', '09:00 AM - 12:00 PM'),
            ('Prof. Monthira Chanthra', 'Tue', '01:00 PM - 04:00 PM'),
            ('Prof. Monthira Chanthra', 'Fri', '09:00 AM - 12:00 PM'),
            ('Prof. Monthira Chanthra', 'Fri', '01:00 PM - 04:00 PM'),
            ('Prof. Teerapat Kijmetta', 'Wed', '09:00 AM - 12:00 PM'),
            ('Prof. Teerapat Kijmetta', 'Thu', '09:00 AM - 12:00 PM'),
            ('Prof. Teerapat Kijmetta', 'Fri', '09:00 AM - 12:00 PM'),
            ('Prof. Rungnapa Sornchai', 'Mon', '01:00 PM - 04:00 PM'),
            ('Prof. Rungnapa Sornchai', 'Tue', '01:00 PM - 04:00 PM'),
            ('Prof. Rungnapa Sornchai', 'Thu', '01:00 PM - 04:00 PM'),
            ('Prof. Wichuda Nimsuwan', 'Mon', '09:00 AM - 12:00 PM'),
            ('Prof. Wichuda Nimsuwan', 'Mon', '01:00 PM - 04:00 PM'),
            ('Prof. Wichuda Nimsuwan', 'Wed', '09:00 AM - 12:00 PM'),
            ('Prof. Wichuda Nimsuwan', 'Wed', '01:00 PM - 04:00 PM'),
            ('Prof. Pongsakorn Jantarat', 'Tue', '09:00 AM - 12:00 PM'),
            ('Prof. Pongsakorn Jantarat', 'Tue', '01:00 PM - 04:00 PM'),
            ('Prof. Pongsakorn Jantarat', 'Thu', '09:00 AM - 12:00 PM'),
            ('Prof. Pongsakorn Jantarat', 'Thu', '01:00 PM - 04:00 PM'),
            ('Prof. Nicha Maneewong', 'Wed', '09:00 AM - 12:00 PM'),
            ('Prof. Nicha Maneewong', 'Fri', '09:00 AM - 12:00 PM'),
            ('Prof. Nicha Maneewong', 'Fri', '01:00 PM - 04:00 PM'),
            ('Prof. Pattharaphon Kaewdee', 'Tue', '01:00 PM - 04:00 PM'),
            ('Prof. Pattharaphon Kaewdee', 'Wed', '01:00 PM - 04:00 PM'),
            ('Prof. Pattharaphon Kaewdee', 'Thu', '01:00 PM - 04:00 PM')
        )
        INSERT INTO professor_availabilities (professor_id, timeslot_id)
        SELECT p.id, t.id
        FROM availability_seed a
        JOIN professors p ON p.name = a.professor_name
        JOIN timeslots t ON t.day = a.day AND t.label = a.label
        ON CONFLICT (professor_id, timeslot_id) DO NOTHING;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DELETE FROM professor_availabilities pa
        USING professors p
        WHERE pa.professor_id = p.id
          AND p.name IN (
            'Prof. Chonlathorn Boonmee',
            'Prof. Supatcha Limsakul',
            'Prof. Piyawat Techapanich',
            'Prof. Lalita Jirakul',
            'Prof. Ploy Sirikanya',
            'Prof. Arun Preechakul',
            'Prof. Tanakorn Meksawat',
            'Prof. Chalida Khemthong',
            'Prof. Prateep Kraisorn',
            'Prof. Monthira Chanthra',
            'Prof. Teerapat Kijmetta',
            'Prof. Rungnapa Sornchai',
            'Prof. Wichuda Nimsuwan',
            'Prof. Pongsakorn Jantarat',
            'Prof. Nicha Maneewong',
            'Prof. Pattharaphon Kaewdee'
          );
        """
    )
