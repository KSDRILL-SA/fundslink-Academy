"""Config-as-data reads (DB-D24) — the one place business values are looked up.

CLAUDE.md: "No hardcoded business values — config table (allowance, SLAs, budgets)." Every value
that decides how the platform treats a student — an SLA, an allowance, a reminder cadence — is a
row in ``config``, changeable without a deploy.

This lived in ``app.modules.matching.repository`` because matching needed it first. Three modules
need it now, and a shared read has no business being reached for through one domain's repository,
so it sits in the repository layer where every module can use it without importing a peer.

Every reader takes the current value as its ``default``. A missing key therefore behaves exactly
as the code did before the key existed, and a deployment whose migrations have not run yet keeps
working rather than failing on a NULL.
"""

from __future__ import annotations

from decimal import Decimal, InvalidOperation

from app.db import sql
from app.db.repository import BaseRepository


class ConfigRepository(BaseRepository):
    async def _value(self, key: str) -> str | None:
        row = await sql.fetch_one(self.session, "SELECT value FROM config WHERE key = :k", k=key)
        return row[0] if row else None

    async def get_decimal(self, key: str, default: Decimal) -> Decimal:
        raw = await self._value(key)
        if raw is None:
            return default
        try:
            return Decimal(raw)
        except InvalidOperation:
            return default

    async def get_int(self, key: str, default: int) -> int:
        raw = await self._value(key)
        if raw is None:
            return default
        try:
            return int(raw)
        except ValueError:
            return default

    async def get_int_list(self, key: str, default: tuple[int, ...]) -> tuple[int, ...]:
        """A comma-separated sequence, for a rule that is a cadence rather than one number.

        BR-T06's follow-ups are "30, 45 and 60 days of silence" — a list, and a list is what the
        row holds. A malformed value falls back to ``default`` instead of raising or returning
        nothing: this is read by a scheduled job, where an exception is a silent night and an
        empty list is a student nobody follows up on. Neither failure would be noticed.
        """
        raw = await self._value(key)
        if raw is None:
            return default
        try:
            parsed = tuple(int(part) for part in raw.split(",") if part.strip())
        except ValueError:
            return default
        return parsed if parsed and all(day > 0 for day in parsed) else default
