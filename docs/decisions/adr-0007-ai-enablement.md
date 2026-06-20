# ADR-007 — AI Enablement (matching intelligence)

| Attribute | Value |
|-----------|-------|
| **ID** | ADR-007 |
| **Date** | 2026-06-20 |
| **Status** | **PROPOSED — awaits Founder (L4) ratification** |
| **Relates To** | ADR-003 (data access), TAD §6 (matching execution model), `S5.3`/`S5.33`/`S5.45`, MASTER-SPEC §6.4 (counselling), the `matching` module, `docs/architecture/ai-enablement.md` (the design + build plan) |
| **Owner** | Design ratified by Founder (L4); built by Engineer 02 (L3) when the AI-Enablement milestone opens |

> This ADR records *what we decide* about the AI. The *how* — components, model references, the
> phased build plan, the eval harness, and the privacy envelope — lives in
> [`ai-enablement.md`](../architecture/ai-enablement.md). No build happens until this is ratified.

## Context

Matching ships today behind clean **Ports & Adapters** (`EmbeddingStore`, `ReasoningStore`) with
**in-memory adapters** and a **deterministic hashing embedder** (`embed_text`) — a labelled stub.
ChromaDB (embeddings, S5.45) and MongoDB (reasoning, S5.33) are wired seams. The cost breaker,
per-user quota, FALLBACK, store-isolation (no money outside PostgreSQL, S5.3), and cross-store cuid
keys are **real**. The model is not.

This platform funds **vulnerable students**. For us, the measure of a good AI is not model size —
it is **trustworthiness**: it must never hallucinate a bursary that doesn't exist, never decide
funding, never leak a student's data, and never run away with cost. We lock those properties as
decisions *before* a real model is introduced, so the build is execution, not improvisation.

## Decision

1. **Keep Ports & Adapters.** The model swaps behind `EmbeddingStore` / `ReasoningStore`; matching
   business logic does not change when the model does.
2. **Embeddings are local-first.** Default to an on-host embedding model (sentence-transformer,
   multilingual for SA languages) — free, offline, and **POPIA-private**. A hosted embeddings API
   (e.g. Voyage / Cohere) is allowed **only** behind a privacy gate and **only** if the eval harness
   shows it is materially better.
3. **Vector search is ChromaDB** (S5.45), behind the `EmbeddingStore` port (ANN over the bursary
   corpus; profile/bursary embeddings recomputed only on source change — BR-M04).
4. **Reasoning is the latest Claude, via RAG.** A grounded call explains *why* a retrieved candidate
   fits the student; the reasoning text persists to MongoDB (S5.33), keyed by `match_result.id`.
5. **Advisory-only + Human-Final are NON-NEGOTIABLE.** The AI never decides funding (`fn_human_final`
   stands), and matching never filters the equal-prominence browse-all path (BR-M02).
6. **Grounding — no invented bursaries.** The reasoner may reference **only** real, retrieved
   candidates; every cited bursary id is validated against PostgreSQL before the reasoning is saved.
   A failed validation drops the reasoning, never the match.
7. **Cost is fused by the existing controls.** All paid calls pass the spend circuit breaker
   (ZAR budget in PG config) + per-user daily quota (Redis counts calls, never money); breaker OPEN
   ⇒ FALLBACK, never an error.
8. **Privacy (POPIA).** Minimise PII to any model; prefer local. **Counselling data never enters AI
   inputs** (§6.4). Any external processing of student data is consent-gated and minimised.
9. **No model or prompt ships without passing the eval harness** — a golden set of curated
   profile→bursary judgements (precision@k + a grounding/safety check). The eval gate is CI-run.
10. **Everything is versioned and traceable.** `model_version` + `prompt_version` already ride on
    `match_result` / the reasoning doc; prompts are versioned like the eligibility rulesets, so any
    output is reproducible and auditable.

## Consequences

- **Positive:** the AI is a *citizen* of the existing security/cost/isolation model; the swap is
  controlled; trust and privacy are structural, not aspirational; the eval gate prevents silent
  regressions; local-first keeps student data on-host and costs near-zero by default.
- **Cost:** an eval harness + grounding validator + adapter implementations are real work — hence a
  **dedicated milestone**, not a side-effect of integration.
- **Scope:** v1 remains shippable on the heuristic stub; this is a **v1.x** upgrade (see placement
  in the design doc), wired during/after Stage 05.

## Open questions for ratification

- Local embedding model choice (size vs. SA-language quality) — decided empirically by the eval set.
- Whether v1.x ships local-only, or also enables a hosted embeddings option behind the privacy gate.
- The LLM reasoning budget (calls/day) and the FALLBACK summary quality bar.
- Who curates the golden eval set (a human-judged profile→bursary sample) and how it is refreshed.
