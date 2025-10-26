import { Component, EventEmitter, HostListener, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgentWithCouncilor } from '../../models/councilor.types';

/**
 * Modal para editar configuração de um conselheiro
 *
 * Permite editar:
 * - Título/cargo do conselheiro
 * - Nome da tarefa
 * - Prompt da tarefa
 * - Intervalo de execução
 * - Preferências de notificação
 */
@Component({
  selector: 'app-councilor-edit-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './councilor-edit-modal.component.html',
  styleUrls: ['./councilor-edit-modal.component.css']
})
export class CouncilorEditModalComponent implements OnInit {
  @Input() councilor: AgentWithCouncilor | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<any>();

  // Form data
  title: string = '';
  taskName: string = '';
  taskPrompt: string = '';
  scheduleValue: string = '';

  // Notification preferences
  notifyOnSuccess: boolean = false;
  notifyOnWarning: boolean = true;
  notifyOnError: boolean = true;

  // Loading state
  isSaving: boolean = false;
  errorMessage: string = '';

  ngOnInit(): void {
    if (this.councilor && this.councilor.councilor_config) {
      const config = this.councilor.councilor_config;

      // Populate form with current values
      this.title = config.title || '';
      this.taskName = config.task?.name || '';
      this.taskPrompt = config.task?.prompt || '';
      this.scheduleValue = config.schedule?.value || '30m';

      // Notification preferences
      this.notifyOnSuccess = config.notifications?.on_success || false;
      this.notifyOnWarning = config.notifications?.on_warning || true;
      this.notifyOnError = config.notifications?.on_error || true;
    }
  }

  /**
   * Fecha o modal sem salvar
   */
  onClose(): void {
    if (this.isSaving) return;
    this.close.emit();
  }

  @HostListener('document:keydown.escape')
  handleEsc(): void {
    this.onClose();
  }

  /**
   * Valida o formulário
   */
  validateForm(): boolean {
    this.errorMessage = '';

    if (!this.title.trim()) {
      this.errorMessage = 'O título é obrigatório';
      return false;
    }

    if (!this.taskName.trim()) {
      this.errorMessage = 'O nome da tarefa é obrigatório';
      return false;
    }

    if (!this.taskPrompt.trim()) {
      this.errorMessage = 'O prompt da tarefa é obrigatório';
      return false;
    }

    if (!this.scheduleValue.match(/^\d+(m|h|d)$/)) {
      this.errorMessage = 'Formato de intervalo inválido. Use: 30m, 1h, 2d';
      return false;
    }

    return true;
  }

  /**
   * Salva as alterações
   */
  async onSave(): Promise<void> {
    if (!this.validateForm()) return;
    if (!this.councilor) return;

    this.isSaving = true;
    this.errorMessage = '';

    try {
      const updateData = {
        title: this.title.trim(),
        task: {
          name: this.taskName.trim(),
          prompt: this.taskPrompt.trim(),
          context_files: this.councilor.councilor_config?.task?.context_files || []
        },
        schedule: {
          type: 'interval',
          value: this.scheduleValue,
          enabled: this.councilor.councilor_config?.schedule?.enabled || true
        },
        notifications: {
          on_success: this.notifyOnSuccess,
          on_warning: this.notifyOnWarning,
          on_error: this.notifyOnError,
          channels: this.councilor.councilor_config?.notifications?.channels || ['panel']
        }
      };

      // Emit save event with update data
      this.save.emit(updateData);

      // O componente pai (dashboard) é responsável por fechar o modal
      // após salvar com sucesso no backend

    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      this.errorMessage = 'Erro ao salvar configuração. Tente novamente.';
      this.isSaving = false;
    }
  }

  /**
   * Define loading state externally (chamado pelo componente pai)
   */
  setLoadingState(loading: boolean): void {
    this.isSaving = loading;
  }

  /**
   * Define erro externamente (chamado pelo componente pai)
   */
  setError(error: string): void {
    this.errorMessage = error;
    this.isSaving = false;
  }

  /**
   * Obtém exemplos de intervalos
   */
  getScheduleExamples(): string[] {
    return ['15m', '30m', '1h', '2h', '6h', '12h', '1d'];
  }

  /**
   * Define intervalo com valor sugerido
   */
  setScheduleValue(value: string): void {
    this.scheduleValue = value;
  }
}
