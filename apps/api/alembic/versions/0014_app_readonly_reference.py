"""0014 — least-privilege: fundslink_app SELECT-only on reference + RBAC-matrix tables.

Auth↔DB integration hardening (Stage 02): the app reads lookups + the role/permission matrix but
never writes them, so its write grants are revoked — a compromised app role cannot escalate or
tamper with reference data. Additive (DB-D36).

Revision ID: 0014
Revises: 0013
"""

from pathlib import Path

from alembic import op

revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None

_SQL_DIR = Path(__file__).parent / "sql"


def _run(filename: str) -> None:
    sql = (_SQL_DIR / filename).read_text(encoding="utf-8")
    op.get_bind().connection.driver_connection.execute(sql)


def upgrade() -> None:
    _run("0014_app_readonly_reference.sql")


def downgrade() -> None:
    _run("0014_app_readonly_reference_down.sql")
