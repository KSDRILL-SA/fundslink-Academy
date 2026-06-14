"""App-side field encryption — AES-256-GCM (TAD §4.4).

Used for secrets that must be stored reversibly (the TOTP secret, MFA recovery codes). The key
is `PII_ENCRYPTION_KEY` — base64 of 32 random bytes, from the environment only (S3.20). AES-GCM
is authenticated: tampering with the ciphertext fails decryption rather than yielding garbage.
A fresh 96-bit nonce is generated per encryption and prepended to the token.
"""

from __future__ import annotations

import base64
import os

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.core.config import settings

_NONCE_BYTES = 12


class EncryptionError(RuntimeError):
    """The PII encryption key is missing/invalid, or a ciphertext failed authentication."""


def _key() -> bytes:
    if not settings.pii_encryption_key:
        raise EncryptionError("PII_ENCRYPTION_KEY is not configured")
    try:
        key = base64.b64decode(settings.pii_encryption_key)
    except Exception as exc:  # malformed base64
        raise EncryptionError("PII_ENCRYPTION_KEY is not valid base64") from exc
    if len(key) != 32:
        raise EncryptionError("PII_ENCRYPTION_KEY must decode to 32 bytes (AES-256)")
    return key


def encrypt(plaintext: str) -> str:
    """Return base64(nonce || ciphertext+tag)."""
    nonce = os.urandom(_NONCE_BYTES)
    ct = AESGCM(_key()).encrypt(nonce, plaintext.encode("utf-8"), None)
    return base64.b64encode(nonce + ct).decode("ascii")


def decrypt(token: str) -> str:
    """Inverse of encrypt(); raises EncryptionError on tamper/wrong key."""
    raw = base64.b64decode(token)
    nonce, ct = raw[:_NONCE_BYTES], raw[_NONCE_BYTES:]
    try:
        return AESGCM(_key()).decrypt(nonce, ct, None).decode("utf-8")
    except InvalidTag as exc:
        raise EncryptionError("ciphertext failed authentication") from exc
