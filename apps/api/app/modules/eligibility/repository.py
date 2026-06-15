"""Eligibility repositories (DB-D2 boundary). Named-bind SQL only (S5.21).

Rulesets are config-as-data (BR-E02); pre_screen_result + application_return are append/cycle
records the engine writes under SYSTEM/staff context (rls_psr_insert / rls_ar_insert are
staff-only). The application reads (status/type/owner) are reused from the application module.
"""

from __future__ import annotations

from datetime import date, timedelta

from app.db import sql
from app.db.cuid import cuid
from app.db.repository import BaseRepository


class RulesetRepository(BaseRepository):
    async def effective(self, application_type: str):
        """The ruleset version effective now for this type (BR-E02) — highest effective version."""
        return await sql.fetch_one(
            self.session,
            "SELECT id, rules FROM eligibility_ruleset"
            " WHERE application_type = :type AND effective_from <= now()"
            " ORDER BY version DESC LIMIT 1",
            type=application_type,
        )

    async def by_id(self, ruleset_id: str):
        return await sql.fetch_one(
            self.session,
            "SELECT id, rules FROM eligibility_ruleset WHERE id = :id",
            id=ruleset_id,
        )


class FactsRepository(BaseRepository):
    async def document_types(self, owner_id: str) -> frozenset[str]:
        rows = await sql.fetch_all(
            self.session,
            "SELECT DISTINCT doc_type FROM document"
            " WHERE student_profile_id = :owner AND deleted_at IS NULL AND av_status <> 'INFECTED'",
            owner=owner_id,
        )
        return frozenset(r[0] for r in rows)

    async def has_motivation(self, application_id: str) -> bool:
        row = await sql.fetch_one(
            self.session,
            "SELECT 1 FROM application_motivation WHERE application_id = :app",
            app=application_id,
        )
        return row is not None


class PreScreenResultRepository(BaseRepository):
    async def insert(
        self, *, application_id: str, ruleset_id: str, outcome: str, checks: dict
    ) -> None:
        import json

        await sql.execute(
            self.session,
            "INSERT INTO pre_screen_result (id, application_id, ruleset_id, outcome, checks)"
            " VALUES (:id, :app, :rs, :outcome, :checks)",
            id=cuid(),
            app=application_id,
            rs=ruleset_id,
            outcome=outcome,
            checks=json.dumps(checks),
        )

    async def pinned_ruleset(self, application_id: str) -> str | None:
        """The ruleset used at the first screen — re-used on resubmit so goalposts don't move."""
        row = await sql.fetch_one(
            self.session,
            "SELECT ruleset_id FROM pre_screen_result"
            " WHERE application_id = :app ORDER BY created_at ASC LIMIT 1",
            app=application_id,
        )
        return row[0] if row else None


class ReturnRepository(BaseRepository):
    async def next_cycle(self, application_id: str) -> int:
        row = await sql.fetch_one(
            self.session,
            "SELECT coalesce(max(cycle_no), 0) + 1 FROM application_return"
            " WHERE application_id = :app",
            app=application_id,
        )
        return int(row[0])

    async def insert(
        self, *, application_id: str, cycle_no: int, fix_list: list[str], respond_days: int = 14
    ) -> None:
        import json

        await sql.execute(
            self.session,
            "INSERT INTO application_return (id, application_id, cycle_no, fix_list, respond_by)"
            " VALUES (:id, :app, :cycle, :fix, :respond_by)",
            id=cuid(),
            app=application_id,
            cycle=cycle_no,
            fix=json.dumps(fix_list),
            respond_by=date.today() + timedelta(days=respond_days),
        )

    async def mark_resolved(self, application_id: str) -> None:
        await sql.execute(
            self.session,
            "UPDATE application_return SET resolved_at = now()"
            " WHERE application_id = :app AND resolved_at IS NULL",
            app=application_id,
        )
