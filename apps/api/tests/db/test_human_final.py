"""Human-Final Principle (fn_human_final) — BR-E03 / MASTER-SPEC §5.8 / DB-D21 Patch 5.

The SYSTEM (non-human) principal can NEVER drive an application to a final decision.
The DB trigger refuses it; a human actor is accepted. Non-decision transitions by SYSTEM
are *not* blocked by this trigger (it guards only APPROVED/REJECTED/REJECTED_FINAL).
"""

import psycopg
import pytest

from tests.db import helpers

DECISION_STATES = ["APPROVED", "REJECTED", "REJECTED_FINAL"]


@pytest.mark.parametrize("to_status", DECISION_STATES)
def test_system_principal_cannot_decide(conn, to_status):
    # 'SYSTEM' actor: the BEFORE trigger fires before the FK check and rejects it.
    aid = helpers.insert_application(conn)
    with pytest.raises(psycopg.errors.RaiseException):
        with conn.transaction():
            helpers.insert_status_event(
                conn, application_id=aid, actor_user_id="SYSTEM", to_status=to_status
            )


@pytest.mark.parametrize("to_status", DECISION_STATES)
def test_human_actor_may_decide(conn, to_status):
    aid = helpers.insert_application(conn)
    human = helpers.insert_user(conn)
    # No exception: a human actor is permitted to reach a final decision.
    helpers.insert_status_event(
        conn, application_id=aid, actor_user_id=human, to_status=to_status
    )
    row = conn.execute(
        "SELECT to_status FROM application_status_event WHERE application_id = %s", (aid,)
    ).fetchone()
    assert row[0] == to_status


def test_system_principal_may_make_non_decision_transition(conn):
    # SYSTEM exists as a real principal for non-decision moves; the guard does not bite.
    aid = helpers.insert_application(conn)
    system = helpers.insert_user(conn, user_id="SYSTEM", email="system@fundslink.test")
    helpers.insert_status_event(
        conn, application_id=aid, actor_user_id=system, to_status="PRE_SCREENING"
    )
    row = conn.execute(
        "SELECT to_status FROM application_status_event WHERE application_id = %s", (aid,)
    ).fetchone()
    assert row[0] == "PRE_SCREENING"
