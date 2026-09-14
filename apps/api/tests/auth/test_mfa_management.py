"""MFA status, disable and recovery-code replacement — ST-2.1 (completeness audit G7, #305).

Before this, MFA could only be enrolled and activated: the account screen kept "on" in a local
flag (so a reload offered "set up" to someone who already had it on), a student who lost their
phone had no route back except the database, and recovery codes could never be replaced.

Every test drives the real endpoints against the real database, and the negative cases assert the
account is left exactly as it was.
"""

from __future__ import annotations

import uuid

import psycopg
import pyotp
import pytest

from app.modules.auth import passwords
from tests.auth.test_mfa import BASE, GOOD_PW, _bearer, _conninfo, _totp

STATUS = f"{BASE}/mfa"
DISABLE = f"{BASE}/mfa/disable"
RECOVERY = f"{BASE}/mfa/recovery-codes"


def _register(client) -> tuple[str, str]:
    """A student (MFA optional for them, so they may turn it off again)."""
    email = f"mfam_{uuid.uuid4().hex}@learner.fundslink.io"
    resp = client.post(
        f"{BASE}/register",
        json={
            "email": email,
            "password": GOOD_PW,
            "consents": [{"purpose": "TERMS_OF_SERVICE", "wording_version": "v1"}],
        },
    )
    assert resp.status_code == 201, resp.text
    client.cookies.clear()
    return resp.json()["access_token"], email


def _enrol_and_activate(client, token: str) -> tuple[str, list[str]]:
    enrolled = client.post(f"{BASE}/mfa/enroll", headers=_bearer(token))
    assert enrolled.status_code == 200, enrolled.text
    body = enrolled.json()
    activated = client.post(
        f"{BASE}/mfa/activate", headers=_bearer(token), json={"code": _totp(body["secret"])}
    )
    assert activated.status_code == 204, activated.text
    return body["secret"], body["recovery_codes"]


def _status(client, token: str) -> dict:
    resp = client.get(STATUS, headers=_bearer(token))
    assert resp.status_code == 200, resp.text
    return resp.json()


def _db_mfa(email: str):
    admin = psycopg.connect(_conninfo(), autocommit=True)
    try:
        return admin.execute(
            'SELECT mfa_enabled, mfa_secret_enc, mfa_recovery_enc FROM "user" WHERE email = %s',
            (email,),
        ).fetchone()
    finally:
        admin.close()


def _fresh_code(secret: str, used: set[str]) -> str:
    """A TOTP the replay guard has not seen. A test that activates and then disables inside one
    30-second step would otherwise be refused for reusing the same code (ST-2)."""
    import time

    for _ in range(70):
        code = pyotp.TOTP(secret).now()
        if code not in used:
            return code
        time.sleep(1)
    raise AssertionError("no fresh TOTP step appeared")


# ---------------------------------- status ----------------------------------


def test_status_says_what_is_actually_on(client):
    token, _email = _register(client)
    assert _status(client, token) == {
        "enrolled": False,
        "enabled": False,
        "recovery_codes_remaining": 0,
        "required_for_role": False,
    }

    secret, codes = _enrol_and_activate(client, token)
    after = _status(client, token)
    assert after["enrolled"] is True
    assert after["enabled"] is True
    assert after["recovery_codes_remaining"] == len(codes)
    # A student's role does not force it; a reviewer's does (asserted separately).
    assert after["required_for_role"] is False
    assert secret


def test_status_needs_a_session(client):
    assert client.get(STATUS).status_code == 401


# ---------------------------------- disable ----------------------------------


def test_disabling_needs_the_password_and_a_code(client):
    token, email = _register(client)
    secret, codes = _enrol_and_activate(client, token)
    used = {pyotp.TOTP(secret).now()}

    wrong_password = client.post(
        DISABLE, headers=_bearer(token), json={"password": "not-the-password", "code": codes[0]}
    )
    assert wrong_password.status_code == 401
    wrong_code = client.post(
        DISABLE, headers=_bearer(token), json={"password": GOOD_PW, "code": "000000"}
    )
    assert wrong_code.status_code == 401
    # Still on, and the codes were not spent by the refusals.
    assert _status(client, token)["enabled"] is True
    assert _status(client, token)["recovery_codes_remaining"] == len(codes)

    ok = client.post(
        DISABLE,
        headers=_bearer(token),
        json={"password": GOOD_PW, "code": _fresh_code(secret, used)},
    )
    assert ok.status_code == 204, ok.text

    assert _status(client, token) == {
        "enrolled": False,
        "enabled": False,
        "recovery_codes_remaining": 0,
        "required_for_role": False,
    }
    # The secret is cleared, not merely flagged off: a live TOTP secret on a disabled account is a
    # credential nobody is watching.
    enabled, secret_enc, recovery_enc = _db_mfa(email)
    assert (enabled, secret_enc, recovery_enc) == (False, None, None)


def test_a_recovery_code_also_turns_it_off(client):
    token, _email = _register(client)
    _secret, codes = _enrol_and_activate(client, token)
    resp = client.post(
        DISABLE, headers=_bearer(token), json={"password": GOOD_PW, "code": codes[0]}
    )
    assert resp.status_code == 204, resp.text
    assert _status(client, token)["enabled"] is False


def test_disabling_is_refused_before_it_is_on(client):
    token, _email = _register(client)
    resp = client.post(
        DISABLE, headers=_bearer(token), json={"password": GOOD_PW, "code": "123456"}
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "mfa_not_enrolled"


def test_a_privileged_account_cannot_turn_it_off(client, admin_token):
    """TAD §3.1: MFA is mandatory for reviewers — the rule outranks the account holder."""
    token, secret, email = admin_token
    resp = client.post(
        DISABLE, headers=_bearer(token), json={"password": GOOD_PW, "code": _totp(secret)}
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "mfa_required_for_role"
    assert _db_mfa(email)[0] is True  # still on
    assert _status(client, token)["required_for_role"] is True


# ------------------------------ recovery codes ------------------------------


def test_replacing_recovery_codes_invalidates_every_old_one(client):
    token, _email = _register(client)
    secret, old_codes = _enrol_and_activate(client, token)
    used = {pyotp.TOTP(secret).now()}

    resp = client.post(
        RECOVERY,
        headers=_bearer(token),
        json={"password": GOOD_PW, "code": _fresh_code(secret, used)},
    )
    assert resp.status_code == 200, resp.text
    new_codes = resp.json()["recovery_codes"]

    assert len(new_codes) == len(old_codes)
    assert set(new_codes).isdisjoint(old_codes)
    assert _status(client, token)["recovery_codes_remaining"] == len(new_codes)

    # An old code no longer signs anything: the disable path refuses it, a new one is accepted.
    stale = client.post(
        DISABLE, headers=_bearer(token), json={"password": GOOD_PW, "code": old_codes[0]}
    )
    assert stale.status_code == 401
    assert _status(client, token)["enabled"] is True
    fresh = client.post(
        DISABLE, headers=_bearer(token), json={"password": GOOD_PW, "code": new_codes[0]}
    )
    assert fresh.status_code == 204


def test_replacing_needs_both_factors(client):
    token, _email = _register(client)
    _secret, codes = _enrol_and_activate(client, token)

    assert client.post(
        RECOVERY, headers=_bearer(token), json={"password": "wrong", "code": codes[0]}
    ).status_code == 401
    assert client.post(
        RECOVERY, headers=_bearer(token), json={"password": GOOD_PW, "code": "000000"}
    ).status_code == 401
    # Nothing was replaced by a refusal.
    assert _status(client, token)["recovery_codes_remaining"] == len(codes)


def test_both_actions_are_written_to_the_account_history(client):
    token, email = _register(client)
    secret, _codes = _enrol_and_activate(client, token)
    used = {pyotp.TOTP(secret).now()}
    client.post(
        RECOVERY,
        headers=_bearer(token),
        json={"password": GOOD_PW, "code": _fresh_code(secret, used)},
    )
    client.post(
        DISABLE,
        headers=_bearer(token),
        json={"password": GOOD_PW, "code": _fresh_code(secret, used | {pyotp.TOTP(secret).now()})},
    )

    admin = psycopg.connect(_conninfo(), autocommit=True)
    try:
        uid = admin.execute('SELECT id FROM "user" WHERE email = %s', (email,)).fetchone()[0]
        actions = {
            row[0]
            for row in admin.execute(
                "SELECT action FROM audit_log WHERE actor_user_id = %s", (uid,)
            ).fetchall()
        }
    finally:
        admin.close()
    assert {"AUTH_MFA_RECOVERY_REGENERATED", "AUTH_MFA_DISABLED"} <= actions


@pytest.fixture
def admin_token(client):
    """An ADMIN_REVIEWER with MFA on — the role that may never turn it off."""
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

    # The step-up token an un-enrolled privileged user receives is enough to enrol and activate.
    stepup = client.post(f"{BASE}/login", json={"email": email, "password": GOOD_PW})
    assert stepup.status_code == 200, stepup.text
    token = stepup.json()["access_token"]
    secret, _codes = _enrol_and_activate(client, token)
    full = client.post(
        f"{BASE}/login", json={"email": email, "password": GOOD_PW, "mfa_code": _totp(secret)}
    )
    assert full.status_code == 200, full.text
    return full.json()["access_token"], secret, email
