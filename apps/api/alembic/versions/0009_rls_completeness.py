"""0009 — RLS completeness: motivation, pre-screen, returns, appeals, theme tags, recusal, audit.

Founder-directed final security pass. Extends 0007 so every remaining student-data /
sensitive table is RLS-protected. Auth tables are a Stage 02 contract. Additive (DB-D36).

Revision ID: 0009
Revises: 0008
"""

from pathlib import Path

from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None

_SQL_DIR = Path(__file__).parent / "sql"


def _run(filename: str) -> None:
    sql = (_SQL_DIR / filename).read_text(encoding="utf-8")
    op.get_bind().connection.driver_connection.execute(sql)


def upgrade() -> None:
    _run("0009_rls_completeness.sql")


def downgrade() -> None:
    _run("0009_rls_completeness_down.sql")
