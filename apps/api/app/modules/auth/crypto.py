"""App-side field encryption — AES-256-GCM (TAD §4.4).

Used for secrets that must be stored reversibly (the TOTP secret, MFA recovery codes). The key
is `PII_ENCRYPTION_KEY` — base64 of 32 random bytes, from the environment only (S3.20). AES-GCM
is authenticated: tampering with the ciphertext fails decryption rather than yielding garbage.
A fresh 96-bit nonce is generated per encryption and prepended to the token.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import os

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.core.config import settings

_NONCE_BYTES = 12
# domain-separates the blind-index HMAC key from the AES key (never one key for two purposes)
_BLIND_INDEX_LABEL = b"fundslink.blind_index.v1|"


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


def encrypt_bytes(plaintext: str) -> bytes:
    """AES-256-GCM → raw ``nonce || ciphertext+tag`` bytes, for a ``bytea`` column (id_number)."""
    nonce = os.urandom(_NONCE_BYTES)
    return nonce + AESGCM(_key()).encrypt(nonce, plaintext.encode("utf-8"), None)


def decrypt_bytes(raw: bytes) -> str:
    """Inverse of encrypt_bytes(); raises EncryptionError on tamper/wrong key."""
    nonce, ct = raw[:_NONCE_BYTES], raw[_NONCE_BYTES:]
    try:
        return AESGCM(_key()).decrypt(nonce, ct, None).decode("utf-8")
    except InvalidTag as exc:
        raise EncryptionError("ciphertext failed authentication") from exc


def encrypt(plaintext: str) -> str:
    """Return base64(nonce || ciphertext+tag) — for ``text`` columns (mfa_secret_enc)."""
    return base64.b64encode(encrypt_bytes(plaintext)).decode("ascii")


def decrypt(token: str) -> str:
    """Inverse of encrypt(); raises EncryptionError on tamper/wrong key."""
    return decrypt_bytes(base64.b64decode(token))


def blind_index(plaintext: str) -> str:
    """Deterministic keyed digest for UNIQUE lookups over an encrypted field (BR-A04).

    A SA ID number is stored encrypted (non-deterministic AES-GCM), so it cannot back a UNIQUE
    constraint directly. The blind index is HMAC-SHA256 over a normalised value, keyed by a
    subkey *derived* from the PII key (domain-separated from the AES key — never the same key
    for two purposes). Same input → same hex digest, so `uq_user_idnum` enforces "one ID number,
    one user" without the plaintext ever being indexed. Normalisation: strip whitespace + upper.
    """
    subkey = hashlib.sha256(_BLIND_INDEX_LABEL + _key()).digest()
    normalised = plaintext.strip().upper().encode("utf-8")
    return hmac.new(subkey, normalised, hashlib.sha256).hexdigest()
