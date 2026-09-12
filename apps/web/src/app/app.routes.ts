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
      {
        path: 'bursaries',
        loadComponent: () =>
          import('./features/bursaries/bursaries.component').then((m) => m.BursariesComponent),
      },
      {
        path: 'how-it-works',
        loadComponent: () =>
          import('./marketing/pages/how-it-works.component').then((m) => m.HowItWorksComponent),
      },
      {
        path: 'for-students',
        loadComponent: () =>
          import('./marketing/pages/for-students.component').then((m) => m.ForStudentsComponent),
      },
      {
        path: 'for-donors',
        loadComponent: () =>
          import('./marketing/pages/for-donors.component').then((m) => m.ForDonorsComponent),
      },
      {
        path: 'about',
        loadComponent: () => import('./marketing/pages/about.component').then((m) => m.AboutComponent),
      },
      {
        path: 'contact',
        loadComponent: () =>
          import('./marketing/pages/contact.component').then((m) => m.ContactComponent),
      },
      {
        path: 'help',
        loadComponent: () => import('./marketing/pages/help.component').then((m) => m.HelpComponent),
      },
      // The public statement, distinct from S21 at /app/privacy, which is where
      // a signed-in student exercises these rights rather than reads about them.
      {
        path: 'privacy',
        loadComponent: () =>
          import('./marketing/pages/privacy-statement.component').then(
            (m) => m.PrivacyStatementComponent,
          ),
      },
      {
        path: 'terms',
        loadComponent: () => import('./marketing/pages/terms.component').then((m) => m.TermsComponent),
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
      {
        path: 'account',
        loadComponent: () =>
          import('./features/account/account.component').then((m) => m.AccountComponent),
      },
      {
        // Literal before `:param`, always: `applications/new` would otherwise
        // match `applications/:id` with an id of "new".
        path: 'applications',
        loadComponent: () =>
          import('./features/applications/applications-list.component').then(
            (m) => m.ApplicationsListComponent,
          ),
      },
      {
        path: 'applications/new',
        loadComponent: () =>
          import('./features/applications/category-picker.component').then(
            (m) => m.CategoryPickerComponent,
          ),
      },
      {
        path: 'applications/new/explain',
        loadComponent: () =>
          import('./features/applications/motivation.component').then((m) => m.MotivationComponent),
      },
      {
        path: 'applications/new/:category',
        loadComponent: () =>
          import('./features/applications/apply-steps.component').then(
            (m) => m.ApplyStepsComponent,
          ),
      },
      {
        path: 'bursaries',
        loadComponent: () =>
          import('./features/bursaries/bursaries.component').then((m) => m.BursariesComponent),
      },
      {
        path: 'notifications',
        loadComponent: () =>
          import('./features/notifications/notifications.component').then(
            (m) => m.NotificationsComponent,
          ),
      },
      {
        path: 'privacy',
        loadComponent: () =>
          import('./features/privacy/privacy.component').then((m) => m.PrivacyComponent),
      },
      // Admin. NOTE: guarded only by authGuard — there is still no client-side
      // role signal (see #202/#225). The API is the real boundary (S3.19): a
      // non-reviewer gets a 403 rather than data. An adminGuard lands when the
      // token carries a role the client can read.
      {
        path: 'admin',
        loadComponent: () =>
          import('./features/admin/review-queue.component').then((m) => m.ReviewQueueComponent),
      },
      {
        path: 'admin/applications/:id',
        loadComponent: () =>
          import('./features/admin/admin-application.component').then(
            (m) => m.AdminApplicationComponent,
          ),
      },
      {
        path: 'matches',
        loadComponent: () =>
          import('./features/matching/matches.component').then((m) => m.MatchesComponent),
      },
      {
        path: 'tracking',
        loadComponent: () =>
          import('./features/tracking/tracking-board.component').then(
            (m) => m.TrackingBoardComponent,
          ),
      },
      {
        path: 'tracking/new',
        loadComponent: () =>
          import('./features/tracking/register-tracked.component').then(
            (m) => m.RegisterTrackedComponent,
          ),
      },
      {
        path: 'applications/:id',
        loadComponent: () =>
          import('./features/applications/application-detail.component').then(
            (m) => m.ApplicationDetailComponent,
          ),
      },
      {
        path: 'applications/:id/documents',
        loadComponent: () =>
          import('./features/applications/documents.component').then((m) => m.DocumentsComponent),
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

  /*
   * A wrong address says so.
   *
   * This was `{ path: '**', redirectTo: '' }`, and that redirect hid ten dead
   * links in this product: every one of them "worked", by quietly returning
   * the visitor to the home page. A 404 inside the marketing shell keeps the
   * navigation and the way back, and makes a broken link visible the first
   * time anyone clicks it.
   */
  {
    path: '**',
    loadComponent: () =>
      import('./layouts/marketing-shell/marketing-shell.component').then(
        (m) => m.MarketingShellComponent,
      ),
    children: [
      {
        path: '**',
        loadComponent: () =>
          import('./marketing/not-found.component').then((m) => m.NotFoundComponent),
      },
    ],
  },
];
