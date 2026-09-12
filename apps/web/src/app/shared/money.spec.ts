import { describe, expect, it } from 'vitest';
import { formatAmount, formatRands } from './money';

/**
 * Money is a string here, and these tests exist to keep it one.
 *
 * The whole risk is that somebody "simplifies" this to
 * `Number(value).toLocaleString()`, which is correct on every example a
 * developer tries by hand and wrong on the amounts that matter.
 *
 * The separator is written as ` ` throughout. An earlier version of this
 * file used a literal character and the failure read `expected '48 500.00' to
 * be '48 500.00'` — two strings that look identical in a terminal. An invisible
 * character belongs in an escape, not in a quote.
 */
const GAP = ' ';

describe('formatAmount', () => {
  it('groups thousands with a non-breaking space, the South African way', () => {
    expect(formatAmount('48500.00')).toBe(`48${GAP}500.00`);
    expect(formatAmount('1234567.89')).toBe(`1${GAP}234${GAP}567.89`);
    expect(formatAmount('999.00')).toBe('999.00');
  });

  it('keeps every digit exactly as it arrived', () => {
    // A float would round this. The string does not.
    expect(formatAmount('9007199254740993.01')).toBe(
      `9${GAP}007${GAP}199${GAP}254${GAP}740${GAP}993.01`,
    );
    // Trailing zeros are significant in an amount owed.
    expect(formatAmount('1200.50')).toBe(`1${GAP}200.50`);
    expect(formatAmount('1200.5')).toBe(`1${GAP}200.5`);
  });

  it('handles a whole number and a negative', () => {
    expect(formatAmount('350000')).toBe(`350${GAP}000`);
    expect(formatAmount('-1500.00')).toBe(`-1${GAP}500.00`);
  });

  it('returns anything unexpected untouched', () => {
    // Showing the server's value verbatim is recoverable. Showing "NaN" to a
    // student who is waiting on money is not.
    expect(formatAmount('')).toBe('');
    expect(formatAmount('unknown')).toBe('unknown');
    expect(formatAmount('1,200.00')).toBe('1,200.00');
  });

  it('never lets an amount break across a line', () => {
    // "R 48" at the end of one line and "500.00" at the start of the next is a
    // different figure to anyone skim-reading it.
    expect(formatRands('48500.00')).toBe(`R${GAP}48${GAP}500.00`);
    expect(formatRands('48500.00')).not.toContain(' ');
  });
});
