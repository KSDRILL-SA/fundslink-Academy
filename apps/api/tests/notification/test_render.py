"""Notification copy (content track) — coverage + the no-PII / kind-rejection guarantees.

Pure unit tests on `_render`: no DB, no network. They lock the student-facing voice law
(ux-screen-map §0): every real trigger has a warm message, nothing leaks an id/PII (P3 / POPIA),
and the rejection always keeps a door open (P2) and never frames the person as a failure (P1).
"""

from __future__ import annotations

from app.modules.application.jobs import TRIGGER as RETURN_REMINDER
from app.modules.application.state_machine import STATUS_TRIGGER
from app.modules.notification.worker import _DEFAULT_MESSAGE, _TEMPLATES, _render

# Triggers enqueued outside the application state machine (the scheduled jobs).
_JOB_TRIGGERS = ("TRACKED_DEADLINE_REMINDER", "TRACKED_FOLLOW_UP", RETURN_REMINDER)

_ALL_TRIGGERS = sorted({t for t in STATUS_TRIGGER.values() if t} | set(_JOB_TRIGGERS))


def test_every_real_trigger_has_a_template():
    missing = [t for t in _ALL_TRIGGERS if t not in _TEMPLATES]
    assert not missing, f"triggers without a student message template: {missing}"


def test_every_message_is_a_real_sentence():
    for trigger in _ALL_TRIGGERS:
        subject, body = _render(trigger, {})
        assert subject.strip(), trigger
        assert len(body.strip()) >= 20, trigger  # a warm sentence, not a stub


def test_no_message_leaks_an_id_or_pii():
    # The worker passes the outbox payload; the copy must never echo an id (P3 / POPIA).
    payload = {"application_id": "app_SECRETID123", "tracked_application_id": "ta_SECRETID456"}
    for trigger in [*_ALL_TRIGGERS, "UNKNOWN_TRIGGER"]:
        subject, body = _render(trigger, payload)
        assert "SECRETID" not in subject + body, trigger


def test_unknown_trigger_falls_back_safely():
    assert _render("NOT_A_REAL_TRIGGER", {}) == _DEFAULT_MESSAGE


def test_rejection_is_kind_and_never_a_dead_end():
    # The kind rejection (S16-REJ): names the event, not the person, and opens doors (P1, P2).
    _, body = _render("DECISION_REJECTED", {})
    low = body.lower()
    assert "appeal" in low and "again" in low and "matched" in low  # the three open doors (P2)
    assert "fail" not in low and "reject" not in low  # never frame the person as a failure (P1)
