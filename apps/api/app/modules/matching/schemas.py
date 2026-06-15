"""Matching request/response schemas (S2.23) — mirrors the contract (S2.7).

Note: ``score`` is a 0–1 similarity ratio, never a currency value (S5.3). No funding amount
appears on any matching response — amounts live on the application in PostgreSQL.
"""

from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, Field

from app.modules.application.schemas import PageMeta


class JobAccepted(BaseModel):
    job_id: str
    status: str = "QUEUED"


class Bursary(BaseModel):
    id: str
    name: str
    provider: str
    status: str
    level_eligibility: list[str] = Field(default_factory=list)
    field_tags: list[str] = Field(default_factory=list)
    next_deadline: date | None = None
    source_url: str | None = None


class Match(BaseModel):
    id: str
    bursary: Bursary
    score: float = Field(ge=0.0, le=1.0)
    mode: str  # LIVE | FALLBACK
    reasoning_summary: str | None = None
    created_at: datetime


class MatchPage(BaseModel):
    items: list[Match]
    meta: PageMeta


class BursaryPage(BaseModel):
    items: list[Bursary]
    meta: PageMeta
