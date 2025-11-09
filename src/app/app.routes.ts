import { Routes } from '@angular/router';
import { ScreenplayInteractive } from './living-screenplay-simple/screenplay-interactive';
import { MinistersPanel } from './city-sim/ministers-panel';
import { WeeklyCouncil } from './city-sim/weekly-council';
import { NeighborhoodView } from './city-sim/neighborhood-view';
import { QuestAdventureComponent } from './quest-adventure/quest-adventure.component';

export const routes: Routes = [
  {
    path: 'quest',
    component: QuestAdventureComponent
  },
  {
    path: 'screenplay',
    component: ScreenplayInteractive
  },
  {
    path: 'city/ministers',
    component: MinistersPanel
  },
  {
    path: 'city/council',
    component: WeeklyCouncil
  },
  {
    path: 'city/neighborhood',
    component: NeighborhoodView
  },
  {
    path: '',
    redirectTo: '/screenplay',
    pathMatch: 'full'
  }
];
