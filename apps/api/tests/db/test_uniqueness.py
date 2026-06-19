"""Uniqueness constraints — DB-D8 (candidate keys declared UNIQUE)."""

import psycopg
import pytest

from app.db import cuid
from tests.db import helpers


def _expect_unique(conn):
    return pytest.raises(psycopg.errors.UniqueViolation)


def test_uq_user_idnum(conn):
    helpers.insert_user(conn, blind_idx="hmac-abc")
    with _expect_unique(conn), conn.transaction():
        helpers.insert_user(conn, blind_idx="hmac-abc")


def test_uq_user_email_case_insensitive(conn):
    helpers.insert_user(conn, email="Student@Fundslink.test")
    with _expect_unique(conn), conn.transaction():
        helpers.insert_user(conn, email="student@fundslink.test")


def test_uq_user_email_allows_reuse_after_soft_delete(conn):
    # Partial unique index (WHERE deleted_at IS NULL) — a soft-deleted row frees the email.
    uid = helpers.insert_user(conn, email="reuse@fundslink.test")
    conn.execute('UPDATE "user" SET deleted_at = now() WHERE id = %s', (uid,))
    helpers.insert_user(conn, email="reuse@fundslink.test")  # no exception


def test_uq_app_active_per_year(conn):
    pid = helpers.insert_profile(conn)
    helpers.insert_application(conn, profile_id=pid, academic_year="2026", status="SUBMITTED")
    with _expect_unique(conn), conn.transaction():
        helpers.insert_application(conn, profile_id=pid, academic_year="2026", status="DRAFT")


def test_uq_app_active_per_year_partial_escape(conn):
    # A terminal application (REJECTED) does not block a fresh active one for the same year.
    pid = helpers.insert_profile(conn)
    helpers.insert_application(conn, profile_id=pid, academic_year="2026", status="REJECTED")
    helpers.insert_application(conn, profile_id=pid, academic_year="2026", status="DRAFT")


def test_uq_app_active_blocks_approved_duplicate(conn):
    # 0003: APPROVED now counts as active — a funded student cannot open a duplicate same-year app.
    pid = helpers.insert_profile(conn)
    helpers.insert_application(conn, profile_id=pid, academic_year="2026", status="APPROVED")
    with _expect_unique(conn), conn.transaction():
        helpers.insert_application(conn, profile_id=pid, academic_year="2026", status="DRAFT")


def test_uq_tracked_pair(conn):
    pid = helpers.insert_profile(conn)
    bid = helpers.insert_bursary(conn)
    helpers.insert_tracked(conn, profile_id=pid, bursary_id=bid)
    with _expect_unique(conn), conn.transaction():
        helpers.insert_tracked(conn, profile_id=pid, bursary_id=bid)


def test_uq_match(conn):
    pid = helpers.insert_profile(conn)
    bid = helpers.insert_bursary(conn)

    def add_match(model_version):
        conn.execute(
            "INSERT INTO match_result(id, student_profile_id, external_bursary_id, score,"
            " model_version, prompt_version) VALUES (%s, %s, %s, %s, %s, %s)",
            (cuid(), pid, bid, "0.5000", model_version, "p1"),
        )

    add_match("m1")
    # one match per (student, bursary): a different model_version (LIVE vs FALLBACK) still collides
    with _expect_unique(conn), conn.transaction():
        add_match("m2")


def test_uq_user_role(conn):
    uid = helpers.insert_user(conn)

    def grant():
        conn.execute(
            "INSERT INTO user_role(id, user_id, role_id) VALUES (%s, %s, 'rol_student')",
            (cuid(), uid),
        )

    grant()
    with _expect_unique(conn), conn.transaction():
        grant()


def test_uq_role_perm_seeded(conn):
    with _expect_unique(conn), conn.transaction():
        conn.execute(
            "INSERT INTO role_permission(id, role_id, permission_id)"
            " SELECT %s, role_id, permission_id FROM role_permission LIMIT 1",
            (cuid(),),
        )


def test_uq_ruleset_seeded(conn):
    with _expect_unique(conn), conn.transaction():
        conn.execute(
            "INSERT INTO eligibility_ruleset(id, application_type, version, rules, effective_from)"
            " VALUES (%s, 'POSTGRAD', 1, '{}', now())",
            (cuid(),),
        )


def test_application_motivation_is_one_to_one(conn):
    aid = helpers.insert_application(conn, app_type="OTHER")

    def add_motivation():
        conn.execute(
            "INSERT INTO application_motivation(id, application_id, situation, why_not_categories,"
            " support_needed) VALUES (%s, %s, 'x', 'y', 'z')",
            (cuid(), aid),
        )

    add_motivation()
    with _expect_unique(conn), conn.transaction():
        add_motivation()
