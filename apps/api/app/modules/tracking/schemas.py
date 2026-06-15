"""Tracking request/response schemas (S2.23) — mirrors the contract (S2.7)."""

from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, Field

from app.modules.application.schemas import PageMeta
from app.modules.matching.schemas import Bursary


class TrackedInput(BaseModel):
    external_bursary_id: str
    applied_on: date | None = None


class SelfReportRequest(BaseModel):
    to_status: str


class Tracked(BaseModel):
    id: str
    bursary: Bursary
    status: str
    status_source: str  # freshness label — SELF_REPORT | EMAIL_CAPTURE | PARTNER_API (BR-T03)
    last_activity_at: datetime


class TrackedPage(BaseModel):
    items: list[Tracked]
    meta: PageMeta = Field(default_factory=PageMeta)
