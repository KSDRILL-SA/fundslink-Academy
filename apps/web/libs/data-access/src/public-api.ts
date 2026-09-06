/*
 * Public API surface of `data-access` — the GENERATED contract client.
 *
 * The types in `generated/` are produced from packages/contracts/openapi.yaml
 * by `npm run generate` in that package, and CI fails if this file drifts from
 * the contract. Never hand-edit them, and never hand-write an API type
 * elsewhere (S2.7, handoff-s03-s04 §4.1).
 */

// The generated contract surface.
export * from './lib/generated/api-types';

// Typed helpers derived from it — nothing here restates a shape.
export * from './lib/api.types';

// The HTTP layer every feature service builds on.
export * from './lib/api-base-url';
export * from './lib/api-error';
export * from './lib/api.service';
