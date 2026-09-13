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


def test_saved_preferences_can_be_read_back(notif_client):
    # S20 had no way to read them: every visit opened with nothing ticked, and saving again wiped
    # the student's earlier choices (#298).
    token, _ = register_student(notif_client)
    assert notif_client.get(PREFS, headers=bearer(token)).json() == {"per_trigger": {}}
    chosen = {"DECISION_APPROVED": ["EMAIL", "IN_APP", "SMS"], "APPLICATION_SUBMITTED": ["EMAIL"]}
    notif_client.put(PREFS, headers=bearer(token), json={"per_trigger": chosen})
    assert notif_client.get(PREFS, headers=bearer(token)).json() == {"per_trigger": chosen}


def test_preferences_are_the_callers_own(notif_client):
    a_token, _ = register_student(notif_client)
    b_token, _ = register_student(notif_client)
    notif_client.put(PREFS, headers=bearer(a_token),
                     json={"per_trigger": {"DECISION_APPROVED": ["SMS"]}})
    assert notif_client.get(PREFS, headers=bearer(b_token)).json() == {"per_trigger": {}}


def test_a_trigger_that_does_not_exist_is_refused_not_silently_stored(notif_client):
    # Two of the screen's rows were saved under invented codes, which the worker never looks up.
    token, _ = register_student(notif_client)
    resp = notif_client.put(
        PREFS, headers=bearer(token),
        json={"per_trigger": {"APPLICATION_REVIEWED": ["SMS"], "DECISION_APPROVED": ["SMS"]}},
    )
    assert resp.status_code == 422
    body = resp.json()["error"]
    assert body["code"] == "invalid_notification_trigger"
    assert "APPLICATION_REVIEWED" in body["message"]
    assert "DECISION_APPROVED" in body["details"]["allowed"]
    assert notif_client.get(PREFS, headers=bearer(token)).json() == {"per_trigger": {}}
