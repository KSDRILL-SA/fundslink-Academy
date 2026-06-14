"""0011 — token_version (session epoch) on user (Stage 02, C3).

Adds the column backing the access-token `version` claim (S3.13) and DB-authoritative global
invalidation (S3.35). Additive only; locked migrations untouched (DB-D36).

Revision ID: 0011
Revises: 0010
"""

from pathlib import Path

from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None

_SQL_DIR = Path(__file__).parent / "sql"


def _run(filename: str) -> None:
    sql = (_SQL_DIR / filename).read_text(encoding="utf-8")
    op.get_bind().connection.driver_connection.execute(sql)


def upgrade() -> None:
    _run("0011_token_version.sql")


def downgrade() -> None:
    _run("0011_token_version_down.sql")
