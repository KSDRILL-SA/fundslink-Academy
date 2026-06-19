# Stage 06 — Launch
**Read first:** launch-checklist (the gate IS the checklist) · runbooks · S6.29.

**Review framework reference:** After completing this stage, it will be reviewed against the Stage 06 challenge questions in `.ksdrill/workflow/ai-review-challenge-framework.md` and the Universal Final Challenge. Familiarize yourself with these questions during implementation.

1. Work the checklist line by line; human items (MFA on all admins, continuity pack, legal status, 50+ bursaries seeded) are confirmed BY the Founder, evidenced in the checklist file via PR.
2. Production env audit: secrets present, keys generated fresh (never reused from staging), Sentry prod DSN, cost alerts armed, partition horizon verified, Cloudflare in front.
3. Cutover per S6.29: migrate prod DB → deploy api → deploy web → smoke suite.
4. THE DEFINITION OF DONE (MASTER-SPEC §3): one real student — register → profile → apply → matched → tracked — end-to-end in production. Capture it.
5. Post-launch watch: 48h elevated monitoring; daily integrity job review for week one.
STOP. Celebrate properly, then the Founder decides when v1.5 planning begins. 🇿🇦
