"""Deny-by-default permission lint (S3.21).

Every business route (under the /api/v1 surface) must declare its access posture in its
dependency tree — a permission via `require(...)`, or an explicit `public_endpoint` /
`authenticated_only` marker. A route that declares none is a security hole (an endpoint shipped
without an authorisation decision), so this FAILS the build. Meta routes (/healthz,
/debug-sentry) are excluded — they are not part of the /api/v1 business surface.

Run from anywhere: `python scripts/permission_lint.py`.
"""

from __future__ import annotations

import sys
from pathlib import Path

_REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_REPO / "apps" / "api"))

from fastapi.routing import APIRoute  # noqa: E402

from app.common.rbac import declares_posture  # noqa: E402
from app.main import app  # noqa: E402

_PREFIX = "/api/v1"


def main() -> int:
    offenders = []
    checked = 0
    for route in app.routes:
        if not isinstance(route, APIRoute) or not route.path.startswith(_PREFIX):
            continue
        methods = sorted(route.methods - {"HEAD", "OPTIONS"})
        checked += 1
        if not declares_posture(route.dependant):
            offenders.append(f"  {','.join(methods)} {route.path} ({route.name})")

    if offenders:
        print("PERMISSION LINT FAILED (S3.21 deny-by-default) — routes with no access posture:")
        print("\n".join(offenders))
        print("Declare require(Permission.X), or mark public_endpoint / authenticated_only.")
        return 1

    print(f"permission-lint OK (S3.21): {checked} business route(s) all declare an access posture.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
