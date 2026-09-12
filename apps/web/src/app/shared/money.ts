/**
 * U+00A0, a non-breaking space.
 *
 * Written as an escape and named, because an invisible character sitting inside
 * quotation marks is a trap: the first version of this file used a literal one
 * and the test failure read `expected '48 500.00' to be '48 500.00'` — two
 * strings that are identical on screen and different in memory.
 */
const GAP = ' ';

/**
 * Present a money amount, without ever parsing it.
 *
 * The API sends money as a decimal **string** and it must stay one end to end
 * (DB-D29, handoff §4.4): `Number('48500.00')` is a float, and floats lose
 * cents on the amounts this product will eventually settle against a bank. So
 * this groups the digits by rewriting the string and touches nothing else — the
 * value that arrives is the value displayed, digit for digit, with separators
 * inserted between them.
 *
 * South African convention: a space between thousands, a full stop before the
 * cents. The space is non-breaking, because an amount that wraps at the end of
 * a line — "R 48" above, "500.00" below — is a different figure to anyone
 * reading quickly.
 *
 * Anything that is not a plain decimal is returned untouched. A screen showing
 * the server's value verbatim is recoverable; one that silently shows "NaN" to
 * a student waiting on money is not.
 */
export function formatAmount(value: string): string {
  const trimmed = value.trim();
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return trimmed;
  }

  const negative = trimmed.startsWith('-');
  const [whole, fraction] = trimmed.replace('-', '').split('.');
  // Group from the right, three at a time — a regex over the string, so no
  // number ever exists in this function.
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, GAP);

  return `${negative ? '-' : ''}${grouped}${fraction ? `.${fraction}` : ''}`;
}

/** The same amount with the currency the contract fixes for this product. */
export function formatRands(value: string): string {
  return `R${GAP}${formatAmount(value)}`;
}
