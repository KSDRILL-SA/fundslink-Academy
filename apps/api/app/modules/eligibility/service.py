"""Eligibility service — the pre-screening engine flow (BR-E01/E02/E04, MASTER-SPEC §5.7).

Runs inside the submit/resubmit transaction (the caller has set SYSTEM RLS context — pre-screen
writes are staff-only). The engine:
  SUBMITTED/RESUBMITTED → PRE_SCREENING → READY_FOR_REVIEW | RETURNED_FOR_INFO | UNSCREENED.
A RETURN is never a rejection (it carries a kind fix-list); after 3 return cycles the case is
flagged for direct human outreach (BR-E04). If the engine can't evaluate (no ruleset / failure),
the application degrades to UNSCREENED and flows straight to the human queue — students are never
blocked by our machinery (§5.7 / S8.51). Every status hop reuses the module-2 state machine, so
the outbox enqueue (BR-N01) and Human-Final guard (BR-E03) apply uniformly.
"""

from __future__ import annotations

from app.modules.application.repository import (
    ApplicationRepository,
    OutboxRepository,
    StatusEventRepository,
    TransitionRepository,
)
from app.modules.application.state_machine import ApplicationStateMachine
from app.modules.auth.repository import AuditRepository
from app.modules.eligibility.repository import (
    FactsRepository,
    PreScreenResultRepository,
    ReturnRepository,
    RulesetRepository,
)
from app.modules.eligibility.rule_engine import READY, RETURNED, Facts, evaluate

OUTREACH_CYCLE = 3  # after this many returns, a human reaches out directly (BR-E04)

# pre_screen_result.outcome → the application status it drives.
_STATUS_FOR = {READY: "READY_FOR_REVIEW", RETURNED: "RETURNED_FOR_INFO"}


class EligibilityService:
    def __init__(self, session) -> None:
        self.session = session
        self.apps = ApplicationRepository(session)
        self.rulesets = RulesetRepository(session)
        self.facts = FactsRepository(session)
        self.results = PreScreenResultRepository(session)
        self.returns = ReturnRepository(session)
        self.audit = AuditRepository(session)
        self.engine = ApplicationStateMachine(
            transitions=TransitionRepository(session),
            events=StatusEventRepository(session),
            applications=self.apps,
            outbox=OutboxRepository(session),
        )

    async def pre_screen(self, *, application_id: str, owner_id: str, request_id: str) -> None:
        """Screen a SUBMITTED/RESUBMITTED application. Caller is already in SYSTEM context."""
        await self.engine.transition(
            application_id=application_id,
            owner_user_id=owner_id,
            to_status="PRE_SCREENING",
            actor_user_id="SYSTEM",
            request_id=request_id,
        )
        try:
            full = await self.apps.get_full(application_id)
            ruleset = await self._pinned_or_effective(application_id, full[1])
            if ruleset is None:
                return await self._degrade(application_id, owner_id, request_id, "no_ruleset")
            ruleset_id, rules = ruleset[0], ruleset[1]
            facts = Facts(
                document_types=await self.facts.document_types(owner_id),
                has_motivation=await self.facts.has_motivation(application_id),
            )
            outcome = evaluate(rules, facts)
        except Exception as exc:  # engine degraded → UNSCREENED, never block the student (§5.7)
            self._capture(exc)
            return await self._degrade(application_id, owner_id, request_id, "engine_error")

        cycle_no = (
            await self.returns.next_cycle(application_id)
            if outcome.outcome == RETURNED
            else None
        )
        await self.results.insert(
            application_id=application_id,
            ruleset_id=ruleset_id,
            outcome=outcome.outcome,
            checks={
                "results": outcome.results,
                "fix_list": outcome.fix_list,
                "annotations": outcome.annotations,
                "cycle_no": cycle_no,
            },
        )
        await self.engine.transition(
            application_id=application_id,
            owner_user_id=owner_id,
            to_status=_STATUS_FOR[outcome.outcome],
            actor_user_id="SYSTEM",
            request_id=request_id,
        )
        if outcome.outcome == RETURNED:
            await self.returns.insert(
                application_id=application_id, cycle_no=cycle_no, fix_list=outcome.fix_list
            )
            if cycle_no >= OUTREACH_CYCLE:  # BR-E04 — stop the loop, a human reaches out
                await self.audit.write(
                    actor_user_id="SYSTEM",
                    action="APPLICATION_OUTREACH_FLAGGED",
                    resource_type="funding_application",
                    resource_id=application_id,
                    request_id=request_id,
                    detail={"cycle_no": cycle_no},
                )

    async def resubmit(self, *, actor_id: str, application_id: str, request_id: str):
        from app.common.errors import AppError
        from app.db.context import set_system_context
        from app.modules.application.service import ApplicationService

        await set_system_context(self.session)
        if await self.apps.owned_id(application_id, actor_id) is None:
            raise AppError("application_not_found", "Application not found", status_code=404)
        # RETURNED_FOR_INFO → RESUBMITTED (the engine refuses this if not RETURNED, BR-S04).
        await self.engine.transition(
            application_id=application_id,
            owner_user_id=actor_id,
            to_status="RESUBMITTED",
            actor_user_id=actor_id,
            request_id=request_id,
        )
        await self.returns.mark_resolved(application_id)
        await self.pre_screen(
            application_id=application_id, owner_id=actor_id, request_id=request_id
        )
        return await ApplicationService(self.session).load_application(application_id)

    # ------------------------------- internals -------------------------------
    async def _pinned_or_effective(self, application_id: str, application_type: str):
        pinned = await self.results.pinned_ruleset(application_id)  # version pinned at 1st submit
        if pinned is not None:
            return await self.rulesets.by_id(pinned)
        return await self.rulesets.effective(application_type)

    async def _degrade(
        self, application_id: str, owner_id: str, request_id: str, reason: str
    ) -> None:
        await self.engine.transition(
            application_id=application_id,
            owner_user_id=owner_id,
            to_status="UNSCREENED",
            actor_user_id="SYSTEM",
            request_id=request_id,
        )
        await self.audit.write(
            actor_user_id="SYSTEM",
            action="APPLICATION_UNSCREENED",
            resource_type="funding_application",
            resource_id=application_id,
            request_id=request_id,
            detail={"reason": reason},
        )

    @staticmethod
    def _capture(exc: Exception) -> None:
        try:
            import sentry_sdk

            sentry_sdk.capture_exception(exc)
        except Exception:  # observability must never break the degradation path
            pass
