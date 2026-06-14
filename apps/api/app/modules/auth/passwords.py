"""Password hashing, strength, and breach detection (S3.3 · S3.32).

Hashing: bcrypt at a cost factor read from BCRYPT_ROUNDS (never hardcoded — AP-S3.3a). The
password is SHA-256 pre-hashed and base64-encoded before bcrypt so that passwords longer than
bcrypt's 72-byte limit are not silently truncated. SHA-256/-512 are never used *as* the
password hash (AP-S3.3b) — only as a length-normaliser feeding bcrypt.

Strength: server-authoritative (AP-S3.32a) — min 10 chars (matches the OpenAPI RegisterRequest
and exceeds C3's floor of 8), with upper/lower/digit/special. Breach: HIBP k-anonymity — only
the first 5 chars of the SHA-1 hash leave the process.
"""

from __future__ import annotations

import base64
import hashlib

import bcrypt
import httpx

from app.core.config import settings

MIN_LENGTH = 10
_HIBP_RANGE_URL = "https://api.pwnedpasswords.com/range/"
_SPECIALS = set("!@#$%^&*()-_=+[]{};:,.<>?/|`~'\"\\")


class WeakPasswordError(ValueError):
    """Password fails the strength policy. ``code`` is a stable client error code."""

    def __init__(self, message: str, code: str = "weak_password") -> None:
        super().__init__(message)
        self.code = code


def _prehash(password: str) -> bytes:
    """SHA-256 -> base64 so bcrypt never truncates a long password at 72 bytes."""
    return base64.b64encode(hashlib.sha256(password.encode("utf-8")).digest())


def hash_password(password: str) -> str:
    return bcrypt.hashpw(_prehash(password), bcrypt.gensalt(rounds=settings.bcrypt_rounds)).decode()


def verify_password(password: str, password_hash: str) -> bool:
    """Constant-time verify. A malformed/sentinel hash (e.g. SYSTEM) never verifies."""
    try:
        return bcrypt.checkpw(_prehash(password), password_hash.encode())
    except (ValueError, TypeError):
        return False


def validate_strength(password: str) -> None:
    """Raise WeakPasswordError if the policy is not met (server-authoritative — S3.32)."""
    if len(password) < MIN_LENGTH:
        raise WeakPasswordError(f"Password must be at least {MIN_LENGTH} characters")
    if not any(c.isupper() for c in password):
        raise WeakPasswordError("Password must contain an uppercase letter")
    if not any(c.islower() for c in password):
        raise WeakPasswordError("Password must contain a lowercase letter")
    if not any(c.isdigit() for c in password):
        raise WeakPasswordError("Password must contain a digit")
    if not any(c in _SPECIALS for c in password):
        raise WeakPasswordError("Password must contain a special character")


async def is_breached(password: str, *, client: httpx.AsyncClient | None = None) -> bool:
    """HIBP k-anonymity breach check. Fails open (returns False) if HIBP is unreachable —
    availability of registration is not held hostage to a third party (logged by the caller)."""
    digest = hashlib.sha1(password.encode("utf-8")).hexdigest().upper()  # noqa: S324 (k-anon, not auth)
    prefix, suffix = digest[:5], digest[5:]
    owns_client = client is None
    client = client or httpx.AsyncClient(timeout=2.5)
    try:
        resp = await client.get(f"{_HIBP_RANGE_URL}{prefix}", headers={"Add-Padding": "true"})
        resp.raise_for_status()
        return any(line.split(":")[0].strip().upper() == suffix for line in resp.text.splitlines())
    except (httpx.HTTPError, httpx.TimeoutException):
        return False
    finally:
        if owns_client:
            await client.aclose()
