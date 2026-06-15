"""Cross-store integrity for matching (DB-D35) — PostgreSQL ↔ MongoDB reasoning reconciliation.

The match record lives in PostgreSQL (match_result); its reasoning lives in the MongoDB store,
keyed by the PG id (S5.5). This job reconciles the two sides: every PG match should have a
reasoning document, and no reasoning document should be orphaned. It is pure set logic over the
two id sets, so it is testable with the in-memory store and wires straight onto a live Mongo at
deploy. The DB-side integrity job (app.db.integrity) defers cross-store scanning to this seam.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.db import sql


@dataclass
class CrossStoreReport:
    pg_match_count: int
    reasoning_count: int
    missing_reasoning: list[str]  # PG match ids with no reasoning document
    orphan_reasoning: list[str]  # reasoning documents with no PG match

    @property
    def ok(self) -> bool:
        return not self.missing_reasoning and not self.orphan_reasoning


def reconcile(pg_match_ids: set[str], reasoning_match_ids: set[str]) -> CrossStoreReport:
    return CrossStoreReport(
        pg_match_count=len(pg_match_ids),
        reasoning_count=len(reasoning_match_ids),
        missing_reasoning=sorted(pg_match_ids - reasoning_match_ids),
        orphan_reasoning=sorted(reasoning_match_ids - pg_match_ids),
    )


async def reconcile_stores(session, reasoning_store) -> CrossStoreReport:
    """Gather both id sets and reconcile (DB-D35). Caller is in staff/SYSTEM context."""
    rows = await sql.fetch_all(session, "SELECT id FROM match_result")
    pg_ids = {r[0] for r in rows}
    reasoning_ids = await reasoning_store.all_match_ids()
    return reconcile(pg_ids, reasoning_ids)
