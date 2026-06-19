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
| D-016 | **NSFAS-eligibility signal (UG)** — Category C anchors on the *already-required* NSFAS outcome letter: a bounded `nsfas_decline_reason` enum (`MEANS_INCOME` / `DOCUMENTATION` / `ADMINISTRATIVE` / `ACADEMIC_NPLUS` / `OTHER`) replaces §5.4's ambiguous "various reasons". `MEANS_INCOME` (NSFAS assessed the household above the funding line) → human **declines** with a kind NSFAS/missing-middle redirect; non-income reasons → genuine crack → eligible. Adds a **universal** self-declared `household_income_band` + `prior_funder`/`defunded_by`; a private-bursary-defunded student who is still NSFAS-eligible (≤R350k) is redirected to NSFAS **first**. The engine only **annotates** (severity `review_flag`); the human decides (§5.7, D-010). We do **not** build a means-test — NSFAS already performed it (§1.7). | ADOPTED (L4, 2026-06-18) | 03 — eligibility pass | `lk_income_band`, `lk_nsfas_decline_reason`, `lk_prior_funder`; `ers_ug_cat_c_v2`; §5.4; BR-E01/E02 |
| D-017 | **Postgrad income requirement** — postgrad has **no** NSFAS bursary or missing-middle rail, so an affluent self-funder and a destitute student arrive identical. A **hard income ceiling** (config — recommended **R600k** household/yr = top of the national "missing middle"; disability parity raised) excludes those who can self-fund → redirect to NRF/commercial. **Below** the ceiling, the existing **need-severity ordering** (E4 / §16, `APPROVED_WAITLISTED`) floats SASSA / ≤R350k students to the **top** of a capacity-limited pool — income gates *and* prioritises. Requires `PROOF_OF_INCOME` (or a SASSA confirmation); the engine checks **presence**, the human verifies the **figure** against the config ceiling (§5.7). Amends §4.1 / §5.1. | ADOPTED (L4, 2026-06-18) | 03 — eligibility pass | `lk_income_band`; `ers_postgrad_v2`; `PROOF_OF_INCOME` (seeds §13); E4 / §16 |
| D-018 | **Exit-debt edges stay OTHER (v1)** — a non-NSFAS-bursary exit-debt gap, and a self-funded postgrad exit-debt, have no first-class category; they route to **OTHER** (human case-by-case, §5.6) with structured capture (funder / level / debt context) and a reviewer **theme tag**. The §5.6 quarterly theme-clustering promotes a recurring edge to a first-class category once real volume warrants — never proliferate rulesets ahead of demand. | ADOPTED (L4, 2026-06-18) | 03+ | §5.6 theme tag; `ers_other_v1`; quarterly cluster report |
| D-019 | **Channel↔consent policy (POPIA)** — `EMAIL` and `IN_APP` are **transactional** (service messages about the student's own application) and send without marketing consent; **`SMS` is marketing-class and requires `MARKETING_SMS` consent**. A channel lacking its required consent is **skipped and logged**, never blocked or errored (BR-N03). Ratifies the policy already enforced in the outbox worker + `CHANNEL_CONSENT` map. | ADOPTED (L4, 2026-06-18) | 03 | `notification` worker (BR-N03); `CHANNEL_CONSENT`; `lk_consent_purpose` |

---

## Personas (the humans behind the edges)

- **Naledi** — 2nd-year, failed two modules, NSFAS paused, R14k fee block. Applies at 11pm on a
  R29 data bundle from her phone. *(CAT_A / OTHER.)*
- **Thabo** — final-year, NSFAS "couldn't pay fully", has an institution debt statement. *(CAT_B.)*
- **Aisha** — postgrad with an acceptance letter, no NSFAS history. *(POSTGRAD.)*
- **Sipho** — was funded, then **dropped out mid-year**. *(Post-approval lifecycle.)*
- **Lerato** — missed every external bursary deadline, then **NSFAS defunded her at year-end**.
  *(The emergency/late case.)*
- **Karabo** — UG, NSFAS declined her because the household income is **above the threshold**.
  *(The means-test edge — D-016.)*
- **Mpho** — UG, a **private bursary dropped him** mid-year; household ≤ R350k, still NSFAS-eligible.
  *(The NSFAS-first redirect — D-016.)*
- **Zanele** — postgrad acceptance, **SASSA household**, no funder exists anywhere for her level.
  *(Postgrad need — D-017.)*
- **Reabetswe** — postgrad, comfortable family (**> R600k**), could self-fund but applies anyway.
  *(Postgrad ceiling — D-017.)*

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

### S-8 · "NSFAS said no because my parents earn too much" (Karabo / Mpho)
- **As the student (Karabo):** *"NSFAS turned me down — they said our household earns too much. But
  we still can't cover the fees. Can FundsLink fund me?"*
- **As the student (Mpho):** *"My private bursary pulled out. My family is poor — under the NSFAS
  line. Where do I go?"*
- **As the Founder:** *"We do **not** oppose NSFAS (§1.7). If NSFAS deliberately means-tested a UG
  student out, funding them is us undoing NSFAS's own line — that's exactly what we must not do.
  But a student NSFAS declined on **paperwork**, or one a private funder dropped who is **still
  NSFAS-eligible**, is a genuine crack or belongs back at NSFAS. How do I tell these apart **without
  building my own means-test** I can't verify and that POPIA would punish me for?"*
- **Ruling (D-016):** Don't build a means-test — **read the one NSFAS already ran.** Category C
  already *requires* the NSFAS outcome letter; we replace §5.4's "various reasons" with a bounded
  `nsfas_decline_reason` enum confirmed against that letter. `MEANS_INCOME` → the human declines
  with a kind missing-middle/NSFAS redirect (Karabo). `DOCUMENTATION`/`ADMINISTRATIVE` → genuine
  crack → eligible. A self-declared `household_income_band` + `prior_funder`/`defunded_by` is
  captured universally; Mpho (private-bursary-dropped, ≤ R350k) is **redirected to NSFAS first**.
  The pre-screen only **annotates** these as review flags — the human decides (§5.7, D-010).

### S-9 · "At postgrad we're all on our own — fund the ones who truly can't" (Zanele / Reabetswe)
- **As the student (Zanele):** *"I got into my Master's. There's no NSFAS for us, no missing-middle
  loan. My family is on SASSA. Without R1,000/month to my institution I lose the place."*
- **As the Founder:** *"Postgrad is our **primary** focus precisely because every public rail stops
  at undergrad — so Zanele and Reabetswe (whose family clears R600k) walk in looking identical.
  A finite pool spent on self-funders is a pool stolen from the Zaneles. Postgrad **must** have an
  income line too — but it must still be a human who decides, and the poorest must come first."*
- **Ruling (D-017):** Postgrad gets its **own** income requirement — a **hard ceiling** (config;
  recommended R600k = top of the national "missing middle", disability parity raised) above which
  we redirect to NRF/commercial (Reabetswe). **Below** it, the existing **need-severity ordering**
  (E4 / §16, `APPROVED_WAITLISTED`) floats SASSA / ≤ R350k applicants like Zanele to the **top** of
  the pool. Evidence is `PROOF_OF_INCOME` (or SASSA confirmation): the engine checks it is
  **present**, the human verifies the **figure** (§5.7). This **strengthens** "postgrad-first" by
  defining *which* postgrad students are the underserved ones. Amends §4.1 / §5.1.

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
