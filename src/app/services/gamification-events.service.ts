import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { AgentMetricsService, AgentExecutionMetrics } from './agent-metrics.service';
import { AgentPersonalizationService } from './agent-personalization.service';
import { GamificationWebSocketService, GamificationWebSocketEvent } from './gamification-websocket.service';

export type GamificationSeverity = 'info' | 'warning' | 'error';
export type EventLevel = 'debug' | 'info' | 'result'; // Log levels
export type TaskStatus = 'pending' | 'processing' | 'completed' | 'error'; // Task execution status

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
  status?: TaskStatus; // Status da execução (para UI rica com cores e animações)
}

@Injectable({ providedIn: 'root' })
export class GamificationEventsService {
  private readonly eventsSubject = new BehaviorSubject<GamificationEvent[]>([]);
  public readonly events$: Observable<GamificationEvent[]> = this.eventsSubject.asObservable();

  private lastTotalsByAgentId = new Map<string, number>();
  private readonly maxEvents = 50;
  private readonly seenExecutionIds = new Set<string>(); // Track execution_id to prevent duplicates
  private historicalEventsLoaded = false; // Flag to load historical events only once

  constructor(
    private readonly metricsService: AgentMetricsService,
    private readonly personalization: AgentPersonalizationService,
    private readonly websocketService: GamificationWebSocketService,
    private readonly http: HttpClient
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

    // 📜 Load historical events from MongoDB on initialization
    this.loadHistoricalEvents();

    console.log('🎮 GamificationEventsService initialized with WebSocket (primary) + metrics polling (fallback) + historical events loading');
  }

  getRecent(limit: number): GamificationEvent[] {
    const list = this.eventsSubject.value;
    return list.slice(-limit).reverse();
  }

  pushEvent(event: GamificationEvent, skipDuplicateCheck = false): void {
    // Check for duplicates based on execution_id in meta
    if (!skipDuplicateCheck && event.meta?.['execution_id']) {
      const executionId = event.meta['execution_id'] as string;

      // For task status updates (task_completed, task_error), UPDATE existing event instead of skipping
      if (this.seenExecutionIds.has(executionId)) {
        const newStatus = event.status;

        // If this is a status update (completed/error), update the existing event
        if (newStatus === 'completed' || newStatus === 'error') {
          console.log(`🔄 Updating event status for execution_id: ${executionId} -> ${newStatus}`);
          const list = this.eventsSubject.value.map(ev => {
            if (ev.meta?.['execution_id'] === executionId) {
              return {
                ...ev,
                ...event,
                // Keep original timestamp for ordering, but update everything else
                id: ev.id
              };
            }
            return ev;
          });
          this.eventsSubject.next(list);
          return;
        }

        // For other duplicates, skip
        console.log(`⏭️ Skipping duplicate event for execution_id: ${executionId}`);
        return;
      }
      this.seenExecutionIds.add(executionId);
    }

    const list = [...this.eventsSubject.value, event];
    const bounded = list.length > this.maxEvents ? list.slice(list.length - this.maxEvents) : list;
    this.eventsSubject.next(bounded);
  }

  /**
   * Load historical events from MongoDB (via /api/tasks/events endpoint)
   * This is called once on service initialization to populate events after page reload
   */
  private async loadHistoricalEvents(): Promise<void> {
    if (this.historicalEventsLoaded) {
      console.log('⏭️ Historical events already loaded, skipping');
      return;
    }

    try {
      console.log('📜 Loading historical events from MongoDB...');

      // Call backend endpoint to get last 50 events
      const response: any = await this.http.get('/api/tasks/events?limit=50').toPromise();

      if (!response?.success || !Array.isArray(response.events)) {
        console.warn('⚠️ Invalid response from /api/tasks/events:', response);
        return;
      }

      const historicalEvents = response.events;
      console.log(`📥 Received ${historicalEvents.length} historical events from backend`);

      // Transform backend events to GamificationEvent format
      // Events are already in reverse chronological order (most recent first)
      // We need to push them in chronological order (oldest first) to maintain order
      const eventsToAdd = historicalEvents.reverse();

      for (const backendEvent of eventsToAdd) {
        const data = backendEvent.data || {};

        // Generate unique ID for this historical event
        // Use execution_id if available, otherwise generate from timestamp + instance_id
        const eventTimestamp = backendEvent.timestamp || Date.now();
        const uniqueId = data.execution_id && data.execution_id.length > 0
          ? data.execution_id
          : `hist_${eventTimestamp}_${data.instance_id || data.agent_id || 'unknown'}`;

        // Determine severity
        const severity = this.mapSeverityToGamification(data.severity || 'success');

        // Determine emoji and label based on status
        const isSuccess = data.status === 'completed' || (data.severity === 'success' && data.status !== 'error');
        const isError = data.status === 'error';
        const emoji = isError ? '❌' : (isSuccess ? '✅' : this.getSeverityEmoji(severity));
        const label = isError ? 'Erro' : (isSuccess ? 'Concluído' : this.getSeverityLabel(severity));

        // Build title with duration if available
        const agentName = data.agent_name || data.agent_id || 'Agente';
        const durationStr = data.duration_ms ? ` (${Math.round(data.duration_ms / 1000)}s)` : '';
        const title = `${emoji} ${agentName} - ${label}${durationStr}`;

        // Create GamificationEvent
        const gamificationEvent: GamificationEvent = {
          id: uniqueId,
          title,
          severity: isError ? 'error' : severity,
          timestamp: eventTimestamp,
          meta: {
            ...data,
            execution_id: uniqueId // Use our generated unique ID for deduplication
          },
          category: isError ? 'critical' : 'success',
          level: data.level || 'result',
          summary: data.summary || '',
          agentEmoji: data.agent_emoji || '🤖',
          agentName,
          status: data.status || 'completed'
        };

        // Push event (deduplication will prevent duplicates)
        this.pushEvent(gamificationEvent);
      }

      this.historicalEventsLoaded = true;
      console.log(`✅ Successfully loaded ${eventsToAdd.length} historical events`);

    } catch (error) {
      console.error('❌ Error loading historical events:', error);
      // Don't throw - gracefully degrade to empty history
    }
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
        // IGNORED: Redundant with task_started from Watcher which is more precise
        // (task_started fires when processing actually starts, not just when task is created)
        console.log('⏭️ Ignoring agent_execution_started (use task_started instead)');
        break;

      case 'agent_execution_completed':
        // Regular agent execution completed (RESULT level)
        // NOTE: This event comes from SSE streaming and may be redundant with task_completed
        // We use task_id as execution_id to deduplicate with task_completed events
        const agentDurationSec = Math.round(event.data.duration_ms / 1000);

        // Derive severity and summary, prefer result/status
        const a = event.data || {};

        // Use task_id as execution_id for deduplication with task_completed
        const agentExecutionId = a.task_id || a.execution_id || a.instance_id;

        // Skip if we already have a task_completed for this execution
        if (agentExecutionId && this.seenExecutionIds.has(agentExecutionId)) {
          console.log(`⏭️ Skipping agent_execution_completed - already have task event for: ${agentExecutionId}`);
          break;
        }

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
          id: agentExecutionId || this.generateId(),
          title: `${agentEmoji} ${a.agent_name || a.agent_id} - ${agentLabel}`,
          severity: agentDerivedSeverity,
          timestamp: Date.now(),
          meta: {
            ...a,
            execution_id: agentExecutionId // Ensure execution_id for deduplication
          },
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

      case 'task_started':
        // Task execution started (from Watcher)
        this.pushEvent({
          id: event.data.task_id || this.generateId(),
          title: `🔄 ${event.data.agent_name || event.data.agent_id} - Executando...`,
          severity: 'info',
          timestamp: Date.now(),
          meta: {
            ...event.data,
            execution_id: event.data.task_id
          },
          category: 'analysis',
          level: 'debug',
          summary: 'Tarefa iniciada, aguardando resultado...',
          agentEmoji: event.data.agent_emoji || '🤖',
          agentName: event.data.agent_name || event.data.agent_id,
          status: 'processing'
        });
        break;

      case 'task_completed':
        // Task execution completed successfully (from Watcher)
        const taskDurationSec = Math.round((event.data.duration_ms || 0) / 1000);
        this.pushEvent({
          id: event.data.task_id || this.generateId(),
          title: `✅ ${event.data.agent_name || event.data.agent_id} - Concluído (${taskDurationSec}s)`,
          severity: 'info',
          timestamp: Date.now(),
          meta: {
            ...event.data,
            execution_id: event.data.task_id
          },
          category: 'success',
          level: 'result',
          summary: event.data.result_summary || 'Tarefa concluída com sucesso',
          agentEmoji: event.data.agent_emoji || '🤖',
          agentName: event.data.agent_name || event.data.agent_id,
          status: 'completed'
        });
        break;

      case 'task_error':
        // Task execution failed (from Watcher)
        this.pushEvent({
          id: event.data.task_id || this.generateId(),
          title: `❌ ${event.data.agent_name || event.data.agent_id} - Erro`,
          severity: 'error',
          timestamp: Date.now(),
          meta: {
            ...event.data,
            execution_id: event.data.task_id
          },
          category: 'critical',
          level: 'result',
          summary: event.data.result_summary || 'Falha na execução da tarefa',
          agentEmoji: event.data.agent_emoji || '🤖',
          agentName: event.data.agent_name || event.data.agent_id,
          status: 'error'
        });
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
