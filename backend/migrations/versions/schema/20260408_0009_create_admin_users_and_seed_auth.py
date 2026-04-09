"""create admin users table and seed auth users

Revision ID: 20260408_0009
Revises: 20260406_0008
Create Date: 2026-04-08 10:00:00
"""

from __future__ import annotations

import base64
import hashlib
import os
from datetime import datetime, timezone
from typing import Sequence
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260408_0009"
down_revision: str | None = "20260406_0008"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None

PBKDF2_ALGORITHM = "sha256"
PBKDF2_ITERATIONS = 390000


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac(PBKDF2_ALGORITHM, password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    return f"pbkdf2_{PBKDF2_ALGORITHM}${PBKDF2_ITERATIONS}${_b64url_encode(salt)}${_b64url_encode(digest)}"


def upgrade() -> None:
    op.create_table(
        "admin_users",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("display_name", sa.String(length=120), nullable=False),
        sa.Column("role", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("password_hash", sa.String(length=512), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_admin_users_email"), "admin_users", ["email"], unique=True)
    op.create_index(op.f("ix_admin_users_role"), "admin_users", ["role"], unique=False)

    table = sa.table(
        "admin_users",
        sa.column("id", sa.UUID),
        sa.column("email", sa.String),
        sa.column("display_name", sa.String),
        sa.column("role", sa.String),
        sa.column("status", sa.String),
        sa.column("password_hash", sa.String),
        sa.column("created_at", sa.DateTime(timezone=True)),
        sa.column("updated_at", sa.DateTime(timezone=True)),
    )

    now = datetime.now(timezone.utc)
    op.bulk_insert(
        table,
        [
            {
                "id": uuid4(),
                "email": "superadmin@tempusai.local",
                "display_name": "System Super Admin",
                "role": "SUPER_ADMIN",
                "status": "ACTIVE",
                "password_hash": _hash_password("Tempus@123"),
                "created_at": now,
                "updated_at": now,
            },
            {
                "id": uuid4(),
                "email": "admin@tempusai.local",
                "display_name": "System Admin",
                "role": "ADMIN",
                "status": "ACTIVE",
                "password_hash": _hash_password("Admin@123"),
                "created_at": now,
                "updated_at": now,
            },
        ],
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_admin_users_role"), table_name="admin_users")
    op.drop_index(op.f("ix_admin_users_email"), table_name="admin_users")
    op.drop_table("admin_users")
