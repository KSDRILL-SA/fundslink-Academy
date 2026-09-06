# ADR-005 — FundsLink Academy: Frontend Component & Styling Strategy

| Attribute | Value |
|-----------|-------|
| **ID** | ADR-005 |
| **Date** | 2026-06-13 |
| **Status** | **accepted (Founder L4, 2026-06-13)** · **amended (Founder L4, 2026-09-06)** — see Amendment 1 |
| **Relates To** | ADR-001 (Angular + FastAPI stack), ADR-002 (one Angular workspace), S1.4 / S6.7 (immutable stack), S4.13–S4.17 |

## Context
The Founder wants world-class UI calibre, referencing **shadcn/ui**, **Magic UI**, and **Aceternity UI**.
All three are **React** libraries (React + Radix UI / Framer Motion). FundsLink's locked stack is
**Angular** (ADR-001); the stack is immutable (S1.4 / S6.7). React components cannot be imported into
Angular — adopting them as-is would break the build and violate the locked stack.

## Decision
Stay 100% on Angular; reach the same calibre with Angular-native equivalents.

- **Styling:** Tailwind for layout/spacing/responsive (S4.13) + custom CSS for brand and complex
  visual patterns (S4.14); no duplication between the two (S4.15); design tokens as CSS custom
  properties (S4.16) using the shadcn/spartan HSL convention.
- **App component library:** **spartan/ui (`@spartan-ng`)** — the shadcn-for-Angular equivalent
  (Tailwind + Angular CDK primitives, copy-in components). Components are generated in Stage 04;
  the Tailwind token foundation is wired now.
- **Magic UI effects:** reproduced in Angular (Tailwind + Angular animations / a motion library) —
  the markup and CSS are portable; the React runtime is not.
- **Aceternity UI (marketing page):** reproduced in Angular **inside the single Angular workspace**
  (ADR-002) — not a separate React surface. The marketing/landing page is supporting (outside the
  v1 5-feature core) and is built in Stage 04+.

## Consequences
**For:** one stack, no React build, no ADR-001/ADR-002 violation; spartan/ui gives the shadcn
developer experience on Angular; tokens are shared across app and marketing. **Against:** the
animation-heavy Aceternity/Magic effects are hand-reproduced (more effort than an npm install);
spartan/ui's component catalogue is younger than shadcn's.

## Amendment 1 — Angular 22 + Tailwind 4 (Founder L4, 2026-09-06)

The decision above is unchanged: Angular stays, spartan/ui stays, Tailwind + tokens stay. What
changed is the **major version** of two of them, forced by two findings at the start of the Stage 04
build (issue #192).

**1. spartan/ui does not support our versions.** `@spartan-ng/brain@1.4.1` peers on
`@angular/core >=21.0.0 <23.0.0` and `tailwindcss >=4.0.0`. On Angular 18 + Tailwind 3.4, the
component library this ADR names could not be installed at all — the decision was unbuildable as
written.

**2. Angular <=18.2.14 carries unpatched high advisories** — stored XSS via SVG attributes, i18n
XSS, `HttpTransferCache` leakage of credentialed responses, XSRF token leakage via protocol-relative
URLs. `npm audit` reported **68 vulnerabilities (2 critical, 41 high)**, **51 of which required a
major bump**. This platform renders student PII across 25 screens; that is not an acceptable floor.

**Decided:** Angular **18 -> 22.1.5**, Tailwind **3.4 -> 4**, done at the point where the migration
surface was 33 TS files and **zero screens** — the cheapest it will ever be (doctrine L1).

**S1.4 / S6.7 (immutable stack) are not violated.** Those standards lock the *stack* — Angular, not
React. A major-version upgrade inside the locked framework is maintenance, and the same standards
would be violated by *refusing* it, since staying on 18 means shipping known-vulnerable code and
abandoning the spartan/ui decision this ADR makes.

**Consequences.** Tailwind 4 is CSS-first: `tailwind.config.ts` is replaced by `@theme inline` in
`apps/web/src/styles/theme.css`. The token contract in `tokens.css` is unchanged, and its tests
still pass. `@angular-devkit/build-angular` was replaced by `@angular/build`, removing the webpack
dev-server chain. CI Node moves 20 -> 22 (Angular 22 requires `^22.22.3 || ^24.15.0 || >=26.0.0`).
Result: **68 vulnerabilities -> 0**, and initial transfer size *improved* from 108.83 kB to 96.49 kB.

## Alternatives rejected
- **Install shadcn/Magic/Aceternity directly** — impossible in Angular (React-only).
- **Separate React/Next marketing surface** — adds a second stack and surface, an ADR-002 amendment,
  and secrets/deploy sprawl; rejected for v1 (revisit only if marketing complexity demands it).
- **(Amendment 1) Stay on Angular 18 and pin a legacy spartan/ui line** — would have meant building
  25 screens of student PII on a framework with unpatched stored-XSS and credential-cache-leak
  advisories, against an unmaintained component library. Rejected by the Founder (L4).
- **Switch the app to React/Next** — an ADR-001 stack reversal with massive blast radius; rejected.

> **Status: accepted — Owner approval: Maluleke Kurhula Success (L4)**
