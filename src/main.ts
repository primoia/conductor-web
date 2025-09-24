import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { App } from './app/app';
import { DemoRoadmap } from './app/demo-roadmap/demo-roadmap';
import { InteractiveDemo } from './app/interactive-demo/interactive-demo';
import { EditorExamples } from './app/examples/editor-examples';
import { LayeredEditor } from './app/layered-editor/layered-editor';
import { MarkdownScreenplay } from './app/living-screenplay-simple/markdown-screenplay';
import { ScreenplayInteractive } from './app/living-screenplay-simple/screenplay-interactive';
import { DraggableCircles } from './app/examples/draggable-circles/draggable-circles';

bootstrapApplication(App, {
  providers: [
    provideHttpClient(),
    provideRouter([
      { path: '', component: InteractiveDemo },
      { path: 'architecture', component: DemoRoadmap },
      { path: 'examples', component: EditorExamples },
      { path: 'layers', component: LayeredEditor },
      { path: 'screenplay', component: ScreenplayInteractive },
      { path: 'circles', component: DraggableCircles },
      { path: '**', redirectTo: '' }
    ])
  ]
}).catch(err => console.error(err));
