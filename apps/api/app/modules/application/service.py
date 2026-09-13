"""Application service — funding-application lifecycle (BR-S01–S04, BR-E03/E05/E06/E07, BR-N01).

Business logic only; repositories own the SQL (layering S4.79). Context strategy (see RLS
0007/0009):
  * create / list / get run under the caller's context — RLS confines a student to their rows;
  * student-initiated transitions (submit, appeal) elevate to SYSTEM context because the
    notification_outbox insert is staff-only — ownership is then an explicit predicate;
  * admin review runs under the reviewer's own (staff) context — app_is_staff() admits the
    outbox insert, and the actor recorded is the human reviewer (Human-Final, BR-E03).
Every mutation also writes audit_log in the same transaction (S3.33).
"""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal

from app.common.errors import AppError
from app.common.pagination import (
    clamp_limit,
    decode_cursor,
    decode_keyset,
    encode_cursor,
    encode_keyset,
)
from app.db.context import set_system_context
from app.modules.application.repository import (
    NO_DEADLINE,
    AppealRepository,
    ApplicationRepository,
    MotivationRepository,
    OutboxRepository,
    PreScreenReadRepository,
    RecusalRepository,
    StatusEventRepository,
    TransitionRepository,
)
from app.modules.application.schemas import (
    Application,
    ApplicationInput,
    ApplicationPage,
    Motivation,
    PageMeta,
    PreScreen,
    Recusal,
    ReviewDecision,
)
from app.modules.application.state_machine import ApplicationStateMachine
from app.modules.auth.repository import AuditRepository


def _is_breached(review_due_at: datetime | None) -> bool | None:
    """Late, on time, or not applicable (no review owed)."""
    if review_due_at is None:
        return None
    return review_due_at < datetime.now(UTC)


def review_queue_cursor(row) -> str:
    """The five sort keys of a review-queue row, in the order list_for_review sorts by.

    Rebuilt here rather than returned by SQL because the "no deadline" sentinel is 'infinity',
    which has no Python datetime. It uses the repository's NO_DEADLINE so the cursor and the
    ORDER BY cannot drift apart.
    """
    due = row[9].isoformat() if row[9] is not None else NO_DEADLINE
    needed = row[8].isoformat() if row[8] is not None else NO_DEADLINE
    return encode_keyset(row[10], due, needed, row[6], row[0])

class ApplicationService:
    def __init__(self, session) -> None:
        self.session = session
        self.apps = ApplicationRepository(session)
        self.motivations = MotivationRepository(session)
        self.pre_screens = PreScreenReadRepository(session)
        self.status_events = StatusEventRepository(session)
        self.appeals = AppealRepository(session)
        self.recusals = RecusalRepository(session)
        self.audit = AuditRepository(session)
        self.engine = ApplicationStateMachine(
            transitions=TransitionRepository(session),
            events=StatusEventRepository(session),
            applications=self.apps,
            outbox=OutboxRepository(session),
        )

    # --------------------------- response assembly ---------------------------
    async def _to_application(
        self, row, *, with_motivation: bool, detail: bool = True
    ) -> Application:
        # detail=False is the LIST projection: skip the per-row motivation + pre-screen reads that
        # would otherwise make a page N+1 (ST-3.7). The list's `status` already encodes the
        # pre-screen outcome (READY_FOR_REVIEW / RETURNED_FOR_INFO / UNSCREENED), so nothing
        # actionable is lost; the full report is fetched on the single-application detail view.
        app_id = row[0]
        motivation = None
        if detail and with_motivation:
            m = await self.motivations.get(app_id)
            if m is not None:
                motivation = Motivation(
                    situation=m[0], why_not_categories=m[1], support_needed=m[2], language=m[3]
                )
        pre_screen = None
        if detail and (latest := await self.pre_screens.latest(app_id)) is not None:
            checks = latest[1] or {}
            pre_screen = PreScreen(
                outcome=latest[0],
                fix_list=checks.get("fix_list", []) if isinstance(checks, dict) else [],
                annotations=checks.get("annotations", []) if isinstance(checks, dict) else [],
                cycle_no=checks.get("cycle_no") if isinstance(checks, dict) else None,
            )
        # The decision, carried back to the person it is about (#220).
        #
        # Detail view only: this is one extra read, and the list projection is
        # deliberately kept to one query per page (ST-3.7). A student reads the
        # reason on the decision screen, which is the detail view by definition.
        decision_reason = None
        decided_at = None
        waitlist_position = None
        if detail and (decision := await self.status_events.decision(app_id)) is not None:
            decision_reason = decision[1]
            decided_at = decision[2]
            if decision[0] == "APPROVED_WAITLISTED":
                waitlist_position = await self.apps_waitlist_position(app_id)

        return Application(
            id=app_id,
            application_type=row[1],
            academic_year=row[2],
            requested_amount=None if row[3] is None else str(row[3]),
            status=row[4],
            currency=row[5],
            created_at=row[6],
            priority=row[7],  # on the row — no extra query (kept out of the N+1, ST-3.7)
            needed_by=row[8],
            motivation=motivation,
            pre_screen=pre_screen,
            decision_reason=decision_reason,
            decided_at=decided_at,
            waitlist_position=waitlist_position,
            review_due_at=row[9],
            sla_breached=_is_breached(row[9]),
        )

    async def apps_waitlist_position(self, app_id: str) -> int | None:
        """Position on the waitlist, via the SECURITY DEFINER function (0019)."""
        return await self.status_events.waitlist_position(app_id)

    async def _load_response(self, app_id: str, *, is_other: bool | None = None) -> Application:
        row = await self.apps.get_full(app_id)
        want_motivation = (row[1] == "OTHER") if is_other is None else is_other
        return await self._to_application(row, with_motivation=want_motivation)

    async def load_application(self, app_id: str) -> Application:
        """Public read used by the eligibility module after a resubmit (caller controls context)."""
        return await self._load_response(app_id)

    # --------------------------------- create --------------------------------
    async def create_application(
        self, *, actor_id: str, data: ApplicationInput, request_id: str
    ) -> Application:
        if not await self.apps.has_profile(actor_id):
            raise AppError(
                "profile_required",
                "Create your profile before starting an application",
                status_code=409,
            )
        amount = Decimal(data.requested_amount) if data.requested_amount else None
        app_id = await self.apps.create(
            student_profile_id=actor_id,
            application_type=data.application_type.value,
            academic_year=data.academic_year,
            requested_amount=amount,
            household_income_band=(
                data.household_income_band.value if data.household_income_band else None
            ),
            nsfas_decline_reason=(
                data.nsfas_decline_reason.value if data.nsfas_decline_reason else None
            ),
            prior_funder=data.prior_funder.value if data.prior_funder else None,
            defunded_by=data.defunded_by,
            needed_by=data.needed_by,
        )
        if data.application_type.value == "OTHER" and data.motivation is not None:
            await self.motivations.insert(
                application_id=app_id,
                situation=data.motivation.situation,
                why_not_categories=data.motivation.why_not_categories,
                support_needed=data.motivation.support_needed,
                language=data.motivation.language,
            )
        await self.audit.write(
            actor_user_id=actor_id,
            action="APPLICATION_CREATED",
            resource_type="funding_application",
            resource_id=app_id,
            request_id=request_id,
            detail={"application_type": data.application_type.value},
        )
        return await self._load_response(app_id, is_other=data.application_type.value == "OTHER")

    # ------------------------------ reads (RLS) ------------------------------
    async def get_application(self, *, actor_id: str, application_id: str) -> Application:
        row = await self.apps.get_full(application_id)  # RLS confines to own rows
        if row is None:
            raise AppError("application_not_found", "Application not found", status_code=404)
        return await self._to_application(row, with_motivation=row[1] == "OTHER")

    async def admin_get_application(
        self, *, application_id: str, reviewer_id: str | None = None
    ) -> Application:
        """One application for a reviewer (A02).

        Runs under the reviewer's RLS context, which admits any application, and always includes
        the motivation: a reviewer reads the applicant's own words first, whatever the category.
        """
        row = await self.apps.get_full(application_id)
        if row is None:
            raise AppError("application_not_found", "Application not found", status_code=404)
        application = await self._to_application(row, with_motivation=True)
        if reviewer_id:
            application.recused_by_me = await self.recusals.exists(application_id, reviewer_id)
        return application

    async def recuse(
        self, *, reviewer_id: str, application_id: str, reason: str, request_id: str
    ) -> Recusal:
        """BR-E09 / E8 — a reviewer steps aside from an application they have a conflict with.

        Recorded on the append-only recusal table and audited. The reason stays on the recusal
        record (staff-only RLS) and is not copied into the audit detail.
        """
        if await self.apps.owner_of(application_id) is None:
            raise AppError("application_not_found", "Application not found", status_code=404)
        row = await self.recusals.create(
            application_id=application_id, reviewer_id=reviewer_id, reason=reason
        )
        await self.audit.write(
            actor_user_id=reviewer_id,
            action="APPLICATION_RECUSED",
            resource_type="funding_application",
            resource_id=application_id,
            request_id=request_id,
        )
        return Recusal(application_id=row[0], created_at=row[1])

    async def _refuse_if_recused(self, application_id: str, reviewer_id: str) -> None:
        """BR-E09: a recused reviewer cannot act on that application."""
        if await self.recusals.exists(application_id, reviewer_id):
            raise AppError(
                "reviewer_recused",
                "You stepped aside from this application, so another reviewer must act on it",
                status_code=403,
            )

    async def list_my_applications(
        self, *, actor_id: str, cursor: str | None, limit: int | None
    ) -> ApplicationPage:
        n = clamp_limit(limit)
        rows = await self.apps.list_for_owner(actor_id, limit=n, after=decode_cursor(cursor))
        return await self._page(rows, n)

    # ------------------------------- transitions -----------------------------
    async def submit_application(
        self, *, actor_id: str, application_id: str, request_id: str
    ) -> Application:
        await set_system_context(self.session)  # outbox insert is staff-only
        if await self.apps.owned_id(application_id, actor_id) is None:
            raise AppError("application_not_found", "Application not found", status_code=404)
        # D-007: the SA ID (blind-indexed) must be on file before SUBMIT — it is what makes
        # duplicate detection real at the moment money is at stake. Registration stays
        # frictionless; the gate is here, not at sign-up.
        if not await self.apps.has_sa_id(actor_id):
            raise AppError(
                "sa_id_required",
                "Add your SA ID number to your profile before submitting",
                status_code=409,
            )
        await self.engine.transition(
            application_id=application_id,
            owner_user_id=actor_id,
            to_status="SUBMITTED",
            actor_user_id=actor_id,
            request_id=request_id,
        )
        await self.audit.write(
            actor_user_id=actor_id,
            action="APPLICATION_SUBMITTED",
            resource_type="funding_application",
            resource_id=application_id,
            request_id=request_id,
        )
        # Eligibility pre-screening (module 3) runs in this SAME transaction, advancing the
        # application to READY_FOR_REVIEW / RETURNED_FOR_INFO / UNSCREENED. The deferred import
        # breaks the application↔eligibility cycle (eligibility reuses this module's engine).
        from app.modules.eligibility.service import EligibilityService

        await EligibilityService(self.session).pre_screen(
            application_id=application_id, owner_id=actor_id, request_id=request_id
        )
        return await self._load_response(application_id)

    async def appeal(
        self, *, actor_id: str, application_id: str, new_information: str, request_id: str
    ) -> Application:
        await set_system_context(self.session)  # appeal/outbox inserts under staff context
        if await self.apps.owned_id(application_id, actor_id) is None:
            raise AppError("application_not_found", "Application not found", status_code=404)
        if await self.appeals.exists_for(application_id):
            raise AppError(
                "appeal_exists", "This application has already been appealed", status_code=409
            )
        original_decider = await self.appeals.original_decider(application_id) or "SYSTEM"
        await self.appeals.create(
            application_id=application_id,
            new_information=new_information,
            original_decider_id=original_decider,
        )
        # REJECTED → APPEALED (the engine rejects this if the app is not REJECTED, BR-S04).
        await self.engine.transition(
            application_id=application_id,
            owner_user_id=actor_id,
            to_status="APPEALED",
            actor_user_id=actor_id,
            request_id=request_id,
        )
        await self.audit.write(
            actor_user_id=actor_id,
            action="APPLICATION_APPEALED",
            resource_type="funding_application",
            resource_id=application_id,
            request_id=request_id,
        )
        return await self._load_response(application_id)

    # --------------------------------- admin ---------------------------------
    async def admin_list(
        self,
        *,
        status: str | None,
        cursor: str | None,
        limit: int | None,
        reviewer_id: str | None = None,
    ) -> ApplicationPage:
        n = clamp_limit(limit)
        rows = await self.apps.list_for_review(
            status=status, limit=n, after=decode_keyset(cursor, 5), reviewer_id=reviewer_id
        )
        has_more = len(rows) > n
        page = rows[:n]
        items = [await self._to_application(r, with_motivation=False, detail=False) for r in page]
        next_cursor = review_queue_cursor(page[-1]) if has_more and page else None
        return ApplicationPage(items=items, meta=PageMeta(next_cursor=next_cursor))

    async def set_priority(
        self,
        *,
        reviewer_id: str,
        application_id: str,
        priority: str,
        note: str | None,
        request_id: str,
    ) -> Application:
        """D-002/D-013: only ADMIN_REVIEWER+ raises priority (anti-gaming), under reviewer ctx."""
        if await self.apps.owner_of(application_id) is None:
            raise AppError("application_not_found", "Application not found", status_code=404)
        await self._refuse_if_recused(application_id, reviewer_id)
        await self.apps.set_priority(application_id, priority)
        await self.audit.write(
            actor_user_id=reviewer_id,
            action="APPLICATION_PRIORITY_SET",
            resource_type="funding_application",
            resource_id=application_id,
            request_id=request_id,
            detail={"priority": priority, "note": note},
        )
        return await self._load_response(application_id)

    async def admin_review(
        self,
        *,
        reviewer_id: str,
        application_id: str,
        decision: ReviewDecision,
        note: str | None,
        request_id: str,
    ) -> Application:
        owner = await self.apps.owner_of(application_id)
        if owner is None:
            raise AppError("application_not_found", "Application not found", status_code=404)
        await self._refuse_if_recused(application_id, reviewer_id)
        # The reviewer (staff) is the actor — Human-Final (BR-E03) is satisfied by a human actor.
        await self.engine.transition(
            application_id=application_id,
            owner_user_id=owner,
            to_status=decision.value,
            actor_user_id=reviewer_id,
            request_id=request_id,
            note=note,
        )
        await self.audit.write(
            actor_user_id=reviewer_id,
            action="APPLICATION_REVIEWED",
            resource_type="funding_application",
            resource_id=application_id,
            request_id=request_id,
            detail={"decision": decision.value},
        )
        return await self._load_response(application_id)

    # ------------------------------- pagination ------------------------------
    async def _page(self, rows, limit: int) -> ApplicationPage:
        has_more = len(rows) > limit
        page = rows[:limit]
        # List projection (detail=False): one row = one query, never N+1 (ST-3.7).
        items = [await self._to_application(r, with_motivation=False, detail=False) for r in page]
        next_cursor = encode_cursor(page[-1][6], page[-1][0]) if has_more and page else None
        return ApplicationPage(items=items, meta=PageMeta(next_cursor=next_cursor))
