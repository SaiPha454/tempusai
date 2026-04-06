from __future__ import annotations

import ast
import logging
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, text

from app.core.config import settings
from app.core.database import engine

logger = logging.getLogger(__name__)

RESOURCE_TABLES = [
    "programs",
    "rooms",
    "timeslots",
    "courses",
    "professors",
    "students",
    "program_year_courses",
]

SEED_MIGRATION_FILES = [
    "20260405_0101_seed_programs.py",
    "20260405_0102_seed_rooms.py",
    "20260405_0103_seed_timeslots.py",
    "20260405_0104_seed_courses.py",
    "20260405_0105_seed_professors.py",
    "20260405_0106_seed_professor_availabilities.py",
    "20260405_0107_seed_students.py",
    "20260405_0108_seed_program_year_courses.py",
]


def _has_applied_alembic_version() -> bool:
    with engine.connect() as connection:
        inspector = inspect(connection)
        if not inspector.has_table("alembic_version"):
            return False

        row = connection.execute(text("SELECT version_num FROM alembic_version LIMIT 1")).scalar_one_or_none()
        return bool(row)


def _needs_resource_seed() -> bool:
    with engine.connect() as connection:
        inspector = inspect(connection)
        if not all(inspector.has_table(table_name) for table_name in RESOURCE_TABLES):
            return False

        programs_count = connection.execute(text("SELECT COUNT(*) FROM programs")).scalar_one()
        return programs_count == 0


def _extract_upgrade_sql_statements(migration_file: Path) -> list[str]:
    module = ast.parse(migration_file.read_text(encoding="utf-8"), filename=str(migration_file))
    statements: list[str] = []

    for node in module.body:
        if not isinstance(node, ast.FunctionDef) or node.name != "upgrade":
            continue

        for inner in ast.walk(node):
            if not isinstance(inner, ast.Call):
                continue
            if not isinstance(inner.func, ast.Attribute):
                continue
            if inner.func.attr != "execute":
                continue
            if not isinstance(inner.func.value, ast.Name) or inner.func.value.id != "op":
                continue
            if not inner.args:
                continue

            first_arg = inner.args[0]
            if isinstance(first_arg, ast.Constant) and isinstance(first_arg.value, str):
                statements.append(first_arg.value)

    return statements


def _run_seed_statements_from_migrations(project_root: Path) -> None:
    seed_dir = project_root / "migrations" / "versions" / "seed"
    if not seed_dir.exists():
        logger.warning("Seed migration directory not found: %s", seed_dir)
        return

    with engine.begin() as connection:
        for seed_file in SEED_MIGRATION_FILES:
            migration_file = seed_dir / seed_file
            if not migration_file.exists():
                logger.warning("Seed migration file not found: %s", migration_file)
                continue

            statements = _extract_upgrade_sql_statements(migration_file)
            for statement in statements:
                connection.execute(text(statement))


def run_startup_migrations() -> None:
    """Run Alembic migrations on startup.

    This keeps existing initialized databases up to date when new revisions are added.
    """
    if not settings.run_migrations_on_startup:
        logger.info("Startup migrations disabled by configuration")
        return

    project_root = Path(__file__).resolve().parents[2]

    alembic_ini = project_root / "alembic.ini"

    logger.info("Applying migrations to head")
    alembic_cfg = Config(str(alembic_ini))
    command.upgrade(alembic_cfg, "head")

    if settings.run_seed_on_empty_resources_startup and _needs_resource_seed():
        logger.info("Initialized DB with empty resources detected; applying seed data")
        _run_seed_statements_from_migrations(project_root)
        logger.info("Startup seed data applied")

    logger.info("Startup migrations completed")
