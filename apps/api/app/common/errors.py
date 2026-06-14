"""Uniform error envelope (TAD §2.3): every non-2xx is ``{error:{code,message,request_id}}``.

Services raise ``AppError`` with a stable ``code`` (clients branch on code, never on message —
messages are human copy and may change). FastAPI ``HTTPException`` and validation errors are
mapped to the same shape so the Angular client validates one error contract everywhere.
"""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.common.request_id import get_request_id

# Stable codes by HTTP status for HTTPException without an explicit code.
_STATUS_CODE = {
    400: "bad_request",
    401: "unauthorized",
    403: "forbidden",
    404: "not_found",
    409: "conflict",
    413: "payload_too_large",
    422: "validation_error",
    429: "rate_limited",
}


class AppError(Exception):
    """A domain error carrying a stable client code + HTTP status (S2.19 / TAD §2.3)."""

    def __init__(
        self, code: str, message: str, *, status_code: int = 400, details: dict | None = None
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or {}


def _envelope(request: Request, code: str, message: str, details: Any = None) -> dict:
    error: dict[str, Any] = {
        "code": code,
        "message": message,
        "request_id": get_request_id(request),
    }
    if details:
        error["details"] = details
    return {"error": error}


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_envelope(request, exc.code, exc.message, exc.details or None),
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = _STATUS_CODE.get(exc.status_code, "error")
        message = exc.detail if isinstance(exc.detail, str) else code
        return JSONResponse(
            status_code=exc.status_code,
            content=_envelope(request, code, message),
            headers=getattr(exc, "headers", None),
        )

    @app.exception_handler(RequestValidationError)
    async def _validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content=_envelope(
                request, "validation_error", "Request validation failed", exc.errors()
            ),
        )
