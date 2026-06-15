"""Notification service — the student's notification history + channel preferences (BR-N02).

Reads run under the caller's RLS context (a student sees only their own outbox rows / preference).
Preferences are one row per user (BR-N02), upserted; the per-trigger channel map drives the
worker's channel resolution at send time.
"""

from __future__ import annotations

from app.common.pagination import clamp_limit, decode_cursor, encode_cursor
from app.modules.application.schemas import PageMeta
from app.modules.auth.repository import AuditRepository
from app.modules.notification.repository import NotificationRepository, PreferenceRepository
from app.modules.notification.schemas import (
    Channel,
    Notification,
    NotificationPage,
    Preferences,
)


class NotificationService:
    def __init__(self, session) -> None:
        self.session = session
        self.repo = NotificationRepository(session)
        self.prefs = PreferenceRepository(session)
        self.audit = AuditRepository(session)

    async def list_mine(
        self, *, actor_id: str, cursor: str | None, limit: int | None
    ) -> NotificationPage:
        n = clamp_limit(limit)
        rows = await self.repo.list_for_user(actor_id, limit=n, after=decode_cursor(cursor))
        has_more = len(rows) > n
        page = rows[:n]
        items = [
            Notification(
                id=r[0], trigger=r[1], channels=r[2] or [], state=r[3], created_at=r[4]
            )
            for r in page
        ]
        next_cursor = encode_cursor(page[-1][4], page[-1][0]) if has_more and page else None
        return NotificationPage(items=items, meta=PageMeta(next_cursor=next_cursor))

    async def put_preferences(
        self, *, actor_id: str, prefs: Preferences, request_id: str
    ) -> Preferences:
        # Normalise to plain strings for JSONB storage.
        per_trigger = {trig: [c.value for c in chans] for trig, chans in prefs.per_trigger.items()}
        await self.prefs.upsert(actor_id, per_trigger)
        await self.audit.write(
            actor_user_id=actor_id,
            action="NOTIFICATION_PREFERENCES_UPDATED",
            resource_type="notification_preference",
            resource_id=actor_id,
            request_id=request_id,
            detail={"triggers": sorted(per_trigger)},
        )
        return Preferences(
            per_trigger={t: [Channel(c) for c in chans] for t, chans in per_trigger.items()}
        )
