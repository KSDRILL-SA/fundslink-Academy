"""FastAPI entrypoint. Stage-00 scaffold: liveness only — no business logic, no DB.

Endpoints beyond /healthz are added FROM packages/contracts/FUNDSLINK-API-v1.yaml
in later stages (S2.7). Do not invent endpoints here.
"""

from fastapi import FastAPI

from app.core.config import settings

app = FastAPI(title=settings.app_name, version=settings.app_version)


@app.get("/healthz", tags=["meta"])
async def healthz() -> dict:
    """Liveness probe — no auth, no DB. Returns ok while the process is up."""
    return {"success": True, "data": {"status": "ok"}, "error": None}
