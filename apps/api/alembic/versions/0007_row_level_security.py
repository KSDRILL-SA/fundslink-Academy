"""0007 — Row-Level Security: right row, right person, right role (fail-closed).

Founder-directed (L4) security pass. The app role is NOBYPASSRLS (0005); policies read the
per-request session GUCs app.user_id / app.user_role. Owner bypasses (migrations only).

Revision ID: 0007
Revises: 0006
"""

from pathlib import Path

from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None

_SQL_DIR = Path(__file__).parent / "sql"


def _run(filename: str) -> None:
    sql = (_SQL_DIR / filename).read_text(encoding="utf-8")
    op.get_bind().connection.driver_connection.execute(sql)


def upgrade() -> None:
    _run("0007_rls.sql")


def downgrade() -> None:
    _run("0007_rls_down.sql")
