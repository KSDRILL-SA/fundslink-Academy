"""CHAOS HOUR — flood the outbox: the workers drain it, and DEAD surfaces (G5 item 5, case 3).

The outbox is the only thing standing between a status change and a student
knowing about it. Three ways it can fail quietly, all tested here:

1. **It does not drain.** More rows arrive than one batch can carry and the
   backlog grows forever. Nobody is told anything, and the queue looks busy
   rather than broken.
2. **Two workers collide.** ``claim_batch`` uses ``FOR UPDATE SKIP LOCKED`` so
   that N workers never process the same row. If that were wrong, a student
   would get the same message twice — or, worse, a row would be marked SENT by
   one worker while another was still delivering it.
3. **DEAD never surfaces.** A permanently undeliverable message must end up
   DEAD and be *findable*, not sit PENDING forever looking like work in
   progress. An invisible dead letter is a student who was never told and
   nobody who knows.

These are the flood properties. Single-row retry and the DEAD transition
itself are already covered in ``test_worker.py``; this file is about behaviour
under volume and concurrency, which is where the invariants actually break.
"""

from __future__ import annotations

import asyncio
import json
import os
import uuid

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.db.context import set_system_context
from app.modules.auth.email import EmailAdapter
from app.modules.notification.repository import NotificationRepository
from app.modules.notification.worker import MAX_ATTEMPTS, NotificationWorker
from tests.notification.conftest import seed_user


class _CountingEmail(EmailAdapter):
    """Records every delivery so a duplicate is visible, not merely improbable."""

    def __init__(self) -> None:
        self.sent: list[str] = []

    async def send(self, *, to, subject, body) -> None:
        self.sent.append(to)


class _AlwaysFails(EmailAdapter):
    async def send(self, *, to, subject, body) -> None:
        raise RuntimeError("provider down")


@pytest.fixture
def outbox(admin_conn):
    admin_conn.execute("DELETE FROM notification_outbox")  # isolate from other suites
    return admin_conn


def flood(conn, user_id: str, count: int) -> list[str]:
    """Enqueue ``count`` PENDING rows, as a burst of status changes would."""
    ids = []
    for _ in range(count):
        nid = f"no_{uuid.uuid4().hex}"
        conn.execute(
            "INSERT INTO notification_outbox (id, user_id, trigger, channels, payload)"
            " VALUES (%s, %s, %s, %s, %s)",
            (nid, user_id, "APPLICATION_STATUS_CHANGED", ["EMAIL"], json.dumps({"n": nid})),
        )
        ids.append(nid)
    return ids


def states(conn) -> dict[str, int]:
    rows = conn.execute("SELECT state, count(*) FROM notification_outbox GROUP BY state").fetchall()
    return {state: n for state, n in rows}


def _engine():
    return create_async_engine(os.environ["DATABASE_URL"])


async def _drain_pass(batch: int = 20) -> dict[str, int]:
    engine = _engine()
    try:
        async with async_sessionmaker(engine)() as session:
            await set_system_context(session)
            counts = await NotificationWorker(session).process_batch(batch=batch)
            await session.commit()
        return counts
    finally:
        await engine.dispose()


async def test_a_flood_drains_completely_and_delivers_each_row_exactly_once(outbox, monkeypatch):
    """60 rows, batches of 20. Everything sent, nothing left, nothing sent twice."""
    cap = _CountingEmail()
    monkeypatch.setattr("app.modules.auth.email._adapter", cap)
    uid, _email = seed_user(outbox, consents=("TERMS_OF_SERVICE",))
    ids = flood(outbox, uid, 60)

    # Drain until quiet, with a hard ceiling so a non-draining queue fails the
    # test instead of hanging it.
    total_sent = 0
    for _ in range(10):
        counts = await _drain_pass(batch=20)
        total_sent += counts["sent"]
        if counts["sent"] == 0:
            break

    assert total_sent == len(ids), "the flood did not drain"
    assert states(outbox).get("PENDING", 0) == 0, "rows left PENDING after draining"
    assert states(outbox).get("SENT") == len(ids)
    # The delivery count is the real duplicate check: state alone cannot show
    # a row that was delivered twice and marked SENT once.
    assert len(cap.sent) == len(ids), f"expected {len(ids)} deliveries, got {len(cap.sent)}"


async def test_two_workers_never_claim_the_same_row(outbox, monkeypatch):
    """FOR UPDATE SKIP LOCKED, proven rather than trusted.

    Both workers claim while the other's transaction is still open — which is
    the only arrangement where a collision could happen. Sequential claims with
    a commit in between would pass even if SKIP LOCKED were missing entirely.
    """
    monkeypatch.setattr("app.modules.auth.email._adapter", _CountingEmail())
    uid, _email = seed_user(outbox, consents=("TERMS_OF_SERVICE",))
    flood(outbox, uid, 40)

    engine = _engine()
    try:
        factory = async_sessionmaker(engine)
        async with factory() as a, factory() as b:
            await set_system_context(a)
            await set_system_context(b)

            # A claims and HOLDS its rows locked; B then claims.
            claimed_a = await NotificationRepository(a).claim_batch(20)
            claimed_b = await NotificationRepository(b).claim_batch(20)

            ids_a = {row[0] for row in claimed_a}
            ids_b = {row[0] for row in claimed_b}

            assert len(ids_a) == 20 and len(ids_b) == 20, "a worker was starved of work"
            assert ids_a.isdisjoint(ids_b), "two workers claimed the same notification"

            await a.rollback()
            await b.rollback()
    finally:
        await engine.dispose()


async def test_concurrent_drain_of_a_flood_loses_nothing_and_duplicates_nothing(
    outbox, monkeypatch
):
    """Two workers draining the same flood at once — the deploy shape (TAD §7)."""
    cap = _CountingEmail()
    monkeypatch.setattr("app.modules.auth.email._adapter", cap)
    uid, _email = seed_user(outbox, consents=("TERMS_OF_SERVICE",))
    ids = flood(outbox, uid, 50)

    for _ in range(8):
        results = await asyncio.gather(_drain_pass(10), _drain_pass(10))
        if sum(r["sent"] for r in results) == 0:
            break

    assert states(outbox).get("PENDING", 0) == 0, "concurrent workers left a backlog"
    assert states(outbox).get("SENT") == len(ids), "a notification was lost"
    assert len(cap.sent) == len(ids), "a notification was delivered more than once"


async def test_an_undeliverable_flood_ends_DEAD_and_is_findable(outbox, monkeypatch):
    """DEAD must surface. A dead letter nobody can see is a student nobody told."""
    monkeypatch.setattr("app.modules.auth.email._adapter", _AlwaysFails())
    uid, _email = seed_user(outbox, consents=("TERMS_OF_SERVICE",))
    ids = flood(outbox, uid, 25)

    # Each pass burns one attempt per row, then backs off. Fast-forward the
    # backoff rather than sleeping through exponential delays.
    dead_total = 0
    for _ in range(MAX_ATTEMPTS + 1):
        counts = await _drain_pass(batch=25)
        dead_total += counts["dead"]
        outbox.execute("UPDATE notification_outbox SET next_attempt_at = now()")

    assert dead_total == len(ids), "undeliverable rows never reached DEAD"
    by_state = states(outbox)
    assert by_state.get("DEAD") == len(ids)
    assert by_state.get("PENDING", 0) == 0, "rows stuck PENDING forever look like work in progress"

    # Findable: the operational query an alert would run (launch checklist —
    # "outbox DEAD-letter alert tested").
    visible = outbox.execute(
        "SELECT count(*) FROM notification_outbox WHERE state = 'DEAD' AND attempts >= %s",
        (MAX_ATTEMPTS,),
    ).fetchone()[0]
    assert visible == len(ids), "DEAD rows are not findable by the alert query"
