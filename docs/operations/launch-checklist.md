# FUNDSLINK ACADEMY — v1 LAUNCH CHECKLIST | Gate: ALL boxes before public traffic

> **Stage 05 / Gate G5 evidence:** [`../process/g5-evidence.md`](../process/g5-evidence.md).
> Three of G5's five items (k6 vs staging, external port scan, PITR restore drill) are
> **BLOCKED on a staging environment that does not exist** — issue #252. The boxes below
> stay unticked until they are earned.
## Blocking (from STRESS-TEST-AUDIT)
- [ ] MFA enrolled + enforced on every ADMIN_* account (ST-2.1)
- [ ] `/readyz` returns 200 on staging+prod — app connected as `fundslink_app` (non-superuser, NOBYPASSRLS); a bypassing role returns 503 (auth↔DB least-privilege guard)
- [ ] Restore drill executed on staging from PITR — timed, documented (ST-6.4)
- [ ] k6 baseline run against staging; p95 < 2s at 200 concurrent (ST-6.5)
- [ ] External port scan: only 443 on api/web answer publicly; PG/Redis internal-only (ST-2.8)
- [ ] Continuity pack sealed with board: access escrow + runbook index (ST-6.2)
- [ ] Privacy policy live; Information Officer registered; consent wording v1 frozen (ST-6.3 / MASTER-SPEC §15)
## Required
- [ ] CI green: pytest + Vitest + contract-diff + permission-lint + import-linter
- [ ] Money store-isolation guard green: no monetary field in MongoDB/Beanie models or Redis values; cross-store test asserts funding amounts live only in PostgreSQL (S5.3 / S7.15)
- [ ] Cross-user 403 tests pass for every owned resource (ST-2.3)
- [ ] Sentry receiving from both apps; alert set live (TAD §11); cost alerts armed (OpenAI + Railway)
- [ ] Email domain warmed (SPF/DKIM/DMARC verified); outbox DEAD-letter alert tested (ST-1.4)
- [ ] Seeds loaded: roles/permissions, lookups, transitions, config (allowance=1000.00 ZAR)
- [ ] Bursary database: ≥50 curated bursaries with deadlines (matching has something to match)
- [ ] governance/ synced + pinned; GOVERNANCE-PATCHES v1.2 applied to system-design-template (incl. A-1 C5 S5.65 ledger immutability + A-2 C10 S10.37 post-phase verification)
## Background workers & schedulers (deploy wiring — TAD §7)
- [ ] Notification outbox worker runs **continuously**: `python -m app.modules.notification.worker --loop` under a process supervisor / Railway worker — drains `notification_outbox` with `FOR UPDATE SKIP LOCKED`, retry/backoff/DEAD. *Without a running worker, no email/SMS/in-app message is delivered.*
- [ ] Tracking reminders scheduled **daily**: the T-3 deadline + 30/45/60-day silence jobs (`app.modules.tracking.jobs`) run on a daily cron; they enqueue into the same outbox the worker drains.
- [ ] Return reminders scheduled **daily**: `python -m app.modules.application.jobs` reminds a student once before a returned application's `respond_by` (`return_reminder_lead_days`) and once after it passes (D-006, #298). It never changes the application; it only enqueues into the outbox, and it is safe to run twice.
- [ ] Partition maintenance scheduled **daily**: `python -m app.db.partitions` keeps month N+12 ahead **and re-seals every partition** from the app roles (#293); `python -m app.db.integrity` fails if one is reachable.
- [ ] All of these run under the least-privileged `fundslink_app` role (SYSTEM RLS context) — never the owner/superuser. (Partition maintenance is the exception: DDL needs the owner.)
## Done-when (MASTER-SPEC §3)
- [ ] One real student: register → profile → apply → matched → tracked, end-to-end in production
