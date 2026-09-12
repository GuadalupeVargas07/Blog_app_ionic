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
    path: 'tabs',
    loadChildren: () => import('./tabs/tabs.routes').then((m) => m.routes),
  },
  {
    path: '**',
    redirectTo: 'login',
    pathMatch: 'full',
  },

  {
    path: 'hm',
    loadComponent: () => import('./hm/hm.page').then( m => m.HmPage)
  },

];
