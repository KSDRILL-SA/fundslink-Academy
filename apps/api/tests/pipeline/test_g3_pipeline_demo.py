"""GATE G3 — the FINAL headless pipeline demo (API only), per claude-instructions/03-BACKEND.md.

seed student → apply → pre-screen → RETURNED → resubmit → READY → human review → all 4 decision
paths; then prove the SYSTEM principal can NEVER approve (the fn_human_final DB trigger rejects it,
BR-E03 / MASTER-SPEC §5.8). A light end-to-end touch (match → track → notify) closes the loop.

Run with -s to see the narrative: `pytest tests/pipeline -s -q`.
"""

from __future__ import annotations

import uuid

import psycopg
import pytest

from tests.pipeline.conftest import BASE, bearer, make_reviewer, register_student

PDF = b"%PDF-1.7\n%\xe2\xe3\xcf\xd3\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"


def _create(api, token, year):
    r = api.post(f"{BASE}/applications", headers=bearer(token),
                 json={"application_type": "UG_CAT_C", "academic_year": year})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _submit(api, token, app_id):
    return api.post(f"{BASE}/applications/{app_id}/submit", headers=bearer(token)).json()


def _review(api, rev, app_id, decision):
    r = api.post(f"{BASE}/admin/applications/{app_id}/review", headers=bearer(rev),
                 json={"decision": decision})
    assert r.status_code == 200, r.text
    return r.json()["status"]


def _upload_nsfas(api, token):
    r = api.post(f"{BASE}/students/me/documents", headers=bearer(token),
                 files={"file": ("o.pdf", PDF, "application/pdf")},
                 data={"doc_type": "NSFAS_OUTCOME"})
    assert r.status_code == 201, r.text


def test_g3_full_lifecycle_and_four_decision_paths(api, admin_conn):
    print("\n=== G3 PIPELINE DEMO (API only) ===")
    token, _ = register_student(api)
    reviewer = make_reviewer(api, admin_conn)
    print("seeded student + profile; minted an ADMIN_REVIEWER")

    # --- golden path: apply -> pre-screen RETURNED -> fix -> resubmit -> READY -> review ---
    app1 = _create(api, token, "2026")
    returned = _submit(api, token, app1)
    assert returned["status"] == "RETURNED_FOR_INFO"
    fixes = returned["pre_screen"]["fix_list"]
    assert fixes
    print(f"2026: submit (no docs) -> {returned['status']}; fix-list={fixes}")

    _upload_nsfas(api, token)
    resub = api.post(f"{BASE}/applications/{app1}/resubmit", headers=bearer(token)).json()
    assert resub["status"] == "READY_FOR_REVIEW"
    print(f"2026: uploaded NSFAS outcome + resubmit -> {resub['status']}")

    assert _review(api, reviewer, app1, "UNDER_REVIEW") == "UNDER_REVIEW"
    assert _review(api, reviewer, app1, "APPROVED_PROPOSED") == "APPROVED_PROPOSED"
    print("2026: reviewer UNDER_REVIEW -> APPROVED_PROPOSED (decision path 1)")

    # --- the other three decision paths (docs now on file → straight to READY) ---
    paths = {
        "2027": ("UNDER_REVIEW", None),
        "2028": ("UNDER_REVIEW", "INTERVIEW_SCHEDULED"),
        "2029": ("UNDER_REVIEW", "REJECTED"),
    }
    for year, (first, second) in paths.items():
        app_id = _create(api, token, year)
        ready = _submit(api, token, app_id)
        assert ready["status"] == "READY_FOR_REVIEW", ready
        status = _review(api, reviewer, app_id, first)
        if second:
            status = _review(api, reviewer, app_id, second)
        print(f"{year}: submit (docs present) -> READY -> review -> {status}")
        assert status == (second or first)

    # --- Human-Final: the SYSTEM principal can NEVER reach a final decision (BR-E03) ---
    with pytest.raises(psycopg.errors.RaiseException) as exc:
        admin_conn.execute(
            "INSERT INTO application_status_event (id, application_id, to_status, actor_user_id)"
            " VALUES (%s, %s, 'APPROVED', 'SYSTEM')",
            (f"ev_{uuid.uuid4().hex}", app1),
        )
    assert "HUMAN_FINAL_PRINCIPLE" in str(exc.value)
    print(f"Human-Final: SYSTEM 'APPROVED' rejected by the DB -> {str(exc.value).splitlines()[0]}")
    print("=== G3 PIPELINE DEMO: PASS ===")


def test_g3_end_to_end_match_track_notify(api, admin_conn):
    """A light end-to-end across the remaining modules: match → track → notification history."""
    token, uid = register_student(api)
    bid = f"eb_{uuid.uuid4().hex}"
    admin_conn.execute(
        "INSERT INTO external_bursary (id, name, provider, level_eligibility, field_tags, status,"
        " created_by) VALUES (%s, 'Tech Bursary', 'ACME', %s, %s, 'OPEN', 'SYSTEM')",
        (bid, ["UG"], ["computer", "science"]),
    )
    assert api.post(f"{BASE}/matches/run", headers=bearer(token)).status_code == 200
    matches = api.get(f"{BASE}/matches/me", headers=bearer(token)).json()["items"]
    assert any(m["bursary"]["id"] == bid for m in matches)

    reg = api.post(f"{BASE}/tracked-applications", headers=bearer(token),
                   json={"external_bursary_id": bid})
    assert reg.status_code == 201 and reg.json()["status_source"] == "SELF_REPORT"

    # notification history reads the outbox the application/tracking transactions enqueued.
    assert api.get(f"{BASE}/notifications/me", headers=bearer(token)).status_code == 200
    print("\nE2E: matched a bursary, tracked it, read notification history — all via API")
