"""Contract-diff gate (S2.7): every endpoint FastAPI exposes must come FROM the contract.

Compares the operations (method + path + operationId) FastAPI generates against
packages/contracts/openapi.yaml. The contract is the superset — later stages implement more of
it — so this does NOT require every contracted endpoint to exist yet. It FAILS the build when
FastAPI exposes an operation that is not in the contract, or implements a contracted path with
the wrong method/operationId: i.e. an invented or drifted endpoint. Meta routes (/healthz,
/debug-sentry) are excluded via include_in_schema=False, so they never appear here.

Run from anywhere: `python scripts/contract_diff.py`.
"""

from __future__ import annotations

import sys
from pathlib import Path

_REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_REPO / "apps" / "api"))

import yaml  # noqa: E402
from app.main import app  # noqa: E402

_METHODS = {"get", "post", "put", "patch", "delete", "options", "head"}
_PREFIX = "/api/v1"


def _ops_from(paths: dict, *, strip_prefix: bool) -> dict[tuple[str, str], str | None]:
    ops: dict[tuple[str, str], str | None] = {}
    for path, methods in (paths or {}).items():
        rel = path[len(_PREFIX):] if strip_prefix and path.startswith(_PREFIX) else path
        for method, operation in (methods or {}).items():
            if method.lower() in _METHODS:
                ops[(method.upper(), rel)] = (operation or {}).get("operationId")
    return ops


def main() -> int:
    contract_spec = yaml.safe_load(
        (_REPO / "packages" / "contracts" / "openapi.yaml").read_text(encoding="utf-8")
    )
    contract = _ops_from(contract_spec.get("paths", {}), strip_prefix=False)
    generated = _ops_from(app.openapi().get("paths", {}), strip_prefix=True)

    errors = []
    for key, op_id in sorted(generated.items()):
        method, path = key
        if key not in contract:
            errors.append(f"  drift: {method} {path} (operationId={op_id}) is NOT in the contract")
        elif contract[key] != op_id:
            errors.append(
                f"  operationId mismatch on {method} {path}: "
                f"app={op_id!r} contract={contract[key]!r}"
            )

    if errors:
        print("CONTRACT DIFF FAILED (S2.7) — endpoints do not match the contract:")
        print("\n".join(errors))
        return 1

    print(f"contract-diff OK (S2.7): {len(generated)} implemented operation(s) match the contract.")
    for method, path in sorted(generated):
        print(f"  + {method} {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
