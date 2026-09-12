import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Nothing inside a signed-in account may be invented.
 *
 * The Founder's instruction: *"nothing shall be hardcoded or not from the
 * database anywhere inside any account"*. On a platform that tells people
 * whether their studies will be funded, a figure that did not come from the
 * server is not a placeholder — it is a statement about someone's money that
 * nobody can stand behind.
 *
 * This gate draws the line where it actually falls. Account screens contain two
 * kinds of text, and only one of them is data:
 *
 *   - **Data** — a name, an amount, a date, a status, a count, a document, a
 *     bursary. It must arrive through `ApiService`. Never typed into a
 *     template.
 *   - **Language** — labels, explanations, the words a status is rendered as,
 *     the reasons a category exists, help text. It is written by us on purpose
 *     and belongs in the code, because it is not a fact about the student.
 *
 * So the test looks for the specific shapes that only data takes: currency
 * amounts, calendar dates, percentages, and the fixture names used in specs.
 * It cannot catch every possible invented value — but it catches the ones that
 * have ever actually appeared in a codebase, and it fails loudly the first time
 * someone types a rand figure into a screen.
 */

const FEATURES = __dirname;

/** Screens a signed-in person sees. Marketing pages are argument, not account. */
function accountScreens(): { file: string; source: string }[] {
  const found: { file: string; source: string }[] = [];

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!full.endsWith('.ts') || full.endsWith('.spec.ts')) {
        continue;
      }
      found.push({ file: full.replace(FEATURES, 'features'), source: readFileSync(full, 'utf8') });
    }
  };

  walk(FEATURES);
  return found;
}

const SCREENS = accountScreens();

/** Only the part of a file a user can actually see. */
function templateOf(source: string): string {
  const start = source.indexOf('template: `');
  if (start === -1) {
    return '';
  }
  const end = source.indexOf('`,', start + 11);
  return source.slice(start + 11, end === -1 ? undefined : end);
}

/** Interpolations and comments are not literal text: `{{ x }}` is server data. */
function literalText(template: string): string {
  return template
    .replace(/\{\{[^}]*\}\}/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/\[[^\]=]*\]="[^"]*"/g, ' ');
}

describe('account screens render data, never invent it', () => {
  it('finds the screens to check', () => {
    // Guards against the whole suite passing because the scan broke.
    expect(SCREENS.length).toBeGreaterThan(10);
    expect(SCREENS.map((s) => s.file).join(' ')).toContain('dashboard');
  });

  it.each(SCREENS)('$file has no hardcoded money', ({ source }) => {
    // "R 48 500", "R48500.00", "ZAR 12 000" — an amount is always the server's.
    const template = literalText(templateOf(source));
    expect(template).not.toMatch(/\b(R|ZAR)\s?\d[\d\s,]*(\.\d{2})?\b/);
  });

  it.each(SCREENS)('$file has no hardcoded dates', ({ source }) => {
    const template = literalText(templateOf(source));
    // An ISO date or a written one. A deadline nobody set is a deadline that
    // will be missed.
    expect(template).not.toMatch(/\b20\d{2}-\d{2}-\d{2}\b/);
    expect(template).not.toMatch(
      /\b\d{1,2}\s(January|February|March|April|May|June|July|August|September|October|November|December)\b/,
    );
  });

  it.each(SCREENS)('$file states no percentage or score', ({ source }) => {
    // A match score rendered as "87%" reads as a probability of being funded,
    // which is exactly what it is not (BR-M02).
    const template = literalText(templateOf(source));
    expect(template).not.toMatch(/\b\d{1,3}\s?%/);
  });

  it.each(SCREENS)('$file carries no fixture identity', ({ source }) => {
    // The preview student. If one of these ever appears in a screen rather than
    // in a spec or the dev-only fixtures, a real person is being shown someone
    // else's name.
    expect(source).not.toMatch(/\b(Thandi|Mokoena|preview@fundslink)\b/);
  });

  it('reaches the server only through ApiService', () => {
    // A screen that called fetch() directly would bypass the auth interceptor
    // and the error normalisation, and its data would not be the account's.
    for (const { file, source } of SCREENS) {
      expect(source, `${file} must not call fetch() directly`).not.toMatch(/\bfetch\s*\(/);
      expect(source, `${file} must not use XMLHttpRequest`).not.toContain('XMLHttpRequest');
    }
  });
});
