"""The student dashboard reads the student's real account — and only theirs (#294).

Each figure is asserted against rows this test created, never against a literal the page could
also have hardcoded. Ownership is asserted with a second student who has activity of their own, so
"sees nothing" can't pass merely because there was nothing to see.
"""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, timedelta

from tests.application.conftest import (
    BASE,
    bearer,
    create_application,
    force_status,
    student_with_profile,
)

ACTIVITY = f"{BASE}/students/me/activity"
OVERVIEW = f"{BASE}/students/me/overview"


def timeline(client, token, *, limit: int = 100) -> list[dict]:
    """The whole timeline, following next_cursor to the end, failing on a stuck cursor."""
    items: list[dict] = []
    cursor, seen = None, set()
    while True:
        params = {"limit": limit, **({"cursor": cursor} if cursor else {})}
        resp = client.get(ACTIVITY, headers=bearer(token), params=params)
        assert resp.status_code == 200, resp.text
        body = resp.json()
        items.extend(body["items"])
        cursor = body["meta"]["next_cursor"]
        if not cursor:
            return items
        assert cursor not in seen, "the activity cursor did not advance"
        seen.add(cursor)


def audit(admin_conn, *, actor: str, action: str, at: datetime | None = None,
          detail: str | None = None) -> None:
    admin_conn.execute(
        "INSERT INTO audit_log (id, actor_user_id, action, resource_type, request_id, detail,"
        " created_at) VALUES (%s, %s, %s, 'user', %s, %s, %s)",
        (f"al_{uuid.uuid4().hex}", actor, action, uuid.uuid4().hex, detail,
         at or datetime.now(UTC)),
    )


# ---------- activity ----------


def test_the_timeline_is_the_students_own_account_newest_first(client, admin_conn):
    token, uid = student_with_profile(client)
    app_id = create_application(client, token)["id"]
    resp = client.post(f"{BASE}/applications/{app_id}/submit", headers=bearer(token))
    assert resp.status_code == 200, resp.text

    items = timeline(client, token)
    events = [(i["category"], i["event"], i["actor"], i.get("to_status")) for i in items]

    assert events.count(("ACCOUNT", "AUTH_REGISTER", "YOU", None)) == 1, "registered once"
    assert ("ACCOUNT", "PROFILE_CREATED", "YOU", None) in events
    assert ("APPLICATION", "APPLICATION_CREATED", "YOU", None) in events
    assert ("APPLICATION", "APPLICATION_STATUS_CHANGED", "YOU", "SUBMITTED") in events
    times = [i["occurred_at"] for i in items]
    assert times == sorted(times, reverse=True)
    # The student's own submission, then what FundsLink's pipeline did with it.
    assert any(i["actor"] == "FUNDSLINK" and i["event"] == "APPLICATION_STATUS_CHANGED"
               for i in items)


def test_a_reviewer_is_fundslink_never_a_named_person(client, admin_conn):
    token, _uid = student_with_profile(client)
    app_id = create_application(client, token)["id"]
    reviewer = f"rev_{uuid.uuid4().hex}"
    admin_conn.execute(
        'INSERT INTO "user"(id, email, password_hash) VALUES (%s, %s, %s)',
        (reviewer, f"{reviewer}@staff.fundslink.io", "x"),
    )
    force_status(admin_conn, app_id, "UNDER_REVIEW", actor=reviewer)

    items = timeline(client, token)
    review = [i for i in items if i.get("to_status") == "UNDER_REVIEW"]
    assert [i["actor"] for i in review] == ["FUNDSLINK"]
    assert reviewer not in str(items)


def test_another_students_activity_never_appears(client, admin_conn):
    token_a, uid_a = student_with_profile(client)
    token_b, uid_b = student_with_profile(client)
    app_b = create_application(client, token_b)["id"]
    force_status(admin_conn, app_b, "RETURNED_FOR_INFO")
    audit(admin_conn, actor=uid_b, action="AUTH_LOGIN_SUCCESS")

    mine = timeline(client, token_a)
    theirs = timeline(client, token_b)

    assert mine and theirs, "both students must have activity, or 'sees nothing' proves nothing"
    assert {i["id"] for i in mine}.isdisjoint({i["id"] for i in theirs})
    assert app_b not in {i.get("resource_id") for i in mine}


def test_notes_detail_and_token_refreshes_are_never_shown(client, admin_conn):
    token, uid = student_with_profile(client)
    app_id = create_application(client, token)["id"]
    # Event and status cache together, in one transaction: an event alone leaves the application's
    # cached status disagreeing with its history, which the DB-D39 integrity job rightly reports.
    with admin_conn.transaction():
        admin_conn.execute(
            "INSERT INTO application_status_event"
            " (id, application_id, to_status, actor_user_id, note)"
            " VALUES (%s, %s, 'RETURNED_FOR_INFO', 'SYSTEM', 'INTERNAL: reviewer suspects fraud')",
            (f"ev_{uuid.uuid4().hex}", app_id),
        )
        admin_conn.execute(
            "UPDATE funding_application SET status = 'RETURNED_FOR_INFO' WHERE id = %s", (app_id,)
        )
    audit(admin_conn, actor=uid, action="AUTH_TOKEN_REFRESH")
    audit(admin_conn, actor=uid, action="DATA_EXPORTED", detail='{"email": "leak@example.com"}')

    resp = client.get(ACTIVITY, headers=bearer(token), params={"limit": 100})
    assert resp.status_code == 200
    raw = resp.text
    assert "INTERNAL" not in raw and "leak@example.com" not in raw
    events = [i["event"] for i in resp.json()["items"]]
    assert "AUTH_TOKEN_REFRESH" not in events
    assert "DATA_EXPORTED" in events
    assert all(set(i) <= {"id", "occurred_at", "category", "event", "actor", "resource_id",
                          "to_status", "label"} for i in resp.json()["items"])


def test_paging_returns_every_item_exactly_once(client, admin_conn):
    token, uid = student_with_profile(client)
    base = datetime.now(UTC) - timedelta(days=1)
    for minute in range(7):
        audit(admin_conn, actor=uid, action="AUTH_LOGIN_SUCCESS",
              at=base + timedelta(minutes=minute))

    whole = [i["id"] for i in timeline(client, token, limit=100)]
    paged = [i["id"] for i in timeline(client, token, limit=2)]
    assert paged == whole
    assert len(set(paged)) == len(paged)


def test_a_category_is_filtered_in_the_query_and_pages_fully(client, admin_conn):
    token, uid = student_with_profile(client)
    app_id = create_application(client, token)["id"]
    force_status(admin_conn, app_id, "RETURNED_FOR_INFO")
    base = datetime.now(UTC) - timedelta(days=2)
    for minute in range(5):
        audit(admin_conn, actor=uid, action="AUTH_LOGIN_SUCCESS",
              at=base + timedelta(minutes=minute))

    def only(category: str, limit: int) -> list[dict]:
        items, cursor = [], None
        while True:
            params = {"category": category, "limit": limit,
                      **({"cursor": cursor} if cursor else {})}
            body = client.get(ACTIVITY, headers=bearer(token), params=params).json()
            assert len(body["items"]) == limit or not body["meta"]["next_cursor"], "short page"
            items += body["items"]
            cursor = body["meta"]["next_cursor"]
            if not cursor:
                return items

    security = only("SECURITY", 2)
    assert len(security) == 5
    assert {i["category"] for i in security} == {"SECURITY"}
    application = only("APPLICATION", 50)
    assert {i["category"] for i in application} == {"APPLICATION"}
    assert "RETURNED_FOR_INFO" in {i.get("to_status") for i in application}
    assert only("TRACKING", 50) == []
    bad = client.get(ACTIVITY, headers=bearer(token), params={"category": "EVERYTHING"})
    assert bad.status_code == 422


# ---------- overview ----------


def overview(client, token) -> dict:
    resp = client.get(OVERVIEW, headers=bearer(token))
    assert resp.status_code == 200, resp.text
    return resp.json()


def test_application_figures_follow_the_real_lifecycle(client, admin_conn):
    token, _uid = student_with_profile(client)
    first = overview(client, token)["applications"]
    assert first == {"total": 0, "drafts": 0, "needs_your_action": 0, "with_fundslink": 0,
                     "decided": 0, "by_status": []}

    app_id = create_application(client, token)["id"]
    assert overview(client, token)["applications"]["drafts"] == 1

    force_status(admin_conn, app_id, "RETURNED_FOR_INFO")
    figures = overview(client, token)["applications"]
    assert (figures["drafts"], figures["needs_your_action"]) == (0, 1)
    assert figures["by_status"] == [{"status": "RETURNED_FOR_INFO", "count": 1}]

    force_status(admin_conn, app_id, "UNDER_REVIEW")
    assert overview(client, token)["applications"]["with_fundslink"] == 1

    force_status(admin_conn, app_id, "APPROVED_WAITLISTED")
    figures = overview(client, token)["applications"]
    assert (figures["with_fundslink"], figures["decided"], figures["total"]) == (0, 1, 1)


def test_tracking_figures_and_the_next_real_deadline(client, admin_conn):
    token, uid = student_with_profile(client)
    soon, later = date.today() + timedelta(days=4), date.today() + timedelta(days=40)
    trackers = []
    for name, due, status in (("Later Bursary", later, "SUBMITTED"),
                              ("Soon Bursary", soon, "REGISTERED"),
                              ("Closed Bursary", date.today() + timedelta(days=1), "REJECTED")):
        bid, tid = f"eb_{uuid.uuid4().hex}", f"ta_{uuid.uuid4().hex}"
        admin_conn.execute(
            "INSERT INTO external_bursary(id, name, provider, level_eligibility, status)"
            " VALUES (%s, %s, 'Provider', %s, 'OPEN')", (bid, name, ["UG"]),
        )
        admin_conn.execute(
            "INSERT INTO bursary_deadline(id, external_bursary_id, deadline_type, due_on)"
            " VALUES (%s, %s, 'APPLICATION', %s)", (f"bd_{uuid.uuid4().hex}", bid, due),
        )
        admin_conn.execute(
            "INSERT INTO tracked_application(id, student_profile_id, external_bursary_id, status)"
            " VALUES (%s, %s, %s, %s)", (tid, uid, bid, status),
        )
        trackers.append(tid)

    tracking = overview(client, token)["tracking"]
    assert (tracking["total"], tracking["active"]) == (3, 2)
    # The closed tracker's deadline is sooner, but the student is no longer pursuing it.
    assert tracking["next_deadline"] == {
        "tracked_application_id": trackers[1],
        "bursary_name": "Soon Bursary",
        "due_on": soon.isoformat(),
        "deadline_type": "APPLICATION",
    }


def test_previous_sign_in_is_the_one_before_the_latest(client, admin_conn):
    token, uid = student_with_profile(client)
    assert overview(client, token)["account"]["previous_sign_in_at"] is None

    earlier = datetime(2026, 1, 5, 8, 30, tzinfo=UTC)
    audit(admin_conn, actor=uid, action="AUTH_LOGIN_SUCCESS", at=earlier)
    audit(admin_conn, actor=uid, action="AUTH_LOGIN_SUCCESS")

    account = overview(client, token)["account"]
    assert datetime.fromisoformat(account["previous_sign_in_at"]) == earlier
    assert account["mfa_enabled"] is False


def test_a_student_sees_only_their_own_figures(client, admin_conn):
    token_a, _ = student_with_profile(client)
    token_b, _ = student_with_profile(client)

    create_application(client, token_b)
    assert overview(client, token_b)["applications"]["total"] == 1
    assert overview(client, token_a)["applications"]["total"] == 0
