"""Privilege lockdown (migration 0006) — resource guardrails + read-only role.

Connects AS the application and read-only roles to prove: the app is fenced by a
statement_timeout and cannot create objects; the read-only role can read but never write.
"""

import psycopg
import pytest

_APW = "ci_lockdown_app"
_RPW = "ci_lockdown_ro"


@pytest.fixture
def app_conn(_migrated):
    admin = psycopg.connect(_migrated, autocommit=True)
    admin.execute(f"ALTER ROLE fundslink_app LOGIN PASSWORD '{_APW}'")
    try:
        yield lambda: psycopg.connect(_migrated, user="fundslink_app", password=_APW)
    finally:
        admin.execute("ALTER ROLE fundslink_app NOLOGIN")
        admin.close()


@pytest.fixture
def ro_conn(_migrated):
    admin = psycopg.connect(_migrated, autocommit=True)
    admin.execute(f"ALTER ROLE fundslink_readonly LOGIN PASSWORD '{_RPW}'")
    try:
        yield lambda: psycopg.connect(_migrated, user="fundslink_readonly", password=_RPW)
    finally:
        admin.execute("ALTER ROLE fundslink_readonly NOLOGIN")
        admin.close()


def test_app_role_is_fenced_by_statement_timeout(app_conn):
    with app_conn() as c:
        value = c.execute("SHOW statement_timeout").fetchone()[0]
        assert value in ("30s", "30000ms"), value


def test_app_role_cannot_create_objects(app_conn):
    with app_conn() as c:
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            c.execute("CREATE TABLE evil (x int)")
        c.rollback()


def test_readonly_role_can_read(ro_conn):
    with ro_conn() as c:
        count = c.execute("SELECT count(*) FROM config").fetchone()[0]
        assert count >= 0
        c.rollback()


def test_readonly_role_cannot_write(ro_conn):
    with ro_conn() as c:
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            c.execute("INSERT INTO config(key, value) VALUES ('ro_probe', '1')")
        c.rollback()
