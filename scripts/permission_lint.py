"""Deny-by-default permission lint (S3.21).

Every business route (under the /api/v1 surface) must declare its access posture in its
dependency tree — a permission via `require(...)`, or an explicit `public_endpoint` /
`authenticated_only` marker. A route that declares none is a security hole (an endpoint shipped
without an authorisation decision), so this FAILS the build. Meta routes (/healthz, /readyz,
/debug-sentry) are excluded — they are not part of the /api/v1 business surface.

**It must never pass by checking nothing.** Until #289 it iterated `app.routes` looking for
`APIRoute` instances. FastAPI 0.137 no longer flattens included routers into `app.routes`: each
`include_router` call leaves one `_IncludedRouter` wrapper there instead. The lint therefore found
zero business routes and printed

    permission-lint OK (S3.21): 0 business route(s) all declare an access posture.

in CI, on main, for as long as that FastAPI version was installed. A hard rule in CLAUDE.md — every
endpoint declares a permission — was enforced by nothing, and the test that guarded the lint only
checked the exit code, which a lint that checks nothing satisfies perfectly.

Two changes close it:
  1. Routes are collected from BOTH shapes. For an included router the lint reads the EFFECTIVE
     route contexts, whose dependency tree includes anything declared at include time — that is
     the tree FastAPI actually executes, so it is the one that has to carry the posture.
  2. A vacuity guard: the lint counts the operations in packages/contracts/openapi.yaml and FAILS
     if it checked fewer business routes than the contract declares. A future framework change
     that hides routes from it again becomes a red build, not a green one.

Run from anywhere: `python scripts/permission_lint.py`.
"""

from __future__ import annotations

import re
import sys
from collections.abc import Iterator
from pathlib import Path

_REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_REPO / "apps" / "api"))

from fastapi.routing import APIRoute  # noqa: E402

from app.common.rbac import declares_posture  # noqa: E402

_PREFIX = "/api/v1"
_CONTRACT = _REPO / "packages" / "contracts" / "openapi.yaml"


def business_routes(routes) -> Iterator[tuple[str, str, str, object]]:
    """(methods, path, name, dependant) for every route, whatever shape FastAPI stored it in.

    - ``APIRoute`` — the shape a route has when it is registered directly on the app, and the
      shape every route had before FastAPI 0.137.
    - an included-router wrapper — anything exposing ``effective_candidates()``. Each candidate
      carries the full prefixed path and the effective dependency tree.
    """
    for route in routes:
        candidates = getattr(route, "effective_candidates", None)
        if callable(candidates):
            for ctx in candidates():
                methods = ",".join(sorted(set(ctx.methods or ()) - {"HEAD", "OPTIONS"}))
                yield methods, ctx.path, ctx.name, ctx.dependant
            continue
        if isinstance(route, APIRoute):
            methods = ",".join(sorted(route.methods - {"HEAD", "OPTIONS"}))
            yield methods, route.path, route.name, route.dependant


def contract_operation_count(contract: Path = _CONTRACT) -> int:
    """How many operations the contract declares — the floor the lint must reach."""
    return len(re.findall(r"^\s+operationId:\s*\S+", contract.read_text(encoding="utf-8"), re.M))


def check(app, *, minimum: int) -> tuple[int, list[str], list[str]]:
    """Return (routes checked, offenders, problems). Separated from main() so tests can hand it a
    synthetic app."""
    offenders: list[str] = []
    checked = 0
    for methods, path, name, dependant in business_routes(app.routes):
        if not path.startswith(_PREFIX):
            continue
        checked += 1
        if not declares_posture(dependant):
            offenders.append(f"  {methods} {path} ({name})")

    problems: list[str] = []
    if checked < minimum:
        problems.append(
            f"the lint could see only {checked} business route(s) but the contract declares "
            f"{minimum} operation(s). It would pass without checking the rest — refusing to. If "
            "the framework changed how routes are stored, teach business_routes() the new shape."
        )
    return checked, offenders, problems


def main() -> int:
    from app.main import app  # imported here so tests can import this module without the app

    minimum = contract_operation_count()
    checked, offenders, problems = check(app, minimum=minimum)

    if offenders or problems:
        if offenders:
            print("PERMISSION LINT FAILED (S3.21 deny-by-default) — routes with no access posture:")
            print("\n".join(offenders))
            print("Declare require(Permission.X), or mark public_endpoint / authenticated_only.")
        for problem in problems:
            print(f"PERMISSION LINT FAILED (S3.21 vacuity guard): {problem}")
        return 1

    print(
        f"permission-lint OK (S3.21): {checked} business route(s) all declare an access posture "
        f"(contract declares {minimum})."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
