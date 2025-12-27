import { Component, EventEmitter, Input, OnInit, OnChanges, SimpleChanges, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BaseModalComponent } from '../../shared/modals/base/base-modal.component';
import { AgentWithCouncilor, CouncilorInstance } from '../../models/councilor.types';
import { ModalHeaderComponent } from '../../shared/modals/base/modal-header.component';
import { ModalFooterComponent, ModalButton } from '../../shared/modals/base/modal-footer.component';

/**
 * Modal para editar configuração de um conselheiro
 *
 * ✅ Normalizado seguindo especificação de modais padrão v1.0
 * ✅ Estende BaseModalComponent para comportamentos consistentes
 * ✅ Usa componentes base reutilizáveis (ModalHeader, ModalFooter)
 * ✅ Implementa acessibilidade (ARIA, keyboard navigation)
 *
 * Permite editar:
 * - Título/cargo do conselheiro
 * - Nome da tarefa
 * - Prompt da tarefa
 * - Intervalo de execução
 * - Preferências de notificação
 *
 * @extends BaseModalComponent
 */
@Component({
  selector: 'app-councilor-edit-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalHeaderComponent, ModalFooterComponent],
  templateUrl: './councilor-edit-modal.component.html',
  styleUrls: ['./councilor-edit-modal.component.scss']
})
export class CouncilorEditModalComponent extends BaseModalComponent implements OnInit, OnChanges {
  @Input() override isVisible: boolean = false;
  @Input() councilor: AgentWithCouncilor | null = null;
  @Input() instance: CouncilorInstance | null = null;  // NEW: Support for instances
  @Output() override closeModal = new EventEmitter<void>();
  @Output() save = new EventEmitter<any>();

  // Form data
  title: string = '';
  taskName: string = '';
  taskPrompt: string = '';
  scheduleValue: string = '';
  cwd: string = '';  // Working directory

  // Notification preferences
  notifyOnSuccess: boolean = false;
  notifyOnWarning: boolean = true;
  notifyOnError: boolean = true;

  // Loading state
  isSaving: boolean = false;
  errorMessage: string = '';

  // Track which type we're editing
  isEditingInstance: boolean = false;

  constructor() {
    super(); // Call parent constructor
  }

  ngOnInit(): void {
    this.initializeForm();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['councilor'] || changes['instance']) {
      this.initializeForm();
    }
  }

  /**
   * Initialize form from councilor or instance data
   */
  private initializeForm(): void {
    // Check if we're editing an instance or legacy councilor
    const config = this.instance?.councilor_config || this.councilor?.councilor_config;
    this.isEditingInstance = !!this.instance;

    if (config) {
      // Populate form with current values
      this.title = config.title || '';
      this.taskName = config.task?.name || '';
      this.taskPrompt = config.task?.prompt || '';
      this.scheduleValue = config.schedule?.value || '30m';

      // Notification preferences
      this.notifyOnSuccess = config.notifications?.on_success || false;
      this.notifyOnWarning = config.notifications?.on_warning ?? true;
      this.notifyOnError = config.notifications?.on_error ?? true;
    }

    // Working directory (from instance or councilor)
    this.cwd = this.instance?.cwd || (this.councilor as any)?.cwd || '';
  }

  // ===========================================================================
  // OVERRIDES DO BASEMODALCOMPONENT
  // ===========================================================================

  /**
   * Fecha o modal
   * @override
   */
  override onClose(): void {
    if (this.isSaving) return;
    this.closeModal.emit();
    super.onClose();
  }

  /**
   * Hook do BaseModalComponent: previne fechamento por ESC durante salvamento
   * @override
   */
  protected override preventEscapeClose(): boolean {
    return this.isSaving || super.preventEscapeClose();
  }

  /**
   * Hook do BaseModalComponent: previne fechamento por backdrop durante salvamento
   * @override
   */
  protected override preventBackdropClose(): boolean {
    return this.isSaving || super.preventBackdropClose();
  }

  /**
   * Override do onBackdropClick
   * @override
   */
  public override onBackdropClick(event: Event): void {
    if (event.target === event.currentTarget && !this.preventBackdropClose()) {
      this.onClose();
    }
  }

  // ===========================================================================
  // MODAL-SPECIFIC METHODS
  // ===========================================================================

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
    console.log('🔄 [EDIT MODAL] onSave called');
    console.log('🔄 [EDIT MODAL] councilor:', this.councilor);
    console.log('🔄 [EDIT MODAL] instance:', this.instance);

    if (!this.validateForm()) {
      console.log('❌ [EDIT MODAL] Form validation failed');
      return;
    }
    if (!this.councilor && !this.instance) {
      console.log('❌ [EDIT MODAL] No councilor or instance selected');
      return;
    }

    this.isSaving = true;
    this.errorMessage = '';

    try {
      const config = this.instance?.councilor_config || this.councilor?.councilor_config;

      const updateData = {
        // Include instance_id if editing an instance
        instance_id: this.instance?.instance_id,
        is_instance: this.isEditingInstance,
        title: this.title.trim(),
        cwd: this.cwd.trim(),  // Working directory
        task: {
          name: this.taskName.trim(),
          prompt: this.taskPrompt.trim(),
          context_files: config?.task?.context_files || []
        },
        schedule: {
          type: 'interval',
          value: this.scheduleValue,
          enabled: config?.schedule?.enabled ?? true
        },
        notifications: {
          on_success: this.notifyOnSuccess,
          on_warning: this.notifyOnWarning,
          on_error: this.notifyOnError,
          channels: config?.notifications?.channels || ['panel']
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

  /**
   * Retorna os botões do footer
   */
  get footerButtons(): ModalButton[] {
    return [
      {
        label: 'Cancelar',
        type: 'secondary',
        action: 'cancel',
        disabled: this.isSaving
      },
      {
        label: this.isSaving ? 'Salvando...' : '💾 Salvar Alterações',
        type: 'primary',
        action: 'save',
        disabled: this.isSaving,
        loading: this.isSaving
      }
    ];
  }

  /**
   * Manipula ações dos botões do footer.
   * @param action - Ação disparada pelo botão
   */
  handleFooterAction(action: string): void {
    console.log('🔘 [EDIT MODAL] handleFooterAction:', action);
    switch (action) {
      case 'cancel':
        this.onClose();
        break;
      case 'save':
        this.onSave();
        break;
    }
  }
}
