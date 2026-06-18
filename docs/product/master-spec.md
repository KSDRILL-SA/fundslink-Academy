# ⭐ FUNDSLINK ACADEMY — MASTER SPECIFICATION ⭐
# THE MAIN DOCUMENT — ALL OTHER SUITE DOCUMENTS DERIVE FROM THIS ONE

## Version 1.2 (MASTER, LOCKED) | Date: 2026
## v1.2: Eligibility-policy hardening — NSFAS-eligibility signal for UG Category C (decline-reason, not "various reasons"), postgrad income requirement, prior-funder redirect (§4.1, §5.1, §5.4; D-016/D-017/D-018). Founder-approved (L4) 2026-06-18 per C0 §8.
## v1.1: Smart Pre-Screening Engine + Category D (Other Reasons) + Human-Final Principle + Edge-Case Register (§5.6–§5.8, §14.6)
## Founder: Maluleke Kurhula Success – NWU, Final Year
## Lineage: supersedes business-spec generations v1–v3 and normalized draft v4.0
## Governance: KSDRILL SA Constitutional System (C0–C10) | Suite: Documentation Suite v1.0

---

## DOCUMENT CONTROL

| Attribute | Value |
|-----------|-------|
| Version | 1.2 (MASTER) |
| Status | LOCKED — the main document of Documentation Suite v1.0; supersedes all prior spec generations |
| Governance alignment | `system-design-template` C0–C10, ADR-001, `fundslink-context.md` |
| Normalization basis | Principal Architect Adversarial Review (Findings 0–11) + Founder Decision Sheet D1–D12 |
| Change authority | Founder approval (L4) required for any amendment, per C0 §8 |

### What Changed in this Master edition vs business spec v3.0 (Summary)

| # | Change | Replaces |
|---|--------|----------|
| 1 | **Release Map** added — phased delivery governs build order | "Everything is MVP" |
| 2 | Minimum online donation set to **R5** with fee transparency rule | 50c minimum on payment rails |
| 3 | Round-Up Program redesigned as **app-side, batched, buildable** | Bank/ATM/POS interception at MVP |
| 4 | Status tracking promise rewritten to be **keepable** (self-report + nudges + email opt-in) | "We track every external application automatically" |
| 5 | **Accredited Payment Partners Registry** formalizes accommodation/bookstore payments | "Accredited landlord" contradiction |
| 6 | **POPIA & Data Protection** section added (special personal information handled) | No data protection section |
| 7 | **Two-step approval** on all funding disbursements — no single approver, including Founder | Single-admin approval |
| 8 | **AI Matching Governance** section added — advisory-only, auditable, human-confirmed | Ungoverned matching |
| 9 | **Verification & Anti-Fraud Layer** expanded | Trust ladder without fraud controls |
| 10 | Notifications policy costed — SMS reserved for outcome-critical events | Unbounded SMS |
| 11 | **Financial Controls** + **Operations & Reliability** sections added (ledger, reconciliation, NFRs) | None |
| 12 | Philosophy, NSFAS positioning, categories, redirection, pledge, legacy — **preserved intact** | — |

---

# TABLE OF CONTENTS

1. Executive Summary
2. Core Identity & Philosophy
3. The Release Map (NEW — Governs Build Order)
4. The Three Core Funding Activities
5. Student Categories & Funding Rules
6. Course Redirection & Exclusion Support
7. Monthly Allowance System
8. Donation Collection Ecosystem (REWRITTEN)
9. The Round-Up Program (REWRITTEN)
10. Corporate & Government Partnerships
11. The Pay-It-Forward Pledge
12. The Application Organization & Tracking System (REWRITTEN)
13. Student Journey (End-to-End)
14. Verification, Trust & Anti-Fraud Layer (EXPANDED)
15. POPIA & Data Protection (NEW)
16. Financial Controls & Money Governance (NEW)
17. AI Matching Governance (NEW)
18. Notification Policy (UPDATED)
19. Operations & Reliability (NEW)
20. Governance & Independence
21. The Founder's Legacy
22. Success Metrics (REALITY-ALIGNED)
23. Glossary of Terms
24. Appendix: Quick Reference Cards

---

# 1. EXECUTIVE SUMMARY

## 1.1 What is FundsLink Academy?

FundsLink Academy is an independent, non-profit education funding platform. Its core activity is to collect donations from everywhere and use that money to fund students directly. FundsLink is a bursary itself, not a bursary aggregator.

**FundsLink is a partner and helper to NSFAS, not a judge or critic.** We exist to bridge the gaps that naturally occur in any large system. We do not claim NSFAS is failing. We simply see edge cases and gaps that any system of its size will inevitably have, and we step in to help where we can.

## 1.2 The Three Problems FundsLink Solves

| Problem | Current Situation | FundsLink Solution |
|---------|-------------------|---------------------|
| **Postgraduate funding** | Almost non-existent | Primary focus of FundsLink |
| **NSFAS edge cases** | Some students fall through cracks | One-year intervention + return to NSFAS |
| **Bursary application chaos** | Apply to 5+ bursaries, check each website daily, no central status, missed outcomes | One profile, one dashboard, organized tracking of every application the student registers, with reminders and follow-ups |

## 1.3 The Core Trust Rule (Absolute)

> **"No money ever goes directly to any student. Every single rand – including monthly allowances – is paid to the institution or to an Accredited Payment Partner. The institution then distributes allowances to students on their own scheduled dates."**

This rule is absolute and non-negotiable. It ensures:
- Complete transparency
- No risk of fund misuse
- Institutional accountability
- Clear audit trails

*(Master-edition note: the v3.0 phrase "accredited landlord" is replaced by the Accredited Payment Partners Registry — see §14.5 — so this rule no longer contradicts itself.)*

## 1.4 The Tagline

> *"Funded by many. For those who need it most. 50c at a time."*

*(The 50c identity lives in the Round-Up Program's batching model — many 50c round-ups collected as one efficient monthly payment. See §9.)*

## 1.5 The Founder's Promise

> *"I expect nothing back. But if you're a graduate and you can afford R100/month for 2 years... someone right now needs you."*

## 1.6 The NSFAS Partnership Statement (Professional Positioning)

> *"FundsLink Academy is not a replacement for NSFAS. NSFAS remains the primary funder of undergraduate education in South Africa. FundsLink exists as a helper and partner, stepping in where edge cases and gaps naturally occur in any large system. We see students who need just one more chance, one more year, or one more connection to the right bursary. We help them get back on track and, where possible, return them to NSFAS. This is not a critique. This is collaboration."*

---

# 2. CORE IDENTITY & PHILOSOPHY

## 2.1 What FundsLink IS

- A funding platform
- A bursary entity
- An independent non-profit
- A helper and partner to NSFAS
- A bridge over natural gaps in large systems

## 2.2 What FundsLink IS NOT

- NOT a replacement for NSFAS
- NOT a judge of NSFAS's performance
- NOT a government department
- NOT a loan provider
- NOT a competition

## 2.3 Core Principles

| Principle | Meaning |
|-----------|---------|
| **Postgraduate first** | Most underserved group gets priority |
| **One year, then NSFAS** | Undergraduate funding is temporary, then return to NSFAS |
| **No cash to any student** | Every rand goes to institutions or Accredited Payment Partners |
| **Always collecting** | R5 to R1M+, 24/7, online — and 50c at a time through batched round-ups |
| **Graduates pay forward** | R100+/month after employment |
| **Independent forever** | Partner WITH government, never owned BY government |
| **One dashboard for all bursaries** | Students organize and track every application in one place |
| **Institutional distribution** | Allowances paid to institutions, not students directly |
| **Promises we can keep** *(NEW)* | Every promise made to students, donors, and institutions must be technically and legally deliverable |
| **Money is governed** *(NEW)* | Every rand has a ledger entry; no disbursement has a single approver |

## 2.4 The Philosophy Statement

> *"We don't compete with NSFAS. We complete it. Where the system naturally has gaps, FundsLink bridges them. Where students fall through cracks, FundsLink catches them. Where bursary applications become chaos, FundsLink brings order. And every single rand – including monthly allowances – flows through trusted institutions, never directly to individuals."*

---

# 3. THE RELEASE MAP (NEW — GOVERNS BUILD ORDER)

## 3.1 Why This Section Exists

The v3.0 business spec described the complete vision as if all of it were the MVP. That created a constitutional conflict with the locked v1 feature set in `fundslink-context.md` (S9.9 — maximum 6 features per release). Version 4.0 resolves the conflict: **this specification is the north star; the Release Map governs what gets built, in what order.** No phase begins before the previous phase's "Done When" condition is met in production.

## 3.2 The Release Map

| Phase | Name | Scope | Done When |
|-------|------|-------|-----------|
| **v1** | Core Platform | 1. Authentication (registration, login, JWT) · 2. Student profile creation · 3. Funding application submission · 4. AI-powered eligibility matching (advisory) · 5. Application status tracking (self-reported + FundsLink-internal statuses) | A student can register, apply, and receive at least one matched funding opportunity end-to-end in production |
| **v1.5** | Donations Online | One payment gateway. Card + EFT. R5 minimum. Recurring monthly mandates. Section 18A receipt generation. Donor wall + tiers. Immutable donation ledger. | A donor can give R5–R1M+ online, receive a Section 18A receipt automatically, and every cent reconciles daily against gateway settlement |
| **v2** | Money Out | Institution portal (org-scoped access). Disbursement engine (tuition, debt, allowance pools). Per-student allowance sub-ledger. Two-step approval. Monthly reconciliation + returns workflow. | A funded student's tuition and allowance flow to their institution with full per-student audit trail and institution confirmation |
| **v2.5** | Verification at Scale | Document verification workflow. Registrar enrolment confirmation. Duplicate/fraud detection. Interview scheduling + redirection case management. | Bronze→Platinum pipeline runs digitally end-to-end with fraud controls active |
| **v3** | Growth Engines | Round-Up Program (app-side, batched — §9). External bursary database + deadline engine. Email-forwarding outcome capture. Pay-It-Forward pledge automation. Corporate partner portal. | First batched round-up debit orders collected; first graduate pledge auto-collected |
| **v4** | Partnerships | Bursary partner status APIs. Payroll giving. SETA discretionary grant channel. Additional payment channels (SnapScan, airtime, WhatsApp). | First external bursary pushes live statuses into a student dashboard |
| **Vision** | National Round-Up Campaign | Bank, retailer, and government negotiation for transaction-level round-up prompts. **This is advocacy and policy work, not system architecture.** | National pilot agreement signed |

## 3.3 Release Map Rules

1. The Release Map may only be amended with Founder approval (C0 §8).
2. A feature described in this specification but not yet in an active phase is **deferred, not promised** — marketing and student-facing copy may not promise deferred features as current capabilities.
3. Each phase keeps the S9.9 discipline: maximum 6 features per release.

---

# 4. THE THREE CORE FUNDING ACTIVITIES

## 4.1 Activity 1: Fund Postgraduate Students (PRIMARY FOCUS)

### Why Postgraduate is Primary

- Undergraduate students mostly have NSFAS
- Postgraduate funding is almost non-existent
- Job market demands Honours+ or 3–4 years experience
- Companies won't hire without experience; students can't get experience without Honours

### Who Qualifies

| Level | Requirement |
|-------|-------------|
| Honours | Accepted into programme |
| Masters | Accepted into programme |
| PhD | Accepted into programme |
| Postgraduate Diploma | Accepted into programme |

### Income Eligibility (NEW in v1.2 — D-017)

Acceptance alone is not enough. Because **no** public rail (NSFAS bursary, missing-middle loan)
reaches postgraduate level, a self-funding higher-income student and a destitute one arrive
indistinguishable — and a finite pool spent on the former is stolen from the latter. Postgrad
therefore carries its **own** income line:

- A **hard household-income ceiling** (configuration, not code — recommended **R600,000/yr**, the
  top of the national "missing middle"; raised for students with disabilities, mirroring NSFAS).
  Above the ceiling → redirected to NRF / commercial funders, never funded by FundsLink.
- **Below** the ceiling, need is a **prioritiser, not a second gate**: SASSA / ≤ R350k applicants
  are floated to the top of any capacity-limited pool via need-severity ordering (E4, §16) —
  nobody below the ceiling is silently rejected.
- Evidence is `PROOF_OF_INCOME` (or a SASSA confirmation). The Pre-Screening Engine checks the
  document is **present** and annotates the declared band; a **human** verifies the figure against
  the ceiling and decides (§5.7 — the machine never judges income).

> *This does not narrow the postgrad-first mission — it sharpens it, by naming which postgraduate
> students are the underserved ones we exist for.*

### Funding Conditions

- Maintain **65% average overall** to continue
- Progress to next level requires successful completion
- Failure is not funded (by postgraduate level, you know your path)

### Duration

- Continuous as long as academic requirements are met
- No one-year limit

## 4.2 Activity 2: Fund Undergraduate Students Who Fall Through NSFAS Cracks (SECONDARY FOCUS)

### Three Categories of Undergraduate Students

| Category | Description |
|----------|-------------|
| **Category A** | Students who FAILED and NSFAS (naturally) had to pause funding |
| **Category B** | Students NSFAS was unable to pay fully due to system constraints |
| **Category C** | Students who didn't qualify for NSFAS initially due to various reasons |

**Important Positioning:** These are not failures of NSFAS. These are natural edge cases that occur in any large funding system. FundsLink exists to catch these edge cases and help students get back on track.

**Rule:** All undergraduate funding is for **ONE YEAR ONLY**, then student is recommended back to NSFAS.

## 4.3 Activity 3: The Application Organization & Tracking System (BONUS ACTIVITY)

*(Fully specified in §12. this Master edition reframes this from "we automatically track every external bursary" — which is not technically deliverable without partner APIs — to "we organize, remind, and follow up on everything you're tracking," which is deliverable from day one and grows into automatic tracking as partners integrate in v4.)*

---

# 5. STUDENT CATEGORIES & FUNDING RULES

## 5.1 Complete Funding Table

| Student Type | Funding Duration | Monthly Allowance | Success Requirement | After Funding |
|--------------|------------------|-------------------|---------------------|----------------|
| **Postgraduate (Honours+)** | Continuous | R1,000 (paid to institution) | 65% average + income ≤ ceiling (D-017) | Continue funding |
| **Undergrad – Failed (NSFAS paused)** | 1 year + redirection support | R1,000 (paid to institution) | Improve performance | Recommended back to NSFAS |
| **Undergrad – NSFAS unable to pay** | One-time debt payment | R1,000 (paid to institution) | N/A | Graduate or continue |
| **Undergrad – Never qualified** | 1 year | R1,000 (paid to institution) | Good performance | Recommended to NSFAS |
| **Category D – Other Reasons** | Case-by-case (human-decided) | Case-by-case | Case-by-case | Case-by-case |

## 5.2 Undergraduate Category A: Students Who Failed (NSFAS Paused Funding)

**The Situation (Neutral Wording):**
- Student experienced academic difficulty and failed a year
- NSFAS, following its policies, had to pause funding
- Student is now in a gap, needing support to get back on track

**The FundsLink Solution:**
- FundsLink intervenes as a helper
- Provides course redirection support (see §6)
- Funds student for ONE YEAR
- Student improves performance
- After one year → Recommended back to NSFAS
- FundsLink moves to next student

**Positioning Statement:**

> *"NSFAS does important work funding millions of students. In any large system, there will be students who need a little extra support to get back on track. FundsLink is here to provide that support. We help the student improve, then we return them to NSFAS. This is teamwork, not criticism."*

## 5.3 Undergraduate Category B: Students NSFAS Was Unable to Pay Fully

**The Situation (Neutral Wording):**
- NSFAS approved the student
- Due to system constraints or administrative timelines, full payment was not completed
- Student now owes the institution
- Student cannot register or graduate

**The FundsLink Solution:**
- FundsLink pays debt directly to institution
- Student can register or graduate
- One-time intervention

## 5.4 Undergraduate Category C: Students Who Didn't Qualify for NSFAS Initially

**The Situation (Neutral Wording):**
- Student applied to NSFAS
- Did not meet criteria or documentation requirements
- Student has potential but needs a chance to prove it

**"Various reasons" is not a blank cheque (clarified in v1.2 — D-016).** A NSFAS decline has a
*reason*, and the reason decides eligibility — because **FundsLink does not oppose NSFAS** (§1.7).
We read the reason off the NSFAS outcome letter Category C already requires (a bounded
`nsfas_decline_reason`, never a free-text "various"):

| NSFAS decline reason | FundsLink stance |
|----------------------|------------------|
| `MEANS_INCOME` — household assessed **above** the funding line | **Not eligible.** Funding here would undo NSFAS's own means decision. Decline with a kind missing-middle / NSFAS redirect. |
| `DOCUMENTATION` / `ADMINISTRATIVE` — paperwork, timelines, capture errors | **Genuine crack → eligible.** This is precisely the gap FundsLink exists to catch. |
| `ACADEMIC_NPLUS` — N+ rule / progression | Reviewer may re-classify toward Category A. |

The Pre-Screening Engine only **annotates** the reason for the reviewer (§5.7); a **human** confirms
it against the letter and decides. The income gate is enforced *at human review*, never by machine.

**The FundsLink Solution (for the eligible reasons above):**
- FundsLink funds student for ONE YEAR
- Student proves academic ability
- After one year of good performance → Recommended to NSFAS

## 5.5 The NSFAS Recommendation Loop

```
YEAR 1: FundsLink funds student
↓
Student improves academic performance
↓
FundsLink prepares recommendation package:
• Academic transcript (improvement shown)
• Financial need documentation
• NSFAS application (pre-filled)
• FundsLink recommendation letter
↓
Student applies to NSFAS
↓
NSFAS decides (FundsLink recommends; NSFAS approval is NSFAS's decision — this Master edition wording)
↓
FundsLink moves to next student
```

*(this Master edition edge case added: if NSFAS declines the recommended student, FundsLink may grant ONE extension year per student, subject to two-step approval and pool capacity — see §16.4. After that, the student exits to the external bursary matching pathway. This closes the "what if NSFAS says no" gap that v3.0 left open.)*

---

## 5.6 Category D — Other Reasons (NEW in v1.1)

Real life does not fit four boxes. A student whose situation falls outside POSTGRAD and Categories A–C may apply under **OTHER REASONS**:

1. The student selects "My situation is different" and completes a **structured motivation**: (a) my situation, (b) why the existing categories don't fit me, (c) what support I need, (d) supporting documents.
2. The Pre-Screening Engine (§5.7) performs **completeness checks only** — an undefined situation cannot be rule-checked, and must never be machine-judged.
3. The application routes to a **senior human review queue**. The reviewer may: accept under an existing category (re-classification), accept as OTHER with case-specific terms, request more information, or decline — always with a human-written, caring explanation.
4. Every OTHER decision records a **theme tag** assigned by the reviewer. Quarterly, theme clusters are reported to the Founder: recurring themes become candidate NEW official categories (the system learns new compassion through humans, never around them).
5. All OTHER motivations and outcomes live in the dedicated Other-Reasons store in the database, auditable and pattern-minable.

> *"If your story doesn't fit our forms, our forms are incomplete — not your story. Tell us. A human will read every word."*

## 5.7 The Smart Pre-Screening Engine (NEW in v1.1)

**What it is:** a deterministic, config-driven requirements checker that runs the moment a student submits. **What it is not:** a decision-maker.

| Power the engine HAS | Power the engine NEVER has |
|----------------------|----------------------------|
| Verify the small necessary requirements per category (acceptance letter present for POSTGRAD; NSFAS pause evidence for Cat A; debt statement for Cat B; NSFAS outcome for Cat C; completeness for OTHER) | Approve an application |
| Return an application for missing/expired items with an **itemized, kind fix-list** (a return is NEVER a rejection) | Reject an application |
| Annotate discrepancies for the human reviewer (e.g., transcript year ≠ stated year — could be OCR, never auto-fail) | Judge motivation quality, language, writing style, or emotional content |
| Produce a Pre-Screen Report attached to the review queue item | See counselling data (§6.4 stands absolutely) |

**Engine rules are configuration, not code** (requirements per category live in versioned config with effective dates — when requirements change, history is preserved). AI assists only with document **data extraction**; every extraction is shown to the human with its source. If the engine is degraded or down, applications flow to humans flagged UNSCREENED — students are never blocked by our machinery.

**The flow:**
```
SUBMITTED → PRE_SCREENING →
  ├─ READY_FOR_REVIEW (all checks pass → human queue with report)
  ├─ RETURNED_FOR_INFO (itemized fix-list → student fixes → RESUBMITTED → PRE_SCREENING)
  └─ UNSCREENED (engine down → straight to human queue, flagged)
```
After three return cycles, FundsLink reaches out by phone/email to help directly — we never let a student loop forever against a form.

## 5.8 The Human-Final Principle (NEW in v1.1 — Absolute)

> **"No system, no AI, no automation may ever accept or reject a student. A machine has no feelings to feel and no life to have lived. Machines check requirements; humans decide about humans."**

Enforced mechanically: the APPROVED and REJECTED transitions are **impossible for the SYSTEM principal** — the platform refuses them unless performed by an identified human (and approval additionally requires two humans per §16.4). Every rejection is delivered with a human-written or human-approved message that includes concrete alternatives: external bursary matching, reapplication guidance, and redirection support where relevant. A rejection must never cite language proficiency, writing quality, or communication style (§14.3 stands).

# 6. COURSE REDIRECTION & EXCLUSION SUPPORT

## 6.1 What It Is

A structured pathway for students who experienced academic difficulty, providing career redirection, counselling, and therapy support.

## 6.2 The Complete Redirection Workflow

```
STUDENT EXPERIENCED ACADEMIC DIFFICULTY (NSFAS paused funding)
↓
Applies to FundsLink Academy
↓
FundsLink conducts interview (no judgment, just understanding)
↓
ROOT CAUSE ANALYSIS:
• Academic mismatch (wrong course)
• Personal issues
• Social circumstances
• Emotional/mental health
↓
IF WRONG COURSE:
├── Career aptitude testing
├── Counselling sessions
├── New course recommendation
├── Alternative institution (TVET)
└── Funding for new path (1 year)
↓
IF PERSONAL/SOCIAL/EMOTIONAL:
├── Professional counselling (by qualified professionals — see §6.4)
├── Peer support groups
├── Family mediation if needed
└── Continued academic monitoring
↓
ONE YEAR FUNDING IN NEW/RECOMMENDED PATH
↓
Academic monitoring (monthly check-ins)
↓
Student improves performance
↓
Recommended back to NSFAS
```

## 6.3 The Redirection Promise to Students

> *"You did not fail. The course may not have been the right fit for you. Let us help you find where you belong. We will fund one year. You give us your best. Then NSFAS will take over. This is your second chance. Make it count."*

## 6.4 Data Protection for Redirection Cases (NEW)

Root cause analysis and counselling generate **special personal information** under POPIA (health and emotional wellbeing data). Therefore:

1. Counselling and therapy records live in a **segregated data store**, separate from the main application database.
2. Only users holding the **Counsellor role** may access these records. General administrators, interviewers, funding approvers, and the matching AI **never** see them.
3. Counselling content is **never used as input to AI matching or funding decisions**. Funding decisions reference only the structured outcome (e.g., "redirection recommended: yes/no, new course: X").
4. Counselling is delivered by qualified professionals; FundsLink platform staff facilitate scheduling only.
5. Records follow the retention policy in §15.5.

---

# 7. MONTHLY ALLOWANCE SYSTEM

## 7.1 The Core Rule (Absolute)

> **"No monthly allowance is ever paid directly to any student. Every allowance is paid in bulk to the institution. The institution then distributes allowances to students on their own scheduled dates."**

This rule applies to ALL funded students without exception.

## 7.2 How the Allowance Distribution Works

```
STEP 1: FundsLink calculates monthly allowance pool
        • Number of funded students at each institution
        • R1,000 per student
        • Total = Students × R1,000
        • A per-student AllowanceAllocation record is created for
          EVERY student in EVERY batch (this Master edition — sub-ledger rule §16.3)
↓
STEP 2: FundsLink pays TOTAL AMOUNT to each institution
        • Payment made on the 25th of each month
        • Two-step approval required before release (§16.4)
        • Paid directly to institution's designated, verified account
        • Reference: "FundsLink Academy - Monthly Allowances [Month Year]"
↓
STEP 3: Institution receives bulk payment
        • Institution's financial aid office is notified
        • Institution verifies student enrolment status
↓
STEP 4: Institution distributes to students
        • ON THEIR OWN SCHEDULED DATES
        • Using their existing allowance distribution system
        • Same process as NSFAS allowances
↓
STEP 5: Student receives allowance
        • On the institution's normal allowance payment day
        • Same amount: R1,000
        • Same method as other bursary students
↓
STEP 6: Institution confirms distribution (v4.0)
        • Per-student confirmation against the AllowanceAllocation list
        • Deadline: 15th of the following month
        • Variances trigger the returns workflow (§7.8)
```

## 7.3 Standard Allowance Amount

**Amount:** **R1,000 per month**
**Applies to:** ALL funded students unless otherwise specified
**Duration:** Until further notice (subject to review based on donation pool growth)

## 7.4 Allowance Distribution by Institution Type

| Institution Type | How Allowance is Distributed |
|------------------|------------------------------|
| University | Through financial aid office, added to student's existing allowance schedule |
| TVET College | Through student support services, on college's normal distribution dates |
| Private Institution | Through bursary office, following their internal process |

## 7.5 Payment Schedule (FundsLink to Institutions)

| Payment Date | For Month | Notes |
|--------------|-----------|-------|
| 25th of each month | Following month | Allows institution time to process. The 25th is a named Critical Operational Window (§19.4) |

## 7.6 Monthly Allowance Pool Calculation

```
Example:
Funded students at University A: 50
Funded students at TVET B: 30
Funded students at University C: 20
Total funded students: 100

Total monthly allowance pool = 100 × R1,000 = R100,000

Distribution:
- University A: 50 × R1,000 = R50,000  (50 AllowanceAllocation records)
- TVET B: 30 × R1,000 = R30,000        (30 AllowanceAllocation records)
- University C: 20 × R1,000 = R20,000  (20 AllowanceAllocation records)
```

## 7.7 Institution Reporting Requirements

Institutions must provide monthly confirmation through the Institution Portal (v2):
- Per-student confirmation of allowances received (against the AllowanceAllocation list)
- Any students who were ineligible (withdrawn, suspended, graduated)
- Unused funds returned to FundsLink

**Reporting Deadline:** 15th of the following month.
**Escalation (v4.0):** missing report at +7 days → automated reminder + account manager contact; at +21 days → next month's disbursement to that institution is paused pending reconciliation; at +45 days → partnership review. Money never moves into an unreconciled black hole.

## 7.8 Unused Allowance Funds & Mid-Month Ineligibility (this Master edition — Edge Cases Closed)

| Scenario | Rule |
|----------|------|
| Student becomes ineligible BEFORE the 25th payment run | Allocation excluded from the batch automatically |
| Student becomes ineligible AFTER payment but BEFORE institution distribution | Institution flags it in the portal; full R1,000 returned; allocation marked RETURNED |
| Student becomes ineligible AFTER distribution | That month stands (student received it legitimately); funding ends from the next cycle |
| Institution fails to return confirmed unused funds | Outstanding balance deducted from the next month's bulk payment; ledger reversing entry recorded |
| Institution overpaid due to FundsLink error | Correction by reversing ledger entry + deduction from next batch — original entries are never edited (§16.2) |

Returned funds go back into the donation pool and are visible in the public transparency report.

## 7.9 The Trust Layer (Why This Matters)

| Who Benefits | How |
|--------------|-----|
| **Donors** | Every rand is accounted for through institutional oversight AND a per-student sub-ledger |
| **Students** | Allowance arrives through trusted, familiar channels |
| **Institutions** | Full control over distribution process |
| **FundsLink** | Complete audit trail, no cash handling risk |

## 7.10 The Statement to Students

> *"Your monthly allowance of R1,000 will be paid to your institution. They will distribute it to you on their normal allowance payment dates. This is the same process used by NSFAS and other major bursaries. You will receive your allowance through the same channel you already know and trust."*

## 7.11 The Statement to Institutions

> *"FundsLink will pay you a bulk amount each month covering allowances for all funded students at your institution. You will distribute these allowances to students using your existing systems and schedules. You will confirm distribution per student in the FundsLink Institution Portal, and any unused funds must be returned. This process mirrors the NSFAS model and requires no new infrastructure on your part."*

## 7.12 Allowance Increase Policy

The R1,000 allowance will be reviewed quarterly based on:
- Total donation pool size
- Number of funded students
- Cost of living data
- Feedback from partner institutions

**Any increase must be announced 30 days in advance.**

---

# 8. DONATION COLLECTION ECOSYSTEM (REWRITTEN)

## 8.1 The "Always Collecting" Philosophy

FundsLink never stops collecting. 24/7. Online. Any amount from **R5** upward — and 50c at a time through the batched Round-Up Program (§9).

**Minimum online donation:** **R5**
**Maximum donation:** Unlimited

### 8.1.1 Why R5 (Honest Economics — Founder Decision D2)

South African payment gateways charge fixed plus percentage fees (typically R2–R3+ per card transaction). The Founder has set the minimum at R5 to keep the barrier to giving as low as possible. The specification records the consequence honestly:

| Rail | R5 donation → net to pool (approx.) |
|------|--------------------------------------|
| Card | ~R2.00–R3.00 (40–60% consumed by fees) |
| EFT (Ozow-type) | ~R3.50–R4.50 |
| Batched round-up debit order | ~95%+ (many 50c's, one fee) |

**Rules that follow:**
1. **Fee transparency rule:** the donation page shows estimated net amount per rail; small donors are gently steered to EFT or the Round-Up Program ("Want your R5 to go further? Choose EFT — more of your gift reaches a student.").
2. The public transparency report (§16.6) discloses total gateway fees paid.
3. Quarterly review: if fee drag on sub-R10 card donations exceeds 50% of their gross, the Founder reviews the minimum (L4 decision).

## 8.2 Donation Channels (Phased per Release Map)

| Channel | Method | Phase |
|---------|--------|-------|
| Card | One-off or recurring | ✅ v1.5 |
| EFT (instant EFT) | One-off or debit order | ✅ v1.5 |
| Round-Up (batched) | Monthly debit order of accumulated round-ups | v3 (§9) |
| SnapScan / QR | Scan QR code | v4 |
| Airtime | Convert airtime to cash via aggregator | v4 |
| WhatsApp | Payment link | v4 |
| Payroll | Employee deduction | v4 |
| ATM / Retail POS | Transaction round-up at source | Vision (National Campaign) |

**v1.5 rule: ONE payment gateway.** One integration, one settlement report, one reconciliation. Additional channels are added only after the daily reconciliation job (§16.5) has run clean for 60 consecutive days.

## 8.3 Donation Amount Options

**Preset amounts for quick giving:** R5, R10, R20, R50, R100, R200, R500, Custom
**Recurring options:** Monthly, Quarterly, Annually

## 8.4 Donation Integrity Rules (NEW)

1. Every donation creates an immutable ledger entry (§16.2) before any thank-you is shown.
2. Gateway webhooks are idempotent: the gateway transaction ID is a unique key; replays and retries can never double-record a donation.
3. Section 18A receipts are generated automatically for qualifying donations with donor tax details on file, numbered sequentially, and stored permanently (PBO legal requirement).
4. Recurring mandates have an explicit state machine: ACTIVE → PAUSED → CANCELLED → FAILED_RETRY (max 3 retries, then dunning email, then auto-pause). Donors can cancel in one click — no dark patterns, ever.
5. Refund requests follow the reversing-entry rule (§16.2) and are reported in the transparency report.

## 8.5 Donor Recognition Tiers

| Tier | Amount (cumulative) | Recognition |
|------|---------------------|-------------|
| Ubuntu Friend | Any amount | Name on rolling donor wall (opt-in — POPIA consent required) |
| Bronze Benefactor | R500+ | Certificate + student thank you video |
| Silver Supporter | R5,000+ | Named on website + annual report |
| Gold Guardian | R50,000+ | Named scholarship + press mention |
| Platinum Patron | R500,000+ | Board observer seat (non-voting, no access to student personal data) |
| President's Circle | R1,000,000+ | Named funding programme |

*(this Master edition clarification: observer seats are non-voting and carry no influence over funding decisions — protects the Independence Clause from donor capture.)*

---

# 9. THE ROUND-UP PROGRAM (REWRITTEN — BUILDABLE)

## 9.1 Core Principle: Voluntary, Not Forced

**The Round-Up Program is NOT automatic. It is a CHOICE.** Every participant opts in, and can opt out in one click.

## 9.2 How It Actually Works (v3 — App-Side, Batched)

```
STEP 1: Supporter opts in on FundsLink
        Two modes:
        • SIMPLE PLEDGE: "Donate my estimated round-ups"
          → supporter picks R20 / R50 / R100 per month
            (marketed as ±40 / ±100 / ±200 round-ups)
        • LINKED MODE (where supported): supporter links their bank
          account via a licensed account-aggregation provider
          → FundsLink READS transactions (never touches them)
          → computes actual round-ups to the next rand
          → 50c minimum per qualifying transaction
↓
STEP 2: Round-ups ACCUMULATE during the month (displayed live:
        "Your 50c's this month: R43.50")
↓
STEP 3: ONE debit order on the 1st collects the accumulated total
        → one gateway fee for the whole month
        → 95%+ of every 50c reaches the pool
↓
STEP 4: Supporter gets a monthly impact note:
        "Your 87 round-ups became R43.50. Together with 2,000
         others, that funded 3 students' allowances this month."
```

## 9.3 The 50c Minimum Rule (Preserved)

| Transaction Amount | Rounded To | Donation |
|-------------------|------------|----------|
| R10.10 | R11.00 | 90c |
| R25.50 | R26.00 | 50c |
| R99.99 | R100.00 | 50c (natural 1c is below minimum → 50c applies) |
| R187.50 | R188.00 | 50c |

**If the natural round-up is less than 50c, the round-up is 50c.** Monthly cap: supporter sets a maximum (default R200/month) — the program can never surprise anyone's budget.

## 9.4 Why Batching (The Honest Engineering Note)

Charging 50c per transaction through a payment gateway would lose more to fees than the donation itself. Batching preserves the *spirit* of "50c at a time" while making every 50c actually arrive. The supporter still gives 50c per transaction — FundsLink just collects them efficiently.

## 9.5 The National Round-Up Campaign (VISION — Advocacy, Not Architecture)

The long-term proposal to government, banks, and retailers remains:

> *"If on every withdrawal and every payment made in South Africa, we get a voluntary 50c-R1 round-up question, we could fund every unfunded student in the country."*

| Stakeholder | Ask |
|-------------|-----|
| Government | Endorse the voluntary 50/50 question on financial transactions |
| Banks | Integrate round-up into digital banking apps and ATMs |
| Retailers | Display the question at POS terminals |

**this Master edition status:** this campaign lives in the Vision phase of the Release Map. It requires bank-side integration and policy agreements that do not currently exist. No FundsLink release may promise it as a feature until a signed pilot agreement exists. The campaign brand is preserved:

**Campaign Name:** *"50c for a Future"*

> *"Every time you swipe your card, withdraw cash, or pay for anything... you have a choice. 50 cents. That's all. It won't change your life. But it will change someone else's. No one is forced. But everyone is asked. Say yes to 50c."*

---

# 10. CORPORATE & GOVERNMENT PARTNERSHIPS

## 10.1 The Tax Advantage for Companies

Companies can donate millions to FundsLink and receive:
- Section 18A tax deduction
- CSI (Corporate Social Investment) credit
- Positive PR and brand association

## 10.2 Corporate Donation Tiers

| Tier | Donation Amount | Benefits |
|------|-----------------|----------|
| Bronze | R50,000 – R99,999 | Logo on website, tax receipt, CSR report mention |
| Silver | R100,000 – R499,999 | + Named scholarship, press release |
| Gold | R500,000 – R999,999 | + Board observer seat (non-voting), employee matching |
| Platinum | R1,000,000+ | + Named funding programme |

## 10.3 Government Partnerships (Not Ownership)

| Partner | Role |
|---------|------|
| NSFAS | Receive referred students; receive recommended students after 1 year |
| DHET | Policy alignment; data sharing (subject to POPIA — §15) |
| SETAs | Access to unclaimed discretionary grants |
| SARS | Tax deduction processing for donors |

**The Independence Clause:**

> *"FundsLink Academy shall never be owned or controlled by any government entity. We partner WITH government to help them. We are not PART OF government."*

---

# 11. THE PAY-IT-FORWARD PLEDGE

## 11.1 How It Works

**For Graduates Funded by FundsLink:**

1. Graduate completes degree
2. Gets a **permanent job**
3. Sets up monthly pledge: **R100 minimum** (their choice to give more)
4. Pledge lasts **24 months** (2 years)
5. After 24 months, they can choose to continue or stop
6. Money goes back into the pool to fund next student

**Important:** Pledge only starts AFTER permanent employment is confirmed. **The pledge is moral, not legal — it is never debt, never enforced, never reported, and never affects anyone's credit record (this Master edition explicit).**

## 11.2 The Pledge Workflow

```
STUDENT GRADUATES
↓
Graduate updates profile: "I have a permanent job"
↓
Admin verifies employment (payslip or employment letter — stored per §15)
↓
Pledge becomes active (mandate state machine — same engine as §8.4)
↓
Monthly debit order of R100+ begins
↓
Failed debit → 2 retries → friendly pause (never dunning pressure; this is Ubuntu, not collections)
↓
Graduate receives quarterly impact report
↓
After 24 months: Choice to continue or stop
```

## 11.3 The Message to Graduates

> *"You were funded when you needed it most. Now someone needs you. Pay what you can, for 2 years. R100? Thank you. R1,000? Incredible. Nothing right now? We understand. This is not debt. This is Ubuntu in action."*

---

# 12. THE APPLICATION ORGANIZATION & TRACKING SYSTEM (REWRITTEN)

## 12.1 The Problem This Solves

| Problem | Description |
|---------|-------------|
| Too many websites | Apply to 5, 10, or 20 different bursaries, each with its own login |
| Daily checking | Must log into each website every day to see if status changed |
| No status visibility | Some bursaries don't clearly show application status at all |
| No replies | Some bursaries never send an outcome, leaving students waiting forever |
| Forgotten applications | Students forget which bursaries they applied to |
| Missed deadlines | Students forget to check and miss important updates |
| Spam folders | Outcome emails go to spam and are never seen |

## 12.2 The FundsLink Solution (Keepable Promise)

> *"One profile. One dashboard. Every application you're tracking, organized in one place — with reminders, follow-ups, and a record nothing falls out of."*

## 12.3 How It Works (this Master edition — Phased Honestly)

```
STEP 1: Student fills ONE FundsLink profile
↓
STEP 2: AI matches student to relevant bursaries from the
        FundsLink Bursary Database (curated, with deadlines
        and requirements maintained by FundsLink)
↓
STEP 3: Student receives matched list + can browse ALL bursaries
        (matching is advisory — §17)
↓
STEP 4: Student selects bursaries and is directed to each
        bursary's OWN website to apply
↓
STEP 5: Student REGISTERS each application on their dashboard
        (one tap: "I applied to X on [date]")
↓
STEP 6: STATUS CAPTURE — three channels, by phase:
        a) SELF-REPORT (v1): student updates status in one tap;
           smart nudges ask "Heard back from X yet?"
        b) EMAIL CAPTURE (v3): student opts in to forward outcome
           emails to track@fundslink — system parses and updates
        c) PARTNER API (v4): integrated bursaries push live
           statuses automatically
↓
STEP 7: Every status change triggers notification (per §18 policy)
↓
STEP 8: Student sees ALL statuses in ONE dashboard
↓
STEP 9: FundsLink follows up on non-responding bursaries
        on the student's behalf (30/45/60-day workflow)
```

## 12.4 What the Student Sees (Dashboard View)

All registered applications appear in one dashboard with:
- Current status (Submitted, Under Review, Shortlisted, Interview, Approved, Rejected, No Response) — an explicit state machine; illegal transitions are impossible
- Status source label (Self-reported / Email / Partner — transparency about freshness)
- Last updated timestamp
- Deadline reminders (from the FundsLink Bursary Database)
- Notification history (SMS, Email, In-app)

## 12.5 The "No Response" Problem Solved

| Day | Action |
|-----|--------|
| 30 | Automated follow-up sent to bursary |
| 45 | Second follow-up sent |
| 60 | Flagged as "No Response" – student can withdraw |

## 12.6 The Student Promise (this Master edition — Honest Version)

> *"You will never have to keep 20 applications in your head again. Register every application here. We organize them, remind you of every deadline, nudge you to check, chase bursaries that go quiet, and capture every outcome you forward to us. One dashboard. One login. Nothing falls through the cracks you can see — and as bursaries connect to FundsLink, more and more updates arrive automatically."*

*(The v3.0 promise "you will never miss an outcome again" is retired: FundsLink cannot guarantee knowledge of outcomes communicated only on third-party systems. We promise organization, reminders, and follow-up — and we deliver automation as partners integrate.)*

---

# 13. STUDENT JOURNEY (END-TO-END)

```
┌─────────────────────────────────────────────────────────────┐
│ PHASE 1: DISCOVERY & APPLICATION                            │
├─────────────────────────────────────────────────────────────┤
│ 1. Student hears about FundsLink                            │
│ 2. Visits website, reads about funding                      │
│ 3. Clicks "Apply for Funding"                               │
│ 4. Creates account (consent recorded — §15.4)               │
│ 5. Completes multi-step application form                    │
│ 6. OPTIONAL: Consents to external bursary matching          │
│ 7. Submits application                                      │
│ 8. Receives confirmation email                              │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ PHASE 2: VERIFICATION & INTERVIEW                           │
├─────────────────────────────────────────────────────────────┤
│ 9. Identity & duplicate checks run automatically (§14.4)    │
│ 10. Admin reviews application                               │
│ 11. Admin verifies documents                                │
│ 12. Interview conducted (no judgment)                       │
│ 13. If excluded: Root cause analysis begins (data per §6.4) │
│ 14. Funding approval = TWO-STEP (proposer + authorizer)     │
│ 15. Student notified                                        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ PHASE 3: FUNDING BEGINS                                     │
├─────────────────────────────────────────────────────────────┤
│ 16. Tuition paid directly to institution                    │
│ 17. Allowance pool paid to institution (bulk + sub-ledger)  │
│ 18. Institution distributes allowance to student            │
│ 19. If redirected: New course enrolment verified            │
│ 20. Monthly check-ins begin                                 │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ PHASE 4: CONTINUOUS FUNDING                                 │
├─────────────────────────────────────────────────────────────┤
│ 21. Postgraduate: Maintain 65% average                      │
│ 22. Undergraduate: One year only                            │
│ 23. Monthly allowance continues via institution             │
│ 24. Academic monitoring                                     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ PHASE 5: COMPLETION OR RECOMMENDATION                       │
├─────────────────────────────────────────────────────────────┤
│ FOR POSTGRADUATE:                                           │
│ 25. Student completes degree                                │
│ 26. Celebration                                             │
│ 27. Graduate sets up pay-forward pledge after employment    │
│                                                             │
│ FOR UNDERGRADUATE:                                          │
│ 25. After one year of good performance                      │
│ 26. FundsLink prepares NSFAS recommendation package         │
│ 27. Student applies to NSFAS                                │
│ 28. NSFAS decides; if declined → §5.5 extension rule        │
│ 29. FundsLink moves to next student                         │
└─────────────────────────────────────────────────────────────┘
```

---

# 14. VERIFICATION, TRUST & ANTI-FRAUD LAYER (EXPANDED)

## 14.1 The Core Trust Rule (Absolute)

> **"No money ever goes directly to any student. Every single rand – tuition, debt payments, monthly allowances, textbooks, accommodation – is paid to the institution or to an Accredited Payment Partner."**

| Money Type | Paid To |
|------------|---------|
| Tuition fees | Institution |
| Outstanding debt | Institution |
| Monthly allowances | Institution (bulk + sub-ledger; institution distributes) |
| Textbook allowances | Institution or Accredited Payment Partner (bookstore) |
| Accommodation | Institution or Accredited Payment Partner (registered student housing provider) |

## 14.2 Verification Levels

| Level | What It Means | Who Verifies |
|-------|---------------|--------------|
| **Bronze** | Self-registered, documents uploaded | Student |
| **Silver** | Documents verified + identity & duplicate checks passed | System + Admin |
| **Gold** | Interview completed, need assessed, enrolment confirmed by registrar | Admin |
| **Platinum** | Approved for funding (two-step approval) | Proposer + Authorizer |

**Only Platinum students receive funding.**

## 14.3 The Interview (No Judgment)

Every funded student goes through an interview to verify their story.

**We do NOT judge:** communication level, English proficiency, background, accent, education level of family.

**We DO assess:** severity of situation, validity of documentation, genuine need, academic potential.

**The Interviewer's Mantra:**

> *"This is not a competition. We are not looking for the 'best' candidate. We are looking for students in genuine need. Everyone who qualifies gets funded."*

## 14.4 Anti-Fraud Controls (NEW)

| Control | Rule |
|---------|------|
| Identity uniqueness | One SA ID number = one student account, enforced at database level. Duplicates auto-flagged. |
| Document integrity | Uploaded documents checked for tampering indicators; transcripts verified against institution where possible |
| Enrolment verification | Gold level requires registrar confirmation (proof of registration letter with reference check, or institution portal confirmation) |
| Bank account verification | Institution and Partner accounts verified via official letterhead + account verification service before first payment; changes to a payout account require re-verification and two-step approval |
| Insider risk | No single staff member can both propose and authorize a disbursement (§16.4); every admin action is audit-logged |
| Collusion detection | Statistical review of approvals per admin per period; anomalies reviewed by the Founder/board |

## 14.5 Accredited Payment Partners Registry (NEW — Resolves v3.0 Contradiction)

A vetted registry of non-institution entities FundsLink may pay on a student's behalf:

| Requirement | Detail |
|-------------|--------|
| Eligible entities | Registered student housing providers, accredited bookstores, institution-endorsed service providers |
| Vetting | Company registration, tax clearance, bank verification, institution endorsement where applicable |
| Review | Annual re-accreditation; removal on any compliance failure |
| Payment rule | Invoiced amounts only, tied to a named funded student, two-step approved, ledgered like all money |

Individuals (private landlords without registration) are **not eligible**. Where a student's accommodation provider cannot qualify, the accommodation allowance routes through the institution.

## 14.6 Application Edge-Case Register (NEW in v1.1)

| # | Edge case | Rule |
|---|-----------|------|
| E1 | Duplicate applications | One ACTIVE application per student per academic year (enforced at DB level); new drafts blocked while one is in flight |
| E2 | Reapplication after rejection | Allowed next intake cycle, or immediately upon material change in circumstances (declared); attempt number tracked; prior history visible to reviewer |
| E3 | Appeal | One appeal per decision, with new information; reviewed by a DIFFERENT human than the original decision-maker; appeal outcome is final for that cycle |
| E4 | Pool capacity exceeded | Approval-worthy students beyond pool capacity enter APPROVED_WAITLISTED (transparent position, postgraduate priority per §3, need-severity ordering) — never silently rejected; auto-promoted as funds arrive |
| E5 | Circumstances change mid-review | Student may update + RESUBMIT at any pre-decision state; review clock restarts |
| E6 | Conflicting evidence | Extracted data contradicting stated data is FLAGGED for the human, never auto-failed (OCR errors exist; fraud is a human determination per §14.4) |
| E7 | Stale documents | Evidence older than its configured validity window (e.g., acceptance letters) triggers a re-request via RETURNED_FOR_INFO, not rejection |
| E8 | Reviewer conflict of interest | Reviewers must recuse from applicants personally known to them; recusal is logged; case reassigned |
| E9 | Minor applicants (<18 entering university) | Guardian consent recorded per POPIA before processing |
| E10 | Deceased or incapacitated applicant | Compassionate closure workflow; data handled per §15.5; family communication human-only |
| E11 | Language | Motivations accepted in any South African official language; translation assistance arranged; language NEVER affects pre-screen or decision (§14.3) |
| E12 | Reviewer overload | Review SLA (config: 14 days) with escalation; queue-time honestly published to applicants |
| E13 | Withdrawal | Student may withdraw at any pre-decision state without prejudice to future applications |
| E14 | Engine outage | Applications flow UNSCREENED to humans (S8.51 pattern) — machinery never blocks a student |

---

# 15. POPIA & DATA PROTECTION (NEW)

## 15.1 Commitment

FundsLink collects deeply sensitive information from people at their most vulnerable. Data protection is therefore a product feature, not a compliance checkbox. FundsLink complies with the Protection of Personal Information Act (POPIA) in full.

## 15.2 Information Officer

The Founder, **Maluleke Kurhula Success**, is the registered Information Officer until the board appoints a dedicated officer.

## 15.3 Data Classification

| Class | Examples | Handling |
|-------|----------|----------|
| Public | Bursary database, donor wall (opt-in names) | Open |
| Internal | Aggregated metrics, operational reports | Staff access |
| Personal | Names, contact details, academic records, application content | Role-gated, encrypted in transit and at rest |
| Personal–Financial | Donor payment details, pledge mandates | Tokenized at the gateway — FundsLink never stores card numbers |
| **Special Personal** | SA ID numbers; counselling/therapy and mental-health data; financial hardship narratives | ID numbers field-level encrypted; counselling data segregated per §6.4; never used in AI matching; strictest role gating |

## 15.4 Consent Architecture

- Consent is a **first-class record**: what was consented to, version of the wording, timestamp, channel.
- Separate consents for: platform processing, external bursary matching, email capture (§12.3b), bank account linking (§9.2), donor wall display, marketing communications.
- Any consent can be withdrawn in the app; withdrawal is honored immediately and logged.

## 15.5 Retention & Deletion

| Data | Retention |
|------|-----------|
| Rejected/abandoned applications | Purged 12 months after final decision |
| Funded student records | Duration of funding + 5 years (audit requirement) |
| Financial ledger & Section 18A receipts | Permanent (legal requirement) |
| Counselling records | Per professional standards of the treating counsellor's body; segregated store |
| Deleted accounts | Personal data erased within 30 days, except where law requires retention (ledger entries are pseudonymized, never deleted) |

## 15.6 Subject Rights

Students and donors can view, export, correct, and request deletion of their personal data from within the platform. Requests are fulfilled within statutory timelines.

## 15.7 Breach Protocol

Suspected breach → SEV0 runbook → Information Regulator and affected persons notified as required by POPIA → public post-mortem in the transparency report.

---

# 16. FINANCIAL CONTROLS & MONEY GOVERNANCE (NEW)

## 16.1 The Principle

> *"If a rand moved and the ledger doesn't show it, the system is broken. If one person alone can move a rand, the system is broken."*

## 16.2 The Immutable Ledger

1. Every money movement — donation in, fee, disbursement out, return, refund — is a **double-entry ledger record**.
2. Ledger entries are **append-only**: never edited, never deleted. Corrections are reversing entries that reference the original.
3. All monetary values use exact decimal arithmetic — never floating point. (Per C5: financial data in PostgreSQL only, Decimal type, parameterised queries.)
4. *Constitutional note: an amendment to C5 is proposed — "Ledger tables are immutable; corrections are reversing entries" — pending Founder approval per C0 §8.*

## 16.3 The Per-Student Sub-Ledger

Every bulk payment to an institution decomposes into per-student **AllowanceAllocation** records (or per-student tuition/debt records). The sum of allocations always equals the bulk payment. Institution confirmations, returns, and ineligibility events resolve at the allocation level. This is what makes "100% audit trail" true instead of aspirational.

## 16.4 Two-Step Approval (No Exceptions)

| Action | Proposer | Authorizer |
|--------|----------|------------|
| Approve student for funding (Platinum) | Reviewing admin | Second admin or Founder |
| Release monthly disbursement batch | Finance admin | Second authorizer |
| One-time debt payment (Category B) | Reviewing admin | Second authorizer |
| §5.5 extension year | Case admin | Founder |
| Change to any payout bank account | Admin | Founder |

The proposer and authorizer can never be the same person. **This binds the Founder too.** Every approval is audit-logged with both identities.

## 16.5 Daily Reconciliation

A daily automated job compares the payment gateway settlement report against the ledger. Any variance — even 1 cent — raises an alert and freezes new disbursements until resolved (per the financial-freeze runbook). New payment channels unlock only after 60 clean days (§8.2).

## 16.6 Public Transparency Report

Published quarterly: total donations, gateway fees paid, total disbursed by category, returns from institutions, operating costs, and pool balance. Donors deserve to see the whole picture, including the fees.

---

# 17. AI MATCHING GOVERNANCE (NEW)

## 17.1 The Principle

The AI matcher influences which funding opportunities a student in need sees. That is a consequential decision and is governed accordingly.

## 17.2 Rules

1. **Advisory only.** Matching recommends; it never filters. A "Browse all bursaries" path is always available and equally prominent.
2. **Auditable.** Every match is persisted with the reasoning, source documents referenced, and a confidence indicator. A student (or admin) can always see *why* something was matched.
3. **Human-confirmed.** No FundsLink funding decision is ever made by the matcher. Humans decide; two humans approve (§16.4).
4. **No special personal information.** Counselling/therapy data is never an input (§6.4). Matching uses academic, programme, and eligibility data only.
5. **Freshness.** Bursary records carry deadlines; expired bursaries are excluded from matching automatically. Stale embeddings are re-indexed on every bursary database update.
6. **Degradation.** If the AI pipeline is down or degraded, the platform falls back to rule-based filtering + manual browse — students are never blocked by an AI outage. (Aligned with the AI degradation runbook.)
7. **Fairness review.** Quarterly sample audit: are matches skewing by institution, province, language, or field of study in ways the eligibility rules don't justify? Findings go to the board.

---

# 18. NOTIFICATION POLICY (UPDATED)

## 18.1 Channel Policy (Costed)

SMS costs real money from the donation pool (~25–35c per message). Policy:

| Trigger | SMS | Email | In-App |
|---------|-----|-------|--------|
| Funding decision (approved/declined) | ✅ | ✅ | ✅ |
| External application outcome captured | ✅ | ✅ | ✅ |
| Deadline approaching (3 days) | ✅ | ✅ | ✅ |
| Status changes (non-outcome) | — | ✅ | ✅ |
| No response (30/45/60 days) | — | ✅ | ✅ |
| Reminders, nudges, digests | — | ✅ | ✅ |

**Rule: SMS is reserved for outcome-critical events.** Students can upgrade any trigger to SMS in preferences; the default protects the pool.

## 18.2 Delivery Integrity

Notifications are generated from the same transaction that changes a status (transactional outbox pattern) — a status can never change silently. Failed deliveries retry; persistent failures surface in the student's dashboard ("we couldn't reach you by email — please verify your address").

## 18.3 Consent

Each channel requires recorded consent (§15.4). Marketing and operational messages are consented separately. Opt-out never affects funding eligibility.

---

# 19. OPERATIONS & RELIABILITY (NEW)

## 19.1 Service Targets

| Surface | Target |
|---------|--------|
| Student platform availability | 99.5% monthly |
| Donation capture availability | 99.9% monthly (money in must not bounce) |
| Dashboard response | < 2s p95 |

## 19.2 Data Durability

| Data | RPO | RTO |
|------|-----|-----|
| Financial ledger | ≤ 5 minutes (point-in-time recovery) | ≤ 4 hours |
| Application/profile data | ≤ 1 hour | ≤ 8 hours |
| Counselling store | ≤ 1 hour | ≤ 24 hours |

Backups are tested by restore drill quarterly. An untested backup is not a backup.

## 19.3 Monitoring & Alerts (Minimum Set)

Failed payment webhooks; reconciliation variance; disbursement batch failure; Section 18A receipt generation failure; AI pipeline degradation; notification outbox backlog; abnormal login/approval patterns (fraud signal).

## 19.4 Critical Operational Window: The 25th

Monthly disbursement day is a named critical window: no deployments on the 24th–26th; finance admin + authorizer on standby; the disbursement runbook (to be added to `runbooks/`) governs failures. A failed batch is a SEV1; a partially-paid batch is a SEV0 (financial-freeze runbook applies).

## 19.5 Incident Discipline

SEV0/SEV1 runbooks from the constitutional system apply. Every financial incident produces a post-mortem; material incidents appear in the transparency report.

---

# 20. GOVERNANCE & INDEPENDENCE

## 20.1 Legal Structure

| Element | Status |
|---------|--------|
| Legal entity | Non-Profit Company (NPC) |
| Tax status | Public Benefit Organization (PBO) |
| Section 18A | Approved for donor tax deductions (receipting automated — §8.4) |

## 20.2 The Independence Clause (Locked)

> *"FundsLink Academy shall never be owned or controlled by any government entity. We partner WITH government to help them. We are not PART OF government. Our independence ensures we always put students first."*

**This clause is legally binding and cannot be changed without founder approval and a 75% vote of the board.**

## 20.3 Board Structure

| Seat | Appointed By |
|------|---------------|
| Founder | Maluleke Kurhula Success (permanent seat) |
| Student Representative | Elected by funded students annually |
| Donor Representative | Elected by major donors |
| Academic Representative | Nominated by partner universities |
| Independent Expert | Appointed by board |

*(Observer seats from donor tiers are non-voting and excluded from funding decisions and student data.)*

## 20.4 The Founder's Pledge (Locked)

> *"I, Maluleke Kurhula Success, founder of FundsLink Academy, do hereby pledge that:*
>
> *1. I will NEVER take a salary from student donations*
> *2. I will NEVER sell this platform to government or corporations*
> *3. I will ALWAYS remain independent*
> *4. I will ALWAYS put students before profit*
> *5. I will step down if ever I violate these principles*
>
> *This platform is not mine. It belongs to every student who needs funding, every donor who gives 50c, every graduate who pays forward, and every South African who believes in second chances."*

**this Master edition addition — the pledge now has teeth:** the two-step approval rule (§16.4) binds the Founder; no Founder-only path to money exists in the system.

---

# 21. THE FOUNDER'S LEGACY

## 21.1 The Founder's Story

**Maluleke Kurhula Success** – BSc Computer Science & Mathematics, NWU, Final Year (2026)

> *"In my final year at NWU, I watched friends drop out. Not because they failed. Because NSFAS documents 'didn't upload.' One of them is a brilliant coder now working at a garage.*
>
> *I couldn't fix NSFAS. But I could build something that catches who they miss.*
>
> *That's FundsLink."*

## 21.2 The Founder's Message (On Every Page)

> *"I built FundsLink Academy in my final year at NWU. Not because I had money. Not because I had time. I built it because I saw too many smart, deserving students lose their dreams to systems that failed them.*
>
> *I expect nothing back. But if you're a graduate and you can afford R100/month for 2 years... someone right now needs you.*
>
> *That's all. That's FundsLink.*
>
> *— Maluleke Kurhula Success"*

## 21.3 The Founder's Vision for 2030 (Aligned to Release Map)

| Year | Milestone |
|------|-----------|
| 2026 | v1 + v1.5 live: first students matched, donations flowing, first cohort funded |
| 2027 | v2/v2.5: 300–500 students funded, 5–10 university partners, disbursement engine proven |
| 2028 | v3: Round-Up Program live, 1,000 students funded, first partner API integrations |
| 2029 | v4: 5,000 students funded, payroll giving, pan-African expansion planning |
| 2030 | 10,000 students funded; pay-forward + round-up base makes the pool self-sustaining; National Round-Up Campaign pilot signed |

---

# 22. SUCCESS METRICS (REALITY-ALIGNED)

## 22.1 Year 1 Targets (v1 + v1.5 live)

| Metric | Target |
|--------|--------|
| Students funded | 100 |
| Postgraduate students | 60 |
| Undergraduate (NSFAS gaps) | 40 |
| Donations raised | R2 million+ |
| Monthly recurring donors | 500+ |
| Corporate partners | 10 |
| University partners | 5 |
| Graduate pledges registered | 20+ |
| Students redirected | 50 |
| Redirection success rate | 70%+ |

## 22.2 Trust & Compliance Metrics

| Metric | Target |
|--------|--------|
| Funds paid to institutions/Accredited Partners | 100% |
| Per-student sub-ledger coverage of bulk payments | 100% |
| Daily reconciliation: clean days | 100% (any variance freezes disbursements) |
| Institution reporting compliance | 95%+ |
| Section 18A receipts issued automatically | 100% of qualifying donations |
| Disbursements with two-step approval | 100% |
| POPIA data subject requests resolved in statutory time | 100% |

---

# 23. GLOSSARY OF TERMS

| Term | Definition |
|------|------------|
| **FundsLink Academy** | The platform. A funding entity, not an aggregator. |
| **Core Activity** | Collecting donations and funding students directly. |
| **Postgraduate** | Honours, Masters, PhD, Postgraduate Diploma. |
| **Undergraduate** | Bachelor's degree, Diploma, Higher Certificate. |
| **NSFAS** | National Student Financial Aid Scheme (government funder). |
| **SETA** | Sector Education and Training Authority (has unclaimed funds). |
| **Redirection** | Moving a student from a failing course to a better-fit course. |
| **Round-Up Program** | Voluntary 50c-per-transaction giving, accumulated and collected as one monthly debit order. |
| **Batching** | Collecting many small round-ups in one payment to avoid per-transaction fees. |
| **Pay-It-Forward** | Graduates voluntarily paying R100+/month for 2 years after employment. Never debt. |
| **50/50 Question** | "Round up 50c for education? Yes or no." |
| **Platinum Student** | Fully verified and approved for funding (two-step approval). |
| **Bulk Allowance Payment** | FundsLink pays total allowance pool to institution, not individual students. |
| **AllowanceAllocation** | The per-student sub-ledger record inside every bulk payment. |
| **Accredited Payment Partner** | Vetted non-institution entity (housing provider, bookstore) FundsLink may pay on a student's behalf. |
| **Immutable Ledger** | Append-only financial record; corrections are reversing entries. |
| **Two-Step Approval** | Proposer + separate authorizer required for any money movement. |
| **Status Source** | Whether a tracked status came from self-report, email capture, or partner API. |
| **Release Map** | The phased build order (§3) that governs what is promised when. |
| **Information Officer** | POPIA-accountable officer; currently the Founder. |

---

# 24. APPENDIX: QUICK REFERENCE CARDS

## A. Who FundsLink Funds

| Student Type | Duration | Allowance | Success Rule | After |
|--------------|----------|-----------|--------------|-------|
| Postgraduate | Continuous | R1,000 (to institution) | 65% average | Continue |
| Undergrad (failed) | 1 year | R1,000 (to institution) | Improve | To NSFAS |
| Undergrad (NSFAS unable to pay) | One-time | R1,000 (to institution) | N/A | Graduate |
| Undergrad (never qualified) | 1 year | R1,000 (to institution) | Good performance | To NSFAS |

## B. The Money Flow

```
Donor (R5 – R1M+ online · 50c at a time via batched round-ups)
        ↓
FundsLink Academy ── every movement: immutable ledger entry
        ↓
   Two-step approval
        ↓
    ┌───┴──────────────┐
    ↓                  ↓
Tuition / Debt    Allowance Pool (bulk + per-student sub-ledger)
(to institution)  (to institution)
    ↓                  ↓
Accredited        Institution distributes
Payment Partners  to students on their
(books, housing)  own schedule
        ↓
Daily reconciliation · Quarterly transparency report
```

## C. The Trust Rule

> *"No money ever goes directly to any student. Every rand – including allowances – is paid to the institution or an Accredited Payment Partner. The institution distributes to students on their own dates. Every rand has a ledger entry. No rand moves on one person's say-so. This is absolute and non-negotiable."*

## D. The Promises We Make (and Can Keep)

| To | Promise |
|----|---------|
| Students | One dashboard, every deadline, every reminder, follow-ups on silent bursaries, outcomes captured when shared with us |
| Donors | R5 minimum, fee transparency, immutable ledger, quarterly public report, one-click cancel |
| Institutions | NSFAS-style bulk model, per-student lists, no new infrastructure |
| Graduates | The pledge is Ubuntu, never debt |

---

# 25. v1.2 LIFECYCLE ADDENDUM (Founder-approved, 2026-06-14)

> Outcome of the student-journey review. These are **binding product rules**; the schema
> already enforces what can be enforced (migrations 0003–0004). Service/UX items name their
> build stage. Every rule is citable like any other (BR-x / S-x).

## 25.1 Always-open, rolling intake (no application deadline)
FundsLink's own funding intake is **open 24/7, all year**. There is **no submission deadline**
on a FundsLink application — a safety net with office hours is not a safety net. (The only
deadlines in the system belong to *external* bursaries we track, `bursary_deadline.due_on`.)
- **Intake** (DRAFT, SUBMITTED, automated PRE_SCREENING) is real-time.
- **Human judgement** is paced in review cycles bounded by `config.review_sla_days` (14).
- **Spend** stays safe via `config.matching_daily_budget_zar`.

## 25.2 Priority / emergency lane (the defunded-late student)
A student who misses external windows or is **defunded by NSFAS mid/late-year** is the *most*
deserving, not the least. Applications carry a **priority** (`lk_priority`: NORMAL/URGENT/
CRITICAL) and an optional `needed_by` date; emergency cases get a shorter SLA
(`config.emergency_review_sla_days`, 3). Reviewers triage by priority then age
(`ix_app_review_triage`). *(Service routing: Stage 03.)*

## 25.3 Post-approval lifecycle (money safety)
Approval is **not** the end of the money story. An award may move `APPROVED →
{SUSPENDED, REVOKED, COMPLETED}` (and `SUSPENDED → APPROVED`), each by a **human actor** with a
recorded `note`. Only `COMPLETED` frees the student's year; `SUSPENDED`/`REVOKED` still count as
active. Binds to the two-person money rule (§16). *(BR-S10 — new.)*

## 25.4 Honesty layer
- **Document validity (BR-E10):** documents carry `issued_at`/`valid_until`; an expired
  document triggers a **RETURN for info**, never a rejection.
- **Resubmission clock:** a RETURNED_FOR_INFO carries a `respond_by`; silence is reminded, not
  punished (ties into the 30/45/60 nudge engine). *(Service: Stage 03.)*
- **One human, one identity:** SA ID (blind-indexed, `uq_user_idnum`) is required **before
  SUBMIT**, not before register — low-friction onboarding, hard anti-duplicate at the moment
  money is at stake. *(Service: Stage 02/03.)*

## 25.5 Meet students where they live
- **Language:** `student_profile.preferred_language` and `application_motivation.language` are
  constrained to the **11 SA official languages** (E11). The whole experience speaks their
  language. *(UX: Stage 04.)*
- **Channels:** WhatsApp is a first-class, consented channel (`MARKETING_WHATSAPP`) alongside
  email/SMS (BR-N03). Mobile-first, low-data, autosave drafts. *(UX: Stage 04.)*

## 25.6 Deferred-but-committed (named for their stage)
| Item | Stage |
|------|-------|
| Pre-submit eligibility self-check (read `eligibility_ruleset`) | 03 service |
| "External deadline passed → here are alternatives" nudge job | 03 service |
| Orphan `application_motivation` cleanup on category switch | 03 service |
| Mobile-first, low-data, autosave, multi-language UI | 04 UX |

---

# LOCKED & APPROVED

**This document is the complete MASTER specification for FundsLink Academy — the main document from which the TAD, DB Doctrine, ERD Package, and all ADRs derive.**

**Version:** 1.0 (MASTER)
**Date:** 2026
**Status:** LOCKED at Suite v1.0. No further changes without Founder approval (C0 §8).

**Key Updates in this Master edition:**
- Release Map governs build order (resolves conflict with locked v1 feature set)
- R5 minimum online donation with fee transparency (Founder decision)
- Round-Up Program redesigned as app-side and batched — buildable today
- Tracking promise rewritten to be keepable; partner APIs as the growth path
- Accredited Payment Partners Registry resolves the trust-rule contradiction
- POPIA & Data Protection, Financial Controls, AI Matching Governance, Notification Policy, and Operations & Reliability added as first-class sections
- Two-step approval on all money — binding the Founder included

---

**Signed:**

_________________________
**Maluleke Kurhula Success**
Founder, FundsLink Academy
BSc Computer Science & Mathematics, NWU, Final Year 2026

---

**"Funded by many. For those who need it most. 50c at a time. Every rand through institutions. Every rand on the ledger."**
