import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadComponent: () => import('./login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'data-source',
    loadComponent: () => import('./data-source/data-source.page').then((m) => m.DataSourcePage),
  },
  {
    path: 'tabs',
    loadChildren: () => import('./tabs/tabs.routes').then((m) => m.routes),
  },
  {
    path: 'hm',
    loadComponent: () => import('./hm/hm.page').then((m) => m.HmPage),
  },
  {
    path: '**',
    redirectTo: 'login',
    pathMatch: 'full',
  },

];
