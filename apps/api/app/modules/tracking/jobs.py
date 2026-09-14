"""Tracking scheduled jobs — deadline reminders (BR-T05) + silence follow-ups (BR-T06).

Both enqueue notification_outbox rows (BR-N01) and so run under SYSTEM RLS context (outbox inserts
are staff-only). Invoked on a schedule: ``python -m app.modules.tracking.jobs``. The notification
workers (module 6) drain the outbox; consent/preference filtering happens at send time there.

The lead time and the follow-up cadence are read from ``config`` (DB-D24), not written into this
file. Both are judgements about how often it is right to nudge a student who is waiting on someone
else, and CLAUDE.md is explicit that a business value like that must be changeable without a
deploy. The previous literals remain as the fallback, so a database whose migrations have not run
behaves exactly as before rather than sending nothing.
"""

from __future__ import annotations

import asyncio

from app.db.config import ConfigRepository
from app.db.context import set_system_context
from app.db.engine import get_session_factory
from app.modules.application.repository import OutboxRepository
from app.modules.tracking.repository import ReminderScanRepository

DEADLINE_LEAD_DAYS_KEY = "tracked_deadline_lead_days"
DEADLINE_LEAD_DAYS_DEFAULT = 3  # the T-3 reminder (BR-T05)
SILENCE_DAYS_KEY = "tracked_silence_days"
SILENCE_DAYS_DEFAULT = (30, 45, 60)  # the follow-up cadence (BR-T06)


async def run_deadline_reminders(session, *, lead_days: int | None = None) -> int:
    """Remind about bursary deadlines ``lead_days`` out. ``None`` ⇒ read the config value."""
    if lead_days is None:
        lead_days = await ConfigRepository(session).get_int(
            DEADLINE_LEAD_DAYS_KEY, DEADLINE_LEAD_DAYS_DEFAULT
        )
    scan = ReminderScanRepository(session)
    outbox = OutboxRepository(session)
    rows = await scan.deadlines_due_in(lead_days)
    for tracked_id, student_id, due_on in rows:
        await outbox.enqueue(
            user_id=student_id,
            trigger="TRACKED_DEADLINE_REMINDER",
            payload={"tracked_application_id": tracked_id, "due_on": due_on.isoformat(),
                     "lead_days": lead_days},
        )
    return len(rows)


async def run_silence_followups(session, *, silence_days: tuple[int, ...] | None = None) -> int:
    """Follow up on tracked applications that have gone quiet. ``None`` ⇒ read the config value."""
    if silence_days is None:
        silence_days = await ConfigRepository(session).get_int_list(
            SILENCE_DAYS_KEY, SILENCE_DAYS_DEFAULT
        )
    scan = ReminderScanRepository(session)
    outbox = OutboxRepository(session)
    enqueued = 0
    for days in silence_days:
        for tracked_id, student_id in await scan.silent_for(days):
            await outbox.enqueue(
                user_id=student_id,
                trigger="TRACKED_FOLLOW_UP",
                payload={"tracked_application_id": tracked_id, "silent_days": days},
            )
            enqueued += 1
    return enqueued


async def _main() -> None:
    async with get_session_factory()() as session:
        await set_system_context(session)
        deadlines = await run_deadline_reminders(session)
        silences = await run_silence_followups(session)
        await session.commit()
    print(f"tracking jobs: {deadlines} deadline reminder(s), {silences} silence follow-up(s)")


def main() -> None:
    asyncio.run(_main())


if __name__ == "__main__":
    main()
