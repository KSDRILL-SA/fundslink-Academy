#!/usr/bin/env node
/**
 * The Rising Door — every logo file, generated from ONE geometry.
 *
 * Run from apps/web:  node scripts/build-logo.mjs
 *
 * Writes the master SVGs (docs/experience/assets/logo/), the served copies (apps/web/public/),
 * renders the PNG icons with the Playwright Chromium this repo already installs, and packs
 * favicon.ico. Hand-editing one SVG would let the favicon, the app icon and the header drift apart
 * the way copied artwork always does; the geometry below is the only place the mark is drawn.
 *
 * The mark — the Founder-chosen Rising Door concept, strengthened on Founder direction
 * (2026-09-13: "on top of the existing one"; "at least 3 steps"; "proper real icons, clean and
 * professional"). It is drawn in the icon language of Lucide, the icon set the product's interface
 * already uses — a 24-unit grid, rounded joins — and its graduation cap IS Lucide's `graduation-cap`
 * glyph (ISC licence), so the logo and the interface's icons are one family:
 *
 *   the doorway    — access, the door this platform opens
 *   three steps    — the climb, and (read as bars) the funding growing — in silver
 *   the cap        — graduation: where the climb leads, and the Academy — in gold
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = resolve(WEB, '..', '..');
const DOCS = join(REPO, 'docs', 'experience', 'assets', 'logo');
const PUBLIC = join(WEB, 'public');

const NAVY = '#1b2c4d';
const IVORY = '#f1f5f9';
const GOLD = { light: '#fcd34d', mid: '#f59e0b', deep: '#d97706', tassel: '#b45309' };
/**
 * The steps are silver and the cap is gold: the path in silver, the achievement in gold. Gold stays
 * the brand's colour of hope and is spent only where the climb arrives (Founder choice, 2026-09-13).
 */
const SILVER = { light: '#f1f5f9', mid: '#cbd5e1', deep: '#94a3b8', tread: '#ffffff' };

// ---- geometry, on Lucide's 24-unit grid ------------------------------------------------------
const DOOR = 'M4.5 21V10a7.5 7.5 0 0 1 15 0v11';
const DOOR_WEIGHT = 2.6;
/** Under 40 px the doorway is drawn heavier and the tread highlights are left out. */
const DOOR_WEIGHT_SMALL = 3.2;
const STEPS = 'M7.2 21v-2.5h3v-2.5h3v-2.5h3.4v7.5z';
const TREADS = 'M7.6 18.8h2.4M10.6 16.3h2.4M13.6 13.8h2.6';
const LIGHT = 'M5.8 21V10a6.2 6.2 0 0 1 12.4 0v11z';
/** Lucide `graduation-cap` (lucide 1.41, ISC): board, crown, tassel — used as drawn, only placed. */
const CAP_BOARD =
  'M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z';
const CAP_CROWN = 'M6 12.5V16a6 3 0 0 0 12 0v-3.5';
const CAP_TASSEL = 'M22 10v6';
/**
 * Seated over the top step, clear of the arch (≥ 0.8 u) and of the step (1.2 u), at 38% of
 * Lucide's size. At 50% the cap overpowered the doorway (Founder, 2026-09-13: "too big").
 */
const CAP_PLACE = 'translate(8.94 5.08) scale(0.38)';

const defs = (id, { light = false } = {}) => `
  <defs>
    <linearGradient id="${id}-gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${GOLD.light}"/>
      <stop offset="0.55" stop-color="${GOLD.mid}"/>
      <stop offset="1" stop-color="${GOLD.deep}"/>
    </linearGradient>
    <linearGradient id="${id}-silver" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${SILVER.light}"/>
      <stop offset="0.55" stop-color="${SILVER.mid}"/>
      <stop offset="1" stop-color="${SILVER.deep}"/>
    </linearGradient>${
      light
        ? `
    <radialGradient id="${id}-light" cx="12" cy="8.5" r="9" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fde68a" stop-opacity="0.55"/>
      <stop offset="0.6" stop-color="#fbbf24" stop-opacity="0.12"/>
      <stop offset="1" stop-color="#fbbf24" stop-opacity="0"/>
    </radialGradient>`
        : ''
    }
  </defs>`;

/** The mark. `ink` colours the doorway; `mono` draws it all in currentColor. */
function mark({ ink, id, light = false, mono = false, small = false }) {
  const gold = mono ? 'currentColor' : `url(#${id}-gold)`;
  const silver = mono ? 'currentColor' : `url(#${id}-silver)`;
  const crown = mono ? 'currentColor' : GOLD.deep;
  return [
    light ? `<path d="${LIGHT}" fill="url(#${id}-light)"/>` : '',
    `<path class="door" d="${DOOR}" stroke="${ink}" stroke-width="${small ? DOOR_WEIGHT_SMALL : DOOR_WEIGHT}" stroke-linecap="round" stroke-linejoin="round"/>`,
    `<path d="${STEPS}" fill="${silver}" stroke="${silver}" stroke-width="0.9" stroke-linejoin="round"/>`,
    mono || small
      ? ''
      : `<path d="${TREADS}" stroke="${SILVER.tread}" stroke-opacity="0.9" stroke-width="0.5" stroke-linecap="round"/>`,
    `<g transform="${CAP_PLACE}" stroke-linecap="round" stroke-linejoin="round">`,
    `  <path d="${CAP_BOARD}" fill="${gold}" stroke="${gold}" stroke-width="1.3"/>`,
    `  <path d="${CAP_CROWN}" fill="${crown}" stroke="${crown}" stroke-width="1.3"${mono ? ' fill-opacity="0.75" stroke-opacity="0.75"' : ''}/>`,
    `  <path d="${CAP_TASSEL}" stroke="${mono ? 'currentColor' : GOLD.tassel}" stroke-width="2.2"/>`,
    `</g>`,
  ]
    .filter(Boolean)
    .join('\n  ');
}

const svg = ({ title, desc, body }) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" role="img" aria-label="FundsLink Academy">
  <title>${title}</title>
  <desc>${desc}</desc>${body}
</svg>
`;

const FILES = {
  'logo-mark.svg': svg({
    title: 'FundsLink Academy',
    desc: 'The Rising Door: a doorway of access, three steps that rise, and a graduation cap at the top. Full colour, for light surfaces.',
    body: `${defs('flc')}
  ${mark({ ink: NAVY, id: 'flc' })}`,
  }),
  'logo-mark-reversed.svg': svg({
    title: 'FundsLink Academy — reversed',
    desc: 'The Rising Door for navy and dark surfaces: ivory doorway, silver steps, gold cap, light through the door.',
    body: `${defs('flr', { light: true })}
  ${mark({ ink: IVORY, id: 'flr', light: true })}`,
  }),
  'logo-mark-mono.svg': svg({
    title: 'FundsLink Academy — monochrome',
    desc: 'The Rising Door in one colour (currentColor), so it themes with its surroundings and prints in one ink.',
    body: `
  ${mark({ ink: 'currentColor', id: 'flm', mono: true })}`,
  }),
  'logo-mark-small.svg': svg({
    title: 'FundsLink Academy',
    desc: 'The Rising Door weighted for 16–40 px (tabs, favicons): a heavier doorway and no tread highlights. Adapts to dark mode.',
    body: `${defs('fls')}
  ${mark({ ink: NAVY, id: 'fls', small: true })}
  <style>@media (prefers-color-scheme: dark) { .door { stroke: ${IVORY}; } }</style>`,
  }),
  'logo-app-icon.svg': svg({
    title: 'FundsLink Academy — app icon',
    desc: 'The Rising Door on the navy plate, with light through the doorway: home-screen and touch icons.',
    body: `${defs('fla', { light: true })}
  <rect width="24" height="24" rx="5.6" fill="#14223f"/>
  <rect x="0.35" y="0.35" width="23.3" height="23.3" rx="5.3" fill="none" stroke="#ffffff" stroke-opacity="0.1" stroke-width="0.4"/>
  <g transform="translate(2.4 2.1) scale(0.8)">
  ${mark({ ink: IVORY, id: 'fla', light: true })}
  </g>`,
  }),
};

/** Served from public/: what the browser and devices actually fetch. */
const PUBLIC_SVGS = ['logo-mark.svg', 'logo-mark-mono.svg', 'logo-mark-small.svg', 'logo-app-icon.svg'];
const PNGS = [
  { file: 'apple-touch-icon.png', source: 'logo-app-icon.svg', size: 180 },
  { file: 'icon-192.png', source: 'logo-app-icon.svg', size: 192 },
  { file: 'icon-512.png', source: 'logo-app-icon.svg', size: 512 },
];
const ICO_SIZES = [16, 32, 48];

async function render(page, svgText, size) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${svgText.replace(
      '<svg ',
      `<svg width="${size}" height="${size}" `,
    )}</body></html>`,
  );
  return page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
}

/** An ICO whose images are PNGs — supported by every browser that still asks for favicon.ico. */
function packIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const entries = [];
  let offset = 6 + 16 * images.length;
  for (const { size, png } of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    entries.push(entry);
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)]);
}

async function main() {
  await mkdir(DOCS, { recursive: true });
  for (const [name, text] of Object.entries(FILES)) {
    await writeFile(join(DOCS, name), text);
    if (PUBLIC_SVGS.includes(name)) {
      await writeFile(join(PUBLIC, name), text);
    }
  }

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    for (const { file, source, size } of PNGS) {
      await writeFile(join(PUBLIC, file), await render(page, FILES[source], size));
    }
    const icoImages = [];
    for (const size of ICO_SIZES) {
      icoImages.push({ size, png: await render(page, FILES['logo-mark-small.svg'], size) });
    }
    await writeFile(join(PUBLIC, 'favicon.ico'), packIco(icoImages));
  } finally {
    await browser.close();
  }
  console.log(
    `logo: ${Object.keys(FILES).length} SVGs, ${PNGS.length} PNGs, favicon.ico (${ICO_SIZES.join('/')})`,
  );
}

await main();
