"""Per-request RLS context helper (app.db.context) end-to-end over the async path.

Connects an async SQLAlchemy session AS fundslink_app (exactly the runtime identity) and
proves set_user_context scopes to the caller's own rows, set_system_context (the login
authority / jobs) sees all, and no context is fail-closed — the same guarantee the SQL-level
0010 tests give, but through the real backend helper the request lifecycle will call.
"""

import psycopg
import pytest
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from app.db.context import set_system_context, set_user_context

_PW = "ci_ctx_probe"
_A, _B = "ctx_uA", "ctx_uB"


@pytest.fixture
def async_app_url(_migrated):
    admin = psycopg.connect(_migrated, autocommit=True)
    admin.execute(f"ALTER ROLE fundslink_app LOGIN PASSWORD '{_PW}'")
    admin.execute('DELETE FROM "user" WHERE id IN (%s,%s)', (_A, _B))
    admin.execute(
        'INSERT INTO "user"(id,email,password_hash) VALUES (%s,%s,\'x\'),(%s,%s,\'x\')',
        (_A, _A + "@t.test", _B, _B + "@t.test"),
    )
    url = make_url(_migrated.replace("postgresql://", "postgresql+asyncpg://"))
    url = url.set(username="fundslink_app", password=_PW)
    try:
        yield url.render_as_string(hide_password=False)
    finally:
        admin.execute('DELETE FROM "user" WHERE id IN (%s,%s)', (_A, _B))
        admin.execute("ALTER ROLE fundslink_app NOLOGIN")
        admin.close()


async def _ids(url, setup):
    engine = create_async_engine(url)
    try:
        async with AsyncSession(engine) as session:
            if setup is not None:
                await setup(session)
            result = await session.execute(text('SELECT id FROM "user"'))
            return set(result.scalars().all())
    finally:
        await engine.dispose()


async def test_user_context_scopes_to_own_row(async_app_url):
    seen = await _ids(async_app_url, lambda s: set_user_context(s, user_id=_A, role="STUDENT"))
    assert seen == {_A}


async def test_system_context_sees_all(async_app_url):
    seen = await _ids(async_app_url, set_system_context)
    assert {_A, _B}.issubset(seen)


async def test_no_context_is_fail_closed(async_app_url):
    assert await _ids(async_app_url, None) == set()
