"""Return reminders — D-006 "remind, don't punish" (completeness audit G3, #298).

A RETURNED_FOR_INFO application carries respond_by and nothing reminded the student. These seed
returns directly, run the job on a fresh async engine (SYSTEM context) and assert the outbox rows,
the way tests/tracking/test_jobs.py does for the tracking reminders.

The windows come from config and the tests read them from config too, so they keep passing — and
keep meaning something — if the configured values change.
"""

from __future__ import annotations

import json
import os
import uuid

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.db.context import set_system_context
from app.modules.application.jobs import TRIGGER, run_return_reminders


def _config(admin_conn, key: str) -> int:
    return int(admin_conn.execute("SELECT value FROM config WHERE key = %s", (key,)).fetchone()[0])


def _returned(admin_conn, *, respond_in_days: int | None, status: str = "RETURNED_FOR_INFO",
              resolved: bool = False) -> tuple[str, str, str]:
    """A student whose application was returned, due ``respond_in_days`` from today."""
    uid, app_id, ret_id = (f"{p}_{uuid.uuid4().hex}" for p in ("u", "fa", "ar"))
    with admin_conn.transaction():
        admin_conn.execute(
            'INSERT INTO "user" (id, email, password_hash, account_state, created_by)'
            " VALUES (%s, %s, '!x', 'ACTIVE', 'SYSTEM')",
            (uid, f"{uid}@x.io"),
        )
        admin_conn.execute(
            "INSERT INTO student_profile (id, first_name, last_name, level, field_of_study,"
            " created_by) VALUES (%s, 'A', 'B', 'UG', 'Law', %s)",
            (uid, uid),
        )
        admin_conn.execute(
            "INSERT INTO funding_application (id, student_profile_id, application_type,"
            " academic_year, status) VALUES (%s, %s, 'UG_CAT_C', '2026', %s)",
            (app_id, uid, status),
        )
        # The status cache and its event together, or the integrity job reports drift (DB-D39).
        admin_conn.execute(
            "INSERT INTO application_status_event (id, application_id, to_status, actor_user_id)"
            " VALUES (%s, %s, %s, 'SYSTEM')",
            (f"ev_{uuid.uuid4().hex}", app_id, status),
        )
        admin_conn.execute(
            "INSERT INTO application_return (id, application_id, cycle_no, fix_list, respond_by,"
            " resolved_at) VALUES (%s, %s, 1, '[]',"
            " CASE WHEN %s::int IS NULL THEN NULL ELSE current_date + %s::int END,"
            " CASE WHEN %s THEN now() END)",
            (ret_id, app_id, respond_in_days, respond_in_days, resolved),
        )
    return uid, app_id, ret_id


async def _run():
    engine = create_async_engine(os.environ["DATABASE_URL"])
    try:
        async with async_sessionmaker(engine)() as session:
            await set_system_context(session)
            counts = await run_return_reminders(session)
            await session.commit()
        return counts
    finally:
        await engine.dispose()


def _reminders(admin_conn, uid: str) -> list[dict]:
    rows = admin_conn.execute(
        "SELECT payload FROM notification_outbox WHERE user_id = %s AND trigger = %s",
        (uid, TRIGGER),
    ).fetchall()
    return [r[0] if isinstance(r[0], dict) else json.loads(r[0]) for r in rows]


async def test_a_return_near_its_date_gets_one_gentle_reminder(admin_conn):
    lead = _config(admin_conn, "return_reminder_lead_days")
    uid, app_id, ret_id = _returned(admin_conn, respond_in_days=lead)

    await _run()

    assert _reminders(admin_conn, uid) == [{
        "application_id": app_id,
        "return_id": ret_id,
        "respond_by": _reminders(admin_conn, uid)[0]["respond_by"],
        "kind": "BEFORE_DUE",
    }]


async def test_running_again_never_sends_the_same_reminder_twice(admin_conn):
    lead = _config(admin_conn, "return_reminder_lead_days")
    uid, _, _ = _returned(admin_conn, respond_in_days=lead)
    await _run()
    await _run()
    assert len(_reminders(admin_conn, uid)) == 1


async def test_a_return_far_from_its_date_is_left_alone(admin_conn):
    lead = _config(admin_conn, "return_reminder_lead_days")
    uid, _, _ = _returned(admin_conn, respond_in_days=lead + 1)
    await _run()
    assert _reminders(admin_conn, uid) == []


async def test_a_missed_date_gets_one_reminder_and_no_penalty(admin_conn):
    uid, app_id, _ = _returned(admin_conn, respond_in_days=-2)
    await _run()
    await _run()

    assert [r["kind"] for r in _reminders(admin_conn, uid)] == ["AFTER_DUE"]
    # D-006: remind, never punish. The application is exactly where it was.
    status = admin_conn.execute(
        "SELECT status FROM funding_application WHERE id = %s", (app_id,)
    ).fetchone()[0]
    assert status == "RETURNED_FOR_INFO"


async def test_nothing_is_sent_once_the_student_has_responded(admin_conn):
    lead = _config(admin_conn, "return_reminder_lead_days")
    resolved_uid, _, _ = _returned(admin_conn, respond_in_days=lead, resolved=True)
    moved_uid, _, _ = _returned(admin_conn, respond_in_days=-1, status="RESUBMITTED")
    await _run()
    assert _reminders(admin_conn, resolved_uid) == []
    assert _reminders(admin_conn, moved_uid) == []


async def test_the_reminder_window_is_read_from_config(admin_conn):
    lead = _config(admin_conn, "return_reminder_lead_days")
    uid, _, _ = _returned(admin_conn, respond_in_days=lead + 2)
    admin_conn.execute(
        "UPDATE config SET value = %s WHERE key = 'return_reminder_lead_days'", (str(lead + 2),)
    )
    try:
        await _run()
    finally:
        admin_conn.execute(
            "UPDATE config SET value = %s WHERE key = 'return_reminder_lead_days'", (str(lead),)
        )
    assert [r["kind"] for r in _reminders(admin_conn, uid)] == ["BEFORE_DUE"]
