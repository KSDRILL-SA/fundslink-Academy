import { Routes } from '@angular/router';
// Deliberately NOT from the 'auth' barrel. That barrel re-exports the five
// auth screens, so importing the guard at module load dragged every one of
// them — and the ui components they use — into the INITIAL bundle. The
// budget gate caught it at 459.78 kB. A guard is the one thing in a lazy
// library that must be eagerly importable, so it gets its own entry point.
import { authGuard } from 'auth/guards';

/**
 * The routing skeleton (frontend-structure.md §4).
 *
 * Three shells, each a lazily-loaded route group. The split is what keeps a
 * marketing visitor from downloading the application bundle and vice-versa —
 * the single biggest lever on first load for someone arriving on 3G (P6).
 *
 * `/admin` is deliberately absent. It is specified in §4, but there is no
 * client-side role signal today (AuthTokenService holds an opaque token and
 * never decodes it), so an adminGuard would mean inventing a claim shape
 * before the admin screens exist. It lands with A01-A04.
 */
export const routes: Routes = [
  // Public marketing site.
  {
    path: '',
    loadComponent: () =>
      import('./layouts/marketing-shell/marketing-shell.component').then(
        (m) => m.MarketingShellComponent,
      ),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./marketing/home.component').then((m) => m.MarketingHomeComponent),
      },
    ],
  },

  // Sign in / register / verify / reset — the screens built in Stage 02.
  {
    path: 'auth',
    loadComponent: () =>
      import('./layouts/auth-shell/auth-shell.component').then((m) => m.AuthShellComponent),
    children: [
      { path: 'login', loadComponent: () => import('auth').then((m) => m.LoginComponent) },
      { path: 'register', loadComponent: () => import('auth').then((m) => m.RegisterComponent) },
      {
        path: 'verify-email',
        loadComponent: () => import('auth').then((m) => m.VerifyEmailComponent),
      },
      {
        path: 'forgot-password',
        loadComponent: () => import('auth').then((m) => m.ForgotPasswordComponent),
      },
      {
        path: 'reset-password',
        loadComponent: () => import('auth').then((m) => m.ResetPasswordComponent),
      },
      { path: '', pathMatch: 'full', redirectTo: 'login' },
    ],
  },

  // The authenticated application.
  {
    path: 'app',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./layouts/app-shell/app-shell.component').then((m) => m.AppShellComponent),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./features/profile/profile.component').then((m) => m.ProfileComponent),
      },
    ],
  },

  // Operational endpoints — outside every shell on purpose. A health check
  // that renders a navigation bar is a health check measuring the wrong thing.
  {
    path: 'healthz',
    loadComponent: () => import('./health/health.component').then((m) => m.HealthComponent),
  },
  {
    path: 'debug-sentry',
    loadComponent: () => import('./core/debug-sentry.component').then((m) => m.DebugSentryComponent),
  },

  { path: '**', redirectTo: '' },
];
