"""Eligibility router — resubmitApplication (operation FROM the contract, S2.7).

Pre-screening itself has no endpoint — it runs inside submit/resubmit. The only surfaced
operation is resubmit: after a RETURNED_FOR_INFO, the student re-queues for screening. Authorised
via require(Permission.APPLICATION_UPDATE_OWN) (deny-by-default, S3.21); no DB driver here.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from app.common.request_id import get_request_id
from app.db.engine import get_session
from app.modules.application.schemas import Application
from app.modules.auth.deps import CurrentUser
from app.modules.auth.permissions import Permission, require
from app.modules.eligibility.service import EligibilityService

router = APIRouter(tags=["eligibility"])


@router.post("/applications/{id}/resubmit", operation_id="resubmitApplication")
async def resubmit_application(
    id: str,
    request: Request,
    current: CurrentUser = Depends(require(Permission.APPLICATION_UPDATE_OWN)),
    session=Depends(get_session),
) -> Application:
    return await EligibilityService(session).resubmit(
        actor_id=current.id, application_id=id, request_id=get_request_id(request)
    )
