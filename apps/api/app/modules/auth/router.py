"""Auth router — /auth/register · /login · /refresh · /logout (FROM the contract, S2.7).

Split-token storage (S3.14): the access token is returned in the JSON body (AuthTokens); the
refresh token is set ONLY in an HttpOnly, SameSite=Strict cookie scoped to /api/v1/auth. The
router itself touches no DB driver (layering) — it delegates to AuthService.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request, Response

from app.common.request_id import get_request_id
from app.core.config import settings
from app.db.engine import get_session
from app.modules.auth.deps import CurrentUser, get_redis_client, mfa_session, system_db
from app.modules.auth.permissions import authenticated_only, public_endpoint
from app.modules.auth.schemas import (
    AuthTokens,
    ChangePasswordRequest,
    EmailRequest,
    LoginRequest,
    MfaActivateRequest,
    MfaEnrollResponse,
    RegisterRequest,
    ResetPasswordRequest,
    VerifyEmailRequest,
)
from app.modules.auth.service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])

REFRESH_COOKIE = "fundslink_refresh"
COOKIE_PATH = "/api/v1/auth"  # cookie sent only to the auth endpoints (S3.14)


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _set_refresh_cookie(response: Response, raw: str) -> None:
    response.set_cookie(
        REFRESH_COOKIE,
        raw,
        max_age=settings.refresh_token_ttl_seconds,
        httponly=True,
        secure=settings.is_production,  # always Secure in prod; relaxed for local http dev
        samesite="strict",
        path=COOKIE_PATH,
    )


@router.post(
    "/register",
    status_code=201,
    operation_id="authRegister",
    dependencies=[Depends(public_endpoint)],  # deny-by-default: explicitly public (S3.21)
)
async def register(
    body: RegisterRequest,
    request: Request,
    response: Response,
    session=Depends(system_db),
    redis=Depends(get_redis_client),
) -> AuthTokens:
    tokens, raw = await AuthService(session, redis).register(
        body, request_id=get_request_id(request)
    )
    _set_refresh_cookie(response, raw)
    return tokens


@router.post(
    "/login", operation_id="authLogin", dependencies=[Depends(public_endpoint)]
)
async def login(
    body: LoginRequest,
    request: Request,
    response: Response,
    session=Depends(system_db),
    redis=Depends(get_redis_client),
) -> AuthTokens:
    tokens, raw = await AuthService(session, redis).login(
        body.email,
        body.password,
        ip=_client_ip(request),
        request_id=get_request_id(request),
        mfa_code=body.mfa_code,
    )
    if raw is not None:  # None => an MFA step-up (mfa_pending) token, which has no refresh
        _set_refresh_cookie(response, raw)
    return tokens


@router.post(
    "/refresh", operation_id="authRefresh", dependencies=[Depends(public_endpoint)]
)
async def refresh(
    request: Request,
    response: Response,
    session=Depends(system_db),
    redis=Depends(get_redis_client),
) -> AuthTokens:
    raw_cookie = request.cookies.get(REFRESH_COOKIE)
    tokens, new_raw = await AuthService(session, redis).refresh_session(
        raw_cookie, request_id=get_request_id(request)
    )
    _set_refresh_cookie(response, new_raw)
    return tokens


@router.post("/logout", status_code=204, operation_id="authLogout")
async def logout(
    request: Request,
    response: Response,
    current: CurrentUser = Depends(authenticated_only),
    session=Depends(get_session),
    redis=Depends(get_redis_client),
) -> None:
    raw_cookie = request.cookies.get(REFRESH_COOKIE)
    await AuthService(session, redis).logout(
        user_id=current.id,
        jti=current.jti,
        access_expires_at=current.access_expires_at,
        raw_refresh=raw_cookie,
        request_id=get_request_id(request),
    )
    response.delete_cookie(REFRESH_COOKIE, path=COOKIE_PATH)


@router.post("/mfa/enroll", operation_id="authMfaEnroll")
async def mfa_enroll(
    request: Request,
    current: CurrentUser = Depends(mfa_session),
    session=Depends(get_session),
    redis=Depends(get_redis_client),
) -> MfaEnrollResponse:
    result = await AuthService(session, redis).enroll_mfa(
        user_id=current.id, email=current.email, request_id=get_request_id(request)
    )
    return MfaEnrollResponse(**result)


@router.post("/mfa/activate", status_code=204, operation_id="authMfaActivate")
async def mfa_activate(
    body: MfaActivateRequest,
    request: Request,
    current: CurrentUser = Depends(mfa_session),
    session=Depends(get_session),
    redis=Depends(get_redis_client),
) -> None:
    await AuthService(session, redis).activate_mfa(
        user_id=current.id, code=body.code, request_id=get_request_id(request)
    )


@router.post(
    "/verify-email", status_code=204, operation_id="authVerifyEmail",
    dependencies=[Depends(public_endpoint)],
)
async def verify_email(
    body: VerifyEmailRequest,
    request: Request,
    session=Depends(system_db),
    redis=Depends(get_redis_client),
) -> None:
    await AuthService(session, redis).verify_email(
        token=body.token, request_id=get_request_id(request)
    )


@router.post(
    "/verify-email/resend", status_code=202, operation_id="authResendVerification",
    dependencies=[Depends(public_endpoint)],
)
async def resend_verification(
    body: EmailRequest,
    request: Request,
    session=Depends(system_db),
    redis=Depends(get_redis_client),
) -> dict:
    await AuthService(session, redis).resend_verification(
        email=body.email, request_id=get_request_id(request)
    )
    return {"status": "accepted"}


@router.post(
    "/forgot-password", status_code=202, operation_id="authForgotPassword",
    dependencies=[Depends(public_endpoint)],
)
async def forgot_password(
    body: EmailRequest,
    request: Request,
    session=Depends(system_db),
    redis=Depends(get_redis_client),
) -> dict:
    await AuthService(session, redis).forgot_password(
        email=body.email, request_id=get_request_id(request)
    )
    return {"status": "accepted"}  # identical whether or not the account exists (S3.30)


@router.post(
    "/reset-password", status_code=204, operation_id="authResetPassword",
    dependencies=[Depends(public_endpoint)],
)
async def reset_password(
    body: ResetPasswordRequest,
    request: Request,
    session=Depends(system_db),
    redis=Depends(get_redis_client),
) -> None:
    await AuthService(session, redis).reset_password(
        token=body.token, new_password=body.new_password, request_id=get_request_id(request)
    )


@router.post("/change-password", status_code=204, operation_id="authChangePassword")
async def change_password(
    body: ChangePasswordRequest,
    request: Request,
    current: CurrentUser = Depends(authenticated_only),
    session=Depends(get_session),
    redis=Depends(get_redis_client),
) -> None:
    await AuthService(session, redis).change_password(
        user_id=current.id,
        current_password=body.current_password,
        new_password=body.new_password,
        request_id=get_request_id(request),
    )
