import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, from } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import {
  AgentWithCouncilor,
  CouncilorExecutionResult,
  CouncilorReport,
  // New instance-based types
  CouncilorInstance,
  CouncilorInstanceListResponse,
  PromoteToCouncilorInstanceRequest,
  PromoteToCouncilorInstanceResponse
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

  /** Subject com lista de conselheiros ativos (legacy) */
  private councilorSubject = new BehaviorSubject<AgentWithCouncilor[]>([]);
  public councilors$ = this.councilorSubject.asObservable();

  /** Subject com lista de councilor instances (NEW) */
  private councilorInstancesSubject = new BehaviorSubject<CouncilorInstance[]>([]);
  public councilorInstances$ = this.councilorInstancesSubject.asObservable();

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
   * Inicializa o serviço carregando conselheiros do backend
   *
   * ⚠️ IMPORTANTE: O agendamento (setInterval) foi REMOVIDO do frontend!
   * O backend (CouncilorBackendScheduler) agora é responsável por executar
   * os conselheiros nos intervalos configurados. Isso garante que:
   * - Jobs não param quando o navegador fecha
   * - Jobs não duplicam quando abrir em outro navegador
   * - Jobs sobrevivem a reload da página
   *
   * O frontend apenas:
   * - Carrega lista de conselheiros para exibição
   * - Permite execução manual via /api/councilors/{id}/execute-now
   * - Recebe eventos via WebSocket (councilor_started, councilor_completed)
   */
  async initialize(): Promise<void> {
    try {
      console.log('🏛️ [COUNCILOR SCHEDULER] Inicializando serviço (modo display-only)...');
      console.log('📡 Backend scheduler é responsável pela execução periódica');

      // Carregar conselheiros ativos do backend (apenas para exibição)
      const councilors = await this.loadCouncilorsFromBackend();

      console.log(`🏛️ [COUNCILOR SCHEDULER] ${councilors.length} conselheiros carregados`);

      // ⚠️ NÃO agendar tarefas no frontend - backend faz isso!
      // for (const councilor of councilors) {
      //   if (councilor.councilor_config?.schedule.enabled) {
      //     this.scheduleTask(councilor);
      //   }
      // }

      // Atualizar subject para exibição no dashboard
      this.councilorSubject.next(councilors);

      if (councilors.length > 0) {
        this.gamificationEvents.pushEvent({
          id: this.generateId(),
          title: `🏛️ Conselho: ${councilors.length} conselheiros ativos (backend scheduler)`,
          severity: 'info',
          timestamp: Date.now(),
          category: 'success'
        });
      }

      console.log('✅ [COUNCILOR SCHEDULER] Serviço inicializado (backend controla execução)');
    } catch (error) {
      console.error('❌ [COUNCILOR SCHEDULER] Erro ao inicializar:', error);

      this.gamificationEvents.pushCriticalEvent(
        'Falha ao carregar Conselho',
        { error: String(error) }
      );
    }
  }

  /**
   * Carrega conselheiros do backend (LEGACY - mantido para compatibilidade)
   */
  private async loadCouncilorsFromBackend(): Promise<AgentWithCouncilor[]> {
    try {
      const response = await fetch('/api/councilors?is_councilor=true');

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

  // ========== NEW Instance-Based Methods ==========

  /**
   * Carrega councilor instances do backend (NEW)
   * Usa o novo endpoint GET /api/councilors/instances
   */
  async loadCouncilorInstances(): Promise<CouncilorInstance[]> {
    try {
      console.log('🏛️ [COUNCILOR SCHEDULER] Carregando councilor instances...');

      const response = await fetch('/api/councilors/instances');

      if (!response.ok) {
        throw new Error(`Failed to load councilor instances: ${response.status}`);
      }

      const data: CouncilorInstanceListResponse = await response.json();
      const instances = data.instances || [];

      console.log(`🏛️ [COUNCILOR SCHEDULER] ${instances.length} councilor instances carregados`);

      // Atualizar subject
      this.councilorInstancesSubject.next(instances);

      return instances;
    } catch (error) {
      console.warn('⚠️ [COUNCILOR SCHEDULER] Erro ao carregar councilor instances:', error);
      return [];
    }
  }

  /**
   * Promove um agente para councilor instance (NEW)
   * Usa o novo endpoint POST /api/councilors/promote
   */
  async promoteToCouncilorInstance(
    agentId: string,
    councilorConfig: any,
    customization?: { display_name?: string }
  ): Promise<PromoteToCouncilorInstanceResponse> {
    console.log(`⭐ [COUNCILOR SCHEDULER] Promovendo agente '${agentId}' para councilor instance`);

    const request: PromoteToCouncilorInstanceRequest = {
      agent_id: agentId,
      councilor_config: councilorConfig,
      customization: customization
    };

    const response = await fetch('/api/councilors/promote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Failed to promote: ${response.status}`);
    }

    const result: PromoteToCouncilorInstanceResponse = await response.json();
    console.log('✅ [COUNCILOR SCHEDULER] Promoção concluída:', result);

    // Recarregar lista de instances
    await this.loadCouncilorInstances();

    return result;
  }

  /**
   * Remove um councilor instance (NEW)
   * Usa o novo endpoint DELETE /api/councilors/instances/{instance_id}
   */
  async demoteCouncilorInstance(instanceId: string): Promise<void> {
    console.log(`🔻 [COUNCILOR SCHEDULER] Demovendo councilor instance: ${instanceId}`);

    const response = await fetch(`/api/councilors/instances/${instanceId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Failed to demote: ${response.status}`);
    }

    console.log(`✅ [COUNCILOR SCHEDULER] Instance '${instanceId}' demovida`);

    // Atualizar lista local
    const currentInstances = this.councilorInstancesSubject.value;
    this.councilorInstancesSubject.next(
      currentInstances.filter(i => i.instance_id !== instanceId)
    );
  }

  /**
   * Obtém lista de councilor instances ativos
   */
  getActiveCouncilorInstances(): CouncilorInstance[] {
    return this.councilorInstancesSubject.value;
  }

  /**
   * @deprecated O agendamento agora é feito pelo backend (CouncilorBackendScheduler)
   * Este método não deve mais ser usado. Mantido apenas para compatibilidade.
   *
   * O backend scheduler garante:
   * - Jobs continuam mesmo fechando o navegador
   * - Jobs não duplicam em múltiplos navegadores
   * - Jobs sobrevivem a restart do servidor
   */
  scheduleTask(councilor: AgentWithCouncilor): void {
    console.warn('⚠️ [COUNCILOR SCHEDULER] scheduleTask() está DEPRECATED! Backend controla agendamento.');

    const config = councilor.councilor_config;

    if (!config) {
      console.warn(`⚠️ [COUNCILOR SCHEDULER] Conselheiro ${councilor.agent_id} sem configuração`);
      return;
    }

    // ⚠️ NÃO criar timer local - backend é responsável
    // Cancelar qualquer timer existente para evitar duplicação
    this.cancelTask(councilor.agent_id);

    // Logging apenas para debug - não cria timer
    console.log(`📡 [COUNCILOR SCHEDULER] Backend scheduler controla: ${councilor.customization?.display_name || councilor.name} (${config.schedule.value})`);

    // ⚠️ REMOVIDO: setInterval no frontend
    // if (config.schedule.type === 'interval') {
    //   const intervalMs = this.parseInterval(config.schedule.value);
    //   const timer = window.setInterval(() => {
    //     this.executeTask(councilor);
    //   }, intervalMs);
    //   this.scheduledTasks.set(councilor.agent_id, timer);
    // }

    if (config.schedule.type !== 'interval') {
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

      const startTime = Date.now();

      // Executar via endpoint do backend (que não requer conversation_id)
      const response = await fetch(`/api/councilors/${agentId}/execute-now`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || `HTTP ${response.status}`);
      }

      const result = await response.json();
      const duration = Date.now() - startTime;

      console.log(`✅ [COUNCILOR SCHEDULER] ${displayName} completou tarefa em ${duration}ms`, result);

      // O resultado vem do backend com { success, message, execution: { status, agent_id, stats } }
      const executionData = result.execution || {};

      // Analisar severidade do resultado baseado nas stats
      const severity = this.analyzeSeverityFromStats(executionData.stats);

      // Criar relatório de execução
      const executionResult: CouncilorExecutionResult = {
        execution_id: this.generateId(),
        councilor_id: councilor.agent_id,
        started_at: new Date(startTime),
        completed_at: new Date(),
        status: executionData.status || 'completed',
        severity,
        output: result.message || 'Execução concluída',
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
   * Analisa as estatísticas da execução para determinar severidade
   */
  private analyzeSeverityFromStats(stats: any): 'success' | 'warning' | 'error' {
    if (!stats) return 'success';

    const successRate = stats.success_rate || 100;
    const lastStatus = stats.last_status;

    if (lastStatus === 'error' || successRate < 50) {
      return 'error';
    }

    if (lastStatus === 'warning' || successRate < 80) {
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
   *
   * ⚠️ Não cria timer local - apenas atualiza backend que controla o scheduler
   */
  async resumeTask(councilor: AgentWithCouncilor): Promise<void> {
    // ⚠️ NÃO chamar scheduleTask - backend scheduler é responsável
    // this.scheduleTask(councilor);

    // Atualizar no backend (que vai recarregar no CouncilorBackendScheduler)
    try {
      await fetch(`/api/agents/${councilor.agent_id}/councilor-schedule`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: true })
      });

      console.log(`▶️ [COUNCILOR SCHEDULER] Conselheiro retomado no backend: ${councilor.agent_id}`);
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
