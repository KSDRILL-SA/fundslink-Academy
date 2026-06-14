"""0008 — final alignment: updated_at auto-stamp triggers (config/document/notif_preference).

Founder-directed final integration pass. Additive (DB-D36).

Revision ID: 0008
Revises: 0007
"""

from pathlib import Path

from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None

_SQL_DIR = Path(__file__).parent / "sql"


def _run(filename: str) -> None:
    sql = (_SQL_DIR / filename).read_text(encoding="utf-8")
    op.get_bind().connection.driver_connection.execute(sql)


def upgrade() -> None:
    _run("0008_touch_triggers.sql")


def downgrade() -> None:
    _run("0008_down.sql")
