"""updated_at auto-stamp coverage (migration 0008).

Every mutable table must advance updated_at on UPDATE. We force an ancient updated_at and
assert the trigger overrides it with the current timestamp.
"""

from app.db import cuid
from tests.db import helpers


def test_document_updated_at_autostamps(conn):
    pid = helpers.insert_profile(conn)
    did = cuid()
    conn.execute(
        "INSERT INTO document(id,student_profile_id,doc_type,storage_uri,sha256)"
        " VALUES (%s,%s,'ID_DOCUMENT','s3://x','h')",
        (did, pid),
    )
    conn.execute(
        "UPDATE document SET updated_at='2000-01-01', av_status='CLEAN' WHERE id=%s", (did,)
    )
    row = conn.execute("SELECT updated_at FROM document WHERE id=%s", (did,)).fetchone()
    assert row[0].year >= 2020, "touch trigger must override updated_at with now()"


def test_notification_preference_updated_at_autostamps(conn):
    uid = helpers.insert_user(conn)
    nid = cuid()
    conn.execute("INSERT INTO notification_preference(id,user_id) VALUES (%s,%s)", (nid, uid))
    conn.execute(
        "UPDATE notification_preference SET updated_at='2000-01-01', per_trigger='{\"x\":1}'"
        " WHERE id=%s",
        (nid,),
    )
    row = conn.execute(
        "SELECT updated_at FROM notification_preference WHERE id=%s", (nid,)
    ).fetchone()
    assert row[0].year >= 2020


def test_config_updated_at_autostamps(conn):
    conn.execute("INSERT INTO config(key,value) VALUES ('touch_probe','1')")
    conn.execute("UPDATE config SET updated_at='2000-01-01', value='2' WHERE key='touch_probe'")
    row = conn.execute("SELECT updated_at FROM config WHERE key='touch_probe'").fetchone()
    assert row[0].year >= 2020
