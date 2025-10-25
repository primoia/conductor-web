import { Component, EventEmitter, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { AgentWithCouncilor, CouncilorReport } from '../../models/councilor.types';
import { CouncilorSchedulerService } from '../../services/councilor-scheduler.service';
import { CouncilorReportModalComponent } from '../councilor-report-modal/councilor-report-modal.component';
import { CouncilorEditModalComponent } from '../councilor-edit-modal/councilor-edit-modal.component';

/**
 * Dashboard de Conselheiros Ativos
 *
 * Exibe lista de conselheiros com:
 * - Nome e cargo
 * - Tarefa configurada
 * - Última execução e status
 * - Próxima execução
 * - Ações (ver relatório, editar, pausar/retomar)
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

  councilors: AgentWithCouncilor[] = [];
  private subscription?: Subscription;

  // Estado de carregamento e erros
  isLoading = true;
  errorMessage = '';

  // Modal states
  showReportModal = false;
  showEditModal = false;
  selectedCouncilor: AgentWithCouncilor | null = null;
  selectedReport: CouncilorReport | null = null;
  isLoadingReport = false;

  constructor(private councilorScheduler: CouncilorSchedulerService) {}

  ngOnInit(): void {
    this.loadCouncilors();

    // Subscribe para updates automáticos
    this.subscription = this.councilorScheduler.councilors$.subscribe(
      councilors => {
        this.councilors = councilors;
        this.isLoading = false;
      }
    );
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  /**
   * Carrega conselheiros do scheduler
   */
  private loadCouncilors(): void {
    this.councilors = this.councilorScheduler.getActiveCouncilors();
    this.isLoading = false;
  }

  /**
   * Pausa execução de um conselheiro
   */
  async pauseCouncilor(councilor: AgentWithCouncilor): Promise<void> {
    try {
      await this.councilorScheduler.pauseTask(councilor.agent_id);
      console.log(`⏸️ Conselheiro ${councilor.customization?.display_name} pausado`);

      // Atualizar status localmente
      if (councilor.councilor_config) {
        councilor.councilor_config.schedule.enabled = false;
      }
    } catch (error) {
      console.error('Erro ao pausar conselheiro:', error);
      this.errorMessage = 'Erro ao pausar conselheiro';
    }
  }

  /**
   * Retoma execução de um conselheiro
   */
  async resumeCouncilor(councilor: AgentWithCouncilor): Promise<void> {
    try {
      await this.councilorScheduler.resumeTask(councilor);
      console.log(`▶️ Conselheiro ${councilor.customization?.display_name} retomado`);

      // Atualizar status localmente
      if (councilor.councilor_config) {
        councilor.councilor_config.schedule.enabled = true;
      }
    } catch (error) {
      console.error('Erro ao retomar conselheiro:', error);
      this.errorMessage = 'Erro ao retomar conselheiro';
    }
  }

  /**
   * Abre modal com último relatório
   */
  viewLastReport(councilor: AgentWithCouncilor): void {
    this.selectedCouncilor = councilor;
    this.isLoadingReport = true;
    this.showReportModal = true;
    this.selectedReport = null;

    this.councilorScheduler.getCouncilorReport(councilor.agent_id).subscribe(
      report => {
        console.log('📋 Relatório carregado:', report);
        this.selectedReport = report;
        this.isLoadingReport = false;
      },
      error => {
        console.error('❌ Erro ao carregar relatório:', error);
        this.errorMessage = 'Erro ao carregar relatório';
        this.isLoadingReport = false;
        this.showReportModal = false;
      }
    );
  }

  /**
   * Fecha modal de relatório
   */
  closeReportModal(): void {
    this.showReportModal = false;
    this.selectedReport = null;
    this.selectedCouncilor = null;
  }

  /**
   * Abre modal de edição
   */
  editCouncilor(councilor: AgentWithCouncilor): void {
    console.log('⚙️ Editando conselheiro:', councilor);
    this.selectedCouncilor = councilor;
    this.showEditModal = true;
  }

  /**
   * Fecha modal de edição
   */
  closeEditModal(): void {
    this.showEditModal = false;
    this.selectedCouncilor = null;
  }

  /**
   * Salva alterações da edição de conselheiro
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
        throw new Error(`Failed to update config: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Configuração atualizada:', result);

      // Atualizar localmente
      const index = this.councilors.findIndex(c => c.agent_id === this.selectedCouncilor!.agent_id);
      if (index !== -1 && result.agent) {
        this.councilors[index] = result.agent;
      }

      // Fechar modal
      this.closeEditModal();

      // Recarregar conselheiros
      this.loadCouncilors();

    } catch (error) {
      console.error('❌ Erro ao salvar configuração:', error);
      this.errorMessage = 'Erro ao salvar configuração';

      // Definir erro no modal
      if (this.editModal) {
        this.editModal.setError('Erro ao salvar configuração. Tente novamente.');
      }
    }
  }

  /**
   * Remove promoção de conselheiro
   */
  async demoteCouncilor(councilor: AgentWithCouncilor): Promise<void> {
    if (!confirm(`Deseja remover ${councilor.customization?.display_name} do Conselho?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/councilors/${councilor.agent_id}/demote-councilor`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error(`Failed to demote councilor: ${response.status}`);
      }

      console.log(`🔻 Conselheiro ${councilor.customization?.display_name} removido`);

      // Remover da lista local
      this.councilors = this.councilors.filter(c => c.agent_id !== councilor.agent_id);
    } catch (error) {
      console.error('❌ Erro ao demover conselheiro:', error);
      this.errorMessage = 'Erro ao remover conselheiro';
    }
  }

  /**
   * Formata data relativa (ex: "há 15 minutos")
   */
  formatRelativeTime(date?: Date): string {
    if (!date) return 'Nunca executado';

    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'agora mesmo';
    if (minutes < 60) return `há ${minutes}min`;
    if (hours < 24) return `há ${hours}h`;
    return `há ${days}d`;
  }

  /**
   * Calcula próxima execução baseada no agendamento
   */
  getNextExecution(councilor: AgentWithCouncilor): string {
    const config = councilor.councilor_config;
    if (!config || !config.schedule.enabled) return 'Pausado';

    // TODO: Implementar cálculo real da próxima execução
    if (config.schedule.type === 'interval') {
      return `daqui a ${config.schedule.value}`;
    } else {
      return config.schedule.value;
    }
  }

  /**
   * Obtém classe CSS baseada no status
   */
  getStatusClass(councilor: AgentWithCouncilor): string {
    if (!councilor.councilor_config?.schedule.enabled) return 'status-paused';

    // TODO: Implementar lógica real de status baseada em última execução
    return 'status-active';
  }

  /**
   * Obtém emoji de status
   */
  getStatusEmoji(councilor: AgentWithCouncilor): string {
    if (!councilor.councilor_config?.schedule.enabled) return '⏸️';

    // TODO: Baseado no último resultado
    return '✅';
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
}
