"""Append-only guards (fn_block_mutation) — DB-D30 / DB-D21.

Every protected table must reject BOTH UPDATE and DELETE at the database layer
(defense-in-depth beyond the app role's revoked grants). Seven tables carry the guard.
"""

import psycopg
import pytest

from app.db import cuid
from tests.db import helpers


def _seed_consent(conn: psycopg.Connection) -> str:
    uid = helpers.insert_user(conn)
    cid = cuid()
    conn.execute(
        "INSERT INTO consent_record(id, user_id, purpose, wording_version)"
        " VALUES (%s, %s, %s, %s)",
        (cid, uid, "PRIVACY_POLICY", "v1"),
    )
    return cid


def _seed_app_status_event(conn: psycopg.Connection) -> str:
    aid = helpers.insert_application(conn)
    actor = helpers.insert_user(conn)
    return helpers.insert_status_event(
        conn, application_id=aid, actor_user_id=actor, to_status="SUBMITTED"
    )


def _seed_tracked_status_event(conn: psycopg.Connection) -> str:
    pid = helpers.insert_profile(conn)
    bid = helpers.insert_bursary(conn)
    tid = helpers.insert_tracked(conn, profile_id=pid, bursary_id=bid)
    eid = cuid()
    conn.execute(
        "INSERT INTO tracked_status_event(id, tracked_application_id, to_status, source)"
        " VALUES (%s, %s, %s, %s)",
        (eid, tid, "SUBMITTED", "SELF_REPORT"),
    )
    return eid


def _seed_audit_log(conn: psycopg.Connection) -> str:
    aid = cuid()
    conn.execute(
        "INSERT INTO audit_log(id, action, resource_type, request_id)"
        " VALUES (%s, %s, %s, %s)",
        (aid, "login", "user", cuid()),
    )
    return aid


def _seed_config_history(conn: psycopg.Connection) -> str:
    cid = cuid()
    conn.execute(
        "INSERT INTO config_history(id, key, new_value, effective_from, approved_by)"
        " VALUES (%s, %s, %s, now(), %s)",
        (cid, "monthly_allowance_zar", "1200.00", "founder"),
    )
    return cid


def _seed_pre_screen_result(conn: psycopg.Connection) -> str:
    aid = helpers.insert_application(conn)
    pid = cuid()
    conn.execute(
        "INSERT INTO pre_screen_result(id, application_id, ruleset_id, outcome, checks)"
        " VALUES (%s, %s, %s, %s, %s)",
        (pid, aid, "ers_postgrad_v1", "READY", "{}"),
    )
    return pid


def _seed_recusal(conn: psycopg.Connection) -> str:
    aid = helpers.insert_application(conn)
    reviewer = helpers.insert_user(conn)
    rid = cuid()
    conn.execute(
        "INSERT INTO recusal(id, application_id, reviewer_id, reason) VALUES (%s, %s, %s, %s)",
        (rid, aid, reviewer, "conflict of interest"),
    )
    return rid


# (table, seed_fn, UPDATE SET fragment)
APPEND_ONLY = [
    ("consent_record", _seed_consent, "withdrawn_at = now()"),
    ("application_status_event", _seed_app_status_event, "to_status = 'WITHDRAWN'"),
    ("tracked_status_event", _seed_tracked_status_event, "to_status = 'WITHDRAWN'"),
    ("audit_log", _seed_audit_log, "action = 'tampered'"),
    ("config_history", _seed_config_history, "new_value = 'tampered'"),
    ("pre_screen_result", _seed_pre_screen_result, "outcome = 'RETURNED'"),
    ("recusal", _seed_recusal, "reason = 'tampered'"),
]


@pytest.mark.parametrize("table, seed, set_frag", APPEND_ONLY, ids=[t[0] for t in APPEND_ONLY])
def test_update_is_blocked(conn, table, seed, set_frag):
    row_id = seed(conn)
    with pytest.raises(psycopg.errors.RaiseException):
        with conn.transaction():
            conn.execute(f"UPDATE {table} SET {set_frag} WHERE id = %s", (row_id,))


@pytest.mark.parametrize("table, seed, set_frag", APPEND_ONLY, ids=[t[0] for t in APPEND_ONLY])
def test_delete_is_blocked(conn, table, seed, set_frag):
    row_id = seed(conn)
    with pytest.raises(psycopg.errors.RaiseException):
        with conn.transaction():
            conn.execute(f"DELETE FROM {table} WHERE id = %s", (row_id,))
