import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The stylesheet entry order.
 *
 * This test exists because of a real failure caught during the foundation
 * build: with `@import './styles/tokens.css'` placed BELOW `@tailwind base`,
 * the bundler emitted a warning, dropped the imports, and still exited 0. The
 * build was green and the entire brand palette was missing from the output —
 * no token, no font face, no focus ring. Nothing that runs in CI would have
 * noticed; it renders as an unstyled page in front of a user.
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

const IMPORTED = ['./styles/fonts.css', './styles/tokens.css', './styles/base.css'] as const;

describe('styles.css entry', () => {
  it.each(IMPORTED)('imports %s', (path) => {
    expect(stylesCss).toContain(`@import '${path}';`);
  });

  it('places every @import before the first @tailwind directive', () => {
    const firstTailwind = stylesCss.indexOf('@tailwind');
    expect(firstTailwind, 'no @tailwind directive found').toBeGreaterThan(-1);

    for (const path of IMPORTED) {
      const at = stylesCss.indexOf(`@import '${path}';`);
      expect(at, `${path} is imported after @tailwind — the bundler will drop it`).toBeLessThan(
        firstTailwind,
      );
    }
  });

  it('keeps the three Tailwind directives, in layer order', () => {
    const base = stylesCss.indexOf('@tailwind base;');
    const components = stylesCss.indexOf('@tailwind components;');
    const utilities = stylesCss.indexOf('@tailwind utilities;');

    expect(base).toBeGreaterThan(-1);
    // Utilities must come last or they stop winning over base and component
    // rules, and every `text-*` override in a screen starts losing silently.
    expect(components).toBeGreaterThan(base);
    expect(utilities).toBeGreaterThan(components);
  });
});
