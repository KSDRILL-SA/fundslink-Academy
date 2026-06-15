"""0015 — matching config (DB-D24): spend cost-per-call + per-user daily quota.

The matching daily budget (matching_daily_budget_zar) is already seeded (0002). This adds the two
remaining config-as-data values the spend circuit breaker + per-user quota read — no hardcoded
business values (DB-D24). The ZAR budget stays in PostgreSQL config; Redis only ever counts calls
(S5.3 — no money value in Redis). Additive (DB-D36).

Revision ID: 0015
Revises: 0014
"""

from pathlib import Path

from alembic import op

revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None

_SQL_DIR = Path(__file__).parent / "sql"


def _run(filename: str) -> None:
    sql = (_SQL_DIR / filename).read_text(encoding="utf-8")
    op.get_bind().connection.driver_connection.execute(sql)


def upgrade() -> None:
    _run("0015_matching_config.sql")


def downgrade() -> None:
    _run("0015_matching_config_down.sql")
