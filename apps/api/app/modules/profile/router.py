"""Profile router — /students/me/profile (GET/PUT) + /students/me/documents (POST).

Operations come FROM packages/contracts/openapi.yaml (S2.7): getMyProfile / putMyProfile /
uploadDocument. The router touches no DB driver (layering S4.79) — it authorises via
require(Permission.X) (deny-by-default, S3.21) and delegates to ProfileService. PUT is gated on
PROFILE_UPDATE_OWN (manage-my-own-profile, an upsert); the student role also holds PROFILE_CREATE.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile

from app.common.request_id import get_request_id
from app.core.config import settings
from app.db.engine import get_session
from app.modules.auth.deps import CurrentUser
from app.modules.auth.permissions import Permission, require
from app.modules.profile.schemas import Document, StudentProfile, StudentProfileInput
from app.modules.profile.service import ProfileService

router = APIRouter(prefix="/students/me", tags=["profile"])


@router.get("/profile", operation_id="getMyProfile")
async def get_my_profile(
    current: CurrentUser = Depends(require(Permission.PROFILE_READ_OWN)),
    session=Depends(get_session),
) -> StudentProfile:
    return await ProfileService(session).get_profile(user_id=current.id)


@router.get("/data-export", operation_id="dataExport")
async def data_export(
    request: Request,
    current: CurrentUser = Depends(require(Permission.PROFILE_READ_OWN)),
    session=Depends(get_session),
) -> dict:
    """POPIA §15.6 subject-access export — the caller's own data, audit-logged."""
    return await ProfileService(session).export_data(
        user_id=current.id, request_id=get_request_id(request)
    )


@router.put("/profile", operation_id="putMyProfile")
async def put_my_profile(
    body: StudentProfileInput,
    request: Request,
    current: CurrentUser = Depends(require(Permission.PROFILE_UPDATE_OWN)),
    session=Depends(get_session),
) -> StudentProfile:
    return await ProfileService(session).upsert_profile(
        user_id=current.id, data=body, request_id=get_request_id(request)
    )


@router.post("/documents", status_code=201, operation_id="uploadDocument")
async def upload_document(
    request: Request,
    doc_type: str = Form(...),
    file: UploadFile = File(...),
    application_id: str | None = Form(default=None),
    current: CurrentUser = Depends(require(Permission.DOCUMENT_CREATE)),
    session=Depends(get_session),
) -> Document:
    # Read at most max+1 bytes so an oversized upload is bounded in memory and rejected (413).
    raw = await file.read(settings.document_max_bytes + 1)
    return await ProfileService(session).upload_document(
        user_id=current.id,
        doc_type=doc_type,
        application_id=application_id,
        raw=raw,
        request_id=get_request_id(request),
    )
