"""Migration 0004 — application lifecycle (priority, post-approval, doc validity, language)."""

import psycopg
import pytest

from app.db import cuid
from tests.db import helpers


def test_priority_fk_rejects_unknown(conn):
    pid = helpers.insert_profile(conn)
    with pytest.raises(psycopg.errors.ForeignKeyViolation), conn.transaction():
        helpers.insert_application(conn, profile_id=pid, priority="BOGUS")


def test_priority_defaults_to_normal(conn):
    aid = helpers.insert_application(conn)
    row = conn.execute("SELECT priority FROM funding_application WHERE id=%s", (aid,)).fetchone()
    assert row[0] == "NORMAL"


def test_lk_priority_is_rank_ordered(conn):
    rows = conn.execute("SELECT code FROM lk_priority ORDER BY rank").fetchall()
    assert [r[0] for r in rows] == ["NORMAL", "URGENT", "CRITICAL"]


def test_completed_application_frees_the_year(conn):
    # COMPLETED is terminal — a new active application for the same year is allowed.
    pid = helpers.insert_profile(conn)
    helpers.insert_application(conn, profile_id=pid, academic_year="2026", status="COMPLETED")
    helpers.insert_application(conn, profile_id=pid, academic_year="2026", status="DRAFT")


def test_suspended_application_still_blocks_duplicate(conn):
    # SUSPENDED funding is still active enough to block a duplicate same-year application.
    pid = helpers.insert_profile(conn)
    helpers.insert_application(conn, profile_id=pid, academic_year="2026", status="SUSPENDED")
    with pytest.raises(psycopg.errors.UniqueViolation), conn.transaction():
        helpers.insert_application(conn, profile_id=pid, academic_year="2026", status="DRAFT")


def test_document_validity_window(conn):
    pid = helpers.insert_profile(conn)
    with pytest.raises(psycopg.errors.CheckViolation), conn.transaction():
        conn.execute(
            "INSERT INTO document(id, student_profile_id, doc_type, storage_uri, sha256,"
            " issued_at, valid_until)"
            " VALUES (%s, %s, 'ID_DOCUMENT', 's3://x', 'abc', '2026-12-01', '2026-01-01')",
            (cuid(), pid),
        )


def test_preferred_language_rejects_non_sa(conn):
    uid = helpers.insert_user(conn)
    with pytest.raises(psycopg.errors.CheckViolation), conn.transaction():
        conn.execute(
            "INSERT INTO student_profile(id, first_name, last_name, level, field_of_study,"
            " preferred_language) VALUES (%s, 'A', 'B', 'UG', 'CS', 'klingon')",
            (uid,),
        )


def test_preferred_language_accepts_isizulu(conn):
    uid = helpers.insert_user(conn)
    conn.execute(
        "INSERT INTO student_profile(id, first_name, last_name, level, field_of_study,"
        " preferred_language) VALUES (%s, 'A', 'B', 'UG', 'CS', 'zu')",
        (uid,),
    )


def test_motivation_language_constrained(conn):
    aid = helpers.insert_application(conn, app_type="OTHER")
    with pytest.raises(psycopg.errors.CheckViolation), conn.transaction():
        conn.execute(
            "INSERT INTO application_motivation(id, application_id, situation,"
            " why_not_categories, support_needed, language)"
            " VALUES (%s, %s, 'x', 'y', 'z', 'elvish')",
            (cuid(), aid),
        )


def test_status_event_note_records_reason(conn):
    # The note column carries a transition's reason (revocation cause, rejection reason...).
    aid = helpers.insert_application(conn)
    human = helpers.insert_user(conn)
    eid = cuid()
    conn.execute(
        "INSERT INTO application_status_event(id, application_id, to_status, actor_user_id, note)"
        " VALUES (%s, %s, 'SUBMITTED', %s, 'student submitted')",
        (eid, aid, human),
    )
    row = conn.execute(
        "SELECT note FROM application_status_event WHERE id=%s", (eid,)
    ).fetchone()
    assert row[0] == "student submitted"
