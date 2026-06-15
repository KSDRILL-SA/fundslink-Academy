"""Tracking service (BR-T01/T03/T04) — the student's external-application dashboard.

Self-report is a student-owned status change: it validates the transition against
tracked_status_transition (BR-T04), appends a tracked_status_event tagged source=SELF_REPORT
(BR-T03), and refreshes the cache + last_activity_at — all under the caller's context (a
self-report notifies no one, so no staff-only outbox is needed). Every mutation audits (S3.33).
"""

from __future__ import annotations

from app.common.errors import AppError
from app.common.pagination import clamp_limit, decode_cursor, encode_cursor
from app.modules.application.schemas import PageMeta
from app.modules.auth.repository import AuditRepository
from app.modules.matching.repository import BursaryRepository
from app.modules.matching.schemas import Bursary
from app.modules.tracking.repository import TrackedRepository
from app.modules.tracking.schemas import Tracked, TrackedPage


def _to_bursary(row) -> Bursary:
    return Bursary(
        id=row[0], name=row[1], provider=row[2], status=row[3],
        level_eligibility=row[4] or [], field_tags=row[5] or [],
        next_deadline=row[6], source_url=row[7],
    )


class TrackingService:
    def __init__(self, session) -> None:
        self.session = session
        self.tracked = TrackedRepository(session)
        self.bursaries = BursaryRepository(session)
        self.audit = AuditRepository(session)

    async def register(
        self, *, actor_id: str, external_bursary_id: str, request_id: str
    ) -> Tracked:
        if not await self.tracked.bursary_exists(external_bursary_id):
            raise AppError("bursary_not_found", "No such bursary", status_code=404)
        tracked_id = await self.tracked.register(
            student_profile_id=actor_id, external_bursary_id=external_bursary_id
        )
        # Genesis event: REGISTERED, self-reported (defines status_source and seeds the log).
        await self.tracked.insert_event(
            tracked_id=tracked_id, from_status=None, to_status="REGISTERED",
            source="SELF_REPORT", actor_user_id=actor_id,
        )
        await self.audit.write(
            actor_user_id=actor_id, action="TRACKED_REGISTERED",
            resource_type="tracked_application", resource_id=tracked_id, request_id=request_id,
        )
        return await self._load_one(tracked_id, actor_id)

    async def self_report(
        self, *, actor_id: str, tracked_id: str, to_status: str, request_id: str
    ) -> Tracked:
        if await self.tracked.owned_id(tracked_id, actor_id) is None:
            raise AppError("tracked_not_found", "Tracked application not found", status_code=404)
        current = await self.tracked.get_status(tracked_id)
        if current == to_status or not await self.tracked.transition_allowed(current, to_status):
            raise AppError(
                "invalid_transition",
                f"Cannot move a tracked application from {current} to {to_status}",
                status_code=409,
            )
        await self.tracked.insert_event(
            tracked_id=tracked_id, from_status=current, to_status=to_status,
            source="SELF_REPORT", actor_user_id=actor_id,  # BR-T03 freshness label
        )
        await self.tracked.set_status_touch(tracked_id, to_status)
        await self.audit.write(
            actor_user_id=actor_id, action="TRACKED_SELF_REPORT",
            resource_type="tracked_application", resource_id=tracked_id, request_id=request_id,
            detail={"to_status": to_status},
        )
        return await self._load_one(tracked_id, actor_id)

    async def list_mine(
        self, *, actor_id: str, cursor: str | None, limit: int | None
    ) -> TrackedPage:
        n = clamp_limit(limit)
        rows = await self.tracked.list_for_owner(actor_id, limit=n, after=decode_cursor(cursor))
        has_more = len(rows) > n
        page = rows[:n]
        bursaries = await self.bursaries.get_many([r[1] for r in page])
        items = [
            Tracked(
                id=r[0],
                bursary=_to_bursary(bursaries[r[1]]),
                status=r[2],
                last_activity_at=r[3],
                status_source=r[4] or "SELF_REPORT",
            )
            for r in page
            if r[1] in bursaries
        ]
        next_cursor = encode_cursor(page[-1][3], page[-1][0]) if has_more and page else None
        return TrackedPage(items=items, meta=PageMeta(next_cursor=next_cursor))

    async def _load_one(self, tracked_id: str, owner_id: str) -> Tracked:
        row = await self.tracked.get_for_owner(tracked_id, owner_id)
        if row is None:
            raise AppError("tracked_not_found", "Tracked application not found", status_code=404)
        bursary = (await self.bursaries.get_many([row[1]])).get(row[1])
        return Tracked(
            id=row[0],
            bursary=_to_bursary(bursary),
            status=row[2],
            last_activity_at=row[3],
            status_source=row[4] or "SELF_REPORT",
        )
