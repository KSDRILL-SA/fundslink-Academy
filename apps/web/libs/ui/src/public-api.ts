/*
 * Public API surface of `ui` — the FundsLink component library.
 *
 * Rules for everything exported here (component-library.md §0):
 *   - presentation only. No API calls, no auth, no business rules (S4.12).
 *     libs/ui may import `util`; it must never import `data-access` or `auth`.
 *   - tokens only, never a raw hex.
 *   - standalone, OnPush, `ui-*` selector.
 */

// Utilities
export * from './lib/utils/cn';

// Brand
export * from './lib/brand/ui-logo.component';

// Components
export * from './lib/components/icon/ui-icon.component';
export * from './lib/components/button/ui-button.component';
export * from './lib/components/card/ui-card.component';
export * from './lib/components/badge/ui-badge.component';
export * from './lib/components/badge/ui-status-chip.component';
export * from './lib/components/badge/status-presentation';

// Navigation
export * from './lib/nav/ui-scroll-nav.component';
export * from './lib/utils/reduced-motion';

// The four mandatory states (§7) — first-class, never afterthoughts.
export * from './lib/states/ui-skeleton.component';
export * from './lib/states/ui-empty-state.component';
export * from './lib/states/ui-error-state.component';
export * from './lib/states/ui-success-state.component';
export * from './lib/states/error-presentation';
