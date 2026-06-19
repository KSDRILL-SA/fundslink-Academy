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


def _render(trigger: str, payload: dict) -> tuple[str, str]:
    """A minimal human message per trigger (real templates land with the content track)."""
    subject = f"FundsLink update — {trigger.replace('_', ' ').title()}"
    ref = payload.get("application_id") or payload.get("tracked_application_id") or ""
    body = f"There is an update on your FundsLink account ({trigger})."
    if ref:
        body += f" Ref: {ref}"
    return subject, body


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
