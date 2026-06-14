"""RS256 access-token issuance & verification (S3.13).

Asymmetric signing: the private key signs (Railway Secrets only — S3.20), the public key
verifies (safely distributable). HS256 is forbidden (AP-S3.13a). The payload carries only the
defined claims — sub, role, email, jti, version — never sensitive data (AP-S3.13b), because a
JWT payload is base64, not encrypted.
"""

from __future__ import annotations

import time
import uuid

import jwt

from app.core.config import settings

_ALG = "RS256"


class JWTConfigError(RuntimeError):
    """An RS256 key required for this operation is not configured (S3.20)."""


class JWTValidationError(Exception):
    """The presented token is missing, expired, malformed, or signed by the wrong key."""


def new_jti() -> str:
    """A unique token id for deny-listing on logout (S3.18)."""
    return uuid.uuid4().hex


def create_access_token(
    *,
    sub: str,
    role: str,
    email: str,
    version: int,
    scope: str = "full",
    jti: str | None = None,
    ttl: int | None = None,
) -> tuple[str, str]:
    """Sign an access token. Returns ``(token, jti)`` so the caller can deny-list it later.

    ``scope`` is "full" for a normal session, or "mfa_pending" for the step-up enrolment token
    issued to a privileged user who has not yet activated MFA (TAD §3.1) — that token is
    accepted only by the MFA enrolment endpoints, never by business routes.
    """
    if not settings.rs256_private_key:
        raise JWTConfigError("RS256_PRIVATE_KEY is not configured")
    token_id = jti or new_jti()
    now = int(time.time())
    payload = {
        "sub": sub,
        "role": role,
        "email": email,
        "version": version,
        "scope": scope,
        "jti": token_id,
        "iat": now,
        "nbf": now,
        "exp": now + (ttl if ttl is not None else settings.access_token_ttl_seconds),
        "iss": settings.jwt_issuer,
    }
    return jwt.encode(payload, settings.rs256_private_key, algorithm=_ALG), token_id


def decode_access_token(token: str) -> dict:
    """Verify signature/expiry/issuer and return the claims, or raise JWTValidationError.

    Verifies against the current public key and, during a rotation overlap (ST-2.9), the
    previous one — so rotating keys never invalidates in-flight tokens.
    """
    keys = [k for k in (settings.rs256_public_key, settings.rs256_public_key_previous) if k]
    if not keys:
        raise JWTConfigError("RS256_PUBLIC_KEY is not configured")
    last_error: jwt.PyJWTError | None = None
    for key in keys:
        try:
            return jwt.decode(
                token,
                key,
                algorithms=[_ALG],
                issuer=settings.jwt_issuer,
                options={"require": ["exp", "iat", "sub", "jti"]},
            )
        except jwt.PyJWTError as exc:  # try the next key (rotation), else surface
            last_error = exc
    raise JWTValidationError(str(last_error)) from last_error
