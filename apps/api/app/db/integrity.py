"""Integrity job suite skeleton (DB-D39).

Ch01's anomaly warnings, automated: a single command that reports variance and exits
non-zero if anything is wrong. Three checks at v1:

1. **Status-cache consistency** — every cached ``status`` column must equal the latest
   append-only status event (the event log is the truth; the column is a cache, DB-D24).
2. **Dangling-reference scan** — PG referential integrity is FK-enforced, so the live
   surface here is cross-store (PostgreSQL ↔ MongoDB reasoning ↔ ChromaDB vectors,
   DB-D35); those stores are wired in Stage 03, so this reports as deferred, not silent.
3. **Partition-horizon check** — every partitioned table must have a partition covering
   at least ``REQUIRED_MONTHS_AHEAD`` months out, or inserts will start failing.

Run: ``python -m app.db.integrity`` (or ``make integrity``).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

import psycopg

from app.db._ops import PARTITIONED_TABLES, connect, month_start, partition_name

REQUIRED_MONTHS_AHEAD = 3


@dataclass
class CheckResult:
    name: str
    ok: bool
    detail: str


def check_status_cache(conn: psycopg.Connection) -> CheckResult:
    drifts: list[str] = []
    for table, event_table, fk in (
        ("funding_application", "application_status_event", "application_id"),
        ("tracked_application", "tracked_status_event", "tracked_application_id"),
    ):
        rows = conn.execute(
            f"""
            WITH latest AS (
                SELECT DISTINCT ON ({fk}) {fk} AS ref, to_status
                FROM {event_table}
                ORDER BY {fk}, created_at DESC
            )
            SELECT count(*) FROM {table} t
            JOIN latest l ON l.ref = t.id
            WHERE t.status <> l.to_status
            """
        ).fetchone()[0]
        if rows:
            drifts.append(f"{table}: {rows} row(s) drifted from {event_table}")
    return CheckResult(
        "status-cache consistency",
        not drifts,
        "; ".join(drifts) if drifts else "all cached statuses match their latest event",
    )


def check_dangling_references(conn: psycopg.Connection) -> CheckResult:
    # Within PostgreSQL every reference is an enforced FK (DB-D7), so there are no soft
    # references to scan here. Cross-store references (match_result.id -> Mongo doc;
    # profile/bursary -> Chroma vectors) carry the PG cuid and are validated by this job
    # once those stores exist (Stage 03, DB-D35).
    match_count = conn.execute("SELECT count(*) FROM match_result").fetchone()[0]
    return CheckResult(
        "dangling-reference scan",
        True,
        f"PG FKs enforced; cross-store scan deferred to Stage 03 (DB-D35) "
        f"[{match_count} match record(s) to reconcile when MongoDB/ChromaDB are wired]",
    )


def check_partition_horizon(conn: psycopg.Connection) -> CheckResult:
    today = date.today()
    shortfalls: list[str] = []
    for table in PARTITIONED_TABLES:
        target = month_start(today, REQUIRED_MONTHS_AHEAD)
        name = partition_name(table, target)
        exists = conn.execute("SELECT to_regclass(%s)", (f"public.{name}",)).fetchone()[0]
        if exists is None:
            shortfalls.append(f"{table}: missing partition {name} (+{REQUIRED_MONTHS_AHEAD}mo)")
    ok_detail = (
        f"all {len(PARTITIONED_TABLES)} partitioned tables cover +{REQUIRED_MONTHS_AHEAD} months"
    )
    return CheckResult(
        "partition-horizon check",
        not shortfalls,
        "; ".join(shortfalls) if shortfalls else ok_detail,
    )


def run_all(conn: psycopg.Connection) -> list[CheckResult]:
    return [
        check_status_cache(conn),
        check_dangling_references(conn),
        check_partition_horizon(conn),
    ]


def main() -> int:
    with connect() as conn:
        results = run_all(conn)
    failed = [r for r in results if not r.ok]
    for r in results:
        print(f"[{'OK ' if r.ok else 'FAIL'}] {r.name}: {r.detail}")
    if failed:
        print(f"\nintegrity: {len(failed)} check(s) FAILED")
        return 1
    print("\nintegrity: all checks clean")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
