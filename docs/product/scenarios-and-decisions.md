# FundsLink Academy — Scenarios & Decisions Playbook

> **Why this document exists.** Every phase (02 Auth → 06 Launch) keeps bumping into the same
> question: *"a real student hits this edge — what should the system do?"* Instead of
> re-deriving the Founder's intent each time (and re-asking the Founder), we capture it **once**,
> as a living decision log told through real student stories. Read the scenarios relevant to
> your phase; when you hit a new edge, **append a decision** here rather than guessing.

| | |
|---|---|
| **Status** | Living (append-only in spirit — supersede with a dated note, never silently overwrite) |
| **Owner** | Founder (L4) decides; any engineer may *propose* a row |
| **Reads with** | `master-spec.md` (§25 lifecycle addendum) · `data-model.md` (Part 6) · the stage briefs |
| **Citation** | Decisions are `D-NNN`; cite them like standards in PRs and tests |

---

## How to use it

- **Before building a flow**, scan the [Decision Log](#decision-log) for anything touching it.
- **When a student edge appears** that isn't covered: write it as a scenario (student voice +
  the hard questions), propose a ruling, and tag `D-NNN — PROPOSED`. The Founder confirms →
  `ADOPTED`. Nothing is "decided" until the Founder says so (S10.8).
- **When you implement a decision**, reference its `D-NNN` in the migration/PR/test so the trail
  is traceable both ways.

---

## Decision Log (quick index)

| ID | Decision | Status | Stage | Maps to |
|----|----------|--------|-------|---------|
| D-001 | FundsLink intake is **open 24/7** — no application submission deadline | ADOPTED | 03/04 | BR-S12; master-spec §25.1 |
| D-002 | **Priority/emergency lane** — defunded-late students triaged first, shorter SLA | ADOPTED | 0004 + 03 | `lk_priority`, `needed_by`, `emergency_review_sla_days`; BR-S11 |
| D-003 | **Post-approval lifecycle** — APPROVED→{SUSPENDED,REVOKED,COMPLETED}, human + note | ADOPTED | 0004 + 03 | BR-S10; transitions + `application_status_event.note` |
| D-004 | **APPROVED blocks a same-year duplicate**; only COMPLETED frees the year | ADOPTED | 0003/0004 | `uq_app_active_per_year` |
| D-005 | **Document validity** — expired doc → *return*, never reject | ADOPTED | 0004 + 03 | `document.issued_at/valid_until`; BR-E10 |
| D-006 | **Resubmission clock** — RETURNED_FOR_INFO carries `respond_by`; remind, don't punish | ADOPTED | 0004 + 03 | `application_return.respond_by` |
| D-007 | **SA ID required before SUBMIT**, not before register | ADOPTED | 02/03 | `uq_user_idnum`; service guard |
| D-008 | **11 SA official languages**; WhatsApp a consented channel; mobile-first/low-data | ADOPTED | 0004 + 04 | `ck_sp_language`, `MARKETING_WHATSAPP`; BR-A08/N04 |
| D-009 | **DEFAULT partitions** as overflow safety nets on the critical write-path tables | ADOPTED | 0003 | default partitions |
| D-010 | **The machine never decides** — APPROVED/REJECTED/REJECTED_FINAL require a human | ADOPTED | 01 | `fn_human_final`; BR-E03 |
| D-011 | Derived seed value-sets **confirmed as-is** (tracked transitions, doc/consent/notify/deadline lookups) — refine in Stage 03 if a real bursary admin disagrees | ADOPTED | 02/03 | 0002/0004 seeds |
| D-012 | **Suspend/Revoke/Complete policy** — COMPLETED at `funding_end`; SUSPENDED on uncertain status (e.g. attendance flag / NSFAS re-funds → pause), reversible; REVOKED on confirmed drop-out / deregistration / fraud (terminal). Revoke/complete need a human (ADMIN_AUTHORIZER for money) + reason in `note`. | ADOPTED (delegated) | 03 | BR-S10; transitions + note |
| D-013 | **Priority authority** — students apply at NORMAL and may *request* urgency (reason + `needed_by`); only ADMIN_REVIEWER+ may set URGENT/CRITICAL (anti-gaming), evidenced by the motivation + documents (e.g. NSFAS defunding / exclusion notice). | ADOPTED (delegated) | 03 | `lk_priority`; BR-S11 |
| D-014 | **No silent edits under review** — a SUBMITTED/UNDER_REVIEW application is locked; new urgent info arrives as a new Document or a reviewer `note`, or via RETURNED_FOR_INFO→resubmit. Keeps the audit trail clean. | ADOPTED (delegated) | 03/04 | `document`, `application_status_event.note`, `application_return` |
| D-015 | **Auth-table RLS is a Stage 02 contract** — `user` / `refresh_token*` get RLS in Stage 02 with a SYSTEM-context login/token-validation path (you have no `user_id` at login). Not bolted on in Stage 01. | ADOPTED (delegated) | 02 | C3; `app.user_role='SYSTEM'` login context |

---

## Personas (the humans behind the edges)

- **Naledi** — 2nd-year, failed two modules, NSFAS paused, R14k fee block. Applies at 11pm on a
  R29 data bundle from her phone. *(CAT_A / OTHER.)*
- **Thabo** — final-year, NSFAS "couldn't pay fully", has an institution debt statement. *(CAT_B.)*
- **Aisha** — postgrad with an acceptance letter, no NSFAS history. *(POSTGRAD.)*
- **Sipho** — was funded, then **dropped out mid-year**. *(Post-approval lifecycle.)*
- **Lerato** — missed every external bursary deadline, then **NSFAS defunded her at year-end**.
  *(The emergency/late case.)*

---

## Scenario library

### S-1 · "I was defunded late and every deadline has passed" (Lerato)
- **As the student:** *"It's November. NSFAS just cut me. The bursaries I wanted closed months ago.
  Am I too late? Does this system even let me ask for help now?"*
- **As the Founder:** *"A passed external deadline must never close our door — cracks don't respect
  deadlines. But how do I make sure she's seen quickly without making everyone 'urgent'?"*
- **Ruling (D-001, D-002):** FundsLink intake is **always open**; there is no submission deadline
  on a FundsLink application. Lerato applies as OTHER/CAT_A, sets `needed_by`, and the case is
  flagged URGENT/CRITICAL → triaged ahead via `ix_app_review_triage`, shorter
  `emergency_review_sla_days`. External deadlines only ever affect *tracked external bursaries*.

### S-2 · "I was funded, then I dropped out" (Sipho)
- **As the student / institution:** *"Sipho deregistered. The money shouldn't keep flowing."*
- **As the Founder:** *"Approval can't be the end of the story — I must be able to stop or pause an
  award, with a reason, by a human, on the ledger."*
- **Ruling (D-003):** `APPROVED → SUSPENDED/REVOKED/COMPLETED` by a human actor, reason in
  `application_status_event.note`. SUSPENDED still counts as active; COMPLETED frees the year.

### S-3 · "My document expired while I waited" (any)
- **As the student:** *"My proof of registration expired during review. Am I rejected now?"*
- **Ruling (D-005):** Never. An expired document (`valid_until` past) triggers a **RETURN for info**
  with a `respond_by` (D-006), not a rejection (BR-E10).

### S-4 · "I already have one application this year" (any)
- **Ruling (D-004):** One active/funded application per student per academic year. APPROVED,
  SUSPENDED, REVOKED all still block a duplicate; only COMPLETED, REJECTED(_FINAL), WITHDRAWN free
  the year. Enforced by `uq_app_active_per_year`.

### S-5 · "Two emails, one me" (fraud/dup)
- **Ruling (D-007):** SA ID (blind-indexed) is required **before SUBMIT** — keep registration
  frictionless, make duplication impossible at the moment money is at stake.

### S-6 · "Talk to me like a person, in my language, on my phone" (Naledi)
- **Ruling (D-008):** preferred language from the 11 SA official languages drives the whole UI;
  WhatsApp/SMS/email are consented channels; screens are mobile-first, low-data, autosave drafts.

### S-7 · "The system asked the machine to approve me" (integrity)
- **Ruling (D-010):** Impossible by construction — the DB trigger `fn_human_final` rejects any
  APPROVED/REJECTED/REJECTED_FINAL transition whose actor is the SYSTEM principal. **Cross-stage
  contract:** when Auth (Stage 02) seeds the system principal, its `user.id` MUST be `'SYSTEM'`.

---

## Open questions (parking lot — resolve before the owning stage builds)

All resolved by the Founder (delegated judgment, 2026-06-14). Kept here as the trail.

| # | Question | Resolution |
|---|----------|-----------|
| OQ-1 | Confirm `tracked_status_transition` set vs BR-T04 | **D-011** — confirmed as-is; revisit in Stage 03 with a bursary admin |
| OQ-2 | Confirm `lk_doc_type`/`consent_purpose`/`notify_trigger`/`deadline_type` value-sets | **D-011** — confirmed as-is |
| OQ-3 | What suspends/revokes funding? | **D-012** — policy adopted (COMPLETED at funding_end; SUSPENDED reversible; REVOKED on drop-out/fraud) |
| OQ-4 | Who sets CRITICAL priority + evidence? | **D-013** — students request; ADMIN_REVIEWER+ confirms; evidenced by motivation + docs |
| OQ-5 | Edit while UNDER_REVIEW? | **D-014** — no silent edits; new info via Document / reviewer note / RETURN→resubmit |
| OQ-6 | RLS on auth tables (`user`/tokens)? | **D-015** — Stage 02 contract (SYSTEM-context login) |

---

## Template — adding a new decision

```markdown
### S-N · "<student's words for the edge>" (<persona>)
- **As the student:** "<what they feel / fear / need>"
- **As the Founder:** "<the tension / the principle at stake>"
- **Ruling (D-NNN — PROPOSED|ADOPTED):** <the decision>. Maps to <table/standard>. Stage <NN>.
```

Then add the `D-NNN` row to the [Decision Log](#decision-log) and cite it where you implement it.
