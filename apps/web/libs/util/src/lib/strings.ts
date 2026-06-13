/** Pure string helpers — no Angular, no I/O (testable in plain Vitest). */

const COMBINING_DIACRITICS = /[̀-ͯ]/g;

/** URL-safe slug: lowercase, accents stripped, non-alphanumerics collapsed to '-'. */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(COMBINING_DIACRITICS, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
