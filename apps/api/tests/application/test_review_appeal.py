"""Admin review, appeal (BR-E07), and the Human-Final Principle (BR-E03) — incl. the DB-trigger
proof that the SYSTEM principal can never reach a final decision."""

from __future__ import annotations

import uuid

import psycopg
import pytest

from tests.application.conftest import (
    BASE,
    bearer,
    create_application,
    force_status,
    make_reviewer,
    student_with_profile,
)

APPS = f"{BASE}/applications"
ADMIN = f"{BASE}/admin/applications"


def _ready_application(app_client, admin_conn) -> tuple[str, str]:
    """A submitted application advanced (by the module-3 stand-in) to READY_FOR_REVIEW."""
    token, _ = student_with_profile(app_client)
    app = create_application(app_client, token)
    app_client.post(f"{APPS}/{app['id']}/submit", headers=bearer(token))
    force_status(admin_conn, app["id"], "PRE_SCREENING")
    force_status(admin_conn, app["id"], "READY_FOR_REVIEW")
    return token, app["id"]


def test_admin_list_requires_review_permission(app_client):
    token, _ = student_with_profile(app_client)
    assert app_client.get(ADMIN, headers=bearer(token)).status_code == 403  # student lacks it


def test_reviewer_can_list_and_advance_to_proposed(app_client, admin_conn):
    _student, app_id = _ready_application(app_client, admin_conn)
    rev_token, _ = make_reviewer(app_client, admin_conn)
    assert app_client.get(ADMIN, headers=bearer(rev_token)).status_code == 200
    # READY_FOR_REVIEW → UNDER_REVIEW → APPROVED_PROPOSED (reviewer proposes; cannot finalise).
    r1 = app_client.post(
        f"{ADMIN}/{app_id}/review", headers=bearer(rev_token), json={"decision": "UNDER_REVIEW"}
    )
    assert r1.status_code == 200 and r1.json()["status"] == "UNDER_REVIEW"
    r2 = app_client.post(
        f"{ADMIN}/{app_id}/review",
        headers=bearer(rev_token),
        json={"decision": "APPROVED_PROPOSED", "note": "Strong case"},
    )
    assert r2.status_code == 200 and r2.json()["status"] == "APPROVED_PROPOSED"


def test_review_with_illegal_decision_is_rejected_br_s04(app_client, admin_conn):
    _student, app_id = _ready_application(app_client, admin_conn)
    rev_token, _ = make_reviewer(app_client, admin_conn)
    # APPROVED_PROPOSED is not reachable directly from READY_FOR_REVIEW.
    resp = app_client.post(
        f"{ADMIN}/{app_id}/review",
        headers=bearer(rev_token),
        json={"decision": "APPROVED_PROPOSED"},
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "invalid_transition"


def test_reject_then_student_appeals_once_br_e07(app_client, admin_conn):
    student_token, app_id = _ready_application(app_client, admin_conn)
    rev_token, _ = make_reviewer(app_client, admin_conn)
    app_client.post(
        f"{ADMIN}/{app_id}/review", headers=bearer(rev_token), json={"decision": "UNDER_REVIEW"}
    )
    rej = app_client.post(
        f"{ADMIN}/{app_id}/review", headers=bearer(rev_token), json={"decision": "REJECTED"}
    )
    assert rej.status_code == 200 and rej.json()["status"] == "REJECTED"

    appeal = app_client.post(
        f"{APPS}/{app_id}/appeal",
        headers=bearer(student_token),
        json={"new_information": "I have now obtained the missing proof of registration."},
    )
    assert appeal.status_code == 201 and appeal.json()["status"] == "APPEALED"
    # One appeal per decided application (BR-E07).
    second = app_client.post(
        f"{APPS}/{app_id}/appeal",
        headers=bearer(student_token),
        json={"new_information": "Trying to appeal a second time should be refused outright."},
    )
    assert second.status_code == 409


def test_cannot_appeal_an_application_that_was_not_rejected_br_s04(app_client, admin_conn):
    student_token, app_id = _ready_application(app_client, admin_conn)
    resp = app_client.post(
        f"{APPS}/{app_id}/appeal",
        headers=bearer(student_token),
        json={"new_information": "There is no rejection to appeal against yet at all."},
    )
    assert resp.status_code == 409  # READY_FOR_REVIEW → APPEALED is not a legal transition


def test_db_trigger_rejects_system_approval_br_e03(app_client, admin_conn):
    """The Human-Final backstop: the database itself refuses a SYSTEM-actor final decision."""
    _student, app_id = _ready_application(app_client, admin_conn)
    with pytest.raises(psycopg.errors.RaiseException) as exc:
        admin_conn.execute(
            "INSERT INTO application_status_event (id, application_id, to_status, actor_user_id)"
            " VALUES (%s, %s, 'APPROVED', 'SYSTEM')",
            (f"ev_{uuid.uuid4().hex}", app_id),
        )
    assert "HUMAN_FINAL_PRINCIPLE" in str(exc.value)
