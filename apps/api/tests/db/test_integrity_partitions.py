"""Integrity job (DB-D39) and partition maintenance (DB-D44)."""

from datetime import date

from app.db import cuid, integrity, partitions
from app.db._ops import PARTITIONED_TABLES, partition_name
from tests.db import helpers


def test_default_partition_absorbs_audit_overflow(conn):
    # 0003 safety net: a row beyond the +12 horizon lands in the default partition,
    # not a 'no partition found' error (audit_log is written in every mutation's tx).
    conn.execute(
        "INSERT INTO audit_log(id, action, resource_type, request_id, created_at)"
        " VALUES (%s, 'x', 'x', %s, now() + interval '36 months')",
        (cuid(), cuid()),
    )


def test_default_partition_absorbs_outbox_overflow(conn):
    uid = helpers.insert_user(conn)
    conn.execute(
        "INSERT INTO notification_outbox(id, user_id, trigger, channels, payload, created_at)"
        " VALUES (%s, %s, 'DECISION_APPROVED', %s, '{}', now() + interval '36 months')",
        (cuid(), uid, ["email"]),
    )


def test_integrity_clean_on_seeded_db(conn):
    results = integrity.run_all(conn)
    assert all(r.ok for r in results), [(r.name, r.detail) for r in results if not r.ok]
    names = {r.name for r in results}
    assert names == {
        "status-cache consistency",
        "dangling-reference scan",
        "partition-horizon check",
        "partition-seal check",
    }


def test_status_cache_drift_is_detected(conn):
    # Cache says DRAFT but the latest event says SUBMITTED → the check must flag it.
    aid = helpers.insert_application(conn, status="DRAFT")
    human = helpers.insert_user(conn)
    helpers.insert_status_event(
        conn, application_id=aid, actor_user_id=human, to_status="SUBMITTED"
    )
    result = integrity.check_status_cache(conn)
    assert not result.ok
    assert "funding_application" in result.detail


def test_partition_horizon_check_passes_after_maintenance(conn):
    result = integrity.check_partition_horizon(conn)
    assert result.ok, result.detail


def test_ensure_partitions_is_idempotent_and_covers_horizon(conn):
    # A far-future date so the partitions certainly do not exist yet.
    future = date(2030, 1, 1)
    created_first = partitions.ensure_partitions(conn, today=future, months_ahead=12)
    created_second = partitions.ensure_partitions(conn, today=future, months_ahead=12)
    assert created_second == []  # idempotent
    # Every table got the +12 month partition.
    target = partition_name(PARTITIONED_TABLES[0], date(2031, 1, 1))
    assert target in created_first
    exists = conn.execute("SELECT to_regclass(%s)", (f"public.{target}",)).fetchone()[0]
    assert exists is not None
