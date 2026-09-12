# Handoff: Stage 04 (Frontend) → Stage 05 (Integration)

The relay baton. Everything Stage 05 needs to pick up at the highest level.
Date: 2026-09-12 · From: Engineer 02 (Claude Code, L3, sole operator) · Approver: Founder (L4).

```mermaid
graph LR
  S0["00 ✅"] --> S1["01 DB ✅"] --> S2["02 AUTH ✅"] --> S3["03 BACKEND ✅"] --> S4["04 FRONTEND ▣<br/>G4 · 25 screens"] --> S5["05 Integration ▶"] --> S6["06 Launch"]
  classDef done fill:#0e7490,color:#fff,stroke:#155e75;
  classDef part fill:#b45309,color:#fff,stroke:#92400e;
  classDef now fill:#1d4ed8,color:#fff,stroke:#1e3a8a;
  class S0,S1,S2,S3 done; class S4 part; class S5 now;
```

## 0. Status — Stage 04 BUILD COMPLETE, G4 PARTIALLY EVIDENCED

Every screen in the journey is built, the full stack has run end to end against real
PostgreSQL, and the repository is at zero open issues. **Two G4 criteria are not yet
evidenced, and one approval is unrecorded** (§2). This document does not claim the gate. The Founder reviews it.

### G4 evidence — real output, clean tree on `main`, 2026-09-12

| Gate criterion | Command | Result |
|---|---|---|
| Vitest green | `ng test --no-watch` | **35 files / 638 tests passed** |
| Typecheck (app + 4 libs + specs) | `npm run typecheck` | **clean, exit 0** |
| Production build | `ng build --configuration production` | **exit 0, no budget breach** |
| First load — initial bundle | build table | **377.18 kB raw / 101.56 kB transfer** |
| axe WCAG 2.2 AA (jsdom) | in-suite, every screen | **zero serious/critical** |
| Colour contrast (real browser) | Lighthouse accessibility | **100, zero failures** — home (anonymous), dashboard, S16 decision |
| A03 refuses an inadequate rejection | `admin.spec.ts` | **PASS** — refuses <40 words, refuses no next-step confirmation, refuses no reason category; allows only when all three hold |
| ≤200 kB first load, student routes | build table, no DSN | **~106–130 kB transfer** (see §1) |
| ≤200 kB first load, student routes | build table, **with a production Sentry DSN** | **PASS — §3 resolved, Sentry now fetched on idle** |
| Throttled-3G LCP / CLS / INP | — | **NOT MEASURED** (§2) |
| Manual keyboard walk log | — | **NOT WRITTEN** (§2) |
| S16-REJ Founder design sign-off | — | **NOT RECORDED** (§2) |

## 1. First load, worked out

`Initial total` is **101.56 kB transfer**. A student route adds its own lazy chunks on top:

| Route | Initial | + app-shell | + route chunk | Total transfer |
|---|---|---|---|---|
| `/app` (dashboard) | 101.56 | 3.67 | 4.20 | **109.43 kB** |
| `/app/applications/:id` (heaviest) | 101.56 | 3.67 | 6.84 | **112.07 kB** |
| `/` (marketing home, anonymous) | 101.56 | — | 4.25 | **105.81 kB** |

Adding the two largest unnamed shared chunks (9.77 + 7.71 kB) as a worst case still lands at
**~129.5 kB** — comfortably inside the 200 kB bar. This criterion passes on bytes.

## 2. What is NOT evidenced, and why

Three items are outstanding. None is a defect; each is unfinished measurement or an
unrecorded approval, and each is stated here rather than assumed.

1. **Throttled-3G LCP / CLS / INP.** Needs a real browser driving a production build. Both
   browser automation servers (`chrome-devtools`, `playwright`) failed to connect in the
   session that produced this document, and an earlier attempt to run a build and a server
   concurrently exhausted host memory. The bytes are measured; the *timings* are not.
   Stage 05 owns this alongside the rest of the browser-pass backlog.
2. **Manual keyboard walk log.** axe covers programmatic accessibility on every screen and
   Lighthouse confirms contrast, but a human tab-through of each journey has never been
   written down. Same blocker, same owner.
3. **S16-REJ design sign-off.** `stage-04-design-package.md` §9 requires the kind-rejection
   screen to have its own Founder design review *before merge*. The screen shipped in the
   #220 work; the sign-off was never recorded. **This needs the Founder, not more code.**

## 3. Resolved — Sentry moved off the first-load path (L4 ruling, 2026-09-12)

**The finding.** `src/app/core/observability.ts` fetched the Sentry SDK through
`provideAppInitializer` whenever a DSN was configured. The SDK is its own lazy chunk:
**461.00 kB raw / ~130 kB transfer**. Local dev and CI have no DSN and never fetch it, which
is why every other number in this document is clean — but production will have one.

The import was already deliberately un-awaited, so it never blocked first paint, and
`DeferredErrorHandler` buffered up to 20 errors so nothing thrown in the window was lost.
The problem was narrower than "it blocks": not awaiting a request is not the same as not
*making* it. The fetch still opened at bootstrap, while the first route was in flight, so on
the mid-range SA phone + 3G profile G4 is measured against, ~130 kB of reporter competed for
the same bandwidth as the screen the student came for. Counting all first-visit bytes, a
student route reached roughly 236–260 kB against a 200 kB bar.

**Ruling (Founder, L4, 2026-09-12):** fix it — keep Sentry, take it off the first-visit path.

**What changed.** The fetch now waits for the browser to go idle
(`requestIdleCallback`, with a `setTimeout` fallback for older Safari and jsdom), bounded by
a **3000 ms deadline** so a page that never idles still gets a reporter. With no DSN nothing
is scheduled at all, so dev and CI do no work rather than merely no download. The existing
error buffer is what makes the longer window safe — it is load-bearing here, not a nicety.

**Evidence.** Initial bundle **377.18 kB raw / 101.56 kB transfer** (+40 bytes for the
scheduler), Sentry unchanged at 461.00 kB raw / 129.71 kB transfer and still its own chunk.
Four tests pin the behaviour: no DSN schedules nothing; a DSN waits for idle with the
deadline; the timer fallback is exercised where `requestIdleCallback` is absent; an empty DSN
reports not-started without importing the SDK. **638 tests, typecheck clean.**

**What the tests do not prove.** They assert *when* the fetch is scheduled, not that Sentry
initialises once the callback fires — that would need the dynamic import itself mocked. The
initialisation path is unchanged by this work and remains covered only by the real run.

## 4. What Stage 04 actually built

- **25 screens** — S01–S21 student, A01–A03 admin — in journey order, each with all five
  states, one `h1`, axe clean. A04 recusal is not built: **no endpoint exists** for it.
- **The stack runs.** PostgreSQL 16.14 + FastAPI + Angular, locally, end to end: register →
  login → reload keeps the session → profile → application → submit → real status trail.
  The earlier record saying this host could not run PostgreSQL was wrong.
- **Four standing gates** were added, each because something real slipped past:
  `route-integrity.spec.ts` (ten dead links, hidden by a redirecting `**`),
  `promises.spec.ts` (five user-facing claims the system did not keep),
  `contract-coverage.spec.ts` (eight API capabilities with no button — including sign-out,
  which existed nowhere), `account-data-integrity.spec.ts` (nothing hardcoded in an account).
- **#220 was not a contract gap.** `decision_reason` was already in
  `application_status_event.note` and had simply never been read back. S16 now exists.

## 5. Known caveats carried into Stage 05

- MFA has no "turn off" / "regenerate codes", and no endpoint reports whether it is already on.
- `review_sla_days = 14` lives in the config table; no contract endpoint exposes it.
- The waitlist policy "postgraduate first, then by need" is described but not implemented.
- The dashboard leads with `applications()[0]`; the contract does not guarantee ordering.
- Tracking silence threshold is computed client-side from the device clock.
- A03's 40-word floor stops a two-word decline; it cannot detect boilerplate, and the
  next-step checkbox is an **attestation, not a verification**.

## 6. Outstanding from the Founder

| Item | Blocks |
|---|---|
| Real `hello@` / `privacy@` addresses | `src/app/content/organisation.ts` still says PLACEHOLDER |
| S16-REJ design sign-off | G4 |
| NPC / PBO / §18A registration number | marketing copy; must never be invented |
| Consented student stories | testimonials; tests currently enforce their absence |
| `GOVERNANCE_SHA` pin, `main` branch protection | carried since Stage 03 |

## 7. Next session

`docs/process/session-playbook.md` §5 — Stage 05 Integration. Its first work is the
browser-pass backlog this document leaves open: throttled-3G timings, the keyboard walk log,
nav overflow behaviour (arrows never render in jsdom), and hero LCP.
