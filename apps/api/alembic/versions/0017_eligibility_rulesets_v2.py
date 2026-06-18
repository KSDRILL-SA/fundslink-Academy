"""0017 — eligibility rulesets v2 (config-as-data, BR-E02 / §5.7): D-016 + D-017.

Adds version-2 rulesets for UG_CAT_C and POSTGRAD that introduce `field_flag` annotation checks
(income band, NSFAS decline reason, prior funder) and — for postgrad — a required PROOF_OF_INCOME.
New versions, effective now; v1 is preserved for history and pinned in-flight applications (§5.7).
Every flag is severity "review_flag" → the engine annotates, a human decides (D-010). Additive
(DB-D36); the Rand thresholds are bands (DB-D24), not numbers in code.

Revision ID: 0017
Revises: 0016
"""

from pathlib import Path

from alembic import op

revision = "0017"
down_revision = "0016"
branch_labels = None
depends_on = None

_SQL_DIR = Path(__file__).parent / "sql"


def _run(filename: str) -> None:
    sql = (_SQL_DIR / filename).read_text(encoding="utf-8")
    op.get_bind().connection.driver_connection.execute(sql)


def upgrade() -> None:
    _run("0017_eligibility_rulesets_v2.sql")


def downgrade() -> None:
    _run("0017_eligibility_rulesets_v2_down.sql")
