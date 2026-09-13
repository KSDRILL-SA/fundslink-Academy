"""Reviewer recusal — BR-E09 · E8 (completeness audit G4, #300).

A recusal table existed with no endpoint, no rule and no screen, so nothing stopped a reviewer
deciding the application of someone they know. These tests hold the three things E8 requires: the
recusal is recorded, the recused reviewer cannot act, and the case is reassigned — it leaves that
reviewer's queue and stays in everyone else's.
"""

from __future__ import annotations

from tests.application.conftest import (
    BASE,
    bearer,
    create_application,
    force_status,
    make_reviewer,
    student_with_profile,
)
from tests.application.test_review_queue_triage import queue_ids

REASON = "The applicant is my cousin's daughter; I know the family well."


def ready_application(client, admin_conn) -> tuple[str, str]:
    token, _ = student_with_profile(client)
    app_id = create_application(client, token)["id"]
    force_status(admin_conn, app_id, "READY_FOR_REVIEW")
    return app_id, token


def recuse(client, token, app_id, reason=REASON):
    return client.post(
        f"{BASE}/admin/applications/{app_id}/recusal",
        headers=bearer(token),
        json={"reason": reason},
    )


def test_a_reviewer_steps_aside_once_and_it_is_recorded(app_client, admin_conn):
    app_id, _ = ready_application(app_client, admin_conn)
    token, reviewer = make_reviewer(app_client, admin_conn)

    first = recuse(app_client, token, app_id)
    assert first.status_code == 201, first.text
    assert first.json()["application_id"] == app_id
    assert recuse(app_client, token, app_id).status_code == 409

    reason, = admin_conn.execute(
        "SELECT reason FROM recusal WHERE application_id = %s AND reviewer_id = %s",
        (app_id, reviewer),
    ).fetchone()
    assert reason == REASON
    audit = admin_conn.execute(
        "SELECT detail FROM audit_log WHERE action = 'APPLICATION_RECUSED'"
        " AND actor_user_id = %s AND resource_id = %s",
        (reviewer, app_id),
    ).fetchall()
    # Audited once, and the personal reason stays on the staff-only recusal record.
    assert len(audit) == 1 and audit[0][0] is None


def test_a_recused_reviewer_cannot_decide_or_reprioritise(app_client, admin_conn):
    app_id, _ = ready_application(app_client, admin_conn)
    token, _ = make_reviewer(app_client, admin_conn)
    assert recuse(app_client, token, app_id).status_code == 201

    review = app_client.post(
        f"{BASE}/admin/applications/{app_id}/review",
        headers=bearer(token),
        json={"decision": "UNDER_REVIEW"},
    )
    assert review.status_code == 403
    assert review.json()["error"]["code"] == "reviewer_recused"
    priority = app_client.post(
        f"{BASE}/admin/applications/{app_id}/priority",
        headers=bearer(token),
        json={"priority": "URGENT", "note": "Defunded at year-end; fees due now."},
    )
    assert priority.status_code == 403
    status, prio = admin_conn.execute(
        "SELECT status, priority FROM funding_application WHERE id = %s", (app_id,)
    ).fetchone()
    assert (status, prio) == ("READY_FOR_REVIEW", "NORMAL")


def test_the_case_is_reassigned_not_stuck(app_client, admin_conn):
    app_id, _ = ready_application(app_client, admin_conn)
    recused_token, _ = make_reviewer(app_client, admin_conn)
    other_token, _ = make_reviewer(app_client, admin_conn)
    assert app_id in queue_ids(app_client, recused_token, status=None)
    assert recuse(app_client, recused_token, app_id).status_code == 201

    assert app_id not in queue_ids(app_client, recused_token, status=None)
    assert app_id not in queue_ids(app_client, recused_token, status="READY_FOR_REVIEW")
    assert app_id in queue_ids(app_client, other_token, status=None)

    review = app_client.post(
        f"{BASE}/admin/applications/{app_id}/review",
        headers=bearer(other_token),
        json={"decision": "UNDER_REVIEW"},
    )
    assert review.status_code == 200, review.text


def test_the_reviewer_screen_knows_and_the_student_is_never_told(app_client, admin_conn):
    app_id, student_token = ready_application(app_client, admin_conn)
    token, _ = make_reviewer(app_client, admin_conn)
    read = lambda: app_client.get(  # noqa: E731
        f"{BASE}/admin/applications/{app_id}", headers=bearer(token)
    ).json()
    assert read()["recused_by_me"] is False
    recuse(app_client, token, app_id)
    assert read()["recused_by_me"] is True

    mine = app_client.get(f"{BASE}/applications/{app_id}", headers=bearer(student_token)).json()
    assert mine.get("recused_by_me") is None


def test_only_a_reviewer_can_recuse_and_only_with_a_reason(app_client, admin_conn):
    app_id, student_token = ready_application(app_client, admin_conn)
    assert recuse(app_client, student_token, app_id).status_code == 403
    token, _ = make_reviewer(app_client, admin_conn)
    assert recuse(app_client, token, app_id, reason="knowem").status_code == 422
    assert recuse(app_client, token, "no_such_application").status_code == 404
