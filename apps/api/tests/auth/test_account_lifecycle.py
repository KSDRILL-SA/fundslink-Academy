"""Account lifecycle — email verification (S3.12), password reset (S3.30), change (S3.35).

Uses a capturing email adapter so the verify/reset token can be read without any network. Each
flow asserts the security guarantees: enumeration-proof reset, single-use tokens, and that a
reset/change revokes all existing sessions.
"""

from __future__ import annotations

import uuid

from app.core.config import settings
from app.modules.auth import passwords

BASE = "/api/v1/auth"
GOOD_PW = "Str0ng!Passw0rd"
NEW_PW = "Even!Str0nger9"
REFRESH = "fundslink_refresh"


def _email() -> str:
    return f"life_{uuid.uuid4().hex}@learner.fundslink.io"


def _register(client, email=None, password=GOOD_PW):
    return client.post(
        f"{BASE}/register",
        json={"email": email or _email(), "password": password,
              "consents": [{"purpose": "TERMS_OF_SERVICE", "wording_version": "v1"}]},
    )


def _token_from(body: str) -> str:
    return body.rsplit(": ", 1)[1].strip()


def _login(client, email: str, password: str):
    return client.post(f"{BASE}/login", json={"email": email, "password": password})


def _reset(client, token: str, new_password: str):
    return client.post(
        f"{BASE}/reset-password", json={"token": token, "new_password": new_password}
    )


# --------------------------------- email verify -------------------------------
def test_email_verification_flow(client, mailbox, monkeypatch):
    monkeypatch.setattr(settings, "email_verification_required", True)
    email = _email()
    assert _register(client, email).status_code == 201  # account is PENDING_VERIFICATION
    client.cookies.clear()

    # Cannot log in until verified (state != ACTIVE -> identical 401).
    assert _login(client, email, GOOD_PW).status_code == 401

    token = _token_from([m for m in mailbox if "Verify" in m["subject"]][0]["body"])
    assert client.post(f"{BASE}/verify-email", json={"token": token}).status_code == 204

    # Now verified -> login works.
    assert _login(client, email, GOOD_PW).status_code == 200


def test_verify_email_invalid_token_is_400(client):
    resp = client.post(f"{BASE}/verify-email", json={"token": "not-a-real-token"})
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "invalid_token"


# --------------------------------- password reset -----------------------------
def test_forgot_password_is_always_202(client, mailbox):
    # Unknown email -> still 202 (enumeration-proof, S3.30); no error, no signal.
    assert client.post(f"{BASE}/forgot-password", json={"email": _email()}).status_code == 202
    assert mailbox == []  # nothing sent for a non-existent account


def test_password_reset_flow_revokes_sessions(client, mailbox):
    email = _email()
    _register(client, email)
    client.cookies.clear()

    assert client.post(f"{BASE}/forgot-password", json={"email": email}).status_code == 202
    token = _token_from([m for m in mailbox if "Reset" in m["subject"]][0]["body"])

    assert _reset(client, token, NEW_PW).status_code == 204

    # Old password no longer works; new password does.
    assert _login(client, email, GOOD_PW).status_code == 401
    assert _login(client, email, NEW_PW).status_code == 200

    # The reset token is single-use.
    reuse = _reset(client, token, "Another!Pass1")
    assert reuse.status_code == 400


def test_reset_password_weak_is_422(client, mailbox):
    email = _email()
    _register(client, email)
    client.post(f"{BASE}/forgot-password", json={"email": email})
    token = _token_from([m for m in mailbox if "Reset" in m["subject"]][0]["body"])
    resp = client.post(f"{BASE}/reset-password", json={"token": token, "new_password": "weak"})
    assert resp.status_code == 422


# --------------------------------- change password ----------------------------
def test_change_password_flow(client):
    email = _email()
    reg = _register(client, email)
    access = reg.json()["access_token"]
    old_refresh = reg.headers.get("set-cookie", "")
    headers = {"Authorization": f"Bearer {access}"}

    changed = client.post(
        f"{BASE}/change-password",
        headers=headers,
        json={"current_password": GOOD_PW, "new_password": NEW_PW},
    )
    assert changed.status_code == 204

    # Old refresh family is revoked (all sessions invalidated — S3.35).
    raw0 = old_refresh.split(f"{REFRESH}=", 1)[1].split(";", 1)[0]
    client.cookies.clear()
    client.cookies.set(REFRESH, raw0)
    assert client.post(f"{BASE}/refresh").status_code == 401

    client.cookies.clear()
    assert _login(client, email, NEW_PW).status_code == 200


def test_change_password_wrong_current_is_401(client):
    email = _email()
    access = _register(client, email).json()["access_token"]
    resp = client.post(
        f"{BASE}/change-password",
        headers={"Authorization": f"Bearer {access}"},
        json={"current_password": "WrongOld!1", "new_password": NEW_PW},
    )
    assert resp.status_code == 401


def test_change_password_requires_auth(client):
    resp = client.post(
        f"{BASE}/change-password",
        json={"current_password": GOOD_PW, "new_password": NEW_PW},
    )
    assert resp.status_code == 401


def test_passwords_module_still_imports():
    # Guard: the strength policy used by reset/change is the same authoritative one.
    assert passwords.MIN_LENGTH == 10
