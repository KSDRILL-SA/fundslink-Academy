"""Matching spend circuit breaker + per-user quota (Redis) — S5.3-safe (counts, never money).

Two protections on the matching cost (ST-2.6 matching cost attack):
  * **Spend breaker** — a daily CALL budget. The ZAR budget + cost-per-call live in PostgreSQL
    config (DB-D24); the service derives ``max_calls = budget / cost_per_call`` and this counter
    tracks how many live (embedding) calls were made today. Over budget ⇒ LIVE is refused and the
    match degrades to FALLBACK (S8.51) — never an error to the student.
  * **Per-user quota** — a daily cap on match runs per user; over it ⇒ 429.

Every key is under the ``match:`` allowlist prefix and every value is a small integer COUNT —
no Redis value is ever a funding amount (S5.3 / store-isolation guard).
"""

from __future__ import annotations

from datetime import UTC, datetime

_TTL = 172_800  # 2 days — counters self-expire; the day key rolls naturally


def _today() -> str:
    return datetime.now(UTC).date().isoformat()


def spend_key() -> str:
    return f"match:spend:{_today()}"


def quota_key(user_id: str) -> str:
    return f"match:quota:{user_id}:{_today()}"


class MatchSpendBreaker:
    def __init__(self, redis) -> None:
        self.redis = redis

    async def allow_live(self, *, max_calls: int) -> bool:
        """True ⇒ a live (paid) call is within budget and one unit is consumed; False ⇒ FALLBACK."""
        key = spend_key()
        current = int(await self.redis.get(key) or 0)
        if current >= max_calls:
            return False  # budget exhausted — degrade to FALLBACK, no spend
        await self.redis.incr(key)
        await self.redis.expire(key, _TTL)
        return True


class MatchQuota:
    def __init__(self, redis) -> None:
        self.redis = redis

    async def within_quota(self, user_id: str, *, limit: int) -> bool:
        """Increment the user's daily run count; True if still within ``limit`` (else 429)."""
        key = quota_key(user_id)
        count = await self.redis.incr(key)
        await self.redis.expire(key, _TTL)
        return count <= limit
