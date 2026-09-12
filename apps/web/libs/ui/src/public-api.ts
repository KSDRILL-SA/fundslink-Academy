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

// Premium — the depth layer (styles/surfaces.css) as components.
export * from './lib/premium/ui-icon-tile.component';
export * from './lib/premium/ui-stat.component';
export * from './lib/premium/ui-progress-ring.component';
export * from './lib/premium/ui-avatar.component';
export * from './lib/premium/ui-tabs.component';

// Flow
export * from './lib/flow/ui-stepper.component';

// Motion
export * from './lib/motion/ui-reveal.directive';

// Forms (component-library.md §2)
export * from './lib/forms/ui-form-field.component';
export * from './lib/forms/ui-control.directives';
export * from './lib/forms/ui-input-affix.component';
export * from './lib/forms/ui-password-field.component';
export * from './lib/forms/ui-error-summary.component';

// Navigation
export * from './lib/nav/ui-scroll-nav.component';
export * from './lib/utils/reduced-motion';

// The four mandatory states (§7) — first-class, never afterthoughts.
export * from './lib/states/ui-skeleton.component';
export * from './lib/states/ui-empty-state.component';
export * from './lib/states/ui-error-state.component';
export * from './lib/states/ui-success-state.component';
export * from './lib/states/error-presentation';
