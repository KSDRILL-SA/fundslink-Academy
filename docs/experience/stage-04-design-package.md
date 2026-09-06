# Stage 04 — Frontend Design Package & Build Handoff

The entry point for the Stage 04 build engineer. The frontend is **fully designed** — this ties the
package together and hands it off ready to build. Read this with the gate brief
[`claude-instructions/04-FRONTEND.md`](../../claude-instructions/04-FRONTEND.md); that file defines
*done*, this defines *how it should look, feel, and be structured*.

> Status: **DESIGN COMPLETE — ready to build (new session).** Stack locked by
> [ADR-005](../decisions/adr-0005-frontend-strategy.md). Nothing here is built yet.

## 1. Read order (before writing any code)

1. [`claude-instructions/04-FRONTEND.md`](../../claude-instructions/04-FRONTEND.md) — the gate (G4).
2. [`ux-screen-map.md`](ux-screen-map.md) — **LAW**: P1–P8, the 21 screens + 4 admin, the kind-rejection.
3. [`frontend-structure.md`](frontend-structure.md) — the workspace skeleton to scaffold first.
4. [`design-system.md`](design-system.md) — the tokens to wire next.
5. [`brand-identity.md`](brand-identity.md) — the logo (Rising Door) + voice.
6. [`component-library.md`](component-library.md) — the premium components.
7. [`navigation-and-shells.md`](navigation-and-shells.md) — the shells + the signature navbar.
8. [`marketing-site.md`](marketing-site.md) — the public site.
9. [`handoff-s03-s04.md`](../process/handoff-s03-s04.md) §4 — the backend contracts to honour.

## 2. The locked design decisions (one glance)

| Dimension | Decision |
|-----------|----------|
| Direction | **"Trusted Institution, humanised"** — navy authority + amber/gold warmth |
| Colour | navy `#1b2c4d` (trust) + gold `#f59e0b` (hope) + warm-slate neutrals; light **and** dark, WCAG-AA |
| Type | **IBM Plex Sans** (one family; hierarchy by weight) |
| Logo | **Rising Door** — `assets/logo/logo-mark.svg` (+ mono) |
| Components | **spartan/ui** base, token-themed, + custom (navbar, avatar-upload, the 4 states) |
| Nav | the signature **horizontal auto-scroll navbar** (accessible) |
| Style | **Accessible & Ethical** + **Enterprise Gateway**; premium via craft, lightweight by build |

## 3. Build sequence (the order that avoids rework)

1. **Scaffold** the `apps/web/src/app` tree + `libs/ui` per [frontend-structure.md](frontend-structure.md).
2. **Tokens & Tailwind** — write `styles/tokens.css` (light+dark) and map `styles/theme.css`
   (Tailwind 4 `@theme inline`) to them ([design-system.md](design-system.md)). Load IBM Plex Sans (subset, swap, preload 400/600).
3. **Logo & favicon** — drop in `logo-mark.svg`, build the favicon/app-icon set.
4. **Components** — generate the **spartan/ui** base, theme with tokens, build the **custom** ones and
   the **four states** ([component-library.md](component-library.md)).
5. **Shells & navbar** — `layouts/{app,marketing,auth}-shell` + `libs/ui/nav/ui-scroll-nav`
   ([navigation-and-shells.md](navigation-and-shells.md)).
6. **Generate the API client** from `packages/contracts/openapi.yaml` into `libs/data-access` — never
   hand-write API types.
7. **Marketing site** ([marketing-site.md](marketing-site.md)) — public, lazy, its own bundle.
8. **App screens in journey order** ([ux-screen-map.md](ux-screen-map.md)): onboarding → profile →
   applications → eligibility/return → decisions → matching → tracking → notifications → admin.
9. **The kind-rejection screen (S16-REJ)** gets its **own design review before merge** (S4 gate) — it
   is the screen we build first in every review.

## 4. Contracts the frontend MUST honour (from handoff-s03-s04 §4)

1. **Generated client only** — types/services from `openapi.yaml` (32 ops live). No hand-written API types.
2. **Access token in Angular memory** (S3.14); the 401-refresh-dedup interceptor already exists in `libs/auth`.
3. **No business logic in the UI** (S4.12) — branch on the stable **`error.code`**, never `error.message`.
4. **Cursor pagination** everywhere (`{items, meta:{next_cursor}}`); **money is a decimal string** —
   render it, never `parseFloat` for logic.
5. **The four states** (loading/error/empty/success) on every data view; the kind-rejection per the UX map.

## 5. Definition of "world-class" here (the measurable bar — G4)

WCAG 2.2 **AA** · **axe-zero** serious/critical · **Lighthouse ≥ 95** (Perf + a11y) · LCP < 2.5s ·
CLS < 0.1 · INP < 200ms (mid SA mobile) · keyboard + screen-reader complete · light **and** dark ·
reduced-motion honoured · every screen has all four states. Plus the gate evidence in
[`04-FRONTEND.md`](../../claude-instructions/04-FRONTEND.md).

## 6. Where the design lives

`docs/experience/*.md` (this package) + `docs/experience/assets/logo/*` (the marks + gallery). The
build engineer references this handoff, scaffolds §3, and builds screen-by-screen — design decided,
execution clean. **The runway is laid.**
