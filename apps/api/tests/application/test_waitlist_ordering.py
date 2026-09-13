"""The waitlist is ordered by need, not by arrival — E4 · D-017 · §4.1 (#284).

MASTER-SPEC E4: an approval-worthy student beyond pool capacity enters APPROVED_WAITLISTED with
"transparent position, **postgraduate priority per §3, need-severity ordering**". §4.1: SASSA and
<= R350k applicants "are floated to the top of any capacity-limited pool".

0019 ordered the waitlist by arrival. That gave a student in the greatest need a worse place than
a comfortable one who happened to wait longer, and showed them that number. These tests pin the
order the spec actually states.

Every assertion is RELATIVE — "A stands ahead of B" — never an absolute position. The waitlist is
global and this suite shares one database with every other suite, so an absolute position would
pass or fail by whatever other tests left waitlisted, which is a test that cannot catch a
regression (the lesson of #263).
"""

from __future__ import annotations

from tests.application.conftest import (
    create_application,
    force_status,
    student_with_profile,
)


def waitlist(client, conn, *, application_type: str, band: str | None) -> str:
    """One waitlisted application, for its own student (D-004: one active application a year).

    Type and band are set directly: this suite tests the ORDERING, and the eligibility rules that
    would refuse, say, a GT_600K postgraduate are covered by the eligibility suite. Coupling the
    two would make an ordering test fail for an eligibility reason.
    """
    token, _uid = student_with_profile(client)
    app_id = create_application(client, token)["id"]
    conn.execute(
        "UPDATE funding_application SET application_type = %s, household_income_band = %s"
        " WHERE id = %s",
        (application_type, band, app_id),
    )
    force_status(conn, app_id, "APPROVED_WAITLISTED")
    return app_id


def position(conn, app_id: str) -> int:
    return conn.execute("SELECT fn_waitlist_position(%s)", (app_id,)).fetchone()[0]


def test_postgraduate_stands_ahead_of_undergraduate_even_when_the_undergraduate_waited_longer(
    app_client, admin_conn
):
    # The undergraduate is waitlisted FIRST and declares GREATER need. Postgraduate priority is
    # the first key in E4, so it must still win. This is the case FIFO got backwards.
    undergrad = waitlist(app_client, admin_conn, application_type="UG_CAT_C", band="SASSA_GRANT")
    postgrad = waitlist(app_client, admin_conn, application_type="POSTGRAD", band="LTE_350K")

    assert position(admin_conn, postgrad) < position(admin_conn, undergrad)


def test_within_a_level_the_greatest_need_is_floated_to_the_top(app_client, admin_conn):
    # Waitlisted in REVERSE need order, so arrival and need disagree at every step — FIFO would
    # order these exactly backwards.
    comfortable = waitlist(app_client, admin_conn, application_type="POSTGRAD", band="GT_600K")
    middle = waitlist(
        app_client, admin_conn, application_type="POSTGRAD", band="MISSING_MIDDLE_350_600K"
    )
    low = waitlist(app_client, admin_conn, application_type="POSTGRAD", band="LTE_350K")
    sassa = waitlist(app_client, admin_conn, application_type="POSTGRAD", band="SASSA_GRANT")

    positions = [position(admin_conn, a) for a in (sassa, low, middle, comfortable)]

    assert positions == sorted(positions), (
        f"need order violated: SASSA, <=350k, 350-600k, >600k got {positions}"
    )


def test_declining_to_say_sorts_after_every_declared_band_but_is_not_dropped(
    app_client, admin_conn
):
    # PREFER_NOT_TO_SAY is seeded at rank 9 (0016): need-severity ordering can only float up a need
    # that is known. Skipping the optional question entirely (NULL) is treated the same way — the
    # form says "this is not a test you can fail", so not answering is not punished below "no".
    prefer_not = waitlist(
        app_client, admin_conn, application_type="POSTGRAD", band="PREFER_NOT_TO_SAY"
    )
    unanswered = waitlist(app_client, admin_conn, application_type="POSTGRAD", band=None)
    declared = waitlist(app_client, admin_conn, application_type="POSTGRAD", band="GT_600K")

    assert position(admin_conn, declared) < position(admin_conn, prefer_not)
    assert position(admin_conn, declared) < position(admin_conn, unanswered)
    # Still on the waitlist, still told a place — "never silently rejected" (E4).
    assert position(admin_conn, prefer_not) is not None
    assert position(admin_conn, unanswered) is not None


def test_among_equals_the_earlier_waitlisted_student_stands_first(app_client, admin_conn):
    first = waitlist(app_client, admin_conn, application_type="POSTGRAD", band="SASSA_GRANT")
    second = waitlist(app_client, admin_conn, application_type="POSTGRAD", band="SASSA_GRANT")

    assert position(admin_conn, first) < position(admin_conn, second)


def test_no_two_waitlisted_students_share_a_position(app_client, admin_conn):
    # Identical level, need and — very likely — the same timestamp to the millisecond. The id
    # tiebreak must still give each a distinct place, or two students are told the same number.
    apps = [
        waitlist(app_client, admin_conn, application_type="UG_CAT_A", band="LTE_350K")
        for _ in range(4)
    ]
    positions = [position(admin_conn, a) for a in apps]

    assert len(set(positions)) == len(positions), f"shared positions: {positions}"


def test_a_position_is_stable_between_two_reads(app_client, admin_conn):
    app_id = waitlist(app_client, admin_conn, application_type="POSTGRAD", band="LTE_350K")

    assert position(admin_conn, app_id) == position(admin_conn, app_id)


def test_an_application_that_is_not_waitlisted_has_no_position(app_client, admin_conn):
    token, _uid = student_with_profile(app_client)
    app_id = create_application(app_client, token)["id"]

    assert position(admin_conn, app_id) is None
