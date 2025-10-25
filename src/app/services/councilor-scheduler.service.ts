import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, from } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import {
  AgentWithCouncilor,
  CouncilorExecutionResult,
  CouncilorReport
} from '../models/councilor.types';
import { AgentService } from './agent.service';
import { GamificationEventsService } from './gamification-events.service';

/**
 * Serviço responsável por agendar e executar tarefas automáticas de conselheiros
 *
 * Conselheiros são agentes promovidos que executam verificações periódicas
 * no projeto (ex: verificar CSS inline, testes, dependências vulneráveis)
 */
@Injectable({
  providedIn: 'root'
})
export class CouncilorSchedulerService implements OnDestroy {
  /** Mapa de timers agendados por agent_id */
  private scheduledTasks = new Map<string, number>();

  /** Lock para prevenir execuções simultâneas do mesmo conselheiro */
  private executionLock = new Set<string>();

  /** Subject com lista de conselheiros ativos */
  private councilorSubject = new BehaviorSubject<AgentWithCouncilor[]>([]);
  public councilors$ = this.councilorSubject.asObservable();

  /** Subject com contagem de investigações ativas */
  private activeInvestigationsSubject = new BehaviorSubject<number>(0);
  public activeInvestigations$ = this.activeInvestigationsSubject.asObservable();

  constructor(
    private agentService: AgentService,
    private gamificationEvents: GamificationEventsService
  ) {
    console.log('🏛️ [COUNCILOR SCHEDULER] Serviço inicializado');
  }

  /**
   * Inicializa o scheduler carregando conselheiros do backend
   * Deve ser chamado no app.component.ts ou similar
   */
  async initialize(): Promise<void> {
    try {
      console.log('🏛️ [COUNCILOR SCHEDULER] Inicializando scheduler...');

      // Carregar conselheiros ativos do backend
      const councilors = await this.loadCouncilorsFromBackend();

      console.log(`🏛️ [COUNCILOR SCHEDULER] ${councilors.length} conselheiros carregados`);

      // Agendar tarefas de cada conselheiro ativo
      for (const councilor of councilors) {
        if (councilor.councilor_config?.schedule.enabled) {
          this.scheduleTask(councilor);
        }
      }

      // Atualizar subject
      this.councilorSubject.next(councilors);

      this.gamificationEvents.pushEvent({
        id: this.generateId(),
        title: `🏛️ Conselho Municipal ativado com ${councilors.length} conselheiros`,
        severity: 'info',
        timestamp: Date.now(),
        category: 'success'
      });

      console.log('✅ [COUNCILOR SCHEDULER] Scheduler inicializado com sucesso');
    } catch (error) {
      console.error('❌ [COUNCILOR SCHEDULER] Erro ao inicializar:', error);

      this.gamificationEvents.pushCriticalEvent(
        'Falha ao inicializar Conselho Municipal',
        { error: String(error) }
      );
    }
  }

  /**
   * Carrega conselheiros do backend
   */
  private async loadCouncilorsFromBackend(): Promise<AgentWithCouncilor[]> {
    try {
      // TODO: Implementar endpoint GET /api/agents?is_councilor=true
      // Por enquanto, retorna lista vazia
      const response = await fetch('/api/agents?is_councilor=true');

      if (!response.ok) {
        throw new Error(`Failed to load councilors: ${response.status}`);
      }

      const data = await response.json();
      return data.agents || [];
    } catch (error) {
      console.warn('⚠️ [COUNCILOR SCHEDULER] Endpoint de conselheiros não disponível ainda:', error);
      return [];
    }
  }

  /**
   * Agenda uma tarefa periódica para um conselheiro
   */
  scheduleTask(councilor: AgentWithCouncilor): void {
    const config = councilor.councilor_config;

    if (!config) {
      console.warn(`⚠️ [COUNCILOR SCHEDULER] Conselheiro ${councilor.agent_id} sem configuração`);
      return;
    }

    // Cancelar tarefa anterior se existir
    this.cancelTask(councilor.agent_id);

    if (config.schedule.type === 'interval') {
      const intervalMs = this.parseInterval(config.schedule.value);

      console.log(`⏰ [COUNCILOR SCHEDULER] Agendando ${councilor.customization?.display_name || councilor.name} a cada ${config.schedule.value}`);

      const timer = window.setInterval(() => {
        this.executeTask(councilor);
      }, intervalMs);

      this.scheduledTasks.set(councilor.agent_id, timer);

      // Executar imediatamente na primeira vez (opcional)
      // this.executeTask(councilor);
    } else {
      // TODO: Implementar suporte a cron usando biblioteca como node-cron
      console.warn(`⚠️ [COUNCILOR SCHEDULER] Cron ainda não implementado para ${councilor.agent_id}`);
    }
  }

  /**
   * Executa a tarefa de um conselheiro
   */
  private async executeTask(councilor: AgentWithCouncilor): Promise<void> {
    const agentId = councilor.agent_id;
    const config = councilor.councilor_config!;
    const displayName = councilor.customization?.display_name || councilor.name;

    // Prevenir execuções simultâneas
    if (this.executionLock.has(agentId)) {
      console.log(`⏳ [COUNCILOR SCHEDULER] ${displayName} ainda executando tarefa anterior`);
      return;
    }

    this.executionLock.add(agentId);

    try {
      console.log(`🔎 [COUNCILOR SCHEDULER] ${displayName} iniciando tarefa: ${config.task.name}`);

      // Criar evento de início
      this.gamificationEvents.pushAnalysisEvent(
        `${displayName} iniciou patrulha: ${config.task.name}`
      );

      // Criar ID de instância único para esta execução
      const instanceId = this.agentService.generateInstanceId();

      // Executar agente
      const startTime = Date.now();

      const result = await this.agentService
        .executeAgent(
          councilor.agent_id,
          config.task.prompt,
          instanceId,
          undefined, // cwd
          undefined, // documentId
          undefined  // aiProvider
        )
        .toPromise();

      const duration = Date.now() - startTime;

      console.log(`✅ [COUNCILOR SCHEDULER] ${displayName} completou tarefa em ${duration}ms`);

      // Analisar severidade do resultado
      const severity = this.analyzeSeverity(result?.result || '');

      // Criar relatório de execução
      const executionResult: CouncilorExecutionResult = {
        execution_id: this.generateId(),
        councilor_id: councilor.agent_id,
        started_at: new Date(startTime),
        completed_at: new Date(),
        status: 'completed',
        severity,
        output: result?.result || '',
        duration_ms: duration
      };

      // Notificar se necessário
      if (this.shouldNotify(config.notifications, severity)) {
        this.notifyResult(councilor, executionResult);
      }

      // Salvar resultado no backend (opcional)
      await this.saveExecutionResult(executionResult);

    } catch (error) {
      console.error(`❌ [COUNCILOR SCHEDULER] Erro na tarefa de ${displayName}:`, error);

      if (config.notifications.on_error) {
        this.gamificationEvents.pushCriticalEvent(
          `${displayName}: Erro em "${config.task.name}"`,
          { error: String(error) }
        );
      }

    } finally {
      this.executionLock.delete(agentId);
    }
  }

  /**
   * Analisa o output do agente para determinar severidade
   */
  private analyzeSeverity(output: string): 'success' | 'warning' | 'error' {
    const lowerOutput = output.toLowerCase();

    // Palavras-chave que indicam erro
    const errorKeywords = ['crítico', 'erro', 'falha', 'critical', 'error', 'fail'];
    if (errorKeywords.some(keyword => lowerOutput.includes(keyword))) {
      return 'error';
    }

    // Palavras-chave que indicam warning
    const warningKeywords = ['alerta', 'atenção', 'warning', 'aviso', 'vulnerab'];
    if (warningKeywords.some(keyword => lowerOutput.includes(keyword))) {
      return 'warning';
    }

    return 'success';
  }

  /**
   * Determina se deve notificar baseado na configuração e severidade
   */
  private shouldNotify(notifications: any, severity: string): boolean {
    if (severity === 'error' && notifications.on_error) return true;
    if (severity === 'warning' && notifications.on_warning) return true;
    if (severity === 'success' && notifications.on_success) return true;
    return false;
  }

  /**
   * Envia notificação do resultado
   */
  private notifyResult(
    councilor: AgentWithCouncilor,
    result: CouncilorExecutionResult
  ): void {
    const config = councilor.councilor_config!;
    const displayName = councilor.customization?.display_name || councilor.name;
    const emoji = this.getSeverityEmoji(result.severity);

    const summary = this.getResultSummary(result.output || '');
    const message = `${emoji} ${displayName}: ${config.task.name} - ${summary}`;

    // Notificar no painel de eventos
    if (config.notifications.channels.includes('panel')) {
      const eventSeverity = result.severity === 'success' ? 'info' : result.severity === 'warning' ? 'warning' : 'error';

      this.gamificationEvents.pushEvent({
        id: this.generateId(),
        title: message,
        severity: eventSeverity,
        timestamp: Date.now(),
        category: result.severity === 'error' ? 'critical' : 'analysis',
        meta: {
          councilorId: councilor.agent_id,
          executionId: result.execution_id,
          fullReport: result.output
        }
      });
    }

    // TODO: Implementar toast notifications
    // if (config.notifications.channels.includes('toast')) { ... }

    // TODO: Implementar email notifications
    // if (config.notifications.channels.includes('email')) { ... }
  }

  /**
   * Obtém emoji baseado na severidade
   */
  private getSeverityEmoji(severity: string): string {
    switch (severity) {
      case 'error': return '🔥';
      case 'warning': return '⚠️';
      default: return '✅';
    }
  }

  /**
   * Extrai resumo do resultado (primeira linha ou primeiros 100 chars)
   */
  private getResultSummary(output: string): string {
    if (!output) return 'Sem resultado';

    const firstLine = output.split('\n')[0];
    return firstLine.length > 100 ? firstLine.substring(0, 100) + '...' : firstLine;
  }

  /**
   * Salva resultado de execução no backend (opcional)
   */
  private async saveExecutionResult(result: CouncilorExecutionResult): Promise<void> {
    try {
      // TODO: Implementar endpoint POST /api/councilors/executions
      console.log('💾 [COUNCILOR SCHEDULER] Salvando resultado:', result.execution_id);
    } catch (error) {
      console.warn('⚠️ [COUNCILOR SCHEDULER] Falha ao salvar resultado:', error);
    }
  }

  /**
   * Converte string de intervalo para millisegundos
   * @param value - Formato: "30m", "1h", "2h"
   */
  private parseInterval(value: string): number {
    const match = value.match(/^(\d+)(m|h|d)$/);

    if (!match) {
      console.warn(`⚠️ [COUNCILOR SCHEDULER] Formato de intervalo inválido: ${value}, usando padrão 30m`);
      return 30 * 60 * 1000; // default 30min
    }

    const [, numStr, unit] = match;
    const num = parseInt(numStr, 10);

    const multipliers = {
      m: 60_000,      // minutos
      h: 3600_000,    // horas
      d: 86400_000    // dias
    };

    return num * (multipliers[unit as keyof typeof multipliers] || 60_000);
  }

  /**
   * Cancela a tarefa agendada de um conselheiro
   */
  cancelTask(agentId: string): void {
    const timer = this.scheduledTasks.get(agentId);

    if (timer) {
      clearInterval(timer);
      this.scheduledTasks.delete(agentId);
      console.log(`⏸️ [COUNCILOR SCHEDULER] Tarefa cancelada: ${agentId}`);
    }
  }

  /**
   * Pausa a tarefa de um conselheiro
   */
  async pauseTask(agentId: string): Promise<void> {
    this.cancelTask(agentId);

    // Atualizar no backend
    try {
      await fetch(`/api/agents/${agentId}/councilor-schedule`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: false })
      });

      console.log(`⏸️ [COUNCILOR SCHEDULER] Conselheiro pausado: ${agentId}`);
    } catch (error) {
      console.error('❌ [COUNCILOR SCHEDULER] Erro ao pausar:', error);
    }
  }

  /**
   * Retoma a tarefa de um conselheiro
   */
  async resumeTask(councilor: AgentWithCouncilor): Promise<void> {
    this.scheduleTask(councilor);

    // Atualizar no backend
    try {
      await fetch(`/api/agents/${councilor.agent_id}/councilor-schedule`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: true })
      });

      console.log(`▶️ [COUNCILOR SCHEDULER] Conselheiro retomado: ${councilor.agent_id}`);
    } catch (error) {
      console.error('❌ [COUNCILOR SCHEDULER] Erro ao retomar:', error);
    }
  }

  /**
   * Obtém relatório de um conselheiro
   */
  getCouncilorReport(councilorId: string): Observable<CouncilorReport> {
    return from(
      fetch(`/api/agents/${councilorId}/councilor-reports`)
        .then(res => res.json())
    ).pipe(
      map(data => data.report),
      catchError(error => {
        console.error('❌ [COUNCILOR SCHEDULER] Erro ao buscar relatório:', error);
        throw error;
      })
    );
  }

  /**
   * Obtém lista de conselheiros ativos
   */
  getActiveCouncilors(): AgentWithCouncilor[] {
    return this.councilorSubject.value;
  }

  /**
   * Incrementa contador de investigações ativas
   */
  incrementActiveInvestigations(): void {
    this.activeInvestigationsSubject.next(this.activeInvestigationsSubject.value + 1);
  }

  /**
   * Decrementa contador de investigações ativas
   */
  decrementActiveInvestigations(): void {
    const current = this.activeInvestigationsSubject.value;
    this.activeInvestigationsSubject.next(Math.max(0, current - 1));
  }

  /**
   * Gera ID único
   */
  private generateId(): string {
    try {
      return crypto.randomUUID();
    } catch {
      return `councilor_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    }
  }

  /**
   * Limpa recursos quando o serviço é destruído
   */
  ngOnDestroy(): void {
    console.log('🏛️ [COUNCILOR SCHEDULER] Destruindo serviço e cancelando tarefas...');

    // Cancelar todas as tarefas agendadas
    for (const [agentId, timer] of this.scheduledTasks.entries()) {
      clearInterval(timer);
      console.log(`⏹️ [COUNCILOR SCHEDULER] Tarefa cancelada: ${agentId}`);
    }

    this.scheduledTasks.clear();
    this.executionLock.clear();
    this.councilorSubject.complete();
    this.activeInvestigationsSubject.complete();
  }
}
