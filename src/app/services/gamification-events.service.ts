import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AgentMetricsService, AgentExecutionMetrics } from './agent-metrics.service';
import { AgentPersonalizationService } from './agent-personalization.service';

export type GamificationSeverity = 'info' | 'warning' | 'error';

export interface GamificationEvent {
  id: string;
  title: string;
  severity: GamificationSeverity;
  timestamp: number; // epoch ms
  meta?: Record<string, unknown>;
  category?: 'build' | 'critical' | 'analysis' | 'success' | 'alert';
}

@Injectable({ providedIn: 'root' })
export class GamificationEventsService {
  private readonly eventsSubject = new BehaviorSubject<GamificationEvent[]>([]);
  public readonly events$: Observable<GamificationEvent[]> = this.eventsSubject.asObservable();

  private lastTotalsByAgentId = new Map<string, number>();
  private readonly maxEvents = 50;

  constructor(
    private readonly metricsService: AgentMetricsService,
    private readonly personalization: AgentPersonalizationService,
  ) {
    this.metricsService.metrics$.subscribe(metricsMap => {
      try {
        this.deriveExecutionEvents(metricsMap);
      } catch (err) {
        this.pushEvent({
          id: this.generateId(),
          title: 'Falha ao atualizar eventos de gamificação',
          severity: 'warning',
          timestamp: Date.now(),
          meta: { error: String(err) }
        });
      }
    });
  }

  getRecent(limit: number): GamificationEvent[] {
    const list = this.eventsSubject.value;
    return list.slice(-limit).reverse();
  }

  pushEvent(event: GamificationEvent): void {
    const list = [...this.eventsSubject.value, event];
    const bounded = list.length > this.maxEvents ? list.slice(list.length - this.maxEvents) : list;
    this.eventsSubject.next(bounded);
  }

  private deriveExecutionEvents(metricsMap: Map<string, AgentExecutionMetrics>): void {
    for (const [agentId, metrics] of metricsMap.entries()) {
      const prevTotal = this.lastTotalsByAgentId.get(agentId) ?? 0;
      const currentTotal = Math.max(0, metrics.totalExecutions || 0);

      if (currentTotal > prevTotal) {
        const delta = currentTotal - prevTotal;
        const title = this.humanizeExecution(agentId, delta);
        this.pushEvent({
          id: this.generateId(),
          title,
          severity: 'info',
          timestamp: Date.now(),
          meta: {
            agentId,
            totalExecutions: currentTotal,
            lastExecutionTime: metrics.lastExecutionTime?.toISOString?.() || null
          },
          category: 'success'
        });
      }

      this.lastTotalsByAgentId.set(agentId, currentTotal);
    }

    if (metricsMap.size === 0 && this.eventsSubject.value.length === 0) {
      this.pushEvent({
        id: this.generateId(),
        title: 'Sem dados de agentes ainda — aguardando sincronização',
        severity: 'warning',
        timestamp: Date.now(),
        category: 'alert'
      });
    }
  }

  private humanizeExecution(agentId: string, delta: number): string {
    try {
      const profile = this.personalization.getProfile(agentId);
      const action = delta > 1 ? `concluiu ${delta} execuções` : 'concluiu uma execução';
      return `${profile.emoji} ${profile.role.split(' ')[0]} ${profile.displayName} ${action}`;
    } catch {
      return `Execução concluída por ${agentId} (+${delta})`;
    }
  }

  // Optional extension point: add methods to push other categories
  pushBuildEvent(message: string, meta?: Record<string, unknown>): void {
    this.pushEvent({ id: this.generateId(), title: `🏗️ ${message}`, severity: 'info', timestamp: Date.now(), meta, category: 'build' });
  }

  pushCriticalEvent(message: string, meta?: Record<string, unknown>): void {
    this.pushEvent({ id: this.generateId(), title: `🔥 ${message}`, severity: 'error', timestamp: Date.now(), meta, category: 'critical' });
  }

  pushAnalysisEvent(message: string, meta?: Record<string, unknown>): void {
    this.pushEvent({ id: this.generateId(), title: `📊 ${message}`, severity: 'info', timestamp: Date.now(), meta, category: 'analysis' });
  }

  private generateId(): string {
    try {
      // @ts-ignore
      return crypto?.randomUUID?.() ?? `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    } catch {
      return `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    }
  }
}
