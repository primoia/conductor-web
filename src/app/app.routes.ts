import { Routes } from '@angular/router';
import { ScreenplayInteractive } from './living-screenplay-simple/screenplay-interactive';

export const routes: Routes = [
  {
    path: 'screenplay',
    component: ScreenplayInteractive
  },
  {
    path: '',
    redirectTo: '/screenplay',
    pathMatch: 'full'
  }
];
