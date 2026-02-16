import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { AgentMetricsService, AgentExecutionMetrics } from './agent-metrics.service';
import { AgentPersonalizationService } from './agent-personalization.service';
import { GamificationWebSocketService, GamificationWebSocketEvent } from './gamification-websocket.service';

export type GamificationSeverity = 'info' | 'warning' | 'error';
export type EventLevel = 'debug' | 'info' | 'result'; // Log levels
export type TaskStatus = 'inputted' | 'submitted' | 'pending' | 'processing' | 'completed' | 'error'; // Task execution status

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

/** Entry for the real-time debug console (append-only log) */
export interface StreamLogEntry {
  timestamp: number;
  agentId: string;
  type: 'system' | 'text' | 'tool_use' | 'tool_result' | 'result' | 'thinking' | 'other';
  text: string;
  meta?: Record<string, unknown>;
}

@Injectable({ providedIn: 'root' })
export class GamificationEventsService {
  private readonly eventsSubject = new BehaviorSubject<GamificationEvent[]>([]);
  public readonly events$: Observable<GamificationEvent[]> = this.eventsSubject.asObservable();

  /** Append-only debug console log (stream events) */
  private readonly streamLogSubject = new BehaviorSubject<StreamLogEntry[]>([]);
  public readonly streamLog$: Observable<StreamLogEntry[]> = this.streamLogSubject.asObservable();
  private readonly maxStreamLogEntries = 200;

  private lastTotalsByAgentId = new Map<string, number>();
  private readonly maxEvents = 50;
  private readonly seenExecutionIds = new Set<string>(); // Track execution_id to prevent duplicates
  private historicalEventsLoaded = false; // Flag to load historical events only once

  // 🔥 Subject para receber eventos locais de task (sem dependência circular)
  private localTaskEventSubject = new Subject<{type: string; data: any; timestamp?: number}>();

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

    // 🔥 Subscribe to local task events (via Subject, não via serviço)
    this.localTaskEventSubject.subscribe((event) => {
      try {
        console.log('📨 [GamificationEvents] Handling local task event:', event.type);
        this.handleWebSocketEvent(event as GamificationWebSocketEvent);
      } catch (err) {
        console.error('❌ Error handling local task event:', err);
      }
    });

    // 📊 Subscribe to metrics (FALLBACK mechanism - only if WebSocket disconnected)
    this.metricsService.metrics$.subscribe(metricsMap => {
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

    console.log('🎮 GamificationEventsService initialized');
  }

  /**
   * Método público para emitir eventos locais de task
   * Chamado diretamente pelo MessageHandlingService
   */
  emitLocalTaskEvent(type: string, data: any): void {
    console.log(`📡 [GamificationEvents] Emitting local event: ${type}`);
    this.localTaskEventSubject.next({ type, data, timestamp: Date.now() });
  }

  getRecent(limit: number): GamificationEvent[] {
    const list = this.eventsSubject.value;
    return list.slice(-limit).reverse();
  }

  pushEvent(event: GamificationEvent, skipDuplicateCheck = false): void {
    // Check for duplicates based on task_id or execution_id in meta
    const taskId = (event.meta?.['task_id'] || event.meta?.['execution_id']) as string | undefined;

    if (!skipDuplicateCheck && taskId) {
      if (this.seenExecutionIds.has(taskId)) {
        // Find existing event to check if level changed
        const existing = this.eventsSubject.value.find(ev => {
          const evTaskId = ev.meta?.['task_id'] || ev.meta?.['execution_id'];
          return evTaskId === taskId;
        });

        // If level changed (e.g., debug → result), create NEW event instead of overwriting
        if (existing && existing.level !== event.level) {
          console.log(`🆕 Level changed for task_id ${taskId}: ${existing.level} → ${event.level}, creating new event`);
          // Fall through to create new event below
        } else {
          // Same level: update in-place (e.g., submitted → picked, both debug)
          console.log(`🔄 Updating event for task_id: ${taskId} -> status: ${event.status}`);
          const list = this.eventsSubject.value.map(ev => {
            const evTaskId = ev.meta?.['task_id'] || ev.meta?.['execution_id'];
            if (evTaskId === taskId) {
              return { ...ev, ...event, id: ev.id };
            }
            return ev;
          });
          this.eventsSubject.next(list);
          return;
        }
      }
      this.seenExecutionIds.add(taskId);
    }

    const list = [...this.eventsSubject.value, event];
    const bounded = list.length > this.maxEvents ? list.slice(list.length - this.maxEvents) : list;
    this.eventsSubject.next(bounded);
  }

  /**
   * Push a raw agent_stream event into the append-only debug console log.
   * Parses the CLI stream-json event and extracts a human-readable line.
   */
  pushStreamLogEntry(data: any): void {
    const event = data.event || {};
    const agentId = data.agent_id || 'agent';
    const cliType = event.type || 'unknown';

    // Skip 'user' events (tool results from CLI - raw JSON, not useful in console)
    if (cliType === 'user') return;

    const entries: StreamLogEntry[] = [];

    if (cliType === 'system') {
      const sub = event.subtype || '';
      if (sub === 'init') {
        const tools = event.tools?.length || 0;
        const mcps = (event.mcp_servers || [])
          .filter((s: any) => s.status === 'connected')
          .map((s: any) => s.name);
        entries.push({
          timestamp: Date.now(), agentId, type: 'system',
          text: `session=${(event.session_id || '?').slice(0, 8)} tools=${tools} mcps=[${mcps.join(',')}]`
        });
      }
    } else if (cliType === 'assistant') {
      const content = event.message?.content || [];
      for (const block of content) {
        if (block.type === 'text' && block.text?.trim()) {
          const lines = block.text.split('\n').filter((l: string) => l.trim());
          for (const line of lines.slice(0, 8)) {
            entries.push({
              timestamp: Date.now(), agentId, type: 'text',
              text: line
            });
          }
          if (lines.length > 8) {
            entries.push({
              timestamp: Date.now(), agentId, type: 'text',
              text: `... (${lines.length} linhas total)`
            });
          }
        } else if (block.type === 'tool_use') {
          const name = block.name || '?';
          const input = block.input || {};
          const desc = input.description || input.command || input.pattern || input.query || input.file_path || '';
          const preview = typeof desc === 'string' ? desc : JSON.stringify(input);
          entries.push({
            timestamp: Date.now(), agentId, type: 'tool_use',
            text: `${name}: ${preview}`,
            meta: { tool_id: block.id }
          });
        } else if (block.type === 'tool_result') {
          const resultText = (block.content || [])
            .filter((c: any) => c.type === 'text')
            .map((c: any) => c.text)
            .join(' ');
          entries.push({
            timestamp: Date.now(), agentId, type: 'tool_result',
            text: resultText || '(empty)',
            meta: { tool_use_id: block.tool_use_id }
          });
        } else if (block.type === 'thinking' && block.thinking?.trim()) {
          entries.push({
            timestamp: Date.now(), agentId, type: 'thinking',
            text: block.thinking.replace(/\n/g, ' ')
          });
        }
      }
    } else if (cliType === 'result') {
      const sub = event.subtype || '?';
      const dur = event.duration_ms || 0;
      const cost = event.total_cost_usd || 0;
      const turns = event.num_turns || 0;
      entries.push({
        timestamp: Date.now(), agentId, type: 'result',
        text: `(${sub}) turns=${turns} duration=${dur}ms cost=$${cost.toFixed(4)}`
      });
    }

    if (entries.length === 0) {
      entries.push({
        timestamp: Date.now(), agentId, type: 'other',
        text: `[${cliType}] ${JSON.stringify(event).slice(0, 300)}`
      });
    }

    // Append to log
    const log = [...this.streamLogSubject.value, ...entries];
    const bounded = log.length > this.maxStreamLogEntries
      ? log.slice(log.length - this.maxStreamLogEntries)
      : log;
    this.streamLogSubject.next(bounded);
  }

  /** Clear the stream debug log */
  clearStreamLog(): void {
    this.streamLogSubject.next([]);
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
        // Use task_id (primary) or execution_id (legacy) for deduplication
        const eventTimestamp = backendEvent.timestamp || Date.now();
        const taskId = data.task_id || data.execution_id;
        const uniqueId = taskId && taskId.length > 0
          ? taskId
          : `hist_${eventTimestamp}_${data.instance_id || data.agent_id || 'unknown'}`;

        // Skip if we already have this event (deduplication)
        if (this.seenExecutionIds.has(uniqueId)) {
          console.log(`⏭️ Skipping duplicate historical event: ${uniqueId}`);
          continue;
        }

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
            task_id: uniqueId,
            execution_id: uniqueId // Keep for backward compatibility
          },
          category: isError ? 'critical' : 'success',
          level: data.level || 'result',
          summary: data.summary || data.result_summary || '',
          agentEmoji: data.agent_emoji || '🤖',
          agentName,
          status: data.status || 'completed'
        };

        // Mark as seen and push event
        this.seenExecutionIds.add(uniqueId);
        this.pushEvent(gamificationEvent, true); // Skip duplicate check since we already checked
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
        const label = displayIsSuccess ? 'Concluído' : this.getSeverityLabel(derivedSeverity); // Use 'Concluído' for consistency

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
        // DEPRECATED: Use task_completed instead
        console.log('⏭️ Ignoring agent_execution_completed (use task_completed)');
        break;

      case 'agent_metrics_updated':
        // Agent metrics updated (future use)
        console.log('📊 Agent metrics updated:', event.data);
        break;

      // ========================================================================
      // 🔥 Task Observability Events - Novos status de observabilidade
      // ========================================================================

      case 'task_submitted':
        // Task submitted to MongoDB (from Gateway)
        this.pushEvent({
          id: event.data.task_id || this.generateId(),
          title: `📤 ${event.data.agent_name || event.data.agent_id} - Na fila`,
          severity: 'info',
          timestamp: Date.now(),
          meta: {
            ...event.data,
            execution_id: event.data.task_id
          },
          category: 'analysis',
          level: 'debug',
          summary: 'Tarefa salva no MongoDB, aguardando processamento...',
          agentEmoji: event.data.agent_emoji || '🤖',
          agentName: event.data.agent_name || event.data.agent_id,
          status: 'pending'
        });
        break;

      case 'task_picked':
        // Task picked by Watcher (from Watcher)
        this.pushEvent({
          id: event.data.task_id || this.generateId(),
          title: `⚡ ${event.data.agent_name || event.data.agent_id} - Processando...`,
          severity: 'info',
          timestamp: Date.now(),
          meta: {
            ...event.data,
            execution_id: event.data.task_id
          },
          category: 'analysis',
          level: 'debug',
          summary: 'Watcher pegou a tarefa da fila, iniciando execução...',
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

      // ========================================================================
      // 📡 Agent Stream Events - Real-time Claude CLI streaming
      // ========================================================================

      case 'stream_start':
        // Agent started streaming (Watcher connected WS)
        this.pushEvent({
          id: event.data.task_id || this.generateId(),
          title: `📡 ${event.data.agent_id || 'Agent'} - Streaming iniciado`,
          severity: 'info',
          timestamp: Date.now(),
          meta: event.data,
          category: 'analysis',
          level: 'debug',
          agentName: event.data.agent_id,
          status: 'processing'
        });
        break;

      case 'agent_init':
        // Claude CLI initialized (news level)
        this.pushEvent({
          id: this.generateId(),
          title: `🔧 ${event.data.agent_id || 'Agent'} - CLI pronto (${event.data.tools_count || 0} tools)`,
          severity: 'info',
          timestamp: Date.now(),
          meta: event.data,
          category: 'analysis',
          level: 'info',
          agentName: event.data.agent_id,
          summary: event.data.mcp_servers?.length ? `MCPs: ${event.data.mcp_servers.join(', ')}` : undefined
        });
        break;

      case 'agent_stream':
        // Raw stream-json event (debug level) - push to debug log
        this.pushStreamLogEntry(event.data);
        break;

      case 'agent_result':
        // Claude CLI finished (news level)
        const costUsd = event.data.cost_usd;
        const durationMs = event.data.duration_ms;
        const durationStr = durationMs ? `${Math.round(durationMs / 1000)}s` : '';
        this.pushEvent({
          id: this.generateId(),
          title: `📊 ${event.data.agent_id || 'Agent'} - Resultado ${durationStr}`,
          severity: event.data.subtype === 'error' ? 'error' : 'info',
          timestamp: Date.now(),
          meta: event.data,
          category: event.data.subtype === 'error' ? 'critical' : 'success',
          level: 'info',
          agentName: event.data.agent_id,
          summary: costUsd ? `Custo: $${costUsd.toFixed(4)}` : undefined
        });
        break;

      case 'stream_end':
        // Agent finished streaming
        const stats = event.data.stats || {};
        this.pushEvent({
          id: event.data.task_id || this.generateId(),
          title: `📡 ${event.data.agent_id || 'Agent'} - Stream finalizado`,
          severity: 'info',
          timestamp: Date.now(),
          meta: event.data,
          category: 'success',
          level: 'debug',
          agentName: event.data.agent_id,
          summary: stats.tool_calls ? `${stats.tool_calls} tool calls, ${stats.tokens_out || 0} tokens out` : undefined,
          status: 'completed'
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
