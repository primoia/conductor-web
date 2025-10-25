import { Component, EventEmitter, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { AgentWithCouncilor, CouncilorReport } from '../../models/councilor.types';
import { CouncilorSchedulerService } from '../../services/councilor-scheduler.service';

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
  imports: [CommonModule],
  templateUrl: './councilors-dashboard.component.html',
  styleUrls: ['./councilors-dashboard.component.css']
})
export class CouncilorsDashboardComponent implements OnInit, OnDestroy {
  @Output() close = new EventEmitter<void>();
  @Output() promoteNew = new EventEmitter<void>();

  councilors: AgentWithCouncilor[] = [];
  private subscription?: Subscription;

  // Estado de carregamento e erros
  isLoading = true;
  errorMessage = '';

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
    this.councilorScheduler.getCouncilorReport(councilor.agent_id).subscribe(
      report => {
        console.log('Relatório:', report);
        // TODO: Abrir modal com relatório
      },
      error => {
        console.error('Erro ao carregar relatório:', error);
        this.errorMessage = 'Erro ao carregar relatório';
      }
    );
  }

  /**
   * Abre modal de edição
   */
  editCouncilor(councilor: AgentWithCouncilor): void {
    // TODO: Abrir modal de edição
    console.log('Editando conselheiro:', councilor);
  }

  /**
   * Remove promoção de conselheiro
   */
  async demoteCouncilor(councilor: AgentWithCouncilor): Promise<void> {
    if (!confirm(`Deseja remover ${councilor.customization?.display_name} do Conselho?`)) {
      return;
    }

    try {
      // TODO: Implementar endpoint DELETE /api/agents/:id/demote-councilor
      await fetch(`/api/agents/${councilor.agent_id}/demote-councilor`, {
        method: 'DELETE'
      });

      console.log(`🔻 Conselheiro ${councilor.customization?.display_name} removido`);

      // Remover da lista local
      this.councilors = this.councilors.filter(c => c.agent_id !== councilor.agent_id);
    } catch (error) {
      console.error('Erro ao demover conselheiro:', error);
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
