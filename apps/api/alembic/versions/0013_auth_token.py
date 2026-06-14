"""0013 — auth_token (email-verify + password-reset single-use tokens). Stage 02, C3.

Backs email verification (S3.12) and password reset (S3.30): SHA-256-hashed, expiring,
single-use tokens with RLS (SYSTEM-context redemption path, D-015). Additive (DB-D36).

Revision ID: 0013
Revises: 0012
"""

from pathlib import Path

from alembic import op

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None

_SQL_DIR = Path(__file__).parent / "sql"


def _run(filename: str) -> None:
    sql = (_SQL_DIR / filename).read_text(encoding="utf-8")
    op.get_bind().connection.driver_connection.execute(sql)


def upgrade() -> None:
    _run("0013_auth_token.sql")


def downgrade() -> None:
    _run("0013_auth_token_down.sql")
