import type { EnvironmentProviders, Provider } from '@angular/core';
import type { HttpInterceptorFn } from '@angular/common/http';

/**
 * Preview mode — the PRODUCTION build of it, which is nothing at all.
 *
 * This file is the one that ships. The real preview interceptor lives in
 * `preview-api.development.ts` and is swapped in by the `fileReplacements`
 * entry on the development build configuration (angular.json), exactly the way
 * the environment files are swapped.
 *
 * That is deliberate and not merely tidy: a mock API is the single most
 * dangerous thing that can leak into a production bundle for a platform that
 * handles money and people's applications. A runtime `if (!production)` guard
 * leaves the fixtures in the shipped JavaScript, one flipped flag away from
 * serving a student invented data about their own funding. A build-time file
 * replacement means the code is not there to be reached.
 *
 * preview-api.spec.ts asserts both halves of that: this file holds no fixture,
 * and angular.json performs the swap.
 */
export const previewInterceptors: HttpInterceptorFn[] = [];

/**
 * Providers preview mode installs at bootstrap. Empty here, and that emptiness
 * is the point: the development file seeds a signed-in session so any screen
 * opens from its URL, and nothing that grants a session may ever ship.
 */
export const previewProviders: (Provider | EnvironmentProviders)[] = [];
