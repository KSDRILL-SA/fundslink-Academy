# Component Library — the premium catalogue

Every reusable UI component for FundsLink, specified so the Stage 04 build engineer produces them
**premium and accessible** from day one. Components live in `libs/ui`
([frontend-structure.md](frontend-structure.md)), consume the
[design tokens](design-system.md), and obey the emotional-design law (P1–P8).

> Base library: **spartan/ui (`@spartan-ng`)** — shadcn-for-Angular (Tailwind + Angular CDK
> primitives, copy-in). We generate spartan components, then theme them with our tokens and add the
> custom ones (avatar-upload, the navbar, the four states). No business logic in any component
> (S4.12); the frontend branches on `error.code`, never `message`.

## 0. Universal rules (every component)

- **Tokens only** — colour/space/radius/motion from variables; never raw hex.
- **States are visible & distinct** — default · hover · focus (3px `--ring`) · active · disabled
  (opacity .5 + `cursor` + semantic attr) · loading. Never remove focus rings.
- **Targets ≥ 44×44px**, ≥ 8px apart. **Lucide SVG icons** only; icon-only buttons carry `aria-label`.
- **Motion** 150–300ms, `transform`/`opacity` only, reduced-motion honoured.
- **Standalone, `OnPush`**, selector `ui-*`; inputs in, outputs out — no API calls in `libs/ui`.

## 1. Actions — Button

| Variant | Use | Token |
|---------|-----|-------|
| **primary** | The one main action per screen | navy `--primary` / white |
| **accent** | Hopeful, warm CTAs ("See your matched bursaries") | gold `--accent` / navy |
| **secondary** | Secondary actions | `--secondary` |
| **ghost / link** | Low-emphasis / inline | transparent / `--accent` text |
| **destructive** | Irreversible only — paired with icon + confirm | `--destructive` / white |

Sizes `sm / md / lg` (h 36 / 44 / 52px). **Loading:** disable + inline spinner, keep width (no
layout shift). One primary CTA per screen; others subordinate. Base: spartan `Button`.

## 2. Inputs & Forms

- **Field** = visible `<label>` (never placeholder-only) + control + helper text + error slot.
- **Controls:** text, textarea, **select**, **combobox**, checkbox, radio, **switch**, date, file.
- **Validation:** on **blur** (not keystroke); error **below the field**, `role="alert"` +
  `aria-live`; on submit, focus the first invalid field; multi-error summary links to fields.
- **Mobile:** semantic `inputmode`/`type` (email/tel/number) for the right keyboard; height ≥ 44px;
  16px text (no iOS zoom). **Password** has a show/hide toggle; `autocomplete` set.
- **Money:** decimal-string input, tabular figures, currency prefix; never `parseFloat` for logic.
- **Required** marked; **read-only ≠ disabled** (distinct styles). Base: spartan `Input/Select/Checkbox/…`.

## 3. Containers — Card

Base card (`--card`, `--border`, `--shadow-sm`, `--radius`). Variants: **static**, **interactive**
(hover lift `--shadow-md`, whole-card link with a focusable target), **stat** (tabular number +
label), **highlight** (gold left-accent for hope-moments). Slots: header / media / content / footer.
Generous padding (the premium comes from whitespace). Base: spartan `Card`.

## 4. Data — Table & List

- **Table:** sticky header, **sortable** columns (`aria-sort`), **tabular figures** for money/dates,
  row hover, zebra optional, selection checkboxes. **Responsive:** collapses to a **card list** on
  mobile (no horizontal scroll of core data).
- **Pagination:** cursor-based (`{items, meta:{next_cursor}}`) — "Load more" or pager; never offset.
- **Empty / loading / error** states are mandatory (see §7). Base: spartan `Table` + custom responsive wrapper.

## 5. Overlays — Dialog / Sheet / Popover / Tooltip

- **Dialog (desktop) / Sheet (mobile, bottom):** focus-trapped, `Esc` + close affordance + scrim
  (40–60% navy), animates from its trigger; confirm before dismissing unsaved changes.
- **Confirmation dialog** for every destructive action (danger colour, action separated from cancel).
- **Tooltip/Popover:** keyboard-reachable (not hover-only). Base: spartan `Dialog / Popover / Tooltip` (CDK overlay).

## 6. Status — Badge & Chip

Application/bursary **status chips**: colour **+ icon + text** (never colour alone, P3/WCAG).
- Approved → `--success` ✓ · Returned-for-info → `--warning` (amber, *help* not failure, P4) ·
  Under review → `--primary` · Declined → `--muted` (never harsh red on the student) · Pending → `--muted`.
- **Source badge** (P3): "You reported · From email · From partner" on tracked items.

## 7. Feedback — the four states (first-class, never afterthoughts)

| State | Spec |
|-------|------|
| **Loading** | Skeleton/shimmer (reserve layout, no CLS) for > 300ms; never a bare spinner on a blank page |
| **Empty** | Friendly line + an illustration + **one action** ("Browse bursaries") — never a dead end (P2) |
| **Error** | Plain cause + a recovery path (retry/edit/help); mapped from the stable `error.code` (S4.12) — never a raw 500 |
| **Success** | Brief, warm confirmation (toast/inline check); dignified, not gimmicky |

**Toast:** `aria-live="polite"`, doesn't steal focus, auto-dismiss 3–5s, action optional.

## 8. Media — Avatar & Profile-picture upload

- **Avatar:** circular, sizes `xs–xl`; **initials fallback** (navy bg / ivory text) when no image.
- **Upload (headshot):** drag/click → **client-side crop** to a centred square → preview;
  **magic-byte + size validation reused from the document pipeline** (ST-2.4 rules); progress + the
  four states; friendly errors ("That file's a bit big — try under 5 MB"). Custom component.

## 9. Flows — Stepper / Wizard (the application journey, P8)

Multi-step beats mega-form: a **progress indicator** (step n of N), **back** navigation, **draft
autosave** (progress survives), one concept per step, inline validation per step. Custom component
over spartan primitives.

## 10. Supporting

Tabs · Accordion · Breadcrumb (web, 3+ levels) · Progress/Spinner · Alert/Banner · Pagination ·
Skeleton · Divider — all spartan-based, token-themed, same universal rules.

## 11. Definition of "premium" (the bar every component meets)

✅ Token-driven · ✅ all six states designed · ✅ keyboard + screen-reader complete · ✅ 44px targets ·
✅ reduced-motion · ✅ light **and** dark verified · ✅ tabular numbers for data · ✅ Lucide icons ·
✅ generous whitespace. **Anti:** emoji icons, placeholder-as-label, colour-only meaning, removed
focus rings, layout-shifting press states, raw hex.

## 12. What consumes this

`navigation-and-shells.md` (composes these into the shells) · `marketing-site.md` (premium sections) ·
every feature screen (the journey, in `ux-screen-map.md`). The build engineer generates the spartan
base, applies the tokens, builds the custom components, and assembles screens from this catalogue.
