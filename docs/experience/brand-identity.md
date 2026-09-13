# Brand Identity — logo, marks & voice

The brand layer that sits on the [design system](design-system.md): the logo (three concepts to
choose from), its construction and usage, and the brand voice. Direction: **"Trusted Institution,
humanised"** — navy authority + amber/gold warmth.

> Grounded in [design-system.md](design-system.md) (navy `#1b2c4d` / gold `#f59e0b`, IBM Plex Sans)
> and the logo design intelligence (Finance + Education → navy+gold, combination mark, trustworthy,
> **avoid trendy/playful**). The student voice extends the emotional-design law
> ([ux-screen-map §0](ux-screen-map.md), P1–P8) and the notification copy already shipped.

## 0. The Rising Door — the mark in use (2026-09-13)

![The Rising Door app icon](../../apps/web/public/icon-512.png)

**A doorway of access; inside it, three steps that rise; at the top, a graduation cap.** The concept
the Founder chose in June, in the same navy and gold — strengthened on Founder direction
(2026-09-13: *"on top of the existing one"*, *"at least 3 steps"*, *"proper real icons, clean and
professional"*, *"the cap is too big"*).

| Element | Says |
|---|---|
| The **doorway** (navy / ivory) | Access — the door this platform opens |
| Three **steps** (silver, lit treads) | The climb — and, read as bars, the funding growing |
| The **graduation cap** (gold) | Where the climb leads: graduating, and the Academy. **The path in silver, the achievement in gold** — gold, the brand's colour of hope, is spent only where the climb arrives (Founder choice, 2026-09-13, from six colour options) |
| **Light** through the doorway (plate / app icon) | Hope, at the moment of arrival |

**Built from a real icon set.** The mark is drawn in the icon language of **Lucide**, the icon set
the product's interface already uses — a 24-unit grid, rounded joins — and the cap *is* Lucide's
`graduation-cap` glyph (lucide 1.41, ISC licence), placed and filled rather than redrawn. A test
checks the logo's cap against the installed Lucide glyph. The logo and the interface's icons are one
family.

Why it replaced v1: v1 put a dot over a chevron inside the arch. At small sizes the figure read as a
caret, and nothing in the mark actually rose.

### Weighting by size

| Size | Drawn with |
|---|---|
| **40 px and larger** — auth screen, footer, app icon, print | Doorway at 2.6 u, lit tread highlights, light through the door on the plate |
| **Under 40 px** — header plate, favicon, browser tab | Doorway at 3.2 u, no tread highlights |

`<ui-logo>` chooses from the pixels the mark will actually occupy (`OPTICAL_SMALL_BELOW = 40`). The
header plate is 40 px with the artwork filling 90% of it — at 34 px / 82% the mark was a gold smudge.

### Files — generated, never hand-edited

Everything is written by **`apps/web/scripts/build-logo.mjs`** (`node scripts/build-logo.mjs` in
`apps/web`), which owns the geometry. A unit test holds `<ui-logo>` to the same paths, so the header,
favicon and app icon cannot drift apart.

| File | Use |
|---|---|
| [`logo-mark.svg`](assets/logo/logo-mark.svg) | Full colour, light surfaces |
| [`logo-mark-reversed.svg`](assets/logo/logo-mark-reversed.svg) | Navy / dark surfaces — ivory doorway, light through it |
| [`logo-mark-mono.svg`](assets/logo/logo-mark-mono.svg) | One colour (`currentColor`) — themes and single-ink print |
| [`logo-mark-small.svg`](assets/logo/logo-mark-small.svg) | Weighted for 16–40 px — the browser-tab icon (adapts to dark mode) |
| [`logo-app-icon.svg`](assets/logo/logo-app-icon.svg) | The mark on the navy plate — home-screen / touch icons |
| `apps/web/public/favicon.ico` | 16 / 32 / 48 px |
| `apps/web/public/apple-touch-icon.png`, `icon-192.png`, `icon-512.png` | Rendered from the app icon |

## 1. The logo — three concepts (2026-06, archive)

Open **[`assets/logo/preview.html`](assets/logo/preview.html)** in a browser to see all three on
light/dark, at favicon sizes, and as the full wordmark lockup. Each is hand-authored SVG (scalable,
themeable, < 1 KB).

| Concept | Idea | Character | Reads best as |
|---------|------|-----------|---------------|
| **A · [Rising Door](assets/logo/concept-a-rising-door.svg)** | A navy doorway/portal framing a gold rising figure — *a door opening = access; a person rising = the student* | The most **human** | The dual meaning we keep telling — opportunity + the person |
| **B · [The Link](assets/logo/concept-b-link.svg)** | Two interlocking links — navy (the fund) + gold (the student) — connected | The most **literal** | "Funds**Link**" made visible; connective, balanced |
| **C · [Ascending](assets/logo/concept-c-ascending.svg)** | Three growth bars cresting in a gold summit + spark | The most **fintech** | Growth, funding, the goal reached |

### Recommendation
**Concept A (Rising Door).** It carries the exact story the whole platform tells — *a door of access,
a person rising* — in one clean mark; it's warm without being soft, institutional without being cold,
and it reads at 16px. **B** is the safe, literal runner-up (great if you want the name spelled in the
mark); **C** leans most "finance dashboard" and least human.

**✅ Chosen: Concept A — Rising Door** (Founder L4, 2026-06-20), **strengthened to Rising Door v2**
(Founder direction, 2026-09-13 — see §0 above). v1 masters are kept in
[`assets/logo/archive/`](assets/logo/archive/); the `concept-*.svg` files remain as the concept archive.

## 2. Construction & usage

- **Clear space:** keep padding ≥ the height of the mark's "x-height" element (≈ 25% of the mark) on
  all sides; never crowd it.
- **Minimum size:** mark 16px (favicon); full lockup 120px wide. Below that, mark only.
- **Lockup:** mark + wordmark. Wordmark = **IBM Plex Sans Semibold** — "Funds" navy, "Link" gold,
  "ACADEMY" in muted small-caps with letter-spacing (see the gallery). Horizontal lockup is primary;
  a stacked lockup (mark over wordmark) is the secondary for square spaces.
- **Favicon / app icon:** the mark on a transparent (or navy, for maskable) background.

## 3. Variants (ship all)

| Variant | Use |
|---------|-----|
| Full-colour (navy + gold) | Default, on light surfaces |
| Reversed | On navy/dark surfaces — navy parts become white/ivory, gold stays gold |
| Monochrome | One-colour contexts (navy on light, white on dark) — use `currentColor` so it themes |
| Maskable | PWA/app-icon safe-zone padded |

All variants are derived from the chosen concept SVG; the build engineer exports them into
`apps/web/src/assets/logo/`.

## 4. Brand colour (from the design system)

Navy `#1b2c4d` (trust/structure) · Gold `#f59e0b` (hope/opportunity) · warm-slate neutrals + ivory
whitespace. Full token table: [design-system.md §2](design-system.md). Gold is for *hopeful*
moments — never for errors.

## 5. Brand voice

The voice the [notification templates](../../apps/api/app/modules/notification/worker.py) already
speak, written down:

- **Dignified, never bureaucratic** (P1). The reader is a capable adult in a hard moment.
- **Warm, plain, direct.** Short sentences; no jargon; no idioms that don't translate (P7).
- **Never a dead end** (P2). Every message — even bad news — offers a real next step.
- **Humans are visible** (P5): *"a person reviews every application."*
- **Honest** (P3): say what we know, when, and the source; never imply omniscience.
- **A return is help, not failure** (P4): "a few small things to add," never "you failed."

Tagline candidates (for your pick): *"Funding that finds you." · "The bridge past the cracks." ·
"Every student, seen."*

## 6. Logo don'ts

- ❌ Recolour outside navy / silver / gold, add gradients beyond the mark's own gold ramp and doorway light, or AI purple/pink.
- ❌ Redraw the cap — it is Lucide's `graduation-cap`; change its placement, not its shape.
- ❌ Hand-edit a logo file — change `scripts/build-logo.mjs` and regenerate.
- ❌ Stretch, rotate, add shadows/bevels, or place on a busy photo without a scrim.
- ❌ Recreate the mark in a different weight/proportion; always use the master SVG.
- ❌ Emoji or clip-art substitutes.

## 7. Decisions

**✅ The Rising Door, strengthened — Founder direction, 2026-09-13.** Concept unchanged. The figure
became three lit silver steps and Lucide's graduation cap in gold (at 38% scale, after "the cap is too big";
colours chosen from six options); the
mark is weighted for small sizes; the header plate is larger; every file is generated from one
geometry.

**✅ DECIDED — Concept A (Rising Door), Founder (L4), 2026-06-20.** Canonical mark:
[`logo-mark.svg`](assets/logo/logo-mark.svg) + [`logo-mark-mono.svg`](assets/logo/logo-mark-mono.svg).
Favicon = the mark; the wordmark lockup is composed in the header component (mark + IBM Plex Sans
Semibold — "Funds" navy, "Link" gold, "ACADEMY" muted small-caps), per the gallery. The build
engineer exports the four variants (full-colour / reversed / mono / maskable) into
`apps/web/src/assets/logo/`. The design package now moves to **components (#4)**.
