"""Application request/response schemas (S2.23) — mirrors the contract (S2.7).

Money (``requested_amount``) is carried as a decimal STRING end-to-end and parsed to Decimal in
the service — never float (S5.28 / DB-D29). An OTHER application MUST carry a structured
motivation (BR-S02 / BR-E05); the validator enforces it at the boundary so a missing motivation
is a clean 422, not a downstream surprise.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from enum import StrEnum

from pydantic import BaseModel, Field, field_validator, model_validator


class ApplicationType(StrEnum):
    POSTGRAD = "POSTGRAD"
    UG_CAT_A = "UG_CAT_A"
    UG_CAT_B = "UG_CAT_B"
    UG_CAT_C = "UG_CAT_C"
    OTHER = "OTHER"


class Priority(StrEnum):
    """Triage rank (D-002/D-013) — only ADMIN_REVIEWER+ may raise above NORMAL (anti-gaming)."""

    NORMAL = "NORMAL"
    URGENT = "URGENT"
    CRITICAL = "CRITICAL"


class ReviewDecision(StrEnum):
    """The decisions a reviewer can record (contract adminReview enum)."""

    UNDER_REVIEW = "UNDER_REVIEW"
    INTERVIEW_SCHEDULED = "INTERVIEW_SCHEDULED"
    APPROVED_PROPOSED = "APPROVED_PROPOSED"
    REJECTED = "REJECTED"


class IncomeBand(StrEnum):
    """Self-declared household income band (D-016/D-017) — mirrors the national funding line."""

    SASSA_GRANT = "SASSA_GRANT"
    LTE_350K = "LTE_350K"
    MISSING_MIDDLE_350_600K = "MISSING_MIDDLE_350_600K"
    GT_600K = "GT_600K"
    PREFER_NOT_TO_SAY = "PREFER_NOT_TO_SAY"


class NsfasDeclineReason(StrEnum):
    """Reason read off the required NSFAS outcome letter for UG_CAT_C (D-016) — bounds §5.4."""

    MEANS_INCOME = "MEANS_INCOME"
    DOCUMENTATION = "DOCUMENTATION"
    ADMINISTRATIVE = "ADMINISTRATIVE"
    ACADEMIC_NPLUS = "ACADEMIC_NPLUS"
    OTHER = "OTHER"


class PriorFunder(StrEnum):
    NSFAS = "NSFAS"
    OTHER_BURSARY = "OTHER_BURSARY"
    SELF = "SELF"
    NONE = "NONE"


class Motivation(BaseModel):
    situation: str = Field(min_length=1, max_length=4000)
    why_not_categories: str = Field(min_length=1, max_length=4000)
    support_needed: str = Field(min_length=1, max_length=4000)
    language: str = "en"  # any SA official language (E11) — DB ck_motiv_language validates


class ApplicationInput(BaseModel):
    application_type: ApplicationType
    academic_year: str = Field(min_length=4, max_length=9)
    requested_amount: str | None = Field(default=None, description="Decimal ZAR string (DB-D29)")
    # Self-declared eligibility signals (D-016/D-017). Optional at the boundary; the ruleset +
    # human reviewer apply them — the engine only annotates, never rejects (§5.7).
    household_income_band: IncomeBand | None = None
    nsfas_decline_reason: NsfasDeclineReason | None = None
    prior_funder: PriorFunder | None = None
    defunded_by: str | None = Field(default=None, max_length=200)
    needed_by: date | None = None  # student's urgency *request* (D-002/D-013); not a priority set
    motivation: Motivation | None = None

    @field_validator("requested_amount")
    @classmethod
    def _positive_decimal(cls, v: str | None) -> str | None:
        if v is None:
            return v
        try:
            amount = Decimal(v)
        except (InvalidOperation, ValueError) as exc:
            raise ValueError("requested_amount must be a decimal string") from exc
        if amount <= 0:
            raise ValueError("requested_amount must be greater than zero")
        return v

    @model_validator(mode="after")
    def _other_requires_motivation(self) -> ApplicationInput:
        if self.application_type == ApplicationType.OTHER and self.motivation is None:
            raise ValueError("An OTHER application requires a structured motivation (BR-E05)")
        return self


class PreScreen(BaseModel):
    outcome: str | None = None
    fix_list: list[str] = Field(default_factory=list)
    annotations: list[str] = Field(default_factory=list)  # advisory review flags (D-016/D-017)
    cycle_no: int | None = None


class Application(BaseModel):
    id: str
    application_type: ApplicationType
    academic_year: str
    requested_amount: str | None = None
    status: str
    priority: str = "NORMAL"
    needed_by: date | None = None
    currency: str = "ZAR"
    motivation: Motivation | None = None
    pre_screen: PreScreen | None = None
    # The decision, carried back to the person it is about (#220, L4 ruling).
    # `decision_reason` is the reviewer's own note from adminReview — already
    # recorded on the status event, and until now never readable by the student,
    # which made the kind rejection (§5.8) impossible to render as specified.
    decision_reason: str | None = None
    decided_at: datetime | None = None
    # Only meaningful on APPROVED_WAITLISTED (E4). No pool size: see the contract.
    waitlist_position: int | None = None
    # When FundsLink owes a review, and whether it is late (D-002 / D-013). Both None unless the
    # application is waiting on FundsLink — see the contract for when the clock starts.
    review_due_at: datetime | None = None
    sla_breached: bool | None = None
    created_at: datetime


class PageMeta(BaseModel):
    next_cursor: str | None = None


class ApplicationPage(BaseModel):
    items: list[Application]
    meta: PageMeta


class AppealRequest(BaseModel):
    new_information: str = Field(min_length=20)


class PriorityRequest(BaseModel):
    """Admin sets triage priority (D-002/D-013) — ADMIN_REVIEWER+ only, audit-logged."""

    priority: Priority
    note: str | None = Field(default=None, max_length=4000)


class ReviewRequest(BaseModel):
    decision: ReviewDecision
    note: str | None = Field(default=None, max_length=4000)
