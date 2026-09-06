import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The stylesheet entry contract (Tailwind 4, CSS-first).
 *
 * This suite exists because of a real failure caught during the foundation
 * build: with the local `@import` statements placed BELOW the Tailwind entry,
 * the bundler emitted a warning, dropped them, and still exited 0. The build
 * was green and the entire brand palette was missing from the output — no
 * token, no font face, no focus ring. Nothing else in CI would have noticed;
 * it renders as an unstyled page in front of a user.
 *
 * So the ordering rule is a gate, not a comment (doctrine L5).
 */
const raw = readFileSync(join(__dirname, '..', 'styles.css'), 'utf8');

/**
 * Comments are stripped before any positional check. The file's own comment
 * explains this rule and therefore contains the words it is asserting about —
 * without this, the test reads the explanation as the code and fails itself.
 */
const stylesCss = raw.replace(/\/\*[\s\S]*?\*\//g, '');

/** Order is meaningful: tokens define the values theme.css maps, and base.css
 *  @applies utilities that only exist once the theme is mapped. */
const LOCAL_IMPORTS = [
  './styles/fonts.css',
  './styles/tokens.css',
  './styles/theme.css',
  './styles/base.css',
] as const;

const themeCss = readFileSync(join(__dirname, 'theme.css'), 'utf8');

describe('styles.css entry', () => {
  it('imports Tailwind first', () => {
    expect(stylesCss).toContain("@import 'tailwindcss';");
    expect(stylesCss.indexOf("@import 'tailwindcss';")).toBe(stylesCss.indexOf('@import'));
  });

  it.each(LOCAL_IMPORTS)('imports %s', (path) => {
    expect(stylesCss).toContain(`@import '${path}';`);
  });

  it('keeps the local imports in dependency order', () => {
    const positions = LOCAL_IMPORTS.map((path) => stylesCss.indexOf(`@import '${path}';`));
    const sorted = [...positions].sort((a, b) => a - b);
    expect(positions, 'tokens must precede theme, and base.css must come last').toEqual(sorted);
  });

  it('contains nothing but @import statements', () => {
    // Tailwind 4 resolves @import itself, but only while they remain the whole
    // file. A stray rule here would push the imports out of position and
    // reintroduce the silent-drop failure this suite was written for.
    const meaningful = stylesCss
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    expect(meaningful.every((line) => line.startsWith('@import'))).toBe(true);
  });
});

describe('theme.css', () => {
  it('uses @theme inline, not bare @theme', () => {
    // The single most breakable line in the styling setup. Without `inline`,
    // Tailwind resolves each colour at build time and bakes the LIGHT value
    // into every utility — `.dark` then overrides the semantic token and
    // changes nothing, because bg-primary is already a literal. Dark mode
    // fails silently and only in the built output.
    expect(themeCss).toContain('@theme inline');
  });

  it('declares the dark variant as a class, matching ThemeService', () => {
    // ThemeService and the no-flash resolver both toggle `.dark` on <html>.
    // A media-query variant here would ignore an explicit light choice made on
    // a device set to dark.
    expect(themeCss).toContain('@custom-variant dark');
    expect(themeCss).toContain('.dark');
  });

  it('declares libs/ as a template source', () => {
    // libs/ sits beside src/ in the workspace. If it is not scanned, every
    // utility used only inside libs/ui silently vanishes from the bundle.
    expect(themeCss).toContain('@source "../../libs"');
  });

  it('maps colours through var(), never to a literal', () => {
    const colorLines = themeCss.match(/--color-[a-z-]+:\s*[^;]+;/g) ?? [];
    expect(colorLines.length).toBeGreaterThan(20);
    for (const line of colorLines) {
      expect(line, `${line} must reference a token, not a literal`).toContain('var(--');
    }
  });
});
