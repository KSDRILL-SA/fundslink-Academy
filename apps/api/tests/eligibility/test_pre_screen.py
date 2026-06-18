"""Pre-screening engine through the full stack — BR-E01/E02/E04 + UNSCREENED degradation (§5.7).

Submit runs pre-screening in the same transaction, advancing the application to
READY_FOR_REVIEW / RETURNED_FOR_INFO / UNSCREENED. Behaviour-named tests (S7.5).
"""

from __future__ import annotations

from tests.eligibility.conftest import (
    BASE,
    bearer,
    create_app,
    student_with_profile,
    submit,
    upload_doc,
)


def test_submit_with_required_document_is_ready_for_review_br_e01(elig_client):
    token, _ = student_with_profile(elig_client)
    upload_doc(elig_client, token, "NSFAS_OUTCOME")  # the UG_CAT_C requirement
    app = create_app(elig_client, token)
    resp = submit(elig_client, token, app["id"])
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "READY_FOR_REVIEW"
    assert body["pre_screen"]["outcome"] == "READY"  # a pre-screen report was produced (BR-E01)


def test_submit_missing_document_is_returned_with_fix_list(elig_client):
    token, _ = student_with_profile(elig_client)
    app = create_app(elig_client, token)  # no NSFAS_OUTCOME uploaded
    body = submit(elig_client, token, app["id"]).json()
    assert body["status"] == "RETURNED_FOR_INFO"
    assert body["pre_screen"]["outcome"] == "RETURNED"
    assert body["pre_screen"]["fix_list"]  # itemized, non-empty — a return, never a rejection
    assert body["pre_screen"]["cycle_no"] == 1


def test_expired_required_document_is_returned_not_rejected_d005(elig_client, admin_conn):
    """D-005 / BR-E10: a document that lapsed while waiting → RETURN with a kind 'expired' fix."""
    token, uid = student_with_profile(elig_client)
    upload_doc(elig_client, token, "NSFAS_OUTCOME")
    admin_conn.execute(
        "UPDATE document SET valid_until = current_date - 1"
        " WHERE student_profile_id = %s AND doc_type = 'NSFAS_OUTCOME'",
        (uid,),
    )
    app = create_app(elig_client, token)
    body = submit(elig_client, token, app["id"]).json()
    assert body["status"] == "RETURNED_FOR_INFO"  # a return, never a rejection
    assert any("expired" in line for line in body["pre_screen"]["fix_list"])


def test_resubmit_after_supplying_the_document_becomes_ready(elig_client):
    token, _ = student_with_profile(elig_client)
    app = create_app(elig_client, token)
    assert submit(elig_client, token, app["id"]).json()["status"] == "RETURNED_FOR_INFO"
    upload_doc(elig_client, token, "NSFAS_OUTCOME")  # student fixes the gap
    resp = elig_client.post(f"{BASE}/applications/{app['id']}/resubmit", headers=bearer(token))
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "READY_FOR_REVIEW"


def test_resubmit_reuses_the_ruleset_pinned_at_submission_br_e02(elig_client, admin_conn):
    token, _ = student_with_profile(elig_client)
    app = create_app(elig_client, token)
    submit(elig_client, token, app["id"])
    elig_client.post(f"{BASE}/applications/{app['id']}/resubmit", headers=bearer(token))
    rulesets = admin_conn.execute(
        "SELECT DISTINCT ruleset_id FROM pre_screen_result WHERE application_id = %s",
        (app["id"],),
    ).fetchall()
    assert len(rulesets) == 1  # the version is pinned at submission, not re-selected per cycle


def test_three_return_cycles_flag_human_outreach_br_e04(elig_client, admin_conn):
    token, _ = student_with_profile(elig_client)
    app = create_app(elig_client, token)
    submit(elig_client, token, app["id"])  # cycle 1 RETURNED
    for _ in range(2):  # two resubmits with the gap unresolved → cycles 2 and 3
        elig_client.post(f"{BASE}/applications/{app['id']}/resubmit", headers=bearer(token))
    flagged = admin_conn.execute(
        "SELECT 1 FROM audit_log WHERE resource_id = %s"
        " AND action = 'APPLICATION_OUTREACH_FLAGGED'",
        (app["id"],),
    ).fetchone()
    assert flagged is not None  # after 3 cycles, a human reaches out (BR-E04)


def test_other_application_with_motivation_is_ready(elig_client):
    token, _ = student_with_profile(elig_client)
    app = create_app(
        elig_client,
        token,
        application_type="OTHER",
        motivation={
            "situation": "Funding stopped after a parent lost work.",
            "why_not_categories": "My case does not fit the listed categories.",
            "support_needed": "Help with the outstanding tuition balance.",
        },
    )
    body = submit(elig_client, token, app["id"]).json()
    assert body["status"] == "READY_FOR_REVIEW"  # completeness only → senior human queue (§5.6)


def test_engine_degrades_to_unscreened_when_no_ruleset(elig_client, monkeypatch):
    async def _no_ruleset(self, application_type):  # noqa: ANN001
        return None

    monkeypatch.setattr(
        "app.modules.eligibility.repository.RulesetRepository.effective", _no_ruleset
    )
    token, _ = student_with_profile(elig_client)
    app = create_app(elig_client, token)
    body = submit(elig_client, token, app["id"]).json()
    assert body["status"] == "UNSCREENED"  # never blocked — straight to the human queue (§5.7)


def test_cannot_resubmit_an_application_that_was_not_returned(elig_client):
    token, _ = student_with_profile(elig_client)
    upload_doc(elig_client, token, "NSFAS_OUTCOME")
    app = create_app(elig_client, token)
    submit(elig_client, token, app["id"])  # → READY_FOR_REVIEW
    resp = elig_client.post(f"{BASE}/applications/{app['id']}/resubmit", headers=bearer(token))
    assert resp.status_code == 409  # READY_FOR_REVIEW → RESUBMITTED is illegal


def test_cannot_resubmit_another_users_application_st_2_3(elig_client):
    a_token, _ = student_with_profile(elig_client)
    b_token, _ = student_with_profile(elig_client)
    app = create_app(elig_client, a_token)
    submit(elig_client, a_token, app["id"])
    resp = elig_client.post(f"{BASE}/applications/{app['id']}/resubmit", headers=bearer(b_token))
    assert resp.status_code == 404
