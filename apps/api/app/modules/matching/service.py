"""Matching service (BR-M01–M04, TAD §6) — advisory AI funding matching.

Flow: per-user daily quota (429 over it) → spend circuit breaker decides LIVE vs FALLBACK
(S8.51) → score the open, non-expired bursaries (BR-M03) → persist the match record in
PostgreSQL (score/mode/provenance) and the reasoning in the MongoDB store, keyed by the PG match
id (S5.5). Funding amounts never leave PostgreSQL (S5.3): nothing written to the reasoning store
or Redis is a currency value. Matches are advisory and never filter the browse-all path (BR-M02).

Runs under SYSTEM RLS context — match_result inserts are staff-only (rls_mr_insert) — with the
student id as an explicit predicate; reads run under the caller's context (RLS scopes to own).
"""

from __future__ import annotations

import logging
from decimal import Decimal

from app.common.errors import AppError
from app.common.pagination import clamp_limit, decode_cursor, encode_cursor
from app.db.context import set_system_context
from app.modules.application.schemas import PageMeta
from app.modules.auth.repository import AuditRepository
from app.modules.matching.repository import (
    BursaryRepository,
    ConfigRepository,
    MatchResultRepository,
    ProfileReadRepository,
)
from app.modules.matching.schemas import Bursary, BursaryPage, Match, MatchPage
from app.modules.matching.spend import MatchQuota, MatchSpendBreaker
from app.modules.matching.stores import (
    embed_text,
    get_embedding_store,
    get_reasoning_store,
    source_hash,
)

TOP_N = 10
logger = logging.getLogger(__name__)

LIVE_MODEL = "embed-local-v1"
FALLBACK_MODEL = "fallback-overlap-v1"
PROMPT_VERSION = "v1"
_TOKEN_SPLIT = str.maketrans({c: " " for c in "/-_,.;"})


def _tokens(*parts: str) -> set[str]:
    out: set[str] = set()
    for p in parts:
        out |= {t for t in p.lower().translate(_TOKEN_SPLIT).split() if t}
    return out


def _fallback_score(level: str, field: str, bursary_levels, bursary_tags) -> float:
    level_match = 1.0 if level in (bursary_levels or []) else 0.0
    field_toks, tag_toks = _tokens(field), _tokens(*(bursary_tags or []))
    overlap = (len(field_toks & tag_toks) / len(field_toks)) if field_toks else 0.0
    return round(0.5 * level_match + 0.5 * overlap, 4)


def _dec(score: float) -> Decimal:
    return Decimal(str(round(score, 4)))


class MatchingService:
    def __init__(self, session, redis, *, embedding_store=None, reasoning_store=None) -> None:
        self.session = session
        self.redis = redis
        self.profiles = ProfileReadRepository(session)
        self.bursaries = BursaryRepository(session)
        self.matches = MatchResultRepository(session)
        self.config = ConfigRepository(session)
        self.audit = AuditRepository(session)
        self.embeddings = embedding_store or get_embedding_store()
        self.reasoning = reasoning_store or get_reasoning_store()
        self.quota = MatchQuota(redis)
        self.breaker = MatchSpendBreaker(redis)

    async def run(self, *, actor_id: str, request_id: str) -> MatchPage:
        await set_system_context(self.session)
        quota_limit = await self.config.get_int("matching_user_daily_quota", 5)
        if not await self.quota.within_quota(actor_id, limit=quota_limit):
            raise AppError(
                "rate_limited",
                "Daily matching limit reached; try again tomorrow",
                status_code=429,
                headers={"Retry-After": "3600"},
            )
        profile = await self.profiles.matching_profile(actor_id)
        if profile is None:
            raise AppError(
                "profile_required", "Create your profile before matching", status_code=409
            )
        level, field = profile[0], profile[1]
        candidates = await self.bursaries.candidates()  # BR-M03: open, non-expired only

        budget = await self.config.get_decimal("matching_daily_budget_zar", Decimal("200"))
        cost = await self.config.get_decimal("matching_cost_per_call_zar", Decimal("0.50"))
        max_calls = int(budget / cost) if cost > 0 else 0
        live = await self.breaker.allow_live(max_calls=max_calls)

        # S8.51 — AI degradation. The breaker covers "no budget"; it does not cover
        # the engine simply failing (provider down, a network fault, a bad vector).
        # Without this, an embedding error reached the student as a 500 and matching
        # was unavailable, when a tag/level overlap score was available all along.
        # Matching is ADVISORY: a degraded answer beats no answer, and a student
        # does not lose access to funding because a model call failed.
        try:
            scored = await self._score(actor_id, level, field, candidates, live=live)
        except AppError:
            raise  # a deliberate, student-facing refusal — not an engine fault
        except Exception:
            if not live:
                raise  # the fallback scorer itself failed; there is nothing left to degrade to
            logger.exception("matching: live engine failed, degrading to FALLBACK (S8.51)")
            live = False
            scored = await self._score(actor_id, level, field, candidates, live=False)

        mode = "LIVE" if live else "FALLBACK"
        model = LIVE_MODEL if live else FALLBACK_MODEL

        for cand, score in scored:
            if score <= 0:
                continue
            bursary_id = cand[0]
            match_id = await self.matches.insert(
                student_profile_id=actor_id,
                external_bursary_id=bursary_id,
                score=_dec(score),
                model_version=model,
                prompt_version=PROMPT_VERSION,
                mode=mode,
            )
            await self.reasoning.save(
                {
                    "match_id": match_id,
                    "student_profile_id": actor_id,
                    "external_bursary_id": bursary_id,
                    "score": score,
                    "summary": self._summary(cand, level, field, mode),
                    "tags": sorted(_tokens(field) & _tokens(*(cand[5] or []))),
                    "model_version": model,
                    "prompt_version": PROMPT_VERSION,
                    "mode": mode,
                }
            )
        await self.audit.write(
            actor_user_id=actor_id,
            action="MATCHING_RUN",
            resource_type="match_result",
            resource_id=actor_id,
            request_id=request_id,
            detail={"mode": mode, "candidates": len(candidates), "matched": len(scored)},
        )
        # v1 is synchronous-advisory: the work above is done, so return the refreshed match page
        # directly (async 202/worker queue deferred to v1.x — TAD §6.2). Same transaction, so the
        # just-written rows are visible to this read.
        return await self.get_matches(actor_id=actor_id, cursor=None, limit=None)

    async def _score(self, student_id, level, field, candidates, *, live: bool):
        if not live:
            return sorted(
                ((c, _fallback_score(level, field, c[4], c[5])) for c in candidates),
                key=lambda x: x[1],
                reverse=True,
            )[:TOP_N]
        # LIVE: cosine ANN over embeddings; profile re-embedded only on change (BR-M04).
        profile_text = f"{level} {field}"
        p_hash = source_hash(profile_text)
        p_vec = embed_text(profile_text)
        if await self.embeddings.profile_hash(student_id) != p_hash:  # BR-M04 recompute marker
            await self.embeddings.upsert_profile(student_id, p_vec, p_hash)
        by_id = {c[0]: c for c in candidates}
        for c in candidates:
            text = f"{c[1]} {c[2]} {' '.join(c[5] or [])} {' '.join(c[4] or [])}"
            await self.embeddings.upsert_bursary(c[0], embed_text(text), source_hash(text))
        ranked = await self.embeddings.rank(p_vec, list(by_id), TOP_N)
        return [(by_id[bid], score) for bid, score in ranked]

    @staticmethod
    def _summary(cand, level, field, mode: str) -> str:
        if mode == "FALLBACK":
            return (
                f"Fallback match for {field} ({level}) on tag/level overlap — "
                "AI budget reached, advisory only."
            )
        shared = sorted(_tokens(field) & _tokens(*(cand[5] or [])))
        basis = f" on {', '.join(shared)}" if shared else ""
        return f"Matched {field} ({level}) to {cand[1]}{basis}. Advisory — a human decides."

    # --------------------------------- reads ---------------------------------
    async def get_matches(
        self, *, actor_id: str, cursor: str | None, limit: int | None
    ) -> MatchPage:
        n = clamp_limit(limit)
        rows = await self.matches.list_for_student(actor_id, limit=n, after=decode_cursor(cursor))
        has_more = len(rows) > n
        page = rows[:n]
        bursaries = await self.bursaries.get_many([r[1] for r in page])
        summaries = await self.reasoning.summaries_for([r[0] for r in page])
        items = [
            Match(
                id=r[0],
                bursary=_to_bursary(bursaries.get(r[1])),
                score=float(r[2]),
                mode=r[3],
                reasoning_summary=summaries.get(r[0]),
                created_at=r[4],
            )
            for r in page
            if bursaries.get(r[1]) is not None
        ]
        next_cursor = encode_cursor(page[-1][4], page[-1][0]) if has_more and page else None
        return MatchPage(items=items, meta=PageMeta(next_cursor=next_cursor))

    async def browse_bursaries(
        self, *, cursor: str | None, limit: int | None, level: str | None, field: str | None
    ) -> BursaryPage:
        n = clamp_limit(limit)
        rows = await self.bursaries.browse(
            limit=n, after=decode_cursor(cursor), level=level, field=field
        )
        has_more = len(rows) > n
        page = rows[:n]
        items = [_to_bursary(r) for r in page]
        next_cursor = encode_cursor(page[-1][8], page[-1][0]) if has_more and page else None
        return BursaryPage(items=items, meta=PageMeta(next_cursor=next_cursor))


def _to_bursary(row) -> Bursary:
    return Bursary(
        id=row[0],
        name=row[1],
        provider=row[2],
        status=row[3],
        level_eligibility=row[4] or [],
        field_tags=row[5] or [],
        next_deadline=row[6],
        source_url=row[7],
    )
