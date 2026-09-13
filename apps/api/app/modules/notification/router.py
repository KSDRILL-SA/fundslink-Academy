"""Notification router — listMyNotifications / putPreferences (FROM the contract, S2.7).

Both are the caller's own data (authenticated; RLS scopes to own rows / own preference). No DB
driver here. The outbox worker (app.modules.notification.worker) is a background process, not a
route — it has no HTTP surface.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request

from app.common.request_id import get_request_id
from app.db.engine import get_session
from app.modules.auth.deps import CurrentUser
from app.modules.auth.permissions import authenticated_only
from app.modules.notification.schemas import NotificationPage, Preferences
from app.modules.notification.service import NotificationService

router = APIRouter(tags=["notification"])


@router.get("/notifications/me", operation_id="listMyNotifications")
async def list_my_notifications(
    cursor: str | None = Query(default=None),
    limit: int | None = Query(default=None),
    current: CurrentUser = Depends(authenticated_only),  # own rows; declares posture (S3.21)
    session=Depends(get_session),
) -> NotificationPage:
    return await NotificationService(session).list_mine(
        actor_id=current.id, cursor=cursor, limit=limit
    )


@router.get("/notifications/preferences", operation_id="getPreferences")
async def get_preferences(
    current: CurrentUser = Depends(authenticated_only),
    session=Depends(get_session),
) -> Preferences:
    return await NotificationService(session).get_preferences(actor_id=current.id)


@router.put("/notifications/preferences", operation_id="putPreferences")
async def put_preferences(
    body: Preferences,
    request: Request,
    current: CurrentUser = Depends(authenticated_only),
    session=Depends(get_session),
) -> Preferences:
    return await NotificationService(session).put_preferences(
        actor_id=current.id, prefs=body, request_id=get_request_id(request)
    )
