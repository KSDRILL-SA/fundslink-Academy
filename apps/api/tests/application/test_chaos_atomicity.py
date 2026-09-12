"""CHAOS HOUR — a status transition is all-or-nothing (G5 item 5, BR-N01).

A status transition writes three things, in this order (``state_machine.py``):

1. ``application_status_event`` — the append-only record of WHY it changed
2. ``funding_application.status`` — the status cache
3. ``notification_outbox`` — the message that tells the student

CLAUDE.md makes the invariant a hard rule: *status event + outbox row, ONE
transaction*. These tests are the first thing to prove it, by breaking the
transaction after the first two writes and asserting the first two are gone.

Why it is worth a chaos test rather than trust: a partial write means a
student's status and the record of why it changed **disagree**, or a status
moves and nobody is told. On a platform where a status is a funding decision,
that is the worst silent failure available — nothing surfaces, nothing retries,
and the evidence of the mistake is the thing that failed to write.

Submit is a CHAIN of transitions (DRAFT -> SUBMITTED -> PRE_SCREENING -> the
pre-screen's verdict), which makes it the right thing to break: the invariant
has to hold across the whole chain, not merely one hop. Killing the first
outbox write must leave the application in DRAFT, as though the student had
never pressed the button.

Both tests verify from a SEPARATE connection. Reading back through the session
that was just broken would prove nothing about what is committed.
"""

from __future__ import annotations

import pytest

from app.modules.application.repository import OutboxRepository
from tests.application.conftest import (
    bearer,
    create_application,
    student_with_profile,
)

BASE = "/api/v1"


def _rows(admin_conn, app_id: str) -> tuple[str | None, int, int]:
    """(status, status-event count, outbox count) as actually committed."""
    status = admin_conn.execute(
        "SELECT status FROM funding_application WHERE id = %s", (app_id,)
    ).fetchone()
    events = admin_conn.execute(
        "SELECT count(*) FROM application_status_event"
        " WHERE application_id = %s AND to_status = 'SUBMITTED'",
        (app_id,),
    ).fetchone()
    outbox = admin_conn.execute(
        "SELECT count(*) FROM notification_outbox WHERE payload->>'application_id' = %s",
        (app_id,),
    ).fetchone()
    return (status[0] if status else None), events[0], outbox[0]


@pytest.mark.usefixtures("migrated_db")
class TestStatusTransitionAtomicity:
    """SUBMITTED is the transition under test — it writes all three rows."""

    def test_the_happy_path_really_does_write_all_three(self, app_client, admin_conn):
        """The control. Without this, a test asserting 'nothing was written' is trivially true."""
        token, _uid = student_with_profile(app_client)
        app_id = create_application(app_client, token)["id"]

        resp = app_client.post(f"{BASE}/applications/{app_id}/submit", headers=bearer(token))
        assert resp.status_code == 200, resp.text

        status, events, outbox = _rows(admin_conn, app_id)
        # Submit runs a CHAIN — DRAFT -> SUBMITTED -> PRE_SCREENING and onward to
        # whatever the eligibility pre-screen decides. The landing status is that
        # policy's business, not this test's; what matters here is that the
        # application left DRAFT and both records of the move exist.
        assert status != "DRAFT", "submit did not move the application"
        assert events == 1, "the append-only record of why the status changed"
        assert outbox >= 1, "the message that tells the student"

    def test_killing_the_connection_mid_transaction_writes_nothing(
        self, app_client, admin_conn, monkeypatch
    ):
        """CHAOS: the DB connection dies between the status write and the outbox write.

        The session terminates its own backend, which is the real event this is
        defending against — a dropped connection, a failover, a restart — made
        deterministic instead of timing-dependent.
        """
        token, _uid = student_with_profile(app_client)
        app_id = create_application(app_client, token)["id"]
        before_status, before_events, before_outbox = _rows(admin_conn, app_id)
        assert before_status == "DRAFT"

        original = OutboxRepository.enqueue

        async def kill_the_connection(self, **kwargs):
            # Two writes are already in this transaction. Pull the plug.
            from app.db import sql

            await sql.execute(self.session, "SELECT pg_terminate_backend(pg_backend_pid())")
            raise AssertionError("unreachable — the backend is gone")

        monkeypatch.setattr(OutboxRepository, "enqueue", kill_the_connection)

        # The request must fail. It must not half-succeed.
        with pytest.raises(Exception):  # noqa: B017 — driver-specific; the rows are the assertion
            app_client.post(f"{BASE}/applications/{app_id}/submit", headers=bearer(token))

        monkeypatch.setattr(OutboxRepository, "enqueue", original)

        status, events, outbox = _rows(admin_conn, app_id)
        assert status == before_status, "the status moved without the reason or the notification"
        assert events == before_events, "a status event survived a transaction that died"
        assert outbox == before_outbox, "an outbox row survived a transaction that died"

    def test_a_failing_third_write_rolls_back_the_first_two(
        self, app_client, admin_conn, monkeypatch
    ):
        """The same invariant without depending on how PostgreSQL handles termination.

        Kept alongside the chaos case deliberately: if the harness or the driver
        ever changes how a killed backend surfaces, this one still fails loudly
        the day someone splits the transaction in two.
        """
        token, _uid = student_with_profile(app_client)
        app_id = create_application(app_client, token)["id"]
        before_status, before_events, before_outbox = _rows(admin_conn, app_id)

        async def refuse(self, **kwargs):
            raise RuntimeError("outbox unavailable")

        monkeypatch.setattr(OutboxRepository, "enqueue", refuse)

        with pytest.raises(Exception):  # noqa: B017
            app_client.post(f"{BASE}/applications/{app_id}/submit", headers=bearer(token))

        status, events, outbox = _rows(admin_conn, app_id)
        assert (status, events, outbox) == (before_status, before_events, before_outbox)
