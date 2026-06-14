"""Refresh-token crypto primitives (S3.13).

A refresh token is a 64-byte cryptographically random value. Only its SHA-256 hash is stored
in PostgreSQL (refresh_token.token_hash); the raw value is transmitted once in the HttpOnly
cookie and never persisted. SHA-256 (not bcrypt) is correct here: the token is already
high-entropy random, so a fast hash with no offline-guessing exposure is the right tool.
The rotation/family-revocation *logic* lives in the service/repository (S3.16).
"""

from __future__ import annotations

import hashlib
import secrets


def new_refresh_token() -> tuple[str, str]:
    """Return ``(raw, token_hash)``. Store the hash; send the raw value in the cookie once."""
    raw = secrets.token_urlsafe(64)  # 64 bytes of entropy, URL-safe for cookie transport
    return raw, hash_refresh_token(raw)


def hash_refresh_token(raw: str) -> str:
    """Deterministic SHA-256 hash for constant-work lookup by token_hash."""
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def new_opaque_token(nbytes: int = 32) -> tuple[str, str]:
    """A URL-safe random token + its SHA-256 hash — for email-verify / password-reset links."""
    raw = secrets.token_urlsafe(nbytes)
    return raw, hash_refresh_token(raw)

