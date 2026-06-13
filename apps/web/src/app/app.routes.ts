import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'healthz',
    loadComponent: () => import('./health/health.component').then((m) => m.HealthComponent),
  },
  { path: '', pathMatch: 'full', redirectTo: 'healthz' },
];
