import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection, isDevMode } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';

import { routes } from './app.routes';
import { DocumentCentricBackend } from './services/screenplay/document-centric.backend';
import { EventSourcedBackend } from './services/screenplay/lsa/event-sourced.backend';
import { SCREENPLAY_BACKEND } from './services/screenplay/screenplay-backend.interface';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000'
    }),
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
};
