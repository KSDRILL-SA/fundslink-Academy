"""0006 — privilege lockdown: strip PUBLIC grants, fence the app role, add a read-only role.

Founder-directed (L4) defense-in-depth security pass. Additive (DB-D36).

Revision ID: 0006
Revises: 0005
"""

from pathlib import Path

from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None

_SQL_DIR = Path(__file__).parent / "sql"


def _run(filename: str) -> None:
    sql = (_SQL_DIR / filename).read_text(encoding="utf-8")
    op.get_bind().connection.driver_connection.execute(sql)


def upgrade() -> None:
    _run("0006_lockdown.sql")


def downgrade() -> None:
    _run("0006_unlock.sql")
