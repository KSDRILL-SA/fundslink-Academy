"""State-machine transition tables as the rejection oracle — BR-S04 / BR-T04.

Illegal transitions are rejected by the service layer (Stage 03) consulting these
data-driven tables; at the DB layer the guarantee is that the *allowed* set is exactly
right — legal moves present, illegal moves absent. (No DB trigger enforces moves here,
by design — DB-D21: triggers enforce physics, not workflow.)
"""

import pytest


def _exists(conn, table, frm, to) -> bool:
    row = conn.execute(
        f"SELECT 1 FROM {table} WHERE from_status = %s AND to_status = %s", (frm, to)
    ).fetchone()
    return row is not None


LEGAL_APP = [
    ("DRAFT", "SUBMITTED"),
    ("SUBMITTED", "PRE_SCREENING"),
    ("PRE_SCREENING", "READY_FOR_REVIEW"),
    ("PRE_SCREENING", "RETURNED_FOR_INFO"),
    ("RETURNED_FOR_INFO", "RESUBMITTED"),
    ("READY_FOR_REVIEW", "UNDER_REVIEW"),
    ("UNDER_REVIEW", "APPROVED_PROPOSED"),
    ("APPROVED_PROPOSED", "APPROVED"),
    ("REJECTED", "APPEALED"),
    ("APPEALED", "REJECTED_FINAL"),
    ("SUBMITTED", "WITHDRAWN"),
    # 0004 post-approval lifecycle (money safety)
    ("APPROVED", "SUSPENDED"),
    ("APPROVED", "REVOKED"),
    ("APPROVED", "COMPLETED"),
    ("SUSPENDED", "APPROVED"),
]

ILLEGAL_APP = [
    ("DRAFT", "APPROVED"),
    ("SUBMITTED", "APPROVED"),
    ("DRAFT", "UNDER_REVIEW"),
    ("REJECTED_FINAL", "APPROVED"),
    ("APPROVED", "DRAFT"),
    ("WITHDRAWN", "SUBMITTED"),
]

LEGAL_TRACKED = [
    ("REGISTERED", "SUBMITTED"),
    ("SUBMITTED", "UNDER_REVIEW"),
    ("UNDER_REVIEW", "SHORTLISTED"),
    ("SHORTLISTED", "INTERVIEW"),
    ("INTERVIEW", "APPROVED"),
    ("INTERVIEW", "REJECTED"),
    ("UNDER_REVIEW", "NO_RESPONSE"),
    ("SHORTLISTED", "WITHDRAWN"),
]

ILLEGAL_TRACKED = [
    ("REGISTERED", "APPROVED"),
    ("APPROVED", "REGISTERED"),
    ("REGISTERED", "INTERVIEW"),
    ("REJECTED", "APPROVED"),
]


@pytest.mark.parametrize("frm, to", LEGAL_APP)
def test_app_legal_transitions_present(conn, frm, to):
    assert _exists(conn, "app_status_transition", frm, to)


@pytest.mark.parametrize("frm, to", ILLEGAL_APP)
def test_app_illegal_transitions_absent(conn, frm, to):
    assert not _exists(conn, "app_status_transition", frm, to)


@pytest.mark.parametrize("frm, to", LEGAL_TRACKED)
def test_tracked_legal_transitions_present(conn, frm, to):
    assert _exists(conn, "tracked_status_transition", frm, to)


@pytest.mark.parametrize("frm, to", ILLEGAL_TRACKED)
def test_tracked_illegal_transitions_absent(conn, frm, to):
    assert not _exists(conn, "tracked_status_transition", frm, to)
