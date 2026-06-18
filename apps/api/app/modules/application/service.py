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

from decimal import Decimal

from app.common.errors import AppError
from app.common.pagination import clamp_limit, decode_cursor, encode_cursor
from app.db.context import set_system_context
from app.modules.application.repository import (
    AppealRepository,
    ApplicationRepository,
    MotivationRepository,
    OutboxRepository,
    PreScreenReadRepository,
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
    ReviewDecision,
)
from app.modules.application.state_machine import ApplicationStateMachine
from app.modules.auth.repository import AuditRepository


class ApplicationService:
    def __init__(self, session) -> None:
        self.session = session
        self.apps = ApplicationRepository(session)
        self.motivations = MotivationRepository(session)
        self.pre_screens = PreScreenReadRepository(session)
        self.appeals = AppealRepository(session)
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
        return Application(
            id=app_id,
            application_type=row[1],
            academic_year=row[2],
            requested_amount=None if row[3] is None else str(row[3]),
            status=row[4],
            currency=row[5],
            motivation=motivation,
            pre_screen=pre_screen,
            created_at=row[6],
        )

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
        self, *, status: str | None, cursor: str | None, limit: int | None
    ) -> ApplicationPage:
        n = clamp_limit(limit)
        rows = await self.apps.list_for_review(
            status=status, limit=n, after=decode_cursor(cursor)
        )
        return await self._page(rows, n)

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
