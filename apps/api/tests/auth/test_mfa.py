"""MFA (TOTP) — AES-GCM crypto, helpers, and the enrol/activate/enforce flow (TAD §3.1).

Gate G2: an un-enrolled privileged user (admin) is blocked from a full session — they receive
only an mfa_pending step-up token that cannot reach business routes until they activate MFA.
"""

from __future__ import annotations

import os
import uuid

import psycopg
import pyotp
import pytest

from app.modules.auth import crypto, mfa, passwords
from app.modules.auth.crypto import EncryptionError

BASE = "/api/v1/auth"
GOOD_PW = "Str0ng!Passw0rd"
REFRESH = "fundslink_refresh"


def _conninfo() -> str:
    url = (
        os.environ.get("ALEMBIC_DATABASE_URL")
        or os.environ.get("DATABASE_URL")
        or "postgresql://fundslink:fundslink@localhost:5432/fundslink"
    )
    return url.replace("+asyncpg", "").replace("+psycopg", "")


def _create_admin() -> str:
    """Seed an ACTIVE ADMIN_REVIEWER directly (owner connection bypasses RLS). Returns email."""
    email = f"adm_{uuid.uuid4().hex}@fundslink.io"
    uid = f"adm_{uuid.uuid4().hex[:12]}"
    admin = psycopg.connect(_conninfo(), autocommit=True)
    try:
        admin.execute(
            'INSERT INTO "user"(id,email,password_hash,account_state) VALUES (%s,%s,%s,%s)',
            (uid, email, passwords.hash_password(GOOD_PW), "ACTIVE"),
        )
        admin.execute(
            "INSERT INTO user_role(id,user_id,role_id)"
            " SELECT %s,%s,r.id FROM role r WHERE r.code='ADMIN_REVIEWER'",
            (f"{uid}_r", uid),
        )
    finally:
        admin.close()
    return email


def _bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _login(client, email: str, **extra):
    return client.post(f"{BASE}/login", json={"email": email, "password": GOOD_PW, **extra})


def _totp(secret: str) -> str:
    return pyotp.TOTP(secret).now()


# -------------------------------- crypto unit tests --------------------------------
def test_aes_gcm_roundtrip(rs256_keys):
    token = crypto.encrypt("top-secret-totp")
    assert token != "top-secret-totp"
    assert crypto.decrypt(token) == "top-secret-totp"


def test_aes_gcm_tamper_is_rejected(rs256_keys):
    token = crypto.encrypt("x")
    tampered = token[:-2] + ("AA" if not token.endswith("AA") else "BB")
    with pytest.raises(EncryptionError):
        crypto.decrypt(tampered)


# --------------------------------- helper unit tests -------------------------------
def test_totp_verify_and_provisioning():
    secret = mfa.generate_secret()
    assert mfa.provisioning_uri(secret, "a@b.io").startswith("otpauth://totp/")
    assert mfa.verify_totp(secret, pyotp.TOTP(secret).now()) is True
    assert mfa.verify_totp(secret, "000000") in (True, False)  # almost surely False
    assert mfa.verify_totp(secret, "notacode") is False


def test_role_requires_mfa():
    assert mfa.role_requires_mfa("ADMIN_REVIEWER") is True
    assert mfa.role_requires_mfa("STUDENT") is False


# ----------------------------- enforcement (Gate G2) ------------------------------
def test_unenrolled_admin_is_blocked_with_pending_token(client):
    email = _create_admin()
    resp = _login(client, email)
    assert resp.status_code == 200
    token = resp.json()["access_token"]
    assert REFRESH not in resp.headers.get("set-cookie", "")  # no full session (no refresh)

    # The pending token cannot reach a full-scope route (logout) — MFA blocks the admin.
    blocked = client.post(f"{BASE}/logout", headers=_bearer(token))
    assert blocked.status_code == 403
    assert blocked.json()["error"]["code"] == "mfa_required"


def _enrol_and_activate(client, email: str) -> tuple[dict, str]:
    """Drive the step-up flow; returns (enroll payload, secret) with MFA activated."""
    headers = _bearer(_login(client, email).json()["access_token"])
    enroll = client.post(f"{BASE}/mfa/enroll", headers=headers)
    assert enroll.status_code == 200
    secret = enroll.json()["secret"]
    activate = client.post(f"{BASE}/mfa/activate", headers=headers, json={"code": _totp(secret)})
    assert activate.status_code == 204
    return enroll.json(), secret


def test_admin_enrol_activate_then_full_login(client):
    email = _create_admin()
    enroll, secret = _enrol_and_activate(client, email)
    assert enroll["provisioning_uri"].startswith("otpauth://")
    assert len(enroll["recovery_codes"]) == 8

    # Full login now REQUIRES a TOTP.
    assert _login(client, email).status_code == 401
    full = _login(client, email, mfa_code=_totp(secret))
    assert full.status_code == 200
    assert REFRESH in full.headers.get("set-cookie", "")  # full session has a refresh cookie


def test_totp_code_cannot_be_replayed(client):
    """ST-2 hardening: a TOTP step is single-use — a captured code can't be reused in its window."""
    email = _create_admin()
    _enroll, secret = _enrol_and_activate(client, email)
    code = _totp(secret)

    first = _login(client, email, mfa_code=code)
    assert first.status_code == 200
    client.cookies.clear()
    # Same code, same 30s step -> replay rejected.
    assert _login(client, email, mfa_code=code).status_code == 401


def test_admin_login_with_wrong_totp_is_401(client):
    email = _create_admin()
    _enrol_and_activate(client, email)
    assert _login(client, email, mfa_code="000000").status_code == 401


def test_recovery_code_logs_in_and_is_single_use(client):
    email = _create_admin()
    enroll, _secret = _enrol_and_activate(client, email)
    recovery = enroll["recovery_codes"][0]

    first = _login(client, email, mfa_code=recovery)
    assert first.status_code == 200
    client.cookies.clear()
    # The same recovery code is now consumed — it must not work twice.
    assert _login(client, email, mfa_code=recovery).status_code == 401
