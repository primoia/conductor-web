import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { App } from './app/app';
import { DemoRoadmap } from './app/demo-roadmap/demo-roadmap';
import { InteractiveDemo } from './app/interactive-demo/interactive-demo';
import { EditorExamples } from './app/examples/editor-examples';
import { LayeredEditor } from './app/layered-editor/layered-editor';
import { MarkdownScreenplay } from './app/living-screenplay-simple/markdown-screenplay';
import { ScreenplayInteractive } from './app/living-screenplay-simple/screenplay-interactive';
import { MinistersPanel } from './app/city-sim/ministers-panel';
import { WeeklyCouncil } from './app/city-sim/weekly-council';
import { NeighborhoodView } from './app/city-sim/neighborhood-view';
import { DraggableCircles } from './app/examples/draggable-circles/draggable-circles';
import { QuestAdventureComponent } from './app/quest-adventure/quest-adventure.component';
import { AgentGameFullscreenComponent } from './app/living-screenplay-simple/agent-game-fullscreen/agent-game-fullscreen.component';
import { SCREENPLAY_BACKEND } from './app/services/screenplay/screenplay-backend.interface';
import { DocumentCentricBackend } from './app/services/screenplay/document-centric.backend';
import { EventSourcedBackend } from './app/services/screenplay/lsa/event-sourced.backend';

bootstrapApplication(App, {
  providers: [
    provideHttpClient(),
    provideAnimations(),
    provideRouter([
      { path: '', component: InteractiveDemo },
      { path: 'architecture', component: DemoRoadmap },
      { path: 'examples', component: EditorExamples },
      { path: 'layers', component: LayeredEditor },
      { path: 'screenplay', component: ScreenplayInteractive },
      { path: 'agents', component: AgentGameFullscreenComponent },
      { path: 'quest', component: QuestAdventureComponent },
      { path: 'circles', component: DraggableCircles },
      // City-Sim mockups
      { path: 'city/ministers', component: MinistersPanel },
      { path: 'city/council', component: WeeklyCouncil },
      { path: 'city/neighborhood', component: NeighborhoodView },
      { path: '**', redirectTo: '' }
    ]),
    {
      provide: SCREENPLAY_BACKEND,
      useFactory: (docCentric: DocumentCentricBackend, eventSourced: EventSourcedBackend) => {
        const params = new URLSearchParams(window.location.search);
        const backendType = params.get('backend');

        if (backendType === 'event_sourced') {
          console.log('🚀 Usando EventSourcedBackend (LSA)');
          return eventSourced;
        }

        console.log('🛸 Usando DocumentCentricBackend (Pragmático)');
        return docCentric;
      },
      deps: [DocumentCentricBackend, EventSourcedBackend]
    }
  ]
}).catch(err => console.error(err));
