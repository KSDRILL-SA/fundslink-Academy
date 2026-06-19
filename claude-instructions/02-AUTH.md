# STAGE 02 — AUTH: THE GATEWAY (one vertical slice, API + Angular)
**Read first:** TAD §3.1–3.4 · contract /auth paths · UX-SCREEN-MAP S04–S07 · IMPLEMENTATION-PROCESS §4.

**Review framework reference:** After completing this stage, it will be reviewed against the Stage 02 challenge questions in `.ksdrill/workflow/ai-review-challenge-framework.md` and the Universal Final Challenge. Familiarize yourself with these questions during implementation.

## TASKS
1. auth module (router/service/repository): register (consents recorded as ConsentRecord — BR-A05), login (Redis rate-limit 5/15min, lockout, HIBP k-anonymity check), RS256 JWT (keys from env; 15min access), refresh rotation + family-revocation-on-reuse (BR-A06), logout jti deny-list, account state machine.
2. MFA (TOTP): enrolment + enforcement dependency for privileged roles (ST-2.1); seeded admin requires it.
3. RBAC live: permission dependency `require(Permission.X)`; deny-by-default lint becomes REAL (every router must declare or CI fails); cross-user-403 test harness (ST-2.3) built and applied to a dummy resource.
4. Angular libs/auth: token-in-memory service (S3.14), interceptor with 401-refresh dedup + request queueing (S3.15, test per S7.12), guards; screens S04–S07 wired to staging.
5. Audit: every auth mutation writes audit_log in-transaction.

## GATE G2 (paste output)
[ ] contract-diff green for /auth/*  [ ] concurrent-refresh test green (S7.12)
[ ] token-reuse attack test → family revoked  [ ] MFA blocks un-enrolled admin in staging
[ ] cross-user 403 harness green  [ ] Sentry test event received from BOTH apps
STOP. Founder reviews G2.
