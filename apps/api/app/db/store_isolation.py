"""Store-isolation guard (S5.3) — funding amounts live in PostgreSQL ONLY.

Stage 03 is the first phase where a violation is *possible* (the polyglot stores come online), so
it is the phase that makes it *impossible* rather than conventional. Two machine checks:

  (a) **No monetary field in any Mongo/Beanie model.** A money field is one typed ``Decimal`` or
      named like an amount (amount/zar/rand/price/cost/fee/balance/disbursement/ledger/payment).
      The match reasoning document may carry score/text/tags — never an amount.
  (b) **Redis key allowlist.** Only ``denylist:*`` (auth), ``rl:*`` (rate-limit), and matching's
      ``match:*`` (cache/quota/spend-count) keys are permitted — and no Redis *value* is a money
      amount (the spend breaker counts CALLS, not rands; the ZAR budget stays in PG config).

The CI gate (scripts/store_isolation_lint.py) and the cross-store test (S7.15) both call in here.
"""

from __future__ import annotations

from decimal import Decimal
from typing import get_args

# Substrings that mark a field name as a funding amount (case-insensitive). ``score`` (a ratio),
# ``currency`` (a 3-letter code), ``model_version`` etc. are deliberately NOT money.
MONEY_FIELD_TOKENS = (
    "amount",
    "zar",
    "rand",
    "price",
    "cost",
    "fee",
    "balance",
    "disbursement",
    "ledger",
    "payment",
    "salary",
)

# The only Redis key prefixes allowed across the whole system (baton §3 contract 8b).
REDIS_KEY_ALLOWLIST = ("denylist:", "rl:", "match:")


def _is_decimal(annotation) -> bool:
    if annotation is Decimal:
        return True
    return any(arg is Decimal for arg in get_args(annotation))  # Optional[Decimal] etc.


def money_fields(model) -> list[str]:
    """Return the names of any monetary fields on a Pydantic/Beanie model (empty = clean)."""
    offenders: list[str] = []
    for name, field in model.model_fields.items():
        lowered = name.lower()
        if _is_decimal(field.annotation) or any(tok in lowered for tok in MONEY_FIELD_TOKENS):
            offenders.append(name)
    return offenders


def assert_no_money_in_models(models) -> None:
    """Raise AssertionError if any model carries a money field (S5.3). Used by CI + tests."""
    bad = {m.__name__: money_fields(m) for m in models if money_fields(m)}
    assert not bad, f"S5.3 violation — money field(s) in a non-PostgreSQL store: {bad}"


def is_allowed_redis_key(key: str) -> bool:
    return key.startswith(REDIS_KEY_ALLOWLIST)


def assert_redis_keys_allowed(keys) -> None:
    bad = [k for k in keys if not is_allowed_redis_key(k)]
    assert not bad, (
        f"S5.3 violation — Redis key(s) outside the allowlist {REDIS_KEY_ALLOWLIST}: {bad}"
    )
