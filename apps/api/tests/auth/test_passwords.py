"""Password hashing, strength policy, and HIBP breach detection (S3.3 · S3.32)."""

import httpx
import pytest

from app.modules.auth import passwords


def test_hash_then_verify_roundtrip():
    h = passwords.hash_password("Str0ng!Passw0rd")
    assert h != "Str0ng!Passw0rd"
    assert passwords.verify_password("Str0ng!Passw0rd", h) is True
    assert passwords.verify_password("wrong", h) is False


def test_sentinel_hash_never_verifies():
    # The SYSTEM principal's locked sentinel must never authenticate (no crash on malformed hash).
    assert passwords.verify_password("anything", "!SYSTEM-NO-LOGIN") is False


def test_long_password_not_truncated_at_72_bytes():
    # SHA-256 pre-hash means two long passwords differing only past byte 72 are distinguishable.
    a = "A1!" + "x" * 100
    b = "A1!" + "x" * 100 + "DIFFERENT-TAIL"
    h = passwords.hash_password(a)
    assert passwords.verify_password(a, h) is True
    assert passwords.verify_password(b, h) is False


@pytest.mark.parametrize(
    "bad",
    ["short1!A", "alllowercase1!", "ALLUPPERCASE1!", "NoDigits!!!!", "NoSpecial123ABC"],
)
def test_weak_passwords_rejected(bad):
    with pytest.raises(passwords.WeakPasswordError):
        passwords.validate_strength(bad)


def test_strong_password_accepted():
    passwords.validate_strength("Str0ng!Passw0rd")  # no raise


def _hibp_client(body: str, *, fail: bool = False) -> httpx.AsyncClient:
    def handler(request: httpx.Request) -> httpx.Response:
        if fail:
            raise httpx.ConnectError("HIBP down")
        return httpx.Response(200, text=body)

    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


async def test_breached_password_detected():
    # SHA-1("Password123!") suffix must be matched against the mocked range response.
    import hashlib

    suffix = hashlib.sha1(b"Password123!").hexdigest().upper()[5:]
    async with _hibp_client(f"{suffix}:42\nAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA:1") as c:
        assert await passwords.is_breached("Password123!", client=c) is True


async def test_unbreached_password_passes():
    async with _hibp_client("0000000000000000000000000000000000A:1") as c:
        assert await passwords.is_breached("Str0ng!Passw0rd", client=c) is False


async def test_hibp_failure_fails_open():
    async with _hibp_client("", fail=True) as c:
        assert await passwords.is_breached("anything", client=c) is False
