"""G3 pipeline-demo fixtures — every Stage-03 router mounted on the shared harness."""

from __future__ import annotations

import uuid

import psycopg
import pytest

from app.modules.application.router import router as application_router
from app.modules.auth.jwt import create_access_token, decode_access_token
from app.modules.eligibility.router import router as eligibility_router
from app.modules.matching.router import router as matching_router
from app.modules.notification.router import router as notification_router
from app.modules.profile.router import router as profile_router
from app.modules.tracking.router import router as tracking_router
from tests.auth.conftest import auth_test_client, migrated_db, rs256_keys  # noqa: F401

BASE = "/api/v1"
GOOD_PW = "Str0ng!Passw0rd"
ALL_ROUTERS = [
    profile_router, application_router, eligibility_router,
    matching_router, tracking_router, notification_router,
]


@pytest.fixture
def api(migrated_db, rs256_keys, monkeypatch):  # noqa: F811
    with auth_test_client(migrated_db, monkeypatch, extra_routers=ALL_ROUTERS) as client:
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
    email = f"g3_{uuid.uuid4().hex}@learner.fundslink.io"
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
        json={"first_name": "Kabelo", "last_name": "Mahlangu", "level": "UG",
              "field_of_study": "Computer Science",
              # D-007: SUBMIT requires a SA ID on file (unique blind index, BR-A04).
              "id_number": f"{uuid.uuid4().int % 10**13:013d}"},
    )
    return token, decode_access_token(token)["sub"]


def make_reviewer(client, admin_conn) -> str:
    email = f"g3rev_{uuid.uuid4().hex}@fundslink.io"
    reg = client.post(
        f"{BASE}/auth/register",
        json={"email": email, "password": GOOD_PW,
              "consents": [{"purpose": "TERMS_OF_SERVICE", "wording_version": "v1"}]},
    )
    uid = decode_access_token(reg.json()["access_token"])["sub"]
    client.cookies.clear()
    admin_conn.execute(
        "INSERT INTO user_role (id, user_id, role_id)"
        " SELECT %s, %s, r.id FROM role r WHERE r.code = 'ADMIN_REVIEWER' ON CONFLICT DO NOTHING",
        (f"ur_{uuid.uuid4().hex}", uid),
    )
    return create_access_token(sub=uid, role="ADMIN_REVIEWER", email=email, version=1)[0]
