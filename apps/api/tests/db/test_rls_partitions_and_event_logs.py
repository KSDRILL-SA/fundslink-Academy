"""The RLS wall has no way around it (migration 0021, #292).

Before 0021, connected as ``fundslink_app`` with a student context for an unrelated user, a probe
read 0 audit rows through ``audit_log`` and 7033 through ``audit_log_202609``; 2371 application
status events (66 with reviewer notes); every tracker event; and every role assignment. These
tests reproduce that probe and require it to see nothing.

Each test runs in the owner's always-rolled-back transaction (``conn``) and then drops to the app
role with ``SET LOCAL ROLE`` — the same NOBYPASSRLS role the backend connects as — so no password
is provisioned and nothing is committed.

The last test is the gate that stops this recurring: every table the app can read without RLS
must be on an explicit reference-data allowlist, so a new sensitive table cannot be forgotten the
way three were.
"""

from __future__ import annotations

from datetime import date

import psycopg
import pytest

from app.db import cuid, integrity, partitions
from app.db._ops import PARTITIONED_TABLES, partition_name
from tests.db import helpers

STAFF = "ADMIN_REVIEWER"


def _as_app(conn: psycopg.Connection, *, user_id: str, role: str) -> None:
    conn.execute("SET LOCAL ROLE fundslink_app")
    conn.execute(
        "SELECT set_config('app.user_id', %s, true), set_config('app.user_role', %s, true)",
        (user_id, role),
    )


def _as_owner(conn: psycopg.Connection) -> None:
    conn.execute("RESET ROLE")


def _count(conn: psycopg.Connection, sql: str, params: tuple = ()) -> int:
    return conn.execute(sql, params).fetchone()[0]


@pytest.fixture
def world(conn):
    """Two students, each with an application (with a reviewer note) and a tracker event."""
    owner = helpers.insert_profile(conn)
    stranger = helpers.insert_profile(conn)
    reviewer = helpers.insert_user(conn)
    app_id = helpers.insert_application(conn, profile_id=owner)
    conn.execute(
        "INSERT INTO application_status_event"
        "(id, application_id, from_status, to_status, actor_user_id, note)"
        " VALUES (%s, %s, 'DRAFT', 'SUBMITTED', %s, 'reviewer note: household income unclear')",
        (cuid(), app_id, reviewer),
    )
    tracked = helpers.insert_tracked(
        conn, profile_id=owner, bursary_id=helpers.insert_bursary(conn)
    )
    conn.execute(
        "INSERT INTO tracked_status_event"
        "(id, tracked_application_id, from_status, to_status, source, actor_user_id)"
        " VALUES (%s, %s, NULL, 'REGISTERED', 'SELF_REPORT', %s)",
        (cuid(), tracked, owner),
    )
    conn.execute(
        "INSERT INTO user_role(id, user_id, role_id) SELECT %s, %s, id FROM role WHERE code = %s",
        (cuid(), reviewer, STAFF),
    )
    conn.execute(
        "INSERT INTO audit_log(id, actor_user_id, action, resource_type, request_id, detail)"
        " VALUES (%s, %s, 'AUTH_REGISTER', 'user', %s, %s)",
        (cuid(), owner, cuid(), '{"email": "owner@fundslink.test"}'),
    )
    return {
        "owner": owner, "stranger": stranger, "reviewer": reviewer,
        "app": app_id, "tracked": tracked,
    }


# ---------- 1. partitions: the direct route around every parent policy ----------


def test_no_partition_is_reachable_by_the_app_role(conn, world):
    partition = partition_name("audit_log", date.today().replace(day=1))
    _as_app(conn, user_id=world["stranger"], role="STUDENT")
    # The parent still works — and still hides the owner's row from a stranger.
    assert _count(conn, "SELECT count(*) FROM audit_log WHERE actor_user_id = %s",
                  (world["owner"],)) == 0
    # Naming the partition is refused outright, not merely filtered.
    with pytest.raises(psycopg.errors.InsufficientPrivilege):
        conn.execute(f"SELECT count(*) FROM {partition}")


@pytest.mark.parametrize("table", PARTITIONED_TABLES)
def test_every_partitioned_table_seals_every_partition(conn, table):
    partitions_of = conn.execute(
        "SELECT c.relname, c.relrowsecurity,"
        " has_table_privilege('fundslink_app', c.oid, 'SELECT, INSERT, UPDATE, DELETE'),"
        " has_table_privilege('fundslink_readonly', c.oid, 'SELECT')"
        " FROM pg_inherits i JOIN pg_class c ON c.oid = i.inhrelid"
        " WHERE i.inhparent = %s::regclass",
        (table,),
    ).fetchall()
    assert len(partitions_of) >= 13, f"{table}: expected a year of partitions, found none to check"
    reachable = [name for name, rls, app, ro in partitions_of if app or ro or not rls]
    assert reachable == []


def test_writes_through_the_parent_still_route_into_a_sealed_partition(conn, world):
    # The app never needs a privilege on a partition: tuple routing checks the parent.
    _as_app(conn, user_id=world["owner"], role="STUDENT")
    conn.execute(
        "INSERT INTO audit_log(id, actor_user_id, action, resource_type, request_id)"
        " VALUES (%s, %s, 'PROFILE_UPDATE', 'student_profile', %s)",
        (cuid(), world["owner"], cuid()),
    )


def test_maintenance_seals_a_partition_it_creates(conn):
    # A year past the current horizon: default privileges grant the app roles on it at CREATE.
    future = date(date.today().year + 3, 1, 1)
    created = partitions.ensure_partitions(conn, today=future, months_ahead=0)
    assert created, "the test needs a partition that did not exist yet"
    for name in created:
        # A savepoint per probe: a refused statement aborts it, not the partitions just created.
        with pytest.raises(psycopg.errors.InsufficientPrivilege), conn.transaction():
            _as_app(conn, user_id="anyone", role="STUDENT")
            conn.execute(f"SELECT 1 FROM {name} LIMIT 1")


def test_integrity_job_fails_when_a_partition_is_reachable(conn):
    assert integrity.check_partition_seal(conn).ok
    partition = partition_name("application_status_event", date.today().replace(day=1))
    conn.execute(f"GRANT SELECT ON {partition} TO fundslink_app")
    result = integrity.check_partition_seal(conn)
    assert not result.ok
    assert partition in result.detail


# ---------- 2a. application_status_event ----------


def test_stranger_cannot_read_another_students_application_history(conn, world):
    _as_app(conn, user_id=world["stranger"], role="STUDENT")
    assert _count(conn, "SELECT count(*) FROM application_status_event") == 0
    assert _count(conn, "SELECT count(*) FROM application_status_event WHERE note IS NOT NULL") == 0


def test_owner_reads_their_own_history_and_staff_read_all(conn, world):
    _as_app(conn, user_id=world["owner"], role="STUDENT")
    assert _count(conn, "SELECT count(*) FROM application_status_event WHERE application_id = %s",
                  (world["app"],)) == 1
    _as_app(conn, user_id=world["reviewer"], role=STAFF)
    assert _count(conn, "SELECT count(*) FROM application_status_event WHERE application_id = %s",
                  (world["app"],)) == 1


def test_non_staff_roles_are_not_staff(conn, world):
    for role in ("COUNSELLOR", "DONOR", "INSTITUTION_OFFICER", "GRADUATE"):
        _as_app(conn, user_id=world["stranger"], role=role)
        assert _count(conn, "SELECT count(*) FROM application_status_event") == 0, role


def test_owner_records_their_own_action_on_their_own_application(conn, world):
    _as_app(conn, user_id=world["owner"], role="STUDENT")
    helpers.insert_status_event(
        conn, application_id=world["app"], actor_user_id=world["owner"],
        from_status="SUBMITTED", to_status="WITHDRAWN",
    )


@pytest.mark.parametrize("who", ["stranger_on_other_app", "owner_as_someone_else"])
def test_a_student_cannot_forge_history(conn, world, who):
    user, actor = (
        (world["stranger"], world["stranger"]) if who == "stranger_on_other_app"
        else (world["owner"], world["reviewer"])
    )
    _as_app(conn, user_id=user, role="STUDENT")
    with pytest.raises(psycopg.errors.InsufficientPrivilege):
        helpers.insert_status_event(
            conn, application_id=world["app"], actor_user_id=actor,
            from_status="SUBMITTED", to_status="WITHDRAWN",
        )


# ---------- 2b. tracked_status_event ----------

TRACKER_EVENTS = "SELECT count(*) FROM tracked_status_event WHERE tracked_application_id = %s"


def test_tracker_events_are_owner_or_staff_only(conn, world):
    _as_app(conn, user_id=world["stranger"], role="STUDENT")
    assert _count(conn, "SELECT count(*) FROM tracked_status_event") == 0
    _as_app(conn, user_id=world["owner"], role="STUDENT")
    assert _count(conn, TRACKER_EVENTS, (world["tracked"],)) == 1
    _as_app(conn, user_id="SYSTEM", role="SYSTEM")
    assert _count(conn, TRACKER_EVENTS, (world["tracked"],)) == 1


def test_a_stranger_cannot_write_to_someone_elses_tracker(conn, world):
    _as_app(conn, user_id=world["stranger"], role="STUDENT")
    with pytest.raises(psycopg.errors.InsufficientPrivilege):
        conn.execute(
            "INSERT INTO tracked_status_event"
            "(id, tracked_application_id, from_status, to_status, source, actor_user_id)"
            " VALUES (%s, %s, 'REGISTERED', 'SUBMITTED', 'SELF_REPORT', %s)",
            (cuid(), world["tracked"], world["stranger"]),
        )


# ---------- 2c. user_role ----------


def test_a_student_cannot_list_who_the_admins_are(conn, world):
    _as_app(conn, user_id=world["stranger"], role="STUDENT")
    assert _count(conn, "SELECT count(*) FROM user_role WHERE user_id <> %s",
                  (world["stranger"],)) == 0


def test_login_under_system_reads_roles_and_a_user_reads_their_own(conn, world):
    _as_app(conn, user_id="SYSTEM", role="SYSTEM")
    assert _count(conn, "SELECT count(*) FROM user_role WHERE user_id = %s",
                  (world["reviewer"],)) == 1
    _as_app(conn, user_id=world["reviewer"], role=STAFF)
    assert _count(conn, "SELECT count(*) FROM user_role WHERE user_id = %s",
                  (world["reviewer"],)) == 1


def test_a_student_cannot_grant_themselves_a_role(conn, world):
    _as_app(conn, user_id=world["stranger"], role="STUDENT")
    with pytest.raises(psycopg.errors.InsufficientPrivilege):
        conn.execute(
            "INSERT INTO user_role(id, user_id, role_id)"
            " SELECT %s, %s, id FROM role WHERE code = 'ADMIN_AUTHORIZER'",
            (cuid(), world["stranger"]),
        )


# ---------- the gate: nothing new is forgotten ----------

# Tables the app may read with no RLS, because every row is meant for every signed-in user:
# lookups, the RBAC matrix, configuration, and the public bursary catalogue. Anything else
# without RLS fails this test — add a policy, or argue it onto this list in review.
REFERENCE_TABLES = {
    "alembic_version", "app_status_transition", "tracked_status_transition",
    "config", "config_history", "eligibility_ruleset",
    "external_bursary", "bursary_deadline",
    "role", "permission", "role_permission",
}


def test_every_table_without_rls_is_reference_data(conn):
    _as_owner(conn)
    unprotected = {
        name for (name,) in conn.execute(
            "SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace"
            " WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relispartition"
            "   AND NOT c.relrowsecurity"
            "   AND (has_table_privilege('fundslink_app', c.oid, 'SELECT')"
            "        OR has_table_privilege('fundslink_readonly', c.oid, 'SELECT'))"
        ).fetchall()
        if not name.startswith("lk_")
    }
    assert unprotected - REFERENCE_TABLES == set()
