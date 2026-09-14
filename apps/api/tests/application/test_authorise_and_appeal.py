"""The two-person funding decision, and the appeal ruling — MASTER-SPEC §16.4 · BR-S05 · BR-E07.

Before this, a reviewer could take an application as far as APPROVED_PROPOSED and no further:
APPROVED was in the transition table, APPLICATION_AUTHORIZE was seeded and granted, and no code
path reached either. **No student could be funded through the product.** An appeal was in the same
state — `appeal.reviewed_by` and `appeal.outcome` were written by nothing, so BR-E07 ("the appeal
reviewer must not be the original decider") was a CHECK constraint on columns nobody set.

These tests drive the real endpoints against the real database and assert the whole path end to
end, including the refusals: the proposer may not authorise their own proposal, and the decider
may not hear the appeal against their own decision.
"""

from __future__ import annotations

import uuid

from app.modules.auth.jwt import create_access_token
from tests.application.conftest import (
    BASE,
    bearer,
    create_application,
    force_status,
    make_authorizer,
    make_reviewer,
    student_with_profile,
)
from tests.application.test_review_queue_triage import queue_ids

REASON = "Funded in full for 2026 from the missing-middle pool; fees paid directly."
REFUSAL = "The household income is above the 2026 threshold, so we cannot fund this year."


def ready_application(client, admin_conn) -> tuple[str, str]:
    token, _uid = student_with_profile(client)
    app_id = create_application(client, token)["id"]
    force_status(admin_conn, app_id, "READY_FOR_REVIEW")
    return app_id, token


def review(client, token, app_id, decision, note=None):
    return client.post(
        f"{BASE}/admin/applications/{app_id}/review",
        headers=bearer(token),
        json={"decision": decision, **({"note": note} if note else {})},
    )


def authorize(client, token, app_id, decision, reason=REASON):
    return client.post(
        f"{BASE}/admin/applications/{app_id}/authorize",
        headers=bearer(token),
        json={"decision": decision, "reason": reason},
    )


def propose(client, admin_conn, app_id):
    """Take a ready application to APPROVED_PROPOSED through the real review endpoint."""
    token, reviewer = make_reviewer(client, admin_conn)
    assert review(client, token, app_id, "UNDER_REVIEW").status_code == 200
    resp = review(client, token, app_id, "APPROVED_PROPOSED", note="Strong case, verified.")
    assert resp.status_code == 200, resp.text
    return token, reviewer


def status_of(admin_conn, app_id: str) -> str:
    return admin_conn.execute(
        "SELECT status FROM funding_application WHERE id = %s", (app_id,)
    ).fetchone()[0]


# --------------------------------- authorising ---------------------------------


def test_a_student_can_actually_be_funded(app_client, admin_conn):
    """The whole point: proposal by one person, authorisation by another, money decided."""
    app_id, student_token = ready_application(app_client, admin_conn)
    _reviewer_token, reviewer = propose(app_client, admin_conn, app_id)
    assert status_of(admin_conn, app_id) == "APPROVED_PROPOSED"

    auth_token, authorizer = make_authorizer(app_client, admin_conn)
    resp = authorize(app_client, auth_token, app_id, "APPROVED")
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "APPROVED"
    assert status_of(admin_conn, app_id) == "APPROVED"
    assert authorizer != reviewer

    # The approval is attributed to the human who authorised it (Human-Final, BR-E03), and the
    # reason is on the append-only event — the student is owed the words, not just a status.
    actor, note = admin_conn.execute(
        "SELECT actor_user_id, note FROM application_status_event"
        " WHERE application_id = %s AND to_status = 'APPROVED'",
        (app_id,),
    ).fetchone()
    assert (actor, note) == (authorizer, REASON)

    # And the student is told, in their own words, on their own screen.
    mine = app_client.get(f"{BASE}/applications/{app_id}", headers=bearer(student_token)).json()
    assert mine["status"] == "APPROVED"
    assert mine["decision_reason"] == REASON
    assert mine["decided_at"] is not None

    triggers = {
        row[0]
        for row in admin_conn.execute(
            "SELECT trigger FROM notification_outbox WHERE payload->>'application_id' = %s",
            (app_id,),
        ).fetchall()
    }
    assert "DECISION_APPROVED" in triggers
    detail = admin_conn.execute(
        "SELECT detail FROM audit_log WHERE action = 'APPLICATION_AUTHORIZED'"
        " AND resource_id = %s",
        (app_id,),
    ).fetchone()[0]
    assert detail == {"decision": "APPROVED", "proposed_by": reviewer}


def test_the_proposer_may_not_authorise_their_own_proposal(app_client, admin_conn):
    """MASTER-SPEC §16.4. The realistic way this happens is a promotion, not an attack: the
    person who proposed the decision later holds ADMIN_AUTHORIZER as well."""
    app_id, _student = ready_application(app_client, admin_conn)
    _reviewer_token, reviewer = propose(app_client, admin_conn, app_id)

    # Same human, now also an authorizer.
    admin_conn.execute(
        "INSERT INTO user_role (id, user_id, role_id)"
        " SELECT %s, %s, r.id FROM role r WHERE r.code = 'ADMIN_AUTHORIZER'"
        " ON CONFLICT DO NOTHING",
        (f"ur_{uuid.uuid4().hex}", reviewer),
    )
    promoted, _jti = create_access_token(
        sub=reviewer, role="ADMIN_AUTHORIZER", email="promoted@fundslink.io", version=1
    )

    refused = authorize(app_client, promoted, app_id, "APPROVED")
    assert refused.status_code == 403
    assert refused.json()["error"]["code"] == "two_person_rule"
    assert status_of(admin_conn, app_id) == "APPROVED_PROPOSED"

    # Negative control: a second, different authorizer is admitted on the same application, so
    # the refusal is about who proposed it and not about the endpoint being broken.
    other_token, _other = make_authorizer(app_client, admin_conn)
    assert authorize(app_client, other_token, app_id, "APPROVED").status_code == 200


def test_the_two_jobs_cannot_do_each_other(app_client, admin_conn):
    """A reviewer proposes and an authorizer rules; neither holds the other's power (TAD §3.4)."""
    app_id, student_token = ready_application(app_client, admin_conn)
    reviewer_token, _ = make_reviewer(app_client, admin_conn)
    auth_token, _ = make_authorizer(app_client, admin_conn)

    assert authorize(app_client, reviewer_token, app_id, "APPROVED").status_code == 403
    assert review(app_client, auth_token, app_id, "UNDER_REVIEW").status_code == 403
    # A student holds neither.
    assert authorize(app_client, student_token, app_id, "APPROVED").status_code == 403
    assert status_of(admin_conn, app_id) == "READY_FOR_REVIEW"


def test_an_authorizer_can_open_what_they_have_to_rule_on(app_client, admin_conn):
    """The reads were gated on APPLICATION_REVIEW, which an authorizer does not hold — so the
    queue and the application were closed to exactly the person who had to act on them."""
    app_id, _student = ready_application(app_client, admin_conn)
    propose(app_client, admin_conn, app_id)
    auth_token, _ = make_authorizer(app_client, admin_conn)

    detail = app_client.get(f"{BASE}/admin/applications/{app_id}", headers=bearer(auth_token))
    assert detail.status_code == 200, detail.text
    assert detail.json()["status"] == "APPROVED_PROPOSED"
    assert detail.json()["can_authorize"] is True
    assert app_id in queue_ids(app_client, auth_token, status="APPROVED_PROPOSED")

    # The screen knows which half of the decision this person does — a reviewer is not shown a
    # control they cannot use, and a student is never told the flag exists.
    reviewer_token, _ = make_reviewer(app_client, admin_conn)
    reviewer_read = app_client.get(
        f"{BASE}/admin/applications/{app_id}", headers=bearer(reviewer_token)
    )
    assert reviewer_read.json()["can_authorize"] is False


def test_an_authorizer_with_a_conflict_steps_aside_and_is_refused(app_client, admin_conn):
    """BR-E09 applies to both jobs — a recusal is a conflict of interest, not a reviewer feature."""
    app_id, _student = ready_application(app_client, admin_conn)
    propose(app_client, admin_conn, app_id)
    auth_token, _ = make_authorizer(app_client, admin_conn)

    recusal = app_client.post(
        f"{BASE}/admin/applications/{app_id}/recusal",
        headers=bearer(auth_token),
        json={"reason": "The applicant is my neighbour's son and I know the family."},
    )
    assert recusal.status_code == 201, recusal.text

    refused = authorize(app_client, auth_token, app_id, "APPROVED")
    assert refused.status_code == 403
    assert refused.json()["error"]["code"] == "reviewer_recused"
    assert status_of(admin_conn, app_id) == "APPROVED_PROPOSED"


def test_a_waitlisted_student_is_released_by_the_same_door(app_client, admin_conn):
    """APPROVED_WAITLISTED is a yes with no money behind it yet; when funding appears the same
    endpoint moves it to APPROVED — still a second person, still a recorded reason."""
    app_id, _student = ready_application(app_client, admin_conn)
    propose(app_client, admin_conn, app_id)
    auth_token, _ = make_authorizer(app_client, admin_conn)

    waitlisted = authorize(
        app_client,
        auth_token,
        app_id,
        "APPROVED_WAITLISTED",
        reason="Approved on merit; waiting on the next donor disbursement.",
    )
    assert waitlisted.status_code == 200, waitlisted.text
    assert waitlisted.json()["status"] == "APPROVED_WAITLISTED"
    assert waitlisted.json()["waitlist_position"] is not None

    released = authorize(app_client, auth_token, app_id, "APPROVED")
    assert released.status_code == 200, released.text
    assert status_of(admin_conn, app_id) == "APPROVED"


def test_authorising_needs_a_reason_and_a_legal_transition(app_client, admin_conn):
    app_id, _student = ready_application(app_client, admin_conn)
    auth_token, _ = make_authorizer(app_client, admin_conn)

    # Nothing has been proposed yet: READY_FOR_REVIEW → APPROVED is not a transition (BR-S04).
    early = authorize(app_client, auth_token, app_id, "APPROVED")
    assert early.status_code == 409
    assert early.json()["error"]["code"] == "invalid_transition"

    propose(app_client, admin_conn, app_id)
    assert authorize(app_client, auth_token, app_id, "APPROVED", reason="ok").status_code == 422
    assert authorize(app_client, auth_token, app_id, "APPROVED_PROPOSED").status_code == 422
    assert status_of(admin_conn, app_id) == "APPROVED_PROPOSED"

    missing = app_client.post(
        f"{BASE}/admin/applications/app_does_not_exist/authorize",
        headers=bearer(auth_token),
        json={"decision": "APPROVED", "reason": REASON},
    )
    assert missing.status_code == 404


# ----------------------------------- appeals -----------------------------------


def rejected_and_appealed(client, admin_conn) -> tuple[str, str, str]:
    """(application, student token, the reviewer who rejected it) — a real appeal, end to end."""
    app_id, student_token = ready_application(client, admin_conn)
    reviewer_token, decider = make_reviewer(client, admin_conn)
    assert review(client, reviewer_token, app_id, "UNDER_REVIEW").status_code == 200
    assert review(client, reviewer_token, app_id, "REJECTED", note=REFUSAL).status_code == 200

    appeal = client.post(
        f"{BASE}/applications/{app_id}/appeal",
        headers=bearer(student_token),
        json={"new_information": "My mother lost her job in March; here is the UIF letter."},
    )
    assert appeal.status_code == 201, appeal.text
    return app_id, student_token, reviewer_token


def appeal_row(admin_conn, app_id: str):
    return admin_conn.execute(
        "SELECT reviewed_by, outcome, original_decider_id FROM appeal WHERE application_id = %s",
        (app_id,),
    ).fetchone()


def test_the_decider_may_not_hear_the_appeal_against_their_own_decision(app_client, admin_conn):
    """BR-E07 — stated in a CHECK constraint on columns nothing wrote, until now."""
    app_id, _student, decider_token = rejected_and_appealed(app_client, admin_conn)

    refused = review(app_client, decider_token, app_id, "REJECTED_FINAL", note="Nothing new here.")
    assert refused.status_code == 403
    assert refused.json()["error"]["code"] == "appeal_reviewer_conflict"
    assert status_of(admin_conn, app_id) == "APPEALED"
    assert appeal_row(admin_conn, app_id)[:2] == (None, None)

    # Negative control: a different reviewer is admitted on the same appeal.
    other_token, _other = make_reviewer(app_client, admin_conn)
    assert review(app_client, other_token, app_id, "REJECTED_FINAL").status_code == 200


def test_upholding_an_appeal_ends_it_and_is_recorded(app_client, admin_conn):
    app_id, student_token, decider_token = rejected_and_appealed(app_client, admin_conn)
    other_token, other = make_reviewer(app_client, admin_conn)

    resp = review(
        app_client, other_token, app_id, "REJECTED_FINAL", note="The UIF letter does not change it."
    )
    assert resp.status_code == 200, resp.text
    assert status_of(admin_conn, app_id) == "REJECTED_FINAL"

    reviewed_by, outcome, original = appeal_row(admin_conn, app_id)
    assert (reviewed_by, outcome) == (other, "UPHELD")
    assert original != other  # the constraint's whole point

    mine = app_client.get(f"{BASE}/applications/{app_id}", headers=bearer(student_token)).json()
    assert mine["status"] == "REJECTED_FINAL"
    assert mine["decision_reason"] == "The UIF letter does not change it."
    # And it really is final: the original decider cannot reopen it either.
    assert review(app_client, decider_token, app_id, "UNDER_REVIEW").status_code == 409


def test_overturning_an_appeal_proposes_it_again_rather_than_approving_it(app_client, admin_conn):
    """An appeal cannot fund anyone by itself: overturning sends it back as a proposal, so the
    second person still has to authorise it (§16.4)."""
    app_id, _student, _decider = rejected_and_appealed(app_client, admin_conn)
    other_token, other = make_reviewer(app_client, admin_conn)

    resp = review(app_client, other_token, app_id, "APPROVED_PROPOSED", note="The UIF letter is new.")
    assert resp.status_code == 200, resp.text
    assert status_of(admin_conn, app_id) == "APPROVED_PROPOSED"
    assert appeal_row(admin_conn, app_id)[:2] == (other, "OVERTURNED")

    auth_token, _authorizer = make_authorizer(app_client, admin_conn)
    assert authorize(app_client, auth_token, app_id, "APPROVED").status_code == 200
    assert status_of(admin_conn, app_id) == "APPROVED"


def test_rejected_final_is_reachable_only_from_an_appeal(app_client, admin_conn):
    """It is the appeal's ending, not a shortcut past the ordinary rejection a student may appeal."""
    app_id, _student = ready_application(app_client, admin_conn)
    token, _reviewer = make_reviewer(app_client, admin_conn)
    assert review(app_client, token, app_id, "UNDER_REVIEW").status_code == 200

    straight_to_final = review(app_client, token, app_id, "REJECTED_FINAL")
    assert straight_to_final.status_code == 409
    assert straight_to_final.json()["error"]["code"] == "invalid_transition"
    assert status_of(admin_conn, app_id) == "UNDER_REVIEW"


def test_an_ordinary_review_is_untouched_by_the_appeal_rule(app_client, admin_conn):
    """The BR-E07 check reads an appeal record that does not exist on a first-time review — the
    ordinary path must not have acquired a new way to fail."""
    app_id, _student = ready_application(app_client, admin_conn)
    token, _reviewer = make_reviewer(app_client, admin_conn)
    assert review(app_client, token, app_id, "UNDER_REVIEW").status_code == 200
    assert review(app_client, token, app_id, "APPROVED_PROPOSED").status_code == 200
    assert appeal_row(admin_conn, app_id) is None
