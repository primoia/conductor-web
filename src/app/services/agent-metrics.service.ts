import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { AgentExecutionService, AgentExecutionState } from './agent-execution';

export interface AgentExecutionMetrics {
  totalExecutions: number;
  totalExecutionTime: number; // em millisegundos
  averageExecutionTime: number; // em millisegundos
  lastExecutionTime?: Date;
  isCurrentlyExecuting: boolean;
}

export interface AgentMetricsUpdate {
  agentId: string;
  metrics: AgentExecutionMetrics;
}

@Injectable({
  providedIn: 'root'
})
export class AgentMetricsService implements OnDestroy {
  private metricsSubject = new BehaviorSubject<Map<string, AgentExecutionMetrics>>(new Map());
  public metrics$ = this.metricsSubject.asObservable();

  private executionStartTimes = new Map<string, number>();
  private executionSubscription?: Subscription;
  private updateQueue: Array<{ agentId: string, action: 'start' | 'end' }> = [];
  private updateTimeout?: number;

  constructor(private agentExecutionService: AgentExecutionService) {
    this.initializeExecutionTracking();
  }

  /**
   * Inicializa o tracking automático de execuções
   */
  private initializeExecutionTracking(): void {
    this.executionSubscription = this.agentExecutionService.agentState$
      .pipe(
        debounceTime(50), // Debounce de 50ms para evitar atualizações excessivas
        distinctUntilChanged()
      )
      .subscribe(
        (agentStates) => this.handleExecutionStateChanges(agentStates)
      );
  }

  /**
   * Processa mudanças no estado de execução dos agentes
   * Otimizado para performance com muitos agentes
   */
  private handleExecutionStateChanges(agentStates: Map<string, AgentExecutionState>): void {
    // Limpa timeout anterior se existir
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }
    
    // Adiciona atualizações à fila
    for (const [agentId, executionState] of agentStates.entries()) {
      const currentMetrics = this.getCurrentMetrics(agentId);
      
      // Verifica se o agente começou a executar
      if (executionState.status === 'running' && !currentMetrics.isCurrentlyExecuting) {
        this.addToUpdateQueue(agentId, 'start');
      }
      
      // Verifica se o agente terminou a execução
      if ((executionState.status === 'completed' || executionState.status === 'error') && 
          currentMetrics.isCurrentlyExecuting) {
        this.addToUpdateQueue(agentId, 'end');
      }
    }
    
    // Processa atualizações com debounce
    this.updateTimeout = window.setTimeout(() => {
      this.processBatchUpdates(this.updateQueue);
      this.updateQueue = [];
    }, 100); // Debounce de 100ms
  }

  /**
   * Adiciona atualização à fila de processamento
   */
  private addToUpdateQueue(agentId: string, action: 'start' | 'end'): void {
    // Remove atualizações duplicadas para o mesmo agente
    this.updateQueue = this.updateQueue.filter(u => u.agentId !== agentId);
    this.updateQueue.push({ agentId, action });
  }

  /**
   * Processa atualizações em lote para melhor performance
   */
  private processBatchUpdates(updates: Array<{ agentId: string, action: 'start' | 'end' }>): void {
    if (updates.length === 0) return;
    
    // Usar requestAnimationFrame para otimizar renderização
    requestAnimationFrame(() => {
      // Agrupa atualizações por tipo para otimizar
      const startUpdates = updates.filter(u => u.action === 'start');
      const endUpdates = updates.filter(u => u.action === 'end');
      
      // Processa inícios de execução
      startUpdates.forEach(({ agentId }) => this.startExecution(agentId));
      
      // Processa fins de execução
      endUpdates.forEach(({ agentId }) => this.endExecution(agentId));
    });
  }

  /**
   * Inicia o tracking de uma execução de agente
   */
  startExecution(agentId: string): void {
    try {
      // Validação de entrada
      if (!agentId || typeof agentId !== 'string') {
        console.error('🎯 [METRICS] AgentId inválido para início de execução:', agentId);
        return;
      }

      // Verifica se já está executando
      if (this.executionStartTimes.has(agentId)) {
        console.warn(`🎯 [METRICS] Agente ${agentId} já está em execução. Ignorando início duplicado.`);
        return;
      }

      this.executionStartTimes.set(agentId, Date.now());
      const currentMetrics = this.getCurrentMetrics(agentId);
      this.updateMetrics(agentId, { ...currentMetrics, isCurrentlyExecuting: true });
      
      console.log(`🎯 [METRICS] Iniciando tracking para agente: ${agentId}`);
    } catch (error) {
      console.error('🎯 [METRICS] Erro ao iniciar execução:', error);
    }
  }

  /**
   * Finaliza o tracking de uma execução de agente
   */
  endExecution(agentId: string): void {
    try {
      // Validação de entrada
      if (!agentId || typeof agentId !== 'string') {
        console.error('🎯 [METRICS] AgentId inválido para fim de execução:', agentId);
        return;
      }

      const startTime = this.executionStartTimes.get(agentId);
      if (!startTime) {
        console.warn(`🎯 [METRICS] Tentativa de finalizar execução sem início para agente: ${agentId}`);
        return;
      }

      const executionTime = Date.now() - startTime;
      
      // Validação de tempo de execução (máximo 1 hora)
      if (executionTime > 3600000) {
        console.warn(`🎯 [METRICS] Tempo de execução muito longo para agente ${agentId}: ${executionTime}ms`);
      }

      this.executionStartTimes.delete(agentId);

      const currentMetrics = this.getCurrentMetrics(agentId);
      const newMetrics: AgentExecutionMetrics = {
        totalExecutions: Math.max(0, currentMetrics.totalExecutions + 1),
        totalExecutionTime: Math.max(0, currentMetrics.totalExecutionTime + executionTime),
        averageExecutionTime: 0, // Será calculado abaixo
        lastExecutionTime: new Date(),
        isCurrentlyExecuting: false
      };

      // Calcular tempo médio com proteção contra divisão por zero
      if (newMetrics.totalExecutions > 0) {
        newMetrics.averageExecutionTime = newMetrics.totalExecutionTime / newMetrics.totalExecutions;
      }

      this.updateMetrics(agentId, newMetrics);
      console.log(`🎯 [METRICS] Finalizando tracking para agente: ${agentId} (${executionTime}ms)`);
    } catch (error) {
      console.error('🎯 [METRICS] Erro ao finalizar execução:', error);
    }
  }

  /**
   * Obtém as métricas atuais de um agente
   */
  getCurrentMetrics(agentId: string): AgentExecutionMetrics {
    const currentMetrics = this.metricsSubject.value.get(agentId);
    return currentMetrics || {
      totalExecutions: 0,
      totalExecutionTime: 0,
      averageExecutionTime: 0,
      isCurrentlyExecuting: false
    };
  }

  /**
   * Obtém as métricas de um agente como Observable
   */
  getAgentMetrics(agentId: string): Observable<AgentExecutionMetrics> {
    return new Observable(observer => {
      const subscription = this.metrics$.subscribe(metricsMap => {
        const metrics = metricsMap.get(agentId) || {
          totalExecutions: 0,
          totalExecutionTime: 0,
          averageExecutionTime: 0,
          isCurrentlyExecuting: false
        };
        observer.next(metrics);
      });
      return () => subscription.unsubscribe();
    });
  }

  /**
   * Formata tempo em millisegundos para string legível
   */
  formatExecutionTime(milliseconds: number): string {
    if (milliseconds === 0) return '0ms';
    
    if (milliseconds < 1000) {
      return `${Math.round(milliseconds)}ms`;
    } else if (milliseconds < 60000) {
      const seconds = milliseconds / 1000;
      if (seconds < 10) {
        return `${seconds.toFixed(2)}s`;
      } else {
        return `${seconds.toFixed(1)}s`;
      }
    } else if (milliseconds < 3600000) {
      const minutes = Math.floor(milliseconds / 60000);
      const seconds = Math.floor((milliseconds % 60000) / 1000);
      return `${minutes}m ${seconds}s`;
    } else {
      const hours = Math.floor(milliseconds / 3600000);
      const minutes = Math.floor((milliseconds % 3600000) / 60000);
      return `${hours}h ${minutes}m`;
    }
  }

  /**
   * Reseta as métricas de um agente
   */
  resetMetrics(agentId: string): void {
    const resetMetrics: AgentExecutionMetrics = {
      totalExecutions: 0,
      totalExecutionTime: 0,
      averageExecutionTime: 0,
      isCurrentlyExecuting: false
    };
    this.updateMetrics(agentId, resetMetrics);
  }

  /**
   * Atualiza as métricas de um agente
   */
  private updateMetrics(agentId: string, metrics: AgentExecutionMetrics): void {
    try {
      // Validação de entrada
      if (!agentId || typeof agentId !== 'string') {
        console.error('🎯 [METRICS] AgentId inválido para atualização de métricas:', agentId);
        return;
      }

      if (!metrics || typeof metrics !== 'object') {
        console.error('🎯 [METRICS] Métricas inválidas para agente:', agentId, metrics);
        return;
      }

      // Validação de valores numéricos
      const validatedMetrics: AgentExecutionMetrics = {
        totalExecutions: Math.max(0, Math.floor(metrics.totalExecutions || 0)),
        totalExecutionTime: Math.max(0, Math.floor(metrics.totalExecutionTime || 0)),
        averageExecutionTime: Math.max(0, Math.floor(metrics.averageExecutionTime || 0)),
        lastExecutionTime: metrics.lastExecutionTime instanceof Date ? metrics.lastExecutionTime : undefined,
        isCurrentlyExecuting: Boolean(metrics.isCurrentlyExecuting)
      };

      const currentMetrics = this.metricsSubject.value;
      const newMetrics = new Map(currentMetrics);
      newMetrics.set(agentId, validatedMetrics);
      this.metricsSubject.next(newMetrics);
    } catch (error) {
      console.error('🎯 [METRICS] Erro ao atualizar métricas:', error);
    }
  }

  /**
   * Força o início do tracking de uma execução (para uso manual)
   */
  forceStartExecution(agentId: string): void {
    console.log(`🎯 [METRICS] Forçando início de execução para agente: ${agentId}`);
    this.startExecution(agentId);
  }

  /**
   * Força o fim do tracking de uma execução (para uso manual)
   */
  forceEndExecution(agentId: string): void {
    console.log(`🎯 [METRICS] Forçando fim de execução para agente: ${agentId}`);
    this.endExecution(agentId);
  }

  /**
   * Verifica se um agente está atualmente executando
   */
  isAgentExecuting(agentId: string): boolean {
    const metrics = this.getCurrentMetrics(agentId);
    return metrics.isCurrentlyExecuting;
  }

  /**
   * Obtém estatísticas gerais de todos os agentes
   */
  getGlobalStats(): { totalAgents: number, totalExecutions: number, totalExecutionTime: number } {
    const metrics = this.metricsSubject.value;
    let totalAgents = 0;
    let totalExecutions = 0;
    let totalExecutionTime = 0;

    for (const agentMetrics of metrics.values()) {
      totalAgents++;
      totalExecutions += agentMetrics.totalExecutions;
      totalExecutionTime += agentMetrics.totalExecutionTime;
    }

    return { totalAgents, totalExecutions, totalExecutionTime };
  }

  /**
   * Reseta as métricas de um agente específico
   */
  resetAgentMetrics(agentId: string): void {
    const resetMetrics: AgentExecutionMetrics = {
      totalExecutions: 0,
      totalExecutionTime: 0,
      averageExecutionTime: 0,
      isCurrentlyExecuting: false
    };
    this.updateMetrics(agentId, resetMetrics);
  }

  /**
   * Sincroniza métricas do backend para o frontend
   * Usado para carregar estatísticas persistidas da API
   */
  syncFromBackend(agentId: string, backendMetrics: AgentExecutionMetrics): void {
    try {
      if (!agentId || typeof agentId !== 'string') {
        console.error('🔄 [SYNC] AgentId inválido para sincronização:', agentId);
        return;
      }

      if (!backendMetrics || typeof backendMetrics !== 'object') {
        console.error('🔄 [SYNC] Métricas inválidas para sincronização:', backendMetrics);
        return;
      }

      console.log(`🔄 [SYNC] Sincronizando métricas do backend para agente: ${agentId}`, backendMetrics);

      // Atualizar métricas com dados do backend
      this.updateMetrics(agentId, {
        totalExecutions: backendMetrics.totalExecutions || 0,
        totalExecutionTime: backendMetrics.totalExecutionTime || 0,
        averageExecutionTime: backendMetrics.averageExecutionTime || 0,
        lastExecutionTime: backendMetrics.lastExecutionTime,
        isCurrentlyExecuting: backendMetrics.isCurrentlyExecuting || false
      });

      console.log(`✅ [SYNC] Métricas sincronizadas com sucesso para agente: ${agentId}`);
    } catch (error) {
      console.error('❌ [SYNC] Erro ao sincronizar métricas do backend:', error);
    }
  }

  /**
   * Limpa métricas de agentes que não existem mais
   */
  cleanupOrphanedMetrics(activeAgentIds: string[]): void {
    try {
      const currentMetrics = this.metricsSubject.value;
      const activeIds = new Set(activeAgentIds);
      let hasChanges = false;

      for (const agentId of currentMetrics.keys()) {
        if (!activeIds.has(agentId)) {
          currentMetrics.delete(agentId);
          this.executionStartTimes.delete(agentId);
          hasChanges = true;
          console.log(`🎯 [METRICS] Removendo métricas órfãs para agente: ${agentId}`);
        }
      }

      if (hasChanges) {
        this.metricsSubject.next(new Map(currentMetrics));
      }
    } catch (error) {
      console.error('🎯 [METRICS] Erro ao limpar métricas órfãs:', error);
    }
  }

  /**
   * Obtém estatísticas de performance do serviço
   */
  getServiceStats(): { 
    totalTrackedAgents: number, 
    activeExecutions: number, 
    queueSize: number,
    memoryUsage: string 
  } {
    const metrics = this.metricsSubject.value;
    const activeExecutions = this.executionStartTimes.size;
    const queueSize = this.updateQueue.length;
    
    // Estimativa de uso de memória (aproximada)
    const memoryUsage = `${Math.round((metrics.size * 200 + activeExecutions * 50 + queueSize * 20) / 1024)}KB`;

    return {
      totalTrackedAgents: metrics.size,
      activeExecutions,
      queueSize,
      memoryUsage
    };
  }

  /**
   * Limpa recursos quando o serviço é destruído
   */
  ngOnDestroy(): void {
    if (this.executionSubscription) {
      this.executionSubscription.unsubscribe();
    }
    
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }
    
    // Limpa todas as estruturas de dados
    this.executionStartTimes.clear();
    this.updateQueue = [];
    this.metricsSubject.complete();
  }
}
