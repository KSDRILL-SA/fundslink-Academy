"""Profile request/response schemas (S2.23 — Pydantic validation at the API boundary).

Shapes mirror packages/contracts/openapi.yaml (S2.7): StudentProfileInput / StudentProfile /
Document. ``id_number`` is write-only PII (TAD §4.4) — accepted on input, NEVER echoed in a
response: the encrypted value + blind index live on the user row and we do not decrypt-and-return
it on every read. ``hardship_narrative`` is returned to its owner but is kept out of logs/audit.
"""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field


class StudyLevel(StrEnum):
    """Mirrors student_profile.ck_sp_level (UG/HONOURS/MASTERS/PHD/PGDIP)."""

    UG = "UG"
    HONOURS = "HONOURS"
    MASTERS = "MASTERS"
    PHD = "PHD"
    PGDIP = "PGDIP"


class VerificationLevel(StrEnum):
    """Mirrors lk_verification_level (BRONZE < SILVER < GOLD < PLATINUM)."""

    BRONZE = "BRONZE"
    SILVER = "SILVER"
    GOLD = "GOLD"
    PLATINUM = "PLATINUM"


class StudentProfileInput(BaseModel):
    first_name: str = Field(min_length=1, max_length=120)
    last_name: str = Field(min_length=1, max_length=120)
    phone: str | None = Field(default=None, max_length=32)  # TEXT — leading-zero rule DB-D17
    level: StudyLevel
    field_of_study: str = Field(min_length=1, max_length=200)
    # SA ID number — encrypted at rest + blind-indexed for uniqueness (BR-A04). Write-only.
    id_number: str | None = Field(default=None, min_length=6, max_length=64)
    hardship_narrative: str | None = Field(default=None, max_length=8000)


class StudentProfile(BaseModel):
    """Read model — note: ``id_number`` is deliberately absent (PII minimisation, TAD §4.4)."""

    id: str
    first_name: str
    last_name: str
    phone: str | None = None
    level: StudyLevel
    field_of_study: str
    hardship_narrative: str | None = None
    verification_level: VerificationLevel
    created_at: datetime


class Document(BaseModel):
    id: str
    doc_type: str
    application_id: str | None = None
    av_status: str
    created_at: datetime
