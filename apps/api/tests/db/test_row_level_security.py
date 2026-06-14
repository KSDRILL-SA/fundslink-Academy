"""Row-Level Security (migration 0007) — right row, right person, right role.

Connects AS the application role with a per-session user/role context and proves the
database itself enforces ownership: a student sees only their own rows, no context sees
nothing (fail-closed), staff sees all, and a student cannot write a row for another user.
"""

import psycopg
import pytest

_PW = "ci_rls_probe"
_IDS = {"A": "rls_uA", "B": "rls_uB", "aA": "rls_appA", "aB": "rls_appB"}


@pytest.fixture
def rls(_migrated):
    admin = psycopg.connect(_migrated, autocommit=True)
    admin.execute(f"ALTER ROLE fundslink_app LOGIN PASSWORD '{_PW}'")
    _cleanup(admin)  # defensive: clear any rows left by a crashed prior run
    admin.execute(
        'INSERT INTO "user"(id,email,password_hash) VALUES (%s,%s,\'x\'),(%s,%s,\'x\')',
        (_IDS["A"], _IDS["A"] + "@t.test", _IDS["B"], _IDS["B"] + "@t.test"),
    )
    admin.execute(
        "INSERT INTO student_profile(id,first_name,last_name,level,field_of_study)"
        " VALUES (%s,'A','A','UG','CS'),(%s,'B','B','UG','CS')",
        (_IDS["A"], _IDS["B"]),
    )
    admin.execute(
        "INSERT INTO funding_application(id,student_profile_id,application_type,academic_year)"
        " VALUES (%s,%s,'POSTGRAD','2026'),(%s,%s,'POSTGRAD','2026')",
        (_IDS["aA"], _IDS["A"], _IDS["aB"], _IDS["B"]),
    )
    try:
        yield lambda: psycopg.connect(_migrated, user="fundslink_app", password=_PW)
    finally:
        _cleanup(admin)
        admin.execute("ALTER ROLE fundslink_app NOLOGIN")
        admin.close()


def _cleanup(admin):
    admin.execute("DELETE FROM funding_application WHERE id IN (%s,%s)", (_IDS["aA"], _IDS["aB"]))
    admin.execute("DELETE FROM student_profile WHERE id IN (%s,%s)", (_IDS["A"], _IDS["B"]))
    admin.execute('DELETE FROM "user" WHERE id IN (%s,%s)', (_IDS["A"], _IDS["B"]))


def _ctx(conn, **kv):
    for key, value in kv.items():
        conn.execute("SELECT set_config(%s, %s, false)", (f"app.{key}", value))


def test_student_sees_only_their_own_rows(rls):
    with rls() as c:
        _ctx(c, user_id=_IDS["A"])
        seen = {r[0] for r in c.execute("SELECT id FROM funding_application").fetchall()}
        assert seen == {_IDS["aA"]}
        c.rollback()


def test_no_context_is_fail_closed(rls):
    with rls() as c:
        seen = c.execute("SELECT id FROM funding_application").fetchall()
        assert seen == []
        c.rollback()


def test_staff_context_sees_all(rls):
    with rls() as c:
        _ctx(c, user_role="ADMIN_REVIEWER")
        seen = {r[0] for r in c.execute("SELECT id FROM funding_application").fetchall()}
        assert {_IDS["aA"], _IDS["aB"]}.issubset(seen)
        c.rollback()


def test_student_cannot_write_a_row_for_another_user(rls):
    with rls() as c:
        _ctx(c, user_id=_IDS["A"])
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            c.execute(
                "INSERT INTO funding_application"
                "(id,student_profile_id,application_type,academic_year)"
                " VALUES ('rls_evil', %s, 'POSTGRAD', '2026')",
                (_IDS["B"],),
            )
        c.rollback()
