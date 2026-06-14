"""Auth request dependencies — session RLS context + authentication (S3.17).

This composition layer (not a router/service) wires the RLS context onto the request's session
and authenticates the bearer token. ``get_current_user`` is the SOLE authentication gate
(S3.17): decode RS256 -> deny-list check -> load user -> token-version + soft-delete + state
checks -> set the user's RLS context for the rest of the transaction.
"""

from __future__ import annotations

from dataclasses import dataclass

from fastapi import Depends, Header, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.errors import AppError
from app.db.context import set_system_context, set_user_context
from app.db.engine import get_session
from app.modules.auth.jwt import JWTValidationError, decode_access_token
from app.modules.auth.ratelimit import TokenDenyList, get_redis
from app.modules.auth.repository import UserRepository


def get_redis_client():
    return get_redis()


async def system_db(session: AsyncSession = Depends(get_session)) -> AsyncSession:
    """A session pinned to SYSTEM context — the auth authority path (register/login/refresh)."""
    await set_system_context(session)
    return session


@dataclass(frozen=True)
class CurrentUser:
    id: str
    email: str
    role: str
    jti: str
    access_expires_at: int


async def get_current_user(
    request: Request,
    authorization: str | None = Header(default=None),
    session: AsyncSession = Depends(get_session),
    redis=Depends(get_redis_client),
) -> CurrentUser:
    if not authorization or not authorization.startswith("Bearer "):
        raise AppError("unauthorized", "Missing or malformed Authorization header", status_code=401)
    token = authorization.removeprefix("Bearer ").strip()
    try:
        claims = decode_access_token(token)
    except JWTValidationError:
        raise AppError("unauthorized", "Invalid or expired token", status_code=401) from None

    jti = claims["jti"]
    if await TokenDenyList(redis).is_denied(jti):
        raise AppError("unauthorized", "Token has been revoked", status_code=401)

    # Trust the verified claims to set context, then confirm the account against the DB.
    await set_user_context(session, user_id=claims["sub"], role=claims["role"])
    user = await UserRepository(session).get_by_id(claims["sub"])
    if user is None:  # missing or soft-deleted
        raise AppError("unauthorized", "Account not found", status_code=401)
    _id, email, _ph, account_state, _mfa, token_version, _deleted = user
    if claims.get("version") != token_version:  # global invalidation backstop (S3.35)
        raise AppError("unauthorized", "Session no longer valid", status_code=401)
    if account_state != "ACTIVE":
        raise AppError("forbidden", "Account is not active", status_code=403)

    return CurrentUser(
        id=_id, email=email, role=claims["role"], jti=jti, access_expires_at=int(claims["exp"])
    )
