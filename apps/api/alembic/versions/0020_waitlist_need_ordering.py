"""0020 — the waitlist is ordered by need, not by arrival (E4 · D-017).

0019 ordered APPROVED_WAITLISTED by the time each student was waitlisted. E4 requires
postgraduate priority then need-severity ordering, and §4.1 floats SASSA / <= R350k applicants
to the top. The seeded ``lk_income_band.rank`` exists for exactly this and nothing read it.

Additive: the function signature, security posture and grant are unchanged (DB-D36). Only the
ordering changes. Downgrade restores the 0019 definition rather than dropping the function,
because the S16-WAIT screen depends on it existing.

Revision ID: 0020
Revises: 0019
"""

from pathlib import Path

from alembic import op

revision = "0020"
down_revision = "0019"
branch_labels = None
depends_on = None

_SQL_DIR = Path(__file__).parent / "sql"


def _run(filename: str) -> None:
    sql = (_SQL_DIR / filename).read_text(encoding="utf-8")
    op.get_bind().connection.driver_connection.execute(sql)


def upgrade() -> None:
    _run("0020_waitlist_need_ordering.sql")


def downgrade() -> None:
    _run("0019_waitlist_position.sql")
