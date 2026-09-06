import axe, { type ElementContext, type RunOptions, type Result } from 'axe-core';

/**
 * Accessibility assertions, run in the harness rather than remembered for G4.
 *
 * G4 requires WCAG 2.2 AA with zero serious/critical axe violations
 * (design-system.md §7). A manual pass at gate time is a rule held in memory;
 * running axe on every rendered component makes it a gate (doctrine L5).
 *
 * **What this cannot check.** jsdom has no layout or paint engine, so axe's
 * `color-contrast` rule cannot run here — it needs computed pixel colours.
 * Contrast is therefore held two other ways: the token pairings carry their
 * measured ratios in design-system.md §2, and G4 runs axe in a real browser
 * where the rule does work. Disabling it here is honest about the tool's
 * limits; silently letting it report "passed" would not be.
 */
const RULES_UNAVAILABLE_IN_JSDOM = ['color-contrast'];

/** Only WCAG A/AA — the bar the product is actually held to. */
const WCAG_AA_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

export interface A11yFailure {
  readonly id: string;
  readonly impact: string;
  readonly help: string;
  readonly nodes: readonly string[];
}

/**
 * Run axe over an element and return only the violations that matter.
 *
 * `serious` and `critical` are the G4 bar. `minor` and `moderate` are reported
 * by the caller if wanted but do not fail — a gate that fails on everything is
 * a gate people switch off.
 */
export async function findA11yViolations(
  element: ElementContext,
  options: RunOptions = {},
): Promise<A11yFailure[]> {
  const results = await axe.run(element, {
    runOnly: { type: 'tag', values: WCAG_AA_TAGS },
    rules: Object.fromEntries(
      RULES_UNAVAILABLE_IN_JSDOM.map((rule) => [rule, { enabled: false }]),
    ),
    ...options,
  });

  return results.violations
    .filter((violation: Result) => violation.impact === 'serious' || violation.impact === 'critical')
    .map((violation: Result) => ({
      id: violation.id,
      impact: violation.impact ?? 'unknown',
      help: violation.help,
      nodes: violation.nodes.map((node) => node.html),
    }));
}

/** A readable failure message — the rule, why it matters, and the offending markup. */
export function describeViolations(failures: readonly A11yFailure[]): string {
  return failures
    .map((f) => `[${f.impact}] ${f.id}: ${f.help}\n    ${f.nodes.join('\n    ')}`)
    .join('\n');
}
