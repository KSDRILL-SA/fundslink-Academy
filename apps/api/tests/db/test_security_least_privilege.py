"""Least-privilege application role (DB-D30) — the tamper wall, locked in CI.

The append-only guarantee must not rest on triggers alone: the application role must be
*structurally* unable to disable a trigger, rewrite an append-only row, or run DDL. These
tests connect AS the restricted role and assert every tamper attempt is denied while normal
CRUD still works. (The role is created NOLOGIN by migration 0005; the test enables login
with a throwaway password, then reverts.)
"""

import psycopg
import pytest

_TEST_PW = "ci_least_priv_probe"


@pytest.fixture
def connect_app(_migrated):
    conninfo = _migrated
    admin = psycopg.connect(conninfo, autocommit=True)
    # ALTER ROLE ... PASSWORD takes a literal (no bind params). _TEST_PW is a fixed safe constant.
    admin.execute(f"ALTER ROLE fundslink_app LOGIN PASSWORD '{_TEST_PW}'")
    try:
        yield lambda: psycopg.connect(conninfo, user="fundslink_app", password=_TEST_PW)
    finally:
        admin.execute("ALTER ROLE fundslink_app NOLOGIN")
        admin.close()


def test_app_role_cannot_update_append_only(connect_app):
    with connect_app() as c:
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            c.execute("UPDATE audit_log SET action='TAMPERED'")
        c.rollback()


def test_app_role_cannot_disable_trigger(connect_app):
    with connect_app() as c:
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            c.execute("ALTER TABLE audit_log DISABLE TRIGGER tg_audit_guard")
        c.rollback()


def test_app_role_cannot_drop_table(connect_app):
    with connect_app() as c:
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            c.execute("DROP TABLE funding_application CASCADE")
        c.rollback()


def test_app_role_can_do_normal_crud(connect_app):
    with connect_app() as c:
        c.execute("INSERT INTO config(key, value) VALUES ('sec_probe', '1')")
        c.rollback()  # prove the privilege, don't persist
