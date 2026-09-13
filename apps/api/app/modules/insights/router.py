"""Insights router — listMyActivity / getMyOverview / adminGetOverview / adminListActivity.

Operations FROM the contract (S2.7). Student routes are the caller's own data (PROFILE_READ_OWN,
the permission that already governs the subject-access export of the same records). Staff routes
require APPLICATION_REVIEW — the people who work the queue these figures describe. No DB driver
here (layering S4.79).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.common.errors import AppError
from app.db.engine import get_session
from app.modules.auth.deps import CurrentUser
from app.modules.auth.permissions import Permission, require
from app.modules.insights.schemas import (
    ActivityCategory,
    ActivityPage,
    AdminActivityPage,
    AdminOverview,
    StudentOverview,
)
from app.modules.insights.service import AdminInsightsService, StudentInsightsService

router = APIRouter(tags=["insights"])

# The reporting windows a viewer may choose (contract enum on adminGetOverview.days).
REPORT_WINDOWS = (7, 30, 90)


@router.get("/students/me/activity", operation_id="listMyActivity")
async def list_my_activity(
    cursor: str | None = Query(default=None),
    limit: int | None = Query(default=None),
    category: ActivityCategory | None = Query(default=None),
    current: CurrentUser = Depends(require(Permission.PROFILE_READ_OWN)),
    session=Depends(get_session),
) -> ActivityPage:
    return await StudentInsightsService(session).activity(
        me=current.id, cursor=cursor, limit=limit, category=category
    )


@router.get("/students/me/overview", operation_id="getMyOverview")
async def get_my_overview(
    current: CurrentUser = Depends(require(Permission.PROFILE_READ_OWN)),
    session=Depends(get_session),
) -> StudentOverview:
    return await StudentInsightsService(session).overview(me=current.id)


@router.get("/admin/overview", operation_id="adminGetOverview")
async def admin_get_overview(
    days: int = Query(default=7),
    _current: CurrentUser = Depends(require(Permission.APPLICATION_REVIEW)),
    session=Depends(get_session),
) -> AdminOverview:
    if days not in REPORT_WINDOWS:
        # A query value arrives as text; checked here so the contract's enum is enforced exactly.
        raise AppError(
            "validation_error", f"days must be one of {', '.join(map(str, REPORT_WINDOWS))}",
            status_code=422,
        )
    return await AdminInsightsService(session).overview(days=days)


@router.get("/admin/activity", operation_id="adminListActivity")
async def admin_list_activity(
    cursor: str | None = Query(default=None),
    limit: int | None = Query(default=None),
    _current: CurrentUser = Depends(require(Permission.APPLICATION_REVIEW)),
    session=Depends(get_session),
) -> AdminActivityPage:
    return await AdminInsightsService(session).activity(cursor=cursor, limit=limit)
