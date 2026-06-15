"""Application state machine (BR-S04 · BR-E03 · BR-N01) — the lifecycle engine.

One place owns every status change so the invariants can't be bypassed:
  * the transition must exist in ``app_status_transition`` (BR-S04) — illegal → 409;
  * a final decision (APPROVED/REJECTED/REJECTED_FINAL) requires a HUMAN actor (BR-E03) —
    the SYSTEM principal is refused here at the service layer AND by the ``fn_human_final`` DB
    trigger (defence in depth — the trigger is the un-bypassable backstop);
  * the status event (append-only) + the status cache + the notification outbox row are written
    in the caller's SINGLE transaction (BR-N01) — they commit together or not at all.

The caller runs this under SYSTEM RLS context (append-only events + outbox inserts are
staff-only), passing the real ``actor_user_id`` explicitly — context (RLS) and actor (audit /
Human-Final) are independent. Reused by the eligibility engine (module 3) and the final demo.
"""

from __future__ import annotations

from app.common.errors import AppError
from app.db.context import SYSTEM_PRINCIPAL

# Final human-only decisions — mirrors fn_human_final (schema.sql) and BR-E03.
HUMAN_FINAL_STATUSES = frozenset({"APPROVED", "REJECTED", "REJECTED_FINAL"})

# to_status → notification trigger (lk_notify_trigger); None ⇒ no notification for that hop.
STATUS_TRIGGER: dict[str, str | None] = {
    "SUBMITTED": "APPLICATION_SUBMITTED",
    "PRE_SCREENING": None,
    "READY_FOR_REVIEW": "APPLICATION_STATUS_CHANGED",
    "RETURNED_FOR_INFO": "APPLICATION_RETURNED_FOR_INFO",
    "RESUBMITTED": "APPLICATION_STATUS_CHANGED",
    "UNSCREENED": "APPLICATION_STATUS_CHANGED",
    "UNDER_REVIEW": "APPLICATION_STATUS_CHANGED",
    "INTERVIEW_SCHEDULED": "INTERVIEW_SCHEDULED",
    "INTERVIEWED": "APPLICATION_STATUS_CHANGED",
    "APPROVED_PROPOSED": "APPLICATION_STATUS_CHANGED",
    "APPROVED_WAITLISTED": "APPLICATION_STATUS_CHANGED",
    "APPROVED": "DECISION_APPROVED",
    "REJECTED": "DECISION_REJECTED",
    "REJECTED_FINAL": "DECISION_REJECTED",
    "APPEALED": "APPLICATION_STATUS_CHANGED",
    "WITHDRAWN": "APPLICATION_STATUS_CHANGED",
}


class ApplicationStateMachine:
    """Validates and applies a single application status transition + its side effects."""

    def __init__(self, *, transitions, events, applications, outbox) -> None:
        self.transitions = transitions
        self.events = events
        self.applications = applications
        self.outbox = outbox

    async def transition(
        self,
        *,
        application_id: str,
        owner_user_id: str,
        to_status: str,
        actor_user_id: str,
        request_id: str,
        note: str | None = None,
    ) -> str:
        """Apply ``to_status``; returns the previous status. Caller is in SYSTEM RLS context."""
        current = await self.applications.get_status(application_id)
        if current is None:
            raise AppError("application_not_found", "Application not found", status_code=404)

        if current == to_status or not await self.transitions.allowed(current, to_status):
            raise AppError(
                "invalid_transition",
                f"Cannot move an application from {current} to {to_status}",
                status_code=409,
            )

        # BR-E03 Human-Final — refuse the machine for final decisions before the DB trigger does.
        if to_status in HUMAN_FINAL_STATUSES and (
            not actor_user_id or actor_user_id == SYSTEM_PRINCIPAL
        ):
            raise AppError(
                "human_final_required",
                f"{to_status} requires a human actor (Human-Final Principle, BR-E03)",
                status_code=403,
            )

        # status event (append-only) + status cache + outbox — one transaction (BR-N01).
        await self.events.insert(
            application_id=application_id,
            from_status=current,
            to_status=to_status,
            actor_user_id=actor_user_id,
            note=note,
        )
        await self.applications.set_status(application_id, to_status)

        trigger = STATUS_TRIGGER.get(to_status)
        if trigger:
            await self.outbox.enqueue(
                user_id=owner_user_id,
                trigger=trigger,
                payload={
                    "application_id": application_id,
                    "from_status": current,
                    "to_status": to_status,
                },
            )
        return current
