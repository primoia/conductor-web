import { Component, Input, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { GamificationWebSocketService, GamificationWebSocketEvent } from '../../../../services/gamification-websocket.service';

export interface ToolCallEvent {
  callId: string;
  tool: string;
  method: string;
  phase: 'start' | 'end' | 'error';
  params?: any;
  statusCode?: number;
  durationMs?: number;
  responseSize?: number;
  error?: string;
  timestamp: string;
  mcpName?: string;
}

@Component({
  selector: 'app-tool-call-timeline',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Collapsed summary when execution is done -->
    <div *ngIf="isCollapsed && events.length > 0" class="timeline-summary" (click)="isCollapsed = false">
      <span class="summary-icon">&#9881;</span>
      <span>{{ completedCount }} tool calls em {{ totalDurationFormatted }}</span>
      <span class="expand-hint">(clique para expandir)</span>
    </div>

    <!-- Live timeline -->
    <div *ngIf="!isCollapsed && events.length > 0" class="timeline-container" #timelineContainer>
      <div class="timeline-header" (click)="isCollapsed = true" *ngIf="!isActive">
        <span>Tool Calls ({{ events.length }})</span>
        <span class="collapse-hint">&#9652;</span>
      </div>

      <div class="timeline-events">
        <div
          *ngFor="let event of displayEvents; trackBy: trackByCallId"
          class="timeline-event"
          [class.event-start]="event.phase === 'start'"
          [class.event-end]="event.phase === 'end'"
          [class.event-error]="event.phase === 'error'"
        >
          <!-- Start: spinner + tool name -->
          <span *ngIf="event.phase === 'start'" class="event-icon spinner">&#9881;</span>
          <!-- End: green check -->
          <span *ngIf="event.phase === 'end'" class="event-icon success">&#10003;</span>
          <!-- Error: red X -->
          <span *ngIf="event.phase === 'error'" class="event-icon error-icon">&#10007;</span>

          <span class="event-tool">{{ event.tool }}</span>

          <span *ngIf="event.phase === 'start' && event.params" class="event-params">
            ({{ formatParams(event.params) }})
          </span>

          <span *ngIf="event.phase === 'end'" class="event-result">
            {{ event.statusCode }} - {{ event.durationMs }}ms
          </span>

          <span *ngIf="event.phase === 'error'" class="event-error-msg">
            {{ event.error }}
          </span>

          <span *ngIf="event.mcpName" class="event-mcp">{{ event.mcpName }}</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }

    .timeline-summary {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      background: #f0f9ff;
      border: 1px solid #bae6fd;
      border-radius: 6px;
      font-size: 12px;
      color: #0369a1;
      cursor: pointer;
      transition: background 0.2s;
    }

    .timeline-summary:hover {
      background: #e0f2fe;
    }

    .summary-icon {
      font-size: 14px;
    }

    .expand-hint {
      color: #7dd3fc;
      font-size: 11px;
    }

    .timeline-container {
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      background: #f8fafc;
      max-height: 200px;
      overflow-y: auto;
    }

    .timeline-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 4px 10px;
      background: #f1f5f9;
      font-size: 11px;
      color: #64748b;
      cursor: pointer;
      border-bottom: 1px solid #e2e8f0;
    }

    .collapse-hint {
      font-size: 10px;
    }

    .timeline-events {
      padding: 4px 0;
    }

    .timeline-event {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 3px 10px;
      font-size: 11px;
      font-family: 'Courier New', monospace;
      animation: fadeInEvent 0.2s ease;
    }

    .event-icon {
      width: 16px;
      text-align: center;
      flex-shrink: 0;
    }

    .event-icon.spinner {
      color: #3b82f6;
      animation: spin 1s linear infinite;
    }

    .event-icon.success {
      color: #22c55e;
    }

    .event-icon.error-icon {
      color: #ef4444;
    }

    .event-tool {
      font-weight: 600;
      color: #1e293b;
    }

    .event-params {
      color: #94a3b8;
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .event-result {
      color: #16a34a;
      margin-left: auto;
    }

    .event-error-msg {
      color: #ef4444;
      margin-left: auto;
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .event-mcp {
      color: #a78bfa;
      font-size: 10px;
      margin-left: auto;
    }

    /* Scrollbar */
    .timeline-container::-webkit-scrollbar {
      width: 4px;
    }
    .timeline-container::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 2px;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    @keyframes fadeInEvent {
      from { opacity: 0; transform: translateX(-5px); }
      to { opacity: 1; transform: translateX(0); }
    }
  `]
})
export class ToolCallTimelineComponent implements OnInit, OnDestroy {
  @Input() instanceId: string = '';
  @Input() conversationId: string = '';
  @Input() isActive: boolean = true;

  events: ToolCallEvent[] = [];
  isCollapsed = false;

  private subscription?: Subscription;
  private maxEvents = 100;
  private lastRender = 0;
  private renderThrottleMs = 200;
  private pendingUpdate = false;

  constructor(
    private wsService: GamificationWebSocketService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.subscription = this.wsService.events$.pipe(
      filter((event: GamificationWebSocketEvent) => {
        if (event.type !== 'tool_call') return false;
        const data = event.data || {};
        if (this.instanceId && data.instance_id && data.instance_id !== this.instanceId) return false;
        if (this.conversationId && data.conversation_id && data.conversation_id !== this.conversationId) return false;
        return true;
      })
    ).subscribe((event: GamificationWebSocketEvent) => {
      this.handleToolCallEvent(event.data);
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  get displayEvents(): ToolCallEvent[] {
    return this.events.slice(-this.maxEvents);
  }

  get completedCount(): number {
    return this.events.filter(e => e.phase === 'end').length;
  }

  get totalDurationFormatted(): string {
    if (this.events.length === 0) return '0s';
    const totalMs = this.events
      .filter(e => e.phase === 'end' && e.durationMs)
      .reduce((sum, e) => sum + (e.durationMs || 0), 0);

    if (totalMs < 1000) return `${totalMs}ms`;
    return `${(totalMs / 1000).toFixed(1)}s`;
  }

  trackByCallId(index: number, event: ToolCallEvent): string {
    return `${event.callId}-${event.phase}`;
  }

  formatParams(params: any): string {
    if (!params) return '';
    try {
      const str = JSON.stringify(params);
      return str.length > 50 ? str.substring(0, 47) + '...' : str;
    } catch {
      return '';
    }
  }

  private handleToolCallEvent(data: any): void {
    const event: ToolCallEvent = {
      callId: data.call_id || data.callId || '',
      tool: data.tool || 'unknown',
      method: data.method || '',
      phase: data.phase || 'start',
      params: data.params,
      statusCode: data.status_code || data.statusCode,
      durationMs: data.duration_ms || data.durationMs,
      responseSize: data.response_size || data.responseSize,
      error: data.error,
      timestamp: data.timestamp || new Date().toISOString(),
      mcpName: data.mcp_name || data.mcpName
    };

    this.events.push(event);

    const now = Date.now();
    if (now - this.lastRender >= this.renderThrottleMs) {
      this.lastRender = now;
      this.cdr.detectChanges();
    } else if (!this.pendingUpdate) {
      this.pendingUpdate = true;
      setTimeout(() => {
        this.pendingUpdate = false;
        this.lastRender = Date.now();
        this.cdr.detectChanges();
      }, this.renderThrottleMs);
    }
  }
}
