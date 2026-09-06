import type { Config } from 'tailwindcss';

/**
 * FundsLink Academy — Tailwind configuration.
 *
 * Tailwind owns layout / spacing / responsive (S4.13). Brand identity and
 * complex patterns live in custom CSS (S4.14). This file is the MAP between
 * the two: every value here points at a CSS custom property defined in
 * `src/styles/tokens.css`, so a value exists in exactly one place (S4.15).
 *
 * Tokens use the shadcn/spartan HSL convention (`H S% L%` consumed as
 * `hsl(var(--token))`) so spartan/ui — our Angular shadcn equivalent
 * (ADR-005) — inherits the brand with no patching.
 *
 * Adding a colour? Add the token in tokens.css (light AND dark), then map it
 * here. Never hard-code a hex in this file or in a component.
 *
 * Reference: docs/experience/design-system.md §8.
 */
const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{html,ts}', './libs/**/*.{html,ts}'],
  theme: {
    container: { center: true, padding: '1rem', screens: { '2xl': '1400px' } },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
      },
      borderRadius: {
        xl: 'calc(var(--radius) + 4px)',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      // The navy-tinted elevation scale (design-system.md §4). Five steps, one
      // scale — `shadow-md`, never an invented shadow value.
      boxShadow: {
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        DEFAULT: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
      },
      fontFamily: {
        sans: 'var(--font-sans)',
      },
      // Type scale (design-system.md §3), paired with its line-height so a
      // heading cannot be sized without also being spaced.
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1.5' }],
        sm: ['0.875rem', { lineHeight: '1.5' }],
        base: ['1rem', { lineHeight: '1.6' }],
        lg: ['1.125rem', { lineHeight: '1.6' }],
        xl: ['1.25rem', { lineHeight: '1.5' }],
        '2xl': ['1.5rem', { lineHeight: '1.35' }],
        '3xl': ['1.875rem', { lineHeight: '1.3' }],
        '4xl': ['2.25rem', { lineHeight: '1.2' }],
        '5xl': ['3rem', { lineHeight: '1.1' }],
        '6xl': ['3.75rem', { lineHeight: '1.05' }],
      },
      // Motion (design-system.md §5). Animate transform/opacity only; exit is
      // ~60-70% of enter. `prefers-reduced-motion` is enforced in base.css.
      transitionDuration: {
        fast: 'var(--motion-fast)',
        base: 'var(--motion-base)',
        enter: 'var(--motion-enter)',
        exit: 'var(--motion-exit)',
      },
      transitionTimingFunction: {
        out: 'var(--ease-out)',
        in: 'var(--ease-in)',
      },
      // Readable measure (design-system.md §3): 65-75ch desktop, 35-60 mobile.
      maxWidth: {
        prose: '70ch',
        'prose-narrow': '55ch',
      },
    },
  },
  plugins: [],
};

export default config;
