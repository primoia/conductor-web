import { Component, EventEmitter, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import {
  AgentWithCouncilor,
  CouncilorReport,
  // NEW types for instance-based approach
  CouncilorInstance,
  CouncilorInstanceListResponse
} from '../../models/councilor.types';
import { CouncilorSchedulerService } from '../../services/councilor-scheduler.service';
import { CouncilorReportModalComponent } from '../councilor-report-modal/councilor-report-modal.component';
import { CouncilorEditModalComponent } from '../councilor-edit-modal/councilor-edit-modal.component';

/**
 * Dashboard de Conselheiros Ativos
 *
 * Exibe lista de conselheiros com:
 * - Nome e cargo
 * - Tarefa configurada
 * - Ultima execucao e status
 * - Proxima execucao
 * - Acoes (ver relatorio, editar, pausar/retomar, executar agora)
 *
 * Refatorado para:
 * - Carregar dados diretamente da API (nao depende do scheduler)
 * - Melhor tratamento de erros
 * - Botao "Executar Agora"
 * - Feedback visual melhorado
 */
@Component({
  selector: 'app-councilors-dashboard',
  standalone: true,
  imports: [CommonModule, CouncilorReportModalComponent, CouncilorEditModalComponent],
  templateUrl: './councilors-dashboard.component.html',
  styleUrls: ['./councilors-dashboard.component.css']
})
export class CouncilorsDashboardComponent implements OnInit, OnDestroy {
  @Output() close = new EventEmitter<void>();
  @Output() promoteNew = new EventEmitter<void>();
  @ViewChild(CouncilorEditModalComponent) editModal?: CouncilorEditModalComponent;

  // LEGACY: kept for backwards compatibility
  councilors: AgentWithCouncilor[] = [];

  // NEW: Instance-based councilors
  councilorInstances: CouncilorInstance[] = [];

  private subscription?: Subscription;
  private instancesSubscription?: Subscription;

  // Estado de carregamento e erros
  isLoading = true;
  errorMessage = '';

  // Estado de acoes em progresso (por instance_id ou agent_id)
  actionInProgress: { [key: string]: string } = {};

  // Modal states
  showReportModal = false;
  showEditModal = false;
  selectedCouncilor: AgentWithCouncilor | null = null;
  selectedInstance: CouncilorInstance | null = null;
  selectedReport: CouncilorReport | null = null;
  isLoadingReport = false;

  constructor(private councilorScheduler: CouncilorSchedulerService) {}

  ngOnInit(): void {
    // Load both legacy and instance-based councilors
    this.loadCouncilorsFromApi();

    // Subscribe para updates automaticos (legacy)
    this.subscription = this.councilorScheduler.councilors$.subscribe(
      councilors => {
        if (!this.isLoading) {
          this.councilors = councilors;
        }
      }
    );

    // Subscribe para updates de instances (NEW)
    this.instancesSubscription = this.councilorScheduler.councilorInstances$.subscribe(
      instances => {
        if (!this.isLoading) {
          this.councilorInstances = instances;
        }
      }
    );
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
    this.instancesSubscription?.unsubscribe();
  }

  /**
   * Carrega conselheiros diretamente da API
   * UPDATED: Agora carrega de ambos endpoints (legacy e instances)
   */
  async loadCouncilorsFromApi(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = '';

    try {
      // ============================================================
      // NEW: Load from /api/councilors/instances first
      // ============================================================
      const instancesResponse = await fetch('/api/councilors/instances');

      if (instancesResponse.ok) {
        const instancesData: CouncilorInstanceListResponse = await instancesResponse.json();
        this.councilorInstances = instancesData.instances || [];
        console.log(`🏛️ [DASHBOARD] Carregados ${this.councilorInstances.length} councilor instances`);
      } else {
        console.warn('⚠️ [DASHBOARD] Endpoint /api/councilors/instances não disponível');
        this.councilorInstances = [];
      }

      // ============================================================
      // LEGACY: Also load from /api/councilors?is_councilor=true
      // ============================================================
      const legacyResponse = await fetch('/api/councilors?is_councilor=true');

      if (legacyResponse.ok) {
        const legacyData = await legacyResponse.json();
        this.councilors = legacyData.agents || [];
        console.log(`🏛️ [DASHBOARD] Carregados ${this.councilors.length} conselheiros legados`);
      } else {
        this.councilors = [];
      }

      const total = this.councilorInstances.length + this.councilors.length;
      console.log(`🏛️ [DASHBOARD] Total: ${total} conselheiros (${this.councilorInstances.length} instances, ${this.councilors.length} legacy)`);

    } catch (error) {
      console.error('❌ [DASHBOARD] Erro ao carregar conselheiros:', error);
      this.errorMessage = 'Erro ao carregar conselheiros. Verifique se o servidor esta rodando.';
      this.councilors = [];
      this.councilorInstances = [];
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Recarrega lista de conselheiros
   */
  async refresh(): Promise<void> {
    await this.loadCouncilorsFromApi();
  }

  /**
   * Verifica se uma acao esta em progresso para um conselheiro
   */
  isActionInProgress(agentId: string): boolean {
    return !!this.actionInProgress[agentId];
  }

  /**
   * Obtem descricao da acao em progresso
   */
  getActionInProgress(agentId: string): string {
    return this.actionInProgress[agentId] || '';
  }

  /**
   * Pausa execucao de um conselheiro
   */
  async pauseCouncilor(councilor: AgentWithCouncilor): Promise<void> {
    if (this.isActionInProgress(councilor.agent_id)) return;

    this.actionInProgress[councilor.agent_id] = 'Pausando...';
    this.errorMessage = '';

    try {
      const response = await fetch(`/api/councilors/${councilor.agent_id}/councilor-schedule`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: false })
      });

      if (!response.ok) {
        throw new Error(`Falha ao pausar: ${response.status}`);
      }

      console.log(`⏸️ Conselheiro ${councilor.customization?.display_name} pausado`);

      // Atualizar status localmente
      if (councilor.councilor_config) {
        councilor.councilor_config.schedule.enabled = false;
      }
    } catch (error) {
      console.error('Erro ao pausar conselheiro:', error);
      this.errorMessage = `Erro ao pausar ${councilor.customization?.display_name || 'conselheiro'}`;
    } finally {
      delete this.actionInProgress[councilor.agent_id];
    }
  }

  /**
   * Retoma execucao de um conselheiro
   */
  async resumeCouncilor(councilor: AgentWithCouncilor): Promise<void> {
    if (this.isActionInProgress(councilor.agent_id)) return;

    this.actionInProgress[councilor.agent_id] = 'Retomando...';
    this.errorMessage = '';

    try {
      const response = await fetch(`/api/councilors/${councilor.agent_id}/councilor-schedule`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: true })
      });

      if (!response.ok) {
        throw new Error(`Falha ao retomar: ${response.status}`);
      }

      console.log(`▶️ Conselheiro ${councilor.customization?.display_name} retomado`);

      // Atualizar status localmente
      if (councilor.councilor_config) {
        councilor.councilor_config.schedule.enabled = true;
      }
    } catch (error) {
      console.error('Erro ao retomar conselheiro:', error);
      this.errorMessage = `Erro ao retomar ${councilor.customization?.display_name || 'conselheiro'}`;
    } finally {
      delete this.actionInProgress[councilor.agent_id];
    }
  }

  /**
   * Executa tarefa do conselheiro imediatamente
   */
  async executeNow(councilor: AgentWithCouncilor): Promise<void> {
    if (this.isActionInProgress(councilor.agent_id)) return;

    this.actionInProgress[councilor.agent_id] = 'Executando...';
    this.errorMessage = '';

    try {
      const response = await fetch(`/api/councilors/${councilor.agent_id}/execute-now`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Falha ao executar: ${response.status}`);
      }

      const result = await response.json();
      console.log(`🚀 Conselheiro ${councilor.customization?.display_name} executado:`, result);

      // Atualizar stats localmente se retornado
      if (result.stats) {
        councilor.stats = result.stats;
      }

      // Mostrar resultado brevemente
      this.actionInProgress[councilor.agent_id] = 'Concluido!';
      setTimeout(() => {
        delete this.actionInProgress[councilor.agent_id];
      }, 1500);

    } catch (error) {
      console.error('Erro ao executar conselheiro:', error);
      this.errorMessage = `Erro ao executar ${councilor.customization?.display_name || 'conselheiro'}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`;
      delete this.actionInProgress[councilor.agent_id];
    }
  }

  /**
   * Abre modal com ultimo relatorio
   */
  viewLastReport(councilor: AgentWithCouncilor): void {
    this.selectedCouncilor = councilor;
    this.isLoadingReport = true;
    this.showReportModal = true;
    this.selectedReport = null;
    this.errorMessage = '';

    this.councilorScheduler.getCouncilorReport(councilor.agent_id).subscribe({
      next: (report) => {
        console.log('📋 Relatorio carregado:', report);
        this.selectedReport = report;
        this.isLoadingReport = false;
      },
      error: (error) => {
        console.error('❌ Erro ao carregar relatorio:', error);
        this.errorMessage = 'Erro ao carregar relatorio';
        this.isLoadingReport = false;
        this.showReportModal = false;
      }
    });
  }

  /**
   * Fecha modal de relatorio
   */
  closeReportModal(): void {
    this.showReportModal = false;
    this.selectedReport = null;
    this.selectedCouncilor = null;
  }

  /**
   * Abre modal de edicao
   */
  editCouncilor(councilor: AgentWithCouncilor): void {
    console.log('⚙️ Editando conselheiro:', councilor);
    this.selectedCouncilor = councilor;
    this.showEditModal = true;
    this.errorMessage = '';
  }

  /**
   * Fecha modal de edicao
   */
  closeEditModal(): void {
    this.showEditModal = false;
    this.selectedCouncilor = null;
    this.selectedInstance = null;
  }

  /**
   * Handler para salvar configuração (decide se é instance ou legacy)
   */
  async handleSaveConfig(updateData: any): Promise<void> {
    if (updateData.is_instance || this.selectedInstance) {
      await this.saveInstanceConfig(updateData);
    } else {
      await this.saveCouncilorConfig(updateData);
    }
  }

  /**
   * Salva alteracoes da edicao de conselheiro
   */
  async saveCouncilorConfig(updateData: any): Promise<void> {
    if (!this.selectedCouncilor) return;

    // Definir estado de loading no modal
    if (this.editModal) {
      this.editModal.setLoadingState(true);
    }

    try {
      const response = await fetch(`/api/councilors/${this.selectedCouncilor.agent_id}/councilor-config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Falha ao atualizar: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Configuracao atualizada:', result);

      // Atualizar localmente
      const index = this.councilors.findIndex(c => c.agent_id === this.selectedCouncilor!.agent_id);
      if (index !== -1 && result.agent) {
        this.councilors[index] = result.agent;
      }

      // Fechar modal
      this.closeEditModal();

      // Recarregar conselheiros para garantir dados atualizados
      await this.loadCouncilorsFromApi();

    } catch (error) {
      console.error('❌ Erro ao salvar configuracao:', error);

      // Definir erro no modal
      if (this.editModal) {
        this.editModal.setError(error instanceof Error ? error.message : 'Erro ao salvar configuracao. Tente novamente.');
      }
    }
  }

  /**
   * Remove promocao de conselheiro (LEGACY)
   */
  async demoteCouncilor(councilor: AgentWithCouncilor): Promise<void> {
    const displayName = councilor.customization?.display_name || councilor.name || 'este conselheiro';

    if (!confirm(`Deseja remover ${displayName} do Conselho?\n\nO agente continuara disponivel no catalogo, mas deixara de executar tarefas automaticas.`)) {
      return;
    }

    if (this.isActionInProgress(councilor.agent_id)) return;

    this.actionInProgress[councilor.agent_id] = 'Removendo...';
    this.errorMessage = '';

    try {
      const response = await fetch(`/api/councilors/${councilor.agent_id}/demote-councilor`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Falha ao remover: ${response.status}`);
      }

      console.log(`🔻 Conselheiro ${displayName} removido`);

      // 🔥 Cancelar timer agendado no scheduler
      this.councilorScheduler.cancelTask(councilor.agent_id);

      // Remover da lista local
      this.councilors = this.councilors.filter(c => c.agent_id !== councilor.agent_id);

    } catch (error) {
      console.error('❌ Erro ao demover conselheiro:', error);
      this.errorMessage = `Erro ao remover ${displayName}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`;
    } finally {
      delete this.actionInProgress[councilor.agent_id];
    }
  }

  // ========== NEW: Instance-based methods ==========

  /**
   * Remove um councilor instance (NEW)
   */
  async demoteCouncilorInstance(instance: CouncilorInstance): Promise<void> {
    const displayName = instance.customization?.display_name || instance.agent_name || instance.instance_id;

    if (!confirm(`Deseja remover ${displayName} do Conselho?\n\nO agente continuara disponivel no catalogo, mas deixara de executar tarefas automaticas.`)) {
      return;
    }

    if (this.isActionInProgress(instance.instance_id)) return;

    this.actionInProgress[instance.instance_id] = 'Removendo...';
    this.errorMessage = '';

    try {
      const response = await fetch(`/api/councilors/instances/${instance.instance_id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Falha ao remover: ${response.status}`);
      }

      console.log(`🔻 Councilor instance ${displayName} removida`);

      // 🔥 Cancelar timer agendado no scheduler
      this.councilorScheduler.cancelTask(instance.agent_id);

      // Remover da lista local
      this.councilorInstances = this.councilorInstances.filter(i => i.instance_id !== instance.instance_id);

    } catch (error) {
      console.error('❌ Erro ao demover councilor instance:', error);
      this.errorMessage = `Erro ao remover ${displayName}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`;
    } finally {
      delete this.actionInProgress[instance.instance_id];
    }
  }

  /**
   * Executa tarefa do councilor instance imediatamente (NEW)
   */
  async executeInstanceNow(instance: CouncilorInstance): Promise<void> {
    if (this.isActionInProgress(instance.instance_id)) return;

    this.actionInProgress[instance.instance_id] = 'Executando...';
    this.errorMessage = '';

    try {
      // Use the agent_id for execution (same endpoint)
      const response = await fetch(`/api/councilors/${instance.agent_id}/execute-now`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Falha ao executar: ${response.status}`);
      }

      const displayName = instance.customization?.display_name || instance.agent_name;
      console.log(`🚀 Councilor instance ${displayName} executado`);

      // Mostrar resultado brevemente
      this.actionInProgress[instance.instance_id] = 'Concluido!';
      setTimeout(() => {
        delete this.actionInProgress[instance.instance_id];
      }, 1500);

    } catch (error) {
      const displayName = instance.customization?.display_name || instance.agent_name || instance.instance_id;
      console.error('Erro ao executar councilor instance:', error);
      this.errorMessage = `Erro ao executar ${displayName}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`;
      delete this.actionInProgress[instance.instance_id];
    }
  }

  /**
   * Obtem nome de exibição para instance
   */
  getInstanceDisplayName(instance: CouncilorInstance): string {
    return instance.customization?.display_name || instance.agent_name || instance.agent_id;
  }

  /**
   * Obtem emoji para instance
   */
  getInstanceEmoji(instance: CouncilorInstance): string {
    return instance.agent_emoji || '🏛️';
  }

  /**
   * Obtem classe de status para instance
   */
  getInstanceStatusClass(instance: CouncilorInstance): string {
    if (this.isActionInProgress(instance.instance_id)) return 'status-running';
    if (!instance.councilor_config?.schedule.enabled) return 'status-paused';
    if (!instance.statistics?.last_execution && !instance.last_execution) return 'status-pending';
    return 'status-active';
  }

  /**
   * Obtem emoji de status para instance
   */
  getInstanceStatusEmoji(instance: CouncilorInstance): string {
    if (this.isActionInProgress(instance.instance_id)) return '⏳';
    if (!instance.councilor_config?.schedule.enabled) return '⏸️';

    const successRate = instance.statistics?.success_rate;
    if (successRate === undefined) return '🔵';
    if (successRate >= 90) return '✅';
    if (successRate >= 70) return '⚠️';
    return '🔴';
  }

  /**
   * Obtem texto de status para instance
   */
  getInstanceStatusText(instance: CouncilorInstance): string {
    if (this.isActionInProgress(instance.instance_id)) {
      return this.actionInProgress[instance.instance_id];
    }
    if (!instance.councilor_config?.schedule.enabled) return 'Pausado';

    const successRate = instance.statistics?.success_rate;
    if (successRate === undefined) return 'Aguardando';
    return `${successRate.toFixed(0)}% sucesso`;
  }

  // ========== Instance action methods (NEW) ==========

  /**
   * Alias para demoteCouncilorInstance (usado no template)
   */
  demoteInstance(instance: CouncilorInstance): void {
    this.demoteCouncilorInstance(instance);
  }

  /**
   * Ver relatório de uma instance
   */
  viewInstanceReport(instance: CouncilorInstance): void {
    this.selectedInstance = instance;
    this.isLoadingReport = true;
    this.showReportModal = true;
    this.selectedReport = null;
    this.errorMessage = '';

    // Use agent_id for report (same endpoint as legacy)
    this.councilorScheduler.getCouncilorReport(instance.agent_id).subscribe({
      next: (report) => {
        console.log('📋 Relatorio de instance carregado:', report);
        this.selectedReport = report;
        this.isLoadingReport = false;
      },
      error: (error) => {
        console.error('❌ Erro ao carregar relatorio de instance:', error);
        this.errorMessage = 'Erro ao carregar relatorio';
        this.isLoadingReport = false;
        this.showReportModal = false;
      }
    });
  }

  /**
   * Editar configuração de uma instance
   */
  editInstance(instance: CouncilorInstance): void {
    console.log('⚙️ Editando instance:', instance);
    this.selectedInstance = instance;
    this.selectedCouncilor = null;  // Clear legacy selection
    this.showEditModal = true;
    this.errorMessage = '';
  }

  /**
   * Salva alterações de configuração de instance
   */
  async saveInstanceConfig(updateData: any): Promise<void> {
    if (!this.selectedInstance) return;

    // Set loading state
    if (this.editModal) {
      this.editModal.setLoadingState(true);
    }

    try {
      const response = await fetch(`/api/councilors/instances/${this.selectedInstance.instance_id}/config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Falha ao atualizar: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Configuração de instance atualizada:', result);

      // Update locally
      const index = this.councilorInstances.findIndex(i => i.instance_id === this.selectedInstance!.instance_id);
      if (index !== -1 && result.instance) {
        this.councilorInstances[index] = result.instance;
      }

      // Close modal
      this.closeEditModal();

      // Reload to ensure data is fresh
      await this.loadCouncilorsFromApi();

    } catch (error) {
      console.error('❌ Erro ao salvar configuração de instance:', error);

      if (this.editModal) {
        this.editModal.setError(error instanceof Error ? error.message : 'Erro ao salvar configuração. Tente novamente.');
      }
    }
  }

  /**
   * Pausar uma instance
   */
  async pauseInstance(instance: CouncilorInstance): Promise<void> {
    if (this.isActionInProgress(instance.instance_id)) return;

    this.actionInProgress[instance.instance_id] = 'Pausando...';
    this.errorMessage = '';

    try {
      const response = await fetch(`/api/councilors/instances/${instance.instance_id}/schedule`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: false })
      });

      if (!response.ok) {
        throw new Error(`Falha ao pausar: ${response.status}`);
      }

      const displayName = instance.customization?.display_name || instance.agent_name;
      console.log(`⏸️ Instance ${displayName} pausada`);

      // Atualizar status localmente
      if (instance.councilor_config) {
        instance.councilor_config.schedule.enabled = false;
      }
    } catch (error) {
      const displayName = instance.customization?.display_name || instance.agent_name || instance.instance_id;
      console.error('Erro ao pausar instance:', error);
      this.errorMessage = `Erro ao pausar ${displayName}`;
    } finally {
      delete this.actionInProgress[instance.instance_id];
    }
  }

  /**
   * Retomar uma instance
   */
  async resumeInstance(instance: CouncilorInstance): Promise<void> {
    if (this.isActionInProgress(instance.instance_id)) return;

    this.actionInProgress[instance.instance_id] = 'Retomando...';
    this.errorMessage = '';

    try {
      const response = await fetch(`/api/councilors/instances/${instance.instance_id}/schedule`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: true })
      });

      if (!response.ok) {
        throw new Error(`Falha ao retomar: ${response.status}`);
      }

      const displayName = instance.customization?.display_name || instance.agent_name;
      console.log(`▶️ Instance ${displayName} retomada`);

      // Atualizar status localmente
      if (instance.councilor_config) {
        instance.councilor_config.schedule.enabled = true;
      }
    } catch (error) {
      const displayName = instance.customization?.display_name || instance.agent_name || instance.instance_id;
      console.error('Erro ao retomar instance:', error);
      this.errorMessage = `Erro ao retomar ${displayName}`;
    } finally {
      delete this.actionInProgress[instance.instance_id];
    }
  }

  /**
   * Calcula proxima execucao para instance
   */
  getInstanceNextExecution(instance: CouncilorInstance): string {
    const config = instance.councilor_config;
    if (!config || !config.schedule.enabled) return 'Pausado';

    if (config.schedule.type === 'interval') {
      return `em ${config.schedule.value}`;
    } else {
      return this.formatCronExpression(config.schedule.value);
    }
  }

  /**
   * Verifica se há conselheiros para exibir (instances ou legacy)
   */
  hasCouncilors(): boolean {
    return this.councilorInstances.length > 0 || this.councilors.length > 0;
  }

  /**
   * Formata data relativa (ex: "ha 15 minutos")
   */
  formatRelativeTime(date?: Date | string): string {
    if (!date) return 'Nunca executado';

    const now = new Date();
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const diff = now.getTime() - dateObj.getTime();

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'agora mesmo';
    if (minutes < 60) return `ha ${minutes}min`;
    if (hours < 24) return `ha ${hours}h`;
    return `ha ${days}d`;
  }

  /**
   * Calcula proxima execucao baseada no agendamento
   */
  getNextExecution(councilor: AgentWithCouncilor): string {
    const config = councilor.councilor_config;
    if (!config || !config.schedule.enabled) return 'Pausado';

    if (config.schedule.type === 'interval') {
      return `em ${config.schedule.value}`;
    } else {
      // Cron - mostrar expressao formatada
      return this.formatCronExpression(config.schedule.value);
    }
  }

  /**
   * Formata expressao cron para texto legivel
   */
  private formatCronExpression(cron: string): string {
    const cronPatterns: { [key: string]: string } = {
      '0 9 * * 1': 'Seg 9h',
      '0 9 * * *': 'Diariamente 9h',
      '0 0 * * *': 'Meia-noite',
      '0 */2 * * *': 'A cada 2h',
      '0 */6 * * *': 'A cada 6h'
    };

    return cronPatterns[cron] || cron;
  }

  /**
   * Obtem classe CSS baseada no status
   */
  getStatusClass(councilor: AgentWithCouncilor): string {
    if (this.isActionInProgress(councilor.agent_id)) return 'status-running';
    if (!councilor.councilor_config?.schedule.enabled) return 'status-paused';

    // Baseado na ultima execucao (se houver)
    const lastExec = councilor.stats?.last_execution;
    if (!lastExec) return 'status-pending';

    return 'status-active';
  }

  /**
   * Obtem emoji de status
   */
  getStatusEmoji(councilor: AgentWithCouncilor): string {
    if (this.isActionInProgress(councilor.agent_id)) return '⏳';
    if (!councilor.councilor_config?.schedule.enabled) return '⏸️';

    const successRate = councilor.stats?.success_rate;
    if (successRate === undefined) return '🔵';
    if (successRate >= 90) return '✅';
    if (successRate >= 70) return '⚠️';
    return '🔴';
  }

  /**
   * Obtem texto de status
   */
  getStatusText(councilor: AgentWithCouncilor): string {
    if (this.isActionInProgress(councilor.agent_id)) {
      return this.getActionInProgress(councilor.agent_id);
    }
    if (!councilor.councilor_config?.schedule.enabled) return 'Pausado';

    const successRate = councilor.stats?.success_rate;
    if (successRate === undefined) return 'Aguardando';
    return `${successRate.toFixed(0)}% sucesso`;
  }

  /**
   * Fecha dashboard
   */
  onClose(): void {
    this.close.emit();
  }

  /**
   * Emite evento para promover novo conselheiro
   */
  onPromoteNew(): void {
    this.promoteNew.emit();
  }

  /**
   * Limpa mensagem de erro
   */
  clearError(): void {
    this.errorMessage = '';
  }
}
