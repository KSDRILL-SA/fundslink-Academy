"""The decision reaches the student — reason, time, and waitlist position (#220).

The gap this closes: `adminReview` took the reviewer's `note`, the state machine wrote it onto
the status event, and **nothing ever read it back**. A student opening their decision saw a
status and no reason, which makes S16-REJ's locked structure — *"the human-written reason,
never auto-generated"* (ux-screen-map.md §3, MASTER-SPEC §5.8) — impossible to render. The
screen exists to deliver a person's words; without them it is a bare status change, the exact
experience the design was written to prevent.

These tests are the guarantee that the channel stays open. They assert the words a reviewer
typed come back to the person they were written for, and to nobody else.
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

APPS = f"{BASE}/applications"
ADMIN = f"{BASE}/admin/applications"

# What a real reviewer writes: A03 enforces ≥40 words and a concrete next step.
REASON = (
    "Thank you for applying, and for explaining your situation so clearly. We read your "
    "application in full. We fund postgraduate students who already hold a place and face a "
    "shortfall on fees, and yours meets that description — but the funds committed for this "
    "intake were fully allocated before we reached it. That is a limit on us, not a judgement "
    "of you. Please apply to the three bursaries matched on your dashboard, and you may appeal "
    "once if there is something we did not know."
)


def _under_review(app_client, admin_conn) -> tuple[str, str, str]:
    """A student's application sitting with a reviewer. Returns (student, reviewer, app_id)."""
    token, _ = student_with_profile(app_client)
    app = create_application(app_client, token)
    app_client.post(f"{APPS}/{app['id']}/submit", headers=bearer(token))
    force_status(admin_conn, app["id"], "PRE_SCREENING")
    force_status(admin_conn, app["id"], "READY_FOR_REVIEW")
    rev_token, _ = make_reviewer(app_client, admin_conn)
    app_client.post(
        f"{ADMIN}/{app['id']}/review", headers=bearer(rev_token), json={"decision": "UNDER_REVIEW"}
    )
    return token, rev_token, app["id"]


def test_the_students_decision_carries_the_reviewers_own_words(app_client, admin_conn):
    """The blocker, closed: a decline is readable by the person it is about."""
    token, rev_token, app_id = _under_review(app_client, admin_conn)

    recorded = app_client.post(
        f"{ADMIN}/{app_id}/review",
        headers=bearer(rev_token),
        json={"decision": "REJECTED", "note": REASON},
    )
    assert recorded.status_code == 200

    seen = app_client.get(f"{APPS}/{app_id}", headers=bearer(token))
    assert seen.status_code == 200
    body = seen.json()

    assert body["status"] == "REJECTED"
    # Verbatim. Not a summary, not a template, not a truncation.
    assert body["decision_reason"] == REASON
    assert body["decided_at"] is not None
    # Nothing to show on the waitlist unless the student is on it.
    assert body.get("waitlist_position") is None


def test_an_undecided_application_carries_no_reason(app_client, admin_conn):
    """A triage note is not a decision, and must never surface as one.

    `UNDER_REVIEW` accepts a note too — an internal remark between reviewers. Leaking it to the
    student as their 'reason' would be worse than showing nothing.
    """
    token, rev_token, app_id = _under_review(app_client, admin_conn)
    app_client.post(
        f"{ADMIN}/{app_id}/review",
        headers=bearer(rev_token),
        json={"decision": "UNDER_REVIEW", "note": "Second opinion needed on the income band."},
    )

    body = app_client.get(f"{APPS}/{app_id}", headers=bearer(token)).json()
    assert body["decision_reason"] is None
    assert body["decided_at"] is None


def test_a_waitlisted_student_is_told_where_they_stand_e4(app_client, admin_conn):
    """S16-WAIT's promise: a live position, counted across applications the student cannot see.

    The count runs through `fn_waitlist_position` (migration 0019), because under the student's
    own RLS context every query would return 1 — a comfortable lie on the one screen whose
    whole purpose is telling the truth.
    """
    def waitlist(token: str, app_id: str) -> int:
        app_client.post(
            f"{ADMIN}/{app_id}/review",
            headers=bearer(rev_token),
            json={"decision": "APPROVED_PROPOSED", "note": "Strong case, awaiting funds."},
        )
        force_status(admin_conn, app_id, "APPROVED_WAITLISTED")
        body = app_client.get(f"{APPS}/{app_id}", headers=bearer(token)).json()
        assert body["status"] == "APPROVED_WAITLISTED"
        return body["waitlist_position"]

    first_token, rev_token, first_id = _under_review(app_client, admin_conn)
    first_position = waitlist(first_token, first_id)

    # Asserted as an invariant, not as an absolute number: this database is
    # shared across the suite and may already hold waitlisted applications, and
    # a test that demands "I am #1" would only pass on an empty queue. The real
    # promise is the ORDER — you are behind whoever was waitlisted before you,
    # and nobody joining later moves you.
    assert first_position >= 1

    second_token, _rev, second_id = _under_review(app_client, admin_conn)
    second_position = waitlist(second_token, second_id)

    assert second_position == first_position + 1
    # Someone joining behind you does not move you.
    assert (
        app_client.get(f"{APPS}/{first_id}", headers=bearer(first_token)).json()[
            "waitlist_position"
        ]
        == first_position
    )


def test_a_reason_is_not_readable_by_another_student(app_client, admin_conn):
    """The reason is personal. RLS already owns this; it is asserted because it now travels."""
    _owner, rev_token, app_id = _under_review(app_client, admin_conn)
    app_client.post(
        f"{ADMIN}/{app_id}/review",
        headers=bearer(rev_token),
        json={"decision": "REJECTED", "note": REASON},
    )

    intruder, _ = student_with_profile(app_client)
    assert app_client.get(f"{APPS}/{app_id}", headers=bearer(intruder)).status_code == 404
