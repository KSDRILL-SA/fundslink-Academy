"""0002 — reference / seed data (idempotent).

Lookups, RBAC matrix (TAD §3.4), both transition tables, config (DB-D24), and the
v1 eligibility rulesets (BR-E02). Idempotent via ON CONFLICT DO NOTHING — re-running
``alembic upgrade`` is a no-op (stage 01 task 2).

Revision ID: 0002
Revises: 0001
"""

from pathlib import Path

from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

_SQL_DIR = Path(__file__).parent / "sql"


def _run(filename: str) -> None:
    sql = (_SQL_DIR / filename).read_text(encoding="utf-8")
    op.get_bind().connection.driver_connection.execute(sql)


def upgrade() -> None:
    _run("0002_seeds.sql")


def downgrade() -> None:
    _run("0002_unseed.sql")
