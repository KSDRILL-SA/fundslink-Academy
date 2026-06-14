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


# --- 0003 domain CHECKs (DB-D9): every status column constrained ---


def test_ck_document_av_status(conn):
    pid = helpers.insert_profile(conn)
    with _expect_check(conn), conn.transaction():
        conn.execute(
            "INSERT INTO document(id, student_profile_id, doc_type, storage_uri, sha256, av_status)"
            " VALUES (%s, %s, 'ID_DOCUMENT', 's3://x', 'abc', 'BOGUS')",
            (cuid(), pid),
        )


def test_ck_student_level(conn):
    uid = helpers.insert_user(conn)
    with _expect_check(conn), conn.transaction():
        conn.execute(
            "INSERT INTO student_profile(id, first_name, last_name, level, field_of_study)"
            " VALUES (%s, 'A', 'B', 'BOGUS', 'CS')",
            (uid,),
        )


def test_ck_bursary_deadline_type(conn):
    bid = helpers.insert_bursary(conn)
    with _expect_check(conn), conn.transaction():
        conn.execute(
            "INSERT INTO bursary_deadline(id, external_bursary_id, deadline_type, due_on)"
            " VALUES (%s, %s, 'BOGUS', '2026-12-01')",
            (cuid(), bid),
        )
