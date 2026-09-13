"""0022 — return reminders: a new notification trigger and the return windows as config (#298).

D-006 says a RETURNED_FOR_INFO application is reminded, never punished. Nothing reminded anyone, and
the respond window was a literal in code. Additive (DB-D36).

Revision ID: 0022
Revises: 0021
"""

from pathlib import Path

from alembic import op

revision = "0022"
down_revision = "0021"
branch_labels = None
depends_on = None

_SQL_DIR = Path(__file__).parent / "sql"


def _run(filename: str) -> None:
    sql = (_SQL_DIR / filename).read_text(encoding="utf-8")
    op.get_bind().connection.driver_connection.execute(sql)


def upgrade() -> None:
    _run("0022_return_reminders.sql")


def downgrade() -> None:
    _run("0022_return_reminders_down.sql")
