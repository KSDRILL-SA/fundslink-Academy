"""Auth hardening (vs stress-test-audit ST-2 + C3): timing parity, Retry-After, password caps,
lockout notification. Token-rotation and TOTP-replay live with their units (test_jwt / test_mfa)."""

from __future__ import annotations

import uuid

from app.modules.auth import passwords

BASE = "/api/v1/auth"
GOOD_PW = "Str0ng!Passw0rd"


def _email() -> str:
    return f"hard_{uuid.uuid4().hex}@learner.fundslink.io"


def _register(client, email):
    return client.post(
        f"{BASE}/register",
        json={"email": email, "password": GOOD_PW,
              "consents": [{"purpose": "TERMS_OF_SERVICE", "wording_version": "v1"}]},
    )


def test_unknown_user_login_burns_constant_time_dummy(client, monkeypatch):
    """ST-2: an unknown email must still run a bcrypt verify, so timing can't enumerate users."""
    calls = {"n": 0}
    real = passwords.verify_dummy

    def spy(pw):
        calls["n"] += 1
        return real(pw)

    monkeypatch.setattr(passwords, "verify_dummy", spy)
    resp = client.post(f"{BASE}/login", json={"email": _email(), "password": GOOD_PW})
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "invalid_credentials"
    assert calls["n"] == 1  # the timing equaliser ran for the non-existent account


def test_rate_limit_returns_429_with_retry_after(client):
    last = None
    for _ in range(11):  # >10/IP/15min trips the L1 layer (S3.4) before any user lookup
        last = client.post(f"{BASE}/login", json={"email": _email(), "password": GOOD_PW})
    assert last.status_code == 429
    assert last.json()["error"]["code"] == "rate_limited"
    assert int(last.headers["retry-after"]) > 0


def test_password_exceeding_max_length_is_422(client):
    resp = client.post(
        f"{BASE}/register",
        json={"email": _email(), "password": "A1!" + "x" * 200,
              "consents": [{"purpose": "TERMS_OF_SERVICE", "wording_version": "v1"}]},
    )
    assert resp.status_code == 422  # capped at the schema boundary (DoS guard)


def test_lockout_sends_security_email(client, mailbox):
    email = _email()
    _register(client, email)
    client.cookies.clear()
    for _ in range(5):  # 5 failures -> account lock (S3.4)
        client.post(f"{BASE}/login", json={"email": email, "password": "WrongPass!9"})
    assert any("locked" in m["subject"].lower() for m in mailbox)  # security alert emailed
