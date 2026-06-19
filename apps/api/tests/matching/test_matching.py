"""Matching behaviour — BR-M01/M02/M03, quota (ST-2.6), FALLBACK (S8.51), isolation (ST-2.3)."""

from __future__ import annotations

from tests.matching.conftest import BASE, bearer, seed_bursary, student_with_profile

RUN = f"{BASE}/matches/run"
MINE = f"{BASE}/matches/me"
BROWSE = f"{BASE}/bursaries"


def test_run_matching_returns_200_with_matches(match_client, admin_conn):
    # v1 synchronous advisory: /matches/run scores in-request and returns the match page directly.
    seed_bursary(admin_conn)
    token, _ = student_with_profile(match_client)
    resp = match_client.post(RUN, headers=bearer(token))
    assert resp.status_code == 200
    body = resp.json()
    assert "items" in body and "meta" in body  # MatchPage shape — no fake job_id/QUEUED


def test_matched_results_appear_for_the_student_br_m01_br_m02(match_client, admin_conn):
    bid = seed_bursary(admin_conn, tags=("computer", "science"))
    token, _ = student_with_profile(match_client, field="Computer Science")
    match_client.post(RUN, headers=bearer(token))
    page = match_client.get(MINE, headers=bearer(token)).json()
    assert page["items"], "expected at least one match"
    match = next(m for m in page["items"] if m["bursary"]["id"] == bid)
    assert 0.0 <= match["score"] <= 1.0  # BR-M02: score persisted in PostgreSQL
    assert match["mode"] == "LIVE"
    assert match["reasoning_summary"]  # reasoning came from the Mongo store, keyed by match id


def test_expired_deadline_bursary_is_not_matched_br_m03(match_client, admin_conn):
    open_id = seed_bursary(admin_conn, name="Open", deadline_offset_days=30)
    expired_id = seed_bursary(admin_conn, name="Expired", deadline_offset_days=-10)
    token, _ = student_with_profile(match_client)
    match_client.post(RUN, headers=bearer(token))
    items = match_client.get(MINE, headers=bearer(token)).json()["items"]
    matched_ids = {m["bursary"]["id"] for m in items}
    assert open_id in matched_ids
    assert expired_id not in matched_ids  # BR-M03: expired deadlines produce no new match


def test_matches_never_filter_the_browse_all_path_br_m02(match_client, admin_conn):
    expired_id = seed_bursary(admin_conn, name="Closed window", deadline_offset_days=-5)
    token, _ = student_with_profile(match_client)
    match_client.post(RUN, headers=bearer(token))
    browsed = {b["id"] for b in match_client.get(BROWSE, headers=bearer(token)).json()["items"]}
    assert expired_id in browsed  # browse shows ALL bursaries, even unmatched ones (equal class)


def test_run_requires_a_profile(match_client, admin_conn):
    import uuid

    seed_bursary(admin_conn)
    reg = match_client.post(
        f"{BASE}/auth/register",
        json={"email": f"noprof_{uuid.uuid4().hex}@learner.fundslink.io",
              "password": "Str0ng!Passw0rd",
              "consents": [{"purpose": "TERMS_OF_SERVICE", "wording_version": "v1"}]},
    )
    token = reg.json()["access_token"]
    match_client.cookies.clear()
    assert match_client.post(RUN, headers=bearer(token)).status_code == 409


def test_daily_quota_is_enforced_st_2_6(match_client, admin_conn, monkeypatch):
    async def _quota_one(self, key, default):  # noqa: ANN001
        return 1

    monkeypatch.setattr("app.modules.matching.repository.ConfigRepository.get_int", _quota_one)
    seed_bursary(admin_conn)
    token, _ = student_with_profile(match_client)
    assert match_client.post(RUN, headers=bearer(token)).status_code == 200
    rate_limited = match_client.post(RUN, headers=bearer(token))
    assert rate_limited.status_code == 429
    assert rate_limited.headers.get("Retry-After")


def test_falls_back_when_spend_budget_is_exhausted_s8_51(match_client, admin_conn, monkeypatch):
    async def _no_budget(self, *, max_calls):  # noqa: ANN001
        return False

    monkeypatch.setattr("app.modules.matching.spend.MatchSpendBreaker.allow_live", _no_budget)
    seed_bursary(admin_conn, tags=("computer", "science"))
    token, _ = student_with_profile(match_client, field="Computer Science")
    match_client.post(RUN, headers=bearer(token))
    items = match_client.get(MINE, headers=bearer(token)).json()["items"]
    assert items and all(m["mode"] == "FALLBACK" for m in items)  # advisory fallback, not an error


def test_matches_are_isolated_per_user_st_2_3(match_client, admin_conn):
    seed_bursary(admin_conn)
    a_token, _ = student_with_profile(match_client)
    b_token, _ = student_with_profile(match_client)
    match_client.post(RUN, headers=bearer(a_token))
    assert match_client.get(MINE, headers=bearer(b_token)).json()["items"] == []  # B sees nothing


def test_browse_filters_by_level_and_field(match_client, admin_conn):
    seed_bursary(admin_conn, name="UG Tech", levels=("UG",), tags=("computer",))
    seed_bursary(admin_conn, name="PhD Bio", levels=("PHD",), tags=("biology",))
    token, _ = student_with_profile(match_client)
    ug = match_client.get(f"{BROWSE}?level=UG", headers=bearer(token)).json()["items"]
    ug_names = {b["name"] for b in ug}
    assert "UG Tech" in ug_names  # robust to bursaries other tests committed
    assert "PhD Bio" not in ug_names  # the PHD-only bursary is filtered out by level=UG
