"""Theme tags on OTHER-category cases — MASTER-SPEC §5.6 · D-018 (completeness audit G5, #317).

`lk_theme_tag` and `motivation_theme_tag` have existed since migration 0001, with RLS policies
added in 0009, and nothing read or wrote either of them. §5.6 promises that "every OTHER decision
records a theme tag assigned by the reviewer. Quarterly, theme clusters are reported to the
Founder: recurring themes become candidate NEW official categories." With no tag ever recorded,
that report had no data — so an edge case could be seen by a hundred reviewers and still never
become a category.

These tests drive the whole loop: a reviewer tags, the next reviewer sees it, the quarterly
report counts it, and the student is never shown any of it.
"""

from __future__ import annotations

from tests.application.conftest import (
    BASE,
    bearer,
    create_application,
    force_status,
    make_authorizer,
    make_reviewer,
    student_with_profile,
)

MOTIVATION = {
    "situation": "My bursary was withdrawn after the provider closed its South African office.",
    "why_not_categories": "I was never with NSFAS, and this is not an institutional debt.",
    "support_needed": "R22 000 in outstanding fees so I can register for my final year.",
    "language": "en",
}


def other_application(client, admin_conn) -> tuple[str, str]:
    """An OTHER-category application with a motivation — the only kind a theme describes."""
    token, _uid = student_with_profile(client)
    app_id = create_application(client, token, application_type="OTHER", motivation=MOTIVATION)[
        "id"
    ]
    force_status(admin_conn, app_id, "READY_FOR_REVIEW")
    return app_id, token


def tag(client, token, app_id, tags):
    return client.post(
        f"{BASE}/admin/applications/{app_id}/themes", headers=bearer(token), json={"tags": tags}
    )


def clusters(client, token, **params):
    return client.get(f"{BASE}/admin/themes", headers=bearer(token), params=params)


def test_a_reviewer_records_what_this_case_was_actually_about(app_client, admin_conn):
    app_id, _student = other_application(app_client, admin_conn)
    token, reviewer = make_reviewer(app_client, admin_conn)

    resp = tag(app_client, token, app_id, ["FINANCIAL_GAP", "INSTITUTIONAL"])
    assert resp.status_code == 200, resp.text
    assert resp.json()["theme_tags"] == ["FINANCIAL_GAP", "INSTITUTIONAL"]

    rows = admin_conn.execute(
        "SELECT t.tag, t.tagged_by FROM motivation_theme_tag t"
        " JOIN application_motivation m ON m.id = t.motivation_id"
        " WHERE m.application_id = %s ORDER BY t.tag",
        (app_id,),
    ).fetchall()
    assert rows == [("FINANCIAL_GAP", reviewer), ("INSTITUTIONAL", reviewer)]

    detail = admin_conn.execute(
        "SELECT detail FROM audit_log WHERE action = 'APPLICATION_THEMED' AND resource_id = %s",
        (app_id,),
    ).fetchone()[0]
    assert detail == {"tags": ["FINANCIAL_GAP", "INSTITUTIONAL"]}


def test_the_next_reviewer_sees_what_the_last_one_concluded(app_client, admin_conn):
    """The point of writing it down. A tag only the writer can see is a private note."""
    app_id, _student = other_application(app_client, admin_conn)
    first, _ = make_reviewer(app_client, admin_conn)
    assert tag(app_client, first, app_id, ["FAMILY_CRISIS"]).status_code == 200

    second, _ = make_reviewer(app_client, admin_conn)
    read = app_client.get(f"{BASE}/admin/applications/{app_id}", headers=bearer(second))
    assert read.json()["theme_tags"] == ["FAMILY_CRISIS"]


def test_adding_a_second_theme_keeps_the_first(app_client, admin_conn):
    """Added, never replaced — a reviewer recording a second theme must not have to remember the
    first, and re-sending one the case already carries is a no-op rather than a 409."""
    app_id, _student = other_application(app_client, admin_conn)
    token, _reviewer = make_reviewer(app_client, admin_conn)

    tag(app_client, token, app_id, ["HEALTH"])
    both = tag(app_client, token, app_id, ["HEALTH", "DOCUMENTATION"])
    assert both.status_code == 200, both.text
    assert both.json()["theme_tags"] == ["DOCUMENTATION", "HEALTH"]

    # And the row count is two, not three — the repeat did not duplicate.
    count = admin_conn.execute(
        "SELECT count(*) FROM motivation_theme_tag t"
        " JOIN application_motivation m ON m.id = t.motivation_id WHERE m.application_id = %s",
        (app_id,),
    ).fetchone()[0]
    assert count == 2


def test_a_student_is_never_shown_the_theme_put_on_their_case(app_client, admin_conn):
    """A theme is the reviewer's characterisation of someone's circumstances, written for a
    quarterly count. It is staff-only by RLS and absent from the student's own read."""
    app_id, student_token = other_application(app_client, admin_conn)
    token, _reviewer = make_reviewer(app_client, admin_conn)
    tag(app_client, token, app_id, ["FAMILY_CRISIS"])

    mine = app_client.get(f"{BASE}/applications/{app_id}", headers=bearer(student_token))
    assert mine.status_code == 200
    assert mine.json().get("theme_tags") is None
    assert "FAMILY_CRISIS" not in mine.text


def test_only_a_case_with_a_motivation_can_be_themed(app_client, admin_conn):
    """A theme describes what the applicant wrote. A tag on a categorised application would
    pollute the one report whose purpose is finding what the categories miss."""
    token, _uid = student_with_profile(app_client)
    app_id = create_application(app_client, token)["id"]  # UG_CAT_C — no motivation
    force_status(admin_conn, app_id, "READY_FOR_REVIEW")
    reviewer, _ = make_reviewer(app_client, admin_conn)

    refused = tag(app_client, reviewer, app_id, ["FINANCIAL_GAP"])
    assert refused.status_code == 409
    assert refused.json()["error"]["code"] == "motivation_required"

    # Negative control: the same reviewer, the same tag, on a case that does have a motivation.
    other_id, _student = other_application(app_client, admin_conn)
    assert tag(app_client, reviewer, other_id, ["FINANCIAL_GAP"]).status_code == 200


def test_the_theme_list_is_the_seeded_one_and_nothing_else(app_client, admin_conn):
    """lk_theme_tag is a foreign key. The API must refuse an unknown theme before the database
    has to, and a short vocabulary is the point: if every case can invent its own theme, nothing
    ever recurs and §5.6 promotes nothing."""
    app_id, _student = other_application(app_client, admin_conn)
    token, _reviewer = make_reviewer(app_client, admin_conn)

    assert tag(app_client, token, app_id, ["EXAM_STRESS"]).status_code == 422
    assert tag(app_client, token, app_id, []).status_code == 422
    assert app_client.get(
        f"{BASE}/admin/applications/{app_id}", headers=bearer(token)
    ).json()["theme_tags"] == []

    for theme in (
        "FINANCIAL_GAP",
        "FAMILY_CRISIS",
        "HEALTH",
        "DOCUMENTATION",
        "INSTITUTIONAL",
        "OTHER",
    ):
        assert tag(app_client, token, app_id, [theme]).status_code == 200, theme


def test_a_recused_reviewer_cannot_characterise_the_case_either(app_client, admin_conn):
    """BR-E09. Someone who stepped aside because they know the applicant does not get to write
    down what that applicant's situation was about."""
    app_id, _student = other_application(app_client, admin_conn)
    token, _reviewer = make_reviewer(app_client, admin_conn)
    assert app_client.post(
        f"{BASE}/admin/applications/{app_id}/recusal",
        headers=bearer(token),
        json={"reason": "The applicant is my cousin's daughter; I know the family well."},
    ).status_code == 201

    refused = tag(app_client, token, app_id, ["FAMILY_CRISIS"])
    assert refused.status_code == 403
    assert refused.json()["error"]["code"] == "reviewer_recused"


def test_only_staff_can_tag_or_read_the_clusters(app_client, admin_conn):
    app_id, student_token = other_application(app_client, admin_conn)
    assert tag(app_client, student_token, app_id, ["HEALTH"]).status_code == 403
    assert clusters(app_client, student_token).status_code == 403

    # An authorizer holds APPLICATION_READ_ANY but not APPLICATION_REVIEW: they may read the
    # report that informs a category decision, and may not characterise a case themselves.
    auth_token, _ = make_authorizer(app_client, admin_conn)
    assert clusters(app_client, auth_token).status_code == 200
    assert tag(app_client, auth_token, app_id, ["HEALTH"]).status_code == 403


def test_the_quarterly_report_counts_cases_not_tags(app_client, admin_conn):
    """§5.6's report exists to spot a recurring edge. One thorough reviewer putting three themes
    on one case must not look like three cases."""
    token, _reviewer = make_reviewer(app_client, admin_conn)
    before = clusters(app_client, token).json()
    baseline = {row["tag"]: row["applications"] for row in before["themes"]}
    assert before["window_days"] == 90  # a quarter, the cadence §5.6 names

    thorough, _ = other_application(app_client, admin_conn)
    tag(app_client, token, thorough, ["FINANCIAL_GAP", "HEALTH", "INSTITUTIONAL"])
    plain, _ = other_application(app_client, admin_conn)
    tag(app_client, token, plain, ["FINANCIAL_GAP"])

    after = clusters(app_client, token).json()
    counts = {row["tag"]: row["applications"] for row in after["themes"]}
    assert counts["FINANCIAL_GAP"] == baseline.get("FINANCIAL_GAP", 0) + 2
    assert counts["HEALTH"] == baseline.get("HEALTH", 0) + 1
    assert after["tagged_applications"] == before["tagged_applications"] + 2

    # Most frequent first, so the report reads as the answer to "what keeps coming up".
    applications = [row["applications"] for row in after["themes"]]
    assert applications == sorted(applications, reverse=True)


def test_the_report_window_is_a_window(app_client, admin_conn):
    """A cluster is only meaningful over a period. A tag older than the window is not in it.

    Counted as a delta against a baseline rather than an absolute: the suite shares one database,
    other tests record themes too, and a test that only passes when it runs first is not a test.
    """
    token, _reviewer = make_reviewer(app_client, admin_conn)

    def documented(window: int) -> int:
        body = clusters(app_client, token, window_days=window).json()
        return next(
            (row["applications"] for row in body["themes"] if row["tag"] == "DOCUMENTATION"), 0
        )

    before_30 = documented(30)
    before_365 = documented(365)

    app_id, _student = other_application(app_client, admin_conn)
    tag(app_client, token, app_id, ["DOCUMENTATION"])
    assert documented(30) == before_30 + 1

    # Age this case's tag past the narrow window, leaving every other tag where it was.
    admin_conn.execute(
        "UPDATE motivation_theme_tag SET created_at = now() - interval '200 days'"
        " WHERE motivation_id = (SELECT id FROM application_motivation WHERE application_id = %s)",
        (app_id,),
    )
    assert documented(30) == before_30  # out of the quarter's view
    assert documented(365) == before_365 + 1  # still there when the window reaches it

    assert clusters(app_client, token, window_days=0).status_code == 422
