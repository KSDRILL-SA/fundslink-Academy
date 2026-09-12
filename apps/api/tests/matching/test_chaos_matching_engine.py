"""CHAOS HOUR — the matching engine dies mid-job (G5 item 5, case 1).

**There is no separate matching worker in v1.** The brief says "kill the
matching worker mid-job", and that phrasing describes the v1.x design: the
async queue is explicitly deferred (``service.py``: *"v1 is
synchronous-advisory … async 202/worker queue deferred to v1.x — TAD §6.2"*).
So the thing that can die mid-job is the request doing the work, and that is
what these tests kill. When the worker lands, its own chaos case is this file
plus a process to signal.

Two properties, and they matter in opposite directions:

1. **Degrade, never fail.** Matching is advisory. If the live embedding path is
   unavailable the student must still get matches, scored by tag/level overlap
   and labelled FALLBACK (S8.51). A student does not lose access to funding
   because an AI budget ran out.
2. **Do not half-finish.** If the run dies partway through writing matches, the
   student must not be left holding a partial match set that looks complete.
   Better no matches and a retry than ten of forty presented as "your matches".

Together those say: a degraded result is fine, a *misleading* result is not.
"""

from __future__ import annotations

import pytest

from app.modules.matching.stores import InMemoryReasoningStore
from tests.matching.conftest import (
    BASE,
    bearer,
    seed_bursary,
    student_with_profile,
)

# Captured at import, before any test can patch it. Taking the "original" from
# inside a test risks capturing a previous test's leaked patch.
_PRISTINE_SAVE = InMemoryReasoningStore.save

RUN = f"{BASE}/matches/run"
MINE = f"{BASE}/matches"


def _matches(conn, uid: str) -> list[tuple]:
    return conn.execute(
        "SELECT external_bursary_id, model_version FROM match_result"
        " WHERE student_profile_id = %s",
        (uid,),
    ).fetchall()


def test_the_engine_degrades_to_fallback_rather_than_failing_the_student(
    match_client, admin_conn, monkeypatch
):
    """The live path is gone entirely — not merely out of budget."""

    def _engine_down(*args, **kwargs):
        raise RuntimeError("embedding engine unavailable")

    # Force the live branch, then break it at the first thing it touches.
    async def _always_live(self, *, max_calls):  # noqa: ANN001
        return True

    monkeypatch.setattr("app.modules.matching.spend.MatchSpendBreaker.allow_live", _always_live)
    monkeypatch.setattr("app.modules.matching.service.embed_text", _engine_down)

    seed_bursary(admin_conn, tags=("computer", "science"))
    token, uid = student_with_profile(match_client, field="Computer Science")

    resp = match_client.post(RUN, headers=bearer(token))

    # S8.51 is not "fail cleanly", it is "degrade". A 500 here would mean a
    # student loses access to funding options because a model call failed,
    # while a tag/level overlap score was available the whole time.
    assert resp.status_code == 200, resp.text
    items = resp.json()["items"]
    assert items, "the engine was down and the student got nothing"
    assert all(m["mode"] == "FALLBACK" for m in items), (
        "the run did not label itself FALLBACK, so the student cannot tell this"
        " was a degraded result"
    )
    assert all(model == "fallback-overlap-v1" for _bid, model in _matches(admin_conn, uid)), (
        "the persisted rows claim a model version the run did not actually use"
    )


def test_a_run_that_dies_midway_leaves_no_partial_match_set(match_client, admin_conn, monkeypatch):
    """CHAOS: the job dies after some matches are written, before the rest.

    Killing the reasoning-store write is the cleanest cut point: it sits
    immediately after each ``match_result`` insert, so failing it on the third
    call means two matches are already in the transaction.
    """
    calls = {"n": 0}

    async def die_partway(self, doc):
        calls["n"] += 1
        if calls["n"] == 3:
            raise RuntimeError("reasoning store died mid-job")
        return await _PRISTINE_SAVE(self, doc)

    for _ in range(6):
        seed_bursary(admin_conn, tags=("computer", "science"))
    token, uid = student_with_profile(match_client, field="Computer Science")

    monkeypatch.setattr(InMemoryReasoningStore, "save", die_partway)
    with pytest.raises(Exception):  # noqa: B017 — the rows are the assertion
        match_client.post(RUN, headers=bearer(token))
    monkeypatch.setattr(InMemoryReasoningStore, "save", _PRISTINE_SAVE)

    assert calls["n"] >= 3, "the kill point was never reached — the test proved nothing"
    assert _matches(admin_conn, uid) == [], (
        "a run that died mid-job left match rows committed: the student would see"
        " a partial match set presented as complete"
    )


def test_the_student_can_re_run_successfully_after_a_failed_run(
    match_client, admin_conn, monkeypatch
):
    """Job recovery: a dead run must not poison the next one."""
    async def always_dies(self, doc):
        raise RuntimeError("engine down")

    seed_bursary(admin_conn, tags=("computer", "science"))
    token, uid = student_with_profile(match_client, field="Computer Science")

    monkeypatch.setattr(InMemoryReasoningStore, "save", always_dies)
    with pytest.raises(Exception):  # noqa: B017
        match_client.post(RUN, headers=bearer(token))
    monkeypatch.setattr(InMemoryReasoningStore, "save", _PRISTINE_SAVE)

    # Recovery: the engine is back, and the student simply tries again.
    resp = match_client.post(RUN, headers=bearer(token))
    assert resp.status_code == 200, resp.text
    assert resp.json()["items"], "the student could not recover from a failed run"
    assert _matches(admin_conn, uid), "the successful re-run persisted nothing"
