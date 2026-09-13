"""Eligibility repositories (DB-D2 boundary). Named-bind SQL only (S5.21).

Rulesets are config-as-data (BR-E02); pre_screen_result + application_return are append/cycle
records the engine writes under SYSTEM/staff context (rls_psr_insert / rls_ar_insert are
staff-only). The application reads (status/type/owner) are reused from the application module.
"""

from __future__ import annotations

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
        """Types present AND still valid — an EXPIRED doc no longer counts as 'present' so the

        required-doc check fails into the fix-list → RETURNED, never a rejection (D-005 / BR-E10).
        """
        rows = await sql.fetch_all(
            self.session,
            "SELECT DISTINCT doc_type FROM document"
            " WHERE student_profile_id = :owner AND deleted_at IS NULL AND av_status <> 'INFECTED'"
            " AND (valid_until IS NULL OR valid_until >= current_date)",
            owner=owner_id,
        )
        return frozenset(r[0] for r in rows)

    async def expired_document_types(self, owner_id: str) -> frozenset[str]:
        """Types the student uploaded that have lapsed (valid_until past) — for a kind fix-list."""
        rows = await sql.fetch_all(
            self.session,
            "SELECT DISTINCT doc_type FROM document"
            " WHERE student_profile_id = :owner AND deleted_at IS NULL AND av_status <> 'INFECTED'"
            " AND valid_until IS NOT NULL AND valid_until < current_date",
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

    async def declaration_fields(self, application_id: str) -> dict[str, str | None]:
        """Self-declared signals the engine ANNOTATES on (D-016/D-017); migration 0016 columns."""
        row = await sql.fetch_one(
            self.session,
            "SELECT household_income_band, nsfas_decline_reason, prior_funder, defunded_by"
            " FROM funding_application WHERE id = :app",
            app=application_id,
        )
        if row is None:
            return {}
        return {
            "household_income_band": row[0],
            "nsfas_decline_reason": row[1],
            "prior_funder": row[2],
            "defunded_by": row[3],
        }


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

    async def insert(self, *, application_id: str, cycle_no: int, fix_list: list[str]) -> None:
        """Record a return. ``respond_by`` is today plus ``return_respond_days`` (config, D-006).

        The window was a literal ``14`` here. It is computed in SQL from the config table, on the
        database's date, so the reminder job and this insert can never disagree about "today". A
        missing key leaves ``respond_by`` NULL: no date is an honest answer, an invented one is not.
        """
        import json

        await sql.execute(
            self.session,
            "INSERT INTO application_return (id, application_id, cycle_no, fix_list, respond_by)"
            " VALUES (:id, :app, :cycle, :fix,"
            "  current_date + (SELECT value::int FROM config WHERE key = 'return_respond_days'))",
            id=cuid(),
            app=application_id,
            cycle=cycle_no,
            fix=json.dumps(fix_list),
        )

    async def mark_resolved(self, application_id: str) -> None:
        await sql.execute(
            self.session,
            "UPDATE application_return SET resolved_at = now()"
            " WHERE application_id = :app AND resolved_at IS NULL",
            app=application_id,
        )
