"""0003 — Stage 01 review hardening: perf indexes, APPROVED-dup block, CHECKs, default partitions.

Founder-approved (L4, 2026-06-14) outcome of the adversarial database review. Additive
(DB-D36): performance indexes (DB-D28/D40), one-funded-application-per-year tightening
(ERD §14.6 E1), domain CHECKs (DB-D9), and DEFAULT partitions as write-path safety nets.

Revision ID: 0003
Revises: 0002
"""

from pathlib import Path

from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None

_SQL_DIR = Path(__file__).parent / "sql"


def _run(filename: str) -> None:
    sql = (_SQL_DIR / filename).read_text(encoding="utf-8")
    op.get_bind().connection.driver_connection.execute(sql)


def upgrade() -> None:
    _run("0003_hardening.sql")


def downgrade() -> None:
    _run("0003_unharden.sql")
