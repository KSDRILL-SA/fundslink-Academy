# STAGE 05 — INTEGRATION & HARDENING
**Read first:** IMPLEMENTATION-PROCESS §7 · STRESS-TEST-AUDIT (every TRACKED/BLOCKING item) · LAUNCH-CHECKLIST.

**Review framework reference:** After completing this stage, it will be reviewed against the Stage 05 challenge questions in `.ksdrill/workflow/ai-review-challenge-framework.md` and the Universal Final Challenge. Familiarize yourself with these questions during implementation.

1. Playwright E2E: golden journey + painful journeys (return-cycle x3 → outreach flag; rejection → appeal by DIFFERENT reviewer; waitlist position display; engine-down UNSCREENED flow).
2. k6 baseline vs staging: p95 < 2s @ 200 concurrent (ST-6.5) — commit results.
3. External port scan: only 443 public (ST-2.8). Dependency audit + gitleaks full-history.
4. Restore drill #2 from PITR on staging (ST-6.4) — timed log.
5. CHAOS HOUR: kill matching worker mid-job (assert FALLBACK + job recovery); kill DB connection mid-status-transaction (assert no partial write: status, event, outbox all-or-nothing); flood outbox (assert workers drain, DEAD surfaces).

## GATE G5: all five documented WITH OUTPUT, attached to the launch checklist. STOP. Founder reviews.
