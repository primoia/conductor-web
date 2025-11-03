/**
 * 🎯 Serviço de Gerenciamento de Instâncias de Agentes
 *
 * Responsável por gerenciar o ciclo de vida completo das instâncias de agentes:
 * - Criação e remoção de instâncias
 * - Sincronização entre UI e banco de dados
 * - Gerenciamento do estado de execução
 * - Tracking de agentes ativos e inativos
 *
 * Extração: Reduz ~400-500 linhas do screenplay-interactive.ts
 * Complexidade: MÉDIA-ALTA
 * Risco: MÉDIO (funcionalidade crítica do sistema)
 *
 * @author Refatoração - 2025-11-03
 */

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { LoggingService } from './logging.service';
import { CirclePosition } from '../examples/draggable-circles/draggable-circle.component';
import { AgentExecutionState } from './agent-execution';

/**
 * Interface para instância de agente
 */
export interface AgentInstance {
  id: string; // UUID v4 - anchor in Markdown and key in "database"
  agent_id?: string; // Agent ID from MongoDB (e.g., "ReadmeResume_Agent")
  conversation_id?: string; // Vincula agente a uma conversa específica
  emoji: string;
  definition: { title: string; description: string; unicode: string; }; // Link to AGENT_DEFINITIONS
  status: 'pending' | 'queued' | 'running' | 'completed' | 'error';
  position: CirclePosition; // XY position on screen
  executionState?: AgentExecutionState; // Link to execution service state
  is_system_default?: boolean; // Flag for system default agents
  is_hidden?: boolean; // Flag for hidden agents
  isDeleted?: boolean; // Soft delete flag
  deleted_at?: string; // Deletion timestamp
  config?: {
    cwd?: string; // Working directory for agent execution
    createdAt?: Date;
    updatedAt?: Date;
  };
}

/**
 * Interface para configuração de agente (legacy)
 */
export interface AgentConfig {
  id: string;
  emoji: string;
  position: CirclePosition;
  data: any;
  markdownHash?: string;
  instanceIndex?: number; // Which occurrence of the emoji (0, 1, 2...)
  textPosition?: number;  // Character position in markdown
}

/**
 * Definições padrão de agentes (emoji -> propriedades)
 */
export const AGENT_DEFINITIONS: { [emoji: string]: { title: string; description: string; unicode: string; } } = {
  '🚀': { title: 'Performance Agent', description: 'Monitors application performance', unicode: '\\u{1F680}' },
  '🔐': { title: 'Auth Agent', description: 'Manages user authentication', unicode: '\\u{1F510}' },
  '📊': { title: 'Analytics Agent', description: 'Collects usage metrics', unicode: '\\u{1F4CA}' },
  '🛡️': { title: 'Security Agent', description: 'Verifies vulnerabilities', unicode: '\\u{1F6E1}' },
  '⚡': { title: 'Speed Agent', description: 'Optimizes response speed', unicode: '\\u{26A1}' },
  '🎯': { title: 'Target Agent', description: 'Focuses on specific goals', unicode: '\\u{1F3AF}' },
  '🧠': { title: 'AI Agent', description: 'AI processing', unicode: '\\u{1F9E0}' },
  '💻': { title: 'System Agent', description: 'Manages system resources', unicode: '\\u{1F4BB}' },
  '📱': { title: 'Mobile Agent', description: 'Responsive mobile interface', unicode: '\\u{1F4F1}' },
  '🌐': { title: 'Network Agent', description: 'Connectivity and network', unicode: '\\u{1F310}' },
  '🔍': { title: 'Search Agent', description: 'Search and indexing', unicode: '\\u{1F50D}' },
  '🎪': { title: 'Entertainment Agent', description: 'Entertainment and gamification', unicode: '\\u{1F3AA}' },
  '🏆': { title: 'Achievement Agent', description: 'Achievements and awards', unicode: '\\u{1F3C6}' },
  '🔮': { title: 'Prediction Agent', description: 'Predictions and trends', unicode: '\\u{1F52E}' },
  '💎': { title: 'Premium Agent', description: 'Premium resources', unicode: '\\u{1F48E}' },
  '⭐': { title: 'Star Agent', description: 'Reviews and favorites', unicode: '\\u{2B50}' },
  '🌟': { title: 'Featured Agent', description: 'Special highlights', unicode: '\\u{1F31F}' },
  '🧪': { title: 'Test Agent', description: 'Runs automated tests and validations', unicode: '\\u{1F9EA}' },
  '📄': { title: 'README Resume Agent', description: 'Analyzes and summarizes README files', unicode: '\\u{1F4C4}' }
};

@Injectable({
  providedIn: 'root'
})
export class AgentInstanceManagementService {

  /**
   * 🎯 Estado reativo: Mapa de instâncias de agentes
   * Simula a coleção 'agent_instances' do MongoDB
   */
  private agentInstances$ = new BehaviorSubject<Map<string, AgentInstance>>(new Map());

  /**
   * 🎯 Estado reativo: Agente selecionado
   */
  private selectedAgent$ = new BehaviorSubject<AgentInstance | null>(null);

  /**
   * Observable público para componentes se inscreverem
   */
  public agentInstances = this.agentInstances$.asObservable();
  public selectedAgent = this.selectedAgent$.asObservable();

  constructor(
    private logging: LoggingService
  ) {}

  // ==========================================
  // Gerenciamento de Instâncias
  // ==========================================

  /**
   * Retorna todas as instâncias de agentes (síncrono)
   */
  getInstances(): Map<string, AgentInstance> {
    return this.agentInstances$.value;
  }

  /**
   * Retorna uma instância específica por ID
   */
  getInstance(id: string): AgentInstance | undefined {
    return this.agentInstances$.value.get(id);
  }

  /**
   * Adiciona uma nova instância de agente
   */
  addInstance(instance: AgentInstance): void {
    const instances = this.agentInstances$.value;
    instances.set(instance.id, instance);

    this.logging.info(
      `➕ [AGENT-INSTANCE] Nova instância criada: ${instance.id} (${instance.emoji})`,
      'AgentInstanceManagementService',
      { instance }
    );

    this.agentInstances$.next(new Map(instances));
  }

  /**
   * Atualiza uma instância existente
   */
  updateInstance(id: string, updates: Partial<AgentInstance>): void {
    const instances = this.agentInstances$.value;
    const existing = instances.get(id);

    if (!existing) {
      this.logging.warn(
        `⚠️ [AGENT-INSTANCE] Tentativa de atualizar instância inexistente: ${id}`,
        'AgentInstanceManagementService'
      );
      return;
    }

    const updated = { ...existing, ...updates };
    instances.set(id, updated);

    this.logging.debug(
      `🔄 [AGENT-INSTANCE] Instância atualizada: ${id}`,
      'AgentInstanceManagementService',
      { updates }
    );

    this.agentInstances$.next(new Map(instances));
  }

  /**
   * Remove uma instância (soft delete)
   */
  removeInstance(id: string, softDelete: boolean = true): void {
    const instances = this.agentInstances$.value;
    const instance = instances.get(id);

    if (!instance) {
      this.logging.warn(
        `⚠️ [AGENT-INSTANCE] Tentativa de remover instância inexistente: ${id}`,
        'AgentInstanceManagementService'
      );
      return;
    }

    if (softDelete) {
      // Soft delete: marca como deletado
      instance.isDeleted = true;
      instance.deleted_at = new Date().toISOString();
      instances.set(id, instance);

      this.logging.info(
        `🗑️ [AGENT-INSTANCE] Instância marcada como deletada: ${id}`,
        'AgentInstanceManagementService'
      );
    } else {
      // Hard delete: remove completamente
      instances.delete(id);

      this.logging.info(
        `❌ [AGENT-INSTANCE] Instância removida permanentemente: ${id}`,
        'AgentInstanceManagementService'
      );
    }

    this.agentInstances$.next(new Map(instances));

    // Se era o agente selecionado, limpar seleção
    if (this.selectedAgent$.value?.id === id) {
      this.setSelectedAgent(null);
    }
  }

  /**
   * Limpa todas as instâncias
   */
  clearInstances(): void {
    this.logging.info('🧹 [AGENT-INSTANCE] Limpando todas as instâncias', 'AgentInstanceManagementService');

    this.agentInstances$.next(new Map());
    this.setSelectedAgent(null);
  }

  /**
   * Carrega instâncias a partir de um array (útil para sincronização com DB)
   */
  loadInstances(instances: AgentInstance[]): void {
    const map = new Map<string, AgentInstance>();

    instances.forEach(instance => {
      map.set(instance.id, instance);
    });

    this.logging.info(
      `📥 [AGENT-INSTANCE] ${instances.length} instâncias carregadas`,
      'AgentInstanceManagementService'
    );

    this.agentInstances$.next(map);
  }

  // ==========================================
  // Gerenciamento de Seleção
  // ==========================================

  /**
   * Define o agente selecionado
   */
  setSelectedAgent(agent: AgentInstance | null): void {
    this.logging.info(
      `🎯 [AGENT-INSTANCE] Agente selecionado: ${agent?.id || 'nenhum'}`,
      'AgentInstanceManagementService'
    );

    this.selectedAgent$.next(agent);
  }

  /**
   * Retorna o agente selecionado (síncrono)
   */
  getSelectedAgent(): AgentInstance | null {
    return this.selectedAgent$.value;
  }

  // ==========================================
  // Queries e Filtros
  // ==========================================

  /**
   * Retorna instâncias ativas (não deletadas)
   */
  getActiveInstances(): AgentInstance[] {
    return Array.from(this.agentInstances$.value.values())
      .filter(instance => !instance.isDeleted);
  }

  /**
   * Retorna instâncias visíveis (não deletadas e não ocultas)
   */
  getVisibleInstances(): AgentInstance[] {
    return Array.from(this.agentInstances$.value.values())
      .filter(instance => !instance.isDeleted && !instance.is_hidden);
  }

  /**
   * Retorna instâncias por emoji
   */
  getInstancesByEmoji(emoji: string): AgentInstance[] {
    return Array.from(this.agentInstances$.value.values())
      .filter(instance => instance.emoji === emoji && !instance.isDeleted);
  }

  /**
   * Retorna instâncias por conversa
   */
  getInstancesByConversation(conversationId: string): AgentInstance[] {
    return Array.from(this.agentInstances$.value.values())
      .filter(instance => instance.conversation_id === conversationId && !instance.isDeleted);
  }

  /**
   * Retorna instâncias por status
   */
  getInstancesByStatus(status: AgentInstance['status']): AgentInstance[] {
    return Array.from(this.agentInstances$.value.values())
      .filter(instance => instance.status === status && !instance.isDeleted);
  }

  /**
   * Retorna agentes padrão do sistema
   */
  getSystemDefaultInstances(): AgentInstance[] {
    return Array.from(this.agentInstances$.value.values())
      .filter(instance => instance.is_system_default && !instance.isDeleted);
  }

  // ==========================================
  // Criação de Instâncias
  // ==========================================

  /**
   * Cria uma nova instância de agente
   *
   * @param emoji Emoji do agente
   * @param position Posição inicial na tela
   * @param options Opções adicionais
   */
  createInstance(
    emoji: string,
    position: CirclePosition,
    options?: {
      agent_id?: string;
      conversation_id?: string;
      is_system_default?: boolean;
      is_hidden?: boolean;
      cwd?: string;
    }
  ): AgentInstance {
    const definition = AGENT_DEFINITIONS[emoji];

    if (!definition) {
      this.logging.warn(
        `⚠️ [AGENT-INSTANCE] Emoji não possui definição: ${emoji}`,
        'AgentInstanceManagementService'
      );
    }

    const id = this.generateInstanceId();

    const instance: AgentInstance = {
      id,
      emoji,
      definition: definition || { title: 'Unknown Agent', description: 'No description', unicode: emoji },
      status: 'pending',
      position,
      agent_id: options?.agent_id,
      conversation_id: options?.conversation_id,
      is_system_default: options?.is_system_default || false,
      is_hidden: options?.is_hidden || false,
      config: {
        cwd: options?.cwd,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    };

    this.addInstance(instance);

    return instance;
  }

  /**
   * Gera um ID único para a instância (UUID v4 simplificado)
   */
  private generateInstanceId(): string {
    return 'agent_' + Math.random().toString(36).substring(2, 15) +
           Math.random().toString(36).substring(2, 15);
  }

  // ==========================================
  // Conversão Legacy (AgentConfig)
  // ==========================================

  /**
   * Converte instâncias para o formato legacy AgentConfig
   * (Útil durante a migração gradual)
   */
  toLegacyAgentConfigs(): AgentConfig[] {
    return this.getVisibleInstances().map(instance => ({
      id: instance.id,
      emoji: instance.emoji,
      position: instance.position,
      data: {
        title: instance.definition.title,
        description: instance.definition.description
      }
    }));
  }

  /**
   * Atualiza posição de uma instância
   */
  updatePosition(id: string, position: CirclePosition): void {
    this.updateInstance(id, { position });
  }

  /**
   * Atualiza status de uma instância
   */
  updateStatus(id: string, status: AgentInstance['status']): void {
    this.updateInstance(id, { status });
  }

  /**
   * Atualiza estado de execução de uma instância
   */
  updateExecutionState(id: string, executionState: AgentExecutionState): void {
    this.updateInstance(id, { executionState });
  }

  // ==========================================
  // Estatísticas
  // ==========================================

  /**
   * Retorna estatísticas sobre as instâncias
   */
  getStatistics() {
    const instances = Array.from(this.agentInstances$.value.values());

    return {
      total: instances.length,
      active: instances.filter(i => !i.isDeleted).length,
      deleted: instances.filter(i => i.isDeleted).length,
      hidden: instances.filter(i => i.is_hidden && !i.isDeleted).length,
      systemDefault: instances.filter(i => i.is_system_default && !i.isDeleted).length,
      byStatus: {
        pending: instances.filter(i => i.status === 'pending' && !i.isDeleted).length,
        queued: instances.filter(i => i.status === 'queued' && !i.isDeleted).length,
        running: instances.filter(i => i.status === 'running' && !i.isDeleted).length,
        completed: instances.filter(i => i.status === 'completed' && !i.isDeleted).length,
        error: instances.filter(i => i.status === 'error' && !i.isDeleted).length
      }
    };
  }
}
