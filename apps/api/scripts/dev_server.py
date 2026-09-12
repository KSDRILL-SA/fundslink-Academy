"""Run the API locally on a machine with no Redis.

Why this exists
---------------
Every authenticated request checks the token deny-list, and the login path is
rate-limited; both live in Redis. On a developer machine without Docker there is
often no Redis server to point at, and the API is then unusable locally — which
is how this project reached Stage 04 with the frontend never once talking to the
real backend.

The test suite already solves this by injecting ``fakeredis``. This does the
same thing for a local run: an in-memory stand-in, in this process, for this
process only.

What it is NOT
--------------
This is not a way to deploy without Redis. The deny-list is what makes a signed
-out token actually dead, and an in-memory one is empty on every restart and
invisible to a second worker. So the launcher refuses to start unless
ENVIRONMENT is ``development``, and says plainly what it has replaced.

Usage
-----
    DATABASE_URL=... RS256_PRIVATE_KEY=... python -m scripts.dev_server

Everything else — the database, the keys, the settings — is the real thing.
"""

from __future__ import annotations

import os
import sys


def main() -> int:
    environment = os.environ.get("ENVIRONMENT", "development")
    if environment != "development":
        print(
            f"refusing to start: ENVIRONMENT is {environment!r}.\n"
            "This launcher replaces Redis with an in-memory stand-in and is for local "
            "development only. Run uvicorn directly against a real Redis instead.",
            file=sys.stderr,
        )
        return 2

    import fakeredis.aioredis

    from app.modules.auth import ratelimit

    # One instance for the life of the process, so a token denied on one request
    # is still denied on the next — the behaviour that matters for testing sign
    # out, refresh and rate limiting end to end.
    shared = fakeredis.aioredis.FakeRedis(decode_responses=True)
    ratelimit.get_redis = lambda: shared  # type: ignore[assignment]

    print("=" * 72)
    print("FundsLink API — local development server")
    print("  database : real PostgreSQL (from DATABASE_URL)")
    print("  redis    : IN-MEMORY STAND-IN (fakeredis) — not a real deny-list")
    print("             a restart forgets every denied token; never use this beyond dev")
    print("=" * 72)

    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=os.environ.get("API_HOST", "127.0.0.1"),
        port=int(os.environ.get("API_PORT", "8000")),
        reload=False,
        log_level=os.environ.get("API_LOG_LEVEL", "info"),
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
