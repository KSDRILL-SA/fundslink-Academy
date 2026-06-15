"""Tracking repositories (DB-D2 boundary). Named-bind SQL only (S5.21).

tracked_application is the M:N bridge (BR-T01); tracked_status_event is append-only with a source
label (BR-T03). Like the application events, created_at uses clock_timestamp() so several events in
one transaction stay strictly ordered (status cache = latest event). The deadline (BR-T05) and
silence (BR-T06) scans feed the scheduled jobs.
"""

from __future__ import annotations

from sqlalchemy.exc import IntegrityError

from app.common.errors import AppError
from app.db import sql
from app.db.cuid import cuid
from app.db.repository import BaseRepository

# Active = not terminal; eligible for reminders / silence follow-ups (BR-T06).
_ACTIVE = "('REGISTERED','SUBMITTED','UNDER_REVIEW','SHORTLISTED','INTERVIEW')"


class TrackedRepository(BaseRepository):
    async def bursary_exists(self, bursary_id: str) -> bool:
        row = await sql.fetch_one(
            self.session,
            "SELECT 1 FROM external_bursary WHERE id = :id AND deleted_at IS NULL",
            id=bursary_id,
        )
        return row is not None

    async def register(self, *, student_profile_id: str, external_bursary_id: str) -> str:
        tracked_id = cuid()
        try:
            await sql.execute(
                self.session,
                "INSERT INTO tracked_application"
                " (id, student_profile_id, external_bursary_id, created_by)"
                " VALUES (:id, :sp, :eb, :sp)",
                id=tracked_id,
                sp=student_profile_id,
                eb=external_bursary_id,
            )
        except IntegrityError as exc:  # uq_tracked_pair — already tracking this bursary
            raise AppError(
                "already_tracked", "You are already tracking this bursary", status_code=409
            ) from exc
        return tracked_id

    async def owned_id(self, tracked_id: str, owner_id: str) -> str | None:
        row = await sql.fetch_one(
            self.session,
            "SELECT id FROM tracked_application"
            " WHERE id = :id AND student_profile_id = :owner AND deleted_at IS NULL",
            id=tracked_id,
            owner=owner_id,
        )
        return row[0] if row else None

    async def get_status(self, tracked_id: str) -> str | None:
        row = await sql.fetch_one(
            self.session,
            "SELECT status FROM tracked_application WHERE id = :id AND deleted_at IS NULL",
            id=tracked_id,
        )
        return row[0] if row else None

    async def transition_allowed(self, from_status: str, to_status: str) -> bool:
        row = await sql.fetch_one(
            self.session,
            "SELECT 1 FROM tracked_status_transition WHERE from_status = :f AND to_status = :t",
            f=from_status,
            t=to_status,
        )
        return row is not None

    async def insert_event(
        self,
        *,
        tracked_id: str,
        from_status: str | None,
        to_status: str,
        source: str,
        actor_user_id: str | None,
    ) -> None:
        await sql.execute(
            self.session,
            "INSERT INTO tracked_status_event"
            " (id, tracked_application_id, from_status, to_status, source, actor_user_id,"
            "  created_at)"
            " VALUES (:id, :ta, :from, :to, :source, :actor, clock_timestamp())",
            id=cuid(),
            ta=tracked_id,
            **{"from": from_status, "to": to_status},
            source=source,
            actor=actor_user_id,
        )

    async def set_status_touch(self, tracked_id: str, status: str) -> None:
        await sql.execute(
            self.session,
            "UPDATE tracked_application SET status = :s, last_activity_at = now() WHERE id = :id",
            s=status,
            id=tracked_id,
        )

    async def get_for_owner(self, tracked_id: str, owner_id: str):
        return await sql.fetch_one(
            self.session,
            "SELECT ta.id, ta.external_bursary_id, ta.status, ta.last_activity_at,"
            " (SELECT source FROM tracked_status_event tse"
            "  WHERE tse.tracked_application_id = ta.id"
            "  ORDER BY tse.created_at DESC LIMIT 1) AS status_source"
            " FROM tracked_application ta"
            " WHERE ta.id = :id AND ta.student_profile_id = :owner AND ta.deleted_at IS NULL",
            id=tracked_id,
            owner=owner_id,
        )

    async def list_for_owner(self, owner_id: str, *, limit: int, after) -> list:
        where = "ta.student_profile_id = :owner AND ta.deleted_at IS NULL"
        params: dict = {"owner": owner_id}
        if after is not None:
            where += " AND (ta.last_activity_at, ta.id) < (:c_at, :c_id)"
            params |= {"c_at": after[0], "c_id": after[1]}
        return await sql.fetch_all(
            self.session,
            "SELECT ta.id, ta.external_bursary_id, ta.status, ta.last_activity_at,"
            " (SELECT source FROM tracked_status_event tse"
            "  WHERE tse.tracked_application_id = ta.id"
            "  ORDER BY tse.created_at DESC LIMIT 1) AS status_source"
            f" FROM tracked_application ta WHERE {where}"
            " ORDER BY ta.last_activity_at DESC, ta.id DESC LIMIT :limit",
            limit=limit + 1,
            **params,
        )


class ReminderScanRepository(BaseRepository):
    """Read-side scans for the scheduled jobs — run under SYSTEM context."""

    async def deadlines_due_in(self, days: int) -> list:
        """Active tracked applications whose bursary deadline is exactly ``days`` out (BR-T05)."""
        return await sql.fetch_all(
            self.session,
            "SELECT DISTINCT ta.id, ta.student_profile_id, bd.due_on"
            " FROM tracked_application ta"
            " JOIN bursary_deadline bd ON bd.external_bursary_id = ta.external_bursary_id"
            " WHERE ta.deleted_at IS NULL AND bd.due_on = CURRENT_DATE + (:days)::integer"
            f" AND ta.status IN {_ACTIVE}",
            days=days,
        )

    async def silent_for(self, days: int) -> list:
        """Active tracked applications silent for exactly ``days`` days (BR-T06: 30/45/60)."""
        return await sql.fetch_all(
            self.session,
            "SELECT ta.id, ta.student_profile_id FROM tracked_application ta"
            " WHERE ta.deleted_at IS NULL"
            f" AND ta.status IN {_ACTIVE}"
            " AND ta.last_activity_at::date = CURRENT_DATE - (:days)::integer",
            days=days,
        )
