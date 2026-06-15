"""Notification outbox worker — delivery, consent skip (BR-N03), retry/backoff, DEAD.

Async tests on a fresh engine (SYSTEM context); the email/SMS adapters are captured. The outbox is
cleared per test so the worker sees only this test's rows (other suites enqueue rows too).
"""

from __future__ import annotations

import os

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.db.context import set_system_context
from app.modules.auth.email import EmailAdapter
from app.modules.notification import channels as channels_mod
from app.modules.notification.channels import ChannelAdapter
from app.modules.notification.worker import MAX_ATTEMPTS, NotificationWorker
from tests.notification.conftest import seed_outbox, seed_user


class _CaptureEmail(EmailAdapter):
    def __init__(self):
        self.sent: list[str] = []

    async def send(self, *, to, subject, body):
        self.sent.append(to)


class _CaptureSms(ChannelAdapter):
    def __init__(self):
        self.sent: list = []

    async def send(self, *, recipient, subject, body):
        self.sent.append(recipient)


class _FailingChannel(ChannelAdapter):
    async def send(self, *, recipient, subject, body):
        raise RuntimeError("provider down")


@pytest.fixture
def outbox(admin_conn):
    admin_conn.execute("DELETE FROM notification_outbox")  # isolate from other suites' enqueues
    return admin_conn


async def _run_worker():
    engine = create_async_engine(os.environ["DATABASE_URL"])
    try:
        async with async_sessionmaker(engine)() as session:
            await set_system_context(session)
            counts = await NotificationWorker(session).process_batch()
            await session.commit()
        return counts
    finally:
        await engine.dispose()


def _state(conn, nid):
    return conn.execute(
        "SELECT state, attempts FROM notification_outbox WHERE id = %s", (nid,)
    ).fetchone()


async def test_worker_delivers_pending_and_marks_sent(outbox, monkeypatch):
    cap = _CaptureEmail()
    monkeypatch.setattr("app.modules.auth.email._adapter", cap)
    uid, email = seed_user(outbox, consents=("TERMS_OF_SERVICE",))
    nid = seed_outbox(outbox, uid, channels=("EMAIL",))
    counts = await _run_worker()
    assert counts["sent"] == 1
    assert email in cap.sent
    assert _state(outbox, nid)[0] == "SENT"


async def test_worker_skips_channel_without_consent_br_n03(outbox, monkeypatch):
    cap_email, cap_sms = _CaptureEmail(), _CaptureSms()
    monkeypatch.setattr("app.modules.auth.email._adapter", cap_email)
    monkeypatch.setitem(channels_mod.CHANNELS, "SMS", cap_sms)
    uid, email = seed_user(outbox, consents=("TERMS_OF_SERVICE",))  # NO MARKETING_SMS
    nid = seed_outbox(outbox, uid, channels=("EMAIL", "SMS"))
    await _run_worker()
    assert email in cap_email.sent  # email delivered
    assert cap_sms.sent == []  # SMS skipped — consent not granted (BR-N03)
    assert _state(outbox, nid)[0] == "SENT"


async def test_worker_sends_sms_when_consent_is_granted_br_n03(outbox, monkeypatch):
    cap_sms = _CaptureSms()
    monkeypatch.setitem(channels_mod.CHANNELS, "SMS", cap_sms)
    monkeypatch.setattr("app.modules.auth.email._adapter", _CaptureEmail())
    uid, _ = seed_user(outbox, consents=("TERMS_OF_SERVICE", "MARKETING_SMS"))
    seed_outbox(outbox, uid, channels=("SMS",))
    await _run_worker()
    assert len(cap_sms.sent) == 1  # SMS delivered — consent present


async def test_worker_retries_failed_delivery_with_backoff(outbox, monkeypatch):
    monkeypatch.setitem(channels_mod.CHANNELS, "EMAIL", _FailingChannel())
    uid, _ = seed_user(outbox, consents=("TERMS_OF_SERVICE",))
    nid = seed_outbox(outbox, uid, channels=("EMAIL",), attempts=0)
    counts = await _run_worker()
    assert counts["retried"] == 1
    state, attempts = _state(outbox, nid)
    assert state == "PENDING" and attempts == 1  # backed off for another attempt, not lost


async def test_worker_marks_dead_after_max_attempts(outbox, monkeypatch):
    monkeypatch.setitem(channels_mod.CHANNELS, "EMAIL", _FailingChannel())
    uid, _ = seed_user(outbox, consents=("TERMS_OF_SERVICE",))
    nid = seed_outbox(outbox, uid, channels=("EMAIL",), attempts=MAX_ATTEMPTS - 1)
    counts = await _run_worker()
    assert counts["dead"] == 1
    assert _state(outbox, nid)[0] == "DEAD"
