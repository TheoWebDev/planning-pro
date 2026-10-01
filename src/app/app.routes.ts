import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'tableau-de-bord', pathMatch: 'full' },
  {
    path: 'tableau-de-bord',
    title: 'Tableau de bord · Planning Pro',
    loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
  },
  {
    path: 'calendrier',
    title: 'Calendrier · Planning Pro',
    loadComponent: () => import('./features/calendar/calendar').then((m) => m.Calendar),
  },
  {
    path: 'recapitulatif',
    title: 'Récapitulatif · Planning Pro',
    loadComponent: () => import('./features/summary/summary').then((m) => m.Summary),
  },
  {
    path: 'reglages',
    title: 'Réglages · Planning Pro',
    loadComponent: () => import('./features/settings/settings').then((m) => m.Settings),
  },
  { path: '**', redirectTo: 'tableau-de-bord' },
];
