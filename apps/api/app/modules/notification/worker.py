"""Notification outbox worker (TAD §7) — drains notification_outbox, concurrent-safe.

One pass: claim a batch of due PENDING rows (FOR UPDATE SKIP LOCKED — N workers never collide),
resolve the effective channels from the user's preference (BR-N02), skip any channel whose consent
the user hasn't granted (BR-N03 — skipped and logged), deliver via the channel adapters, then mark
SENT. A delivery failure is retried with exponential backoff; after MAX_ATTEMPTS the row is DEAD
and surfaced (S3.34). Runs under SYSTEM context. Single pass (test/CI/cron tick):
``python -m app.modules.notification.worker``; continuous deploy drain: add ``--loop``.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime, timedelta

from app.db.context import set_system_context
from app.db.engine import get_session_factory
from app.modules.notification.channels import CHANNEL_CONSENT, CHANNELS
from app.modules.notification.repository import (
    ConsentReadRepository,
    NotificationRepository,
    PreferenceRepository,
)

logger = logging.getLogger("fundslink.notification.worker")

MAX_ATTEMPTS = 5
_BASE_BACKOFF_SECONDS = 60


def _backoff(attempts: int) -> datetime:
    return datetime.now(UTC) + timedelta(seconds=_BASE_BACKOFF_SECONDS * (2 ** (attempts - 1)))


# Student-facing copy per trigger (the content track). Voice law: docs/experience/ux-screen-map.md
# §0 — P1 dignity first · P2 never a dead end · P4 a return is NOT a rejection · P5 humans are
# visible. No IDs/PII in any body (P3 / POPIA — the student signs in for detail); channel-agnostic
# and concise so the same warm words serve email, SMS, and in-app (P6).
_TEMPLATES: dict[str, tuple[str, str]] = {
    "APPLICATION_SUBMITTED": (
        "We've received your FundsLink application",
        "Thank you — your application is in. A person reviews every application (our system never"
        " decides that), so it's now with our team. We'll tell you the moment there's an update;"
        " you don't need to do anything right now.",
    ),
    "APPLICATION_STATUS_CHANGED": (
        "There's an update on your FundsLink application",
        "Your application has moved to its next step. Sign in to FundsLink to see where it is and"
        " what happens next — a person is looking after it.",
    ),
    "APPLICATION_RETURNED_FOR_INFO": (
        "A few small things to add to your application",
        "Your application is moving — we just need a little more to continue. There are a few small"
        " things to add or fix. Sign in to see the short list, then resubmit. This is not a"
        " decline; it's how we make your application as strong as it can be.",
    ),
    "INTERVIEW_SCHEDULED": (
        "Your FundsLink interview is scheduled",
        "An interview has been scheduled as part of your application. Sign in to see the details"
        " and confirm — if the time doesn't work, you can tell us there.",
    ),
    "DECISION_APPROVED": (
        "Good news about your FundsLink application",
        "We're glad to share that your application has been approved. Sign in for the details and"
        " next steps. Congratulations — this is a real milestone, and we're with you from here.",
    ),
    "DECISION_REJECTED": (
        "An update on your FundsLink application",
        "Thank you for applying to FundsLink. After a person carefully reviewed it, we're not able"
        " to fund your application this time. This reflects the funding available — not your worth"
        " or your potential. A few doors stay open: view bursaries matched to your profile, appeal"
        " once if you have new information, and you're welcome to apply again next intake. Sign in"
        " to see your options — we'll help you take the next step.",
    ),
    "TRACKED_DEADLINE_REMINDER": (
        "A bursary deadline is coming up",
        "Heads up — a bursary you're tracking has a deadline in a few days. Sign in to check the"
        " date and make sure your application is in on time. You've got this.",
    ),
    # D-006: remind, never punish. One message serves both reminders (before and after respond-by),
    # so it names no date and threatens nothing — the application stays open either way.
    "APPLICATION_RETURN_REMINDER": (
        "A reminder about your FundsLink application",
        "Just a reminder: your application is waiting for a few things from you before a reviewer"
        " can look at it. Sign in to see exactly what's needed. If you need more time, that's"
        " okay — your application stays open, and nothing is held against you.",
    ),
    "TRACKED_FOLLOW_UP": (
        "Still waiting to hear back?",
        "It's been a while since there was movement on a bursary you're tracking. A gentle"
        " follow-up is worth it — sign in to see which one and update its status when you hear"
        " back. Quiet doesn't always mean no.",
    ),
}

_DEFAULT_MESSAGE: tuple[str, str] = (
    "There's an update on your FundsLink account",
    "There's an update on your FundsLink account — sign in to FundsLink to see the details.",
)


def _render(trigger: str, payload: dict) -> tuple[str, str]:
    """The student-facing copy for a trigger (content track). Warm, dignified, channel-agnostic per
    the UX emotional-design law (ux-screen-map §0, P1–P8); never embeds an id/PII (P3 / POPIA).
    `payload` is intentionally unused — detail lives behind sign-in. Unknown triggers fall back."""
    return _TEMPLATES.get(trigger, _DEFAULT_MESSAGE)


class NotificationWorker:
    def __init__(self, session) -> None:
        self.session = session
        self.repo = NotificationRepository(session)
        self.prefs = PreferenceRepository(session)
        self.consents = ConsentReadRepository(session)

    async def process_batch(self, *, batch: int = 20) -> dict[str, int]:
        claimed = await self.repo.claim_batch(batch)
        counts = {"sent": 0, "retried": 0, "dead": 0}
        for row in claimed:
            notif_id, created_at, user_id, trigger, channels, payload, attempts = row
            try:
                await self._deliver(user_id, trigger, channels, payload or {})
                await self.repo.mark_sent(notif_id, created_at)
                counts["sent"] += 1
            except Exception as exc:  # delivery failed — back off, then DEAD after MAX_ATTEMPTS
                attempts += 1
                if attempts >= MAX_ATTEMPTS:
                    await self.repo.mark_dead(notif_id, created_at, attempts=attempts)
                    counts["dead"] += 1
                    logger.error(
                        "notification %s DEAD after %d attempts: %s", notif_id, attempts, exc
                    )
                else:
                    await self.repo.mark_retry(
                        notif_id, created_at, attempts=attempts, next_attempt_at=_backoff(attempts)
                    )
                    counts["retried"] += 1
        return counts

    async def _deliver(self, user_id: str, trigger: str, channels, payload: dict) -> None:
        effective = (await self.prefs.get(user_id)).get(trigger) or list(channels or [])
        granted = await self.consents.granted_purposes(user_id)
        subject, body = _render(trigger, payload)
        email = None
        for channel in effective:
            required = CHANNEL_CONSENT.get(channel)
            if required and required not in granted:  # BR-N03 — no consent → skip + log
                logger.info("skip %s for user %s (missing consent %s)", channel, user_id, required)
                continue
            adapter = CHANNELS.get(channel)
            if adapter is None:
                continue
            if channel == "EMAIL":
                email = email or await self.repo.user_email(user_id)
            await adapter.send(
                recipient=email if channel == "EMAIL" else None, subject=subject, body=body
            )


async def _run_once() -> dict[str, int]:
    """One drain pass: a fresh session, SYSTEM context, claim+deliver a batch, commit."""
    async with get_session_factory()() as session:
        await set_system_context(session)
        counts = await NotificationWorker(session).process_batch()
        await session.commit()
    return counts


async def _run_forever(interval: float) -> None:
    """Continuous drain (deploy mode). A fresh session per pass — never a long-held transaction.
    When a pass did work, poll again immediately to catch up under load; when idle, sleep
    ``interval``. A failed pass is logged and backed off — the daemon never crashes on a blip."""
    logger.info("notification worker: continuous mode (idle interval %.1fs)", interval)
    while True:
        try:
            did_work = any((await _run_once()).values())
        except Exception:
            logger.exception("notification worker pass failed; backing off")
            did_work = False
        await asyncio.sleep(0 if did_work else interval)


async def _main(*, loop: bool, interval: float) -> None:
    if loop:
        await _run_forever(interval)
    else:
        print(f"notification worker: {await _run_once()}")


def main() -> None:
    # ``--loop`` is the deploy runner that actually drains the outbox continuously; the default
    # single pass keeps the test/CI/cron-tick shape. (The tracking T-3 / 30·45·60 reminder jobs
    # are a separate DAILY cron that enqueues into this same outbox — wired at Stage 06 deploy.)
    import argparse

    parser = argparse.ArgumentParser(description="FundsLink notification outbox worker")
    parser.add_argument(
        "--loop", action="store_true", help="run continuously, draining the outbox (deploy mode)"
    )
    parser.add_argument(
        "--interval", type=float, default=5.0,
        help="idle seconds between passes when nothing was due (default: 5)",
    )
    args = parser.parse_args()
    asyncio.run(_main(loop=args.loop, interval=args.interval))


if __name__ == "__main__":
    main()
