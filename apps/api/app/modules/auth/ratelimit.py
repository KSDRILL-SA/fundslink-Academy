"""Redis-backed deny-list (S3.18) and three-layer auth rate limiting (S3.4).

Redis is a TTL-backed cache/deny-list only, never the primary store (S3.2). All three S3.4
layers run together:
  L1  10 requests / IP / 15 min
  L2  5 failed logins / identifier / 15 min  -> 15-min lock (caller returns the *identical*
      error during lock so a locked account is indistinguishable — AP-S3.4b)
  L3  1000 auth requests / minute / global (credential-stuffing brake)

The classes take a redis client so tests inject fakeredis; production uses ``get_redis()``.
"""

from __future__ import annotations

import redis.asyncio as aioredis

from app.core.config import settings

# S3.4 thresholds.
IP_LIMIT, IP_WINDOW = 10, 900
FAIL_LIMIT, LOCK_WINDOW = 5, 900
GLOBAL_LIMIT, GLOBAL_WINDOW = 1000, 60

_client: aioredis.Redis | None = None


def get_redis() -> aioredis.Redis:
    """Process-wide async Redis client (lazy)."""
    global _client
    if _client is None:
        _client = aioredis.from_url(settings.redis_url, decode_responses=True)
    return _client


class TokenDenyList:
    """Access-token JTI deny-list — TTL = remaining access-token lifetime (S3.18)."""

    def __init__(self, client: aioredis.Redis) -> None:
        self._r = client

    async def deny(self, jti: str, ttl_seconds: int) -> None:
        await self._r.set(f"denylist:jti:{jti}", "1", ex=max(int(ttl_seconds), 1))

    async def is_denied(self, jti: str) -> bool:
        return bool(await self._r.exists(f"denylist:jti:{jti}"))


class LoginRateLimiter:
    """The three S3.4 layers + per-identifier lockout."""

    def __init__(self, client: aioredis.Redis) -> None:
        self._r = client

    async def _incr_window(self, key: str, window: int) -> int:
        n = await self._r.incr(key)
        if n == 1:
            await self._r.expire(key, window)
        return int(n)

    async def ip_allowed(self, ip: str) -> bool:
        return await self._incr_window(f"rl:ip:{ip}", IP_WINDOW) <= IP_LIMIT

    async def global_allowed(self) -> bool:
        return await self._incr_window("rl:global", GLOBAL_WINDOW) <= GLOBAL_LIMIT

    async def is_locked(self, identifier: str) -> bool:
        return bool(await self._r.exists(f"rl:lock:{identifier}"))

    async def record_failure(self, identifier: str) -> bool:
        """Count a failed attempt; lock for 15 min at the 5th. Returns True if now locked."""
        n = await self._incr_window(f"rl:fail:{identifier}", LOCK_WINDOW)
        if n >= FAIL_LIMIT:
            await self._r.set(f"rl:lock:{identifier}", "1", ex=LOCK_WINDOW)
            return True
        return False

    async def clear_failures(self, identifier: str) -> None:
        """Reset counters on a successful login."""
        await self._r.delete(f"rl:fail:{identifier}", f"rl:lock:{identifier}")
