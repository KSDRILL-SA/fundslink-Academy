"""Eligibility-test fixtures — profile + application + eligibility routers on the shared harness."""

from __future__ import annotations

import uuid

import psycopg
import pytest

from app.modules.application.router import router as application_router
from app.modules.auth.jwt import decode_access_token
from app.modules.eligibility.router import router as eligibility_router
from app.modules.profile.router import router as profile_router
from tests.auth.conftest import auth_test_client, migrated_db, rs256_keys  # noqa: F401

BASE = "/api/v1"
GOOD_PW = "Str0ng!Passw0rd"
PDF = b"%PDF-1.7\n%\xe2\xe3\xcf\xd3\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"


@pytest.fixture
def elig_client(migrated_db, rs256_keys, monkeypatch):  # noqa: F811
    with auth_test_client(
        migrated_db,
        monkeypatch,
        extra_routers=[profile_router, application_router, eligibility_router],
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
    email = f"elig_{uuid.uuid4().hex}@learner.fundslink.io"
    reg = client.post(
        f"{BASE}/auth/register",
        json={
            "email": email,
            "password": GOOD_PW,
            "consents": [{"purpose": "TERMS_OF_SERVICE", "wording_version": "v1"}],
        },
    )
    assert reg.status_code == 201, reg.text
    token = reg.json()["access_token"]
    client.cookies.clear()
    client.put(
        f"{BASE}/students/me/profile",
        headers=bearer(token),
        json={"first_name": "Sipho", "last_name": "Nkosi", "level": "UG", "field_of_study": "BA"},
    )
    return token, decode_access_token(token)["sub"]


def upload_doc(client, token, doc_type: str) -> None:
    resp = client.post(
        f"{BASE}/students/me/documents",
        headers=bearer(token),
        files={"file": ("d.pdf", PDF, "application/pdf")},
        data={"doc_type": doc_type},
    )
    assert resp.status_code == 201, resp.text


def create_app(client, token, **overrides) -> dict:
    body = {"application_type": "UG_CAT_C", "academic_year": "2026"}
    body.update(overrides)
    resp = client.post(f"{BASE}/applications", headers=bearer(token), json=body)
    assert resp.status_code == 201, resp.text
    return resp.json()


def submit(client, token, app_id: str):
    return client.post(f"{BASE}/applications/{app_id}/submit", headers=bearer(token))
