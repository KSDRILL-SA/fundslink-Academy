"""Embedding + reasoning stores behind repository interfaces (ADR-003 seams).

The matching module never imports a vector DB or Mongo driver directly — it talks to these ports.
v1 ships in-memory implementations (a real cosine ANN over a dict; a dict reasoning store) that
make the whole module testable with no external services; the ChromaDB (S5.45) and Beanie/Mongo
(S5.33) adapters swap in behind the same ports at deploy. ``embed_text`` is a deterministic local
embedder (a hashing vectoriser) — the OpenAI embedding (S7.37: tests use pre-computed vectors) is
a drop-in. Nothing here ever stores or returns a funding amount (S5.3).
"""

from __future__ import annotations

import hashlib
import math
import re
from abc import ABC, abstractmethod

_DIM = 256
_TOKEN = re.compile(r"[a-z0-9]+")


def embed_text(text: str) -> list[float]:
    """Deterministic hashing embedding — shared tokens raise cosine similarity (S7.37 stand-in)."""
    vec = [0.0] * _DIM
    for token in _TOKEN.findall(text.lower()):
        idx = int.from_bytes(hashlib.blake2b(token.encode(), digest_size=4).digest(), "big") % _DIM
        vec[idx] += 1.0
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]


def source_hash(text: str) -> str:
    """BR-M04 recompute marker — embeddings are recomputed only when the source text changes."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def cosine(a: list[float], b: list[float]) -> float:
    return max(0.0, min(1.0, sum(x * y for x, y in zip(a, b, strict=False))))


# ------------------------------- embedding store -------------------------------
class EmbeddingStore(ABC):
    @abstractmethod
    async def profile_hash(self, student_id: str) -> str | None: ...

    @abstractmethod
    async def upsert_profile(self, student_id: str, vector: list[float], src_hash: str) -> None: ...

    @abstractmethod
    async def upsert_bursary(self, bursary_id: str, vector: list[float], src_hash: str) -> None: ...

    @abstractmethod
    async def rank(
        self, vector: list[float], candidate_ids: list[str], top_n: int
    ) -> list[tuple[str, float]]: ...


class InMemoryEmbeddingStore(EmbeddingStore):
    def __init__(self) -> None:
        self._profiles: dict[str, tuple[list[float], str]] = {}
        self._bursaries: dict[str, tuple[list[float], str]] = {}

    async def profile_hash(self, student_id: str) -> str | None:
        entry = self._profiles.get(student_id)
        return entry[1] if entry else None

    async def upsert_profile(self, student_id: str, vector: list[float], src_hash: str) -> None:
        self._profiles[student_id] = (vector, src_hash)

    async def upsert_bursary(self, bursary_id: str, vector: list[float], src_hash: str) -> None:
        self._bursaries[bursary_id] = (vector, src_hash)

    async def rank(
        self, vector: list[float], candidate_ids: list[str], top_n: int
    ) -> list[tuple[str, float]]:
        scored = [
            (bid, cosine(vector, self._bursaries[bid][0]))
            for bid in candidate_ids
            if bid in self._bursaries
        ]
        scored.sort(key=lambda x: x[1], reverse=True)
        return scored[:top_n]


# ------------------------------- reasoning store -------------------------------
class ReasoningStore(ABC):
    @abstractmethod
    async def save(self, doc: dict) -> None: ...

    @abstractmethod
    async def summaries_for(self, match_ids: list[str]) -> dict[str, str]: ...

    @abstractmethod
    async def get(self, match_id: str) -> dict | None: ...

    @abstractmethod
    async def all_match_ids(self) -> set[str]: ...


class InMemoryReasoningStore(ReasoningStore):
    def __init__(self) -> None:
        self._docs: dict[str, dict] = {}

    async def save(self, doc: dict) -> None:
        self._docs[doc["match_id"]] = doc

    async def summaries_for(self, match_ids: list[str]) -> dict[str, str]:
        return {mid: self._docs[mid]["summary"] for mid in match_ids if mid in self._docs}

    async def get(self, match_id: str) -> dict | None:
        return self._docs.get(match_id)

    async def all_match_ids(self) -> set[str]:
        return set(self._docs)


# Process-wide default adapters (in-memory). The Chroma/Beanie adapters replace these at deploy
# via get_*_store(); tests inject their own instances. Same pattern as the auth email adapter.
_embedding_store: EmbeddingStore = InMemoryEmbeddingStore()
_reasoning_store: ReasoningStore = InMemoryReasoningStore()


def get_embedding_store() -> EmbeddingStore:
    return _embedding_store


def get_reasoning_store() -> ReasoningStore:
    return _reasoning_store
