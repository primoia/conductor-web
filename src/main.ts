import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { App } from './app/app';
import { DemoRoadmap } from './app/demo-roadmap/demo-roadmap';
import { InteractiveDemo } from './app/interactive-demo/interactive-demo';

bootstrapApplication(App, {
  providers: [
    provideHttpClient(),
    provideRouter([
      { path: '', component: InteractiveDemo },
      { path: 'architecture', component: DemoRoadmap },
      { path: '**', redirectTo: '' }
    ])
  ]
}).catch(err => console.error(err));
