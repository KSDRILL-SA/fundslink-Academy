"""Shared auth-test fixtures: an ephemeral RS256 key pair wired into settings.

Keys are generated per test session and never touch disk (S3.20 — no committed key material).
"""

from __future__ import annotations

import os
import subprocess
import sys
from contextlib import contextmanager
from pathlib import Path

import fakeredis.aioredis
import psycopg
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient
from sqlalchemy.engine import make_url

from app.core.config import settings

_API_DIR = Path(__file__).resolve().parents[2]
_APP_PW = "ci_auth_endpoints_probe"


def _build_app(extra_routers):
    """A fresh app mirroring main.py (security, request-id, error envelope, auth router) plus
    any extra routers — isolated so tests can mount a dummy resource without touching the real
    contract surface."""
    from fastapi import FastAPI

    from app.common.errors import install_error_handlers
    from app.common.request_id import RequestIdMiddleware
    from app.core.security import install_security
    from app.modules.auth.router import router as auth_router

    app = FastAPI()
    install_security(app)
    app.add_middleware(RequestIdMiddleware)
    install_error_handlers(app)
    app.include_router(auth_router, prefix="/api/v1")
    for extra in extra_routers:
        app.include_router(extra, prefix="/api/v1")
    return app


@contextmanager
def auth_test_client(migrated_db, monkeypatch, *, extra_routers=()):
    """Build a TestClient wired to the real DB AS fundslink_app, fakeredis, and stubbed HIBP."""
    admin = psycopg.connect(migrated_db, autocommit=True)
    admin.execute(f"ALTER ROLE fundslink_app LOGIN PASSWORD '{_APP_PW}'")

    app_url = make_url(migrated_db.replace("postgresql://", "postgresql+asyncpg://")).set(
        username="fundslink_app", password=_APP_PW
    )
    monkeypatch.setattr(settings, "database_url", app_url.render_as_string(hide_password=False))

    import app.db.engine as engine_mod
    import app.modules.auth.ratelimit as ratelimit_mod
    from app.modules.auth import passwords

    engine_mod._engine = None
    engine_mod._session_factory = None
    ratelimit_mod._client = fakeredis.aioredis.FakeRedis(decode_responses=True)
    monkeypatch.setattr(passwords, "is_breached", _not_breached)

    try:
        with TestClient(_build_app(extra_routers)) as test_client:
            yield test_client
    finally:
        engine_mod._engine = None
        engine_mod._session_factory = None
        ratelimit_mod._client = None
        admin.execute("ALTER ROLE fundslink_app NOLOGIN")
        admin.close()


@pytest.fixture(scope="session", autouse=True)
def rs256_keys():
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_pem = key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    ).decode()
    public_pem = (
        key.public_key()
        .public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo)
        .decode()
    )
    prev_priv, prev_pub = settings.rs256_private_key, settings.rs256_public_key
    settings.rs256_private_key = private_pem
    settings.rs256_public_key = public_pem
    yield {"private": private_pem, "public": public_pem}
    settings.rs256_private_key, settings.rs256_public_key = prev_priv, prev_pub


def _conninfo() -> str:
    url = (
        os.environ.get("ALEMBIC_DATABASE_URL")
        or os.environ.get("DATABASE_URL")
        or "postgresql://fundslink:fundslink@localhost:5432/fundslink"
    )
    return url.replace("+asyncpg", "").replace("+psycopg", "")


@pytest.fixture(scope="session")
def migrated_db() -> str:
    """Ensure the schema is at head (idempotent) and return a sync conninfo."""
    conninfo = _conninfo()
    subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=_API_DIR,
        env={**os.environ, "ALEMBIC_DATABASE_URL": conninfo},
        check=True,
        capture_output=True,
    )
    return conninfo


@pytest.fixture
def client(migrated_db, rs256_keys, monkeypatch):
    """Full-stack TestClient (router → service → repository → RLS-enforced DB), production-like."""
    with auth_test_client(migrated_db, monkeypatch) as test_client:
        yield test_client


async def _not_breached(password: str, *, client=None) -> bool:  # noqa: ARG001
    return False
