"""End-to-end auth endpoints over the real RLS-enforced DB (S3.13-S3.18, S3.33).

Exercises router -> service -> repository -> Postgres AS fundslink_app, including the
SYSTEM-context login path. Covers the Gate G2 item: token reuse revokes the whole family.
"""

from __future__ import annotations

import uuid

from app.modules.auth import passwords

BASE = "/api/v1/auth"
REFRESH = "fundslink_refresh"
GOOD_PW = "Str0ng!Passw0rd"


def _email() -> str:
    # Real-looking domain — EmailStr rejects reserved TLDs (.test/.example) as it should.
    return f"ep_{uuid.uuid4().hex}@learner.fundslink.io"


def _register(client, email=None, password=GOOD_PW):
    return client.post(
        f"{BASE}/register",
        json={"email": email or _email(), "password": password,
              "consents": [{"purpose": "TERMS_OF_SERVICE", "wording_version": "v1"},
                           {"purpose": "PRIVACY_POLICY", "wording_version": "v1"}]},
    )


async def _breached(password: str, *, client=None):  # noqa: ARG001
    return True


# --------------------------------- register ---------------------------------
def test_register_returns_tokens_and_sets_httponly_cookie(client):
    resp = _register(client)
    assert resp.status_code == 201
    body = resp.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"] and body["expires_in"] == 900
    set_cookie = resp.headers.get("set-cookie", "").lower()
    assert REFRESH in set_cookie and "httponly" in set_cookie
    assert "samesite=strict" in set_cookie
    assert "path=/api/v1/auth" in set_cookie  # cookie scoped to the auth endpoints (S3.14)


def test_register_weak_password_is_422(client):
    resp = client.post(
        f"{BASE}/register",
        json={"email": _email(), "password": "weak",
              "consents": [{"purpose": "TERMS_OF_SERVICE", "wording_version": "v1"}]},
    )
    assert resp.status_code == 422


def test_register_breached_password_is_422(client, monkeypatch):
    monkeypatch.setattr(passwords, "is_breached", _breached)
    resp = _register(client)
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "password_breached"


def test_register_invalid_consent_purpose_is_422_not_500(client):
    resp = client.post(
        f"{BASE}/register",
        json={"email": _email(), "password": GOOD_PW,
              "consents": [{"purpose": "NOT_A_REAL_PURPOSE", "wording_version": "v1"}]},
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "invalid_consent_purpose"


def test_register_duplicate_email_is_409(client):
    email = _email()
    assert _register(client, email).status_code == 201
    dup = _register(client, email)
    assert dup.status_code == 409
    assert dup.json()["error"]["code"] == "email_taken"


# ----------------------------------- login ----------------------------------
def test_login_success(client):
    email = _email()
    _register(client, email)
    client.cookies.clear()
    resp = client.post(f"{BASE}/login", json={"email": email, "password": GOOD_PW})
    assert resp.status_code == 200
    assert resp.json()["access_token"]
    assert REFRESH in resp.headers.get("set-cookie", "")


def test_login_wrong_password_is_identical_401(client):
    email = _email()
    _register(client, email)
    resp = client.post(f"{BASE}/login", json={"email": email, "password": "WrongPassw0rd!"})
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "invalid_credentials"


def test_login_unknown_user_is_identical_401(client):
    resp = client.post(f"{BASE}/login", json={"email": _email(), "password": GOOD_PW})
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "invalid_credentials"  # same as wrong-password


def test_system_principal_cannot_login(client):
    # The SYSTEM principal must never receive tokens — rejected either at email validation or
    # by the service's explicit id=='SYSTEM' guard. Either way: no session is issued.
    resp = client.post(
        f"{BASE}/login", json={"email": "system@fundslink.internal", "password": GOOD_PW}
    )
    assert resp.status_code in (401, 422)
    assert "access_token" not in resp.json()


def test_login_locks_out_after_five_failures(client):
    email = _email()
    _register(client, email)
    for _ in range(5):
        client.post(f"{BASE}/login", json={"email": email, "password": "WrongPassw0rd!"})
    # 6th attempt with the CORRECT password is still refused — account is locked (S3.4 L2).
    resp = client.post(f"{BASE}/login", json={"email": email, "password": GOOD_PW})
    assert resp.status_code == 401


# ---------------------------------- refresh ---------------------------------
def _refresh_with(client, raw: str):
    client.cookies.clear()
    client.cookies.set(REFRESH, raw)
    return client.post(f"{BASE}/refresh")


def test_refresh_rotates_the_token(client):
    raw0 = _cookie_value(_register(client).headers["set-cookie"])
    resp = _refresh_with(client, raw0)
    assert resp.status_code == 200
    raw1 = _cookie_value(resp.headers["set-cookie"])
    assert raw1 and raw1 != raw0  # rotated


def test_refresh_reuse_revokes_the_whole_family(client):
    """Gate G2: presenting a rotated (used) refresh token revokes the entire family."""
    raw0 = _cookie_value(_register(client).headers["set-cookie"])

    # 1) Legitimate rotation: R0 -> R1.
    r1_resp = _refresh_with(client, raw0)
    assert r1_resp.status_code == 200
    raw1 = _cookie_value(r1_resp.headers["set-cookie"])

    # 2) Attacker replays the already-used R0 -> reuse detected, 401.
    assert _refresh_with(client, raw0).status_code == 401

    # 3) The family is now revoked, so even the legitimate R1 is dead.
    assert _refresh_with(client, raw1).status_code == 401


# ----------------------------------- logout ---------------------------------
def test_logout_denylists_access_token(client):
    reg = _register(client)
    access = reg.json()["access_token"]
    raw = _cookie_value(reg.headers["set-cookie"])
    headers = {"Authorization": f"Bearer {access}"}
    client.cookies.clear()
    client.cookies.set(REFRESH, raw)

    logout = client.post(f"{BASE}/logout", headers=headers)
    assert logout.status_code == 204
    # The access token's jti is now deny-listed -> reuse is rejected (S3.18).
    again = client.post(f"{BASE}/logout", headers=headers)
    assert again.status_code == 401


def test_logout_requires_authentication(client):
    assert client.post(f"{BASE}/logout").status_code == 401


# ------------------------------- error envelope -----------------------------
def test_error_envelope_shape(client):
    resp = client.post(f"{BASE}/login", json={"email": _email(), "password": GOOD_PW})
    error = resp.json()["error"]
    assert set(error) >= {"code", "message", "request_id"}


def _cookie_value(set_cookie_header: str) -> str:
    # "fundslink_refresh=<value>; HttpOnly; ..." -> <value>
    for part in set_cookie_header.split(","):
        if REFRESH in part:
            return part.split(f"{REFRESH}=", 1)[1].split(";", 1)[0]
    raise AssertionError(f"no {REFRESH} cookie in {set_cookie_header!r}")
