"""RS256 access-token issuance & verification (S3.13)."""

import jwt as pyjwt
import pytest

from app.core.config import settings
from app.modules.auth import jwt as jwtsvc

_FORGED_CLAIMS = {"sub": "u1", "jti": "x", "iat": 0, "exp": 9999999999}


def test_roundtrip_carries_defined_claims():
    token, jti = jwtsvc.create_access_token(sub="u1", role="STUDENT", email="u1@t.test", version=1)
    claims = jwtsvc.decode_access_token(token)
    assert claims["sub"] == "u1"
    assert claims["role"] == "STUDENT"
    assert claims["email"] == "u1@t.test"
    assert claims["version"] == 1
    assert claims["jti"] == jti
    assert claims["iss"] == settings.jwt_issuer


def test_expired_token_is_rejected():
    token, _ = jwtsvc.create_access_token(
        sub="u1", role="STUDENT", email="u1@t.test", version=1, ttl=-1
    )
    with pytest.raises(jwtsvc.JWTValidationError):
        jwtsvc.decode_access_token(token)


def test_token_signed_by_another_key_is_rejected(rs256_keys):
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import rsa

    other = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    other_pem = other.private_bytes(
        serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()
    ).decode()
    forged = pyjwt.encode(_FORGED_CLAIMS, other_pem, algorithm="RS256")
    with pytest.raises(jwtsvc.JWTValidationError):
        jwtsvc.decode_access_token(forged)


def test_hs256_token_is_rejected():
    # Defends AP-S3.13a — only RS256 is accepted; an HS256 token must never verify.
    forged = pyjwt.encode(_FORGED_CLAIMS, "x" * 32, algorithm="HS256")
    with pytest.raises(jwtsvc.JWTValidationError):
        jwtsvc.decode_access_token(forged)


def test_missing_private_key_raises_config_error():
    saved = settings.rs256_private_key
    settings.rs256_private_key = ""
    try:
        with pytest.raises(jwtsvc.JWTConfigError):
            jwtsvc.create_access_token(sub="u1", role="STUDENT", email="e", version=1)
    finally:
        settings.rs256_private_key = saved


def test_jti_is_unique():
    assert jwtsvc.new_jti() != jwtsvc.new_jti()


def test_token_signed_by_previous_key_verifies_during_rotation():
    # Rotation overlap (ST-2.9): a token signed by the OLD key must still verify while the old
    # public key is configured as `previous`, and stop once the overlap window is closed.
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import rsa

    old = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    old_priv = old.private_bytes(
        serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()
    ).decode()
    old_pub = (
        old.public_key()
        .public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo)
        .decode()
    )

    saved_priv = settings.rs256_private_key
    settings.rs256_private_key = old_priv  # sign with the OLD key
    token, _ = jwtsvc.create_access_token(sub="u1", role="STUDENT", email="e@x.io", version=1)
    settings.rs256_private_key = saved_priv  # current signer restored

    # No overlap configured -> the old token is rejected.
    with pytest.raises(jwtsvc.JWTValidationError):
        jwtsvc.decode_access_token(token)

    # Overlap window open (previous key present) -> the old token still verifies.
    settings.rs256_public_key_previous = old_pub
    try:
        assert jwtsvc.decode_access_token(token)["sub"] == "u1"
    finally:
        settings.rs256_public_key_previous = ""
