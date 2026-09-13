"""Partition maintenance (DB-D44).

High-volume append-only tables are range-partitioned by month. Migration 0001 creates
the first 12 months; this job, run on a schedule, keeps month N+12 ahead so inserts
never fall off the end of the partition range. Idempotent (CREATE TABLE IF NOT EXISTS).

Every run also SEALS every partition (#292). PostgreSQL applies row-level security to the relation
named in a query, so a partition named directly bypasses its parent's policies — and the default
privileges from 0005/0006 grant the app roles access to each partition this job creates. The seal
(``fn_seal_partitions()``, migration 0021) revokes those privileges and enables RLS with no policy.
It runs on every call, not only after a create, so a partition that was ever re-granted is healed.

Run: ``python -m app.db.partitions`` (or ``make partitions``).
"""

from __future__ import annotations

from datetime import date

import psycopg

from app.db._ops import PARTITIONED_TABLES, connect, month_start, partition_name

MONTHS_AHEAD = 12


def ensure_partitions(
    conn: psycopg.Connection, *, today: date | None = None, months_ahead: int = MONTHS_AHEAD
) -> list[str]:
    """Ensure each partitioned table has child partitions for this month through N+ahead."""
    today = today or date.today()
    created: list[str] = []
    for table in PARTITIONED_TABLES:
        for offset in range(months_ahead + 1):
            start = month_start(today, offset)
            end = month_start(today, offset + 1)
            name = partition_name(table, start)
            existed = conn.execute(
                "SELECT to_regclass(%s)", (f"public.{name}",)
            ).fetchone()[0]
            # Partition bounds cannot be bound params in DDL; the dates are code-computed
            # `date` objects (never user input), so inlining the ISO literals is safe.
            conn.execute(
                f"CREATE TABLE IF NOT EXISTS {name} PARTITION OF {table} "
                f"FOR VALUES FROM ('{start.isoformat()}') TO ('{end.isoformat()}')"
            )
            if existed is None:
                created.append(name)
    conn.execute("SELECT fn_seal_partitions()")
    return created


def main() -> int:
    with connect() as conn:
        created = ensure_partitions(conn)
        conn.commit()
    if created:
        print(f"partition maintenance: created {len(created)} partition(s): {', '.join(created)}")
    else:
        print(f"partition maintenance: horizon already covers +{MONTHS_AHEAD} months (no-op)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
