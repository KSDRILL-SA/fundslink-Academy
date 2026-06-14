"""Auth-table Row-Level Security (migration 0010) — the login-flow contract (D-015).

Proves the database itself fences the identity tables: the SYSTEM context (the
authentication authority used by register/login/refresh) sees every row, an authenticated
user sees ONLY their own user/refresh rows, no context sees nothing (fail-closed), and a
non-staff user can neither mint a user row nor reach another user's. Also proves the
SYSTEM principal is seeded with the literal id 'SYSTEM' (fn_human_final keys on it).

Connects AS fundslink_app (NOBYPASSRLS), exactly like the backend will at runtime.
"""

import psycopg
import pytest

_PW = "ci_auth_rls_probe"
_A, _B = "authrls_uA", "authrls_uB"
_FA, _FB = "authrls_famA", "authrls_famB"
_TA, _TB = "authrls_tokA", "authrls_tokB"


@pytest.fixture
def rls(_migrated):
    admin = psycopg.connect(_migrated, autocommit=True)
    admin.execute(f"ALTER ROLE fundslink_app LOGIN PASSWORD '{_PW}'")
    _cleanup(admin)
    admin.execute(
        'INSERT INTO "user"(id,email,password_hash) VALUES (%s,%s,\'x\'),(%s,%s,\'x\')',
        (_A, _A + "@t.test", _B, _B + "@t.test"),
    )
    admin.execute(
        "INSERT INTO refresh_token_family(id,user_id) VALUES (%s,%s),(%s,%s)",
        (_FA, _A, _FB, _B),
    )
    admin.execute(
        "INSERT INTO refresh_token(id,family_id,token_hash,expires_at)"
        " VALUES (%s,%s,'h1',now()+interval '7 days'),(%s,%s,'h2',now()+interval '7 days')",
        (_TA, _FA, _TB, _FB),
    )
    try:
        yield lambda: psycopg.connect(_migrated, user="fundslink_app", password=_PW)
    finally:
        _cleanup(admin)
        admin.execute("ALTER ROLE fundslink_app NOLOGIN")
        admin.close()


def _cleanup(admin):
    admin.execute("DELETE FROM refresh_token WHERE id IN (%s,%s)", (_TA, _TB))
    admin.execute("DELETE FROM refresh_token_family WHERE id IN (%s,%s)", (_FA, _FB))
    admin.execute('DELETE FROM "user" WHERE id IN (%s,%s)', (_A, _B))


def _ctx(conn, **kv):
    for key, value in kv.items():
        conn.execute("SELECT set_config(%s, %s, false)", (f"app.{key}", value))


# ---------- SYSTEM principal is seeded (the literal id fn_human_final keys on) ----------
def test_system_principal_is_seeded(_migrated):
    admin = psycopg.connect(_migrated, autocommit=True)
    try:
        row = admin.execute(
            "SELECT account_state FROM \"user\" WHERE id = 'SYSTEM'"
        ).fetchone()
        assert row is not None and row[0] == "ACTIVE"
        role = admin.execute(
            "SELECT r.code FROM user_role ur JOIN role r ON r.id = ur.role_id"
            " WHERE ur.user_id = 'SYSTEM'"
        ).fetchone()
        assert role is not None and role[0] == "SYSTEM"
    finally:
        admin.close()


# ---------- the authentication authority (SYSTEM) can look up any account ----------
def test_system_context_can_look_up_any_user(rls):
    with rls() as c:
        _ctx(c, user_role="SYSTEM")  # login path: no user_id yet
        seen = {r[0] for r in c.execute('SELECT id FROM "user"').fetchall()}
        assert {_A, _B}.issubset(seen)
        c.rollback()


# ---------- an authenticated user sees only their own identity row ----------
def test_user_sees_only_their_own_user_row(rls):
    with rls() as c:
        _ctx(c, user_id=_A)
        seen = {r[0] for r in c.execute('SELECT id FROM "user"').fetchall()}
        assert seen == {_A}
        c.rollback()


def test_no_context_is_fail_closed(rls):
    with rls() as c:
        assert c.execute('SELECT id FROM "user"').fetchall() == []
        assert c.execute("SELECT id FROM refresh_token").fetchall() == []
        c.rollback()


# ---------- refresh tokens are fenced to their owning family's user ----------
def test_user_sees_only_their_own_refresh_tokens(rls):
    with rls() as c:
        _ctx(c, user_id=_A)
        seen = {r[0] for r in c.execute("SELECT id FROM refresh_token").fetchall()}
        assert seen == {_TA}
        fams = {r[0] for r in c.execute("SELECT id FROM refresh_token_family").fetchall()}
        assert fams == {_FA}
        c.rollback()


def test_system_context_sees_all_refresh_tokens(rls):
    with rls() as c:
        _ctx(c, user_role="SYSTEM")
        seen = {r[0] for r in c.execute("SELECT id FROM refresh_token").fetchall()}
        assert {_TA, _TB}.issubset(seen)
        c.rollback()


# ---------- a non-staff user cannot mint a user row (registration is SYSTEM-only) ----------
def test_non_staff_cannot_insert_user_row(rls):
    with rls() as c:
        _ctx(c, user_id=_A)
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            c.execute(
                "INSERT INTO \"user\"(id,email,password_hash)"
                " VALUES ('authrls_evil','evil@t.test','x')"
            )
        c.rollback()


# ---------- a user cannot reach across to another user's row (UPDATE filtered to zero) ----------
def test_user_cannot_update_another_users_row(rls):
    with rls() as c:
        _ctx(c, user_id=_A)
        affected = c.execute(
            "UPDATE \"user\" SET account_state = 'SUSPENDED' WHERE id = %s", (_B,)
        ).rowcount
        assert affected == 0
        c.rollback()
