import { describe, expect, it } from 'vitest';
import { buttonVariants } from './button/ui-button.component';
import { cardVariants } from './card/ui-card.component';
import { badgeVariants } from './badge/ui-badge.component';
import { cn } from '../utils/cn';

/**
 * The universal rules from component-library.md §0 that every component
 * inherits. Each of these fails silently in a screenshot: a removed focus ring
 * looks cleaner, a 36px button looks tidier, a hex colour looks identical in
 * light mode and wrong in dark.
 */

const ALL_BUTTON = (['primary', 'accent', 'secondary', 'ghost', 'destructive'] as const).map(
  (variant) => [variant, buttonVariants({ variant })] as const,
);

describe('the token rule (S4.16)', () => {
  it('has no raw hex or rgb in any variant', () => {
    const everything = [
      ...ALL_BUTTON.map(([, classes]) => classes),
      cardVariants({ variant: 'static' }),
      cardVariants({ variant: 'interactive' }),
      cardVariants({ variant: 'highlight' }),
      ...(['neutral', 'info', 'success', 'warning', 'accent', 'danger', 'outline'] as const).map(
        (tone) => badgeVariants({ tone }),
      ),
    ].join(' ');

    expect(everything).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(everything).not.toMatch(/\brgba?\(/);
  });
});

describe('button', () => {
  it('never removes the focus ring', () => {
    for (const [variant, classes] of ALL_BUTTON) {
      expect(classes, `${variant} has no visible focus`).toContain('focus-visible:outline');
      expect(classes, `${variant} focus ring is not the token`).toContain('outline-ring');
    }
  });

  it('meets the 44px target floor at the default size', () => {
    // h-11 is 44px — the accessibility floor (§0). `sm` (h-9 / 36px) exists
    // only for use inside an already-large hit area and is not the default.
    expect(buttonVariants({})).toContain('h-11');
    expect(buttonVariants({ size: 'md' })).toContain('h-11');
    expect(buttonVariants({ size: 'lg' })).toContain('h-13');
    expect(buttonVariants({ size: 'sm' })).toContain('h-9');
  });

  it('signals disabled by more than colour', () => {
    const classes = buttonVariants({});
    expect(classes).toContain('disabled:cursor-not-allowed');
    expect(classes).toContain('disabled:pointer-events-none');
  });

  it('honours reduced motion', () => {
    const classes = buttonVariants({});
    expect(classes).toContain('motion-reduce:transition-none');
    expect(classes).toContain('motion-reduce:active:scale-100');
  });

  it('animates only transform, never layout', () => {
    // Animating width/height/top/left shifts the page (design-system.md §5).
    const classes = buttonVariants({});
    expect(classes).toContain('active:scale-');
    expect(classes).not.toMatch(/\btransition-\[.*(width|height|top|left|margin|padding)/);
  });

  it('defaults to primary at md, not full width', () => {
    const classes = buttonVariants({});
    expect(classes).toContain('bg-primary');
    expect(classes).not.toContain('w-full');
  });
});

describe('card', () => {
  it('lifts without moving layout, and honours reduced motion', () => {
    const interactive = cardVariants({ variant: 'interactive' });
    expect(interactive).toContain('hover:shadow-md');
    expect(interactive).toContain('motion-reduce:transition-none');
    // The card is not focusable itself — it shows a ring when a real control
    // inside it takes focus (§3).
    expect(interactive).toContain('focus-within:outline');
  });

  it('marks a highlight with the gold accent', () => {
    expect(cardVariants({ variant: 'highlight' })).toContain('border-l-accent');
  });
});

describe('cn', () => {
  it('lets a caller override a variant class', () => {
    // This is what makes `class` a supported input rather than a coin flip
    // decided by stylesheet order.
    expect(cn('px-4', 'px-8')).toBe('px-8');
    expect(cn('bg-primary', 'bg-accent')).toBe('bg-accent');
  });

  it('keeps unrelated utilities', () => {
    expect(cn('rounded-md px-4', 'shadow-sm')).toContain('rounded-md');
    expect(cn('rounded-md px-4', 'shadow-sm')).toContain('shadow-sm');
  });

  it('drops falsy values', () => {
    expect(cn('px-4', false, null, undefined, '')).toBe('px-4');
  });
});
