import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { GamificationEventsService, GamificationEvent } from '../../services/gamification-events.service';

@Component({
  selector: 'app-agent-events-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-backdrop" *ngIf="isVisible" (click)="onClose()">
      <div class="modal-container" (click)="$event.stopPropagation()" (touchstart)="$event.stopPropagation()" (touchend)="$event.stopPropagation()">
        <!-- Header -->
        <div class="modal-header">
          <h3 class="modal-title">{{ modalTitle }}</h3>
          <div class="filter-chips" *ngIf="filterMode === 'all'">
            <button
              class="chip"
              [class.active]="activeFilter === 'all'"
              (click)="setFilter('all')">Todos</button>
            <button
              class="chip"
              [class.active]="activeFilter === 'result'"
              (click)="setFilter('result')">Resultados</button>
            <button
              class="chip"
              [class.active]="activeFilter === 'debug'"
              (click)="setFilter('debug')">Debug</button>
          </div>
          <button class="close-btn" (click)="onClose()">✕</button>
        </div>

        <!-- Body -->
        <div class="modal-body">
          <div class="empty-state" *ngIf="filteredEvents.length === 0">
            <span class="empty-icon">📡</span>
            <span>Nenhum evento ainda.</span>
          </div>

          <div
            *ngFor="let event of filteredEvents"
            class="event-card"
            [class.result]="event.level === 'result'"
            [class.debug]="event.level === 'debug'"
            [class.info]="event.level === 'info'"
            [class.error]="event.severity === 'error'"
            [class.processing]="event.status === 'processing'"
            [class.completed]="event.status === 'completed'"
            [class.clickable]="hasNavigation(event)"
            (click)="onEventClick(event)">
            <div class="event-row">
              <span class="event-emoji">{{ event.agentEmoji || getStatusEmoji(event) }}</span>
              <div class="event-content">
                <div class="event-title">{{ event.title }}</div>
                <div class="event-summary" *ngIf="event.summary">{{ event.summary }}</div>
                <div class="event-meta">
                  <span class="event-agent" *ngIf="event.agentName">{{ event.agentName }}</span>
                  <span class="event-time">{{ formatTime(event.timestamp) }}</span>
                  <span class="event-status" *ngIf="event.status">{{ event.status }}</span>
                  <span class="event-nav" *ngIf="hasNavigation(event)">🔗</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      z-index: 2000;
      display: flex;
      align-items: stretch;
      justify-content: center;
      padding: 0;
    }

    .modal-container {
      width: 100%;
      height: 100%;
      background: #fff;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    @media (min-width: 768px) {
      .modal-backdrop {
        align-items: center;
        padding: 24px;
      }
      .modal-container {
        width: 90%;
        max-width: 800px;
        height: 85vh;
        border-radius: 16px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      }
    }

    .modal-header {
      display: flex;
      align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid #e2e8f0;
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      flex-shrink: 0;
      gap: 8px;
      flex-wrap: wrap;
    }

    .modal-title {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      white-space: nowrap;
    }

    .filter-chips {
      display: flex;
      gap: 4px;
      flex: 1;
      min-width: 0;
    }

    .chip {
      padding: 4px 10px;
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 12px;
      background: transparent;
      color: rgba(255, 255, 255, 0.8);
      font-size: 12px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .chip.active {
      background: rgba(255, 255, 255, 0.25);
      color: white;
      border-color: rgba(255, 255, 255, 0.5);
    }

    .close-btn {
      background: rgba(255, 255, 255, 0.2);
      border: none;
      color: white;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      font-size: 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin-left: auto;
      transition: background 0.2s;
    }

    .close-btn:hover {
      background: rgba(255, 255, 255, 0.3);
    }

    .modal-body {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
      -webkit-overflow-scrolling: touch;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 40px;
      color: #64748b;
    }

    .empty-icon {
      font-size: 40px;
    }

    .event-card {
      padding: 12px;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      margin-bottom: 8px;
      transition: all 0.2s;
      background: #fff;
    }

    .event-card.result {
      border-left: 3px solid #22c55e;
    }

    .event-card.debug {
      border-left: 3px solid #94a3b8;
      opacity: 0.8;
    }

    .event-card.info {
      border-left: 3px solid #3b82f6;
    }

    .event-card.error {
      border-left: 3px solid #ef4444;
      background: #fef2f2;
    }

    .event-card.processing {
      background: #fffbeb;
    }

    .event-card.completed {
      background: #f0fdf4;
    }

    .event-row {
      display: flex;
      gap: 10px;
      align-items: flex-start;
    }

    .event-emoji {
      font-size: 20px;
      flex-shrink: 0;
      margin-top: 2px;
    }

    .event-content {
      flex: 1;
      min-width: 0;
    }

    .event-title {
      font-size: 14px;
      font-weight: 500;
      color: #1e293b;
      line-height: 1.3;
    }

    .event-summary {
      font-size: 13px;
      color: #64748b;
      margin-top: 4px;
      line-height: 1.4;
    }

    .event-meta {
      display: flex;
      gap: 8px;
      margin-top: 6px;
      font-size: 11px;
      color: #94a3b8;
      flex-wrap: wrap;
    }

    .event-agent {
      color: #667eea;
      font-weight: 500;
    }

    .event-status {
      padding: 1px 6px;
      border-radius: 4px;
      background: #f1f5f9;
      font-size: 10px;
      text-transform: uppercase;
    }

    .event-card.clickable {
      cursor: pointer;
    }

    .event-card.clickable:hover {
      border-color: #667eea;
      background: #f8faff;
    }

    .event-card.clickable:active {
      background: #eef2ff;
    }

    .event-nav {
      margin-left: auto;
      font-size: 12px;
    }
  `]
})
export class AgentEventsModalComponent implements OnInit, OnDestroy {
  @Input() isVisible = false;
  @Input() filterMode: 'all' | 'result' | 'debug' = 'all';
  @Output() closeModal = new EventEmitter<void>();
  @Output() eventSelected = new EventEmitter<GamificationEvent>();

  events: GamificationEvent[] = [];
  activeFilter: 'all' | 'result' | 'debug' = 'all';
  private subscription = new Subscription();

  constructor(private gamificationEventsService: GamificationEventsService) {}

  ngOnInit(): void {
    if (this.filterMode !== 'all') {
      this.activeFilter = this.filterMode;
    }
    this.subscription.add(
      this.gamificationEventsService.events$.subscribe(events => {
        this.events = events;
      })
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  get modalTitle(): string {
    if (this.filterMode === 'result') return 'Eventos dos Agentes';
    if (this.filterMode === 'debug') return 'Eventos de Debug';
    return 'Eventos dos Agentes';
  }

  get filteredEvents(): GamificationEvent[] {
    const filter = this.filterMode !== 'all' ? this.filterMode : this.activeFilter;
    if (filter === 'all') return this.events;
    return this.events.filter(e => e.level === filter);
  }

  get unseenCount(): number {
    return this.events.length;
  }

  setFilter(filter: 'all' | 'result' | 'debug'): void {
    this.activeFilter = filter;
  }

  onClose(): void {
    this.closeModal.emit();
  }

  hasNavigation(event: GamificationEvent): boolean {
    const meta = event.meta;
    return !!(meta?.['screenplay_id'] || meta?.['conversation_id']);
  }

  onEventClick(event: GamificationEvent): void {
    if (this.hasNavigation(event)) {
      this.eventSelected.emit(event);
      this.closeModal.emit();
    }
  }

  getStatusEmoji(event: GamificationEvent): string {
    if (event.status === 'completed') return '✅';
    if (event.status === 'error') return '❌';
    if (event.status === 'processing') return '⏳';
    if (event.severity === 'error') return '🔴';
    if (event.severity === 'warning') return '🟡';
    if (event.level === 'result') return '🎯';
    if (event.level === 'debug') return '🔧';
    return '📌';
  }

  formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
}
