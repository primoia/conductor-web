import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { GamificationEventsService, GamificationEvent, EventLevel } from '../../services/gamification-events.service';
import { marked } from 'marked';

@Component({
  selector: 'app-event-ticker',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="news-feed" role="log" aria-live="polite">
      <!-- News Items -->
      <div class="news-list">
        <ng-container *ngIf="filteredEvents.length > 0; else emptyState">
          <div
            class="news-article"
            *ngFor="let ev of filteredEvents; trackBy: trackById"
            [class.expanded]="isExpanded"
            [class.error]="ev.severity === 'error'"
            [class.warning]="ev.severity === 'warning'"
            (click)="onSelect(ev)"
            role="button"
            tabindex="0">

            <!-- Article Header -->
            <div class="article-header">
              <span class="agent-icon" [title]="ev.agentName || 'Agent'">{{ ev.agentEmoji || '🤖' }}</span>
            <div class="article-meta">
              <span class="agent-name">{{ ev.agentName || 'Sistema' }}</span>
              <span class="time" [title]="formatAbsolute(ev.timestamp)">{{ formatRelative(ev.timestamp) }}</span>
            </div>
            </div>

            <!-- Article Title -->
            <div class="article-title">{{ ev.title }}</div>

            <!-- Article Summary (only for result level and when expanded) -->
            <div class="article-summary markdown-content" *ngIf="ev.summary && (isExpanded || ev.level === 'result')" [innerHTML]="formatSummary(ev.summary)"></div>

            <!-- Debug Badge -->
            <span class="level-badge" *ngIf="ev.level === 'debug'">LOG</span>
          </div>
        </ng-container>

        <ng-template #emptyState>
          <div class="empty-state">
            <span class="empty-icon">📰</span>
            <span class="empty-text">Nenhum evento recente</span>
          </div>
        </ng-template>
      </div>
      <div class="list-footer" *ngIf="totalAvailable > filteredEvents.length">
        <button class="load-more" (click)="loadMore()">Carregar mais</button>
        <span class="count">Mostrando {{ filteredEvents.length }} de {{ totalAvailable }}</span>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; }

    .news-feed {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #ffffff;
    }

    /* Filter Bar styles moved to panel header */

    /* News List */
    .news-list {
      flex: 1;
      overflow-y: auto;
      padding: 8px 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      background: #ffffff;
    }

    .list-footer { display: flex; align-items: center; gap: 10px; justify-content: center; padding: 6px 8px; border-top: 1px dashed #e5e7eb; color: #6b7280; font-size: 11px; }
    .load-more { padding: 4px 10px; font-size: 11px; font-weight: 600; color: #111827; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 6px; cursor: pointer; }
    .load-more:hover { background: #e5e7eb; }

    /* News Article */
    .news-article {
      position: relative;
      padding: 6px 10px;
      margin: 0;
      background: transparent;
      border: none;
      border-left: 3px solid transparent; /* default no accent */
      border-radius: 6px;
      cursor: pointer;
      transition: background 0.2s ease;
    }

    .news-article:hover {
      background: #f9fafb;
    }

    .news-article.error { border-left-color: #ef4444; }
    .news-article.warning { border-left-color: #f59e0b; }
    .news-article.expanded { border-left-color: #3b82f6; }

    /* Article Header */
    .article-header {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 3px;
    }

    .agent-icon {
      font-size: 16px;
      line-height: 1;
    }

    .article-meta {
      display: flex;
      flex-direction: column;
      gap: 1px;
      flex: 1;
    }

    .agent-name {
      font-size: 11px;
      font-weight: 600;
      color: #111827;
      line-height: 1.2;
    }

    .time {
      font-size: 9px;
      color: #6b7280;
      font-variant-numeric: tabular-nums;
    }

    /* Article Title */
    .article-title {
      font-size: 13px;
      font-weight: 600;
      color: #1f2937;
      line-height: 1.35;
      margin-bottom: 2px;
    }

    /* Article Summary */
    .article-summary {
      font-size: 12px;
      color: #374151;
      line-height: 1.5;
      margin-top: 6px;
      padding: 0;
      border-top: none;
      overflow: hidden;
    }

    /* Level Badge */
    .level-badge { display: none; }

    /* Empty State */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 32px 16px;
      color: #9ca3af;
    }

    .empty-icon {
      font-size: 32px;
      margin-bottom: 8px;
    }

    .empty-text {
      font-size: 12px;
      font-weight: 500;
    }

    /* Scrollbar */
    .news-list::-webkit-scrollbar {
      width: 6px;
    }

    .news-list::-webkit-scrollbar-track {
      background: #f9fafb;
    }

    .news-list::-webkit-scrollbar-thumb {
      background: #d1d5db;
      border-radius: 3px;
    }

    .news-list::-webkit-scrollbar-thumb:hover {
      background: #9ca3af;
    }

    /* Markdown Content Styles */
    .markdown-content ::ng-deep p {
      margin: 0 0 6px 0;
    }

    .markdown-content ::ng-deep p:last-child {
      margin-bottom: 0;
    }

    .markdown-content ::ng-deep ul,
    .markdown-content ::ng-deep ol {
      margin: 0 0 6px 0;
      padding-left: 20px;
    }

    .markdown-content ::ng-deep li {
      margin-bottom: 2px;
    }

    .markdown-content ::ng-deep code {
      background-color: #f3f4f6;
      padding: 1px 3px;
      border-radius: 2px;
      font-family: 'Courier New', Courier, monospace;
      font-size: 10px;
    }

    .markdown-content ::ng-deep pre {
      background-color: #f3f4f6;
      border-radius: 3px;
      padding: 6px;
      overflow-x: auto;
      font-family: 'Courier New', Courier, monospace;
      font-size: 10px;
      margin: 4px 0;
    }

    .markdown-content ::ng-deep pre code {
      background: none;
      padding: 0;
    }

    /* Responsive media inside markdown */
    .markdown-content ::ng-deep img {
      max-width: 100%;
      height: auto;
      display: block;
    }

    .markdown-content ::ng-deep table {
      width: 100%;
      border-collapse: collapse;
      display: block;
      overflow-x: auto; /* allow horizontal scroll on small screens */
    }

    .markdown-content ::ng-deep th,
    .markdown-content ::ng-deep td {
      border: 1px solid #e5e7eb;
      padding: 4px 6px;
      font-size: 10px;
    }

    .markdown-content ::ng-deep a {
      color: #2563eb;
      text-decoration: none;
    }

    .markdown-content ::ng-deep a:hover {
      text-decoration: underline;
    }

    /* Soft-wrap long words/urls to avoid overflow */
    .markdown-content {
      overflow-wrap: anywhere;
      word-break: break-word;
    }

    .markdown-content ::ng-deep strong {
      font-weight: 600;
      color: #111827;
    }

    .markdown-content ::ng-deep em {
      font-style: italic;
    }

    .markdown-content ::ng-deep h1,
    .markdown-content ::ng-deep h2,
    .markdown-content ::ng-deep h3 {
      margin: 6px 0 4px 0;
      font-weight: 600;
      color: #111827;
    }

    .markdown-content ::ng-deep h1 { font-size: 13px; }
    .markdown-content ::ng-deep h2 { font-size: 12px; }
    .markdown-content ::ng-deep h3 { font-size: 11px; }
  `]
})
export class EventTickerComponent implements OnInit, OnDestroy, OnChanges {
  @Input() isExpanded = false; // Recebe estado do painel
  @Input() collapsedLimit = 3;
  @Input() expandedLimit = 10;
  @Output() select = new EventEmitter<GamificationEvent>();
  @Output() investigate = new EventEmitter<GamificationEvent>();

  filteredEvents: GamificationEvent[] = [];
  currentFilter: 'all' | EventLevel = 'result';
  totalAvailable = 0;

  private allEvents: GamificationEvent[] = [];
  private sub?: Subscription;
  private itemsLimit = 3;

  constructor(
    private readonly events: GamificationEventsService,
    private readonly sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.itemsLimit = this.isExpanded ? this.expandedLimit : this.collapsedLimit;
    this.sub = this.events.events$.subscribe(list => {
      this.allEvents = [...list].slice(-50); // Manter últimos 50
      this.applyFilter();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isExpanded']) {
      this.itemsLimit = this.isExpanded ? this.expandedLimit : this.collapsedLimit;
      this.applyFilter();
    }
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  setFilter(filter: 'all' | EventLevel): void {
    this.currentFilter = filter;
    this.applyFilter();
  }

  private applyFilter(): void {
    if (this.currentFilter === 'all') {
      this.filteredEvents = this.allEvents;
    } else {
      this.filteredEvents = this.allEvents.filter(ev => ev.level === this.currentFilter);
    }

    // Limitar exibição com janela dinâmica
    this.totalAvailable = this.filteredEvents.length;
    this.filteredEvents = this.filteredEvents.slice(-this.itemsLimit).reverse();
  }

  loadMore(): void {
    // Aumenta em 10 por clique, até o total disponível
    this.itemsLimit = Math.min(this.totalAvailable, this.itemsLimit + 10);
    this.applyFilter();
  }

  trackById(_: number, ev: GamificationEvent): string {
    return ev.id;
  }

  formatRelative(ts: number): string {
    const diff = Date.now() - ts;
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return `${sec}s atrás`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m atrás`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h atrás`;
    const day = Math.floor(hr / 24);
    return `${day}d atrás`;
  }

  formatAbsolute(ts: number): string {
    try {
      const d = new Date(ts);
      return d.toLocaleString();
    } catch {
      return '' + ts;
    }
  }

  formatSummary(text: string): SafeHtml {
    // Truncate text based on expanded state
    const maxLength = this.isExpanded ? 500 : 150;
    const truncated = text.length > maxLength ? text.slice(0, maxLength) + '...' : text;

    // Parse markdown and sanitize
    const rawHtml = marked(truncated) as string;
    return this.sanitizer.bypassSecurityTrustHtml(rawHtml);
  }

  onSelect(ev: GamificationEvent): void {
    this.select.emit(ev);
  }
}
