"""Profile service — student_profile CRUD + the document upload pipeline (BR-A03/A04, ST-2.4).

Business logic only; no DB driver import (layering S4.79 — repositories own the SQL). The RLS
context is set by the require() dependency before any method runs, so writes are confined to the
caller's own rows. Every mutation writes audit_log in the same transaction (S3.33). PII
(id_number, hardship_narrative) is NEVER placed in an audit detail or a log line (TAD §4.4).
"""

from __future__ import annotations

from datetime import UTC, datetime

from app.common.errors import AppError
from app.core.config import settings
from app.modules.auth import crypto
from app.modules.auth.repository import AuditRepository
from app.modules.profile.documents import EXTENSION, process_upload
from app.modules.profile.repository import (
    DataExportRepository,
    DocumentRepository,
    StudentProfileRepository,
    UserPiiRepository,
)
from app.modules.profile.schemas import Document, StudentProfile, StudentProfileInput
from app.modules.profile.storage import get_document_storage


def _to_profile(row) -> StudentProfile:
    return StudentProfile(
        id=row[0],
        first_name=row[1],
        last_name=row[2],
        phone=row[3],
        level=row[4],
        field_of_study=row[5],
        hardship_narrative=row[6],
        preferred_language=row[7],
        verification_level=row[8],
        created_at=row[9],
    )


class ProfileService:
    def __init__(self, session) -> None:
        self.session = session
        self.profiles = StudentProfileRepository(session)
        self.pii = UserPiiRepository(session)
        self.documents = DocumentRepository(session)
        self.exports = DataExportRepository(session)
        self.audit = AuditRepository(session)
        self.storage = get_document_storage()

    async def get_profile(self, *, user_id: str) -> StudentProfile:
        row = await self.profiles.get(user_id)
        if row is None:
            raise AppError(
                "profile_not_found", "You have not created a profile yet", status_code=404
            )
        return _to_profile(row)

    async def export_data(self, *, user_id: str, request_id: str) -> dict:
        """POPIA §15.6 subject-access export — everything we hold on the caller, in one bundle.

        Excludes by design: the raw SA ID number (write-only PII, TAD §4.4 — we report only that
        one is on file) and counselling data (never in the main schema, §6.4). RLS-scoped.
        """
        subject = await self.exports.subject(user_id)
        profile_row = await self.profiles.get(user_id)
        bundle = {
            "exported_at": datetime.now(UTC).isoformat(),
            "notice": (
                "This is everything FundsLink holds on you (POPIA §15.6). Your raw ID number is "
                "stored encrypted and never exported (TAD §4.4); counselling data is kept entirely "
                "separate (§6.4)."
            ),
            "subject": None
            if subject is None
            else {
                "user_id": user_id,
                "email": subject[0],
                "account_state": subject[1],
                "registered_at": subject[2],
                "sa_id_on_file": bool(subject[3]),
            },
            "profile": None
            if profile_row is None
            else {
                "first_name": profile_row[1],
                "last_name": profile_row[2],
                "phone": profile_row[3],
                "level": profile_row[4],
                "field_of_study": profile_row[5],
                "hardship_narrative": profile_row[6],
                "preferred_language": profile_row[7],
                "verification_level": profile_row[8],
                "created_at": profile_row[9],
            },
            "applications": [
                {
                    "id": r[0],
                    "application_type": r[1],
                    "academic_year": r[2],
                    "status": r[3],
                    "priority": r[4],
                    "requested_amount": None if r[5] is None else str(r[5]),
                    "currency": r[6],
                    "needed_by": r[7],
                    "created_at": r[8],
                }
                for r in await self.exports.applications(user_id)
            ],
            "documents": [
                {"id": r[0], "doc_type": r[1], "application_id": r[2],
                 "av_status": r[3], "uploaded_at": r[4]}
                for r in await self.documents.list_for_student(user_id)
            ],
            "consents": [
                {"purpose": r[0], "wording_version": r[1], "channel": r[2],
                 "granted_at": r[3], "withdrawn_at": r[4]}
                for r in await self.exports.consents(user_id)
            ],
        }
        await self.audit.write(
            actor_user_id=user_id,
            action="DATA_EXPORTED",
            resource_type="user",
            resource_id=user_id,
            request_id=request_id,
            detail={"popia": "S15.6"},
        )
        return bundle

    async def upsert_profile(
        self, *, user_id: str, data: StudentProfileInput, request_id: str
    ) -> StudentProfile:
        existed = await self.profiles.exists(user_id)
        await self.profiles.upsert(
            user_id=user_id,
            first_name=data.first_name,
            last_name=data.last_name,
            phone=data.phone,
            level=data.level.value,
            field_of_study=data.field_of_study,
            hardship_narrative=data.hardship_narrative,
            preferred_language=data.preferred_language.value,
        )

        if data.id_number:
            # BR-A04: one ID number → one user. Check the blind index first for a friendly 409,
            # with uq_user_idnum as the database backstop against a race.
            blind = crypto.blind_index(data.id_number)
            owner = await self.pii.id_number_owner(blind)
            if owner is not None and owner != user_id:
                raise AppError(
                    "id_number_taken", "This ID number is already registered", status_code=409
                )
            await self.pii.set_id_number(
                user_id=user_id,
                id_number_enc=crypto.encrypt_bytes(data.id_number),  # AES-256-GCM → bytea
                blind_index=blind,
            )

        # Audit carries NO PII — only the fact of the change (TAD §4.4).
        await self.audit.write(
            actor_user_id=user_id,
            action="PROFILE_CREATED" if not existed else "PROFILE_UPDATED",
            resource_type="student_profile",
            resource_id=user_id,
            request_id=request_id,
            detail={"id_number_set": bool(data.id_number)},
        )
        # BR-M04 re-embed seam: profile content changed ⇒ the student's match embedding is stale.
        # The matching module (Stage 03 · module 4) consumes this signal to recompute the
        # ChromaDB vector keyed by student_profile_id; until it lands there is nothing to enqueue.
        row = await self.profiles.get(user_id)
        return _to_profile(row)

    async def upload_document(
        self,
        *,
        user_id: str,
        doc_type: str,
        application_id: str | None,
        raw: bytes,
        request_id: str,
    ) -> Document:
        # document.student_profile_id → student_profile (FK): a profile must exist first.
        if not await self.profiles.exists(user_id):
            raise AppError(
                "profile_required",
                "Create your profile before uploading documents",
                status_code=409,
            )
        # If the document is attached to an application, the student must own that application
        # (ST-2.3 — don't trust the client-supplied id past the FK existence check).
        if application_id and not await self.profiles.owns_application(user_id, application_id):
            raise AppError("invalid_application", "Application not found", status_code=422)

        clean = process_upload(raw, max_bytes=settings.document_max_bytes)  # ST-2.4
        key = f"{user_id}/{clean.sha256}.{EXTENSION[clean.content_type]}"
        storage_uri = await self.storage.put(
            key=key, data=clean.data, content_type=clean.content_type
        )
        doc_id, created_at = await self.documents.create(
            student_profile_id=user_id,
            application_id=application_id,
            doc_type=doc_type,
            storage_uri=storage_uri,
            sha256=clean.sha256,
        )
        await self.audit.write(
            actor_user_id=user_id,
            action="DOCUMENT_UPLOADED",
            resource_type="document",
            resource_id=doc_id,
            request_id=request_id,
            detail={
                "doc_type": doc_type,
                "content_type": clean.content_type,
                "av_status": "PENDING",
            },
        )
        return Document(
            id=doc_id,
            doc_type=doc_type,
            application_id=application_id,
            av_status="PENDING",  # the AV scanner flips this out-of-band (ST-2.4)
            created_at=created_at,
        )
