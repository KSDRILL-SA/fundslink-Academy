"""Referential actions — DB-D16 (RESTRICT default; CASCADE only on auth mechanics)."""

import psycopg
import pytest

from app.db import cuid
from tests.db import helpers


def test_document_restricts_profile_delete(conn):
    # Documents are evidence — a profile with documents cannot be deleted (RESTRICT).
    pid = helpers.insert_profile(conn)
    conn.execute(
        "INSERT INTO document(id, student_profile_id, doc_type, storage_uri, sha256)"
        " VALUES (%s, %s, 'ID_DOCUMENT', 's3://x', 'abc')",
        (cuid(), pid),
    )
    with pytest.raises(psycopg.errors.ForeignKeyViolation), conn.transaction():
        conn.execute("DELETE FROM student_profile WHERE id = %s", (pid,))


def test_external_bursary_restricts_delete_when_tracked(conn):
    # A bursary disappearing must not silently erase tracking history (RESTRICT).
    pid = helpers.insert_profile(conn)
    bid = helpers.insert_bursary(conn)
    helpers.insert_tracked(conn, profile_id=pid, bursary_id=bid)
    with pytest.raises(psycopg.errors.ForeignKeyViolation), conn.transaction():
        conn.execute("DELETE FROM external_bursary WHERE id = %s", (bid,))


def test_invalid_lookup_fk_rejected(conn):
    # Status/type columns are lookup FKs — an unknown value is refused (DB-D9).
    pid = helpers.insert_profile(conn)
    with pytest.raises(psycopg.errors.ForeignKeyViolation), conn.transaction():
        helpers.insert_application(conn, profile_id=pid, app_type="NOT_A_REAL_TYPE")


def test_refresh_token_family_cascades_on_user_delete(conn):
    # Pure auth mechanics — CASCADE is the documented exception (DB-D16).
    uid = helpers.insert_user(conn)
    fam = cuid()
    conn.execute("INSERT INTO refresh_token_family(id, user_id) VALUES (%s, %s)", (fam, uid))
    conn.execute(
        "INSERT INTO refresh_token(id, family_id, token_hash, expires_at)"
        " VALUES (%s, %s, %s, now() + interval '1 day')",
        (cuid(), fam, "hash-1"),
    )
    conn.execute('DELETE FROM "user" WHERE id = %s', (uid,))
    remaining = conn.execute(
        "SELECT count(*) FROM refresh_token_family WHERE id = %s", (fam,)
    ).fetchone()[0]
    assert remaining == 0
