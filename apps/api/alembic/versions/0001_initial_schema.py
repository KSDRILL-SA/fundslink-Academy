"""0001 — initial schema (structural DDL from docs/database/schema.sql).

Wraps the validated physical schema under migration control without redesign
(stage 01 task 1). The DDL contains plpgsql function bodies ($$...$$) and literal
``%`` characters (RAISE EXCEPTION ... '%'), which the DBAPI param layer would try to
interpret — so the script is run through the raw psycopg3 connection (no params),
which executes the whole multi-statement file verbatim.

Revision ID: 0001
Revises:
"""

from pathlib import Path

from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

_SQL_DIR = Path(__file__).parent / "sql"


def _run(filename: str) -> None:
    sql = (_SQL_DIR / filename).read_text(encoding="utf-8")
    # Raw psycopg3 connection: executes multi-statement DDL with literal % and $$ verbatim.
    op.get_bind().connection.driver_connection.execute(sql)


def upgrade() -> None:
    _run("0001_schema.sql")


def downgrade() -> None:
    _run("0001_drop.sql")
