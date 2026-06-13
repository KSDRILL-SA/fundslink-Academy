"""Row factories for the constraint suite.

Every insert uses parameterised psycopg3 (%s + tuple) — never string interpolation.
Rows are created inside the test transaction and discarded on rollback, so even
append-only tables stay clean (nothing is ever committed).
"""

from __future__ import annotations

from typing import Any

import psycopg

from app.db import cuid


def insert_user(
    conn: psycopg.Connection,
    *,
    user_id: str | None = None,
    email: str | None = None,
    blind_idx: str | None = None,
    account_state: str = "ACTIVE",
) -> str:
    uid = user_id or cuid()
    conn.execute(
        'INSERT INTO "user"(id, email, password_hash, account_state, id_number_blind_idx)'
        " VALUES (%s, %s, %s, %s, %s)",
        (uid, email or f"{uid}@fundslink.test", "argon2-placeholder", account_state, blind_idx),
    )
    return uid


def insert_profile(conn: psycopg.Connection, *, user_id: str | None = None) -> str:
    uid = user_id or insert_user(conn)
    conn.execute(
        "INSERT INTO student_profile(id, first_name, last_name, level, field_of_study)"
        " VALUES (%s, %s, %s, %s, %s)",
        (uid, "Test", "Student", "UG", "BSc Computer Science"),
    )
    return uid


def insert_application(
    conn: psycopg.Connection,
    *,
    profile_id: str | None = None,
    app_type: str = "POSTGRAD",
    status: str = "DRAFT",
    academic_year: str = "2026",
    **cols: Any,
) -> str:
    pid = profile_id or insert_profile(conn)
    aid = cuid()
    keys = ["id", "student_profile_id", "application_type", "status", "academic_year", *cols.keys()]
    vals = [aid, pid, app_type, status, academic_year, *cols.values()]
    placeholders = ", ".join(["%s"] * len(vals))
    conn.execute(
        f"INSERT INTO funding_application({', '.join(keys)}) VALUES ({placeholders})", vals
    )
    return aid


def insert_bursary(conn: psycopg.Connection, *, status: str = "OPEN") -> str:
    bid = cuid()
    conn.execute(
        "INSERT INTO external_bursary(id, name, provider, level_eligibility, status)"
        " VALUES (%s, %s, %s, %s, %s)",
        (bid, "Test Bursary", "Test Provider", ["UG"], status),
    )
    return bid


def insert_tracked(conn: psycopg.Connection, *, profile_id: str, bursary_id: str) -> str:
    tid = cuid()
    conn.execute(
        "INSERT INTO tracked_application(id, student_profile_id, external_bursary_id)"
        " VALUES (%s, %s, %s)",
        (tid, profile_id, bursary_id),
    )
    return tid


def insert_status_event(
    conn: psycopg.Connection,
    *,
    application_id: str,
    actor_user_id: str | None,
    to_status: str,
    from_status: str | None = None,
) -> str:
    eid = cuid()
    conn.execute(
        "INSERT INTO application_status_event"
        "(id, application_id, from_status, to_status, actor_user_id)"
        " VALUES (%s, %s, %s, %s, %s)",
        (eid, application_id, from_status, to_status, actor_user_id),
    )
    return eid
