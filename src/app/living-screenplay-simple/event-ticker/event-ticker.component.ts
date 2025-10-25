import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, interval } from 'rxjs';
import { GamificationEventsService, GamificationEvent } from '../../services/gamification-events.service';

@Component({
  selector: 'app-event-ticker',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="event-ticker-vertical" role="log" aria-live="polite" [attr.aria-busy]="isBusy">
      <ng-container *ngIf="visibleEvents.length > 0; else emptyState">
        <div
          class="news-item"
          *ngFor="let ev of visibleEvents; trackBy: trackById"
          [attr.data-category]="ev.category || 'analysis'"
          [class.warn]="ev.severity==='warning'"
          [class.err]="ev.severity==='error'"
          [title]="formatTooltip(ev)"
          role="button"
          tabindex="0"
          (click)="onSelect(ev)"
          (keydown.enter)="onSelect(ev)"
          (keydown.space)="$event.preventDefault(); onSelect(ev)"
        >
          <span class="emoji">{{ categoryEmoji(ev) }}</span>
          <span class="headline">{{ truncate(ev.title, 80) }}</span>
          <span class="time">{{ formatRelative(ev.timestamp) }}</span>
          <button
            *ngIf="ev.severity==='warning' || ev.severity==='error'"
            class="investigate-btn"
            title="Investigar"
            (click)="$event.stopPropagation(); onInvestigate(ev)"
          >🔎</button>
        </div>
      </ng-container>
      <ng-template #emptyState>
        <div class="empty">Nenhum evento recente</div>
      </ng-template>
    </div>
  `,
  styles: [`
    :host { display: block; max-width: 100%; }
    .event-ticker-vertical { display: flex; flex-direction: column; gap: 6px; max-height: 100%; overflow-y: auto; padding-right: 4px; }
    .news-item { display: grid; grid-template-columns: 20px 1fr auto auto; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 8px; border: 1px solid #e5e7eb; background: #f8fafc; font-size: 12px; }
    .news-item .emoji { text-align: center; }
    .news-item .headline { color: #111827; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .news-item .time { color: #6b7280; font-variant-numeric: tabular-nums; }
    .investigate-btn { border: 1px solid #d1d5db; background: #fff; border-radius: 6px; padding: 2px 6px; cursor: pointer; font-size: 12px; }
    .investigate-btn:hover { background: #eef2ff; border-color: #a5b4fc; }

    /* Category backgrounds */
    .news-item[data-category="build"] { background: #e8f5e9; border-color: #66bb6a; }
    .news-item[data-category="critical"] { background: #ffebee; border-color: #ef5350; }
    .news-item[data-category="analysis"] { background: #e3f2fd; border-color: #42a5f5; }
    .news-item[data-category="success"] { background: #f3e5f5; border-color: #ab47bc; }
    .news-item[data-category="alert"] { background: #fff8e1; border-color: #ffca28; }

    .empty { color: #6b7280; font-size: 12px; text-align: center; padding: 8px 0; }
  `]
})
export class EventTickerComponent implements OnInit, OnDestroy {
  @Input() refreshMs = 30000;
  @Input() maxItems = 5;
  @Output() select = new EventEmitter<GamificationEvent>();
  @Output() investigate = new EventEmitter<GamificationEvent>();

  isBusy = false;
  visibleEvents: GamificationEvent[] = [];

  private sub?: Subscription;
  private rotator?: Subscription;
  private rotationIndex = 0;

  constructor(private readonly events: GamificationEventsService) {}

  ngOnInit(): void {
    this.sub = this.events.events$.subscribe(list => {
      this.isBusy = false;
      const recent = [...list].slice(-this.maxItems);
      this.visibleEvents = this.rotate(recent, this.rotationIndex);
    });

    // Rotate view every ~5s to add motion, while data refresh is ~30s
    this.rotator = interval(5000).subscribe(() => {
      const list = this.events.getRecent(this.maxItems);
      this.rotationIndex = (this.rotationIndex + 1) % Math.max(1, list.length);
      this.visibleEvents = this.rotate(list, this.rotationIndex);
    });

    // Mark busy briefly on initial load
    this.isBusy = true;
    setTimeout(() => (this.isBusy = false), 400);
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.rotator?.unsubscribe();
  }

  trackById(_: number, ev: GamificationEvent): string { return ev.id; }

  private rotate<T>(arr: T[], index: number): T[] {
    if (arr.length === 0) return arr;
    const normalized = index % arr.length;
    return arr.slice(normalized).concat(arr.slice(0, normalized));
    }

  formatTooltip(ev: GamificationEvent): string {
    return `${ev.title} • ${new Date(ev.timestamp).toLocaleString()}`;
  }

  formatRelative(ts: number): string {
    const diff = Date.now() - ts;
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return `${sec}s`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h`;
    const day = Math.floor(hr / 24);
    return `${day}d`;
  }

  categoryEmoji(ev: GamificationEvent): string {
    switch (ev.category) {
      case 'build': return '🏗️';
      case 'critical': return '🔥';
      case 'analysis': return '📊';
      case 'success': return '🎉';
      case 'alert': return '⚠️';
      default:
        return ev.severity === 'error' ? '⛔' : ev.severity === 'warning' ? '⚠️' : 'ℹ️';
    }
  }

  truncate(text: string, max: number): string {
    return text.length > max ? text.slice(0, max - 1) + '…' : text;
  }

  onSelect(ev: GamificationEvent): void {
    this.select.emit(ev);
  }

  onInvestigate(ev: GamificationEvent): void {
    this.investigate.emit(ev);
  }
}
