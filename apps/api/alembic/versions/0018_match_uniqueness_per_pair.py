"""0018 — one match per (student, bursary): uq_match drops model_version.

A LIVE/FALLBACK mode flip uses a different model_version; with model_version in the uq_match key
that produced a *second* match row for the same student+bursary, so GET /matches/me could show a
duplicate bursary (Stage 03 review LOW-1). Dropping model_version from the key makes a re-run
refresh the existing row instead. mode/model_version become updatable attributes. Additive (DB-D36).

Revision ID: 0018
Revises: 0017
"""

from pathlib import Path

from alembic import op

revision = "0018"
down_revision = "0017"
branch_labels = None
depends_on = None

_SQL_DIR = Path(__file__).parent / "sql"


def _run(filename: str) -> None:
    sql = (_SQL_DIR / filename).read_text(encoding="utf-8")
    op.get_bind().connection.driver_connection.execute(sql)


def upgrade() -> None:
    _run("0018_match_uniqueness_per_pair.sql")


def downgrade() -> None:
    _run("0018_match_uniqueness_per_pair_down.sql")
