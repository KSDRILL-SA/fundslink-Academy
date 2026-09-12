"""Matching-test fixtures — profile + matching routers; bursary seeding; fresh in-memory stores."""

from __future__ import annotations

import uuid

import psycopg
import pytest

from app.modules.auth.jwt import decode_access_token
from app.modules.matching.router import router as matching_router
from app.modules.matching.stores import InMemoryEmbeddingStore, InMemoryReasoningStore
from app.modules.profile.router import router as profile_router
from tests.auth.conftest import auth_test_client, migrated_db, rs256_keys  # noqa: F401

BASE = "/api/v1"
GOOD_PW = "Str0ng!Passw0rd"


@pytest.fixture
def match_client(migrated_db, rs256_keys, monkeypatch):  # noqa: F811
    # Fresh in-memory stores per test (the module globals are process-wide otherwise).
    monkeypatch.setattr("app.modules.matching.stores._embedding_store", InMemoryEmbeddingStore())
    monkeypatch.setattr("app.modules.matching.stores._reasoning_store", InMemoryReasoningStore())
    with auth_test_client(
        migrated_db, monkeypatch, extra_routers=[profile_router, matching_router]
    ) as client:
        yield client


@pytest.fixture
def admin_conn(migrated_db):  # noqa: F811
    conn = psycopg.connect(migrated_db, autocommit=True)
    try:
        yield conn
    finally:
        conn.close()


@pytest.fixture(autouse=True)
def only_this_tests_bursaries(admin_conn):
    """Every matching test starts with no live bursary candidates.

    Matching persists only the TOP_N (10) highest-scoring candidates, so any
    test that seeds a bursary and asserts it was matched is really asserting
    "and fewer than ten better ones exist". That held in CI, where the database
    is a fresh container each run, and failed locally, where the test database
    is not recreated between runs and had accumulated a hundred bursaries from
    previous sessions — two tests passed or failed purely by how many times the
    suite had been run before. An assertion like that cannot catch a
    regression.

    Soft-delete rather than DELETE: ``match_result`` references these rows, and
    ``candidates()`` already filters on ``deleted_at IS NULL``, so this is the
    same exclusion the query performs and touches no foreign key.
    """
    admin_conn.execute("UPDATE external_bursary SET deleted_at = now() WHERE deleted_at IS NULL")
    return admin_conn


def bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def student_with_profile(client, *, level="UG", field="Computer Science") -> tuple[str, str]:
    email = f"match_{uuid.uuid4().hex}@learner.fundslink.io"
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
        json={"first_name": "Ayanda", "last_name": "Khumalo", "level": level,
              "field_of_study": field},
    )
    return token, decode_access_token(token)["sub"]


def seed_bursary(
    admin_conn,
    *,
    name="Tech Futures Bursary",
    provider="ACME Foundation",
    levels=("UG", "HONOURS"),
    tags=("computer", "science", "engineering"),
    status="OPEN",
    deadline_offset_days: int | None = 30,
) -> str:
    bid = f"eb_{uuid.uuid4().hex}"
    admin_conn.execute(
        "INSERT INTO external_bursary (id, name, provider, level_eligibility, field_tags, status,"
        " source_url, created_by) VALUES (%s,%s,%s,%s,%s,%s,%s,'SYSTEM')",
        (bid, name, provider, list(levels), list(tags), status, "https://example.org/b"),
    )
    if deadline_offset_days is not None:
        admin_conn.execute(
            "INSERT INTO bursary_deadline (id, external_bursary_id, deadline_type, due_on)"
            " VALUES (%s, %s, 'APPLICATION', CURRENT_DATE + %s)",
            (f"bd_{uuid.uuid4().hex}", bid, deadline_offset_days),
        )
    return bid
