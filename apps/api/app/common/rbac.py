"""Deny-by-default route inspection (S3.21) — shared by the permission-lint CI gate and tests.

A route "declares its posture" if any dependency in its tree carries one of the markers set by
app.modules.auth.permissions: a `require(...)` permission, or `public_endpoint` /
`authenticated_only`. Kept here (not in the script) so the rule is unit-testable.
"""

from __future__ import annotations

MARKERS = ("_fundslink_permission", "_fundslink_public", "_fundslink_authenticated")


def declares_posture(dependant) -> bool:
    """True if the route's dependency tree carries any deny-by-default marker."""
    stack = list(dependant.dependencies)
    while stack:
        dep = stack.pop()
        call = getattr(dep, "call", None)
        if any(hasattr(call, marker) for marker in MARKERS):
            return True
        stack.extend(dep.dependencies)
    return False
