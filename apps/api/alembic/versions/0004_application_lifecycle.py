"""0004 — application lifecycle: priority, post-approval states, doc validity, language.

Founder-approved (L4, 2026-06-14) outcome of the student-journey review. Additive (DB-D36).

Revision ID: 0004
Revises: 0003
"""

from pathlib import Path

from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None

_SQL_DIR = Path(__file__).parent / "sql"


def _run(filename: str) -> None:
    sql = (_SQL_DIR / filename).read_text(encoding="utf-8")
    op.get_bind().connection.driver_connection.execute(sql)


def upgrade() -> None:
    _run("0004_application_lifecycle.sql")


def downgrade() -> None:
    _run("0004_downgrade.sql")
