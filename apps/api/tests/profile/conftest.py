"""Profile-test fixtures — reuse the auth harness, mounting the profile router alongside auth.

The shared DB/key fixtures (migrated_db, rs256_keys) and the TestClient builder (auth_test_client)
live in tests/auth/conftest.py; they are imported here so the profile package's tests run against
the same production-like stack (router → service → repository → RLS-enforced DB as fundslink_app).
"""

from __future__ import annotations

import uuid

import psycopg
import pytest

from app.modules.auth.jwt import decode_access_token
from app.modules.profile.router import router as profile_router
from tests.auth.conftest import auth_test_client, migrated_db, rs256_keys  # noqa: F401

BASE = "/api/v1"
GOOD_PW = "Str0ng!Passw0rd"


@pytest.fixture
def profile_client(migrated_db, rs256_keys, monkeypatch):  # noqa: F811
    """Full-stack client with the auth + profile routers mounted."""
    with auth_test_client(migrated_db, monkeypatch, extra_routers=[profile_router]) as client:
        yield client


@pytest.fixture
def admin_conn(migrated_db):  # noqa: F811
    """A superuser (RLS-bypassing) psycopg connection — for asserting on encrypted columns."""
    conn = psycopg.connect(migrated_db, autocommit=True)
    try:
        yield conn
    finally:
        conn.close()


def bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def register_student(client) -> tuple[str, str]:
    """Register a fresh student; return (access_token, user_id). Cookies cleared for header auth."""
    email = f"prof_{uuid.uuid4().hex}@learner.fundslink.io"
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


def valid_profile(**overrides) -> dict:
    body = {
        "first_name": "Thandi",
        "last_name": "Mokoena",
        "phone": "0721234567",
        "level": "UG",
        "field_of_study": "BSc Computer Science",
    }
    body.update(overrides)
    return body
