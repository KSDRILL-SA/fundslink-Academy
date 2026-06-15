"""Unit tests for the ApplicationStateMachine engine (BR-S04, BR-E03, BR-N01) with stub repos —
fast, DB-free assertions of the guard logic that protects every status change."""

from __future__ import annotations

import pytest

from app.common.errors import AppError
from app.modules.application.state_machine import ApplicationStateMachine


class _Apps:
    def __init__(self, status):
        self._status = status
        self.set_to = None

    async def get_status(self, app_id):
        return self._status

    async def set_status(self, app_id, status):
        self.set_to = status


class _Trans:
    def __init__(self, ok):
        self._ok = ok

    async def allowed(self, from_status, to_status):
        return self._ok


class _Events:
    def __init__(self):
        self.inserted = None

    async def insert(self, **kw):
        self.inserted = kw


class _Outbox:
    def __init__(self):
        self.enqueued = None

    async def enqueue(self, **kw):
        self.enqueued = kw


def _engine(*, status, transition_ok):
    apps, events, outbox = _Apps(status), _Events(), _Outbox()
    machine = ApplicationStateMachine(
        transitions=_Trans(transition_ok), events=events, applications=apps, outbox=outbox
    )
    return machine, apps, events, outbox


async def test_engine_applies_valid_transition_and_enqueues_outbox_br_n01():
    machine, apps, events, outbox = _engine(status="DRAFT", transition_ok=True)
    prev = await machine.transition(
        application_id="a1", owner_user_id="u1", to_status="SUBMITTED",
        actor_user_id="u1", request_id="req",
    )
    assert prev == "DRAFT"
    assert apps.set_to == "SUBMITTED"
    assert events.inserted["to_status"] == "SUBMITTED"
    assert outbox.enqueued["trigger"] == "APPLICATION_SUBMITTED"  # BR-N01: same call path


async def test_engine_rejects_illegal_transition_br_s04():
    machine, _apps, events, outbox = _engine(status="DRAFT", transition_ok=False)
    with pytest.raises(AppError) as exc:
        await machine.transition(
            application_id="a1", owner_user_id="u1", to_status="APPROVED",
            actor_user_id="u1", request_id="req",
        )
    assert exc.value.status_code == 409 and exc.value.code == "invalid_transition"
    assert events.inserted is None and outbox.enqueued is None  # nothing written


async def test_engine_human_final_guard_blocks_system_actor_br_e03():
    """A final decision by SYSTEM is refused at the service layer (before the DB trigger)."""
    machine, _apps, events, _outbox = _engine(status="UNDER_REVIEW", transition_ok=True)
    with pytest.raises(AppError) as exc:
        await machine.transition(
            application_id="a1", owner_user_id="u1", to_status="REJECTED",
            actor_user_id="SYSTEM", request_id="req",
        )
    assert exc.value.status_code == 403 and exc.value.code == "human_final_required"
    assert events.inserted is None  # the event is never even written


async def test_engine_allows_final_decision_by_a_human_br_e03():
    machine, apps, events, _outbox = _engine(status="UNDER_REVIEW", transition_ok=True)
    await machine.transition(
        application_id="a1", owner_user_id="u1", to_status="REJECTED",
        actor_user_id="reviewer-9", request_id="req",
    )
    assert apps.set_to == "REJECTED"
    assert events.inserted["actor_user_id"] == "reviewer-9"
