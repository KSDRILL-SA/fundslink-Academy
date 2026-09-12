import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Router, type Route } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { routes } from './app.routes';

/**
 * Every link in this product must lead somewhere.
 *
 * Written because ten did not. `{ path: '**', redirectTo: '' }` meant a link
 * to a route that does not exist returned the visitor to the home page instead
 * of failing — so `/how-it-works`, `/for-students`, `/for-donors`, `/about`,
 * `/contact`, `/help`, `/privacy`, `/terms`, `/information-officer` and, worst
 * of all, `/app/applications` (linked from the app's own navigation and from
 * the dashboard) all silently went nowhere. Nothing in the build could notice:
 * a redirect that works as written is not a failure.
 *
 * This is the gate, not a comment (doctrine L5). It reads every `routerLink`
 * and `navigateByUrl` target out of the source and asserts the route table can
 * match it. A new dead link now fails the build the moment it is written.
 *
 * Deliberately source-scanning rather than a render test: a link only has to be
 * WRITTEN to be wrong, and most of these live on screens no unit test mounts.
 */

const SRC = join(__dirname, '..');
const LIBS = join(__dirname, '..', '..', 'libs');

/** Link targets that are intentionally outside the Angular router. */
const EXTERNAL = /^(https?:|mailto:|tel:|#)/;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      return entry === 'node_modules' || entry === 'generated' ? [] : walk(full);
    }
    return full.endsWith('.ts') && !full.endsWith('.spec.ts') ? [full] : [];
  });
}

/**
 * Pull link targets out of a file.
 *
 * Only absolute, fully-literal paths are collected. A relative link or one
 * built from an expression (`['/app/applications', application.id]`) cannot be
 * resolved without knowing the value, and asserting on a guess would make this
 * gate lie; those are covered by the screens' own tests.
 */
function linkTargets(source: string): string[] {
  const patterns = [
    /routerLink="(\/[^"]*)"/g,
    /\[routerLink\]="'(\/[^']*)'"/g,
    /navigateByUrl\('(\/[^']*)'\)/g,
    /\broute:\s*'(\/[^']*)'/g,
  ];
  const found = new Set<string>();
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const target = match[1];
      if (!EXTERNAL.test(target)) {
        found.add(target);
      }
    }
  }

  // Array form: `[routerLink]="['/app/applications', application.id]"`. The
  // literal prefix is checkable; the expressions after it are ids whose values
  // are unknowable here, so each contributes one placeholder segment. Checking
  // only the prefix would be wrong in the other direction — it would demand a
  // route at `/app/admin/applications`, which correctly does not exist.
  for (const match of source.matchAll(/\[routerLink\]="\[([^\]]*)\]"/g)) {
    const parts = match[1].split(',').map((part) => part.trim());
    const prefix = parts[0]?.match(/^'(\/[^']*)'$/)?.[1];
    if (!prefix || EXTERNAL.test(prefix)) {
      continue;
    }
    const dynamic = parts.slice(1).filter(Boolean).length;
    found.add(prefix + ':x'.repeat(0) + Array(dynamic).fill('/:id').join(''));
  }
  return [...found];
}

/** Every literal link written anywhere in the app or the libraries. */
const LINKS = (() => {
  const byTarget = new Map<string, Set<string>>();
  for (const file of [...walk(SRC), ...walk(LIBS)]) {
    for (const target of linkTargets(readFileSync(file, 'utf8'))) {
      const where = byTarget.get(target) ?? new Set<string>();
      where.add(file.replace(SRC, 'src').replace(LIBS, 'libs'));
      byTarget.set(target, where);
    }
  }
  return [...byTarget.entries()].map(([target, files]) => ({ target, files: [...files] }));
})();

/**
 * Can the route table match this path?
 *
 * Walked directly rather than through a live Router so the check stays honest:
 * a `**` route matches everything, and a router-based check would therefore
 * pass every path in the product — including the nine that were broken.
 */
function matches(path: string, table: readonly Route[]): boolean {
  const segments = path.split('/').filter(Boolean);
  return matchSegments(segments, table);
}

function matchSegments(segments: readonly string[], table: readonly Route[]): boolean {
  for (const route of table) {
    if (route.path === '**') {
      // The catch-all is what hid the defect; it never counts as a match here.
      continue;
    }
    const routeSegments = (route.path ?? '').split('/').filter(Boolean);
    if (routeSegments.length > segments.length) {
      continue;
    }
    // A `:id` on either side is a wildcard: in the route it accepts any value,
    // and in a linked path it stands for a value only known at runtime.
    const consumed = routeSegments.every(
      (segment, i) =>
        segment.startsWith(':') || segments[i].startsWith(':') || segment === segments[i],
    );
    if (!consumed) {
      continue;
    }
    const rest = segments.slice(routeSegments.length);
    if (rest.length === 0) {
      // An exactly-consumed path resolves if this route renders something, or
      // has an empty child that does.
      if (route.loadComponent || route.component || route.redirectTo) {
        return true;
      }
      if (route.children?.some((child) => (child.path ?? '') === '')) {
        return true;
      }
      continue;
    }
    if (route.children && matchSegments(rest, route.children)) {
      return true;
    }
  }
  return false;
}

describe('route integrity', () => {
  it('finds the links to check', () => {
    // If the extraction silently stopped working, every other assertion here
    // would pass vacuously — which is exactly how the original defect hid.
    expect(LINKS.length).toBeGreaterThan(15);
    expect(LINKS.map((l) => l.target)).toContain('/app/applications');
  });

  it.each(LINKS)('$target resolves to a route', ({ target, files }) => {
    expect(matches(target, routes), `${target} is linked from ${files.join(', ')}`).toBe(true);
  });

  it('still has a catch-all, and it renders a page rather than redirecting', () => {
    const catchAll = routes.find((route) => route.path === '**');
    expect(catchAll, 'a mistyped URL must be handled').toBeTruthy();
    expect(catchAll?.redirectTo, 'a silent redirect hides dead links').toBeUndefined();
  });

  it('puts every literal route before the :param route that could swallow it', () => {
    // `applications/new` reaching `applications/:id` with id="new" is the
    // classic version of this, and it fails as a confusing 404 rather than as
    // an error anyone can read.
    const check = (table: readonly Route[]): void => {
      const params = table
        .map((route, index) => ({ route, index }))
        .filter(({ route }) => (route.path ?? '').includes('/:') || (route.path ?? '').startsWith(':'));

      for (const { route: paramRoute, index: paramIndex } of params) {
        const prefix = (paramRoute.path ?? '').split('/:')[0];
        table.forEach((other, otherIndex) => {
          const path = other.path ?? '';
          if (otherIndex > paramIndex && path.startsWith(`${prefix}/`) && !path.includes('/:')) {
            throw new Error(`"${path}" is unreachable: "${paramRoute.path}" matches it first`);
          }
        });
      }
      for (const route of table) {
        if (route.children) {
          check(route.children);
        }
      }
    };
    expect(() => check(routes)).not.toThrow();
  });

  it('keeps the router importable without a live navigation', () => {
    // Guards the shape of the table itself: a malformed Route object throws
    // here rather than at runtime on a student's first click.
    expect(() => Router).not.toThrow();
    expect(routes.length).toBeGreaterThan(3);
  });
});
