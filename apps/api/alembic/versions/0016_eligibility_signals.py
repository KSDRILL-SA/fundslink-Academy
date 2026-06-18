"""0016 — eligibility signals (D-016 / D-017): NSFAS-eligibility + income + prior-funder.

Adds three reference lookups (income band, NSFAS decline reason, prior funder) and four
self-declared columns on funding_application. These are signals the Pre-Screening Engine only
ANNOTATES — a human decides (MASTER-SPEC §5.7, D-010); we do not build a means-test (§1.7). The
Rand thresholds live in config / the versioned ruleset, never in the schema (DB-D24). New lookups
are read-only to fundslink_app (0014 least-privilege pattern). Additive (DB-D36).

Revision ID: 0016
Revises: 0015
"""

from pathlib import Path

from alembic import op

revision = "0016"
down_revision = "0015"
branch_labels = None
depends_on = None

_SQL_DIR = Path(__file__).parent / "sql"


def _run(filename: str) -> None:
    sql = (_SQL_DIR / filename).read_text(encoding="utf-8")
    op.get_bind().connection.driver_connection.execute(sql)


def upgrade() -> None:
    _run("0016_eligibility_signals.sql")


def downgrade() -> None:
    _run("0016_eligibility_signals_down.sql")
