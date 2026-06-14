"""FastAPI entrypoint.

Wires the security baseline (CORS S3.29 + headers S3.31) and Sentry (S3.34) onto the app.
Business endpoints are added FROM packages/contracts/openapi.yaml in the auth/backend stages
(S2.7) — never invented here. /healthz and /debug-sentry are meta routes (not business API)
and are excluded from the OpenAPI contract surface.
"""

from fastapi import FastAPI

from app.core.config import settings
from app.core.observability import init_sentry
from app.core.security import install_security

init_sentry()

app = FastAPI(title=settings.app_name, version=settings.app_version)
install_security(app)


@app.get("/healthz", tags=["meta"], include_in_schema=False)
async def healthz() -> dict:
    """Liveness probe — no auth, no DB. Returns ok while the process is up."""
    return {"success": True, "data": {"status": "ok"}, "error": None}


if not settings.is_production:
    @app.get("/debug-sentry", tags=["meta"], include_in_schema=False)
    async def debug_sentry() -> dict:
        """Deliberately raise so Sentry capture can be proven (Gate G2). Non-prod only."""
        raise RuntimeError("debug-sentry: intentional test error for Sentry verification")
