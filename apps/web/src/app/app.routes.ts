import { Routes } from '@angular/router';

export const routes: Routes = [
  // S04-S07 area (libs/auth). S06 verify / S07 reset land with their backend endpoints (PR-G).
  {
    path: 'login',
    loadComponent: () => import('auth').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () => import('auth').then((m) => m.RegisterComponent),
  },
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
  {
    path: 'debug-sentry',
    loadComponent: () => import('./core/debug-sentry.component').then((m) => m.DebugSentryComponent),
  },
  {
    path: 'healthz',
    loadComponent: () => import('./health/health.component').then((m) => m.HealthComponent),
  },
  { path: '', pathMatch: 'full', redirectTo: 'login' },
];
