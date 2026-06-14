"""Web security baseline — CORS (S3.29), security headers (S3.31), Sentry hook (S3.34)."""

from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.observability import init_sentry
from app.main import app

client = TestClient(app, raise_server_exceptions=False)


def test_security_headers_present_on_every_response():
    r = client.get("/healthz")
    assert r.status_code == 200
    assert r.headers["X-Content-Type-Options"] == "nosniff"
    assert r.headers["X-Frame-Options"] == "DENY"
    assert r.headers["Referrer-Policy"] == "strict-origin-when-cross-origin"
    assert "default-src 'none'" in r.headers["Content-Security-Policy"]
    assert "Permissions-Policy" in r.headers


def test_hsts_absent_outside_production():
    # environment=development in tests -> HSTS must NOT be asserted (S3.28 is prod-only here)
    assert not settings.is_production
    assert "Strict-Transport-Security" not in client.get("/healthz").headers


def test_cors_allows_configured_origin():
    origin = settings.cors_origins[0]
    r = client.get("/healthz", headers={"Origin": origin})
    assert r.headers.get("access-control-allow-origin") == origin


def test_cors_does_not_echo_unknown_origin():
    r = client.get("/healthz", headers={"Origin": "https://evil.example.com"})
    # Starlette only emits ACAO for allow-listed origins; never wildcard (S3.29 / AP-S3.29a).
    assert r.headers.get("access-control-allow-origin") != "https://evil.example.com"
    assert r.headers.get("access-control-allow-origin") != "*"


def test_debug_sentry_route_raises_for_capture():
    # Proves the Sentry capture path (Gate G2) — non-prod meta route, excluded from schema.
    resp = client.get("/debug-sentry")
    assert resp.status_code == 500
    # The generic exception handler returns the uniform envelope, never a stack trace.
    error = resp.json()["error"]
    assert error["code"] == "internal_error" and "request_id" in error


def test_sentry_disabled_without_dsn():
    # No DSN in dev/test => init is a no-op, never crashes import or boot.
    assert settings.sentry_dsn == ""
    assert init_sentry() is False


def test_meta_routes_excluded_from_openapi_contract_surface():
    # /healthz and /debug-sentry must not pollute the OpenAPI schema the contract diff checks.
    paths = app.openapi()["paths"]
    assert "/healthz" not in paths
    assert "/debug-sentry" not in paths
