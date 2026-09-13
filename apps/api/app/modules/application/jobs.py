"""Application scheduled jobs — return reminders (D-006 · completeness audit G3 · #298).

A RETURNED_FOR_INFO application carries ``respond_by``, and D-006 says the student is reminded,
never punished. Until this job, nothing reminded anyone: a returned application waited in silence
until the student happened to sign in.

Two reminders per return, each sent at most once:

* ``BEFORE_DUE`` — once the return is within ``return_reminder_lead_days`` (config) of respond_by;
* ``AFTER_DUE`` — once respond_by has passed and nothing has been sent back.

Neither changes the application. There is no expiry, no status move and no penalty: the "don't
punish" half of D-006 is kept by this job doing nothing but writing to the outbox. A return that
has been resolved (the student resubmitted) or an application no longer RETURNED_FOR_INFO is never
reminded.

Enqueues ``notification_outbox`` rows (BR-N01) under SYSTEM RLS context (outbox inserts are
staff-only); the notification worker delivers them with the student's preferences and consents.
Run daily: ``python -m app.modules.application.jobs``.
"""

from __future__ import annotations

import asyncio

from app.db.context import set_system_context
from app.db.engine import get_session_factory
from app.modules.application.repository import OutboxRepository, ReturnReminderScanRepository

TRIGGER = "APPLICATION_RETURN_REMINDER"


async def run_return_reminders(session) -> dict[str, int]:
    scan = ReturnReminderScanRepository(session)
    outbox = OutboxRepository(session)
    counts = {"before_due": 0, "after_due": 0}
    for kind, rows in (("BEFORE_DUE", await scan.due_soon()), ("AFTER_DUE", await scan.past_due())):
        for return_id, application_id, student_id, respond_by in rows:
            await outbox.enqueue(
                user_id=student_id,
                trigger=TRIGGER,
                payload={
                    "application_id": application_id,
                    "return_id": return_id,
                    "respond_by": respond_by.isoformat(),
                    "kind": kind,
                },
            )
            counts["before_due" if kind == "BEFORE_DUE" else "after_due"] += 1
    return counts


async def _main() -> None:
    async with get_session_factory()() as session:
        await set_system_context(session)
        counts = await run_return_reminders(session)
        await session.commit()
    print(
        f"application jobs: {counts['before_due']} reminder(s) before respond-by, "
        f"{counts['after_due']} after it passed"
    )


def main() -> None:
    asyncio.run(_main())


if __name__ == "__main__":
    main()
