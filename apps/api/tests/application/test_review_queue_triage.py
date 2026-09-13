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


HUMAN_FINAL = {"APPROVED", "REJECTED", "REJECTED_FINAL"}


def in_review(client, conn, *, priority: str = "NORMAL", submitted_days_ago: float = 0.0,
              needed_by: str | None = None, status: str = "READY_FOR_REVIEW",
              submitted_at: datetime | None = None, decided_by: str | None = None) -> str:
    """An application waiting on FundsLink, whose review clock started ``submitted_days_ago``.

    ``submitted_at`` pins the exact clock start, for tests that need two applications to share a
    due date — two calls a few milliseconds apart do NOT, and the due date outranks needed_by.

    A decided status needs ``decided_by``, a human: the database refuses a SYSTEM decision
    (fn_human_final, D-010). An earlier version of this fixture recorded one as SYSTEM and the
    trigger rejected it, which is the invariant working, not the test.
    """
    token, _uid = student_with_profile(client)
    app_id = create_application(client, token)["id"]
    if submitted_at is None:
        submitted_at = datetime.now(UTC) - timedelta(days=submitted_days_ago)
    # The clock-start event is inserted with its real time rather than UPDATEd afterwards:
    # application_status_event is append-only and the trigger refuses an edit, as it should.
    # ONE transaction. These were three autocommit statements, so when the database refused a
    # SYSTEM decision (fn_human_final) the backdated SUBMITTED event had already committed, leaving
    # an application whose cached status disagreed with its events — six such rows, which the
    # DB-D39 integrity job then (correctly) reported. A fixture that fails must leave nothing.
    with conn.transaction():
        conn.execute(
            "INSERT INTO application_status_event"
            " (id, application_id, to_status, actor_user_id, created_at)"
            " VALUES (%s, %s, 'SUBMITTED', %s, %s)",
            (f"ev_{uuid.uuid4().hex}", app_id, "SYSTEM", submitted_at),
        )
        actor = decided_by if status in HUMAN_FINAL else "SYSTEM"
        assert actor, f"{status} needs a human decided_by (fn_human_final, D-010)"
        conn.execute(
            "INSERT INTO application_status_event (id, application_id, to_status, actor_user_id)"
            " VALUES (%s, %s, %s, %s)",
            (f"ev_{uuid.uuid4().hex}", app_id, status, actor),
        )
        conn.execute(
            "UPDATE funding_application SET status = %s, priority = %s, needed_by = %s"
            " WHERE id = %s",
            (status, priority, needed_by, app_id),
        )
    return app_id


def queue_ids(
    client, token, *, status: str | None = "READY_FOR_REVIEW", limit: int = 100
) -> list[str]:
    """Every id in the queue, in queue order, by following next_cursor to the end.

    ``status=None`` reads the default queue — what the reviewer's screen actually shows.

    Two different failures are kept distinguishable. A cursor that comes back unchanged is STUCK
    and fails immediately. A long queue is not a failure: the shared test database accumulates
    rows across runs, and an earlier fixed ceiling of 100 pages tripped on a genuinely long queue
    and looked exactly like a stuck cursor.
    """
    ids: list[str] = []
    cursor = None
    seen: set[str] = set()
    while True:
        params = {"limit": limit, **({"status": status} if status else {})}
        if cursor:
            params["cursor"] = cursor
        resp = client.get(QUEUE, headers=bearer(token), params=params)
        assert resp.status_code == 200, resp.text
        body = resp.json()
        ids.extend(item["id"] for item in body["items"])
        cursor = body["meta"]["next_cursor"]
        if not cursor:
            return ids
        if cursor in seen:
            pytest.fail(f"the review-queue cursor did not advance after {len(ids)} rows")
        seen.add(cursor)


def item(client, token, app_id: str, *, as_reviewer: bool = True) -> dict:
    """One application, read the way its reader reads it: a reviewer through the admin endpoint,
    a student through their own."""
    path = f"{BASE}/admin/applications/{app_id}" if as_reviewer else f"{BASE}/applications/{app_id}"
    resp = client.get(path, headers=bearer(token))
    assert resp.status_code == 200, resp.text
    return resp.json()


def config_days(conn, key: str) -> int:
    return int(conn.execute("SELECT value FROM config WHERE key = %s", (key,)).fetchone()[0])


# --------------------------------------------------------------------------- ordering
#
# Every ordering test inserts THREE applications in a deliberately scrambled order, chosen so the
# expected order is wrong under BOTH naive orderings — newest-first (the old ORDER BY created_at
# DESC) and oldest-first. The first version used two rows inserted in the "nice" order, and its
# negative control showed the two headline priority tests PASSING against the broken query: the
# CRITICAL row happened to be inserted last, so newest-first put it on top by accident. Those tests
# were measuring insertion order, not the triage rule.


def assert_order(ids: list[str], *expected: str) -> None:
    positions = [ids.index(app_id) for app_id in expected]
    assert positions == sorted(positions), f"queue order was {positions} for the expected sequence"


def test_a_critical_application_is_reviewed_before_normal_ones_either_side_of_it(
    app_client, admin_conn
):
    """The case D-002 exists for — and the one the old ORDER BY got wrong."""
    reviewer, _ = make_reviewer(app_client, admin_conn)
    normal_older = in_review(app_client, admin_conn, priority="NORMAL", submitted_days_ago=10)
    critical = in_review(app_client, admin_conn, priority="CRITICAL", submitted_days_ago=5)
    normal_newer = in_review(app_client, admin_conn, priority="NORMAL", submitted_days_ago=1)

    ids = queue_ids(app_client, reviewer)

    # Newest-first would put normal_newer on top; oldest-first, normal_older. Only triage says this.
    assert ids.index(critical) < ids.index(normal_older)
    assert ids.index(critical) < ids.index(normal_newer)


def test_priority_order_is_critical_then_urgent_then_normal(app_client, admin_conn):
    reviewer, _ = make_reviewer(app_client, admin_conn)
    # Inserted urgent, normal, critical: newest-first gives critical, normal, urgent and
    # oldest-first gives urgent, normal, critical — both wrong.
    urgent = in_review(app_client, admin_conn, priority="URGENT", submitted_days_ago=1)
    normal = in_review(app_client, admin_conn, priority="NORMAL", submitted_days_ago=2)
    critical = in_review(app_client, admin_conn, priority="CRITICAL", submitted_days_ago=0)

    assert_order(queue_ids(app_client, reviewer), critical, urgent, normal)


def test_among_equals_the_longest_waiting_is_reviewed_first(app_client, admin_conn):
    """Waiting is measured by the review clock, not by when the row was inserted."""
    reviewer, _ = make_reviewer(app_client, admin_conn)
    middle = in_review(app_client, admin_conn, submitted_days_ago=4)
    longest = in_review(app_client, admin_conn, submitted_days_ago=8)
    latest = in_review(app_client, admin_conn, submitted_days_ago=1)

    assert_order(queue_ids(app_client, reviewer), longest, middle, latest)


def test_same_priority_and_due_date_the_sooner_need_goes_first(app_client, admin_conn):
    reviewer, _ = make_reviewer(app_client, admin_conn)
    today = datetime.now(UTC).date()
    # The SAME submission instant, so due dates are identical and only needed_by separates them.
    # (Two calls with submitted_days_ago=3 differ by milliseconds, and the due date is the higher
    # key — an earlier version of this test tripped on exactly that.)
    moment = datetime.now(UTC) - timedelta(days=3)
    needs_middle = in_review(app_client, admin_conn, submitted_at=moment,
                             needed_by=(today + timedelta(days=30)).isoformat())
    needs_soon = in_review(app_client, admin_conn, submitted_at=moment,
                           needed_by=(today + timedelta(days=5)).isoformat())
    needs_later = in_review(app_client, admin_conn, submitted_at=moment,
                            needed_by=(today + timedelta(days=60)).isoformat())

    assert_order(queue_ids(app_client, reviewer), needs_soon, needs_middle, needs_later)


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
    reviewer, reviewer_id = make_reviewer(app_client, admin_conn)
    app_id = in_review(
        app_client, admin_conn, submitted_days_ago=40, status=status, decided_by=reviewer_id
    )

    body = item(app_client, reviewer, app_id)

    assert body.get("review_due_at") is None
    assert body.get("sla_breached") is None


def test_a_draft_owes_no_review(app_client, admin_conn):
    token, _uid = student_with_profile(app_client)
    app_id = create_application(app_client, token)["id"]

    body = item(app_client, token, app_id, as_reviewer=False)

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


# --------------------------------------------------------------------------- the reviewer's read


def test_a_reviewer_can_read_one_application_through_the_admin_endpoint(app_client, admin_conn):
    """A02 used the student endpoint and got 403 for exactly the people who use it."""
    reviewer, _ = make_reviewer(app_client, admin_conn)
    app_id = in_review(app_client, admin_conn)

    student_endpoint = app_client.get(f"{BASE}/applications/{app_id}", headers=bearer(reviewer))
    admin_endpoint = app_client.get(f"{BASE}/admin/applications/{app_id}", headers=bearer(reviewer))

    assert student_endpoint.status_code == 403, "the defect this endpoint exists to fix"
    assert admin_endpoint.status_code == 200, admin_endpoint.text
    assert admin_endpoint.json()["id"] == app_id


def test_a_student_cannot_use_the_admin_read(app_client, admin_conn):
    token, _uid = student_with_profile(app_client)
    app_id = create_application(app_client, token)["id"]

    resp = app_client.get(f"{BASE}/admin/applications/{app_id}", headers=bearer(token))

    assert resp.status_code == 403


def test_the_admin_read_of_an_unknown_application_is_404(app_client, admin_conn):
    reviewer, _ = make_reviewer(app_client, admin_conn)

    resp = app_client.get(f"{BASE}/admin/applications/app_does_not_exist", headers=bearer(reviewer))

    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "application_not_found"


# --------------------------------------------------------------------------- what is in the queue


def test_the_default_queue_holds_everything_that_waits_on_a_person(app_client, admin_conn):
    """UNSCREENED and APPEALED were unreachable from the reviewer's screen (#288)."""
    reviewer, reviewer_id = make_reviewer(app_client, admin_conn)
    waiting = {
        status: in_review(app_client, admin_conn, status=status)
        for status in ("READY_FOR_REVIEW", "UNSCREENED", "UNDER_REVIEW", "INTERVIEW_SCHEDULED",
                       "INTERVIEWED", "APPROVED_PROPOSED", "APPEALED")
    }

    ids = set(queue_ids(app_client, reviewer, status=None))

    missing = [status for status, app_id in waiting.items() if app_id not in ids]
    assert missing == [], f"waiting on a person but not in the queue: {missing}"


def test_the_default_queue_leaves_out_what_does_not_wait_on_a_reviewer(app_client, admin_conn):
    reviewer, reviewer_id = make_reviewer(app_client, admin_conn)
    token, _uid = student_with_profile(app_client)
    draft = create_application(app_client, token)["id"]
    elsewhere = {
        "RETURNED_FOR_INFO": in_review(app_client, admin_conn, status="RETURNED_FOR_INFO"),
        "APPROVED": in_review(app_client, admin_conn, status="APPROVED", decided_by=reviewer_id),
        "REJECTED": in_review(app_client, admin_conn, status="REJECTED", decided_by=reviewer_id),
    }

    ids = set(queue_ids(app_client, reviewer, status=None))

    assert draft not in ids, "a draft nobody has sent is in the review queue"
    leaked = [status for status, app_id in elsewhere.items() if app_id in ids]
    assert leaked == [], f"not waiting on a reviewer, but in the queue: {leaked}"


def test_status_narrows_the_queue_to_one_status(app_client, admin_conn):
    reviewer, _ = make_reviewer(app_client, admin_conn)
    appealed = in_review(app_client, admin_conn, status="APPEALED")
    ready = in_review(app_client, admin_conn, status="READY_FOR_REVIEW")

    ids = queue_ids(app_client, reviewer, status="APPEALED")

    assert appealed in ids and ready not in ids
