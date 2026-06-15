"""Matching PostgreSQL repositories (DB-D2 boundary). Named-bind SQL only (S5.21).

PostgreSQL holds the structured match record (score + provenance + mode) and the bursary catalog;
the AI reasoning and embeddings live in MongoDB/ChromaDB behind the store ports. BR-M03 — an
expired-deadline bursary cannot produce a new match — is a query predicate here.
"""

from __future__ import annotations

from decimal import Decimal

from app.db import sql
from app.db.cuid import cuid
from app.db.repository import BaseRepository

# A bursary is matchable when it is open AND not past every deadline (BR-M03). next_deadline is
# the soonest still-future deadline (NULL ⇒ none scheduled, which does not exclude it).
_NEXT_DEADLINE = (
    "(SELECT min(bd.due_on) FROM bursary_deadline bd"
    " WHERE bd.external_bursary_id = eb.id AND bd.due_on >= CURRENT_DATE)"
)
_NOT_EXPIRED = (
    "eb.status IN ('OPEN','CLOSING_SOON') AND ("
    " NOT EXISTS (SELECT 1 FROM bursary_deadline bd WHERE bd.external_bursary_id = eb.id)"
    " OR EXISTS (SELECT 1 FROM bursary_deadline bd"
    "            WHERE bd.external_bursary_id = eb.id AND bd.due_on >= CURRENT_DATE))"
)
_BURSARY_COLS = (
    "eb.id, eb.name, eb.provider, eb.status, eb.level_eligibility, eb.field_tags,"
    f" {_NEXT_DEADLINE} AS next_deadline, eb.source_url"
)


class ProfileReadRepository(BaseRepository):
    async def matching_profile(self, student_id: str):
        """Profile fields used to build the matching embedding (no PII narrative in the vector)."""
        return await sql.fetch_one(
            self.session,
            "SELECT level, field_of_study FROM student_profile"
            " WHERE id = :id AND deleted_at IS NULL",
            id=student_id,
        )


class BursaryRepository(BaseRepository):
    async def candidates(self, *, limit: int = 200) -> list:
        return await sql.fetch_all(
            self.session,
            f"SELECT {_BURSARY_COLS} FROM external_bursary eb"
            f" WHERE eb.deleted_at IS NULL AND {_NOT_EXPIRED}"
            " ORDER BY eb.created_at DESC LIMIT :limit",
            limit=limit,
        )

    async def get_many(self, ids: list[str]) -> dict:
        if not ids:
            return {}
        rows = await sql.fetch_all(
            self.session,
            f"SELECT {_BURSARY_COLS} FROM external_bursary eb WHERE eb.id = ANY(:ids)",
            ids=ids,
        )
        return {r[0]: r for r in rows}

    async def browse(self, *, limit: int, after, level: str | None, field: str | None) -> list:
        where = "eb.deleted_at IS NULL"
        params: dict = {}
        if level:
            where += " AND :level = ANY(eb.level_eligibility)"
            params["level"] = level
        if field:
            where += " AND :field = ANY(eb.field_tags)"
            params["field"] = field
        if after is not None:
            where += " AND (eb.created_at, eb.id) < (:c_created, :c_id)"
            params |= {"c_created": after[0], "c_id": after[1]}
        return await sql.fetch_all(
            self.session,
            f"SELECT {_BURSARY_COLS}, eb.created_at FROM external_bursary eb"
            f" WHERE {where} ORDER BY eb.created_at DESC, eb.id DESC LIMIT :limit",
            limit=limit + 1,
            **params,
        )


class MatchResultRepository(BaseRepository):
    async def insert(
        self,
        *,
        student_profile_id: str,
        external_bursary_id: str,
        score: Decimal,
        model_version: str,
        prompt_version: str,
        mode: str,
    ) -> str:
        match_id = cuid()
        # ON CONFLICT (student, bursary, model_version): a re-run refreshes the score/mode rather
        # than duplicating (uq_match). RETURNING gives the id whether inserted or updated.
        row = await sql.fetch_one(
            self.session,
            "INSERT INTO match_result"
            " (id, student_profile_id, external_bursary_id, score, model_version, prompt_version,"
            "  mode, created_by)"
            " VALUES (:id, :sp, :eb, :score, :mv, :pv, :mode, 'SYSTEM')"
            " ON CONFLICT (student_profile_id, external_bursary_id, model_version)"
            " DO UPDATE SET score = EXCLUDED.score, mode = EXCLUDED.mode"
            " RETURNING id",
            id=match_id,
            sp=student_profile_id,
            eb=external_bursary_id,
            score=score,
            mv=model_version,
            pv=prompt_version,
            mode=mode,
        )
        return row[0]

    async def list_for_student(self, student_id: str, *, limit: int, after) -> list:
        where = "mr.student_profile_id = :sp"
        params: dict = {"sp": student_id}
        if after is not None:
            where += " AND (mr.created_at, mr.id) < (:c_created, :c_id)"
            params |= {"c_created": after[0], "c_id": after[1]}
        return await sql.fetch_all(
            self.session,
            "SELECT mr.id, mr.external_bursary_id, mr.score, mr.mode, mr.created_at"
            f" FROM match_result mr WHERE {where}"
            " ORDER BY mr.created_at DESC, mr.id DESC LIMIT :limit",
            limit=limit + 1,
            **params,
        )


class ConfigRepository(BaseRepository):
    async def get_decimal(self, key: str, default: Decimal) -> Decimal:
        row = await sql.fetch_one(
            self.session, "SELECT value FROM config WHERE key = :k", k=key
        )
        return Decimal(row[0]) if row else default

    async def get_int(self, key: str, default: int) -> int:
        row = await sql.fetch_one(
            self.session, "SELECT value FROM config WHERE key = :k", k=key
        )
        return int(row[0]) if row else default
