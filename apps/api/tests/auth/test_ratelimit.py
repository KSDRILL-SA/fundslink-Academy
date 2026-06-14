"""Redis deny-list + three-layer rate limiting (S3.4 · S3.18) — over fakeredis."""

import fakeredis.aioredis
import pytest

from app.modules.auth import ratelimit
from app.modules.auth.ratelimit import FAIL_LIMIT, IP_LIMIT, LoginRateLimiter, TokenDenyList


@pytest.fixture
def redis_client():
    return fakeredis.aioredis.FakeRedis(decode_responses=True)


async def test_denylist_denies_only_the_listed_jti(redis_client):
    dl = TokenDenyList(redis_client)
    await dl.deny("jti-abc", ttl_seconds=900)
    assert await dl.is_denied("jti-abc") is True
    assert await dl.is_denied("jti-other") is False


async def test_denylist_ttl_is_floored_to_one_second(redis_client):
    dl = TokenDenyList(redis_client)
    await dl.deny("jti-zero", ttl_seconds=0)  # already-expired token still gets a 1s floor
    assert await dl.is_denied("jti-zero") is True


async def test_ip_layer_blocks_after_limit(redis_client):
    rl = LoginRateLimiter(redis_client)
    for _ in range(IP_LIMIT):
        assert await rl.ip_allowed("1.2.3.4") is True
    assert await rl.ip_allowed("1.2.3.4") is False  # the 11th is blocked (L1)


async def test_lockout_after_five_failures_and_identical_during_lock(redis_client):
    rl = LoginRateLimiter(redis_client)
    ident = "user@t.test|1.2.3.4"
    for _ in range(FAIL_LIMIT - 1):
        assert await rl.record_failure(ident) is False
        assert await rl.is_locked(ident) is False
    assert await rl.record_failure(ident) is True  # 5th locks (L2)
    assert await rl.is_locked(ident) is True


async def test_clear_failures_unlocks(redis_client):
    rl = LoginRateLimiter(redis_client)
    ident = "user@t.test|1.2.3.4"
    for _ in range(FAIL_LIMIT):
        await rl.record_failure(ident)
    await rl.clear_failures(ident)
    assert await rl.is_locked(ident) is False


async def test_global_layer_allows_under_limit(redis_client):
    rl = LoginRateLimiter(redis_client)
    assert await rl.global_allowed() is True  # L3 brake present, far under 1000


def test_thresholds_match_s3_4():
    assert (ratelimit.IP_LIMIT, ratelimit.FAIL_LIMIT, ratelimit.GLOBAL_LIMIT) == (10, 5, 1000)
