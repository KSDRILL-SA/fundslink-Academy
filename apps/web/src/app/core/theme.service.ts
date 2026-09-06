import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import {
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemePreference,
  parsePreference,
  resolveTheme,
} from './theme';

export {
  THEME_STORAGE_KEY,
  parsePreference,
  resolveTheme,
  type ResolvedTheme,
  type ThemePreference,
};

/**
 * Theme state for the application.
 *
 * Three-state on purpose: "system" is a real choice, not the absence of one, so
 * a student who flips their phone to dark at night gets a dark app without
 * having set anything here. An explicit light/dark choice pins the theme and
 * stops tracking the OS.
 *
 * The `.dark` class on <html> is what `darkMode: ['class']` in
 * tailwind.config.ts keys off, and what the `.dark` block in
 * styles/tokens.css overrides.
 *
 * The decision itself lives in ./theme (framework-free, unit-tested); this
 * class only wires it to the DOM.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);

  private readonly query = this.matchDark();
  private readonly systemPrefersDark = signal(this.query?.matches ?? false);

  /** The user's choice: light, dark, or follow the system. */
  readonly preference = signal<ThemePreference>(this.readStoredPreference());

  /** The theme actually painted right now. */
  readonly theme = computed<ResolvedTheme>(() =>
    resolveTheme(this.preference(), this.systemPrefersDark()),
  );

  constructor() {
    // Track the OS only while the preference is "system"; the listener is
    // always attached because the user may switch back to "system" at any time.
    this.query?.addEventListener('change', (event) => this.systemPrefersDark.set(event.matches));

    effect(() => this.apply(this.theme()));
  }

  /** Set and persist the preference. */
  set(preference: ThemePreference): void {
    this.preference.set(preference);
    try {
      this.document.defaultView?.localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // Private mode or blocked storage: the theme still applies for this
      // session, it simply will not be remembered. Never break rendering
      // over a preference that failed to save.
    }
  }

  /** Flip to the opposite of what is currently painted, pinning the choice. */
  toggle(): void {
    this.set(this.theme() === 'dark' ? 'light' : 'dark');
  }

  private apply(theme: ResolvedTheme): void {
    const root = this.document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    // Tells the browser to paint form controls, scrollbars and the address bar
    // to match — the parts of the page CSS alone does not reach.
    root.style.colorScheme = theme;
  }

  private matchDark(): MediaQueryList | null {
    return this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)') ?? null;
  }

  private readStoredPreference(): ThemePreference {
    try {
      return parsePreference(this.document.defaultView?.localStorage.getItem(THEME_STORAGE_KEY));
    } catch {
      return 'system';
    }
  }
}
