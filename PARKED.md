# PARKED — Ideas wait here. The Release Map decides.

v1 scope is fixed by MASTER-SPEC §3 Release Map (the 5 features). Anything outside it —
new ideas, "wouldn't it be nice", scope creep — is parked here, not built. The Founder and the
Release Map decide if and when a parked idea graduates.

| Date | Idea | Raised by | Status |
|------|------|-----------|--------|
| 2026-06-14 | **Restricted/earmarked donor funds** — inbound funds tagged by institution/level/field/programme; allocation honours the restriction (couples to the v2 allocation engine + §16.3 sub-ledger) | Founder + sole engineer | Parked → v1.5/v2 design |
| 2026-06-14 | **Institutional donor accounts** — multi-user org account (ORG_ADMIN/FINANCE/VIEWER), KYB state machine, authorised-signatory + grant/MOU e-signature record | Founder + sole engineer | Parked → v2/v3 corporate portal |
| 2026-06-14 | **Donor-side AML/FICA** — anonymity threshold (KYC above R-X), source-of-funds + sanctions/PEP screening for large/institutional donors | Founder + sole engineer | Parked → v1.5 design (fold into §14) |
| 2026-06-14 | **Pledge vs received** — model committed pledges separately from ledgered receipts; spend-guard allocates only received+reconciled funds | Founder + sole engineer | Parked → v1.5 design |
| 2026-06-18 | **Institutional academic + financial data feed** — universities stream FundsLink the authoritative per-student record (enrolment, fee balance, NSFAS-funded status) so eligibility & registrar enrolment can be **auto-verified** instead of self-declared. Materially larger than the v2 institution portal / v2.5 registrar-confirmation design; gated on per-institution **MOUs / data-sharing agreements**, **POPIA** lawful-basis for third-party records of non-applicants, and a new ingestion/registry **ADR** (Engineer 01). Until then, eligibility runs on self-declared docs + Human-Final (§5.7, D-016/D-017). | Founder + sole engineer | Parked → v2 portal · v2.5 registrar confirmation · v4 partner data feed. Design-handoff: [`adr-0006`](docs/decisions/adr-0006-institutional-data-feed.md) (PROPOSED stub) |
| 2026-09-13 | **Audit staff reads of applicant personal information** — record who opened which application (A02 `adminGetApplication`) and when, so a data subject's access request (POPIA §23) can say who has seen their record, and misuse is detectable. Writes are already audited; reads are not, and no spec requires it today. Needs a decision on retention and on whether queue listings count as a read. | Engineer 02 (raised while adding the admin read, #288) | Parked → Founder decision; fits the S21 data-and-privacy surface |

> These graduate via the MASTER-SPEC §3.2 Release Map (donations = v1.5+, deferred-not-promised). Full design: [`docs/architecture/funding-donations-architecture.md`](docs/architecture/funding-donations-architecture.md) (PROPOSED — L4 lock pending). The pending **C5 ledger-immutability amendment** (MASTER-SPEC §16.2) awaits Founder C0 §8 approval before the v1.5 ledger is built.
