"""0023 — the last hardcoded business values become config (#311).

BR-E04's outreach cycle and BR-T05/BR-T06's tracking cadences were literals in Python, against
CLAUDE.md's standing rule that business values live in the config table (DB-D24). Same values,
additive (DB-D36).

Revision ID: 0023
Revises: 0022
"""

from pathlib import Path

from alembic import op

revision = "0023"
down_revision = "0022"
branch_labels = None
depends_on = None

_SQL_DIR = Path(__file__).parent / "sql"


def _run(filename: str) -> None:
    sql = (_SQL_DIR / filename).read_text(encoding="utf-8")
    op.get_bind().connection.driver_connection.execute(sql)


def upgrade() -> None:
    _run("0023_business_values_as_config.sql")


def downgrade() -> None:
    _run("0023_business_values_as_config_down.sql")
