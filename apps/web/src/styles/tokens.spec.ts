import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The token contract.
 *
 * Components consume `hsl(var(--token))`; a token that is defined in `:root`
 * but forgotten in `.dark` does not fail the build — it silently renders the
 * light value on a dark ground, which is exactly the failure a human reviewer
 * misses and a screenshot hides. So the contract is enforced here instead of
 * remembered (doctrine L5).
 *
 * Source of truth: docs/experience/design-system.md §2/§4/§5.
 */
const tokensCss = readFileSync(join(__dirname, 'tokens.css'), 'utf8');

/** Every colour token must exist in BOTH themes. */
const THEMED_COLOR_TOKENS = [
  'background',
  'foreground',
  'card',
  'card-foreground',
  'popover',
  'popover-foreground',
  'primary',
  'primary-foreground',
  'secondary',
  'secondary-foreground',
  'muted',
  'muted-foreground',
  'accent',
  'accent-foreground',
  'success',
  'success-foreground',
  'warning',
  'warning-foreground',
  'destructive',
  'destructive-foreground',
  'border',
  'input',
  'ring',
] as const;

/** Structural tokens: defined once in `:root`, theme-independent. */
const ROOT_ONLY_TOKENS = [
  'radius',
  'font-sans',
  'motion-fast',
  'motion-base',
  'motion-enter',
  'motion-exit',
  'ease-out',
  'ease-in',
] as const;

function blockFor(selector: string): string {
  // Each theme is a single `selector { ... }` block inside `@layer base`.
  const start = tokensCss.indexOf(`${selector} {`);
  expect(start, `missing "${selector}" block in tokens.css`).toBeGreaterThan(-1);
  const end = tokensCss.indexOf('\n  }', start);
  return tokensCss.slice(start, end);
}

describe('design tokens', () => {
  const light = blockFor(':root');
  const dark = blockFor('.dark');

  it.each(THEMED_COLOR_TOKENS)('defines --%s in light', (token) => {
    expect(light).toContain(`--${token}:`);
  });

  it.each(THEMED_COLOR_TOKENS)('overrides --%s in dark', (token) => {
    expect(dark).toContain(`--${token}:`);
  });

  it.each(ROOT_ONLY_TOKENS)('defines --%s once, in :root', (token) => {
    expect(light).toContain(`--${token}:`);
  });

  it('keeps the full 5-step elevation scale in both themes', () => {
    for (const step of ['xs', 'sm', 'md', 'lg', 'xl']) {
      expect(light, `light --shadow-${step}`).toContain(`--shadow-${step}:`);
      expect(dark, `dark --shadow-${step}`).toContain(`--shadow-${step}:`);
    }
  });

  it('carries the locked brand hues — navy #1b2c4d, gold #f59e0b', () => {
    // The Founder-locked palette, expressed in the HSL convention:
    // navy  #1b2c4d -> 222 47% 20%   (primary, light)
    // gold  #f59e0b ->  38 92% 50%   (accent, light)
    // A drifted brand is a silent failure; pin the two hues that ARE the brand.
    expect(light).toContain('--primary: 222 47% 20%');
    expect(light).toContain('--accent: 38 92% 50%');
  });

  it('states colours as bare HSL triplets, never hex', () => {
    // `hsl(var(--token))` only composes if the token is a triplet. A hex value
    // would render as an invalid colour rather than throw, so catch it here.
    const declarations = tokensCss.match(/--(?!shadow-|font-|ease-|motion-)[a-z-]+:\s*[^;]+;/g) ?? [];
    const hex = declarations.filter((line) => line.includes('#'));
    expect(hex, `hex found in colour tokens: ${hex.join(' ')}`).toEqual([]);
  });
});
