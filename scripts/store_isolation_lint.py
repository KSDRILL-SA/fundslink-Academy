"""Store-isolation gate (S5.3) — funding amounts live in PostgreSQL ONLY.

Fails the build if (a) any Mongo/Beanie document model carries a monetary field, or (b) the
matching module's Redis keys fall outside the allowlist (denylist:* / rl:* / match:*). This makes
"money never leaves PostgreSQL" machine-enforced, not merely a review convention (baton §3).

Run from anywhere: `python scripts/store_isolation_lint.py`.
"""

from __future__ import annotations

import sys
from pathlib import Path

_REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_REPO / "apps" / "api"))

from app.db.store_isolation import (  # noqa: E402
    is_allowed_redis_key,
    money_fields,
)
from app.modules.matching.reasoning import MONGO_MODELS  # noqa: E402
from app.modules.matching.spend import quota_key, spend_key  # noqa: E402


def main() -> int:
    errors: list[str] = []

    # (a) No money field in any Mongo/Beanie model.
    for model in MONGO_MODELS:
        offenders = money_fields(model)
        if offenders:
            errors.append(f"  {model.__name__}: monetary field(s) {offenders} (S5.3)")

    # (b) Every Redis key the matching module emits is within the allowlist.
    sample_keys = [spend_key(), quota_key("sample-user")]
    for key in sample_keys:
        if not is_allowed_redis_key(key):
            errors.append(f"  Redis key outside allowlist: {key} (S5.3)")

    if errors:
        print("STORE-ISOLATION LINT FAILED (S5.3) — money must live in PostgreSQL only:")
        print("\n".join(errors))
        return 1

    print(
        f"store-isolation OK (S5.3): {len(MONGO_MODELS)} Mongo model(s) carry no money field; "
        f"matching Redis keys within allowlist."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
