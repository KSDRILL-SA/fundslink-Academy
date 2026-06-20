# Brand Identity — logo, marks & voice

The brand layer that sits on the [design system](design-system.md): the logo (three concepts to
choose from), its construction and usage, and the brand voice. Direction: **"Trusted Institution,
humanised"** — navy authority + amber/gold warmth.

> Grounded in [design-system.md](design-system.md) (navy `#1b2c4d` / gold `#f59e0b`, IBM Plex Sans)
> and the logo design intelligence (Finance + Education → navy+gold, combination mark, trustworthy,
> **avoid trendy/playful**). The student voice extends the emotional-design law
> ([ux-screen-map §0](ux-screen-map.md), P1–P8) and the notification copy already shipped.

## 1. The logo — three concepts

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
mark); **C** leans most "finance dashboard" and least human. *Your pick decides; I then refine the
chosen mark to pixel-perfection and set it canonical.*

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

- ❌ Recolour outside navy/gold, add gradients, or AI purple/pink.
- ❌ Stretch, rotate, add shadows/bevels, or place on a busy photo without a scrim.
- ❌ Recreate the mark in a different weight/proportion; always use the master SVG.
- ❌ Emoji or clip-art substitutes.

## 7. Decision

**Founder (L4) picks A, B, or C** (open the gallery). On your word, I finalise the chosen mark
(refined geometry, the four variants, favicon set) and mark it canonical here — then the design
package moves to components (#4).
