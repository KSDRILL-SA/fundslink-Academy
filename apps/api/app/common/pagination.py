"""Opaque keyset cursor for list endpoints (S2.20 pagination · S5.14 no unbounded results).

A cursor encodes the ``(created_at, id)`` of the last row returned; the next page selects rows
strictly older than it (a stable keyset, not OFFSET). Cursors are base64url of compact JSON —
opaque to clients, who treat ``next_cursor`` as a token. A malformed cursor decodes to None and
is treated as "from the start" (never a 500).
"""

from __future__ import annotations

import base64
import binascii
import json
from datetime import datetime

DEFAULT_LIMIT = 20
MAX_LIMIT = 100


def clamp_limit(limit: int | None) -> int:
    if not limit or limit < 1:
        return DEFAULT_LIMIT
    return min(limit, MAX_LIMIT)


def encode_cursor(created_at: datetime, row_id: str) -> str:
    raw = json.dumps([created_at.isoformat(), row_id], separators=(",", ":")).encode()
    return base64.urlsafe_b64encode(raw).decode("ascii")


def decode_cursor(cursor: str | None) -> tuple[str, str] | None:
    """Return (created_at_iso, id) or None for an absent/malformed cursor (fail-soft)."""
    if not cursor:
        return None
    try:
        created_at, row_id = json.loads(base64.urlsafe_b64decode(cursor.encode("ascii")))
        return str(created_at), str(row_id)
    except (ValueError, binascii.Error, TypeError):
        return None


def encode_keyset(*values: object) -> str:
    """Opaque cursor for a multi-key ordering (e.g. the triage-ordered review queue).

    Values are stored as strings — dates and datetimes via ``isoformat`` — and the query casts them
    back, so the SQL, not Python, stays the authority on each key's type.
    """
    parts = [v.isoformat() if hasattr(v, "isoformat") else str(v) for v in values]
    raw = json.dumps(parts, separators=(",", ":")).encode()
    return base64.urlsafe_b64encode(raw).decode("ascii")


def decode_keyset(cursor: str | None, arity: int) -> tuple[str, ...] | None:
    """The keys of a multi-key cursor, or None if absent, malformed or the wrong shape (fail-soft).

    A cursor minted for a different ordering has a different arity and is treated as "from the
    start" rather than silently mis-paginating.
    """
    if not cursor:
        return None
    try:
        values = json.loads(base64.urlsafe_b64decode(cursor.encode("ascii")))
    except (ValueError, binascii.Error, TypeError):
        return None
    if not isinstance(values, list) or len(values) != arity:
        return None
    return tuple(str(v) for v in values)
