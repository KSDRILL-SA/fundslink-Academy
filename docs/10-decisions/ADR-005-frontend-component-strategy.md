# ADR-005 — FundsLink Academy: Frontend Component & Styling Strategy

| Attribute | Value |
|-----------|-------|
| **ID** | ADR-005 |
| **Date** | 2026-06-13 |
| **Status** | **accepted (Founder L4, 2026-06-13)** |
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

## Alternatives rejected
- **Install shadcn/Magic/Aceternity directly** — impossible in Angular (React-only).
- **Separate React/Next marketing surface** — adds a second stack and surface, an ADR-002 amendment,
  and secrets/deploy sprawl; rejected for v1 (revisit only if marketing complexity demands it).
- **Switch the app to React/Next** — an ADR-001 stack reversal with massive blast radius; rejected.

> **Status: accepted — Owner approval: Maluleke Kurhula Success (L4)**
