"""cuid generator — DB-D23 / S5.10 (no DB required)."""

import re

from app.db import cuid

_CUID_RE = re.compile(r"^[a-z][a-z0-9]{23}$")


def test_cuid_shape():
    cid = cuid()
    assert _CUID_RE.match(cid), f"cuid must be 24 lowercase alnum chars, leading letter: {cid}"


def test_cuid_uniqueness_at_volume():
    # Non-enumerable, collision-resistant: 50k ids must all differ.
    ids = {cuid() for _ in range(50_000)}
    assert len(ids) == 50_000
