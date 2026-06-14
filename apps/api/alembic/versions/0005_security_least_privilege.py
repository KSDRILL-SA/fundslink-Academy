"""0005 — security: least-privilege application role (DB-D30) + trigger search_path hardening.

Founder-approved (L4, 2026-06-14). Closes the proven append-only tamper gap: with no
non-owner role the app could disable a guard trigger and rewrite audit history. The role is
created NOLOGIN so no secret enters the migration; production provisions login + password
from a secret manager (see docs/operations/security-deployment-checklist.md).

Revision ID: 0005
Revises: 0004
"""

from pathlib import Path

from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None

_SQL_DIR = Path(__file__).parent / "sql"


def _run(filename: str) -> None:
    sql = (_SQL_DIR / filename).read_text(encoding="utf-8")
    op.get_bind().connection.driver_connection.execute(sql)


def upgrade() -> None:
    _run("0005_security.sql")


def downgrade() -> None:
    _run("0005_downgrade.sql")
