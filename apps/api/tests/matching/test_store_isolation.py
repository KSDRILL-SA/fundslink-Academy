"""S5.3 store isolation — money lives in PostgreSQL ONLY. The constitutional centerpiece of
module 4: a money field in a Mongo model, a stray Redis key, or an amount written outside
PostgreSQL must all be caught (CI lint + the S7.15 cross-store round-trip test)."""

from __future__ import annotations

import subprocess
import sys
from decimal import Decimal
from pathlib import Path

from pydantic import BaseModel

from app.db.store_isolation import (
    MONEY_FIELD_TOKENS,
    assert_no_money_in_models,
    is_allowed_redis_key,
    money_fields,
)
from app.modules.matching.reasoning import MONGO_MODELS
from app.modules.matching.spend import quota_key, spend_key
from app.modules.matching.stores import get_reasoning_store
from tests.matching.conftest import BASE, bearer, seed_bursary, student_with_profile


def test_no_money_field_in_mongo_models_s5_3():
    assert_no_money_in_models(MONGO_MODELS)  # the real models are clean

    class _BadReasoning(BaseModel):  # a model that DID smuggle money must be caught
        match_id: str
        funding_amount: Decimal

    assert "funding_amount" in money_fields(_BadReasoning)


def test_redis_keys_are_within_the_allowlist_s5_3():
    assert is_allowed_redis_key(spend_key())
    assert is_allowed_redis_key(quota_key("user-1"))
    assert is_allowed_redis_key("denylist:jti") and is_allowed_redis_key("rl:ip:1.2.3.4")
    assert not is_allowed_redis_key("ledger:balance:user-1")  # a money-ish key is refused


def test_match_roundtrip_writes_no_amount_outside_postgresql_s7_15(match_client, admin_conn):
    """A full match round-trip: the reasoning store carries score/text/tags — never an amount."""
    bid = seed_bursary(admin_conn, tags=("computer", "science"))
    token, uid = student_with_profile(match_client, field="Computer Science")
    match_client.post(f"{BASE}/matches/run", headers=bearer(token))

    docs = get_reasoning_store()._docs
    assert docs, "expected reasoning documents to be written"
    for doc in docs.values():
        for key, value in doc.items():
            assert not any(tok in key.lower() for tok in MONEY_FIELD_TOKENS), key
            assert not isinstance(value, Decimal), f"{key} is a Decimal in the reasoning store"
        assert 0.0 <= doc["score"] <= 1.0  # a similarity ratio, not money

    # The funding figures live ONLY in PostgreSQL: match_result has a score, never an amount.
    cols = admin_conn.execute(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'match_result'"
    ).fetchall()
    names = {c[0] for c in cols}
    assert "score" in names
    assert not any(tok in n.lower() for n in names for tok in MONEY_FIELD_TOKENS)
    match_count = admin_conn.execute(
        "SELECT count(*) FROM match_result"
        " WHERE student_profile_id = %s AND external_bursary_id = %s",
        (uid, bid),
    ).fetchone()[0]
    assert match_count == 1


def test_store_isolation_lint_passes_on_the_real_models_s5_3():
    repo = Path(__file__).resolve().parents[4]
    result = subprocess.run(
        [sys.executable, str(repo / "scripts" / "store_isolation_lint.py")],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stdout + result.stderr
