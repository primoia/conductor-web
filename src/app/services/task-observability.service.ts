import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

/**
 * Status de uma task no fluxo de observabilidade
 */
export type TaskStatus = 'inputted' | 'submitted' | 'pending' | 'processing' | 'completed' | 'error';

/**
 * Representação de uma task no sistema
 */
export interface ObservableTask {
  task_id: string;
  agent_id: string;
  agent_name: string;
  agent_emoji: string;
  instance_id: string;
  conversation_id: string;
  screenplay_id?: string;
  status: TaskStatus;
  input_text: string;
  created_at: Date;
  updated_at: Date;
  result?: string;
  error?: string;
  duration_ms?: number;
}

/**
 * Payload para submeter uma task
 */
export interface TaskSubmitPayload {
  task_id: string;
  agent_id: string;
  agent_name: string;
  agent_emoji: string;
  instance_id: string;
  conversation_id: string;
  screenplay_id?: string;
  input_text: string;
  cwd?: string;
  ai_provider?: string;
}

/**
 * Evento de task para o WebSocket
 */
export interface TaskEvent {
  type: 'task_inputted' | 'task_submitted' | 'task_picked' | 'task_processing' | 'task_completed' | 'task_error';
  data: {
    task_id: string;
    agent_id: string;
    agent_name: string;
    agent_emoji: string;
    instance_id: string;
    conversation_id?: string;
    screenplay_id?: string;
    status: TaskStatus;
    timestamp: string;
    duration_ms?: number;
    result_summary?: string;
    level?: 'debug' | 'info' | 'result';
  };
  timestamp: number;
}

/**
 * 🔥 TaskObservabilityService
 *
 * Serviço responsável por:
 * 1. Gerar task_id no frontend (antes de enviar para o backend)
 * 2. Submeter tasks para o MongoDB via API
 * 3. Emitir eventos locais de status para observabilidade imediata
 * 4. Rastrear o ciclo de vida completo de cada task
 *
 * Fluxo:
 * 1. Frontend gera task_id (UUID)
 * 2. Chama POST /api/tasks/submit com status "inputted"
 * 3. Emite evento local task_inputted
 * 4. Gateway salva no MongoDB e emite task_submitted via WebSocket
 * 5. Watcher pega job e emite task_picked
 * 6. Watcher finaliza e emite task_completed/error
 */
@Injectable({
  providedIn: 'root'
})
export class TaskObservabilityService {
  private baseUrl = '';

  // Map de tasks ativas (task_id -> ObservableTask)
  private activeTasks = new Map<string, ObservableTask>();

  // Subject para eventos de task locais (antes de WebSocket)
  private localTaskEvents = new Subject<TaskEvent>();
  public localTaskEvents$ = this.localTaskEvents.asObservable();

  // BehaviorSubject para lista de tasks ativas
  private activeTasksSubject = new BehaviorSubject<ObservableTask[]>([]);
  public activeTasks$ = this.activeTasksSubject.asObservable();

  constructor(private http: HttpClient) {
    console.log('[TaskObservabilityService] Initialized');
  }

  /**
   * Gera um novo task_id único (UUID v4)
   */
  generateTaskId(): string {
    // Usar crypto.randomUUID() se disponível, senão fallback
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback para browsers antigos
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Emite evento local task_inputted para feedback imediato na UI
   * NÃO chama API, apenas emite evento local para o event-ticker
   *
   * @param payload Dados da task (sem task_id obrigatório, será gerado se não existir)
   */
  emitInputtedEvent(payload: Partial<TaskSubmitPayload> & { agent_id: string; agent_name: string; instance_id: string; conversation_id: string; input_text: string }): void {
    const now = new Date();
    const taskId = payload.task_id || this.generateTaskId();

    // Criar task local com status "inputted"
    const task: ObservableTask = {
      task_id: taskId,
      agent_id: payload.agent_id,
      agent_name: payload.agent_name,
      agent_emoji: payload.agent_emoji || '🤖',
      instance_id: payload.instance_id,
      conversation_id: payload.conversation_id,
      screenplay_id: payload.screenplay_id,
      status: 'inputted',
      input_text: payload.input_text,
      created_at: now,
      updated_at: now
    };

    // Salvar localmente
    this.activeTasks.set(taskId, task);
    this.updateActiveTasksList();

    // Emitir evento local imediatamente
    this.emitLocalEvent('task_inputted', task);

    console.log(`📝 [TaskObservability] Emitted task_inputted for immediate feedback`);
  }

  /**
   * Submete uma nova task para o sistema
   *
   * @param payload Dados da task
   * @returns Observable com resposta da API
   */
  submitTask(payload: TaskSubmitPayload): Observable<any> {
    const now = new Date();

    // Criar task local com status "inputted"
    const task: ObservableTask = {
      task_id: payload.task_id,
      agent_id: payload.agent_id,
      agent_name: payload.agent_name,
      agent_emoji: payload.agent_emoji,
      instance_id: payload.instance_id,
      conversation_id: payload.conversation_id,
      screenplay_id: payload.screenplay_id,
      status: 'inputted',
      input_text: payload.input_text,
      created_at: now,
      updated_at: now
    };

    // Salvar localmente
    this.activeTasks.set(payload.task_id, task);
    this.updateActiveTasksList();

    // Emitir evento local imediatamente (antes de enviar para API)
    this.emitLocalEvent('task_inputted', task);

    console.log(`📝 [TaskObservability] Task ${payload.task_id} created with status 'inputted'`);

    // Enviar para API
    return this.http.post(`${this.baseUrl}/api/tasks/submit`, payload).pipe(
      tap((response: any) => {
        console.log(`✅ [TaskObservability] Task ${payload.task_id} submitted to API`);

        // Atualizar status local para "submitted"
        this.updateTaskStatus(payload.task_id, 'submitted');
        this.emitLocalEvent('task_submitted', this.activeTasks.get(payload.task_id)!);
      }),
      catchError((error) => {
        console.error(`❌ [TaskObservability] Failed to submit task ${payload.task_id}:`, error);

        // Marcar como erro
        this.updateTaskStatus(payload.task_id, 'error', 'Failed to submit task to API');
        this.emitLocalEvent('task_error', this.activeTasks.get(payload.task_id)!);

        throw error;
      })
    );
  }

  /**
   * Atualiza o status de uma task
   */
  updateTaskStatus(taskId: string, status: TaskStatus, error?: string, result?: string, durationMs?: number): void {
    const task = this.activeTasks.get(taskId);
    if (task) {
      task.status = status;
      task.updated_at = new Date();
      if (error) task.error = error;
      if (result) task.result = result;
      if (durationMs) task.duration_ms = durationMs;

      this.updateActiveTasksList();
      console.log(`🔄 [TaskObservability] Task ${taskId} status updated to '${status}'`);
    }
  }

  /**
   * Processa evento de WebSocket recebido
   */
  handleWebSocketEvent(event: TaskEvent): void {
    const taskId = event.data.task_id;
    const task = this.activeTasks.get(taskId);

    if (task) {
      // Atualizar status baseado no tipo de evento
      switch (event.type) {
        case 'task_picked':
        case 'task_processing':
          this.updateTaskStatus(taskId, 'processing');
          break;
        case 'task_completed':
          this.updateTaskStatus(taskId, 'completed', undefined, event.data.result_summary, event.data.duration_ms);
          break;
        case 'task_error':
          this.updateTaskStatus(taskId, 'error', event.data.result_summary);
          break;
      }
    } else {
      // Task não foi criada localmente (pode ser de outro cliente)
      // Criar entrada para tracking
      console.log(`🔍 [TaskObservability] Received event for unknown task ${taskId}`);
    }
  }

  /**
   * Obter task por ID
   */
  getTask(taskId: string): ObservableTask | undefined {
    return this.activeTasks.get(taskId);
  }

  /**
   * Limpar tasks completadas ou com erro antigas
   */
  cleanupOldTasks(maxAgeMs: number = 300000): void { // 5 minutos por padrão
    const now = Date.now();
    const toRemove: string[] = [];

    this.activeTasks.forEach((task, taskId) => {
      if ((task.status === 'completed' || task.status === 'error') &&
          (now - task.updated_at.getTime()) > maxAgeMs) {
        toRemove.push(taskId);
      }
    });

    toRemove.forEach(taskId => {
      this.activeTasks.delete(taskId);
      console.log(`🧹 [TaskObservability] Cleaned up old task ${taskId}`);
    });

    if (toRemove.length > 0) {
      this.updateActiveTasksList();
    }
  }

  /**
   * Emite evento local para observabilidade imediata
   */
  private emitLocalEvent(type: TaskEvent['type'], task: ObservableTask): void {
    const event: TaskEvent = {
      type,
      data: {
        task_id: task.task_id,
        agent_id: task.agent_id,
        agent_name: task.agent_name,
        agent_emoji: task.agent_emoji,
        instance_id: task.instance_id,
        conversation_id: task.conversation_id,
        screenplay_id: task.screenplay_id,
        status: task.status,
        timestamp: new Date().toISOString(),
        duration_ms: task.duration_ms,
        result_summary: task.result?.substring(0, 200),
        level: this.getLevelForStatus(task.status)
      },
      timestamp: Date.now()
    };

    this.localTaskEvents.next(event);
    console.log(`📡 [TaskObservability] Emitted local event: ${type}`);
  }

  /**
   * Determina o level do evento baseado no status
   */
  private getLevelForStatus(status: TaskStatus): 'debug' | 'info' | 'result' {
    switch (status) {
      case 'inputted':
      case 'submitted':
        return 'debug';
      case 'pending':
      case 'processing':
        return 'info';
      case 'completed':
      case 'error':
        return 'result';
      default:
        return 'info';
    }
  }

  /**
   * Atualiza a lista de tasks ativas
   */
  private updateActiveTasksList(): void {
    const tasks = Array.from(this.activeTasks.values());
    this.activeTasksSubject.next(tasks);
  }
}
