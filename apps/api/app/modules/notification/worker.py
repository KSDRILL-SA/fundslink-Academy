"""Notification outbox worker (TAD §7) — drains notification_outbox, concurrent-safe.

One pass: claim a batch of due PENDING rows (FOR UPDATE SKIP LOCKED — N workers never collide),
resolve the effective channels from the user's preference (BR-N02), skip any channel whose consent
the user hasn't granted (BR-N03 — skipped and logged), deliver via the channel adapters, then mark
SENT. A delivery failure is retried with exponential backoff; after MAX_ATTEMPTS the row is DEAD
and surfaced (S3.34). Runs under SYSTEM context: ``python -m app.modules.notification.worker``.
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


async def _main() -> None:
    async with get_session_factory()() as session:
        await set_system_context(session)
        counts = await NotificationWorker(session).process_batch()
        await session.commit()
    print(f"notification worker: {counts}")


def main() -> None:
    asyncio.run(_main())


if __name__ == "__main__":
    main()
