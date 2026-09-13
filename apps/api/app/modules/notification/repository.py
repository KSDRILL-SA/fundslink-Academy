"""Notification repositories (DB-D2 boundary). Named-bind SQL only (S5.21).

The outbox is claimed with ``FOR UPDATE SKIP LOCKED`` so N concurrent workers never process the
same row (the lock is held until the worker's transaction commits). Reads (history, preferences)
run under the caller's RLS context; the worker's claim/mark + consent/email lookups run under
SYSTEM context (outbox updates are staff-only, rls_no_update).
"""

from __future__ import annotations

from datetime import datetime

from app.db import sql
from app.db.cuid import cuid
from app.db.repository import BaseRepository


class NotificationRepository(BaseRepository):
    async def list_for_user(self, user_id: str, *, limit: int, after) -> list:
        where = "user_id = :uid"
        params: dict = {"uid": user_id}
        if after is not None:
            where += " AND (created_at, id) < (:c_at, :c_id)"
            params |= {"c_at": after[0], "c_id": after[1]}
        return await sql.fetch_all(
            self.session,
            "SELECT id, trigger, channels, state, created_at FROM notification_outbox"
            f" WHERE {where} ORDER BY created_at DESC, id DESC LIMIT :limit",
            limit=limit + 1,
            **params,
        )

    async def claim_batch(self, limit: int) -> list:
        """Claim due PENDING rows (FOR UPDATE SKIP LOCKED) — concurrent-safe; caller commits."""
        return await sql.fetch_all(
            self.session,
            "SELECT id, created_at, user_id, trigger, channels, payload, attempts"
            " FROM notification_outbox"
            " WHERE state = 'PENDING' AND next_attempt_at <= now()"
            " ORDER BY next_attempt_at"
            " FOR UPDATE SKIP LOCKED LIMIT :n",
            n=limit,
        )

    async def mark_sent(self, notif_id: str, created_at: datetime) -> None:
        await sql.execute(
            self.session,
            "UPDATE notification_outbox SET state = 'SENT' WHERE id = :id AND created_at = :ts",
            id=notif_id,
            ts=created_at,
        )

    async def mark_retry(
        self, notif_id: str, created_at: datetime, *, attempts: int, next_attempt_at: datetime
    ) -> None:
        await sql.execute(
            self.session,
            "UPDATE notification_outbox SET attempts = :a, next_attempt_at = :next"
            " WHERE id = :id AND created_at = :ts",
            a=attempts,
            next=next_attempt_at,
            id=notif_id,
            ts=created_at,
        )

    async def mark_dead(self, notif_id: str, created_at: datetime, *, attempts: int) -> None:
        await sql.execute(
            self.session,
            "UPDATE notification_outbox SET state = 'DEAD', attempts = :a"
            " WHERE id = :id AND created_at = :ts",
            a=attempts,
            id=notif_id,
            ts=created_at,
        )

    async def user_email(self, user_id: str) -> str | None:
        row = await sql.fetch_one(
            self.session, 'SELECT email FROM "user" WHERE id = :id', id=user_id
        )
        return row[0] if row else None

    async def dead_count(self) -> int:
        row = await sql.fetch_one(
            self.session, "SELECT count(*) FROM notification_outbox WHERE state = 'DEAD'"
        )
        return int(row[0])


class PreferenceRepository(BaseRepository):
    async def trigger_codes(self) -> set[str]:
        """Every notification trigger the platform can send (lk_notify_trigger)."""
        rows = await sql.fetch_all(self.session, "SELECT code FROM lk_notify_trigger")
        return {r[0] for r in rows}

    async def get(self, user_id: str) -> dict:
        row = await sql.fetch_one(
            self.session,
            "SELECT per_trigger FROM notification_preference WHERE user_id = :uid",
            uid=user_id,
        )
        return row[0] if row and row[0] else {}

    async def upsert(self, user_id: str, per_trigger: dict) -> None:
        import json

        await sql.execute(
            self.session,
            "INSERT INTO notification_preference (id, user_id, per_trigger)"
            " VALUES (:id, :uid, :pt)"
            " ON CONFLICT (user_id) DO UPDATE SET per_trigger = EXCLUDED.per_trigger,"
            " updated_at = now()",
            id=cuid(),
            uid=user_id,
            pt=json.dumps(per_trigger),
        )


class ConsentReadRepository(BaseRepository):
    async def granted_purposes(self, user_id: str) -> set[str]:
        rows = await sql.fetch_all(
            self.session,
            "SELECT purpose FROM consent_record"
            " WHERE user_id = :uid AND withdrawn_at IS NULL",
            uid=user_id,
        )
        return {r[0] for r in rows}
