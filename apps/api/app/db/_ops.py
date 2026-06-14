"""Shared helpers for the synchronous ops jobs (integrity, partition maintenance).

These are operational scripts (run from cron / Makefile / CI), not request paths, so
they use the sync psycopg3 driver. The DB URL is resolved from the environment — never
hardcoded (S3.20).
"""

from __future__ import annotations

import os
from datetime import date

import psycopg

PARTITIONED_TABLES = (
    "application_status_event",
    "tracked_status_event",
    "notification_outbox",
    "audit_log",
)


def conninfo() -> str:
    """Resolve a plain libpq URL from the environment (strip any SQLAlchemy driver suffix)."""
    url = (
        os.environ.get("ALEMBIC_DATABASE_URL")
        or os.environ.get("DATABASE_URL")
        or "postgresql://fundslink:fundslink@localhost:5432/fundslink"
    )
    return url.replace("+asyncpg", "").replace("+psycopg", "")


def connect() -> psycopg.Connection:
    return psycopg.connect(conninfo())


def month_start(today: date, offset: int) -> date:
    """First day of the month `offset` months after `today`'s month."""
    month_index = today.year * 12 + (today.month - 1) + offset
    return date(month_index // 12, month_index % 12 + 1, 1)


def partition_name(table: str, start: date) -> str:
    return f"{table}_{start:%Y%m}"
