"""Tracking scheduled jobs — T-3 deadline reminders (BR-T05) + 30/45/60 silence follow-ups (BR-T06).

Both enqueue notification_outbox rows (BR-N01) and so run under SYSTEM RLS context (outbox inserts
are staff-only). Invoked on a schedule: ``python -m app.modules.tracking.jobs``. The notification
workers (module 6) drain the outbox; consent/preference filtering happens at send time there.
"""

from __future__ import annotations

import asyncio

from app.db.context import set_system_context
from app.db.engine import get_session_factory
from app.modules.application.repository import OutboxRepository
from app.modules.tracking.repository import ReminderScanRepository

DEADLINE_LEAD_DAYS = 3  # T-3 reminder (BR-T05)
SILENCE_DAYS = (30, 45, 60)  # follow-up cadence (BR-T06)


async def run_deadline_reminders(session, *, lead_days: int = DEADLINE_LEAD_DAYS) -> int:
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


async def run_silence_followups(session) -> int:
    scan = ReminderScanRepository(session)
    outbox = OutboxRepository(session)
    enqueued = 0
    for days in SILENCE_DAYS:
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
