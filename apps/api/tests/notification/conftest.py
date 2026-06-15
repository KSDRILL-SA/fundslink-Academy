"""Notification-test fixtures — notification router; outbox/consent/user seeding."""

from __future__ import annotations

import json
import uuid

import psycopg
import pytest

from app.modules.auth.jwt import decode_access_token
from app.modules.notification.router import router as notification_router
from tests.auth.conftest import auth_test_client, migrated_db, rs256_keys  # noqa: F401

BASE = "/api/v1"
GOOD_PW = "Str0ng!Passw0rd"


@pytest.fixture
def notif_client(migrated_db, rs256_keys, monkeypatch):  # noqa: F811
    with auth_test_client(
        migrated_db, monkeypatch, extra_routers=[notification_router]
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
    email = f"notif_{uuid.uuid4().hex}@learner.fundslink.io"
    reg = client.post(
        f"{BASE}/auth/register",
        json={"email": email, "password": GOOD_PW,
              "consents": [{"purpose": "TERMS_OF_SERVICE", "wording_version": "v1"}]},
    )
    assert reg.status_code == 201, reg.text
    token = reg.json()["access_token"]
    client.cookies.clear()
    return token, decode_access_token(token)["sub"]


def seed_user(admin_conn, *, consents=()) -> tuple[str, str]:
    uid = f"u_{uuid.uuid4().hex}"
    email = f"{uid}@fundslink.io"
    admin_conn.execute(
        'INSERT INTO "user" (id, email, password_hash, account_state, created_by)'
        " VALUES (%s, %s, '!x', 'ACTIVE', 'SYSTEM')",
        (uid, email),
    )
    for purpose in consents:
        admin_conn.execute(
            "INSERT INTO consent_record (id, user_id, purpose, wording_version, channel)"
            " VALUES (%s, %s, %s, 'v1', 'WEB')",
            (f"cr_{uuid.uuid4().hex}", uid, purpose),
        )
    return uid, email


def seed_outbox(
    admin_conn,
    user_id: str,
    *,
    trigger="DECISION_APPROVED",
    channels=("EMAIL",),
    state="PENDING",
    attempts=0,
    due_seconds_ago=10,
) -> str:
    nid = f"no_{uuid.uuid4().hex}"
    admin_conn.execute(
        "INSERT INTO notification_outbox"
        " (id, user_id, trigger, channels, payload, state, attempts, next_attempt_at)"
        " VALUES (%s, %s, %s, %s, %s, %s, %s, now() - make_interval(secs => %s))",
        (nid, user_id, trigger, list(channels), json.dumps({"application_id": "app_1"}),
         state, attempts, due_seconds_ago),
    )
    return nid
