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
    """The decisions a reviewer can record (contract adminReview enum).

    A reviewer proposes; a reviewer does not approve. APPROVED and APPROVED_WAITLISTED are absent
    on purpose — they belong to a second person, through adminAuthorize (MASTER-SPEC §16.4).
    REJECTED_FINAL is the appeal ruling that upholds an earlier rejection (BR-E07); the transition
    table makes it reachable from APPEALED and from nowhere else.
    """

    UNDER_REVIEW = "UNDER_REVIEW"
    INTERVIEW_SCHEDULED = "INTERVIEW_SCHEDULED"
    APPROVED_PROPOSED = "APPROVED_PROPOSED"
    REJECTED = "REJECTED"
    REJECTED_FINAL = "REJECTED_FINAL"


class ThemeTag(StrEnum):
    """The six seeded themes (lk_theme_tag) — MASTER-SPEC §5.6, D-018.

    A deliberately short list. §5.6 promotes a recurring theme to a real funding category; a long
    tag vocabulary would let every case be its own theme and nothing would ever recur.
    """

    FINANCIAL_GAP = "FINANCIAL_GAP"
    FAMILY_CRISIS = "FAMILY_CRISIS"
    HEALTH = "HEALTH"
    DOCUMENTATION = "DOCUMENTATION"
    INSTITUTIONAL = "INSTITUTIONAL"
    OTHER = "OTHER"


class AuthorizeDecision(StrEnum):
    """What a second person may do with a proposed decision (contract adminAuthorize enum)."""

    APPROVED = "APPROVED"
    APPROVED_WAITLISTED = "APPROVED_WAITLISTED"
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
    # Reviewer reads only (A02): has the caller stepped aside from this one (BR-E09)? None on
    # student reads — a student is never told who recused, or that anyone did.
    recused_by_me: bool | None = None
    # Admin reads only (A02): may the caller authorise a proposed decision (§16.4)? A hint for the
    # screen, so the authorise step is offered to the person who holds the power and not to the
    # reviewer who proposed it. The endpoint still authorises every call itself.
    can_authorize: bool | None = None
    # Admin reads only (A02): the themes a reviewer recorded on this OTHER-category case (§5.6,
    # D-018). None on a student read — a theme is the reviewer's characterisation of someone's
    # circumstances, written for a quarterly count and not addressed to the applicant.
    theme_tags: list[str] | None = None
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


class RecusalRequest(BaseModel):
    """BR-E09 / E8: why the reviewer is stepping aside. Kept on the append-only recusal record."""

    reason: str = Field(min_length=10, max_length=2000)


class Recusal(BaseModel):
    application_id: str
    created_at: datetime


class ReviewRequest(BaseModel):
    decision: ReviewDecision
    note: str | None = Field(default=None, max_length=4000)


class ThemeRequest(BaseModel):
    """Themes to record on an OTHER-category case. Added, never replaced (§5.6)."""

    tags: list[ThemeTag] = Field(min_length=1, max_length=6)


class ThemeCount(BaseModel):
    tag: str
    applications: int


class ThemeClusters(BaseModel):
    """The quarterly report §5.6 promises the Founder (D-018)."""

    generated_at: datetime
    window_days: int
    tagged_applications: int
    themes: list[ThemeCount]


class AuthorizeRequest(BaseModel):
    """The second person's ruling on a proposed decision (MASTER-SPEC §16.4).

    ``reason`` is required, unlike a reviewer's optional note: this is the wording the student is
    shown when they are funded, waitlisted or turned down, and "no reason given" is not an
    acceptable answer to someone whose year depends on it.
    """

    decision: AuthorizeDecision
    reason: str = Field(min_length=10, max_length=2000)
