import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./components/home/home').then(m => m.HomeComponent) },
  { path: 'exam', loadComponent: () => import('./components/exam/exam').then(m => m.ExamComponent) },
  { path: 'results', loadComponent: () => import('./components/results/results').then(m => m.ResultsComponent) },
  { path: 'settings', loadComponent: () => import('./components/settings/settings').then(m => m.SettingsComponent) },
  { path: '**', redirectTo: '' },
];
