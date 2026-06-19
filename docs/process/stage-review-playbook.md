# FundsLink Academy - Stage Review Playbook

This playbook adapts the KSDRILL AI review framework to FundsLink Academy. Use it when the Founder wants to review completed stages one at a time before approving the next build stage.

Core references:

- [.ksdrill/workflow/ai-assisted-software-development-workflow.md](../../.ksdrill/workflow/ai-assisted-software-development-workflow.md)
- [.ksdrill/workflow/ai-review-challenge-framework.md](../../.ksdrill/workflow/ai-review-challenge-framework.md)
- [implementation-process.md](implementation-process.md)
- [session-playbook.md](session-playbook.md)
- [docs/governance/constitution-index.md](../governance/constitution-index.md)
- [CLAUDE.md](../../CLAUDE.md)

## 1. Review Law

Review one stage at a time, in implementation order. Do not combine stages unless the Founder explicitly asks for a full-system audit.

For every review:

1. Load the stage brief and the latest handoff for that stage.
2. Verify the repository state against the handoff claims.
3. Review only the completed stage under inspection.
4. Apply the stage-specific questions from `.ksdrill/workflow/ai-review-challenge-framework.md`.
5. Run or inspect the evidence required by that stage gate.
6. Produce findings ordered by severity.
7. Answer the Universal Final Challenge.
8. Recommend one of: approve, approve after fixes, or do not approve.

AI reviewers recommend. The Founder approves.

## 2. Stage Review Order

| Review | Stage | Gate | Primary stage files | Main evidence |
|--------|-------|------|---------------------|---------------|
| 1 | Stage 00 - Foundation | G0 | `claude-instructions/00-BOOTSTRAP.md`, `docs/process/handoff-s00-s01.md` | Repo structure, CI skeleton, environment hygiene, governance sync, stage status docs |
| 2 | Stage 01 - Database | G1 | `claude-instructions/01-DATABASE.md`, `docs/process/handoff-s01-s02.md`, `docs/database/*` | Migrations, constraint tests, restore drill, EXPLAIN baseline, integrity checks |
| 3 | Stage 02 - Auth | G2 | `claude-instructions/02-AUTH.md`, `docs/process/handoff-s02-s03.md`, `/auth` OpenAPI paths | JWT flow, refresh rotation, MFA, RBAC, rate limits, cross-user 403, Sentry checks |
| 4 | Stage 03 - Backend | G3 | `claude-instructions/03-BACKEND.md`, `docs/process/handoff-s03-s04.md`, contracts, architecture docs | Six modules, contract diff, BR-linked tests, pipeline demo, store isolation, stress-test reconciliation |
| 5 | Stage 04 - Frontend | G4 | `claude-instructions/04-FRONTEND.md`, `docs/experience/ux-screen-map.md`, `docs/architecture/error-codes.md` | Screens, generated client usage, performance budget, WCAG/axe, keyboard walk, rejection flow |
| 6 | Stage 05 - Integration | G5 | `claude-instructions/05-INTEGRATION.md`, `docs/audits/stress-test-audit.md`, launch checklist | Playwright E2E, k6 baseline, port scan, dependency audit, restore drill, chaos hour |
| 7 | Stage 06 - Launch | G6 | `claude-instructions/06-LAUNCH.md`, `docs/operations/launch-checklist.md`, runbooks | Production cutover evidence, env audit, smoke tests, real student journey, monitoring |

## 3. Standard Review Method

### Step A - Scope the Stage

Confirm:

- Which stage is being reviewed
- Which gate defines done
- Which handoff claims the stage is complete
- Which documents are authoritative for the stage
- Which later-stage files must be ignored unless they prove or contradict the stage under review

### Step B - Repo Verification

Check:

- The files claimed in the handoff exist
- The modules claimed in the handoff exist
- The stage docs and repo status agree
- The gate evidence exists and is not only described in prose
- No new stage was started without Founder approval

If a claim and the repo disagree, treat it as a finding.

### Step C - Evidence Review

For each stage, inspect or run the gate evidence that is still practical in the current environment. If a command cannot be run, record why and review the committed evidence instead.

Evidence must come from:

- Tests
- CI output
- Migration state
- OpenAPI contract diff
- Static analysis or lint output
- Restore drill logs
- Runtime demos
- Documentation updates

Confidence alone is never evidence.

### Step D - Challenge Review

Apply the stage-specific questions from `.ksdrill/workflow/ai-review-challenge-framework.md`.

Every review must include at least:

- Security risk review
- Data integrity review when data is touched
- Contract consistency review when APIs are touched
- Maintainability review
- Test gap review
- Operational risk review when deployment, jobs, queues, storage, or third-party services are touched

### Step E - Findings Resolution

Classify findings:

| Severity | Meaning | Required action |
|----------|---------|-----------------|
| Blocking | Gate should not be approved | Fix before approval |
| High | Serious risk, likely production or maintenance impact | Fix before approval unless Founder explicitly accepts risk |
| Medium | Should be fixed soon, not necessarily gate-blocking | Schedule or fix in current stage |
| Low | Improvement, cleanup, or documentation polish | Track or batch |
| Evidence gap | Claim may be true but proof is missing | Produce evidence before approval |

### Step F - Final Recommendation

End every review with one recommendation:

- Approve
- Approve after listed fixes
- Do not approve

The recommendation must include the reason.

## 4. Review Report Template

```markdown
# Stage NN Review - [Stage Name]

## Scope
- Stage:
- Gate:
- Reviewed handoff:
- Reviewed docs:
- Reviewed repo areas:

## Verdict
[Approve / Approve after fixes / Do not approve]

## Blocking Findings
[None, or findings with file references and evidence]

## High-Risk Findings
[None, or findings with file references and evidence]

## Medium and Low Recommendations
[None, or recommendations]

## Missing Evidence
[Commands not run, docs missing, gate proof absent, or stale status]

## Universal Final Challenge
1. Most likely to fail first:
2. Most expensive to fix later:
3. Most dangerous assumption:
4. Remaining security risk:
5. Remaining scalability risk:
6. Remaining maintenance problem:
7. Remaining uncovered edge case:
8. 10x growth risk:
9. 100x growth risk:
10. Production recommendation:
11. If not, why not:

## Required Fixes Before Approval
[Concrete list]

## Risk Acceptances Requiring Founder Approval
[Concrete list]
```

## 5. Paste-Ready Review Prompt

Use this when opening a fresh review session:

```text
We are doing a sequential FundsLink Academy stage review.

Review Stage NN only. Do not review later stages yet.

Read:
- CLAUDE.md
- docs/process/stage-review-playbook.md
- .ksdrill/workflow/ai-assisted-software-development-workflow.md
- .ksdrill/workflow/ai-review-challenge-framework.md
- docs/governance/constitution-index.md
- claude-instructions/NN-*.md
- the latest handoff for this stage

Then verify the actual repository state against the handoff.

Use the Stage NN questions from .ksdrill/workflow/ai-review-challenge-framework.md.
Return findings first, ordered by severity, then missing evidence, then the Universal Final Challenge answers, then a clear approval recommendation.
```

## 6. Current Review Position

As of the current documentation state, Stages 00, 01, 02, and 03 are marked complete, with Stage 04 next.

Recommended review sequence from here:

1. Review Stage 00 - Foundation
2. Review Stage 01 - Database
3. Review Stage 02 - Authentication and authorization
4. Review Stage 03 - Backend modules
5. Only after those are approved, begin Stage 04 planning or implementation review

