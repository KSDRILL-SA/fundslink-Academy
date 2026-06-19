"""Matching router — runMatching (200, sync advisory) / getMyMatches / browseBursaries (S2.7).

runMatching + getMyMatches are the student's own matches (MATCH_READ_OWN); browseBursaries is the
equal-prominence catalogue any authenticated user can read (MASTER-SPEC §17.2). No DB driver here.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Header, Query, Request

from app.common.request_id import get_request_id
from app.db.engine import get_session
from app.modules.auth.deps import CurrentUser, get_redis_client
from app.modules.auth.permissions import Permission, authenticated_only, require
from app.modules.matching.schemas import BursaryPage, MatchPage
from app.modules.matching.service import MatchingService

router = APIRouter(tags=["matching"])


@router.post("/matches/run", operation_id="runMatching")
async def run_matching(
    request: Request,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    current: CurrentUser = Depends(require(Permission.MATCH_READ_OWN)),
    session=Depends(get_session),
    redis=Depends(get_redis_client),
) -> MatchPage:
    # v1 synchronous advisory (TAD §6.2 — async 202/worker queue deferred to v1.x): score now and
    # return the refreshed matches. A re-run is absorbed by uq_match (ON CONFLICT refresh), so the
    # Idempotency-Key is advisory — repeated runs converge, never duplicate.
    return await MatchingService(session, redis).run(
        actor_id=current.id, request_id=get_request_id(request)
    )


@router.get("/matches/me", operation_id="getMyMatches")
async def get_my_matches(
    cursor: str | None = Query(default=None),
    limit: int | None = Query(default=None),
    current: CurrentUser = Depends(require(Permission.MATCH_READ_OWN)),
    session=Depends(get_session),
    redis=Depends(get_redis_client),
) -> MatchPage:
    return await MatchingService(session, redis).get_matches(
        actor_id=current.id, cursor=cursor, limit=limit
    )


@router.get("/bursaries", operation_id="browseBursaries")
async def browse_bursaries(
    cursor: str | None = Query(default=None),
    limit: int | None = Query(default=None),
    level: str | None = Query(default=None),
    field: str | None = Query(default=None),
    current: CurrentUser = Depends(authenticated_only),
    session=Depends(get_session),
    redis=Depends(get_redis_client),
) -> BursaryPage:
    return await MatchingService(session, redis).browse_bursaries(
        cursor=cursor, limit=limit, level=level, field=field
    )
