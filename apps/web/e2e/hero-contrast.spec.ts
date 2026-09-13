import { expect, test, type Page } from '@playwright/test';
import { startStaticServer } from './serve-dist';

/**
 * Hero text keeps WCAG AA contrast over the photograph — MEASURED, not assumed.
 *
 * The design's rule for the hero is that "text must never fight the image" (marketing-site.md
 * §3.1). With a flat navy field that was a token pairing and axe could check it. Over a
 * photograph it cannot: axe reports text over a background image as "needs review", and so does
 * Lighthouse. A scrim change, a new crop, or a brighter image could quietly put body copy over the
 * glowing doorway and nothing would fail.
 *
 * So this measures what a person actually sees behind each line of text:
 *   1. record every text line in the hero — its box, its colour, whether it counts as large;
 *   2. hide all the text and screenshot the composited background (photo + scrim + glow + grid);
 *   3. for each line, take the brightest background pixels under it (98th percentile — near the
 *      worst case, without letting one anti-aliased pixel decide) and compute the WCAG ratio;
 *   4. require 4.5:1 for normal text and 3:1 for large text (WCAG 1.4.3).
 *
 * Text on its own OPAQUE surface (the gold button) is excluded: it is not over the photograph, and
 * its pairing is covered by the design tokens. The application card is deliberately NOT excluded —
 * it is translucent glass over the photo, so its text is measured like everything else.
 *
 * It runs against the PRODUCTION build at a phone and a desktop size, because the two use
 * different crops and the phone puts text across the full width of the image.
 */

// The darkest stop of .fl-text-gold's gradient (surfaces.css). Gradient text has a transparent
// fill, so its computed colour says nothing; the darkest stop is its worst case on a dark field.
const GOLD_DARKEST = { r: 232, g: 122, b: 12 };

const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'laptop', width: 1280, height: 800 },
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'wide', width: 1920, height: 1080 },
];

let stop: (() => void) | undefined;
let origin = '';

test.beforeAll(async () => {
  const { server, port } = await startStaticServer(4397);
  origin = `http://127.0.0.1:${port}`;
  stop = () => server.close();
});

test.afterAll(() => stop?.());

interface Line {
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rgb: { r: number; g: number; b: number };
  large: boolean;
}

async function textLines(page: Page): Promise<Line[]> {
  return page.evaluate((gold) => {
    const hero = document.querySelector('.fl-hero') as HTMLElement;
    const lines: Line[] = [];

    const ownsOpaqueSurface = (start: Element): boolean => {
      for (let el: Element | null = start; el && el !== hero; el = el.parentElement) {
        const s = getComputedStyle(el);
        const bg = s.backgroundColor.match(/[\d.]+/g)?.map(Number) ?? [];
        const alpha = bg.length === 4 ? bg[3] : bg.length === 3 ? 1 : 0;
        if (alpha >= 0.9) return true;
        if (s.backgroundImage.includes('gradient') && !el.classList.contains('fl-text-gold')) {
          return true;
        }
      }
      return false;
    };

    const walker = document.createTreeWalker(hero, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const content = node.textContent?.trim() ?? '';
      const parent = node.parentElement;
      if (!content || !parent || ownsOpaqueSurface(parent)) continue;
      const style = getComputedStyle(parent);
      if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) {
        continue;
      }
      // Skip visually hidden text (sr-only) — nobody sees it, so nobody reads it over the image.
      const box = parent.getBoundingClientRect();
      if (box.width <= 1 || box.height <= 1) continue;

      const isGold = parent.closest('.fl-text-gold') !== null;
      const [r, g, b] = (style.color.match(/[\d.]+/g) ?? ['0', '0', '0']).map(Number);
      const size = parseFloat(style.fontSize);
      const weight = Number(style.fontWeight);
      const large = size >= 24 || (size >= 18.66 && weight >= 700);

      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of Array.from(range.getClientRects())) {
        if (rect.width < 2 || rect.height < 2) continue;
        lines.push({
          text: content.slice(0, 40),
          x: rect.x,
          y: rect.y,
          w: rect.width,
          h: rect.height,
          rgb: isGold ? gold : { r, g, b },
          large,
        });
      }
    }
    return lines;
  }, GOLD_DARKEST);
}

async function hideText(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `
      .fl-hero, .fl-hero * {
        color: transparent !important;
        -webkit-text-fill-color: transparent !important;
        text-shadow: none !important;
      }
      .fl-hero .fl-text-gold { background: none !important; }
    `,
  });
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance({ r, g, b }: { r: number; g: number; b: number }): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

for (const viewport of VIEWPORTS) {
  test(`hero text holds AA over the photograph — ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    // Reduced motion BEFORE the first load: reveal animations would otherwise be measured
    // mid-fade, with text boxes that have not arrived where they will end up.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`${origin}/`, { waitUntil: 'networkidle' });

    // Two races, both found by an intermittent failure rather than by reading:
    //  - the image: measured before it paints, the "background" is the navy placeholder and
    //    every ratio is flattering and meaningless;
    //  - web fonts: with font-display: swap a line can be measured in the fallback face and
    //    screenshotted after IBM Plex arrives, so the box and the pixels no longer line up.
    // Wait for both to be final before recording a single box.
    await expect
      .poll(
        () =>
          page.evaluate(async () => {
            await document.fonts.ready;
            const img = document.querySelector<HTMLImageElement>('.fl-hero img');
            return !!img && img.complete && img.naturalWidth > 0;
          }),
        { timeout: 20_000 },
      )
      .toBe(true);
    // One more frame, so layout reflects the final fonts.
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve(null))));

    const lines = await textLines(page);
    expect(lines.length, 'no hero text found — the measurement would prove nothing').toBeGreaterThan(5);

    await hideText(page);
    // Let the style change paint before capturing what is behind the text.
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve(null))));
    const shot = await page.screenshot({ type: 'png' });

    const results = await page.evaluate(
      async ({ png, lines: measured }) => {
        const blob = await (await fetch(`data:image/png;base64,${png}`)).blob();
        const bitmap = await createImageBitmap(blob);
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(bitmap, 0, 0);
        const scale = bitmap.width / window.innerWidth;

        const lin = (c: number) => {
          const s = c / 255;
          return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        };

        return measured.map((line) => {
          const x = Math.max(0, Math.floor(line.x * scale));
          const y = Math.max(0, Math.floor(line.y * scale));
          const w = Math.max(1, Math.min(bitmap.width - x, Math.ceil(line.w * scale)));
          const h = Math.max(1, Math.min(bitmap.height - y, Math.ceil(line.h * scale)));
          const data = ctx.getImageData(x, y, w, h).data;
          const lums: number[] = [];
          for (let i = 0; i < data.length; i += 4) {
            lums.push(0.2126 * lin(data[i]) + 0.7152 * lin(data[i + 1]) + 0.0722 * lin(data[i + 2]));
          }
          lums.sort((a, b) => a - b);
          return {
            bgLum98: lums[Math.floor(lums.length * 0.98)] ?? 0,
            bgLumMax: lums[lums.length - 1] ?? 0,
          };
        });
      },
      { png: shot.toString('base64'), lines },
    );

    const report = lines.map((line, i) => {
      const fg = luminance(line.rgb);
      const bg = results[i].bgLum98;
      const [hi, lo] = fg > bg ? [fg, bg] : [bg, fg];
      const ratio = (hi + 0.05) / (lo + 0.05);
      const needed = line.large ? 3 : 4.5;
      return { text: line.text, ratio: Math.round(ratio * 100) / 100, needed, pass: ratio >= needed };
    });

    const worst = [...report].sort((a, b) => a.ratio - a.needed - (b.ratio - b.needed)).slice(0, 4);
    // eslint-disable-next-line no-console -- the lowest ratios are the evidence
    console.log(
      `[contrast:${viewport.name}] lowest: ` +
        worst.map((r) => `"${r.text}" ${r.ratio}:1 (needs ${r.needed})`).join(' · '),
    );

    const failures = report.filter((r) => !r.pass);
    expect(failures, `text below WCAG AA over the hero image at ${viewport.name}`).toEqual([]);
  });
}
