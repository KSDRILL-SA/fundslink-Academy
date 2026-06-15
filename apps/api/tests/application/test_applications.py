"""Application lifecycle + rules — BR-S02/S04, BR-E05/E06, BR-N01, money (S5.28), ownership.

Behaviour-named tests (S7.5). Runs against the real DB through the full stack (RLS enforced).
"""

from __future__ import annotations

from tests.application.conftest import (
    BASE,
    bearer,
    create_application,
    register_student,
    student_with_profile,
)

APPS = f"{BASE}/applications"


def test_create_draft_application(app_client):
    token, _ = student_with_profile(app_client)
    body = create_application(app_client, token)
    assert body["status"] == "DRAFT"
    assert body["currency"] == "ZAR"
    assert body["application_type"] == "UG_CAT_C"


def test_create_requires_a_profile_first(app_client):
    token, _ = register_student(app_client)  # no profile
    resp = app_client.post(
        APPS, headers=bearer(token), json={"application_type": "UG_CAT_C", "academic_year": "2026"}
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "profile_required"


def test_other_application_requires_motivation_br_e05(app_client):
    token, _ = student_with_profile(app_client)
    missing = app_client.post(
        APPS, headers=bearer(token), json={"application_type": "OTHER", "academic_year": "2026"}
    )
    assert missing.status_code == 422  # validator: OTHER needs a structured motivation
    ok = app_client.post(
        APPS,
        headers=bearer(token),
        json={
            "application_type": "OTHER",
            "academic_year": "2026",
            "motivation": {
                "situation": "Lost funding mid-year after a family bereavement.",
                "why_not_categories": "My situation does not fit NSFAS categories.",
                "support_needed": "Tuition shortfall for the final semester.",
                "language": "zu",
            },
        },
    )
    assert ok.status_code == 201
    assert ok.json()["motivation"]["language"] == "zu"


def test_duplicate_active_application_rejected_br_e06(app_client):
    token, _ = student_with_profile(app_client)
    create_application(app_client, token, academic_year="2026")
    dup = app_client.post(
        APPS, headers=bearer(token), json={"application_type": "UG_CAT_A", "academic_year": "2026"}
    )
    assert dup.status_code == 409
    assert dup.json()["error"]["code"] == "APPLICATION_ALREADY_ACTIVE"
    # A different academic year is NOT a duplicate.
    other_year = app_client.post(
        APPS, headers=bearer(token), json={"application_type": "UG_CAT_A", "academic_year": "2027"}
    )
    assert other_year.status_code == 201


def test_requested_amount_is_decimal_not_float_s5_28(app_client):
    token, _ = student_with_profile(app_client)
    body = create_application(app_client, token, requested_amount="1500.50")
    # Round-trips as an exact decimal string — never a binary float (e.g. 1500.4999…).
    assert body["requested_amount"] == "1500.50"


def test_requested_amount_must_be_positive(app_client):
    token, _ = student_with_profile(app_client)
    resp = app_client.post(
        APPS,
        headers=bearer(token),
        json={"application_type": "UG_CAT_C", "academic_year": "2026", "requested_amount": "-5"},
    )
    assert resp.status_code == 422


def test_submit_advances_through_the_state_machine_br_s04(app_client):
    token, _ = student_with_profile(app_client)
    app = create_application(app_client, token)  # UG_CAT_C, no documents uploaded
    resp = app_client.post(f"{APPS}/{app['id']}/submit", headers=bearer(token))
    assert resp.status_code == 200
    # Submit applies DRAFT→SUBMITTED then runs pre-screening (module 3) in the same transaction;
    # with no NSFAS outcome on file a UG_CAT_C lands at RETURNED_FOR_INFO — a fix-list, never a no.
    assert resp.json()["status"] == "RETURNED_FOR_INFO"


def test_submit_enqueues_outbox_in_same_transaction_br_n01(app_client, admin_conn):
    token, uid = student_with_profile(app_client)
    app = create_application(app_client, token)
    app_client.post(f"{APPS}/{app['id']}/submit", headers=bearer(token))
    row = admin_conn.execute(
        "SELECT trigger FROM notification_outbox WHERE user_id = %s AND trigger = %s",
        (uid, "APPLICATION_SUBMITTED"),
    ).fetchone()
    assert row is not None  # the submit transaction enqueued the notification (BR-N01)


def test_resubmitting_a_submitted_application_is_an_invalid_transition_br_s04(app_client):
    token, _ = student_with_profile(app_client)
    app = create_application(app_client, token)
    app_client.post(f"{APPS}/{app['id']}/submit", headers=bearer(token))
    again = app_client.post(f"{APPS}/{app['id']}/submit", headers=bearer(token))
    assert again.status_code == 409
    assert again.json()["error"]["code"] == "invalid_transition"


def test_list_my_applications_returns_only_mine(app_client):
    a_token, _ = student_with_profile(app_client)
    b_token, _ = student_with_profile(app_client)
    create_application(app_client, a_token, academic_year="2026")
    create_application(app_client, a_token, academic_year="2027")
    a_list = app_client.get(APPS, headers=bearer(a_token)).json()
    assert len(a_list["items"]) == 2
    b_list = app_client.get(APPS, headers=bearer(b_token)).json()
    assert b_list["items"] == []


def test_cannot_read_another_users_application_st_2_3(app_client):
    a_token, _ = student_with_profile(app_client)
    b_token, _ = student_with_profile(app_client)
    app = create_application(app_client, a_token)
    # B is invisible to A's row (RLS) → 404, never the data.
    assert app_client.get(f"{APPS}/{app['id']}", headers=bearer(b_token)).status_code == 404
    assert app_client.get(f"{APPS}/{app['id']}", headers=bearer(a_token)).status_code == 200


def test_cannot_submit_another_users_application_st_2_3(app_client):
    a_token, _ = student_with_profile(app_client)
    b_token, _ = student_with_profile(app_client)
    app = create_application(app_client, a_token)
    assert app_client.post(f"{APPS}/{app['id']}/submit", headers=bearer(b_token)).status_code == 404
