# FUNDSLINK ACADEMY — v1 LAUNCH CHECKLIST | Gate: ALL boxes before public traffic
## Blocking (from STRESS-TEST-AUDIT)
- [ ] MFA enrolled + enforced on every ADMIN_* account (ST-2.1)
- [ ] Restore drill executed on staging from PITR — timed, documented (ST-6.4)
- [ ] k6 baseline run against staging; p95 < 2s at 200 concurrent (ST-6.5)
- [ ] External port scan: only 443 on api/web answer publicly; PG/Redis internal-only (ST-2.8)
- [ ] Continuity pack sealed with board: access escrow + runbook index (ST-6.2)
- [ ] Privacy policy live; Information Officer registered; consent wording v1 frozen (ST-6.3 / MASTER-SPEC §15)
## Required
- [ ] CI green: pytest + Vitest + contract-diff + permission-lint + import-linter
- [ ] Cross-user 403 tests pass for every owned resource (ST-2.3)
- [ ] Sentry receiving from both apps; alert set live (TAD §11); cost alerts armed (OpenAI + Railway)
- [ ] Email domain warmed (SPF/DKIM/DMARC verified); outbox DEAD-letter alert tested (ST-1.4)
- [ ] Seeds loaded: roles/permissions, lookups, transitions, config (allowance=1000.00 ZAR)
- [ ] Bursary database: ≥50 curated bursaries with deadlines (matching has something to match)
- [ ] governance/ synced + pinned; GOVERNANCE-PATCHES v1.0 applied to system-design-template
## Done-when (MASTER-SPEC §3)
- [ ] One real student: register → profile → apply → matched → tracked, end-to-end in production
