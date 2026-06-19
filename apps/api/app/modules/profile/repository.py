"""Profile repositories (DB-D2 boundary) — the only profile files that touch a DB driver.

Parameterised named-bind SQL via app.db.sql (DB-D20 / S5.21). Every method runs inside the
request's transaction with the caller's RLS context already set (the require() dependency
authenticates and sets app.user_id/app.user_role), so a student sees and writes only their own
rows — the database is the backstop even if a query forgets a WHERE (ST-2.3, fail-closed).
"""

from __future__ import annotations

from sqlalchemy.exc import IntegrityError

from app.common.errors import AppError
from app.db import sql
from app.db.cuid import cuid
from app.db.repository import BaseRepository


class StudentProfileRepository(BaseRepository):
    async def get(self, user_id: str):
        return await sql.fetch_one(
            self.session,
            "SELECT id, first_name, last_name, phone, level, field_of_study,"
            " hardship_narrative, verification_level, created_at"
            " FROM student_profile WHERE id = :id AND deleted_at IS NULL",
            id=user_id,
        )

    async def exists(self, user_id: str) -> bool:
        row = await sql.fetch_one(
            self.session,
            "SELECT 1 FROM student_profile WHERE id = :id AND deleted_at IS NULL",
            id=user_id,
        )
        return row is not None

    async def upsert(
        self,
        *,
        user_id: str,
        first_name: str,
        last_name: str,
        phone: str | None,
        level: str,
        field_of_study: str,
        hardship_narrative: str | None,
    ) -> None:
        """Create-or-replace the 1:1 profile (BR-A03, PK=FK). PUT semantics: a full replace."""
        await sql.execute(
            self.session,
            "INSERT INTO student_profile"
            " (id, first_name, last_name, phone, level, field_of_study, hardship_narrative,"
            "  created_by)"
            " VALUES (:id, :fn, :ln, :phone, :level, :fos, :hn, :id)"
            " ON CONFLICT (id) DO UPDATE SET"
            "  first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name,"
            "  phone = EXCLUDED.phone, level = EXCLUDED.level,"
            "  field_of_study = EXCLUDED.field_of_study,"
            "  hardship_narrative = EXCLUDED.hardship_narrative",
            id=user_id,
            fn=first_name,
            ln=last_name,
            phone=phone,
            level=level,
            fos=field_of_study,
            hn=hardship_narrative,
        )

    async def owns_application(self, user_id: str, application_id: str) -> bool:
        """True iff this student owns the application (RLS already scopes; explicit for clarity)."""
        row = await sql.fetch_one(
            self.session,
            "SELECT 1 FROM funding_application"
            " WHERE id = :id AND student_profile_id = :sp AND deleted_at IS NULL",
            id=application_id,
            sp=user_id,
        )
        return row is not None


class UserPiiRepository(BaseRepository):
    """The SA ID number lives on the user row, encrypted (bytea) + blind-indexed (BR-A04)."""

    async def id_number_owner(self, blind_index: str) -> str | None:
        row = await sql.fetch_one(
            self.session,
            'SELECT id FROM "user" WHERE id_number_blind_idx = :bi',
            bi=blind_index,
        )
        return row[0] if row else None

    async def set_id_number(
        self, *, user_id: str, id_number_enc: bytes, blind_index: str
    ) -> None:
        try:
            await sql.execute(
                self.session,
                'UPDATE "user" SET id_number_enc = :enc, id_number_blind_idx = :bi'
                " WHERE id = :id",
                enc=id_number_enc,
                bi=blind_index,
                id=user_id,
            )
        except IntegrityError as exc:  # uq_user_idnum race — same ID number already claimed
            raise AppError(
                "id_number_taken", "This ID number is already registered", status_code=409
            ) from exc


class DocumentRepository(BaseRepository):
    async def create(
        self,
        *,
        student_profile_id: str,
        application_id: str | None,
        doc_type: str,
        storage_uri: str,
        sha256: str,
    ) -> tuple[str, object]:
        """Insert a PENDING document; return (id, created_at). RETURNING runs under RLS."""
        doc_id = cuid()
        try:
            row = await sql.fetch_one(
                self.session,
                "INSERT INTO document"
                " (id, student_profile_id, application_id, doc_type, storage_uri, sha256,"
                "  av_status, created_by)"
                " VALUES (:id, :spid, :app, :dt, :uri, :sha, 'PENDING', :spid)"
                " RETURNING id, created_at",
                id=doc_id,
                spid=student_profile_id,
                app=application_id,
                dt=doc_type,
                uri=storage_uri,
                sha=sha256,
            )
        except IntegrityError as exc:  # unknown doc_type / application FK → friendly 422
            raise AppError(
                "invalid_document",
                "Unknown document type or application reference",
                status_code=422,
            ) from exc
        return row[0], row[1]

    async def list_for_student(self, student_profile_id: str) -> list:
        return await sql.fetch_all(
            self.session,
            "SELECT id, doc_type, application_id, av_status, created_at FROM document"
            " WHERE student_profile_id = :sp AND deleted_at IS NULL"
            " ORDER BY created_at DESC",
            sp=student_profile_id,
        )


class DataExportRepository(BaseRepository):
    """POPIA §15.6 subject-access reads — everything we hold on the caller, scoped to them (RLS).

    Read-only. Never selects the raw SA ID (id_number_enc) — that is write-only PII (TAD §4.4) —
    only whether one is on file. Counselling data never enters the main schema (§6.4), so there is
    nothing here to leak.
    """

    async def subject(self, user_id: str):
        return await sql.fetch_one(
            self.session,
            'SELECT email, account_state, created_at,'
            ' (id_number_blind_idx IS NOT NULL) AS id_on_file'
            ' FROM "user" WHERE id = :id',
            id=user_id,
        )

    async def applications(self, user_id: str) -> list:
        return await sql.fetch_all(
            self.session,
            "SELECT id, application_type, academic_year, status, priority, requested_amount,"
            " currency, needed_by, created_at FROM funding_application"
            " WHERE student_profile_id = :sp AND deleted_at IS NULL ORDER BY created_at DESC",
            sp=user_id,
        )

    async def consents(self, user_id: str) -> list:
        return await sql.fetch_all(
            self.session,
            "SELECT purpose, wording_version, channel, granted_at, withdrawn_at"
            " FROM consent_record WHERE user_id = :uid ORDER BY granted_at DESC",
            uid=user_id,
        )
