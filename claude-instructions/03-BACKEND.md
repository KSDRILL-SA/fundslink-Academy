# STAGE 03 — BACKEND MODULES (six, in THIS order; one module = one PR = gate check)
**Read first:** IMPLEMENTATION-PROCESS §5 · TAD §2, §5–§7 · ERD BR sections per module · contract per module. Per-module reads listed below — read only those.

**Review framework reference:** After completing this stage, it will be reviewed against the Stage 03 challenge questions in `.ksdrill/workflow/ai-review-challenge-framework.md` and the Universal Final Challenge. Familiarize yourself with these questions during implementation.

1. **profile** (BR-A03/A04; UX S09): student_profile CRUD; documents pipeline — magic-byte validation, size caps, AV hook, EXIF strip, sha256, signed URLs from separate origin (ST-2.4); ID-number encrypt + blind index.
2. **application** (BR-S01–S08, E1/E5/E13; UX S10–S14): state-machine service over transition tables; status event + outbox enqueue in ONE transaction (BR-N01); duplicate-active → friendly 409 APPLICATION_ALREADY_ACTIVE; OTHER requires motivation object (BR-E05); withdraw path.
3. **eligibility** (BR-E01–E04, E10; MASTER-SPEC §5.7): ruleset evaluator over eligibility_ruleset JSONB (version-pinned at submission — BR-E02); pre_screen_result append; RETURNED fix-list + application_return cycles; cycle-3 outreach flag; UNSCREENED degradation path; discrepancies = annotations never failures.
4. **matching** (BR-M01–M04; TAD §6): queued job (202), cached embeddings w/ source_hash, ChromaDB ANN (S5.45), expired-deadline predicate (BR-M03), spend circuit breaker + per-user quota, FALLBACK mode, reasoning persisted in MongoDB (S5.33), browse-all endpoint equal-class. **This module first lights up MongoDB + ChromaDB — so it MUST also land the S5.3 store-isolation guard:** no monetary field in any Mongo/Beanie model (reasoning doc = score/text/tags only; CI-asserted), a Redis key allowlist (`denylist:*`/`rl:*`/matching cache+quota — no money value), and a cross-store test (S7.15) proving a match round-trip writes no amount outside PostgreSQL. Funding amounts stay `NUMERIC` in PG (S5.28/DB-D29/DB-D42).
5. **tracking** (BR-T01–T06; UX S18–S19): register/list, self-report transitions (source=SELF_REPORT), deadline T-3 scheduler, 30/45/60 silence jobs → outbox.
6. **notification** (BR-N01–N03; TAD §7): N workers SKIP LOCKED, email adapter (env provider), SMS adapter interface stubbed, consent + preference checks at enqueue, retry/backoff/DEAD + surfacing.

## GATE G3 (per module, then final)
[ ] contract-diff exact  [ ] every BR id appears in a test name  [ ] coverage ≥ C7 threshold
[ ] cross-user 403 suite green per resource  [ ] store-isolation (S5.3): no money field in Mongo/Beanie models + Redis key allowlist; cross-store test (S7.15) asserts amounts live only in PostgreSQL
[ ] FINAL: headless pipeline demo via API only —
seed student → apply → pre-screen → RETURN → resubmit → READY → review → all 4 decision paths
(APPROVED needs human actor; verify SYSTEM attempt is rejected by the DB and assert that error).
STOP. Founder reviews G3.
