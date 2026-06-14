"""Auth ↔ Database integration — the friendship, proven.

Two guarantees: (1) the runtime least-privilege guard confirms the app connects as a
non-superuser, NOBYPASSRLS role (and flags a bypassing role); (2) the 0014 walls mean a
compromised app role cannot escalate (write role_permission) or tamper with reference data,
while still reading the RBAC matrix that auth's require() depends on.
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
        assert status["least_privileged"] is True
    finally:
        admin.execute("ALTER ROLE fundslink_app NOLOGIN")
        admin.close()


async def test_guard_rejects_a_bypassing_role(_migrated):
    # The owner/superuser (postgres) bypasses RLS — the guard must mark it NOT least-privileged
    # so /readyz refuses to serve in that posture.
    status = await _guard(_migrated.replace("postgresql://", "postgresql+asyncpg://"))
    assert status["least_privileged"] is False


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
