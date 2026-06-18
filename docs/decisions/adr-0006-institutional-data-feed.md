# ADR-006 — Institutional Academic + Financial Data Feed (STUB)

| Attribute | Value |
|-----------|-------|
| **ID** | ADR-006 |
| **Date** | 2026-06-18 |
| **Status** | **PROPOSED — design-handoff stub (awaits Engineer 01 + Founder L4)** |
| **Relates To** | ADR-001, TAD §3.5 (institution tenancy), BR-I02, MASTER-SPEC §3 Release Map (v2/v2.5/v4), `PARKED.md`, D-016, D-017 |
| **Owner** | Engineer 01 (Principal Architect) — **not** an Engineer 02 build item |

> ⚠️ **This is a stub, not a decision.** It exists so the idea is captured with its real
> dependencies and cannot be quietly folded into a build session. The actual architecture is
> Engineer 01's to design and the Founder's (L4) to ratify. Engineer 02 (build-only, L3) must
> **not** implement anything from this file until it is a ratified ADR with an approved design.

## Context

Eligibility today (v1) runs on **self-declared** evidence verified by a human (§5.7): the NSFAS
outcome letter (D-016), `PROOF_OF_INCOME` / SASSA confirmation (D-017), enrolment documents. This
is correct and shippable from day one. The aspiration is to make these **authoritative** by
ingesting the record directly from each university: enrolment status, fee/debt balance, and
NSFAS-funded status per student — enabling automatic eligibility verification and registrar
enrolment confirmation, and eventually fraud/duplicate detection across institutions.

This is **materially larger** than the seams already present:
- `InstitutionScopedRepository` (dormant, `app/db/repository.py`) — row-scoped tenancy, BR-I02.
- `INSTITUTION_OFFICER` role + `INSTITUTION_MANAGE_OWN` permission (auth module).
- The Release Map already schedules a **v2** institution portal and **v2.5** registrar
  enrolment confirmation. A full *data feed* (universities stream rosters, not just officers
  acting in a portal) is the **v4** "partners integrate / auto-data" horizon (§4.3).

## Hard dependencies (why this is not an engineering ticket)

1. **MOUs / data-sharing agreements** with each university (and likely NSFAS) — a BD/legal lane,
   the long pole (§4.3: auto-data "is not technically deliverable without partner APIs").
2. **POPIA lawful basis** — ingesting third-party academic + financial records about people who
   have **not** applied is a heavy consent/retention/Information-Officer question. C5 + §15.
3. **A new ingestion + university-registry architecture** — source-of-truth reconciliation,
   identity matching, staleness/trust, and store assignment. New ADR, not an extension.

## Decision

**Deferred — no decision yet.** Routed to Engineer 01 for design when the Release Map reaches the
institution portal (v2) / registrar confirmation (v2.5) / partner data feed (v4), and only once the
MOU + POPIA lanes are open. Until then, eligibility remains self-declared-docs + Human-Final
(§5.7, D-016/D-017), which is sufficient for v1 "done".

## Open questions for the eventual design

- Ingestion model: partner **pull API** vs. partner **push** vs. batch reconciliation file?
- Which store holds the feed, and how does it reconcile against the application's self-declared
  fields without silently overriding a human decision (D-010, D-014)?
- Identity matching key across institutions (SA ID blind index — BR-A04) and its POPIA envelope.
- Trust/staleness policy: how authoritative is a feed value vs. an uploaded document?
