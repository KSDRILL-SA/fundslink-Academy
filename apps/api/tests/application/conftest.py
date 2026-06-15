"""Application-test fixtures — auth + profile + application routers on the shared harness.

Reuses the auth harness (real DB as fundslink_app, fakeredis). Helpers register a student with a
profile, mint a reviewer token (a privileged role is granted in the DB, then a full-scope token is
issued directly — the login-time MFA gate is exercised in the auth suite, not here), and force an
application into a downstream status to stand in for module 3's pre-screen.
"""

from __future__ import annotations

import uuid

import psycopg
import pytest

from app.modules.application.router import router as application_router
from app.modules.auth.jwt import create_access_token, decode_access_token
from app.modules.profile.router import router as profile_router
from tests.auth.conftest import auth_test_client, migrated_db, rs256_keys  # noqa: F401

BASE = "/api/v1"
GOOD_PW = "Str0ng!Passw0rd"


@pytest.fixture
def app_client(migrated_db, rs256_keys, monkeypatch):  # noqa: F811
    with auth_test_client(
        migrated_db, monkeypatch, extra_routers=[profile_router, application_router]
    ) as client:
        yield client


@pytest.fixture
def admin_conn(migrated_db):  # noqa: F811
    conn = psycopg.connect(migrated_db, autocommit=True)
    try:
        yield conn
    finally:
        conn.close()


def bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def register_student(client) -> tuple[str, str]:
    email = f"app_{uuid.uuid4().hex}@learner.fundslink.io"
    resp = client.post(
        f"{BASE}/auth/register",
        json={
            "email": email,
            "password": GOOD_PW,
            "consents": [{"purpose": "TERMS_OF_SERVICE", "wording_version": "v1"}],
        },
    )
    assert resp.status_code == 201, resp.text
    token = resp.json()["access_token"]
    client.cookies.clear()
    return token, decode_access_token(token)["sub"]


def student_with_profile(client) -> tuple[str, str]:
    token, uid = register_student(client)
    resp = client.put(
        f"{BASE}/students/me/profile",
        headers=bearer(token),
        json={
            "first_name": "Lebo",
            "last_name": "Dlamini",
            "level": "UG",
            "field_of_study": "BEng Civil",
        },
    )
    assert resp.status_code == 200, resp.text
    return token, uid


def make_reviewer(client, admin_conn) -> tuple[str, str]:
    """Register a user, grant ADMIN_REVIEWER in the DB, and mint a full-scope reviewer token."""
    _token, uid = register_student(client)
    admin_conn.execute(
        "INSERT INTO user_role (id, user_id, role_id)"
        " SELECT %s, %s, r.id FROM role r WHERE r.code = 'ADMIN_REVIEWER'"
        " ON CONFLICT DO NOTHING",
        (f"ur_{uuid.uuid4().hex}", uid),
    )
    access, _jti = create_access_token(sub=uid, role="ADMIN_REVIEWER", email="rev@fundslink.io",
                                       version=1)
    return access, uid


def create_application(client, token, **overrides) -> dict:
    body = {"application_type": "UG_CAT_C", "academic_year": "2026"}
    body.update(overrides)
    resp = client.post(f"{BASE}/applications", headers=bearer(token), json=body)
    assert resp.status_code == 201, resp.text
    return resp.json()


def force_status(admin_conn, app_id: str, status: str, *, actor: str = "SYSTEM") -> None:
    """Stand in for module 3: append a status event (actor SYSTEM) and move the cache forward."""
    admin_conn.execute(
        "INSERT INTO application_status_event (id, application_id, to_status, actor_user_id)"
        " VALUES (%s, %s, %s, %s)",
        (f"ev_{uuid.uuid4().hex}", app_id, status, actor),
    )
    admin_conn.execute(
        "UPDATE funding_application SET status = %s WHERE id = %s", (status, app_id)
    )
