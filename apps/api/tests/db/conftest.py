"""Fixtures for the DB-D37 constraint suite.

Resolves a sync libpq conninfo from the environment, ensures the schema+seeds are
present (``alembic upgrade head`` — idempotent), and gives each test a connection
that is **always rolled back**. Because nothing commits, attempted violations leave
no trace and append-only tables are never polluted.
"""

from __future__ import annotations

import os
import subprocess
import sys
from collections.abc import Iterator
from pathlib import Path

import psycopg
import pytest

_API_DIR = Path(__file__).resolve().parents[2]  # apps/api (holds alembic.ini)


def _conninfo() -> str:
    url = (
        os.environ.get("ALEMBIC_DATABASE_URL")
        or os.environ.get("DATABASE_URL")
        or "postgresql://fundslink:fundslink@localhost:5432/fundslink"
    )
    # psycopg.connect wants a plain libpq URL — strip the SQLAlchemy driver suffix.
    return url.replace("+asyncpg", "").replace("+psycopg", "")


@pytest.fixture(scope="session")
def _migrated() -> str:
    conninfo = _conninfo()
    env = {**os.environ, "ALEMBIC_DATABASE_URL": conninfo}
    subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=_API_DIR,
        env=env,
        check=True,
        capture_output=True,
    )
    return conninfo


@pytest.fixture
def conn(_migrated: str) -> Iterator[psycopg.Connection]:
    connection = psycopg.connect(_migrated)  # autocommit=False
    try:
        yield connection
    finally:
        connection.rollback()
        connection.close()
