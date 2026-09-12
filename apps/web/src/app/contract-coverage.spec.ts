import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every operation the API implements is reachable from the interface.
 *
 * A Founder audit asked which parts of the system had no button. Eight did —
 * including **sign out**, which meant a session could not be ended anywhere in
 * the product, and the application **submit**, which meant no application ever
 * reached a reviewer. Each of those was implemented, contracted, generated into
 * our own types, and then simply never called.
 *
 * Nothing could see it. A route with no caller is not a compile error, and a
 * screen that does not exist has no test to fail.
 *
 * So this reads the contract's own path table and asserts that every operation
 * is either called by the application or listed below with a reason. Adding an
 * endpoint now forces a decision — build the screen, or write down why not.
 */

const APP = __dirname;
const CONTRACT = join(APP, '..', '..', 'libs', 'data-access', 'src', 'lib', 'generated', 'api-types.ts');

/**
 * Operations deliberately without a caller, and why.
 *
 * Every entry here is a claim that the product is complete without it. None of
 * them may be "we ran out of time" — that is a missing screen, not an
 * exemption.
 */
const NOT_CALLED_BY_DESIGN: Readonly<Record<string, string>> = {
  '/auth/refresh':
    'Called by the auth interceptor on a 401, never by a screen (S3.15). A button would be a button that does nothing visible.',
  '/auth/verify-email':
    'Reached from a link in an email, which lands on the verify screen — the screen calls it on load, not from a control.',
  '/auth/verify-email/resend': 'Called by the verify screen when a student asks for another link.',
  '/auth/forgot-password': 'Called by the forgot-password screen.',
  '/auth/reset-password': 'Called by the reset screen, from the emailed link.',
};

interface Operation {
  readonly path: string;
  readonly method: string;
}

/** Read the paths out of the generated types rather than re-listing them here. */
function contractOperations(): Operation[] {
  const source = readFileSync(CONTRACT, 'utf8');
  const paths = source.slice(source.indexOf('export interface paths'), source.indexOf('export type webhooks'));

  const operations: Operation[] = [];
  const pathPattern = /^\s{4}"(\/[^"]*)":\s*\{$/gm;
  let match: RegExpExecArray | null;

  while ((match = pathPattern.exec(paths)) !== null) {
    const path = match[1];
    const block = paths.slice(match.index, paths.indexOf('\n    };', match.index));
    for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
      // An operation is present when the block defines it as something other
      // than `never` — openapi-typescript writes `get: never;` for the rest.
      if (new RegExp(`^\\s{8}${method}:\\s*(?!never)`, 'm').test(block)) {
        operations.push({ path, method });
      }
    }
  }
  return operations;
}

/** Every line of application source a call could live in. */
function applicationSource(): string {
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        return entry === 'generated' ? [] : walk(full);
      }
      return full.endsWith('.ts') && !full.endsWith('.spec.ts') ? [full] : [];
    });

  const roots = [APP, join(APP, '..', '..', 'libs', 'auth', 'src')];
  return roots
    .flatMap(walk)
    .map((file) => readFileSync(file, 'utf8'))
    .join('\n');
}

const OPERATIONS = contractOperations();
const SOURCE = applicationSource();

/**
 * Is this path called anywhere?
 *
 * Matched on the path as written in the contract, because that is exactly how
 * `ApiService` is called — templates and all (`/applications/{id}/submit`).
 * Auth paths are the exception: `AuthApiService` builds them from a base, so
 * the tail is what appears in the source.
 */
function isCalled(path: string): boolean {
  if (SOURCE.includes(`'${path}'`) || SOURCE.includes(`"${path}"`)) {
    return true;
  }
  if (path.startsWith('/auth/')) {
    const tail = path.slice('/auth'.length);
    return SOURCE.includes(`\${this.base}${tail}`) || SOURCE.includes(`'${tail}'`);
  }
  return false;
}

describe('contract coverage', () => {
  it('reads the operations out of the generated contract', () => {
    // If the parse breaks, every assertion below passes on an empty list —
    // which is precisely how eight missing screens stayed invisible.
    expect(OPERATIONS.length).toBeGreaterThan(20);
    expect(OPERATIONS.some((o) => o.path === '/applications/{id}/submit')).toBe(true);
  });

  it.each(OPERATIONS)('$method $path is reachable from the UI', ({ path }) => {
    if (NOT_CALLED_BY_DESIGN[path]) {
      expect(NOT_CALLED_BY_DESIGN[path].length, `${path} needs a real reason`).toBeGreaterThan(20);
      return;
    }
    expect(
      isCalled(path),
      `${path} is implemented in the API and nothing in the UI calls it. Build the screen, or add it to NOT_CALLED_BY_DESIGN with a reason.`,
    ).toBe(true);
  });

  it('keeps the exemption list honest', () => {
    // An exemption for an operation the contract no longer has is a stale
    // excuse, and it would hide a future gap at the same path.
    for (const path of Object.keys(NOT_CALLED_BY_DESIGN)) {
      expect(
        OPERATIONS.some((operation) => operation.path === path),
        `${path} is exempted but no longer exists in the contract`,
      ).toBe(true);
    }
  });
});
