"""Tracking-test fixtures — profile + tracking routers; bursary/deadline seeding."""

from __future__ import annotations

import uuid

import psycopg
import pytest

from app.modules.auth.jwt import decode_access_token
from app.modules.profile.router import router as profile_router
from app.modules.tracking.router import router as tracking_router
from tests.auth.conftest import auth_test_client, migrated_db, rs256_keys  # noqa: F401

BASE = "/api/v1"
GOOD_PW = "Str0ng!Passw0rd"


@pytest.fixture
def track_client(migrated_db, rs256_keys, monkeypatch):  # noqa: F811
    with auth_test_client(
        migrated_db, monkeypatch, extra_routers=[profile_router, tracking_router]
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


def student_with_profile(client) -> tuple[str, str]:
    email = f"track_{uuid.uuid4().hex}@learner.fundslink.io"
    reg = client.post(
        f"{BASE}/auth/register",
        json={"email": email, "password": GOOD_PW,
              "consents": [{"purpose": "TERMS_OF_SERVICE", "wording_version": "v1"}]},
    )
    assert reg.status_code == 201, reg.text
    token = reg.json()["access_token"]
    client.cookies.clear()
    client.put(
        f"{BASE}/students/me/profile",
        headers=bearer(token),
        json={"first_name": "Naledi", "last_name": "Sithole", "level": "UG",
              "field_of_study": "Law"},
    )
    return token, decode_access_token(token)["sub"]


def seed_bursary(admin_conn, *, name="External Bursary") -> str:
    bid = f"eb_{uuid.uuid4().hex}"
    admin_conn.execute(
        "INSERT INTO external_bursary (id, name, provider, level_eligibility, field_tags, status,"
        " created_by) VALUES (%s,%s,'Provider',%s,%s,'OPEN','SYSTEM')",
        (bid, name, ["UG"], ["law"]),
    )
    return bid


def add_deadline(admin_conn, bursary_id: str, *, days: int) -> None:
    admin_conn.execute(
        "INSERT INTO bursary_deadline (id, external_bursary_id, deadline_type, due_on)"
        " VALUES (%s, %s, 'APPLICATION', CURRENT_DATE + %s)",
        (f"bd_{uuid.uuid4().hex}", bursary_id, days),
    )
