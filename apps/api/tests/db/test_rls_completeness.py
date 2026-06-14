"""RLS completeness (migration 0009) — application-derived & audit tables.

Proves ownership is enforced on the OTHER-reasons motivation and the audit log: a student
sees only their own, another student cannot, staff sees all, and cross-user writes are denied.
"""

import psycopg
import pytest

_PW = "ci_rls_comp"
_IDS = {
    "A": "rlsc_uA", "B": "rlsc_uB",
    "aA": "rlsc_faA", "aB": "rlsc_faB",
    "mA": "rlsc_motA", "mB": "rlsc_motB",
}


def _clean(admin):
    admin.execute(
        "DELETE FROM application_motivation WHERE id IN (%s,%s)", (_IDS["mA"], _IDS["mB"])
    )
    admin.execute("DELETE FROM funding_application WHERE id IN (%s,%s)", (_IDS["aA"], _IDS["aB"]))
    admin.execute("DELETE FROM student_profile WHERE id IN (%s,%s)", (_IDS["A"], _IDS["B"]))
    admin.execute('DELETE FROM "user" WHERE id IN (%s,%s)', (_IDS["A"], _IDS["B"]))


@pytest.fixture
def rls(_migrated):
    admin = psycopg.connect(_migrated, autocommit=True)
    admin.execute(f"ALTER ROLE fundslink_app LOGIN PASSWORD '{_PW}'")
    _clean(admin)
    admin.execute(
        'INSERT INTO "user"(id,email,password_hash) VALUES (%s,%s,\'x\'),(%s,%s,\'x\')',
        (_IDS["A"], _IDS["A"] + "@t", _IDS["B"], _IDS["B"] + "@t"),
    )
    admin.execute(
        "INSERT INTO student_profile(id,first_name,last_name,level,field_of_study)"
        " VALUES (%s,'A','A','UG','CS'),(%s,'B','B','UG','CS')",
        (_IDS["A"], _IDS["B"]),
    )
    admin.execute(
        "INSERT INTO funding_application(id,student_profile_id,application_type,academic_year)"
        " VALUES (%s,%s,'OTHER','2026'),(%s,%s,'OTHER','2026')",
        (_IDS["aA"], _IDS["A"], _IDS["aB"], _IDS["B"]),
    )
    admin.execute(
        "INSERT INTO application_motivation"
        "(id,application_id,situation,why_not_categories,support_needed)"
        " VALUES (%s,%s,'sA','w','n'),(%s,%s,'sB','w','n')",
        (_IDS["mA"], _IDS["aA"], _IDS["mB"], _IDS["aB"]),
    )
    try:
        yield lambda: psycopg.connect(_migrated, user="fundslink_app", password=_PW)
    finally:
        _clean(admin)
        admin.execute("ALTER ROLE fundslink_app NOLOGIN")
        admin.close()


def _ctx(conn, **kv):
    for key, value in kv.items():
        conn.execute("SELECT set_config(%s, %s, false)", (f"app.{key}", value))


def test_student_sees_only_their_own_motivation(rls):
    with rls() as c:
        _ctx(c, user_id=_IDS["A"])
        seen = {r[0] for r in c.execute("SELECT situation FROM application_motivation").fetchall()}
        assert seen == {"sA"}
        c.rollback()


def test_student_cannot_write_motivation_for_another(rls):
    with rls() as c:
        _ctx(c, user_id=_IDS["A"])
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            c.execute(
                "INSERT INTO application_motivation"
                "(id,application_id,situation,why_not_categories,support_needed)"
                " VALUES ('rlsc_evil', %s, 'x', 'y', 'z')",
                (_IDS["aB"],),
            )
        c.rollback()


def test_audit_log_visible_to_owner_and_staff_only(rls):
    with rls() as c:
        _ctx(c, user_id=_IDS["A"])
        c.execute(
            "INSERT INTO audit_log(id,actor_user_id,action,resource_type,request_id)"
            " VALUES ('rlsc_al', %s, 'x', 'user', 'r')",
            (_IDS["A"],),
        )
        assert c.execute("SELECT count(*) FROM audit_log WHERE id='rlsc_al'").fetchone()[0] == 1
        _ctx(c, user_id=_IDS["B"], user_role="STUDENT")
        assert c.execute("SELECT count(*) FROM audit_log WHERE id='rlsc_al'").fetchone()[0] == 0
        _ctx(c, user_role="ADMIN_REVIEWER")
        assert c.execute("SELECT count(*) FROM audit_log WHERE id='rlsc_al'").fetchone()[0] == 1
        c.rollback()
