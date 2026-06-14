"""Shared auth-test fixtures: an ephemeral RS256 key pair wired into settings.

Keys are generated per test session and never touch disk (S3.20 — no committed key material).
"""

from __future__ import annotations

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

from app.core.config import settings


@pytest.fixture(scope="session", autouse=True)
def rs256_keys():
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_pem = key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    ).decode()
    public_pem = (
        key.public_key()
        .public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo)
        .decode()
    )
    prev_priv, prev_pub = settings.rs256_private_key, settings.rs256_public_key
    settings.rs256_private_key = private_pem
    settings.rs256_public_key = public_pem
    yield {"private": private_pem, "public": public_pem}
    settings.rs256_private_key, settings.rs256_public_key = prev_priv, prev_pub
