"""The MongoDB reasoning document (S5.33) — a Beanie model (S5.18).

S5.3 is constitutional here: this document carries the AI's *reasoning* — a similarity ``score``
(a unitless 0–1 ratio, NOT money), a human-readable ``summary``, and ``tags`` — and NOTHING that
is a funding amount. Money lives ONLY in PostgreSQL (``match_result`` has no amount either; the
funding figure is on ``funding_application.requested_amount``, NUMERIC). The store-isolation guard
(app.db.store_isolation) inspects this model in CI and FAILS the build if a money field appears.
"""

from __future__ import annotations

from datetime import UTC, datetime

from beanie import Document
from pydantic import Field


class MatchReasoning(Document):
    """AI reasoning for one match, keyed by the PostgreSQL match_result.id (cross-store, S5.5)."""

    match_id: str  # == match_result.id in PostgreSQL (the cross-store key, S5.5)
    student_profile_id: str
    external_bursary_id: str
    score: float = Field(ge=0.0, le=1.0)  # similarity ratio, NOT a currency amount
    summary: str
    tags: list[str] = Field(default_factory=list)
    model_version: str
    prompt_version: str
    mode: str = "LIVE"  # LIVE | FALLBACK
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    class Settings:
        name = "match_reasoning"


# The set of Mongo/Beanie document models the store-isolation guard must vet (S5.3).
MONGO_MODELS = (MatchReasoning,)
