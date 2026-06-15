"""Tracking router — registerTracked / listTracked / selfReportStatus (FROM the contract, S2.7).

The student's own tracked applications: register (TRACKED_CREATE), list the dashboard
(TRACKED_READ_OWN), and self-report a status change (TRACKED_UPDATE_OWN). No DB driver here.
"""

from __future__ import annotations

from fastapi import APIRouter, Body, Depends, Header, Query, Request

from app.common.request_id import get_request_id
from app.db.engine import get_session
from app.modules.auth.deps import CurrentUser
from app.modules.auth.permissions import Permission, require
from app.modules.tracking.schemas import SelfReportRequest, Tracked, TrackedInput, TrackedPage
from app.modules.tracking.service import TrackingService

router = APIRouter(tags=["tracking"])


@router.post("/tracked-applications", status_code=201, operation_id="registerTracked")
async def register_tracked(
    body: TrackedInput,
    request: Request,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    current: CurrentUser = Depends(require(Permission.TRACKED_CREATE)),
    session=Depends(get_session),
) -> Tracked:
    # A retried register is absorbed by uq_tracked_pair (one tracked row per student+bursary → 409).
    return await TrackingService(session).register(
        actor_id=current.id,
        external_bursary_id=body.external_bursary_id,
        request_id=get_request_id(request),
    )


@router.get("/tracked-applications", operation_id="listTracked")
async def list_tracked(
    cursor: str | None = Query(default=None),
    limit: int | None = Query(default=None),
    current: CurrentUser = Depends(require(Permission.TRACKED_READ_OWN)),
    session=Depends(get_session),
) -> TrackedPage:
    return await TrackingService(session).list_mine(
        actor_id=current.id, cursor=cursor, limit=limit
    )


@router.post("/tracked-applications/{id}/status", operation_id="selfReportStatus")
async def self_report_status(
    id: str,
    request: Request,
    body: SelfReportRequest = Body(...),
    current: CurrentUser = Depends(require(Permission.TRACKED_UPDATE_OWN)),
    session=Depends(get_session),
) -> Tracked:
    return await TrackingService(session).self_report(
        actor_id=current.id,
        tracked_id=id,
        to_status=body.to_status,
        request_id=get_request_id(request),
    )
