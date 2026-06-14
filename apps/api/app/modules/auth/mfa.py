"""TOTP MFA helpers (TAD §3.1 — mandatory for privileged roles).

Pure helpers: secret/URI generation, TOTP verification (one-step clock skew tolerance), and
single-use recovery codes (stored only as SHA-256 hashes). The roles that MUST have MFA are
listed here; the login service enforces it.
"""

from __future__ import annotations

import hashlib
import secrets

import pyotp

ISSUER = "FundsLink Academy"

# Privileged roles for which MFA is mandatory (TAD §3.1). Students are optional (v1: off).
MFA_REQUIRED_ROLES = frozenset(
    {"ADMIN_REVIEWER", "ADMIN_AUTHORIZER", "FINANCE_ADMIN", "INSTITUTION_OFFICER", "COUNSELLOR"}
)


def role_requires_mfa(role: str) -> bool:
    return role in MFA_REQUIRED_ROLES


def generate_secret() -> str:
    """A fresh base32 TOTP secret."""
    return pyotp.random_base32()


def provisioning_uri(secret: str, email: str) -> str:
    """otpauth:// URI the authenticator app turns into a QR code."""
    return pyotp.TOTP(secret).provisioning_uri(name=email, issuer_name=ISSUER)


def verify_totp(secret: str, code: str) -> bool:
    """Verify a 6-digit TOTP, tolerating ±1 time step (30s) of clock skew."""
    if not code or not code.strip().isdigit():
        return False
    return pyotp.TOTP(secret).verify(code.strip(), valid_window=1)


def generate_recovery_codes(count: int = 8) -> list[str]:
    """Human-friendly single-use backup codes (shown once, stored hashed)."""
    return [
        f"{secrets.token_hex(2)}-{secrets.token_hex(2)}-{secrets.token_hex(2)}"
        for _ in range(count)
    ]


def hash_recovery_code(code: str) -> str:
    return hashlib.sha256(code.strip().lower().encode("utf-8")).hexdigest()
