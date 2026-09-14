"""Auth ↔ Database integration — the friendship, proven.

Two guarantees: (1) the runtime least-privilege guard confirms the app connects as a
non-superuser, NOBYPASSRLS role that owns nothing (and flags every role that does not); (2) the
0014 walls mean a compromised app role cannot escalate (write role_permission) or tamper with
reference data, while still reading the RBAC matrix that auth's require() depends on.
"""

import psycopg
import pytest
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from app.db.guard import verify_least_privilege

_PW = "ci_integration_probe"


@pytest.fixture
def app_conn(_migrated):
    admin = psycopg.connect(_migrated, autocommit=True)
    admin.execute(f"ALTER ROLE fundslink_app LOGIN PASSWORD '{_PW}'")
    try:
        yield lambda: psycopg.connect(_migrated, user="fundslink_app", password=_PW)
    finally:
        admin.execute("ALTER ROLE fundslink_app NOLOGIN")
        admin.close()


async def _guard(url: str) -> dict:
    engine = create_async_engine(url)
    try:
        async with AsyncSession(engine) as session:
            return await verify_least_privilege(session)
    finally:
        await engine.dispose()


# ------------------------------- the runtime guard -------------------------------
async def test_app_role_is_least_privileged(_migrated):
    admin = psycopg.connect(_migrated, autocommit=True)
    admin.execute(f"ALTER ROLE fundslink_app LOGIN PASSWORD '{_PW}'")
    url = make_url(_migrated.replace("postgresql://", "postgresql+asyncpg://")).set(
        username="fundslink_app", password=_PW
    )
    try:
        status = await _guard(url.render_as_string(hide_password=False))
        assert status["role"] == "fundslink_app"
        assert status["is_superuser"] is False
        assert status["bypasses_rls"] is False
        assert status["owns_unforced_rls_tables"] == 0  # it reads the schema, it does not own it
        assert status["least_privileged"] is True
    finally:
        admin.execute("ALTER ROLE fundslink_app NOLOGIN")
        admin.close()


async def test_guard_rejects_the_migration_role(_migrated):
    """The migration role must never be able to serve requests (#313).

    It is the realistic misconfiguration: same host, same database, credentials already in the
    deploy environment, one line of DATABASE_URL apart. Whether it is refused as a superuser or as
    the owner of the schema depends on how the cluster was provisioned — this asserts it is
    refused, and that the guard names a reason rather than failing mutely.
    """
    status = await _guard(_migrated.replace("postgresql://", "postgresql+asyncpg://"))
    assert status["least_privileged"] is False
    assert (
        status["is_superuser"]
        or status["bypasses_rls"]
        or status["owns_unforced_rls_tables"] > 0
    ), status


async def test_owning_the_tables_is_enough_to_be_refused(_migrated):
    """Ownership is the third way past RLS, and it sets neither flag.

    PostgreSQL does not apply row security to a table's owner unless the table forces it, and ours
    deliberately do not — forcing it would subject the migration role to the policies it maintains.
    So a plain, non-superuser, NOBYPASSRLS owner reads every student's rows while reporting itself
    perfectly constrained. Before #313 the guard checked only the two flags and answered
    `least_privileged: true` for exactly that role.

    This builds the case rather than hoping the environment supplies it: a fresh role that owns one
    RLS-protected table and holds no special attribute at all.
    """
    admin = psycopg.connect(_migrated, autocommit=True)
    role = "fundslink_probe_owner"
    database = make_url(_migrated).database
    probe = None
    try:
        admin.execute(f"DROP ROLE IF EXISTS {role}")
        admin.execute(f"CREATE ROLE {role} LOGIN PASSWORD '{_PW}' NOSUPERUSER NOBYPASSRLS")
        admin.execute(f"GRANT CONNECT ON DATABASE {database} TO {role}")
        admin.execute(f"GRANT USAGE, CREATE ON SCHEMA public TO {role}")

        # The role creates its own table, so it owns it without anyone handing ownership over —
        # and can drop it again afterwards without this connection needing rights over the role.
        probe = psycopg.connect(_migrated, user=role, password=_PW, autocommit=True)
        probe.execute("CREATE TABLE probe_owned (id text PRIMARY KEY)")
        probe.execute("ALTER TABLE probe_owned ENABLE ROW LEVEL SECURITY")

        url = make_url(_migrated.replace("postgresql://", "postgresql+asyncpg://")).set(
            username=role, password=_PW
        )
        status = await _guard(url.render_as_string(hide_password=False))

        assert status["role"] == role
        # Neither flag is set. The old guard looked only at these two and said "least privileged".
        assert status["is_superuser"] is False
        assert status["bypasses_rls"] is False
        # And yet it owns a table whose policies do not apply to it.
        assert status["owns_unforced_rls_tables"] >= 1
        assert status["least_privileged"] is False
    finally:
        if probe is not None:
            probe.execute("DROP TABLE IF EXISTS probe_owned")
            probe.close()
        admin.execute(f"REVOKE ALL ON SCHEMA public FROM {role}")
        admin.execute(f"REVOKE ALL ON DATABASE {database} FROM {role}")
        admin.execute(f"DROP ROLE IF EXISTS {role}")
        admin.close()


# --------------------------- the least-privilege walls (0014) ---------------------------
def test_app_cannot_escalate_via_role_permission(app_conn):
    with app_conn() as conn:
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            conn.execute(
                "INSERT INTO role_permission(id, role_id, permission_id) VALUES ('evil','x','y')"
            )
        conn.rollback()


def test_app_cannot_tamper_lookup_tables(app_conn):
    with app_conn() as conn:
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            conn.execute("INSERT INTO lk_consent_purpose(code) VALUES ('EVIL_PURPOSE')")
        conn.rollback()


def test_app_can_still_read_the_rbac_matrix(app_conn):
    # SELECT is retained — auth's require() RBAC lookup must keep working after the tightening.
    with app_conn() as conn:
        count = conn.execute("SELECT count(*) FROM role_permission").fetchone()[0]
        assert count > 0
        conn.rollback()
