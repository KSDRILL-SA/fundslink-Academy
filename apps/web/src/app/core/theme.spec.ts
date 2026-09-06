import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { THEME_STORAGE_KEY, parsePreference, resolveTheme } from './theme';

describe('resolveTheme', () => {
  it('honours an explicit choice regardless of the system', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('follows the system when the preference is "system"', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });
});

describe('parsePreference', () => {
  it('accepts the three valid preferences', () => {
    expect(parsePreference('light')).toBe('light');
    expect(parsePreference('dark')).toBe('dark');
    expect(parsePreference('system')).toBe('system');
  });

  it('falls back to "system" for anything else', () => {
    // Storage is user-writable and survives deploys, so a stale or tampered
    // value must degrade to the safe default rather than paint an undefined theme.
    for (const value of [null, undefined, '', 'DARK', 'blue', 0, {}]) {
      expect(parsePreference(value)).toBe('system');
    }
  });
});

describe('the no-flash resolver in index.html', () => {
  // The inline script runs before Angular boots, so it duplicates the service's
  // decision by necessity. Duplicated logic drifts; this pins the two together
  // so a rename here fails the build instead of reappearing as a white flash
  // that only dark-mode users on slow connections ever see.
  const indexHtml = readFileSync(join(__dirname, '..', '..', 'index.html'), 'utf8');

  it('reads the same storage key as ThemeService', () => {
    expect(THEME_STORAGE_KEY).toBe('fl-theme');
    expect(indexHtml).toContain(`localStorage.getItem('${THEME_STORAGE_KEY}')`);
  });

  it('treats a missing preference as "system", matching resolveTheme', () => {
    expect(indexHtml).toContain("stored === null || stored === 'system'");
    expect(indexHtml).toContain("prefers-color-scheme: dark");
  });

  it('applies the same .dark class Tailwind and tokens.css key off', () => {
    expect(indexHtml).toContain("classList.add('dark')");
  });
});
