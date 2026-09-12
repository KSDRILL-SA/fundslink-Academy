"""0019 — fn_waitlist_position: a waitlisted student can be told where they stand (E4, #220).

S16-WAIT's promise is a live position, and a position is a fact about other people's
applications. Under the student's own RLS context the count is always 1, so the honest screen
would print a comfortable lie. A SECURITY DEFINER function reads what it must and returns a
single integer — no row, no name, no amount ever crosses the boundary.

Additive: no table, column or policy changes (DB-D36). Downgrade drops the function.

Revision ID: 0019
Revises: 0018
"""

from pathlib import Path

from alembic import op

revision = "0019"
down_revision = "0018"
branch_labels = None
depends_on = None

_SQL_DIR = Path(__file__).parent / "sql"


def _run(filename: str) -> None:
    sql = (_SQL_DIR / filename).read_text(encoding="utf-8")
    op.get_bind().connection.driver_connection.execute(sql)


def upgrade() -> None:
    _run("0019_waitlist_position.sql")


def downgrade() -> None:
    op.get_bind().connection.driver_connection.execute(
        "DROP FUNCTION IF EXISTS fn_waitlist_position(text);"
    )
