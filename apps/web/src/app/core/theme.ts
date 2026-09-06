/**
 * Theme decision logic — deliberately framework-free.
 *
 * Kept out of theme.service.ts so it can be unit-tested without booting
 * Angular's runtime, and so the same rules can be reasoned about next to the
 * inline no-flash resolver in index.html, which cannot import anything at all.
 *
 * Design: docs/experience/design-system.md §2 (light + dark designed together).
 */

/** What the user chose. `system` defers to the operating system. */
export type ThemePreference = 'light' | 'dark' | 'system';

/** What is actually painted. `system` resolves into one of these. */
export type ResolvedTheme = 'light' | 'dark';

/** Shared with the inline resolver in index.html — both must agree or the page flashes. */
export const THEME_STORAGE_KEY = 'fl-theme';

const PREFERENCES: readonly ThemePreference[] = ['light', 'dark', 'system'];

/**
 * Narrow unknown storage input to a preference.
 *
 * Storage is user-writable and survives deploys, so a stale or tampered value
 * must degrade to the safe default rather than paint an undefined theme.
 */
export function parsePreference(value: unknown): ThemePreference {
  return PREFERENCES.includes(value as ThemePreference) ? (value as ThemePreference) : 'system';
}

/** The whole decision, as a pure function. */
export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (preference === 'system') {
    return systemPrefersDark ? 'dark' : 'light';
  }
  return preference;
}
