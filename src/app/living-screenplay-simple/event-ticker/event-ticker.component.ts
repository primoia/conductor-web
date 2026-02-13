import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, OnChanges, SimpleChanges, ElementRef, ViewChild, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { GamificationEventsService, GamificationEvent, EventLevel, StreamLogEntry } from '../../services/gamification-events.service';
import { marked } from 'marked';

@Component({
  selector: 'app-event-ticker',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="news-feed" role="log" aria-live="polite">
      <!-- Filter Bar -->
      <div class="filter-bar">
        <button
          class="filter-btn"
          [class.active]="currentFilter === 'all'"
          (click)="setFilter('all')">
          Todos
        </button>
        <button
          class="filter-btn"
          [class.active]="currentFilter === 'result'"
          (click)="setFilter('result')">
          Resultados
        </button>
        <button
          class="filter-btn"
          [class.active]="currentFilter === 'info'"
          (click)="setFilter('info')">
          Info
        </button>
        <button
          class="filter-btn"
          [class.active]="currentFilter === 'debug'"
          (click)="setFilter('debug')">
          Debug
        </button>
      </div>

      <!-- Debug Console (when filter = debug) -->
      <div class="stream-console" *ngIf="currentFilter === 'debug'" #consoleScroll>
        <div class="console-header">
          <span class="console-title">Debug</span>
          <span class="console-count">{{ streamLog.length }}</span>
          <button class="console-clear" (click)="clearConsole()">Limpar</button>
        </div>
        <div class="console-body">
          <div class="console-line"
               *ngFor="let entry of streamLog; trackBy: trackByTimestamp"
               [class]="'line-' + entry.type">
            <span class="line-time">{{ formatTime(entry.timestamp) }}</span>
            <span class="line-agent" [style.color]="getAgentColor(entry.agentId)">{{ getAgentShortName(entry.agentId) }}</span>
            <span class="line-type">{{ getTypeLabel(entry.type) }}</span>
            <span class="line-text">
              <span class="text-prefix" [style.color]="getTypeColor(entry.type)">{{ getTypeLabel(entry.type) }}</span> {{ entry.text }}
            </span>
          </div>
          <div class="console-empty" *ngIf="streamLog.length === 0">
            Aguardando eventos de streaming...
          </div>
        </div>
      </div>

      <!-- News Items (when filter != debug) -->
      <div class="news-list" *ngIf="currentFilter !== 'debug'">
        <ng-container *ngIf="filteredEvents.length > 0; else emptyState">
          <a
            class="news-article"
            *ngFor="let ev of filteredEvents; trackBy: trackById"
            [href]="getEventUrl(ev)"
            [class.expanded]="isExpanded"
            [class.error]="ev.severity === 'error'"
            [class.warning]="ev.severity === 'warning'"
            [class.status-inputted]="ev.status === 'inputted'"
            [class.status-submitted]="ev.status === 'submitted'"
            [class.status-pending]="ev.status === 'pending'"
            [class.status-processing]="ev.status === 'processing'"
            [class.status-completed]="ev.status === 'completed'"
            [class.status-error]="ev.status === 'error'"
            [class.clickable]="hasNavigationData(ev)"
            (click)="onLinkClick(ev, $event)"
            tabindex="0">

            <!-- Article Header -->
            <div class="article-header">
              <div class="agent-icon-container" [class.running]="ev.status === 'processing'">
                <span class="agent-icon" [title]="ev.agentName || 'Agent'">{{ ev.agentEmoji || '🤖' }}</span>
                <span class="running-indicator" *ngIf="ev.status === 'processing'">
                  <span class="dot"></span>
                  <span class="dot"></span>
                  <span class="dot"></span>
                </span>
              </div>
              <div class="article-meta">
                <span class="agent-name">{{ ev.agentName || 'Sistema' }}</span>
                <span class="time" [title]="formatAbsolute(ev.timestamp)">{{ formatRelative(ev.timestamp) }}</span>
              </div>
              <!-- Status Badge -->
              <span class="status-badge" [class]="'badge-' + (ev.status || 'info')" *ngIf="ev.status">
                {{ getStatusLabel(ev.status) }}
              </span>
            </div>

            <!-- Article Title -->
            <div class="article-title">{{ ev.title }}</div>

            <!-- Article Summary (only for result level and when expanded) -->
            <div class="article-summary markdown-content" *ngIf="ev.summary && (isExpanded || ev.level === 'result')" [innerHTML]="formatSummary(ev.summary)"></div>

            <!-- Debug Badge -->
            <span class="level-badge" *ngIf="ev.level === 'debug'">LOG</span>

          </a>
        </ng-container>

        <ng-template #emptyState>
          <div class="empty-state">
            <span class="empty-icon">📰</span>
            <span class="empty-text">Nenhum evento recente</span>
          </div>
        </ng-template>
      </div>
      <div class="list-footer" *ngIf="currentFilter !== 'debug' && totalAvailable > filteredEvents.length">
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

    /* Filter Bar */
    .filter-bar {
      display: flex;
      gap: 4px;
      padding: 8px 12px;
      background: #f9fafb;
      border-bottom: 1px solid #e5e7eb;
      flex-shrink: 0;
    }

    .filter-btn {
      flex: 1;
      padding: 6px 8px;
      font-size: 11px;
      font-weight: 600;
      color: #6b7280;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .filter-btn:hover {
      background: #f3f4f6;
      color: #374151;
    }

    .filter-btn.active {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #ffffff;
      border-color: transparent;
      box-shadow: 0 2px 4px rgba(102, 126, 234, 0.3);
    }

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

    /* News Article (as link) */
    a.news-article {
      display: block;
      position: relative;
      padding: 6px 10px;
      margin: 0;
      background: transparent;
      border: none;
      border-left: 3px solid transparent; /* default no accent */
      border-radius: 6px;
      cursor: pointer;
      transition: background 0.2s ease;
      text-decoration: none;
      color: inherit;
    }

    .news-article:hover {
      background: #f9fafb;
    }

    .news-article.error { border-left-color: #ef4444; }
    .news-article.warning { border-left-color: #f59e0b; }
    .news-article.expanded { border-left-color: #3b82f6; }

    /* Status-based styling */
    .news-article.status-inputted {
      border-left-color: #8b5cf6;
      background: linear-gradient(90deg, #ede9fe 0%, transparent 15%);
    }

    .news-article.status-submitted {
      border-left-color: #6366f1;
      background: linear-gradient(90deg, #e0e7ff 0%, transparent 15%);
    }

    .news-article.status-pending {
      border-left-color: #f59e0b;
      background: linear-gradient(90deg, #fef3c7 0%, transparent 15%);
    }

    .news-article.status-processing {
      border-left-color: #3b82f6;
      background: linear-gradient(90deg, #dbeafe 0%, transparent 15%);
      animation: pulse-bg 2s ease-in-out infinite;
    }

    .news-article.status-completed {
      border-left-color: #10b981;
    }

    .news-article.status-error {
      border-left-color: #ef4444;
      background: linear-gradient(90deg, #fee2e2 0%, transparent 15%);
    }

    @keyframes pulse-bg {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.85; }
    }

    /* Clickable indicator */
    .news-article.clickable {
      cursor: pointer;
    }

    .news-article.clickable:hover {
      transform: translateX(2px);
      background: #f3f4f6;
    }

    .nav-arrow {
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      opacity: 0;
      transition: opacity 0.2s;
      color: #6b7280;
      font-size: 14px;
    }

    .news-article.clickable:hover .nav-arrow {
      opacity: 1;
    }

    /* Article Header */
    .article-header {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 3px;
    }

    .agent-icon-container {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .agent-icon {
      font-size: 16px;
      line-height: 1;
    }

    /* Running indicator animation */
    .running-indicator {
      position: absolute;
      bottom: -6px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 2px;
    }

    .running-indicator .dot {
      width: 3px;
      height: 3px;
      background: #3b82f6;
      border-radius: 50%;
      animation: bounce 1.4s infinite ease-in-out;
    }

    .running-indicator .dot:nth-child(1) { animation-delay: -0.32s; }
    .running-indicator .dot:nth-child(2) { animation-delay: -0.16s; }

    @keyframes bounce {
      0%, 80%, 100% { transform: scale(0); opacity: 0.5; }
      40% { transform: scale(1); opacity: 1; }
    }

    /* Status Badge */
    .status-badge {
      font-size: 9px;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .status-badge.badge-inputted {
      background: #ede9fe;
      color: #6b21a8;
    }

    .status-badge.badge-submitted {
      background: #e0e7ff;
      color: #4338ca;
    }

    .status-badge.badge-pending {
      background: #fef3c7;
      color: #92400e;
    }

    .status-badge.badge-processing {
      background: #dbeafe;
      color: #1e40af;
      animation: pulse-badge 2s ease-in-out infinite;
    }

    .status-badge.badge-completed {
      background: #d1fae5;
      color: #065f46;
    }

    .status-badge.badge-error {
      background: #fee2e2;
      color: #991b1b;
    }

    @keyframes pulse-badge {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
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

    /* ========== Debug Console (light theme) ========== */
    .stream-console {
      display: flex;
      flex-direction: column;
      flex: 1;
      overflow: hidden;
      background: #fafafa;
      border-radius: 4px;
      margin: 4px;
      border: 1px solid #e5e7eb;
    }

    .console-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      background: #f3f4f6;
      border-bottom: 1px solid #e5e7eb;
      flex-shrink: 0;
    }

    .console-title {
      font-size: 11px;
      font-weight: 600;
      color: #374151;
      flex: 1;
    }

    .console-count {
      font-size: 10px;
      color: #9ca3af;
    }

    .console-clear {
      font-size: 10px;
      padding: 2px 8px;
      background: #e5e7eb;
      color: #4b5563;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }

    .console-clear:hover {
      background: #d1d5db;
    }

    .console-body {
      flex: 1;
      overflow-y: auto;
      padding: 4px 0;
      font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace;
      font-size: 11px;
      line-height: 1.5;
    }

    .console-line {
      display: grid;
      grid-template-columns: 52px minmax(20px, auto) 1fr;
      gap: 0 6px;
      padding: 2px 10px;
      color: #374151;
      border-bottom: 1px solid #f3f4f6;
    }

    .console-line:hover {
      background: #f0f0f0;
    }

    .line-time {
      color: #9ca3af;
      font-size: 10px;
    }

    .line-agent {
      font-weight: 600;
      font-size: 10px;
      white-space: nowrap;
    }

    .line-type {
      display: none;
    }

    .line-text {
      color: #374151;
      grid-column: 1 / -1;
      padding-left: 4px;
      word-break: break-word;
      white-space: pre-wrap;
    }

    .line-text:empty { display: none; }

    .text-prefix {
      font-weight: 700;
      font-size: 10px;
      margin-right: 4px;
    }

    /* Type-specific text colors (light theme) */
    .line-system .line-text { color: #6b21a8; }
    .line-tool_use .line-text { color: #92400e; }
    .line-tool_result .line-text { color: #0c4a6e; }
    .line-result .line-text { color: #166534; font-weight: 600; }
    .line-thinking .line-text { color: #9ca3af; font-style: italic; }
    .line-other .line-text { color: #9ca3af; font-size: 10px; }

    .console-empty {
      padding: 20px;
      text-align: center;
      color: #9ca3af;
      font-style: italic;
    }

    .console-body::-webkit-scrollbar { width: 6px; }
    .console-body::-webkit-scrollbar-track { background: #fafafa; }
    .console-body::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }
    .console-body::-webkit-scrollbar-thumb:hover { background: #9ca3af; }

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
export class EventTickerComponent implements OnInit, OnDestroy, OnChanges, AfterViewChecked {
  @Input() isExpanded = false; // Recebe estado do painel
  @Input() collapsedLimit = 3;
  @Input() expandedLimit = 10;
  @Output() select = new EventEmitter<GamificationEvent>();
  @Output() investigate = new EventEmitter<GamificationEvent>();
  @ViewChild('consoleScroll') consoleScrollRef?: ElementRef;

  filteredEvents: GamificationEvent[] = [];
  currentFilter: 'all' | EventLevel = 'all';
  totalAvailable = 0;

  /** Stream debug console log entries */
  streamLog: StreamLogEntry[] = [];
  private shouldAutoScroll = true;

  private allEvents: GamificationEvent[] = [];
  private sub?: Subscription;
  private streamSub?: Subscription;
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

    // Subscribe to stream debug log
    this.streamSub = this.events.streamLog$.subscribe(log => {
      this.streamLog = log;
      this.shouldAutoScroll = true;
    });
  }

  ngAfterViewChecked(): void {
    if (this.shouldAutoScroll && this.consoleScrollRef) {
      const el = this.consoleScrollRef.nativeElement.querySelector('.console-body');
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
      this.shouldAutoScroll = false;
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isExpanded']) {
      this.itemsLimit = this.isExpanded ? this.expandedLimit : this.collapsedLimit;
      this.applyFilter();
    }
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.streamSub?.unsubscribe();
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

  trackByTimestamp(index: number, entry: StreamLogEntry): number {
    return entry.timestamp + index;
  }

  formatTime(ts: number): string {
    const d = new Date(ts);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  clearConsole(): void {
    this.events.clearStreamLog();
  }

  getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      'system': 'SYS',
      'text': '',
      'tool_use': 'TOOL',
      'tool_result': 'RES',
      'result': 'DONE',
      'thinking': 'THINK',
      'other': ''
    };
    return labels[type] ?? type;
  }

  getTypeColor(type: string): string {
    const colors: Record<string, string> = {
      'system': '#7c3aed',
      'text': '#374151',
      'tool_use': '#b45309',
      'tool_result': '#0369a1',
      'result': '#15803d',
      'thinking': '#9ca3af',
      'other': '#9ca3af'
    };
    return colors[type] || '#374151';
  }

  /** Palette of distinct colors for agents */
  private agentColorMap = new Map<string, string>();
  private readonly agentColors = [
    '#2563eb', '#dc2626', '#059669', '#d97706', '#7c3aed',
    '#db2777', '#0891b2', '#65a30d', '#ea580c', '#4f46e5'
  ];

  getAgentColor(agentId: string): string {
    if (!this.agentColorMap.has(agentId)) {
      const idx = this.agentColorMap.size % this.agentColors.length;
      this.agentColorMap.set(agentId, this.agentColors[idx]);
    }
    return this.agentColorMap.get(agentId)!;
  }

  getAgentShortName(agentId: string): string {
    return agentId.replace(/_Agent$/, '').replace(/_/g, ' ');
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

  /**
   * Returns a human-readable label for the task status
   */
  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'inputted': 'Digitado',
      'submitted': 'Enviado',
      'pending': 'Na Fila',
      'processing': 'Executando',
      'completed': 'Concluído',
      'error': 'Erro'
    };
    return labels[status] || status;
  }

  /**
   * Checks if the event has navigation data (screenplay_id, conversation_id)
   * to allow clicking and navigating to the context
   */
  hasNavigationData(ev: GamificationEvent): boolean {
    const meta = ev.meta as Record<string, unknown> | undefined;
    if (!meta) return false;
    return !!(meta['screenplay_id'] || meta['conversation_id'] || meta['instance_id']);
  }

  onSelect(ev: GamificationEvent): void {
    this.select.emit(ev);
  }

  /**
   * Builds the URL for an event (used as href for the link)
   */
  getEventUrl(ev: GamificationEvent): string {
    const meta = ev.meta as Record<string, unknown> | undefined;
    if (!meta) return '#';

    // Try both naming conventions (snake_case from backend, camelCase from elsewhere)
    const screenplayId = (meta['screenplay_id'] || meta['screenplayId']) as string | undefined;
    const conversationId = (meta['conversation_id'] || meta['conversationId']) as string | undefined;
    const instanceId = (meta['instance_id'] || meta['instanceId']) as string | undefined;

    if (!screenplayId && !conversationId && !instanceId) {
      return '#';
    }

    const params = new URLSearchParams();
    if (screenplayId) params.set('screenplayId', screenplayId);
    if (conversationId) params.set('conversationId', conversationId);
    if (instanceId) params.set('instanceId', instanceId);

    return `/screenplay?${params.toString()}`;
  }

  /**
   * Handle left-click on link - navigate in same tab via Angular
   */
  onLinkClick(ev: GamificationEvent, event: MouseEvent): void {
    // If Ctrl/Cmd+click or middle click, let browser handle (opens in new tab)
    if (event.ctrlKey || event.metaKey || event.button === 1) {
      return; // Let the browser handle the link normally
    }

    // For normal click, prevent default and use Angular navigation
    event.preventDefault();
    this.select.emit(ev);
  }
}
