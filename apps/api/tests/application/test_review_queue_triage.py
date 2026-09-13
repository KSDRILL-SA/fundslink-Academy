"""The review queue is ordered for triage, and SLAs come from config — D-002 · D-013 (#288).

Completeness audit gap G2. The queue was ``ORDER BY created_at DESC``: newest first, priority
ignored. A CRITICAL application — Lerato, defunded at year-end, the persona D-002 exists for —
waited behind every NORMAL application that arrived after hers. `review_sla_days` and
`emergency_review_sla_days` were seeded and read by nothing, so no reviewer could see a breach
coming.

Two rules for these tests, both learned the hard way:
- Order is asserted RELATIVELY ("A before B"). The queue is global and the suite shares one
  database; an absolute position would pass or fail by what other suites left behind (#263).
- The queue is read by paging through ALL of it, so every ordering assertion also exercises the
  new multi-key cursor. A cursor bug shows up as a missing or duplicated row.
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

QUEUE = f"{BASE}/admin/applications"


def in_review(client, conn, *, priority: str = "NORMAL", submitted_days_ago: float = 0.0,
              needed_by: str | None = None, status: str = "READY_FOR_REVIEW") -> str:
    """An application waiting on FundsLink, whose review clock started ``submitted_days_ago``."""
    token, _uid = student_with_profile(client)
    app_id = create_application(client, token)["id"]
    submitted_at = datetime.now(UTC) - timedelta(days=submitted_days_ago)
    # The clock-start event is inserted with its real time rather than UPDATEd afterwards:
    # application_status_event is append-only and the trigger refuses an edit, as it should.
    conn.execute(
        "INSERT INTO application_status_event"
        " (id, application_id, to_status, actor_user_id, created_at)"
        " VALUES (%s, %s, 'SUBMITTED', %s, %s)",
        (f"ev_{uuid.uuid4().hex}", app_id, "SYSTEM", submitted_at),
    )
    conn.execute(
        "INSERT INTO application_status_event (id, application_id, to_status, actor_user_id)"
        " VALUES (%s, %s, %s, 'SYSTEM')",
        (f"ev_{uuid.uuid4().hex}", app_id, status),
    )
    conn.execute(
        "UPDATE funding_application SET status = %s, priority = %s, needed_by = %s WHERE id = %s",
        (status, priority, needed_by, app_id),
    )
    return app_id


def queue_ids(client, token, *, status: str = "READY_FOR_REVIEW", limit: int = 100) -> list[str]:
    """Every id in the queue, in queue order, by following next_cursor to the end."""
    ids: list[str] = []
    cursor = None
    for _ in range(100):  # a hard ceiling: a cursor that never ends fails, it does not hang
        params = {"status": status, "limit": limit}
        if cursor:
            params["cursor"] = cursor
        resp = client.get(QUEUE, headers=bearer(token), params=params)
        assert resp.status_code == 200, resp.text
        body = resp.json()
        ids.extend(item["id"] for item in body["items"])
        cursor = body["meta"]["next_cursor"]
        if not cursor:
            return ids
    pytest.fail("the review-queue cursor never reached the end")


def item(client, token, app_id: str) -> dict:
    resp = client.get(f"{BASE}/applications/{app_id}", headers=bearer(token))
    assert resp.status_code == 200, resp.text
    return resp.json()


def config_days(conn, key: str) -> int:
    return int(conn.execute("SELECT value FROM config WHERE key = %s", (key,)).fetchone()[0])


# --------------------------------------------------------------------------- ordering


def test_a_critical_application_is_reviewed_before_older_normal_ones(app_client, admin_conn):
    """The case the old ORDER BY got backwards — and the one D-002 exists for."""
    reviewer, _ = make_reviewer(app_client, admin_conn)
    older_normal = in_review(app_client, admin_conn, priority="NORMAL", submitted_days_ago=10)
    newer_critical = in_review(app_client, admin_conn, priority="CRITICAL", submitted_days_ago=0)

    ids = queue_ids(app_client, reviewer)

    assert ids.index(newer_critical) < ids.index(older_normal)


def test_priority_order_is_critical_then_urgent_then_normal(app_client, admin_conn):
    reviewer, _ = make_reviewer(app_client, admin_conn)
    normal = in_review(app_client, admin_conn, priority="NORMAL", submitted_days_ago=2)
    urgent = in_review(app_client, admin_conn, priority="URGENT", submitted_days_ago=1)
    critical = in_review(app_client, admin_conn, priority="CRITICAL", submitted_days_ago=0)

    ids = queue_ids(app_client, reviewer)

    assert ids.index(critical) < ids.index(urgent) < ids.index(normal)


def test_among_equals_the_longest_waiting_is_reviewed_first(app_client, admin_conn):
    """Not newest-first. A triage queue that rewards arriving late is not a queue."""
    reviewer, _ = make_reviewer(app_client, admin_conn)
    waited_longer = in_review(app_client, admin_conn, submitted_days_ago=6)
    arrived_later = in_review(app_client, admin_conn, submitted_days_ago=1)

    ids = queue_ids(app_client, reviewer)

    assert ids.index(waited_longer) < ids.index(arrived_later)


def test_same_priority_and_due_date_the_sooner_need_goes_first(app_client, admin_conn):
    reviewer, _ = make_reviewer(app_client, admin_conn)
    soon = (datetime.now(UTC) + timedelta(days=5)).date().isoformat()
    later = (datetime.now(UTC) + timedelta(days=60)).date().isoformat()
    # Same submission moment, so the due dates match; only needed_by separates them.
    needs_later = in_review(app_client, admin_conn, submitted_days_ago=3, needed_by=later)
    needs_soon = in_review(app_client, admin_conn, submitted_days_ago=3, needed_by=soon)

    ids = queue_ids(app_client, reviewer)

    assert ids.index(needs_soon) < ids.index(needs_later)


# --------------------------------------------------------------------------- the SLA


def test_the_due_date_is_submission_plus_review_sla_days_read_from_config(
    app_client, admin_conn
):
    reviewer, _ = make_reviewer(app_client, admin_conn)
    app_id = in_review(app_client, admin_conn, priority="NORMAL", submitted_days_ago=0)
    days = config_days(admin_conn, "review_sla_days")

    due = datetime.fromisoformat(item(app_client, reviewer, app_id)["review_due_at"])

    expected = datetime.now(UTC) + timedelta(days=days)
    assert abs((due - expected).total_seconds()) < 120


def test_changing_the_config_changes_the_due_date_so_nothing_is_hardcoded(
    app_client, admin_conn
):
    """The point of G2 in one test: move the config value and the SLA follows."""
    reviewer, _ = make_reviewer(app_client, admin_conn)
    app_id = in_review(app_client, admin_conn, priority="NORMAL", submitted_days_ago=0)
    original = config_days(admin_conn, "review_sla_days")
    try:
        before = datetime.fromisoformat(item(app_client, reviewer, app_id)["review_due_at"])
        admin_conn.execute(
            "UPDATE config SET value = %s WHERE key = 'review_sla_days'", (str(original + 21),)
        )
        after = datetime.fromisoformat(item(app_client, reviewer, app_id)["review_due_at"])
    finally:
        admin_conn.execute(
            "UPDATE config SET value = %s WHERE key = 'review_sla_days'", (str(original),)
        )

    assert round((after - before).total_seconds() / 86400) == 21


def test_urgent_and_critical_take_the_shorter_emergency_sla(app_client, admin_conn):
    reviewer, _ = make_reviewer(app_client, admin_conn)
    normal = in_review(app_client, admin_conn, priority="NORMAL", submitted_days_ago=0)
    urgent = in_review(app_client, admin_conn, priority="URGENT", submitted_days_ago=0)
    emergency_days = config_days(admin_conn, "emergency_review_sla_days")
    normal_days = config_days(admin_conn, "review_sla_days")

    normal_due = datetime.fromisoformat(item(app_client, reviewer, normal)["review_due_at"])
    urgent_due = datetime.fromisoformat(item(app_client, reviewer, urgent)["review_due_at"])

    gap = round((normal_due - urgent_due).total_seconds() / 86400)
    assert gap == normal_days - emergency_days


def test_an_overdue_review_is_flagged_and_a_fresh_one_is_not(app_client, admin_conn):
    reviewer, _ = make_reviewer(app_client, admin_conn)
    days = config_days(admin_conn, "review_sla_days")
    overdue = in_review(app_client, admin_conn, submitted_days_ago=days + 2)
    fresh = in_review(app_client, admin_conn, submitted_days_ago=0)

    assert item(app_client, reviewer, overdue)["sla_breached"] is True
    assert item(app_client, reviewer, fresh)["sla_breached"] is False


@pytest.mark.parametrize("status", ["RETURNED_FOR_INFO", "APPROVED", "REJECTED"])
def test_no_review_is_owed_when_the_application_is_not_waiting_on_fundslink(
    app_client, admin_conn, status
):
    """RETURNED_FOR_INFO is the student's clock (D-006); a decided application owes nothing."""
    reviewer, _ = make_reviewer(app_client, admin_conn)
    app_id = in_review(app_client, admin_conn, submitted_days_ago=40, status=status)

    body = item(app_client, reviewer, app_id)

    assert body.get("review_due_at") is None
    assert body.get("sla_breached") is None


def test_a_draft_owes_no_review(app_client, admin_conn):
    token, _uid = student_with_profile(app_client)
    app_id = create_application(app_client, token)["id"]

    body = item(app_client, token, app_id)

    assert body.get("review_due_at") is None
    assert body.get("sla_breached") is None


# --------------------------------------------------------------------------- the cursor


def test_paging_returns_every_row_exactly_once_in_the_same_order_as_one_big_page(
    app_client, admin_conn
):
    """A multi-key cursor that skips or repeats a row loses an application from review."""
    reviewer, _ = make_reviewer(app_client, admin_conn)
    for priority, days_ago in [("CRITICAL", 1), ("NORMAL", 9), ("URGENT", 3), ("NORMAL", 0),
                               ("CRITICAL", 5), ("URGENT", 7)]:
        in_review(app_client, admin_conn, priority=priority, submitted_days_ago=days_ago)

    in_pages_of_two = queue_ids(app_client, reviewer, limit=2)
    in_big_pages = queue_ids(app_client, reviewer, limit=100)

    assert len(in_pages_of_two) == len(set(in_pages_of_two)), "a row appeared on two pages"
    assert in_pages_of_two == in_big_pages, "paging changed the order or lost a row"


def test_a_cursor_from_another_list_restarts_rather_than_mis_paginating(app_client, admin_conn):
    """The student's list uses a two-key cursor; handing it to the queue must fail soft."""
    reviewer, _ = make_reviewer(app_client, admin_conn)
    in_review(app_client, admin_conn)
    from app.common.pagination import encode_cursor

    foreign = encode_cursor(datetime.now(UTC), "app_x")
    resp = app_client.get(
        QUEUE, headers=bearer(reviewer), params={"cursor": foreign, "status": "READY_FOR_REVIEW"}
    )

    assert resp.status_code == 200, resp.text
    assert resp.json()["items"], "a foreign cursor emptied the queue instead of restarting"
