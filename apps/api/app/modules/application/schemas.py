"""Application request/response schemas (S2.23) — mirrors the contract (S2.7).

Money (``requested_amount``) is carried as a decimal STRING end-to-end and parsed to Decimal in
the service — never float (S5.28 / DB-D29). An OTHER application MUST carry a structured
motivation (BR-S02 / BR-E05); the validator enforces it at the boundary so a missing motivation
is a clean 422, not a downstream surprise.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal, InvalidOperation
from enum import StrEnum

from pydantic import BaseModel, Field, field_validator, model_validator


class ApplicationType(StrEnum):
    POSTGRAD = "POSTGRAD"
    UG_CAT_A = "UG_CAT_A"
    UG_CAT_B = "UG_CAT_B"
    UG_CAT_C = "UG_CAT_C"
    OTHER = "OTHER"


class ReviewDecision(StrEnum):
    """The decisions a reviewer can record (contract adminReview enum)."""

    UNDER_REVIEW = "UNDER_REVIEW"
    INTERVIEW_SCHEDULED = "INTERVIEW_SCHEDULED"
    APPROVED_PROPOSED = "APPROVED_PROPOSED"
    REJECTED = "REJECTED"


class Motivation(BaseModel):
    situation: str = Field(min_length=1, max_length=4000)
    why_not_categories: str = Field(min_length=1, max_length=4000)
    support_needed: str = Field(min_length=1, max_length=4000)
    language: str = "en"  # any SA official language (E11) — DB ck_motiv_language validates


class ApplicationInput(BaseModel):
    application_type: ApplicationType
    academic_year: str = Field(min_length=4, max_length=9)
    requested_amount: str | None = Field(default=None, description="Decimal ZAR string (DB-D29)")
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
    cycle_no: int | None = None


class Application(BaseModel):
    id: str
    application_type: ApplicationType
    academic_year: str
    requested_amount: str | None = None
    status: str
    currency: str = "ZAR"
    motivation: Motivation | None = None
    pre_screen: PreScreen | None = None
    created_at: datetime


class PageMeta(BaseModel):
    next_cursor: str | None = None


class ApplicationPage(BaseModel):
    items: list[Application]
    meta: PageMeta


class AppealRequest(BaseModel):
    new_information: str = Field(min_length=20)


class ReviewRequest(BaseModel):
    decision: ReviewDecision
    note: str | None = Field(default=None, max_length=4000)
