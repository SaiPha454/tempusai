"""create chat vector table

Revision ID: 20260406_0007
Revises: 20260405_0006
Create Date: 2026-04-06 09:00:00
"""

from typing import Sequence

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector

# revision identifiers, used by Alembic.
revision: str = "20260406_0007"
down_revision: str | None = "20260405_0006"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    extension_available = bool(
        bind.execute(
            sa.text("SELECT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector')")
        ).scalar()
    )

    if not extension_available:
        # Allow migration chain to proceed in environments where pgvector is not installed.
        return

    op.execute('CREATE EXTENSION IF NOT EXISTS "vector";')

    op.create_table(
        "chat_knowledge_chunks",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("metadata_", sa.JSON(), nullable=True),
        sa.Column("node_id", sa.String(length=255), nullable=True),
        sa.Column("embedding", Vector(1536), nullable=False),
    )
    op.create_index(
        "ix_chat_knowledge_chunks_node_id",
        "chat_knowledge_chunks",
        ["node_id"],
        unique=False,
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_chat_knowledge_chunks_node_id")
    op.execute("DROP TABLE IF EXISTS chat_knowledge_chunks")
