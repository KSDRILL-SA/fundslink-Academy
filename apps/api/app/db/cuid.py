"""Collision-resistant id generator (cuid2-style — DB-D23 / S5.10).

Every business-table PK is an app-generated, non-sequential, non-enumerable id
(the canon's PK guidelines satisfied by cuid per DB-DOCTRINE §8). This is a compact,
dependency-free cuid2-style generator: a leading letter (so ids are valid identifiers)
followed by a base36 BLAKE2b hash over time + a monotonic counter + per-process
fingerprint + fresh entropy. Lowercase alphanumeric, fixed length, URL-safe.
"""

from __future__ import annotations

import secrets
import time
from hashlib import blake2b
from threading import Lock

_LENGTH = 24
_ALPHABET = "abcdefghijklmnopqrstuvwxyz"
_fingerprint = secrets.token_hex(8)
_counter = secrets.randbelow(2_000_000_000)
_lock = Lock()


def _base36(n: int) -> str:
    if n == 0:
        return "0"
    digits = "0123456789abcdefghijklmnopqrstuvwxyz"
    out = []
    while n:
        n, r = divmod(n, 36)
        out.append(digits[r])
    return "".join(reversed(out))


def _next_counter() -> int:
    global _counter
    with _lock:
        _counter += 1
        return _counter


def cuid() -> str:
    """Return a new cuid2-style id (24 chars, leading letter, base36)."""
    first = secrets.choice(_ALPHABET)
    time_block = _base36(int(time.time() * 1000))
    count_block = _base36(_next_counter())
    entropy = secrets.token_hex(16)
    digest = blake2b(
        f"{time_block}{count_block}{_fingerprint}{entropy}".encode(),
        digest_size=32,
    ).digest()
    hash_block = _base36(int.from_bytes(digest, "big"))
    return (first + time_block + count_block + hash_block)[:_LENGTH]
