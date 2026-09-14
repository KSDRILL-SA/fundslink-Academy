"""Insights service — shapes live database figures for the student (S08) and staff (A00) dashboards.

No figure is computed from a literal: counts come from the repository at request time, the SLA
from config, and every status grouping from the module that owns the lifecycle (#294).
"""

from __future__ import annotations

from datetime import UTC, datetime

from app.common.pagination import clamp_limit, decode_cursor, encode_cursor
from app.modules.application.schemas import PageMeta
from app.modules.application.state_machine import (
    AWAITING_FUNDSLINK_STATUSES,
    DECIDED_STATUSES,
)
from app.modules.auth.mfa import MFA_REQUIRED_ROLES
from app.modules.insights.repository import AdminInsightsRepository, StudentInsightsRepository
from app.modules.insights.schemas import (
    AccountFigures,
    AccountSecurityFigures,
    ActivityActor,
    ActivityCategory,
    ActivityItem,
    ActivityPage,
    ActorKind,
    AdminActivityItem,
    AdminActivityPage,
    AdminOverview,
    ApplicationFigures,
    DeliveryFigures,
    FlowFigures,
    MatchFigures,
    NotificationFigures,
    QueueFigures,
    StatusCount,
    StudentOverview,
    TrackedDeadline,
    TrackingFigures,
)
from app.modules.tracking.repository import ACTIVE_TRACKED_STATUSES

# What a student is shown from their own audit trail, and under which heading. An allowlist, not a
# denylist: a new audit action stays out of the timeline until someone decides it belongs there.
# Left out on purpose — AUTH_TOKEN_REFRESH (every few minutes; noise that would bury a real
# sign-in), the *_REQUESTED / *_SENT / *_REQUIRED bookkeeping around a real event, and actions that
# duplicate a status event already in the timeline (APPLICATION_SUBMITTED, APPLICATION_APPEALED,
# TRACKED_REGISTERED, TRACKED_SELF_REPORT).
STUDENT_AUDIT_ACTIONS: dict[str, ActivityCategory] = {
    "AUTH_LOGIN_SUCCESS": ActivityCategory.SECURITY,
    "AUTH_LOGOUT": ActivityCategory.SECURITY,
    "AUTH_PASSWORD_CHANGED": ActivityCategory.SECURITY,
    "AUTH_PASSWORD_RESET": ActivityCategory.SECURITY,
    "AUTH_MFA_ACTIVATED": ActivityCategory.SECURITY,
    "AUTH_MFA_DISABLED": ActivityCategory.SECURITY,
    "AUTH_MFA_RECOVERY_REGENERATED": ActivityCategory.SECURITY,
    "AUTH_EMAIL_VERIFIED": ActivityCategory.SECURITY,
    "AUTH_TOKEN_REUSE_DETECTED": ActivityCategory.SECURITY,
    "AUTH_REGISTER": ActivityCategory.ACCOUNT,
    "PROFILE_CREATED": ActivityCategory.ACCOUNT,
    "PROFILE_UPDATED": ActivityCategory.ACCOUNT,
    "NOTIFICATION_PREFERENCES_UPDATED": ActivityCategory.ACCOUNT,
    "DATA_EXPORTED": ActivityCategory.PRIVACY,
    "DOCUMENT_UPLOADED": ActivityCategory.DOCUMENTS,
    "APPLICATION_CREATED": ActivityCategory.APPLICATION,
    "MATCHING_RUN": ActivityCategory.MATCHING,
}
_STATUS_EVENT_CATEGORY = {
    "APPLICATION_STATUS_CHANGED": ActivityCategory.APPLICATION,
    "TRACKER_STATUS_CHANGED": ActivityCategory.TRACKING,
}


def _counts(rows) -> list[StatusCount]:
    return [StatusCount(status=status, count=count) for status, count in rows]


def _sum(counts: list[StatusCount], statuses) -> int:
    wanted = set(statuses)
    return sum(c.count for c in counts if c.status in wanted)


class StudentInsightsService:
    def __init__(self, session) -> None:
        self.repo = StudentInsightsRepository(session)

    async def activity(
        self,
        *,
        me: str,
        cursor: str | None,
        limit: int | None,
        category: ActivityCategory | None = None,
    ) -> ActivityPage:
        """The timeline, optionally narrowed to one category — filtered in the query, so a page
        of "Security" is a full page of security events, not a page of everything with most rows
        hidden."""
        n = clamp_limit(limit)
        actions = [
            action
            for action, heading in STUDENT_AUDIT_ACTIONS.items()
            if category is None or heading == category
        ]
        rows = await self.repo.activity(
            me,
            audit_actions=actions,
            application_events=category in (None, ActivityCategory.APPLICATION),
            tracker_events=category in (None, ActivityCategory.TRACKING),
            limit=n,
            after=decode_cursor(cursor),
        )
        page = rows[:n]
        items = [
            ActivityItem(
                id=row_id,
                occurred_at=occurred_at,
                category=_STATUS_EVENT_CATEGORY.get(event) or STUDENT_AUDIT_ACTIONS[event],
                event=event,
                actor=ActivityActor.YOU if actor_is_me else ActivityActor.FUNDSLINK,
                resource_id=resource_id,
                to_status=to_status,
                label=label,
            )
            for row_id, occurred_at, event, actor_is_me, resource_id, to_status, label in page
        ]
        next_cursor = (
            encode_cursor(page[-1][1], page[-1][0]) if len(rows) > n and page else None
        )
        return ActivityPage(items=items, meta=PageMeta(next_cursor=next_cursor))

    async def overview(self, *, me: str) -> StudentOverview:
        applications = _counts(await self.repo.application_status_counts(me))
        trackers = _counts(await self.repo.tracked_status_counts(me))
        deadline = await self.repo.next_deadline(me)
        match_total, match_last = await self.repo.match_figures(me)
        note_total, note_last = await self.repo.notification_figures(me)
        member_since, mfa_enabled, previous_sign_in = await self.repo.account(me)
        return StudentOverview(
            generated_at=datetime.now(UTC),
            applications=ApplicationFigures(
                total=sum(c.count for c in applications),
                drafts=_sum(applications, ("DRAFT",)),
                needs_your_action=_sum(applications, ("RETURNED_FOR_INFO",)),
                with_fundslink=_sum(applications, AWAITING_FUNDSLINK_STATUSES),
                decided=_sum(applications, DECIDED_STATUSES),
                by_status=applications,
            ),
            tracking=TrackingFigures(
                total=sum(c.count for c in trackers),
                active=_sum(trackers, ACTIVE_TRACKED_STATUSES),
                by_status=trackers,
                next_deadline=(
                    TrackedDeadline(
                        tracked_application_id=deadline[0],
                        bursary_name=deadline[1],
                        due_on=deadline[2],
                        deadline_type=deadline[3],
                    )
                    if deadline
                    else None
                ),
            ),
            matches=MatchFigures(total=match_total, last_run_at=match_last),
            notifications=NotificationFigures(total=note_total, last_at=note_last),
            account=AccountFigures(
                member_since=member_since,
                previous_sign_in_at=previous_sign_in,
                mfa_enabled=bool(mfa_enabled),
            ),
        )


class AdminInsightsService:
    def __init__(self, session) -> None:
        self.repo = AdminInsightsRepository(session)

    async def overview(self, *, days: int) -> AdminOverview:
        by_status = _counts(await self.repo.queue_status_counts())
        awaiting, overdue, emergency, unscreened = await self.repo.queue_figures()
        submitted, approved, waitlisted, not_funded, median = await self.repo.flow_figures(days)
        pending, failed, sent = await self.repo.delivery_figures(days)
        registered, sign_ins, failed_sign_ins, locked = await self.repo.account_figures(days)
        return AdminOverview(
            generated_at=datetime.now(UTC),
            window_days=days,
            queue=QueueFigures(
                awaiting_review=awaiting,
                overdue=overdue,
                emergency=emergency,
                unscreened=unscreened,
                awaiting_student=_sum(by_status, ("RETURNED_FOR_INFO",)),
                by_status=by_status,
            ),
            flow=FlowFigures(
                submitted=submitted,
                approved=approved,
                waitlisted=waitlisted,
                not_funded=not_funded,
                median_days_to_decision=round(float(median), 1) if median is not None else None,
            ),
            notifications=DeliveryFigures(pending=pending, failed=failed, sent=sent),
            accounts=AccountSecurityFigures(
                registered=registered,
                sign_ins=sign_ins,
                failed_sign_ins=failed_sign_ins,
                locked=locked,
            ),
        )

    async def activity(self, *, cursor: str | None, limit: int | None) -> AdminActivityPage:
        n = clamp_limit(limit)
        rows = await self.repo.activity(
            staff_roles=sorted(MFA_REQUIRED_ROLES), limit=n, after=decode_cursor(cursor)
        )
        page = rows[:n]
        items = [
            AdminActivityItem(
                id=row_id,
                occurred_at=occurred_at,
                action=action,
                resource_type=resource_type,
                resource_id=resource_id,
                actor_kind=ActorKind(kind),
            )
            for row_id, occurred_at, action, resource_type, resource_id, kind in page
        ]
        next_cursor = (
            encode_cursor(page[-1][1], page[-1][0]) if len(rows) > n and page else None
        )
        return AdminActivityPage(items=items, meta=PageMeta(next_cursor=next_cursor))
