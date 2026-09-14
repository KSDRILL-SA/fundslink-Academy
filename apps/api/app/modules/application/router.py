"""Application router — applications + admin review (operations FROM the contract, S2.7).

createApplication / listMyApplications / getApplication / submitApplication / appealDecision, the
admin review queue (adminListApplications / adminReview) and the second person's ruling that
actually funds someone (adminAuthorize — MASTER-SPEC §16.4). The router authorises via
require(Permission.X) / require_any(...) (deny-by-default, S3.21) and delegates to
ApplicationService — it touches no DB driver (layering S4.79).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Header, Query, Request

from app.common.request_id import get_request_id
from app.db.engine import get_session
from app.modules.application.schemas import (
    AppealRequest,
    Application,
    ApplicationInput,
    ApplicationPage,
    AuthorizeRequest,
    PriorityRequest,
    Recusal,
    RecusalRequest,
    ReviewRequest,
    ThemeClusters,
    ThemeRequest,
)
from app.modules.application.service import ApplicationService
from app.modules.auth.deps import CurrentUser
from app.modules.auth.permissions import Permission, require, require_any

# Reading any application and acting on one are different powers (TAD §3.4). ADMIN_AUTHORIZER
# holds APPLICATION_READ_ANY but not APPLICATION_REVIEW, so while the admin reads were gated on
# REVIEW an authorizer could not open the application they had to rule on. The reads take the
# read permission; every write below still names the specific power it needs.
admin_read = require(Permission.APPLICATION_READ_ANY)
# Either job may have a conflict of interest, and either must be able to step aside (BR-E09).
admin_acts = require_any(Permission.APPLICATION_REVIEW, Permission.APPLICATION_AUTHORIZE)

router = APIRouter(tags=["application"])


@router.post("/applications", status_code=201, operation_id="createApplication")
async def create_application(
    body: ApplicationInput,
    request: Request,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    current: CurrentUser = Depends(require(Permission.APPLICATION_CREATE)),
    session=Depends(get_session),
) -> Application:
    # Idempotency: a retried create is absorbed by the one-active-per-year guard (BR-E06 → 409),
    # so a double-submit can never create two active applications.
    return await ApplicationService(session).create_application(
        actor_id=current.id, data=body, request_id=get_request_id(request)
    )


@router.get("/applications", operation_id="listMyApplications")
async def list_my_applications(
    cursor: str | None = Query(default=None),
    limit: int | None = Query(default=None),
    current: CurrentUser = Depends(require(Permission.APPLICATION_READ_OWN)),
    session=Depends(get_session),
) -> ApplicationPage:
    return await ApplicationService(session).list_my_applications(
        actor_id=current.id, cursor=cursor, limit=limit
    )


@router.get("/applications/{id}", operation_id="getApplication")
async def get_application(
    id: str,
    current: CurrentUser = Depends(require(Permission.APPLICATION_READ_OWN)),
    session=Depends(get_session),
) -> Application:
    return await ApplicationService(session).get_application(
        actor_id=current.id, application_id=id
    )


@router.post("/applications/{id}/submit", operation_id="submitApplication")
async def submit_application(
    id: str,
    request: Request,
    current: CurrentUser = Depends(require(Permission.APPLICATION_UPDATE_OWN)),
    session=Depends(get_session),
) -> Application:
    return await ApplicationService(session).submit_application(
        actor_id=current.id, application_id=id, request_id=get_request_id(request)
    )


@router.post("/applications/{id}/appeal", status_code=201, operation_id="appealDecision")
async def appeal_decision(
    id: str,
    body: AppealRequest,
    request: Request,
    current: CurrentUser = Depends(require(Permission.APPLICATION_UPDATE_OWN)),
    session=Depends(get_session),
) -> Application:
    return await ApplicationService(session).appeal(
        actor_id=current.id,
        application_id=id,
        new_information=body.new_information,
        request_id=get_request_id(request),
    )


@router.get("/admin/applications", operation_id="adminListApplications")
async def admin_list_applications(
    status: str | None = Query(default=None),
    cursor: str | None = Query(default=None),
    limit: int | None = Query(default=None),
    current: CurrentUser = Depends(admin_read),
    session=Depends(get_session),
) -> ApplicationPage:
    return await ApplicationService(session).admin_list(
        status=status, cursor=cursor, limit=limit, reviewer_id=current.id
    )


@router.get("/admin/applications/{id}", operation_id="adminGetApplication")
async def admin_get_application(
    id: str,  # noqa: A002 — matches the contract's path parameter name
    current: CurrentUser = Depends(admin_read),
    session=Depends(get_session),
) -> Application:
    """A02's read. The student endpoint is ownership-scoped and 403s a reviewer (#288)."""
    return await ApplicationService(session).admin_get_application(
        application_id=id, reviewer_id=current.id, role=current.role
    )


@router.post("/admin/applications/{id}/recusal", status_code=201, operation_id="adminRecuse")
async def admin_recuse(
    id: str,  # noqa: A002 — matches the contract's path parameter name
    body: RecusalRequest,
    request: Request,
    current: CurrentUser = Depends(admin_acts),
    session=Depends(get_session),
) -> Recusal:
    """BR-E09 / E8 — step aside from an application the reviewer has a conflict with."""
    return await ApplicationService(session).recuse(
        reviewer_id=current.id,
        application_id=id,
        reason=body.reason,
        request_id=get_request_id(request),
    )


@router.post("/admin/applications/{id}/review", operation_id="adminReview")
async def admin_review(
    id: str,
    body: ReviewRequest,
    request: Request,
    current: CurrentUser = Depends(require(Permission.APPLICATION_REVIEW)),
    session=Depends(get_session),
) -> Application:
    return await ApplicationService(session).admin_review(
        reviewer_id=current.id,
        application_id=id,
        decision=body.decision,
        note=body.note,
        request_id=get_request_id(request),
    )


@router.post("/admin/applications/{id}/themes", operation_id="adminTagThemes")
async def admin_tag_themes(
    id: str,  # noqa: A002 — matches the contract's path parameter name
    body: ThemeRequest,
    request: Request,
    current: CurrentUser = Depends(require(Permission.APPLICATION_REVIEW)),
    session=Depends(get_session),
) -> Application:
    """Record the themes of an OTHER-category case — MASTER-SPEC §5.6, D-018."""
    return await ApplicationService(session).tag_themes(
        reviewer_id=current.id,
        application_id=id,
        tags=body.tags,
        request_id=get_request_id(request),
    )


@router.get("/admin/themes", operation_id="adminThemeClusters")
async def admin_theme_clusters(
    window_days: int = Query(default=90, ge=1, le=730),
    current: CurrentUser = Depends(admin_read),  # noqa: ARG001 — posture, not a handler argument
    session=Depends(get_session),
) -> ThemeClusters:
    """The quarterly theme report §5.6 promises the Founder (D-018)."""
    return await ApplicationService(session).theme_clusters(window_days=window_days)


@router.post("/admin/applications/{id}/authorize", operation_id="adminAuthorize")
async def admin_authorize(
    id: str,  # noqa: A002 — matches the contract's path parameter name
    body: AuthorizeRequest,
    request: Request,
    current: CurrentUser = Depends(require(Permission.APPLICATION_AUTHORIZE)),
    session=Depends(get_session),
) -> Application:
    """The second person's ruling on a proposed decision — MASTER-SPEC §16.4, BR-S05."""
    return await ApplicationService(session).admin_authorize(
        authorizer_id=current.id,
        application_id=id,
        decision=body.decision,
        reason=body.reason,
        request_id=get_request_id(request),
    )


@router.post("/admin/applications/{id}/priority", operation_id="adminSetPriority")
async def admin_set_priority(
    id: str,
    body: PriorityRequest,
    request: Request,
    current: CurrentUser = Depends(require(Permission.APPLICATION_REVIEW)),
    session=Depends(get_session),
) -> Application:
    return await ApplicationService(session).set_priority(
        reviewer_id=current.id,
        application_id=id,
        priority=body.priority.value,
        note=body.note,
        request_id=get_request_id(request),
    )
