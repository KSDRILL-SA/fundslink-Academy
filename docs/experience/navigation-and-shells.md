# Navigation & Shells

The three layout shells, the shared/page-specific headers and footers, and the **signature
horizontal auto-scroll navbar** — specced precisely so the build engineer implements it exactly, and
bulletproof on accessibility (the thing fancy navs usually get wrong).

> Grounded in [frontend-structure.md](frontend-structure.md) (`layouts/`, `libs/ui/nav`),
> [design-system.md](design-system.md), [component-library.md](component-library.md), the
> emotional-design law (P1–P8), and the UI/UX navigation rules (active-state, persistent nav,
> keyboard, reduced-motion, deep-linking).

## 1. The three shells

| Shell | For | Composition |
|-------|-----|-------------|
| **app-shell** | Authenticated student + admin | App header (logo · **navbar** · user menu) → routed content → slim app footer |
| **marketing-shell** | Public site | Marketing header (logo · marketing nav · Sign in / Apply) → content → full marketing footer |
| **auth-shell** | Login / register / verify / reset | Minimal centred card on a calm navy gradient; logo only; no nav |

Shells are the **only** place headers/footers/nav are composed (DRY). Each exposes a `<ng-content>`
for the routed feature and named slots for page-specific header/footer extras.

## 2. The signature navbar (`ui-scroll-nav`)

A single **horizontal** rail of destinations — never a vertical dropbar. Key items sit visible;
when they overflow the width, the scroll behaviour engages. One component, one interaction model,
two scroll modes.

### 2.1 Behaviour by platform
- **Mobile / touch:** native horizontal **swipe** scroll with momentum + **scroll-snap** to items;
  a soft edge-fade shows there's more. (This is nav, not page content — horizontal scroll is correct
  here.)
- **Desktop:** **edge arrows on both sides**, shown only when there's overflow on that side. Two modes:
  - **Auto-scroll (default):** **hover** the arrow → the rail scrolls smoothly that direction; leave
    → it stops. (Pure pointer convenience.)
  - **Step mode:** **double-tap/double-click** an arrow toggles to step mode → a single **click**
    scrolls exactly **one item**; the arrow shows a stepped icon. Double-tap again returns to
    auto-scroll. The mode is remembered for the session.

### 2.2 Accessibility — what makes it premium, not amateur (non-negotiable)
- **Keyboard:** every item is a real link in **Tab** order; arrows are real `<button>`s (`aria-label`
  "Scroll left/right"). Keyboard users never need the scroll gimmick — focusing an off-screen item
  **auto-scrolls it into view** (`scrollIntoView`, smooth-or-instant per motion pref).
- **Reduced motion:** `prefers-reduced-motion: reduce` → **auto-scroll is disabled**; arrows become
  **step-only** (click = one item), no smooth animation. The feature degrades gracefully, never
  breaks.
- **Active state:** the current route is marked `aria-current="page"` + a gold underline/indicator
  (colour **and** weight, not colour alone).
- **Semantics:** `<nav aria-label="Primary">`, a focus ring (3px `--ring`) on every item and arrow,
  44px targets, 8px gaps. Arrows have a visible focus state too.
- **No content trap:** arrows/scroll never hide a destination from keyboard or screen-reader; all
  items are always reachable regardless of scroll position.

### 2.3 Refinement (the smart split)
Core destinations stay **prominent**; overflow scrolls. Use the same `ui-scroll-nav` for the
**primary** app nav *and* for **secondary/contextual** rows (dashboard tabs, bursary category chips)
— consistent interaction everywhere. Where space allows on desktop, the primary items show without
needing to scroll at all (arrows simply don't appear).

### 2.4 Controller contract (for the build engineer)
`ui-scroll-nav` inputs: `items[] {label, icon, route, badge?}`, `mode: 'auto'|'step'` (persisted).
Outputs: active route via the router. It owns: overflow detection (ResizeObserver), arrow
visibility, the auto-scroll loop (rAF, cancel on leave), the double-tap toggle, scroll-snap, and
`scrollIntoView` on focus. Honours reduced-motion at every branch.

## 3. Headers

### App header (authenticated)
Left: **logo** (mark + wordmark, links home). Centre/flow: the **`ui-scroll-nav`**. Right: a
**notifications bell** (badge count, links to history), a **theme toggle** (light/dark), and the
**user menu** (avatar → profile, settings, **Sign out** *visually separated* as a destructive-ish
item). Sticky, slim (≤64px), `--shadow-sm` on scroll. Page-specific header slot for a title/breadcrumb.

### Marketing header
Logo · marketing nav (Home · How it works · For students · For donors · About) · **Sign in**
(ghost) + **Apply** (gold accent CTA). Transparent over the hero, solid on scroll. Mobile: a clean
slide-in panel (not a cramped dropdown).

### Auth header
Logo only, centred. Calm. Nothing to distract someone signing in.

## 4. Footers

### Marketing footer (full, shared)
Four tidy columns: **Brand** (mark + one-line mission + the tagline) · **Platform** (How it works,
For students, For donors, Browse bursaries) · **Trust** (Privacy/POPIA, Information Officer, Terms,
Contact) · **Connect** (email, socials). Bottom bar: © 2026 FundsLink Academy · "A non-profit
funding South African students." Trust signals (NPC/PBO/§18A once live) sit here.

### App footer (slim)
A quiet strip: © · Privacy · Help/Support · a status dot. No clutter — the app is for *doing*.

### Page-specific
Both footers expose a named slot for page extras (e.g., a "Need help? Talk to us" band on the
rejection screen — P2, never a dead end).

## 5. Responsive & states

- Breakpoints 375 / 768 / 1024 / 1440. Mobile-first. `min-h-dvh`, safe-area insets for sticky bars.
- Header/nav reserve space so content never jumps (no CLS).
- Skeleton the header on first paint; the navbar renders instantly (it's static structure).

## 6. What consumes this

`marketing-site.md` (the marketing shell + header/footer in action) and every feature screen (inside
the app shell). The build engineer builds `app/layouts/{app,marketing,auth}-shell` and
`libs/ui/nav/ui-scroll-nav`, then routes features through the shells
([frontend-structure.md §4](frontend-structure.md)).
