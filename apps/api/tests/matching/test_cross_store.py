"""Cross-store integrity (DB-D35) reconciliation + embedding recompute marker (BR-M04)."""

from __future__ import annotations

import pytest

from app.modules.matching.integrity import reconcile
from app.modules.matching.stores import (
    InMemoryEmbeddingStore,
    cosine,
    embed_text,
    get_reasoning_store,
    source_hash,
)
from tests.matching.conftest import BASE, bearer, seed_bursary, student_with_profile


def test_reconcile_pure_set_logic_db_d35():
    assert reconcile({"a", "b", "c"}, {"a", "b", "c"}).ok
    missing = reconcile({"a", "b", "c"}, {"a", "b"})
    assert not missing.ok and missing.missing_reasoning == ["c"]
    orphan = reconcile({"a", "b"}, {"a", "b", "c"})
    assert not orphan.ok and orphan.orphan_reasoning == ["c"]


def test_pg_matches_reconcile_with_reasoning_store_db_d35(match_client, admin_conn):
    seed_bursary(admin_conn, tags=("computer", "science"))
    token, uid = student_with_profile(match_client, field="Computer Science")
    match_client.post(f"{BASE}/matches/run", headers=bearer(token))

    pg_ids = {
        r[0]
        for r in admin_conn.execute(
            "SELECT id FROM match_result WHERE student_profile_id = %s", (uid,)
        ).fetchall()
    }
    reasoning_ids = set(get_reasoning_store()._docs)
    assert pg_ids and reconcile(pg_ids, reasoning_ids).ok  # every PG match has reasoning

    dropped = next(iter(reasoning_ids))
    del get_reasoning_store()._docs[dropped]
    assert dropped in reconcile(pg_ids, set(get_reasoning_store()._docs)).missing_reasoning


# ------------------------------- embeddings (BR-M04) -------------------------------
def test_source_hash_changes_only_when_the_text_changes_br_m04():
    assert source_hash("UG Computer Science") == source_hash("UG Computer Science")
    assert source_hash("UG Computer Science") != source_hash("PHD Biology")


async def test_in_memory_store_ranks_by_cosine_similarity():
    store = InMemoryEmbeddingStore()
    near = embed_text("computer science engineering")
    far = embed_text("medicine nursing health")
    await store.upsert_bursary("near", near, source_hash("a"))
    await store.upsert_bursary("far", far, source_hash("b"))
    query = embed_text("computer science")
    ranked = await store.rank(query, ["near", "far"], 2)
    assert ranked[0][0] == "near" and ranked[0][1] >= ranked[1][1]
    assert cosine(query, query) == pytest.approx(1.0)
