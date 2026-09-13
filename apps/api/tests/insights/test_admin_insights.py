"""The staff overview is live, and gated (#294).

The database is shared across the suite, so every figure is asserted as a DELTA: read, create the
rows that should move it, read again. An absolute count would pass or fail on whatever other tests
left behind (#263).
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import pytest

from tests.application.conftest import (
    BASE,
    bearer,
    create_application,
    make_reviewer,
    student_with_profile,
)

OVERVIEW = f"{BASE}/admin/overview"
ACTIVITY = f"{BASE}/admin/activity"


def overview(client, token, **params) -> dict:
    resp = client.get(OVERVIEW, headers=bearer(token), params=params)
    assert resp.status_code == 200, resp.text
    return resp.json()


def waiting_application(client, admin_conn, *, status: str, priority: str = "NORMAL",
                        clock_started: datetime) -> str:
    token, _ = student_with_profile(client)
    app_id = create_application(client, token)["id"]
    with admin_conn.transaction():
        admin_conn.execute(
            "INSERT INTO application_status_event (id, application_id, to_status, actor_user_id,"
            " created_at) VALUES (%s, %s, 'SUBMITTED', 'SYSTEM', %s)",
            (f"ev_{uuid.uuid4().hex}", app_id, clock_started),
        )
        admin_conn.execute(
            "INSERT INTO application_status_event (id, application_id, to_status, actor_user_id)"
            " VALUES (%s, %s, %s, 'SYSTEM')",
            (f"ev_{uuid.uuid4().hex}", app_id, status),
        )
        admin_conn.execute(
            "UPDATE funding_application SET status = %s, priority = %s WHERE id = %s",
            (status, priority, app_id),
        )
    return app_id


@pytest.mark.parametrize("path", [OVERVIEW, ACTIVITY])
def test_a_student_cannot_read_staff_insights(client, path):
    token, _ = student_with_profile(client)
    assert client.get(path, headers=bearer(token)).status_code == 403


def test_the_window_is_one_the_contract_allows(client, admin_conn):
    token, _ = make_reviewer(client, admin_conn)
    assert overview(client, token)["window_days"] == 7
    assert overview(client, token, days=90)["window_days"] == 90
    assert client.get(OVERVIEW, headers=bearer(token), params={"days": 5}).status_code == 422


def test_queue_figures_move_with_the_queue(client, admin_conn):
    token, _ = make_reviewer(client, admin_conn)
    sla_days = int(admin_conn.execute(
        "SELECT value FROM config WHERE key = 'emergency_review_sla_days'").fetchone()[0])
    before = overview(client, token)["queue"]

    # Past the emergency SLA read from config, not a number this test invents.
    late = datetime.now(UTC) - timedelta(days=sla_days + 1)
    waiting_application(client, admin_conn, status="UNSCREENED", priority="URGENT",
                        clock_started=late)
    waiting_application(client, admin_conn, status="READY_FOR_REVIEW",
                        clock_started=datetime.now(UTC))
    waiting_application(client, admin_conn, status="RETURNED_FOR_INFO",
                        clock_started=datetime.now(UTC))

    after = overview(client, token)["queue"]
    delta = {k: after[k] - before[k] for k in
             ("awaiting_review", "overdue", "emergency", "unscreened", "awaiting_student")}
    assert delta == {"awaiting_review": 2, "overdue": 1, "emergency": 1, "unscreened": 1,
                     "awaiting_student": 1}


def test_decisions_and_time_to_decision_come_from_the_event_log(client, admin_conn):
    token, reviewer = make_reviewer(client, admin_conn)
    before = overview(client, token)["flow"]

    app_id = waiting_application(client, admin_conn, status="UNDER_REVIEW",
                                 clock_started=datetime.now(UTC) - timedelta(days=3))
    admin_conn.execute(
        "INSERT INTO application_status_event (id, application_id, to_status, actor_user_id)"
        " VALUES (%s, %s, 'REJECTED', %s)",
        (f"ev_{uuid.uuid4().hex}", app_id, reviewer),
    )
    admin_conn.execute("UPDATE funding_application SET status = 'REJECTED' WHERE id = %s",
                       (app_id,))

    after = overview(client, token)["flow"]
    assert after["not_funded"] - before["not_funded"] == 1
    assert after["submitted"] - before["submitted"] == 1
    assert after["median_days_to_decision"] is not None


def test_delivery_and_account_security_figures(client, admin_conn):
    token, _ = make_reviewer(client, admin_conn)
    before = overview(client, token)
    _, student = student_with_profile(client)
    admin_conn.execute(
        "INSERT INTO notification_outbox (id, user_id, trigger, channels, payload, state)"
        " VALUES (%s, %s, 'DECISION_APPROVED', %s, '{}', 'DEAD')",
        (f"no_{uuid.uuid4().hex}", student, ["email"]),
    )
    admin_conn.execute(
        "INSERT INTO audit_log (id, actor_user_id, action, resource_type, request_id)"
        " VALUES (%s, NULL, 'AUTH_LOGIN_FAILURE', 'user', %s)",
        (f"al_{uuid.uuid4().hex}", uuid.uuid4().hex),
    )
    after = overview(client, token)
    assert after["notifications"]["failed"] - before["notifications"]["failed"] == 1
    assert after["accounts"]["failed_sign_ins"] - before["accounts"]["failed_sign_ins"] == 1
    # student_with_profile registered one account in between.
    assert after["accounts"]["registered"] - before["accounts"]["registered"] == 1


def test_system_activity_carries_no_detail_and_reduces_actors_to_a_kind(client, admin_conn):
    token, reviewer = make_reviewer(client, admin_conn)
    marker = f"res_{uuid.uuid4().hex}"
    for actor in (reviewer, None, "SYSTEM"):
        admin_conn.execute(
            "INSERT INTO audit_log (id, actor_user_id, action, resource_type, resource_id,"
            " request_id, detail) VALUES (%s, %s, 'PROBE', 'probe', %s, %s, %s)",
            (f"al_{uuid.uuid4().hex}", actor, marker, uuid.uuid4().hex,
             '{"email": "person@example.com"}'),
        )
    _, student = student_with_profile(client)

    resp = client.get(ACTIVITY, headers=bearer(token), params={"limit": 50})
    assert resp.status_code == 200, resp.text
    items = resp.json()["items"]
    assert "person@example.com" not in resp.text
    probes = sorted(i["actor_kind"] for i in items if i.get("resource_id") == marker)
    assert probes == ["ANONYMOUS", "STAFF", "SYSTEM"]
    registered = [i for i in items
                  if i["action"] == "AUTH_REGISTER" and i["resource_id"] == student]
    assert [i["actor_kind"] for i in registered] == ["STUDENT"]
    assert all("detail" not in i for i in items)
