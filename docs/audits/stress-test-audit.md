# FUNDSLINK ACADEMY — STRESS-TEST AUDIT
## Version 1.0 | 2026 | Status: ACCEPTED (findings folded into TAD v1.1 + DB-DOCTRINE v1.1)

Six adversarial reviews conducted before implementation. Every finding has an ID (ST-n.m), a disposition, and a destination document. Nothing here is advisory prose — it is all either FOLDED, TRACKED, or BLOCKING.

## ST-1 — Growth 10 → 10,000 clients: first failure points
| # | Finding | Disposition |
|---|---------|------------|
| 1.1 | Human verification workflow saturates before any server (interviews, doc review) | TRACKED — triage tiers + volunteer REVIEWER recruitment + published queue-time expectations; ops plan item, pre-1,000 students |
| 1.2 | Inline AI matching hits OpenAI rate limits + runaway cost | FOLDED (v1) — spend circuit breaker + per-user daily quota + local embedding heuristic (no live OpenAI); queued-job/202 worker pattern deferred to v1.x when a paid model lands (TAD §6.2, Founder-approved L4 2026-06-19) |
| 1.3 | Single outbox worker chokes on reminder fan-out spikes | FOLDED — TAD §7: N workers, SKIP LOCKED; spread scheduling |
| 1.4 | Email provider throttling on young domains | TRACKED — domain warm-up before launch |
| 1.5 | Railway volume + no CDN for documents | FOLDED — TAD §4.4: S3-compatible trigger at 1,000 students |

## ST-2 — Active-attacker security audit
| # | Finding | Disposition |
|---|---------|------------|
| 2.1 | No MFA on money-adjacent roles — highest-value target unprotected | FOLDED — TAD §3.1: TOTP mandatory for privileged roles. **BLOCKING for admin accounts at v1 launch** |
| 2.2 | Credential stuffing / password reuse | FOLDED — HIBP k-anonymity check |
| 2.3 | IDOR on /applications/{id} class endpoints | FOLDED — ownership in repository scope + mandatory cross-user 403 tests (C7) |
| 2.4 | Upload weaponization (stored XSS via SVG/HTML, oversized files) | FOLDED — magic-byte validation, AV, EXIF strip, separate serving origin, strict CSP |
| 2.5 | Webhook forgery minting fake donations (v1.5) | FOLDED — signature verification + IP allow-list, mandatory |
| 2.6 | Cost attack on matching endpoint | FOLDED — per-user quotas + spend circuit breaker |
| 2.7 | Social-engineered bank-detail change | FOLDED — out-of-band phone-on-file confirmation + existing two-step |
| 2.8 | Internal stores exposed publicly | TRACKED — external port-scan on launch checklist |
| 2.9 | No key-rotation procedure | FOLDED — JWT rotation runbook with overlap window (runbook to be written with disbursement runbook) |
| 2.10 | Email-capture channel (v3) parses attacker-controlled input | TRACKED — sandboxed parser, student-confirmed status suggestions only; design constraint recorded for v3 |

## ST-3 — Senior PostgreSQL architect review
| # | Finding | Disposition |
|---|---------|------------|
| 3.1 | FKs not auto-indexed in PG; outbox needs partial index; dashboards need composite (student_id, created_at DESC) | FOLDED — DB-D28 verified-by-CI; index plan requirement |
| 3.2 | Polymorphic ledger ref = referential integrity hole | FOLDED — DB-D43 typed nullable FKs + num_nonnulls CHECK; TAD §4.5 rewritten |
| 3.3 | Timezone ambiguity around the 25th run | FOLDED — DB-D41 timestamptz UTC |
| 3.4 | No currency column = 2029 migration | FOLDED — DB-D42 currency CHAR(3) DEFAULT 'ZAR' |
| 3.5 | Retrofitting partitions onto 100M-row append-only tables | FOLDED — DB-D44 month partitioning day one |
| 3.6 | Connection exhaustion at replica scale-out | FOLDED — TAD §12 PgBouncer transaction mode |
| 3.7 | Supertype/subtype N+1; count(*) over events | TRACKED — repository join rule + counter strategy at ERD/implementation review |

## ST-4 — Sudden 50,000 users: infra failure order
Failure order: API instance → PG connections → OpenAI limits → ChromaDB memory → outbox → documents → (Vercel: never). **Verdict: no re-architecture required** — replicas + PgBouncer + queue (all folded) carry it; vector-store pressure feeds ADR-004.

## ST-5 — Startup-perspective review
| # | Finding | Disposition |
|---|---------|------------|
| 5.1 | Partnership risk (institution MOUs, bursary DB curation) exceeds technical risk | TRACKED — BD track starts parallel to v1 build; founder action |
| 5.2 | Three stateful stores = v1 ops weight | TRACKED — **ADR-004 proposed**, Founder decision |
| 5.3 | Governance velocity tax | TRACKED — v1 timeboxed to its single done-when condition |

## ST-6 — CTO takeover discomfort list (pre-production gate)
| # | Item | Gate |
|---|------|------|
| 6.1 | **Second human authorizer does not exist** — two-step approval needs a named, trained, MFA'd second person | **BLOCKING v1.5+ (any money)** — TAD R7 |
| 6.2 | Bus factor 1 — continuity pack (access escrow + runbook index) with board | BLOCKING public launch — TAD R9 |
| 6.3 | Legal prerequisites: NPC, PBO, §18A, Information Officer registration, privacy policy | BLOCKING v1.5 — sequence now |
| 6.4 | Restore drill never performed | BLOCKING launch — TAD R10 |
| 6.5 | No load baseline (k6) in CI | BLOCKING launch — TAD R10 |
| 6.6 | OpenAI spend ceiling | FOLDED — ST-2.6 |
| 6.7 | Single email provider | ACCEPTED RISK v1 — manual failover documented |
| 6.8 | Dev-laptop production access | TRACKED — hardware keys + dedicated profile, launch checklist |

## Cost-reduction rulings (reliability preserved)
ADR-004 consolidation (biggest lever); Cloudflare free tier (folded); cached/batched embeddings (folded); staging scale-to-zero off-hours; SMS discipline (already Spec §18); single-region + PITR + tested restores instead of multi-region theatre; cost alerts from week one.

**Owner sign-off:** _________________ Maluleke Kurhula Success (L4)
