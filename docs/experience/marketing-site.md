# Marketing Site

The public face of FundsLink — designed so a first-time visitor *feels*, within three seconds,
"this is the most reliable place I could be," and can understand and act using only the UI. Premium
at every breakpoint, lightweight on every connection, warm in every word.

> Grounded in [ADR-005](../decisions/adr-0005-frontend-strategy.md) (marketing reproduced in
> Angular, inside the one workspace), the [marketing shell](navigation-and-shells.md),
> [design-system.md](design-system.md), [component-library.md](component-library.md), and the brand
> voice ([brand-identity.md §5](brand-identity.md)). Pattern: **"Enterprise Gateway"** + landing
> best-practice (hero → social proof → how → CTA).

## 1. Principles

- **Speaks for itself.** No manual needed — clear hierarchy, one primary action per view, plain
  words. A nervous parent and a busy donor both "get it" instantly.
- **Premium via restraint.** Generous whitespace, navy/gold, IBM Plex Sans, tasteful motion — never
  loud. Nothing reads "basic" or "template".
- **Lightweight (P6).** Separate marketing bundle (lazy, no app code), **AVIF/WebP** imagery, **no
  hero video**, system-font-first, CSS effects. Premium that loads on a R5 data bundle.
- **Trust-first & honest.** Real students (dignity, never stock-cold), clear "non-profit", visible
  POPIA/compliance. No dark patterns, no fake scarcity.

## 2. Sitemap

`Home (hero)` · `How it works` · `For students` · `For donors & partners` · `About` · `FAQ` ·
`Contact` · legal: `Privacy / POPIA` · `Terms`. All deep-linkable; all in the marketing shell.

## 3. The Home page (section by section)

### 3.1 Hero — the three-second handshake
- **Background:** one warm, dignified photograph of a real South African student (hopeful, looking
  forward — never pitiful). **AVIF/WebP**, responsive `srcset`, `width/height` set (no CLS).
- **The overlay (so text never fights the image — your rule):** a **navy gradient scrim** (e.g.
  `linear-gradient(105deg, hsl(222 47% 11% / .92) 0%, hsl(222 47% 11% / .55) 55%, transparent 100%)`)
  anchoring the text side; text lives in the **safe high-contrast zone** (left/centre), image breathes
  on the other. Result: a clear picture **and** crisp, AA-contrast text — neither wins, both shine.
- **Content:** a warm **headline** ("Funding that finds you." / "Past the cracks, into your future.")
  · one-line **subhead** (what + for whom + non-profit) · the **"I am a…" path** (Enterprise Gateway):
  **Student** → Apply · **Donor** → Give · **Partner** → Partner with us · plus a quiet secondary
  "Browse bursaries". One **primary** gold CTA; the rest subordinate.

### 3.2 Trust band
Three honest proof points (e.g. "A person reviews every application" · "Built for POPIA" · "Non-profit,
free to students"), partner/funder logos once live. No vanity metrics.

### 3.3 How it works (3 steps)
Profile → Apply → Matched & decided-by-a-human. Three premium cards with Lucide line-icons; a gold
connector; one sentence each. A "See the full journey" link → How it works page.

### 3.4 Two doors
A clean split: **For students** (warm, "you belong here", the kind-rejection promise that even a no
opens doors) · **For donors & partners** (impact, governance, transparency). Each → its page.

### 3.5 Impact / voices
Real student stories (consented), told with dignity (P1) — not poverty-tourism. Quote cards,
restrained.

### 3.6 Final CTA
A calm navy band, gold CTA: "Ready? It takes a few minutes." → Apply.

## 4. The other pages (all max-premium)
- **How it works** — the full journey with the honest SLA ("reviews take about N days"), the
  Human-Final Principle shown as a *feature* (P5), the return-is-not-rejection note (P4).
- **For students** — eligibility in plain words, what you need, the kind-rejection promise, FAQs.
- **For donors & partners** — where money goes, governance, POPIA, §18A (once live), how to fund.
- **About** — the mission (the cracks past NSFAS), the team, the constitutional/quality story (this
  *is* a differentiator — show the discipline).
- **FAQ** — accordion, plain answers, no jargon.
- **Contact** — form (component-library inputs) + the Information Officer + support channels.

## 5. Premium section toolkit (reused across pages)
Section header (eyebrow + headline + lead) · feature cards (icon/title/copy) · stat band (tabular
numbers) · two-column "image + copy" (alternating) · testimonial cards · CTA band · logo strip ·
accordion. All from [component-library.md](component-library.md), token-themed, generously spaced.

## 6. Motion (tasteful, Aceternity-reproduced in Angular)
Subtle **on-scroll reveals** (fade/translate ≤ 16px, staggered 30–50ms), a gentle hero gradient
sheen, hover lifts on cards. **All `transform`/`opacity` only, all `prefers-reduced-motion`-safe**
(reduced → content appears immediately). Max 1–2 motions per view. No parallax that disorients.

## 7. Performance, SEO & social
- **Budget:** Lighthouse ≥ 95, LCP < 2.5s (hero image preloaded + sized), CLS < 0.1, on a mid SA
  mobile. Marketing JS bundle minimal (it's mostly content).
- **SEO:** semantic headings (one `h1`), meta description, sitemap, fast = ranks. **Open Graph /
  Twitter** cards using the logo + a branded share image.
- **a11y:** the whole site keyboard + screen-reader complete; the hero image has meaningful `alt`.

## 8. Trust & compliance signals
Footer + For-donors: **non-profit (NPC/PBO/§18A once live)**, **POPIA + Information Officer**, a
privacy link, real contact. These aren't fine print — they're *why people trust us*.

## 9. What this consumes / completes
Built in `apps/web/src/app/marketing/*` inside the **marketing shell**
([navigation-and-shells.md](navigation-and-shells.md)), from the component toolkit and tokens. With
this, the design package is feature-complete; the **Stage 04 handoff** (#7) ties it together for the
build engineer.
