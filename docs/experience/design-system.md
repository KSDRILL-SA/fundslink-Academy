# Design System — tokens & foundations

The single source of visual truth for FundsLink Academy: the design tokens, type, spacing, motion,
and the accessibility/performance budget that make every screen feel **premium yet load light**.
Direction: **"Trusted Institution, humanised"** — navy authority + grid precision (trust, safe with
money) warmed by an amber/gold accent for hope-moments. Design-only; tokens fill `styles/tokens.css`
([frontend-structure.md](frontend-structure.md)) at build.

> Grounded in [ADR-005](../decisions/adr-0005-frontend-strategy.md) (Tailwind + custom CSS, **tokens
> as CSS custom properties in the shadcn/spartan HSL convention**, S4.13–S4.16) and the UI/UX design
> intelligence (style **"Accessible & Ethical"**, pattern **"Enterprise Gateway"**, type **IBM Plex
> Sans**, navy/gold palette). Obeys the emotional-design law ([ux-screen-map §0](ux-screen-map.md), P1–P8).

## 1. Principles — premium *and* lightweight

- **Premium via craft, not weight.** One type family, CSS-driven effects, no hero videos, no heavy
  JS. It *feels* like a R-million product and *loads* like a static page (P6 low-bandwidth).
- **Accessible & ethical by default.** WCAG 2.2 AA minimum (AAA contrast where feasible), 16px+
  body, visible focus, 44px targets, reduced-motion honoured. Accessibility is the *brand*.
- **Tokens only.** Components consume semantic tokens, never raw hex (S4.16). Light + dark designed
  together.
- **Navy = trust/structure. Gold = hope/warmth.** Navy frames; gold lifts the human moments.

## 2. Color system (shadcn/spartan HSL convention)

Values are `H S% L%` triplets (used as `hsl(var(--token))`). Verified for WCAG AA on their intended
pairings.

### Light (default)
```css
:root {
  --background: 0 0% 100%;          --foreground: 222 47% 11%;   /* near-navy ink, ~16:1 */
  --card: 0 0% 100%;                --card-foreground: 222 47% 11%;
  --popover: 0 0% 100%;             --popover-foreground: 222 47% 11%;
  --primary: 222 47% 20%;           --primary-foreground: 210 40% 98%;   /* navy btn, white text ~13:1 */
  --secondary: 215 28% 95%;         --secondary-foreground: 222 47% 20%;
  --muted: 215 28% 95%;             --muted-foreground: 215 16% 42%;     /* ~5.3:1 on white (AA) */
  --accent: 38 92% 50%;             --accent-foreground: 222 47% 11%;    /* gold, navy text ~8:1 */
  --success: 142 64% 30%;           --success-foreground: 0 0% 100%;     /* forest, white ~5.4:1 */
  --warning: 32 95% 44%;            --warning-foreground: 0 0% 100%;
  --destructive: 0 72% 45%;         --destructive-foreground: 0 0% 100%; /* deep red, white ~5.9:1 */
  --border: 215 20% 88%;            --input: 215 20% 88%;
  --ring: 222 47% 25%;              /* navy focus ring */
  --radius: 0.625rem;               /* ~10px — "just rounded enough" */
}
```

### Dark (tonal, not inverted)
```css
.dark {
  --background: 222 47% 9%;         --foreground: 210 40% 96%;
  --card: 222 44% 12%;              --card-foreground: 210 40% 96%;
  --popover: 222 44% 12%;           --popover-foreground: 210 40% 96%;
  --primary: 213 84% 65%;           --primary-foreground: 222 47% 11%;   /* lightened trust-blue on navy */
  --secondary: 217 33% 18%;         --secondary-foreground: 210 40% 96%;
  --muted: 217 33% 18%;             --muted-foreground: 215 20% 70%;     /* secondary text ~ AA on dark */
  --accent: 38 92% 52%;             --accent-foreground: 222 47% 11%;
  --success: 142 60% 42%;           --success-foreground: 222 47% 11%;
  --warning: 38 92% 55%;            --warning-foreground: 222 47% 11%;
  --destructive: 0 72% 55%;         --destructive-foreground: 210 40% 98%;
  --border: 217 33% 22%;            --input: 217 33% 24%;
  --ring: 213 84% 65%;
}
```

**Usage rules:** `primary` (navy) = the serious institutional action. `accent` (gold) = warm,
hopeful highlights — the "See your matched bursaries" CTA, active nav, the logo mark, success moments
(never for errors). `destructive` only for irreversible actions, always paired with an icon + text
(`color-not-only`). Functional color never carries meaning alone.

## 3. Typography — IBM Plex Sans (one family)

Financial-grade grotesk, free, variable, subsettable. Headings and body share the family; hierarchy
comes from **weight + size + spacing**, not a second font (lighter payload).

```css
--font-sans: "IBM Plex Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
```
- **Load light:** self-host or Google Fonts, **subset to Latin**, `font-display: swap`, **preload
  only weights 400 + 600**; the rest lazy. No FOIT.
- **Weights:** 400 body · 500 labels/UI · 600 headings · 700 display.
- **Type scale (rem):** `0.75 · 0.875 · 1 · 1.125 · 1.25 · 1.5 · 1.875 · 2.25 · 3 · 3.75`
  (caption → small → **body 16px** → lead → h5 → h4 → h3 → h2 → h1 → display).
- **Body:** 16px min (no iOS auto-zoom), line-height **1.6**, measure **65–75ch** (35–60 on mobile).
- **Numbers:** tabular figures (`font-feature-settings: "tnum"`) for money, tables, timers — no
  layout shift. Money is rendered from the decimal string, never `parseFloat`.

## 4. Spacing, radii, elevation

- **Spacing:** 4px base, 8px rhythm — `4 8 12 16 24 32 48 64 96` (Tailwind's default scale; use it).
  Generous whitespace is part of the premium + the humanity.
- **Radii:** `--radius: 0.625rem`; derive `sm = radius-4px`, `md = radius-2px`, `lg = radius`,
  `xl = radius+4px` (spartan pattern). Just-rounded — warm, not bubbly; not sharp/cold.
- **Elevation (navy-tinted, subtle — 5 steps):**
  ```css
  --shadow-xs: 0 1px 2px 0 hsl(222 47% 11% / 0.04);
  --shadow-sm: 0 1px 3px 0 hsl(222 47% 11% / 0.08), 0 1px 2px -1px hsl(222 47% 11% / 0.08);
  --shadow-md: 0 4px 12px -2px hsl(222 47% 11% / 0.10);
  --shadow-lg: 0 12px 28px -6px hsl(222 47% 11% / 0.12);
  --shadow-xl: 0 24px 48px -12px hsl(222 47% 11% / 0.16);
  ```
  One consistent scale for cards/sheets/modals — never random shadow values.

## 5. Motion (restrained, meaningful, reduced-motion-safe)

```css
--motion-fast: 150ms;   --motion-base: 200ms;   --motion-enter: 300ms;   --motion-exit: 140ms;
--ease-out: cubic-bezier(0.16, 1, 0.3, 1);   --ease-in: cubic-bezier(0.4, 0, 1, 1);
```
- Micro-interactions 150–300ms; **animate `transform`/`opacity` only** (never width/height/top/left).
- Ease-out on enter, ease-in on exit; **exit ~60–70% of enter**. Max 1–2 animated elements per view.
- Every animation conveys cause→effect (Magic/Aceternity effects reproduced in Angular animations).
- **`@media (prefers-reduced-motion: reduce)` → durations ~0, no parallax** — non-negotiable (P6 + a11y).

## 6. Iconography & imagery

- **SVG icons only — Lucide** (one set, stroke 1.5–2, sizes 16/20/24 as tokens). **Never emoji** as
  structural icons.
- **Imagery:** real, warm photography of SA students (dignity, not stock-cold); **AVIF/WebP**,
  responsive `srcset`, `width/height` declared (no CLS), lazy below the fold. No hero videos (P6).

## 7. Accessibility & performance budget (the "world-class" is *measured*)

| Budget | Target |
|--------|--------|
| Contrast | WCAG 2.2 **AA** (4.5:1 text / 3:1 large+UI); AAA where feasible |
| Focus | Visible ring (3px, `--ring`), never removed; logical tab order |
| Targets | ≥ 44×44px; 8px min gap |
| Motion | `prefers-reduced-motion` honoured everywhere |
| axe | **Zero** serious/critical violations (CI a11y gate, Stage 05) |
| Lighthouse | **≥ 95** Performance & Accessibility |
| Core Web Vitals | LCP < 2.5s · CLS < 0.1 · INP < 200ms (on a mid SA mobile + 3G) |

## 8. Tailwind wiring (no duplication — S4.15)

`tailwind.config.ts` maps the scale to the tokens — one source of truth:
```ts
colors: {
  background: 'hsl(var(--background))', foreground: 'hsl(var(--foreground))',
  primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
  accent:  { DEFAULT: 'hsl(var(--accent))',  foreground: 'hsl(var(--accent-foreground))' },
  // …secondary, muted, success, warning, destructive, border, input, ring
},
borderRadius: { lg: 'var(--radius)', md: 'calc(var(--radius) - 2px)', sm: 'calc(var(--radius) - 4px)' },
```
Tailwind = layout/spacing/responsive; component CSS = brand/complex; **no value lives in both**.

## 9. Anti-patterns (do NOT)

- ❌ Playful/childish styling, or AI **purple/pink gradients** (cheapens the trust).
- ❌ Emoji as icons; raster icons; raw hex in components.
- ❌ Gray-on-gray text; body < 16px; focus rings removed.
- ❌ Color as the *only* signal; unclear money/fees; animating layout properties.
- ❌ A second font family "for flair" — hierarchy is weight + size, not fonts.

## 10. What consumes this

`component-library.md` (every component reads these tokens) · `navigation-and-shells.md` ·
`marketing-site.md` · `brand-identity.md` (the palette's brand rationale + the logo). The build
engineer writes these tokens into `apps/web/src/styles/tokens.css` and wires `tailwind.config.ts`
before building any screen.
