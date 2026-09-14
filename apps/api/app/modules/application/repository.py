"""Application repositories (DB-D2 boundary) — the only application files touching a DB driver.

Named-bind parameterised SQL (DB-D20 / S5.21). Money is bound as ``Decimal`` (never float —
S5.28); the status cache + append-only events + outbox are written through these methods inside
the caller's single transaction (BR-N01). Ownership on student paths is an explicit
``student_profile_id = :owner`` predicate (the value comes from the authenticated principal);
RLS is the fail-closed backstop on the read paths.
"""

from __future__ import annotations

from decimal import Decimal

from sqlalchemy.exc import IntegrityError

from app.common.errors import AppError
from app.db import sql
from app.db.cuid import cuid
from app.db.repository import BaseRepository
from app.modules.application.state_machine import (
    AWAITING_FUNDSLINK_STATUSES,
    AWAITING_HUMAN_STATUSES,
    EMERGENCY_PRIORITIES,
    REVIEW_CLOCK_STARTS,
)

# Note: the "one active application per academic year" rule (BR-E06 / D-004) is enforced by the
# DB partial unique index uq_app_active_per_year (active = status NOT IN REJECTED_FINAL/REJECTED/
# WITHDRAWN/COMPLETED — so APPROVED/SUSPENDED/REVOKED still block). create() surfaces its violation
# as a friendly 409; the database is the single source of truth, not a duplicated constant here.


# When FundsLink owes an application a review (D-002 / D-013).
#
# One expression, used by the detail read, the student's list and the review queue, so none of them
# can disagree about a due date. The clock starts at the latest event that put the application into
# FundsLink's hands; the number of days is READ FROM CONFIG — `emergency_review_sla_days` for URGENT
# and CRITICAL, `review_sla_days` otherwise. Both were seeded (0002 / 0004) and, until this, read by
# nothing. If a key is ever missing the due date is NULL rather than a number invented in code: no
# SLA is an honest answer, a made-up one is not.
REVIEW_DUE_SQL = (
    "CASE WHEN fa.status = ANY(:sla_awaiting) THEN"
    " (SELECT max(e.created_at) FROM application_status_event e"
    "   WHERE e.application_id = fa.id AND e.to_status = ANY(:sla_clock_starts))"
    " + make_interval(days => ("
    "   SELECT value::int FROM config"
    "    WHERE key = CASE WHEN fa.priority = ANY(:sla_emergency)"
    "                     THEN 'emergency_review_sla_days' ELSE 'review_sla_days' END))"
    " END"
)
# The sentinel that sorts "no SLA" / "no needed_by" last. Shared with the cursor builder so
# the cursor and the ORDER BY can never drift apart.
NO_DEADLINE = "infinity"

SLA_PARAMS = {
    "sla_awaiting": list(AWAITING_FUNDSLINK_STATUSES),
    "sla_clock_starts": list(REVIEW_CLOCK_STARTS),
    "sla_emergency": list(EMERGENCY_PRIORITIES),
}
# Column order is part of the contract with ApplicationService._to_application: index 9 is the due
# date. New columns go on the end.
_APPLICATION_COLS = (
    "fa.id, fa.application_type, fa.academic_year, fa.requested_amount, fa.status, fa.currency,"
    f" fa.created_at, fa.priority, fa.needed_by, ({REVIEW_DUE_SQL}) AS review_due_at"
)


class ApplicationRepository(BaseRepository):
    async def has_profile(self, student_id: str) -> bool:
        """The funding_application FK targets student_profile — a profile must exist first."""
        row = await sql.fetch_one(
            self.session,
            "SELECT 1 FROM student_profile WHERE id = :id AND deleted_at IS NULL",
            id=student_id,
        )
        return row is not None

    async def has_sa_id(self, user_id: str) -> bool:
        """SA ID (blind-indexed) must exist before SUBMIT — the anti-duplicate gate (D-007/BR-A04).

        student_profile.id == "user".id (1:1 PK=FK), so the owner id keys the user row directly.
        """
        row = await sql.fetch_one(
            self.session,
            'SELECT 1 FROM "user" WHERE id = :id AND id_number_blind_idx IS NOT NULL',
            id=user_id,
        )
        return row is not None

    async def create(
        self,
        *,
        student_profile_id: str,
        application_type: str,
        academic_year: str,
        requested_amount: Decimal | None,
        household_income_band: str | None = None,
        nsfas_decline_reason: str | None = None,
        prior_funder: str | None = None,
        defunded_by: str | None = None,
        needed_by=None,
    ) -> str:
        app_id = cuid()
        try:
            await sql.execute(
                self.session,
                "INSERT INTO funding_application"
                " (id, student_profile_id, application_type, academic_year, requested_amount,"
                "  household_income_band, nsfas_decline_reason, prior_funder, defunded_by,"
                "  needed_by, created_by)"
                " VALUES (:id, :sp, :type, :year, :amount,"
                "  :income_band, :decline_reason, :prior_funder, :defunded_by, :needed_by, :sp)",
                id=app_id,
                sp=student_profile_id,
                type=application_type,
                year=academic_year,
                amount=requested_amount,
                income_band=household_income_band,
                decline_reason=nsfas_decline_reason,
                prior_funder=prior_funder,
                defunded_by=defunded_by,
                needed_by=needed_by,
            )
        except IntegrityError as exc:
            # uq_app_active_per_year — already one active application this academic year (BR-E06).
            raise AppError(
                "application_already_active",
                "You already have an active application for this academic year",
                status_code=409,
            ) from exc
        return app_id

    async def get_status(self, application_id: str) -> str | None:
        row = await sql.fetch_one(
            self.session,
            "SELECT status FROM funding_application WHERE id = :id AND deleted_at IS NULL",
            id=application_id,
        )
        return row[0] if row else None

    async def owner_of(self, application_id: str) -> str | None:
        row = await sql.fetch_one(
            self.session,
            "SELECT student_profile_id FROM funding_application"
            " WHERE id = :id AND deleted_at IS NULL",
            id=application_id,
        )
        return row[0] if row else None

    async def owned_id(self, application_id: str, owner_id: str) -> str | None:
        """Return the id iff owned by ``owner_id`` — the explicit-ownership gate for mutations."""
        row = await sql.fetch_one(
            self.session,
            "SELECT id FROM funding_application"
            " WHERE id = :id AND student_profile_id = :owner AND deleted_at IS NULL",
            id=application_id,
            owner=owner_id,
        )
        return row[0] if row else None

    async def set_status(self, application_id: str, status: str) -> None:
        await sql.execute(
            self.session,
            "UPDATE funding_application SET status = :s WHERE id = :id",
            s=status,
            id=application_id,
        )

    async def get_full(self, application_id: str):
        return await sql.fetch_one(
            self.session,
            f"SELECT {_APPLICATION_COLS} FROM funding_application fa"
            " WHERE fa.id = :id AND fa.deleted_at IS NULL",
            id=application_id,
            **SLA_PARAMS,
        )

    async def set_priority(self, application_id: str, priority: str) -> None:
        """Set triage rank (D-002/D-013). Caller is staff (reviewer ctx); RLS admits the write."""
        await sql.execute(
            self.session,
            "UPDATE funding_application SET priority = :p WHERE id = :id",
            p=priority,
            id=application_id,
        )

    async def list_for_owner(self, owner_id: str, *, limit: int, after=None):
        """A student's own applications, newest first — their history, not a triage queue."""
        where = "fa.student_profile_id = :owner AND fa.deleted_at IS NULL"
        params: dict = {"owner": owner_id}
        if after is not None:
            where += " AND (fa.created_at, fa.id) < (:c_created, :c_id)"
            params |= {"c_created": after[0], "c_id": after[1]}
        return await sql.fetch_all(
            self.session,
            f"SELECT {_APPLICATION_COLS} FROM funding_application fa WHERE {where}"
            " ORDER BY fa.created_at DESC, fa.id DESC LIMIT :limit",
            limit=limit + 1,
            **params,
            **SLA_PARAMS,
        )

    async def list_for_review(
        self, *, status: str | None, limit: int, after=None, reviewer_id: str | None = None
    ):
        """The review queue, ordered for TRIAGE (D-002 / D-013) — not by arrival.

        It used to be ``ORDER BY created_at DESC``: newest first, priority ignored. A CRITICAL
        application — Lerato, defunded at year-end — waited behind every NORMAL one that arrived
        after her, and the reviewer had no due date to see it coming.

        Order, every key ascending so one keyset cursor covers it:
          1. priority, highest first   (-lk_priority.rank)
          2. review due date, soonest   (no SLA sorts last)
          3. needed_by, soonest         (not given sorts last)
          4. waited longest             (created_at)
          5. id                         (deterministic tiebreak)

        ``after`` is the five sort keys of the last row on the previous page (decode_keyset).
        Sentinels replace NULLs so the row comparison never meets a NULL.

        Every cursor bind is cast to TEXT first and then to its type. asyncpg infers a bind's type
        from the cast around it and will not accept a string where it inferred timestamptz, so
        ``CAST(:x AS timestamptz)`` fails at runtime with a string cursor value.
        """
        where = "fa.deleted_at IS NULL"
        params: dict = {}
        if status:
            where += " AND fa.status = :status"
            params["status"] = status
        else:
            # No status means THE QUEUE: everything whose next step is a person's. It used to mean
            # every application ever made, drafts and decisions included.
            where += " AND fa.status = ANY(:awaiting_human)"
            params["awaiting_human"] = list(AWAITING_HUMAN_STATUSES)
        if reviewer_id:
            # BR-E09 / E8: an application the reviewer stepped aside from leaves THEIR queue and
            # stays in everyone else's — that is what "the case is reassigned" means here.
            where += (
                " AND NOT EXISTS (SELECT 1 FROM recusal rc"
                "  WHERE rc.application_id = fa.id AND rc.reviewer_id = :reviewer_id)"
            )
            params["reviewer_id"] = reviewer_id
        cursor_clause = ""
        if after is not None:
            cursor_clause = (
                "WHERE (k_rank, k_due, k_needed, created_at, id) >"
                " (CAST(CAST(:k_rank AS text) AS int), CAST(CAST(:k_due AS text) AS timestamptz),"
                " CAST(CAST(:k_needed AS text) AS date),"
                "  CAST(CAST(:k_created AS text) AS timestamptz), CAST(:k_id AS text))"
            )
            params |= dict(
                zip(("k_rank", "k_due", "k_needed", "k_created", "k_id"), after, strict=True)
            )
        return await sql.fetch_all(
            self.session,
            "WITH base AS ("
            f"  SELECT {_APPLICATION_COLS}, lp.rank AS priority_rank"
            "   FROM funding_application fa JOIN lk_priority lp ON lp.code = fa.priority"
            f"  WHERE {where}"
            "), keyed AS ("
            "  SELECT *, -priority_rank AS k_rank,"
            "         COALESCE(review_due_at,"
            "                  CAST(CAST(:no_deadline AS text) AS timestamptz)) AS k_due,"
            "         COALESCE(needed_by, CAST(CAST(:no_deadline AS text) AS date)) AS k_needed"
            "    FROM base"
            ")"
            # k_due / k_needed stay in SQL: 'infinity' has no Python datetime, so returning it
            # would crash the driver on the first application without an SLA. The service
            # rebuilds the same cursor from review_due_at / needed_by (review_queue_cursor).
            " SELECT id, application_type, academic_year, requested_amount, status, currency,"
            "        created_at, priority, needed_by, review_due_at, k_rank"
            f"   FROM keyed {cursor_clause}"
            "  ORDER BY k_rank, k_due, k_needed, created_at, id"
            "  LIMIT :limit",
            limit=limit + 1,
            no_deadline=NO_DEADLINE,
            **params,
            **SLA_PARAMS,
        )


class TransitionRepository(BaseRepository):
    async def allowed(self, from_status: str, to_status: str) -> bool:
        row = await sql.fetch_one(
            self.session,
            "SELECT 1 FROM app_status_transition WHERE from_status = :f AND to_status = :t",
            f=from_status,
            t=to_status,
        )
        return row is not None


class StatusEventRepository(BaseRepository):
    async def insert(
        self,
        *,
        application_id: str,
        from_status: str | None,
        to_status: str,
        actor_user_id: str,
        note: str | None = None,
    ) -> None:
        # created_at = clock_timestamp() (wall clock), NOT now() (transaction start): a single
        # transaction can write several events (submit → pre-screen), and "latest event = cache"
        # (DB-D24 / the integrity job) needs them strictly ordered, not tied at the txn timestamp.
        await sql.execute(
            self.session,
            "INSERT INTO application_status_event"
            " (id, application_id, from_status, to_status, actor_user_id, note, created_at)"
            " VALUES (:id, :app, :from, :to, :actor, :note, clock_timestamp())",
            id=cuid(),
            app=application_id,
            **{"from": from_status, "to": to_status},
            actor=actor_user_id,
            note=note,
        )

    async def decision(self, application_id: str):
        """The decision event a student is owed: its note, its time, and the status.

        The reviewer's words were always here — `admin_review` passes its `note`
        straight to the transition — and nothing ever read them back out, so the
        student saw a status and no reason (#220). This is that read.

        Only terminal, decided statuses count. A move to UNDER_REVIEW carries a
        note too, and it is an internal triage remark, not something written to
        be read by the applicant.
        """
        return await sql.fetch_one(
            self.session,
            "SELECT to_status, note, created_at FROM application_status_event"
            " WHERE application_id = :app"
            "   AND to_status IN ('APPROVED', 'APPROVED_WAITLISTED', 'REJECTED', 'REJECTED_FINAL')"
            " ORDER BY created_at DESC LIMIT 1",
            app=application_id,
        )

    async def actor_of(self, application_id: str, to_status: str) -> str | None:
        """Who last moved this application INTO ``to_status``.

        The two-person rule (MASTER-SPEC §16.4) has to know who proposed a decision before it can
        refuse to let that same person authorise it. The append-only status event is the only
        record of that, and the only one the caller cannot supply or edit.
        """
        row = await sql.fetch_one(
            self.session,
            "SELECT actor_user_id FROM application_status_event"
            " WHERE application_id = :app AND to_status = :to"
            " ORDER BY created_at DESC LIMIT 1",
            app=application_id,
            to=to_status,
        )
        return row[0] if row else None

    async def waitlist_position(self, application_id: str) -> int | None:
        """Where this application sits on the waitlist, 1-based (E4).

        Delegates to `fn_waitlist_position` (migration 0019). The count must see
        other students' applications, which the caller's RLS context deliberately
        cannot — so a query written here would return 1 for everybody, on the one
        screen whose entire purpose is telling the truth. The function is
        SECURITY DEFINER and returns only the integer.

        Returns None when the application is not on the waitlist, which is what
        the response model wants for every other status.
        """
        row = await sql.fetch_one(
            self.session,
            "SELECT fn_waitlist_position(:app)",
            app=application_id,
        )
        return None if row is None or row[0] is None else int(row[0])


class MotivationRepository(BaseRepository):
    async def insert(
        self,
        *,
        application_id: str,
        situation: str,
        why_not_categories: str,
        support_needed: str,
        language: str,
    ) -> None:
        await sql.execute(
            self.session,
            "INSERT INTO application_motivation"
            " (id, application_id, situation, why_not_categories, support_needed, language,"
            "  created_by)"
            " VALUES (:id, :app, :sit, :why, :sup, :lang, :app)",
            id=cuid(),
            app=application_id,
            sit=situation,
            why=why_not_categories,
            sup=support_needed,
            lang=language,
        )

    async def get(self, application_id: str):
        return await sql.fetch_one(
            self.session,
            "SELECT situation, why_not_categories, support_needed, language"
            " FROM application_motivation WHERE application_id = :app",
            app=application_id,
        )

    async def id_for(self, application_id: str) -> str | None:
        """The motivation row a theme tag hangs off — None when the application has none."""
        row = await sql.fetch_one(
            self.session,
            "SELECT id FROM application_motivation WHERE application_id = :app",
            app=application_id,
        )
        return row[0] if row else None


class ThemeTagRepository(BaseRepository):
    """MASTER-SPEC §5.6 / D-018 — the reviewer's characterisation of an OTHER-category case.

    Staff-only by RLS (rls_mtt_read / rls_mtt_insert, migration 0009), with no DELETE policy: a
    theme is a record of a reviewer's judgement, not a working note, and the quarterly cluster it
    feeds would be a different number if tags could be quietly withdrawn.
    """

    async def tags_for(self, application_id: str) -> list[str]:
        rows = await sql.fetch_all(
            self.session,
            "SELECT t.tag FROM motivation_theme_tag t"
            " JOIN application_motivation m ON m.id = t.motivation_id"
            " WHERE m.application_id = :app ORDER BY t.tag",
            app=application_id,
        )
        return [row[0] for row in rows]

    async def add(self, *, motivation_id: str, tags: list[str], tagged_by: str) -> None:
        """Add tags, ignoring any the case already carries.

        ``ON CONFLICT DO NOTHING`` against uq_motiv_tag rather than a read-then-write: a reviewer
        adding a second theme should not have to remember the first, and two reviewers tagging the
        same case at once must not turn into a 500. The original ``tagged_by`` is kept — the first
        person to see the theme is the one who saw it.
        """
        for tag in tags:
            await sql.execute(
                self.session,
                "INSERT INTO motivation_theme_tag (id, motivation_id, tag, tagged_by)"
                " VALUES (:id, :mid, :tag, :by) ON CONFLICT (motivation_id, tag) DO NOTHING",
                id=cuid(),
                mid=motivation_id,
                tag=tag,
                by=tagged_by,
            )

    async def clusters(self, window_days: int):
        """Theme counts over the window, most frequent first — the §5.6 quarterly report.

        Counts DISTINCT applications, not tag rows: one case carrying three themes is one case,
        and counting rows would make a thorough reviewer look like a trend. The tie-break on tag
        keeps the report stable between runs when two themes are level.
        """
        return await sql.fetch_all(
            self.session,
            "SELECT t.tag, count(DISTINCT m.application_id) AS applications"
            " FROM motivation_theme_tag t"
            " JOIN application_motivation m ON m.id = t.motivation_id"
            " WHERE t.created_at >= now() - make_interval(days => :days)"
            " GROUP BY t.tag ORDER BY applications DESC, t.tag",
            days=window_days,
        )

    async def tagged_applications(self, window_days: int) -> int:
        """The denominator: a theme on 4 of 5 cases means something a theme on 4 of 400 does not."""
        row = await sql.fetch_one(
            self.session,
            "SELECT count(DISTINCT m.application_id) FROM motivation_theme_tag t"
            " JOIN application_motivation m ON m.id = t.motivation_id"
            " WHERE t.created_at >= now() - make_interval(days => :days)",
            days=window_days,
        )
        return int(row[0]) if row else 0


class PreScreenReadRepository(BaseRepository):
    async def latest(self, application_id: str):
        """Latest pre-screen outcome for the response (populated by module 3; None until then)."""
        return await sql.fetch_one(
            self.session,
            "SELECT outcome, checks FROM pre_screen_result"
            " WHERE application_id = :app ORDER BY created_at DESC LIMIT 1",
            app=application_id,
        )


class OutboxRepository(BaseRepository):
    """notification_outbox enqueue (BR-N01) — STAFF/SYSTEM context only (rls_no_insert)."""

    async def enqueue(
        self,
        *,
        user_id: str,
        trigger: str,
        payload: dict,
        channels: list[str] | None = None,
    ) -> None:
        import json

        await sql.execute(
            self.session,
            "INSERT INTO notification_outbox (id, user_id, trigger, channels, payload)"
            " VALUES (:id, :uid, :trig, :ch, :payload)",
            id=cuid(),
            uid=user_id,
            trig=trigger,
            ch=channels or ["EMAIL", "IN_APP"],  # preference/consent refinement lands in module 6
            payload=json.dumps(payload),
        )


class ReturnReminderScanRepository(BaseRepository):
    """Open returns owed a reminder (D-006) — scanned by ``app.modules.application.jobs``."""

    # Both kinds share one shape; each is sent at most once per return (the NOT EXISTS below), so a
    # job that runs twice in a day, or catches up after a missed day, never nags twice.
    _SCAN = (
        "SELECT ar.id, fa.id, fa.student_profile_id, ar.respond_by"
        "  FROM application_return ar"
        "  JOIN funding_application fa ON fa.id = ar.application_id"
        " WHERE ar.resolved_at IS NULL AND ar.respond_by IS NOT NULL"
        "   AND fa.deleted_at IS NULL AND fa.status = 'RETURNED_FOR_INFO'"
        "   AND {window}"
        "   AND NOT EXISTS ("
        "     SELECT 1 FROM notification_outbox o"
        "      WHERE o.user_id = fa.student_profile_id"
        "        AND o.trigger = 'APPLICATION_RETURN_REMINDER'"
        "        AND o.payload->>'return_id' = ar.id AND o.payload->>'kind' = :kind)"
        " ORDER BY ar.respond_by, ar.id"
    )

    async def due_soon(self) -> list:
        """Not yet past ``respond_by``, and within ``return_reminder_lead_days`` of it (config)."""
        return await sql.fetch_all(
            self.session,
            self._SCAN.format(
                window="ar.respond_by >= current_date AND ar.respond_by <= current_date"
                " + (SELECT value::int FROM config WHERE key = 'return_reminder_lead_days')"
            ),
            kind="BEFORE_DUE",
        )

    async def past_due(self) -> list:
        """``respond_by`` has passed and the student has not sent anything yet."""
        return await sql.fetch_all(
            self.session,
            self._SCAN.format(window="ar.respond_by < current_date"),
            kind="AFTER_DUE",
        )


class RecusalRepository(BaseRepository):
    """BR-E09: append-only recusals (fn_block_mutation) — a recusal cannot be quietly withdrawn."""

    async def exists(self, application_id: str, reviewer_id: str) -> bool:
        row = await sql.fetch_one(
            self.session,
            "SELECT 1 FROM recusal WHERE application_id = :app AND reviewer_id = :rev",
            app=application_id,
            rev=reviewer_id,
        )
        return row is not None

    async def create(self, *, application_id: str, reviewer_id: str, reason: str):
        try:
            return await sql.fetch_one(
                self.session,
                "INSERT INTO recusal (id, application_id, reviewer_id, reason)"
                " VALUES (:id, :app, :rev, :reason) RETURNING application_id, created_at",
                id=cuid(),
                app=application_id,
                rev=reviewer_id,
                reason=reason,
            )
        except IntegrityError as exc:  # uq_recusal (application_id, reviewer_id)
            raise AppError(
                "already_recused",
                "You have already stepped aside from this application",
                status_code=409,
            ) from exc


class AppealRepository(BaseRepository):
    async def exists_for(self, application_id: str) -> bool:
        row = await sql.fetch_one(
            self.session,
            "SELECT 1 FROM appeal WHERE application_id = :app",
            app=application_id,
        )
        return row is not None

    async def create(
        self, *, application_id: str, new_information: str, original_decider_id: str
    ) -> str:
        appeal_id = cuid()
        try:
            await sql.execute(
                self.session,
                "INSERT INTO appeal (id, application_id, new_information, original_decider_id)"
                " VALUES (:id, :app, :info, :decider)",
                id=appeal_id,
                app=application_id,
                info=new_information,
                decider=original_decider_id,
            )
        except IntegrityError as exc:  # one appeal per application (uq via application_id UNIQUE)
            raise AppError(
                "appeal_exists", "This application has already been appealed", status_code=409
            ) from exc
        return appeal_id

    async def open_for(self, application_id: str):
        """The appeal still awaiting a ruling: (id, original_decider_id), or None.

        BR-E07 lives on this row. The appeal reviewer must not be the person who made the original
        decision, and the answer comes from the record written when the appeal was lodged.
        """
        return await sql.fetch_one(
            self.session,
            "SELECT id, original_decider_id FROM appeal"
            " WHERE application_id = :app AND reviewed_by IS NULL",
            app=application_id,
        )

    async def rule(self, *, appeal_id: str, reviewed_by: str, outcome: str) -> None:
        """Record who ruled on the appeal, and how (UPHELD / OVERTURNED).

        ``ck_appeal_different_human`` re-checks BR-E07 in the database, so a mistake in the service
        layer cannot write a self-reviewed appeal. The ``reviewed_by IS NULL`` clause means a
        second ruling on an already-ruled appeal changes nothing rather than overwriting history.
        """
        await sql.execute(
            self.session,
            "UPDATE appeal SET reviewed_by = :by, outcome = :outcome"
            " WHERE id = :id AND reviewed_by IS NULL",
            by=reviewed_by,
            outcome=outcome,
            id=appeal_id,
        )

    async def original_decider(self, application_id: str) -> str | None:
        """The human who made the last REJECTED decision — the appeal must go to someone else."""
        row = await sql.fetch_one(
            self.session,
            "SELECT actor_user_id FROM application_status_event"
            " WHERE application_id = :app AND to_status = 'REJECTED'"
            " ORDER BY created_at DESC LIMIT 1",
            app=application_id,
        )
        return row[0] if row else None
