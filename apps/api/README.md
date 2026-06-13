# apps/api — FundsLink FastAPI service

Stage-00 scaffold: liveness only (`GET /healthz`). Layering is **router → service →
repository**; only repositories may import DB drivers (import-linter enforces this in CI).
Endpoints are added FROM `packages/contracts/openapi.yaml` (`S2.7`) — never invented.

## Local (without Docker)
```bash
python -m venv .venv && . .venv/Scripts/activate   # Windows
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000
# -> http://localhost:8000/healthz
```

## Test / lint
```bash
pytest
ruff check .
```
