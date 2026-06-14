"""Per-request correlation id (TAD §2.3).

Honours an inbound ``X-Request-ID`` (the Angular interceptor attaches one — S3.15) or mints a
``req_<cuid>``. Stored on ``request.state`` for handlers/audit and echoed on the response so
support and incident debugging can follow a single request across logs.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.db.cuid import cuid

HEADER = "X-Request-ID"


def get_request_id(request: Request) -> str:
    return getattr(request.state, "request_id", "req_unknown")


class RequestIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        request_id = request.headers.get(HEADER) or f"req_{cuid()}"
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers[HEADER] = request_id
        return response
