"""Insights repositories (DB-D2 boundary). Named-bind SQL only (S5.21).

Every figure on a dashboard is a query here, run at request time — there is no cached or literal
number anywhere in the path (#294). Status groupings are imported from the modules that own them
(the application state machine, the tracking repository), so a dashboard can never define "waiting
on FundsLink" or "active tracker" differently from the code that acts on it.

Student reads carry an explicit ``= :me`` ownership predicate AND run under the caller's RLS
context (0007 / 0009 / 0021), so a bug in either wall alone still leaks nothing. Staff reads run
under the reviewer's context, which RLS admits to every row.
"""

from __future__ import annotations

from app.db import sql
from app.db.repository import BaseRepository
from app.modules.application.repository import REVIEW_DUE_SQL, SLA_PARAMS
from app.modules.application.state_machine import (
    AWAITING_FUNDSLINK_STATUSES,
    AWAITING_HUMAN_STATUSES,
    EMERGENCY_PRIORITIES,
    FUNDED_DECISIONS,
    NOT_FUNDED_DECISIONS,
    REVIEW_CLOCK_STARTS,
    WAITLISTED_DECISIONS,
)
from app.modules.tracking.repository import ACTIVE_TRACKED_STATUSES

# asyncpg infers a bind's type from its first use; a keyset value compared to a timestamptz must
# arrive as text and be cast by SQL, or the comparison binds as the wrong type.
_AT = "CAST(CAST(:c_at AS text) AS timestamptz)"


class StudentInsightsRepository(BaseRepository):
    async def activity(
        self,
        me: str,
        *,
        audit_actions: list[str],
        application_events: bool,
        tracker_events: bool,
        limit: int,
        after: tuple[str, str] | None,
    ) -> list:
        """(id, occurred_at, event, actor_is_me, resource_id, to_status, label), newest first.

        Up to three sources, one timeline; a filtered view leaves out the sources it does not
        want rather than fetching them and throwing rows away. Status-event ``note`` and audit
        ``detail`` are never selected: a reviewer's note and an audit payload are not the
        student's to read here.
        """
        sources = [
            "SELECT al.id, al.created_at AS occurred_at, al.action AS event,"
            "       true AS actor_is_me, al.resource_id, NULL::text AS to_status,"
            "       NULL::text AS label"
            "  FROM audit_log al"
            " WHERE al.actor_user_id = :me AND al.action = ANY(:actions)"
        ]
        if application_events:
            sources.append(
                "SELECT e.id, e.created_at, 'APPLICATION_STATUS_CHANGED',"
                "       e.actor_user_id IS NOT DISTINCT FROM :me, e.application_id, e.to_status,"
                "       NULL"
                "  FROM application_status_event e"
                "  JOIN funding_application fa ON fa.id = e.application_id"
                " WHERE fa.student_profile_id = :me"
            )
        if tracker_events:
            sources.append(
                "SELECT t.id, t.created_at, 'TRACKER_STATUS_CHANGED',"
                "       t.actor_user_id IS NOT DISTINCT FROM :me, t.tracked_application_id,"
                "       t.to_status, b.name"
                "  FROM tracked_status_event t"
                "  JOIN tracked_application ta ON ta.id = t.tracked_application_id"
                "  JOIN external_bursary b ON b.id = ta.external_bursary_id"
                " WHERE ta.student_profile_id = :me"
            )
        keyset = f" WHERE (occurred_at, id) < ({_AT}, CAST(:c_id AS text))" if after else ""
        params: dict = {"me": me, "actions": audit_actions, "limit": limit + 1}
        if after:
            params |= {"c_at": after[0], "c_id": after[1]}
        return await sql.fetch_all(
            self.session,
            "WITH timeline AS (" + " UNION ALL ".join(sources) + ")"
            " SELECT id, occurred_at, event, actor_is_me, resource_id, to_status, label"
            f" FROM timeline{keyset}"
            " ORDER BY occurred_at DESC, id DESC LIMIT :limit",
            **params,
        )

    async def application_status_counts(self, me: str) -> list:
        return await sql.fetch_all(
            self.session,
            "SELECT status, count(*) FROM funding_application"
            " WHERE student_profile_id = :me AND deleted_at IS NULL"
            " GROUP BY status ORDER BY status",
            me=me,
        )

    async def tracked_status_counts(self, me: str) -> list:
        return await sql.fetch_all(
            self.session,
            "SELECT status, count(*) FROM tracked_application"
            " WHERE student_profile_id = :me AND deleted_at IS NULL"
            " GROUP BY status ORDER BY status",
            me=me,
        )

    async def next_deadline(self, me: str):
        """The soonest deadline still ahead on a tracker the student is still pursuing."""
        return await sql.fetch_one(
            self.session,
            "SELECT ta.id, b.name, d.due_on, d.deadline_type"
            "  FROM tracked_application ta"
            "  JOIN external_bursary b ON b.id = ta.external_bursary_id"
            "  JOIN bursary_deadline d ON d.external_bursary_id = ta.external_bursary_id"
            " WHERE ta.student_profile_id = :me AND ta.deleted_at IS NULL"
            "   AND ta.status = ANY(:active) AND d.due_on >= current_date"
            " ORDER BY d.due_on, ta.id LIMIT 1",
            me=me,
            active=list(ACTIVE_TRACKED_STATUSES),
        )

    async def match_figures(self, me: str):
        return await sql.fetch_one(
            self.session,
            "SELECT count(*), max(created_at) FROM match_result WHERE student_profile_id = :me",
            me=me,
        )

    async def notification_figures(self, me: str):
        return await sql.fetch_one(
            self.session,
            "SELECT count(*), max(created_at) FROM notification_outbox WHERE user_id = :me",
            me=me,
        )

    async def account(self, me: str):
        """(member_since, mfa_enabled, previous_sign_in_at). The previous sign-in is the second
        most recent: the most recent is, almost always, the one the student is using now."""
        return await sql.fetch_one(
            self.session,
            'SELECT u.created_at, u.mfa_enabled,'
            "  (SELECT al.created_at FROM audit_log al"
            "    WHERE al.actor_user_id = u.id AND al.action = 'AUTH_LOGIN_SUCCESS'"
            "    ORDER BY al.created_at DESC OFFSET 1 LIMIT 1)"
            ' FROM "user" u WHERE u.id = :me',
            me=me,
        )


class AdminInsightsRepository(BaseRepository):
    async def queue_status_counts(self) -> list:
        """Counts for every status that is waiting on someone — a person, the pipeline or the
        student — so the staff view shows the whole backlog, not only the review queue."""
        return await sql.fetch_all(
            self.session,
            "SELECT status, count(*) FROM funding_application"
            " WHERE deleted_at IS NULL AND status = ANY(:waiting)"
            " GROUP BY status ORDER BY status",
            waiting=sorted({*AWAITING_FUNDSLINK_STATUSES, "RETURNED_FOR_INFO"}),
        )

    async def queue_figures(self):
        """(awaiting_review, overdue, emergency, unscreened) over the review queue."""
        return await sql.fetch_one(
            self.session,
            "SELECT count(*),"
            f"  count(*) FILTER (WHERE ({REVIEW_DUE_SQL}) < now()),"
            "  count(*) FILTER (WHERE fa.priority = ANY(:emergency)),"
            "  count(*) FILTER (WHERE fa.status = 'UNSCREENED')"
            " FROM funding_application fa"
            " WHERE fa.deleted_at IS NULL AND fa.status = ANY(:awaiting_human)",
            awaiting_human=list(AWAITING_HUMAN_STATUSES),
            emergency=list(EMERGENCY_PRIORITIES),
            **SLA_PARAMS,
        )

    async def flow_figures(self, days: int):
        """(submitted, approved, waitlisted, not_funded, median_days_to_decision) in the window.

        Time to decision runs from the latest clock-start event before each decision — the same
        clock the review SLA uses — so an appeal is measured from the appeal, not from the first
        submission a year earlier.
        """
        return await sql.fetch_one(
            self.session,
            "WITH decisions AS ("
            "  SELECT e.application_id, e.to_status, e.created_at,"
            "    (SELECT max(s.created_at) FROM application_status_event s"
            "      WHERE s.application_id = e.application_id"
            "        AND s.to_status = ANY(:clock_starts) AND s.created_at <= e.created_at)"
            "      AS clock_started_at"
            "  FROM application_status_event e"
            "  WHERE e.to_status = ANY(:decisions)"
            "    AND e.created_at >= now() - make_interval(days => :days)"
            ")"
            " SELECT"
            "  (SELECT count(*) FROM application_status_event"
            "    WHERE to_status = 'SUBMITTED'"
            "      AND created_at >= now() - make_interval(days => :days)),"
            "  count(*) FILTER (WHERE to_status = ANY(:funded)),"
            "  count(*) FILTER (WHERE to_status = ANY(:waitlisted)),"
            "  count(*) FILTER (WHERE to_status = ANY(:not_funded)),"
            "  percentile_cont(0.5) WITHIN GROUP ("
            "    ORDER BY extract(epoch FROM created_at - clock_started_at) / 86400.0)"
            " FROM decisions",
            days=days,
            clock_starts=list(REVIEW_CLOCK_STARTS),
            decisions=[*FUNDED_DECISIONS, *WAITLISTED_DECISIONS, *NOT_FUNDED_DECISIONS],
            funded=list(FUNDED_DECISIONS),
            waitlisted=list(WAITLISTED_DECISIONS),
            not_funded=list(NOT_FUNDED_DECISIONS),
        )

    async def delivery_figures(self, days: int):
        """(pending, failed, sent). Pending and failed are the standing backlog; sent is counted
        over notifications created in the window (the outbox records no separate send time)."""
        return await sql.fetch_one(
            self.session,
            "SELECT count(*) FILTER (WHERE state IN ('PENDING', 'SENDING')),"
            "  count(*) FILTER (WHERE state = 'DEAD'),"
            "  count(*) FILTER (WHERE state = 'SENT'"
            "    AND created_at >= now() - make_interval(days => :days))"
            " FROM notification_outbox",
            days=days,
        )

    async def account_figures(self, days: int):
        """(registered, sign_ins, failed_sign_ins, locked) in the window, from the audit log."""
        return await sql.fetch_one(
            self.session,
            # Distinct accounts, not rows: until #294 every registration was audited twice.
            "SELECT count(DISTINCT resource_id) FILTER (WHERE action = 'AUTH_REGISTER'),"
            "  count(*) FILTER (WHERE action = 'AUTH_LOGIN_SUCCESS'),"
            "  count(*) FILTER (WHERE action = 'AUTH_LOGIN_FAILURE'),"
            "  count(*) FILTER (WHERE action = 'AUTH_ACCOUNT_LOCKED')"
            " FROM audit_log"
            " WHERE created_at >= now() - make_interval(days => :days)"
            "   AND action IN ('AUTH_REGISTER', 'AUTH_LOGIN_SUCCESS', 'AUTH_LOGIN_FAILURE',"
            "                  'AUTH_ACCOUNT_LOCKED')",
            days=days,
        )

    async def activity(
        self, *, staff_roles: list[str], limit: int, after: tuple[str, str] | None
    ) -> list:
        """(id, occurred_at, action, resource_type, resource_id, actor_kind), newest first.

        ``detail`` is never selected. The actor is reduced to a kind: who did it matters for
        monitoring; which named person did it is an investigation, and belongs elsewhere.
        """
        keyset = f" AND (al.created_at, al.id) < ({_AT}, CAST(:c_id AS text))" if after else ""
        params: dict = {"staff": staff_roles, "limit": limit + 1}
        if after:
            params |= {"c_at": after[0], "c_id": after[1]}
        return await sql.fetch_all(
            self.session,
            "SELECT al.id, al.created_at, al.action, al.resource_type, al.resource_id,"
            "  CASE"
            "    WHEN al.actor_user_id IS NULL THEN 'ANONYMOUS'"
            "    WHEN al.actor_user_id = 'SYSTEM' THEN 'SYSTEM'"
            "    WHEN EXISTS (SELECT 1 FROM user_role ur JOIN role r ON r.id = ur.role_id"
            "                  WHERE ur.user_id = al.actor_user_id AND r.code = ANY(:staff))"
            "      THEN 'STAFF'"
            "    ELSE 'STUDENT'"
            "  END"
            f" FROM audit_log al WHERE true{keyset}"
            " ORDER BY al.created_at DESC, al.id DESC LIMIT :limit",
            **params,
        )


