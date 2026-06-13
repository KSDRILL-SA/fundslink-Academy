"""Standard response envelope — { success, data, error } (S2.19).

Used by every endpoint so the Angular client validates one shape.
"""

from typing import Any


def ok(data: Any = None) -> dict:
    """Success envelope."""
    return {"success": True, "data": data, "error": None}


def err(code: str, message: str) -> dict:
    """Error envelope."""
    return {"success": False, "data": None, "error": {"code": code, "message": message}}
