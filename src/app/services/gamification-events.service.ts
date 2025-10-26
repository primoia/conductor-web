import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AgentMetricsService, AgentExecutionMetrics } from './agent-metrics.service';
import { AgentPersonalizationService } from './agent-personalization.service';
import { GamificationWebSocketService, GamificationWebSocketEvent } from './gamification-websocket.service';

export type GamificationSeverity = 'info' | 'warning' | 'error';
export type EventLevel = 'debug' | 'info' | 'result'; // Log levels

export interface GamificationEvent {
  id: string;
  title: string;
  severity: GamificationSeverity;
  timestamp: number; // epoch ms
  meta?: Record<string, unknown>;
  category?: 'build' | 'critical' | 'analysis' | 'success' | 'alert';
  level?: EventLevel; // Log level (debug=execução, info=sistema, result=resultado do agente)
  summary?: string; // Resumo para exibição em formato news
  agentEmoji?: string; // Emoji do agente
  agentName?: string; // Nome do agente
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
    private readonly websocketService: GamificationWebSocketService
  ) {
    // 🔔 Subscribe to WebSocket events (PRIMARY mechanism - real-time)
    this.websocketService.events$.subscribe(event => {
      try {
        this.handleWebSocketEvent(event);
      } catch (err) {
        console.error('❌ Error handling WebSocket event:', err);
      }
    });

    // 📊 Subscribe to metrics (FALLBACK mechanism - only if WebSocket disconnected)
    // NOTE: This is kept as fallback but should rarely be used in practice
    // since WebSocket provides real-time events directly from backend
    this.metricsService.metrics$.subscribe(metricsMap => {
      // Only derive events if WebSocket is disconnected
      if (!this.websocketService.isConnected()) {
        try {
          this.deriveExecutionEvents(metricsMap);
        } catch (err) {
          console.error('❌ Error deriving events from metrics:', err);
        }
      }
    });

    console.log('🎮 GamificationEventsService initialized with WebSocket (primary) + metrics polling (fallback)');
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

  /**
   * Handle WebSocket events from backend
   */
  private handleWebSocketEvent(event: GamificationWebSocketEvent): void {
    console.log('📨 Handling WebSocket event:', event.type, event.data);

    switch (event.type) {
      case 'connected':
        // WebSocket connected successfully
        this.pushEvent({
          id: this.generateId(),
          title: '🔌 Conectado ao sistema de eventos em tempo real',
          severity: 'info',
          timestamp: Date.now(),
          meta: event.data,
          category: 'success'
        });
        break;

      case 'socket_connected':
        console.log('✅ WebSocket connection established');
        break;

      case 'socket_disconnected':
        console.warn('⚠️ WebSocket disconnected:', event.data);
        break;

      case 'councilor_started':
        // Councilor execution started
        this.pushEvent({
          id: this.generateId(),
          title: `🏛️ ${event.data.task_name} - Iniciando análise...`,
          severity: 'info',
          timestamp: Date.now(),
          meta: event.data,
          category: 'analysis'
        });
        break;

      case 'councilor_completed':
        // Councilor execution completed
        const durationSec = Math.round(event.data.duration_ms / 1000);

        // Derive severity and summary from payload, prefer backend result/status
        const payload = event.data || {};
        const resultText: string | undefined = typeof payload.result === 'string' ? payload.result : (typeof payload.summary === 'string' ? payload.summary : undefined);
        const hasExplicitError = (payload.status === 'error') || (typeof payload.exit_code === 'number' && payload.exit_code !== 0);
        const errorHeuristics = typeof resultText === 'string' && /não encontrado|not found|erro|error|failed/i.test(resultText);
        const derivedSeverity = (hasExplicitError || errorHeuristics)
          ? 'error'
          : this.mapSeverityToGamification(payload.severity);

        // Preserve success label/emoji if backend marked success and no error detected
        const displayIsSuccess = !hasExplicitError && !errorHeuristics && payload.severity === 'success';
        const emoji = displayIsSuccess ? '✅' : this.getSeverityEmoji(derivedSeverity);
        const label = displayIsSuccess ? 'Sucesso' : this.getSeverityLabel(derivedSeverity);

        this.pushEvent({
          id: this.generateId(),
          title: `${emoji} ${payload.task_name} - ${label} (${durationSec}s)`,
          severity: derivedSeverity,
          timestamp: Date.now(),
          meta: payload,
          category: derivedSeverity === 'error' ? 'critical' : 'success',
          level: 'result',
          summary: resultText
        });
        break;

      case 'councilor_error':
        // Councilor execution failed
        this.pushCriticalEvent(`Erro em ${event.data.task_name}`, event.data);
        break;

      case 'agent_execution_started':
        // Regular agent execution started (DEBUG level)
        this.pushEvent({
          id: this.generateId(),
          title: `${event.data.agent_name || event.data.agent_id} - Executando...`,
          severity: 'info',
          timestamp: Date.now(),
          meta: event.data,
          category: 'analysis',
          level: event.data.level || 'debug',
          agentEmoji: event.data.agent_emoji || '🤖',
          agentName: event.data.agent_name || event.data.agent_id
        });
        break;

      case 'agent_execution_completed':
        // Regular agent execution completed (RESULT level)
        const agentDurationSec = Math.round(event.data.duration_ms / 1000);

        // Derive severity and summary, prefer result/status
        const a = event.data || {};
        const agentResultText: string | undefined = typeof a.result === 'string' ? a.result : (typeof a.summary === 'string' ? a.summary : undefined);
        const agentExplicitError = (a.status === 'error') || (typeof a.exit_code === 'number' && a.exit_code !== 0);
        const agentErrorHeuristics = typeof agentResultText === 'string' && /não encontrado|not found|erro|error|failed/i.test(agentResultText);
        const agentDerivedSeverity = (agentExplicitError || agentErrorHeuristics)
          ? 'error'
          : this.mapSeverityToGamification(a.severity);

        const agentDisplayIsSuccess = !agentExplicitError && !agentErrorHeuristics && a.severity === 'success';
        const agentEmoji = agentDisplayIsSuccess ? '✅' : this.getSeverityEmoji(agentDerivedSeverity);
        const agentLabel = agentDisplayIsSuccess ? 'Sucesso' : this.getSeverityLabel(agentDerivedSeverity);

        this.pushEvent({
          id: this.generateId(),
          title: `${agentEmoji} ${a.agent_name || a.agent_id} - ${agentLabel}`,
          severity: agentDerivedSeverity,
          timestamp: Date.now(),
          meta: a,
          category: agentDerivedSeverity === 'error' ? 'critical' : 'success',
          level: a.level || 'result',
          summary: agentResultText || `Execução completada em ${agentDurationSec}s`,
          agentEmoji: a.agent_emoji || '🤖',
          agentName: a.agent_name || a.agent_id
        });
        break;

      case 'agent_metrics_updated':
        // Agent metrics updated (future use)
        console.log('📊 Agent metrics updated:', event.data);
        break;

      case 'system_alert':
        // System alert (future use)
        this.pushEvent({
          id: this.generateId(),
          title: `⚠️ ${event.data.message}`,
          severity: 'warning',
          timestamp: Date.now(),
          meta: event.data,
          category: 'alert'
        });
        break;

      default:
        // Unknown event type
        console.log('❓ Unknown WebSocket event type:', event.type);
    }
  }

  private getSeverityEmoji(severity: string): string {
    switch (severity) {
      case 'error':
        return '🔥';
      case 'warning':
        return '⚠️';
      case 'success':
        return '✅';
      default:
        return 'ℹ️';
    }
  }

  private getSeverityLabel(severity: string): string {
    switch (severity) {
      case 'error':
        return 'Erro';
      case 'warning':
        return 'Alerta';
      case 'success':
        return 'Sucesso';
      default:
        return 'Info';
    }
  }

  private mapSeverityToGamification(severity: string): GamificationSeverity {
    switch (severity) {
      case 'error':
        return 'error';
      case 'warning':
        return 'warning';
      default:
        return 'info';
    }
  }
}
