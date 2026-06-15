"""Notification endpoints — history (own rows), preferences (BR-N02), isolation (ST-2.3)."""

from __future__ import annotations

from tests.notification.conftest import BASE, bearer, register_student, seed_outbox

ME = f"{BASE}/notifications/me"
PREFS = f"{BASE}/notifications/preferences"


def test_list_my_notification_history(notif_client, admin_conn):
    token, uid = register_student(notif_client)
    seed_outbox(admin_conn, uid, trigger="APPLICATION_SUBMITTED")
    seed_outbox(admin_conn, uid, trigger="DECISION_APPROVED")
    body = notif_client.get(ME, headers=bearer(token)).json()
    assert len(body["items"]) == 2
    assert {n["trigger"] for n in body["items"]} == {"APPLICATION_SUBMITTED", "DECISION_APPROVED"}


def test_notifications_are_isolated_per_user_st_2_3(notif_client, admin_conn):
    a_token, a_uid = register_student(notif_client)
    b_token, _ = register_student(notif_client)
    seed_outbox(admin_conn, a_uid)
    assert len(notif_client.get(ME, headers=bearer(a_token)).json()["items"]) == 1
    assert notif_client.get(ME, headers=bearer(b_token)).json()["items"] == []  # B sees nothing


def test_list_requires_authentication(notif_client):
    assert notif_client.get(ME).status_code == 401


def test_put_preferences_br_n02(notif_client):
    token, _ = register_student(notif_client)
    resp = notif_client.put(
        PREFS,
        headers=bearer(token),
        json={"per_trigger": {"DECISION_APPROVED": ["EMAIL", "SMS"], "DECISION_REJECTED": ["SMS"]}},
    )
    assert resp.status_code == 200
    assert resp.json()["per_trigger"]["DECISION_APPROVED"] == ["EMAIL", "SMS"]


def test_put_preferences_rejects_unknown_channel(notif_client):
    token, _ = register_student(notif_client)
    resp = notif_client.put(
        PREFS, headers=bearer(token), json={"per_trigger": {"DECISION_APPROVED": ["PIGEON"]}}
    )
    assert resp.status_code == 422  # channel enum validated at the boundary
