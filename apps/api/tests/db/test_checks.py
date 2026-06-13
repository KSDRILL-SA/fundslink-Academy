"""CHECK constraints — DB-D9/DB-D18 (named, multi-column rules in the database)."""

import psycopg
import pytest

from app.db import cuid
from tests.db import helpers


def _expect_check(conn):
    return pytest.raises(psycopg.errors.CheckViolation)


def test_ck_app_dates(conn):
    pid = helpers.insert_profile(conn)
    with _expect_check(conn), conn.transaction():
        helpers.insert_application(
            conn, profile_id=pid, funding_start="2026-12-01", funding_end="2026-01-01"
        )


def test_requested_amount_must_be_positive(conn):
    pid = helpers.insert_profile(conn)
    with _expect_check(conn), conn.transaction():
        helpers.insert_application(conn, profile_id=pid, requested_amount="-5.00")


def test_ck_appeal_different_human(conn):
    aid = helpers.insert_application(conn)
    decider = helpers.insert_user(conn)
    with _expect_check(conn), conn.transaction():
        conn.execute(
            "INSERT INTO appeal"
            "(id, application_id, new_information, original_decider_id, reviewed_by)"
            " VALUES (%s, %s, 'new facts', %s, %s)",
            (cuid(), aid, decider, decider),
        )


def test_match_score_within_unit_interval(conn):
    pid = helpers.insert_profile(conn)
    bid = helpers.insert_bursary(conn)
    with _expect_check(conn), conn.transaction():
        conn.execute(
            "INSERT INTO match_result(id, student_profile_id, external_bursary_id, score,"
            " model_version, prompt_version) VALUES (%s, %s, %s, %s, %s, %s)",
            (cuid(), pid, bid, "1.5000", "m1", "p1"),
        )


def test_match_mode_constrained(conn):
    pid = helpers.insert_profile(conn)
    bid = helpers.insert_bursary(conn)
    with _expect_check(conn), conn.transaction():
        conn.execute(
            "INSERT INTO match_result(id, student_profile_id, external_bursary_id, score,"
            " model_version, prompt_version, mode) VALUES (%s, %s, %s, %s, %s, %s, %s)",
            (cuid(), pid, bid, "0.5000", "m1", "p1", "BOGUS"),
        )


def test_outbox_state_constrained(conn):
    uid = helpers.insert_user(conn)
    with _expect_check(conn), conn.transaction():
        conn.execute(
            "INSERT INTO notification_outbox(id, user_id, trigger, channels, payload, state)"
            " VALUES (%s, %s, 'DECISION_APPROVED', %s, '{}', 'BOGUS')",
            (cuid(), uid, ["email"]),
        )


def test_pre_screen_outcome_constrained(conn):
    aid = helpers.insert_application(conn)
    with _expect_check(conn), conn.transaction():
        conn.execute(
            "INSERT INTO pre_screen_result(id, application_id, ruleset_id, outcome, checks)"
            " VALUES (%s, %s, 'ers_postgrad_v1', 'BOGUS', '{}')",
            (cuid(), aid),
        )


def test_application_return_cycle_must_be_positive(conn):
    aid = helpers.insert_application(conn)
    with _expect_check(conn), conn.transaction():
        conn.execute(
            "INSERT INTO application_return(id, application_id, cycle_no, fix_list)"
            " VALUES (%s, %s, 0, '[]')",
            (cuid(), aid),
        )
