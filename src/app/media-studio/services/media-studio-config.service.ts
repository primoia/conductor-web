import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { AgentCarouselItem, MediaStudioConfig } from '../models/media-studio.models';

@Injectable({ providedIn: 'root' })
export class MediaStudioConfigService {
  private agents$ = new BehaviorSubject<AgentCarouselItem[]>([]);

  constructor(private http: HttpClient) { }

  get agents(): Observable<AgentCarouselItem[]> {
    return this.agents$.asObservable();
  }

  loadAgents(): void {
    this.http.get<MediaStudioConfig>('/jarvis/api/v1/config').subscribe({
      next: (cfg) => {
        const ww = cfg.wake_words || cfg.wakeWords || [];
        const items: AgentCarouselItem[] = ww
          .map((w, i) => {
            const kw = typeof w === 'string' ? w : w.keyword || w.Keyword || '';
            const name = kw.charAt(0).toUpperCase() + kw.slice(1).toLowerCase();
            return name ? { name, colorIdx: i } : null;
          })
          .filter((x): x is AgentCarouselItem => x !== null);
        this.agents$.next(items);
      },
      error: () => {
        this.agents$.next([
          { name: 'Catarina', colorIdx: 0 },
          { name: 'Mariana', colorIdx: 1 },
        ]);
      },
    });
  }
}
