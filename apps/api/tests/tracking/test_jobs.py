"""Scheduled tracking jobs — deadline reminders (BR-T05) + silence follow-ups (BR-T06).

Seeds directly via SQL and runs each job on a fresh async engine bound to the test's event loop
(SYSTEM context); asserts the notification_outbox rows it enqueues (BR-N01).

The lead time and the cadence are config values (DB-D24, #311), so two of these tests change the
config row and prove the job's behaviour changes with it — a value "read from config" that the
code ignores looks identical to a hardcoded one until someone changes it in production.
"""

from __future__ import annotations

import os
import uuid

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.db.context import set_system_context
from app.modules.tracking.jobs import run_deadline_reminders, run_silence_followups


def _seed_tracked(admin_conn, *, status="REGISTERED", silent_days=0, deadline_days=None):
    uid, bid, tid = (f"{p}_{uuid.uuid4().hex}" for p in ("u", "eb", "ta"))
    admin_conn.execute(
        'INSERT INTO "user" (id, email, password_hash, account_state, created_by)'
        " VALUES (%s, %s, '!x', 'ACTIVE', 'SYSTEM')",
        (uid, f"{uid}@x.io"),
    )
    admin_conn.execute(
        "INSERT INTO student_profile (id, first_name, last_name, level, field_of_study, created_by)"
        " VALUES (%s, 'A', 'B', 'UG', 'Law', %s)",
        (uid, uid),
    )
    admin_conn.execute(
        "INSERT INTO external_bursary (id, name, provider, level_eligibility, field_tags, status,"
        " created_by) VALUES (%s, 'B', 'P', %s, %s, 'OPEN', 'SYSTEM')",
        (bid, ["UG"], ["law"]),
    )
    if deadline_days is not None:
        admin_conn.execute(
            "INSERT INTO bursary_deadline (id, external_bursary_id, deadline_type, due_on)"
            " VALUES (%s, %s, 'APPLICATION', CURRENT_DATE + %s)",
            (f"bd_{uuid.uuid4().hex}", bid, deadline_days),
        )
    admin_conn.execute(
        "INSERT INTO tracked_application (id, student_profile_id, external_bursary_id, status,"
        " last_activity_at, created_by)"
        " VALUES (%s, %s, %s, %s, now() - make_interval(days => %s), %s)",
        (tid, uid, bid, status, silent_days, uid),
    )
    return uid, tid


async def _run(job):
    engine = create_async_engine(os.environ["DATABASE_URL"])
    try:
        async with async_sessionmaker(engine)() as session:
            await set_system_context(session)
            count = await job(session)
            await session.commit()
        return count
    finally:
        await engine.dispose()


def _outbox(admin_conn, uid, trigger):
    return admin_conn.execute(
        "SELECT 1 FROM notification_outbox WHERE user_id = %s AND trigger = %s", (uid, trigger)
    ).fetchone()


async def test_t3_deadline_reminder_enqueues_outbox_br_t05(admin_conn):
    uid, _ = _seed_tracked(admin_conn, deadline_days=3)  # T-3
    count = await _run(run_deadline_reminders)
    assert count >= 1
    assert _outbox(admin_conn, uid, "TRACKED_DEADLINE_REMINDER") is not None


async def test_deadline_reminder_skips_inactive_applications_br_t05(admin_conn):
    uid, _ = _seed_tracked(admin_conn, status="WITHDRAWN", deadline_days=3)
    await _run(run_deadline_reminders)
    assert _outbox(admin_conn, uid, "TRACKED_DEADLINE_REMINDER") is None  # withdrawn → no reminder


async def test_silence_followup_enqueues_at_30_days_br_t06(admin_conn):
    uid, _ = _seed_tracked(admin_conn, silent_days=30)
    count = await _run(run_silence_followups)
    assert count >= 1
    assert _outbox(admin_conn, uid, "TRACKED_FOLLOW_UP") is not None


async def test_silence_followup_ignores_recently_active_br_t06(admin_conn):
    uid, _ = _seed_tracked(admin_conn, silent_days=2)  # active 2 days ago — not a 30/45/60 hit
    await _run(run_silence_followups)
    assert _outbox(admin_conn, uid, "TRACKED_FOLLOW_UP") is None


def _config(admin_conn, key):
    return admin_conn.execute("SELECT value FROM config WHERE key = %s", (key,)).fetchone()[0]


def _set_config(admin_conn, key, value):
    admin_conn.execute("UPDATE config SET value = %s WHERE key = %s", (value, key))


async def test_the_deadline_lead_time_is_read_from_config_br_t05(admin_conn):
    before = _config(admin_conn, "tracked_deadline_lead_days")
    assert before == "3"
    far, _ = _seed_tracked(admin_conn, deadline_days=7)
    await _run(run_deadline_reminders)
    assert _outbox(admin_conn, far, "TRACKED_DEADLINE_REMINDER") is None  # T-7, lead is 3

    _set_config(admin_conn, "tracked_deadline_lead_days", "7")
    try:
        near, _ = _seed_tracked(admin_conn, deadline_days=3)
        await _run(run_deadline_reminders)
        # The same application that was ignored a moment ago is now reminded, and the one at T-3
        # is not — the job read the row, it did not keep its own number.
        assert _outbox(admin_conn, far, "TRACKED_DEADLINE_REMINDER") is not None
        assert _outbox(admin_conn, near, "TRACKED_DEADLINE_REMINDER") is None
    finally:
        _set_config(admin_conn, "tracked_deadline_lead_days", before)


async def test_the_silence_cadence_is_read_from_config_br_t06(admin_conn):
    before = _config(admin_conn, "tracked_silence_days")
    assert before == "30,45,60"
    quiet, _ = _seed_tracked(admin_conn, silent_days=14)
    await _run(run_silence_followups)
    assert _outbox(admin_conn, quiet, "TRACKED_FOLLOW_UP") is None  # 14 is not in 30/45/60

    _set_config(admin_conn, "tracked_silence_days", "14,28")
    try:
        await _run(run_silence_followups)
        assert _outbox(admin_conn, quiet, "TRACKED_FOLLOW_UP") is not None
    finally:
        _set_config(admin_conn, "tracked_silence_days", before)


async def test_a_broken_cadence_falls_back_instead_of_following_up_with_nobody(admin_conn):
    """A scheduled job cannot report a bad config value to anyone: an exception is a silent night
    and an empty list is a student nobody follows up on, and both look like "nothing was due"."""
    before = _config(admin_conn, "tracked_silence_days")
    at_thirty, _ = _seed_tracked(admin_conn, silent_days=30)
    for broken in ("", "thirty,forty-five", "30;45;60", "-30,45", "0"):
        _set_config(admin_conn, "tracked_silence_days", broken)
        try:
            await _run(run_silence_followups)
            assert _outbox(admin_conn, at_thirty, "TRACKED_FOLLOW_UP") is not None, broken
        finally:
            _set_config(admin_conn, "tracked_silence_days", before)
        admin_conn.execute(
            "DELETE FROM notification_outbox WHERE user_id = %s AND trigger = 'TRACKED_FOLLOW_UP'",
            (at_thirty,),
        )
