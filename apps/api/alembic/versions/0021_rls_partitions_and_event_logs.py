"""0021 — close the two holes in the RLS wall (#292).

PostgreSQL applies row-level security to the relation named in a query, so a partition named
directly (``audit_log_202609``) bypassed every policy on its parent; and three sensitive tables —
both status-event logs and ``user_role`` — never had RLS at all. This seals every partition
(``fn_seal_partitions()``, which the maintenance job re-applies to partitions it creates) and adds
owner-or-staff policies to the three tables. Additive (DB-D36).

Revision ID: 0021
Revises: 0020
"""

from pathlib import Path

from alembic import op

revision = "0021"
down_revision = "0020"
branch_labels = None
depends_on = None

_SQL_DIR = Path(__file__).parent / "sql"


def _run(filename: str) -> None:
    sql = (_SQL_DIR / filename).read_text(encoding="utf-8")
    op.get_bind().connection.driver_connection.execute(sql)


def upgrade() -> None:
    _run("0021_rls_partitions_and_event_logs.sql")


def downgrade() -> None:
    _run("0021_rls_partitions_and_event_logs_down.sql")
