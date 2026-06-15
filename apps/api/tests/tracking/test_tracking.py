"""Tracking endpoints — BR-T01 (register), BR-T03 (source label), BR-T04 (transitions), ST-2.3."""

from __future__ import annotations

from tests.tracking.conftest import BASE, bearer, seed_bursary, student_with_profile

TRACKED = f"{BASE}/tracked-applications"


def _register(client, token, bursary_id):
    return client.post(TRACKED, headers=bearer(token), json={"external_bursary_id": bursary_id})


def test_register_tracked_application_br_t01(track_client, admin_conn):
    bid = seed_bursary(admin_conn)
    token, _ = student_with_profile(track_client)
    resp = _register(track_client, token, bid)
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["status"] == "REGISTERED"
    assert body["status_source"] == "SELF_REPORT"  # BR-T03 freshness label
    assert body["bursary"]["id"] == bid


def test_register_unknown_bursary_is_404(track_client):
    token, _ = student_with_profile(track_client)
    assert _register(track_client, token, "eb_does_not_exist").status_code == 404


def test_duplicate_tracking_is_rejected(track_client, admin_conn):
    bid = seed_bursary(admin_conn)
    token, _ = student_with_profile(track_client)
    assert _register(track_client, token, bid).status_code == 201
    dup = _register(track_client, token, bid)
    assert dup.status_code == 409 and dup.json()["error"]["code"] == "already_tracked"


def test_self_report_valid_transition_br_t04(track_client, admin_conn):
    bid = seed_bursary(admin_conn)
    token, _ = student_with_profile(track_client)
    tid = _register(track_client, token, bid).json()["id"]
    resp = track_client.post(
        f"{TRACKED}/{tid}/status", headers=bearer(token), json={"to_status": "SUBMITTED"}
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "SUBMITTED"
    assert resp.json()["status_source"] == "SELF_REPORT"  # BR-T03


def test_self_report_illegal_transition_is_rejected_br_t04(track_client, admin_conn):
    bid = seed_bursary(admin_conn)
    token, _ = student_with_profile(track_client)
    tid = _register(track_client, token, bid).json()["id"]
    # REGISTERED → APPROVED is not a legal tracked transition.
    resp = track_client.post(
        f"{TRACKED}/{tid}/status", headers=bearer(token), json={"to_status": "APPROVED"}
    )
    assert resp.status_code == 409 and resp.json()["error"]["code"] == "invalid_transition"


def test_dashboard_lists_only_my_tracked_applications_st_2_3(track_client, admin_conn):
    b1, b2 = seed_bursary(admin_conn, name="One"), seed_bursary(admin_conn, name="Two")
    a_token, _ = student_with_profile(track_client)
    b_token, _ = student_with_profile(track_client)
    _register(track_client, a_token, b1)
    _register(track_client, a_token, b2)
    a_list = track_client.get(TRACKED, headers=bearer(a_token)).json()
    assert len(a_list["items"]) == 2
    assert all(t["status_source"] == "SELF_REPORT" for t in a_list["items"])
    assert track_client.get(TRACKED, headers=bearer(b_token)).json()["items"] == []


def test_cannot_self_report_another_users_tracked_st_2_3(track_client, admin_conn):
    bid = seed_bursary(admin_conn)
    a_token, _ = student_with_profile(track_client)
    b_token, _ = student_with_profile(track_client)
    tid = _register(track_client, a_token, bid).json()["id"]
    resp = track_client.post(
        f"{TRACKED}/{tid}/status", headers=bearer(b_token), json={"to_status": "SUBMITTED"}
    )
    assert resp.status_code == 404  # B cannot see, let alone mutate, A's tracked application
