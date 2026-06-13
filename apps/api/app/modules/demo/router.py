"""TEMP: deliberate import-linter violation to prove the gate bites in CI. Reverted next commit."""
import sqlalchemy  # noqa: F401  -- routers may NOT import DB drivers (only repositories may)

router = None
