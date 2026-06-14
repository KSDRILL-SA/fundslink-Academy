"""0012 — MFA (TOTP) state on user (Stage 02, C3 · TAD §3.1).

Adds mfa_enabled (activation flag) and mfa_recovery_enc (encrypted recovery codes) backing
TOTP MFA for privileged roles. Additive only; locked migrations untouched (DB-D36).

Revision ID: 0012
Revises: 0011
"""

from pathlib import Path

from alembic import op

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None

_SQL_DIR = Path(__file__).parent / "sql"


def _run(filename: str) -> None:
    sql = (_SQL_DIR / filename).read_text(encoding="utf-8")
    op.get_bind().connection.driver_connection.execute(sql)


def upgrade() -> None:
    _run("0012_mfa.sql")


def downgrade() -> None:
    _run("0012_mfa_down.sql")
