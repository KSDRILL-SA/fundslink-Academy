# FundsLink Academy — GitHub Workflow (v1.0)

| Attribute | Value |
|-----------|-------|
| **Status** | active — Founder standing order |
| **Applies to** | every task / branch / PR in this repo |
| **Authority** | Founder (L4) directive. Auto squash-merge is an explicit, Founder-authorized deviation from the strict `S10.8` manual-merge gate, for solo velocity. |
| **Related** | [CLAUDE.md](../../CLAUDE.md) "GITHUB WORKFLOW"; solo-dev overlay (S1.27, S1.30, S10.27); `S1.16`–`S1.18` |

> Every unit of work travels: **Issue → Branch → PR (linked) → self-review → squash-merge**.
> Nothing is committed straight to `main`. One task = one branch = one PR.

---

## 0. Branching model

**Today — solo mode (in force):** one long-lived branch, `main`. Every task branches off `main`,
opens a PR into `main`, and squash-merges. `main` is the single source of truth.

**Future — team mode (planned):** when the team grows, adopt a GitFlow-style two-tier model.

| Branch | Role |
|--------|------|
| `main` | **Production-ready code only.** Protected — receives merges from `Dev` (releases) or hotfixes, never day-to-day work. |
| `Dev`  | **The team's integration branch.** Engineers branch `feature/*` / `fix/*` off `Dev` and PR back into `Dev`; `Dev` is promoted to `main` for each release. |

`Dev` already exists, pre-positioned for this. **Onboarding step 1:** sync `Dev` ← `main` (so the
team starts from the current production state), make `Dev` the default working branch, and enable
**branch protection on `main`** (require PR + green CI; no direct pushes — see §4). Until that
switch is made, the solo *branch-off-`main`* flow below remains in force.

### The state of `Dev` today — nothing to merge

`Dev` is a **pre-Stage-00 snapshot** (`Add files via upload`, 2026-06-12) that is **fully contained
in `main`'s history**. It holds no work of its own. Verified:

| Check | Command | Result |
|-------|---------|--------|
| `Dev` is an ancestor of `main` | `git merge-base --is-ancestor origin/Dev origin/main` | **true** |
| Commits `Dev` has that `main` lacks | `git rev-list --count origin/main..origin/Dev` | **0** |
| Commits `main` has that `Dev` lacks | `git rev-list --count origin/Dev..origin/main` | **90** |

Two standing rules follow, and they are not optional:

- **Never merge `Dev` into `main`.** There is nothing in it to gain and ~43k lines to lose. If a
  session is ever asked to "merge `Dev`", the correct move is the ancestor check above — then say
  so and stop.
- **Never delete `Dev`.** It is deliberately reserved for team mode. Its staleness is expected;
  onboarding step 1 re-syncs it from `main`, it is not repaired before then.

---

## 1. The loop (do this for every task)

1. **Open an Issue first** — before the branch.
   - Title: `Stage NN · TASK X — <summary>` (or a plain task title outside stages).
   - Body: what the task is, the branch name, the gate/spec it satisfies, and `Refs:` standard IDs.
   - **Type:** `Task` (or `Bug` / `Feature`) — the org-level issue type.
   - **Assignee:** `MALULEKE-KS`. **Labels:** a type label + `stage:NN-…`. **Milestone:** the stage milestone.
   - **Project:** `FundsLink Academy`, with the **Status** field set (`Todo` → `In Progress` → `Done`).

2. **Create the branch** off `main` — Conventional Commits naming, kebab-case:
   `docs/…`, `chore/…`, `feat/…`, `ci/…`, `fix/…`.

3. **Do the work**, committing in logical units. Commit subjects follow `type(scope): summary` (`S1.17`),
   bodies cite standards. **No AI attribution; no Co-Authored-By trailer** (CLAUDE.md GitHub conduct).

4. **Open the PR** into `main`:
   - **First line of the body:** `Closes #N` (links the issue; merge auto-closes it).
   - **Assignee:** `MALULEKE-KS`. **Labels:** same type + `stage:NN-…`. **Milestone:** the stage milestone.
   - **Project:** `FundsLink Academy`, with the **Status** field set (`In Progress`, then `Done` on merge).
   - Body sections: **What / Why / How verified**, citing standard IDs.

5. **Document the self-review** as a PR comment — `S10.27` (AI as second reviewer in solo mode) /
   `S1.45` four quadrants (Architecture, Code Quality, Commits & Git, Functionality & Tests).

6. **Squash-merge** the PR (`--squash --delete-branch`). Claude Code is authorized to auto squash-merge.
   The squash subject keeps the Conventional form and ends with the PR number, e.g. `docs: … (#1)`.

---

## 2. Label taxonomy

| Label | Use |
|-------|-----|
| `documentation` | docs filing / docs changes |
| `scaffold` | monorepo skeletons, configs |
| `ci` | GitHub Actions, lint/test gates |
| `env` | env hygiene, secrets, tooling |
| `governance` | constitutional / governance work |
| `security` | security-sensitive change (e.g. secret removal) |
| `stage:NN-…` | stage tag, e.g. `stage:00-bootstrap` |

## 3. Milestones

One milestone per stage: `Stage 00 — Bootstrap`, `Stage 01 — Database`, … Every issue and PR
for a stage is attached to that stage's milestone, giving a burn-down per stage.

## 3.5 Issue types & the project board

**Issue Type** (org-level GitHub feature) is set on every issue:

| Type | Use |
|------|-----|
| `Task` | a specific piece of build/setup work (default for stage tasks) |
| `Bug` | an unexpected problem or defect |
| `Feature` | a request, idea, or new functionality |

**Project:** every issue *and* PR is added to the org project **`FundsLink Academy`**
(`https://github.com/orgs/KSDRILL-SA/projects/1`). Set the **Status** field as work moves:

| Status | Meaning |
|--------|---------|
| `Todo` | issue opened, not started |
| `In Progress` | branch open / work underway |
| `Done` | PR merged / issue closed |

So the complete furniture is: **Issues** → type + assignee + labels + milestone + project + status;
**PRs** → `Closes #N` + assignee + labels + milestone + project + status.

## 4. Branch protection (known gap)

`main` branch protection (require PR, require CI) is **not yet enabled** — it is a paid feature for
private repositories and will be turned on when the account moves to GitHub Pro. Until then the
issue→PR→squash-merge discipline above is enforced by convention, not by the platform. This is the
single outstanding item on `S1.16` for this repo.

---

*v1.0 — established during Stage 00. Reflects the Founder's standing GitHub workflow order.*
