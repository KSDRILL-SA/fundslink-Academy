"""0010 — Auth-table Row-Level Security + SYSTEM principal (Stage 02, C3).

Extends the 0007/0009 RLS wall onto the identity tables (user, refresh_token_family,
refresh_token) with a SYSTEM-context login/token-validation path (decision D-015 — there
is no user_id at login), and seeds the SYSTEM principal (user.id = 'SYSTEM') that
fn_human_final keys on. Additive only; locked migrations 0001-0009 are untouched (DB-D36).

Revision ID: 0010
Revises: 0009
"""

from pathlib import Path

from alembic import op

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None

_SQL_DIR = Path(__file__).parent / "sql"


def _run(filename: str) -> None:
    sql = (_SQL_DIR / filename).read_text(encoding="utf-8")
    op.get_bind().connection.driver_connection.execute(sql)


def upgrade() -> None:
    _run("0010_auth_rls.sql")


def downgrade() -> None:
    _run("0010_auth_rls_down.sql")
