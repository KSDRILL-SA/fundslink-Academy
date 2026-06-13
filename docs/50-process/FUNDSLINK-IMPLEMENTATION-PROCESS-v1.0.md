# FUNDSLINK ACADEMY — IMPLEMENTATION PROCESS
## Version 1.0 | 2026 | Suite item 17 | The build order, gated. Status: PROPOSED (L4 lock pending)

---

## 0. THE LAW OF THIS DOCUMENT

> **One stage at a time. A stage is DONE when its gate passes — not when it feels done. No stage may begin while the previous gate is open. "Done" is verified by command output, not by confidence.**

This encodes the Founder's directive: *database first, done perfectly and completely, then auth, then backend, then frontend* — and extends it with explicit gates so "perfectly" is measurable. Parallel work is allowed ONLY on the Human Track (§9), which has no code dependencies.

## 1. STAGE MAP

```
STAGE 0          STAGE 1        STAGE 2      STAGE 3                STAGE 4        STAGE 5         STAGE 6
Scaffold    →    DATABASE   →   AUTH     →   BACKEND MODULES    →   FRONTEND   →   INTEGRATION →   LAUNCH
(repo, CI,       (only the      (the         (profile→application   (Angular,      (E2E, load,     (checklist,
 dev env)        database,      gateway      →eligibility→matching   screen by      restore drill,  prod cutover,
                 perfectly)     to all)      →tracking→notification) screen)        security pass)  done-when)
   ~3 days         ~1.5 wk        ~1 wk           ~3–4 wk              ~3–4 wk         ~1 wk          ~3 days
```
Durations are honest solo-dev estimates with Claude Code as pair — they flex; the GATES never do.

---

## 2. STAGE 0 — SCAFFOLD (~3 days)

**Scope:** monorepo per ADR-002 (`apps/api`, `apps/web`, `packages/contracts`, `docs/`, `governance/` pinned-sync, `infra/`); docker-compose dev stack (PostgreSQL 16 + MongoDB + ChromaDB + Redis); CI skeleton with ALL gates wired from day one even while empty — pytest, Vitest, contract-diff, permission-lint, import-linter, path filters; Railway + Vercel projects created (deploy order api→web encoded); Sentry DSNs; the full doc suite committed under `docs/`.
**Forbidden:** any feature code.
**GATE G0:** `docker compose up` gives a working empty stack; CI runs green on an empty commit; a deliberate import violation (router importing sqlalchemy) FAILS CI — the gate must be seen rejecting before it's trusted.

## 3. STAGE 1 — DATABASE, ONLY THE DATABASE (~1.5 weeks)

The Founder's first focus. Nothing else exists until this is finished.

**Scope:**
1. Alembic migration 0001 generated from `fundslink-v1-schema.sql` (validated content, now under migration control).
2. Full seed suite: roles/permissions matrix (TAD §3.4), all lookups, both transition tables, config (allowance, SLA, budgets), eligibility_ruleset v1 per category (BR-E02), lk_theme_tag starter set.
3. **Constraint test suite (DB-D37): every constraint and trigger gets a pytest that attempts the violation and asserts rejection** — re-creating in CI, permanently, all six manual proofs (append-only guard, ID uniqueness, human-final, duplicate-active-application, appeal-fairness, two-step CHECK when fin arrives) plus every CHECK/UNIQUE/FK not yet proven.
4. Integrity job suite skeleton (DB-D39): allocation-sum check (dormant until v2), status-cache consistency check, dangling-reference scan — runnable via one command.
5. Partition maintenance job (creates month N+12 ahead).
6. Repository base layer ONLY (session management, the institution-scoping base class, raw-SQL helper) — no business repositories yet.
7. Restore drill #1: backup the dev DB, destroy it, restore it, run the constraint suite against the restored copy.

**Forbidden:** endpoints, services, Angular, "just a quick auth stub."
**GATE G1:** `alembic upgrade head` from zero → clean; downgrade→upgrade roundtrip clean; constraint suite 100% green in CI; `EXPLAIN` on the five hottest planned queries (TAD §5.3 surface) shows index usage (DB-D28/D40); restore drill documented with timing. **Founder reviews and stamps the database as DONE before Stage 2 begins.**

## 4. STAGE 2 — AUTH (~1 week)

**Scope:** auth module end-to-end exactly per TAD §3.1 — register (consents recorded), login (rate-limited, lockout), RS256 JWT, refresh rotation + family-revocation-on-reuse, logout deny-listing, MFA (TOTP) for privileged roles, HIBP check, RBAC dependency + deny-by-default lint live, account state machine. Angular `libs/auth` (interceptor with 401-dedup per S3.15, guards) built NOW against the live API — auth is the one vertical slice that crosses the stack early, because everything after authenticates.
**GATE G2:** contract-diff green for all /auth paths; the S7.12 concurrent-refresh test passes; token-reuse attack test shows family revocation; cross-user 403 test harness operational (ST-2.3) and applied to a dummy resource; MFA enforced on a seeded admin in staging; Sentry receives a thrown test error from both apps.

## 5. STAGE 3 — BACKEND MODULES (~3–4 weeks, in THIS order)

Module order follows data dependency, one module = one PR = one gate check:
1. **profile** (+ documents upload pipeline: magic-byte, AV hook, signed URLs, separate origin)
2. **application** (state machine service over the transition tables; status events + outbox enqueue in-transaction; E1 duplicate guard surfaced as friendly 409)
3. **eligibility** (ruleset evaluator over eligibility_ruleset JSONB; pre_screen_result writes; return-cycle logic + cycle-3 outreach flag; UNSCREENED degradation path)
4. **matching** (queued job, cached embeddings, ChromaDB ANN per S5.45, spend breaker, FALLBACK mode, MatchResult in PG + reasoning in MongoDB per S5.33, browse-all endpoint)
5. **tracking** (tracked_application CRUD, self-report transitions, deadline engine, 30/45/60 scheduler)
6. **notification** (outbox workers SKIP LOCKED, email adapter live, SMS adapter stubbed, preference + consent checks at enqueue)

**GATE G3 (per module + final):** every endpoint matches the contract byte-for-byte (CI diff); every service business rule cites its BR id in a test name; coverage ≥ the C7 threshold; cross-user 403 suite green for each new resource; the full pipeline demo runs headless: seed student → apply → pre-screen → return → resubmit → ready → human review → each of the four decisions — via API only, no frontend.

## 6. STAGE 4 — FRONTEND (~3–4 weeks)

**Scope:** Angular per ADR-002 topology and the UX-SCREEN-MAP v1.0, built in journey order: S01–S07 (public+auth shell) → S08–S09 → S10–S13 (the apply flows incl. S12 OTHER) → S14–S16 (status, fix-list, the four decision screens — **S16-REJ gets its own design review with the Founder before merge**) → S17–S19 → S20–S21 → A01–A04 admin. Every screen implements all five mandatory states (§4 of the screen map); generated TS client from the contract — no hand-written API types.
**GATE G4:** Vitest green; every screen demo'd against staging API; performance budget met (≤200KB student routes, tested on throttled 3G profile); WCAG AA pass (axe + manual keyboard walk); the A03 compose screen physically refuses a rejection without next-step confirmation.

## 7. STAGE 5 — INTEGRATION & HARDENING (~1 week)

E2E suite (Playwright) over the golden journey + the painful journeys (return-cycle, rejection→appeal, waitlist); k6 baseline (ST-6.5) p95 < 2s @ 200 concurrent; external port scan (ST-2.8); dependency audit; restore drill #2 on staging from PITR (ST-6.4); chaos hour: kill the matching worker mid-job, kill a DB connection mid-transaction — verify FALLBACK and transaction integrity behave as designed.
**GATE G5:** all of the above green and *documented with output*, attached to the launch checklist.

## 8. STAGE 6 — LAUNCH (~3 days)

Work FUNDSLINK-LAUNCH-CHECKLIST-v1.0 line by line — every box, including the human ones. Prod cutover per S6.29. Then the only definition of done that matters (MASTER-SPEC §3): **one real student — register → profile → apply → matched → tracked — end-to-end in production.**

---

## 9. THE HUMAN TRACK (parallel from day one — longer lead times than code)

| Lane | Actions | Target |
|------|---------|--------|
| Legal | NPC registration → PBO application → §18A approval → Information Officer registration → privacy policy + consent wording freeze | Start week 1; §18A typically the long pole — must clear before v1.5 donations |
| Governance | Recruit + train the second authorizer (ST-6.1); seal continuity pack with board (ST-6.2) | Before any money release / before public launch |
| Partnerships | Institution MOU conversations (bulk-distribution model); begin with NWU — home advantage | First signed MOU before v2 build starts |
| Content | Curate the first 50+ bursaries with deadlines + eligibility metadata; write eligibility_ruleset v1 wording with real bursary admins | Before Stage 3 module 4 (matching needs matter) |
| Competitions | The three accepted competitions: demo narrative = the validated suite + the Human-Final live proof — show the trigger rejecting the machine. No one else has that demo. | Per competition dates |

## 10. RULES OF ENGAGEMENT (all stages)

1. Claude Code sessions start at CONSTITUTION-INDEX-fundslink.md, always.
2. Every PR cites the standards it satisfies (S-x / DB-Dx / BR-x / E-x) — uncited non-trivial changes are returned.
3. A failing gate stops the line — we fix, we never gate-shop.
4. Scope additions mid-stage go to a PARKED.md, triaged at stage end — the Release Map (MASTER-SPEC §3) defends v1 from our own enthusiasm.
5. Friday ritual: 30 minutes — gates status, PARKED triage, Human Track check. Solo discipline is still discipline.

**Lock:** _________________ Maluleke Kurhula Success (L4)
