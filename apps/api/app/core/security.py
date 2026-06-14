"""Platform-level web security: CORS allowlist (S3.29) + security headers (S3.31/S3.28).

Configured once on the app, never per-route (S3.31 anti-pattern AP-S3.31a) so no endpoint
can ship unprotected. The API serves JSON only, so the CSP is maximally tight.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings

# Tight, JSON-API-appropriate header set. CSP locks the document down entirely; the SPA is
# served by Vercel with its own CSP (C4) — this protects the API origin itself.
_BASE_HEADERS = {
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
}


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Attach the security-baseline headers to every response (S3.31)."""

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        response = await call_next(request)
        for key, value in _BASE_HEADERS.items():
            response.headers.setdefault(key, value)
        # HSTS only in production over TLS (S3.28) — never weaken transport in prod.
        if settings.is_production:
            response.headers.setdefault(
                "Strict-Transport-Security", "max-age=31536000; includeSubDomains"
            )
        return response


def install_security(app: FastAPI) -> None:
    """Wire CORS (explicit allowlist, never wildcard — S3.29) and the security headers."""
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,  # explicit list from env (S3.29); never ["*"]
        allow_credentials=True,  # refresh cookie is cross-origin (Angular SPA -> API)
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID", "Idempotency-Key"],
        max_age=600,
    )
