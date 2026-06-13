"""Alembic environment.

Migrations run **synchronously** over psycopg3 (S5.9 / ADR-003: SQLAlchemy for
schema/CRUD; the async asyncpg engine is the runtime path in app.db.engine).
The DB URL is resolved from the environment so nothing is hardcoded (S3.20):
ALEMBIC_DATABASE_URL > DATABASE_URL > app settings default. Any ``+asyncpg`` URL is
normalised to ``+psycopg`` for the sync migration engine.
"""

from __future__ import annotations

import os

from sqlalchemy import engine_from_config, pool

from alembic import context
from app.core.config import settings

config = context.config


def _sync_url() -> str:
    url = (
        os.environ.get("ALEMBIC_DATABASE_URL")
        or os.environ.get("DATABASE_URL")
        or settings.database_url
    )
    # Migrations are synchronous — force the psycopg3 sync driver.
    if "+asyncpg" in url:
        url = url.replace("+asyncpg", "+psycopg")
    elif url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url


config.set_main_option("sqlalchemy.url", _sync_url())

# No ORM models — this stage manages schema via raw DDL (op.execute of schema.sql).
target_metadata = None


def run_migrations_offline() -> None:
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
