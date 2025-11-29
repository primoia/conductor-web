import { Component, EventEmitter, Input, Output, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  CouncilorConfig,
  PromoteToCouncilorRequest,
  COUNCILOR_TASK_TEMPLATES,
  // NEW types for instance-based approach
  PromoteToCouncilorInstanceRequest,
  PromoteToCouncilorInstanceResponse
} from '../../models/councilor.types';
import { Agent } from '../../services/agent.service';
import { ModalHeaderComponent } from '../../shared/modals/base/modal-header.component';
import { ModalFooterComponent, ModalButton } from '../../shared/modals/base/modal-footer.component';
import { BaseModalComponent } from '../../shared/modals/base/base-modal.component';

/**
 * Modal para promover um agente a conselheiro.
 *
 * Permite configurar:
 * - Nome e cargo do conselheiro
 * - Tarefa automatica (nome, prompt, arquivos de contexto)
 * - Periodicidade (interval ou cron)
 * - Notificacoes
 *
 * @extends BaseModalComponent
 *
 * Outputs:
 * - close: Emitido quando o modal fecha (compatibilidade)
 * - closeModal: Emitido quando o modal fecha (padrao BaseModalComponent)
 * - promote: Emitido com PromoteToCouncilorRequest quando usuario confirma
 *
 * @example
 * ```html
 * <app-promote-councilor-modal
 *   [isVisible]="showModal"
 *   [agent]="selectedAgent"
 *   (promote)="handlePromote($event)"
 *   (close)="handleClose()">
 * </app-promote-councilor-modal>
 * ```
 */
@Component({
  selector: 'app-promote-councilor-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalHeaderComponent, ModalFooterComponent],
  templateUrl: './promote-councilor-modal.component.html',
  styleUrls: ['./promote-councilor-modal.component.scss']
})
export class PromoteCouncilorModalComponent extends BaseModalComponent implements OnInit, OnChanges {
  @Input() override isVisible = false;
  @Input() agent: Agent | null = null;

  // Outputs - close para compatibilidade, closeModal padrao
  @Output() close = new EventEmitter<void>();
  @Output() override closeModal = new EventEmitter<void>();
  @Output() promote = new EventEmitter<PromoteToCouncilorRequest>();
  // NEW: Output for instance-based promotion with response
  @Output() promoteInstance = new EventEmitter<PromoteToCouncilorInstanceResponse>();

  // Estado de erro vindo do componente pai
  errorMessage: string = '';

  // Templates de tarefas disponíveis
  taskTemplates = COUNCILOR_TASK_TEMPLATES;
  templateKeys = Object.keys(COUNCILOR_TASK_TEMPLATES);

  // Form data
  displayName: string = '';
  title: string = '';
  taskName: string = '';
  taskPrompt: string = '';
  contextFiles: string[] = [];
  newContextFile: string = '';

  scheduleType: 'interval' | 'cron' = 'interval';
  intervalValue: string = '30';
  intervalUnit: 'm' | 'h' | 'd' = 'm';
  cronValue: string = '0 9 * * 1';
  scheduleEnabled: boolean = true;

  notifyOnSuccess: boolean = false;
  notifyOnWarning: boolean = true;
  notifyOnError: boolean = true;
  notifyPanel: boolean = true;
  notifyToast: boolean = true;
  notifyEmail: boolean = false;

  // Working directory (project path)
  projectPath: string = '';

  // Estado de carregamento
  isSubmitting: boolean = false;
  footerButtons: ModalButton[] = [];

  constructor() {
    super();
  }

  ngOnInit(): void {
    console.log('🏛️ [PROMOTE-MODAL] ngOnInit', { isVisible: this.isVisible, agent: this.agent });
    this.setupFooterButtons();
    this.initializeFormFromAgent();
  }

  ngOnChanges(changes: SimpleChanges): void {
    console.log('🏛️ [PROMOTE-MODAL] ngOnChanges', { changes, isVisible: this.isVisible, agent: this.agent });

    // Quando o agente muda, reinicializar o formulario
    if (changes['agent'] && this.agent) {
      console.log('🏛️ [PROMOTE-MODAL] Agente mudou, reinicializando form');
      this.initializeFormFromAgent();
    }

    // Quando o modal abre, limpar erro
    if (changes['isVisible'] && this.isVisible) {
      console.log('🏛️ [PROMOTE-MODAL] Modal ficou visível');
      this.errorMessage = '';
    }
  }

  /**
   * Chamado quando qualquer campo do formulário muda.
   * Atualiza o estado dos botões.
   */
  onFormChange(): void {
    this.updateFooterButtons();
  }

  /**
   * Inicializa o formulario com dados do agente
   */
  private initializeFormFromAgent(): void {
    if (!this.agent) return;

    // Pre-preencher com dados do agente
    this.displayName = this.generateDefaultName();
    this.title = `Conselheiro de ${this.agent.title || this.agent.name}`;
    this.taskName = `Monitoramento de ${this.agent.name}`;
    this.taskPrompt = `Analise o projeto e identifique possiveis melhorias relacionadas a ${this.agent.description || this.agent.name}.`;

    // Reset outros campos
    this.contextFiles = [];
    this.scheduleType = 'interval';
    this.intervalValue = '30';
    this.intervalUnit = 'm';
    this.scheduleEnabled = true;
    this.projectPath = '';  // Will be filled by user
    this.errorMessage = '';
  }

  /**
   * Define mensagem de erro externamente (chamado pelo componente pai)
   */
  setError(message: string): void {
    this.errorMessage = message;
    this.isSubmitting = false;
    this.updateFooterButtons();
  }

  /**
   * Reseta estado de submissao (chamado pelo componente pai apos sucesso)
   */
  resetSubmitState(): void {
    this.isSubmitting = false;
    this.updateFooterButtons();
  }

  /**
   * Configura os botões do footer do modal.
   * @private
   */
  private setupFooterButtons(): void {
    this.footerButtons = [
      {
        label: 'Cancelar',
        type: 'secondary',
        action: 'cancel',
        disabled: this.isSubmitting
      },
      {
        label: this.isSubmitting ? 'Promovendo...' : '⭐ Promover',
        type: 'primary',
        action: 'promote',
        disabled: !this.isValid() || this.isSubmitting
      }
    ];
  }

  /**
   * Atualiza o estado dos botões do footer.
   * @private
   */
  private updateFooterButtons(): void {
    this.footerButtons = this.footerButtons.map(button => ({
      ...button,
      disabled: button.action === 'cancel' ? this.isSubmitting : !this.isValid() || this.isSubmitting,
      label: button.action === 'promote' ? (this.isSubmitting ? 'Promovendo...' : '⭐ Promover') : button.label
    }));
  }

  /**
   * Manipula ações dos botões do footer.
   * @param action - Ação disparada pelo botão
   */
  handleFooterAction(action: string): void {
    console.log('🏛️ [PROMOTE-MODAL] handleFooterAction:', action);
    console.log('🏛️ [PROMOTE-MODAL] isValid:', this.isValid());
    console.log('🏛️ [PROMOTE-MODAL] isSubmitting:', this.isSubmitting);

    switch (action) {
      case 'cancel':
        this.onCancel();
        break;
      case 'promote':
        this.onSubmit();
        break;
    }
  }


  /**
   * Gera nome padrão baseado no agente
   */
  private generateDefaultName(): string {
    const names = ['Silva', 'Maria', 'João', 'Pedro', 'Ana', 'Carlos'];
    return names[Math.floor(Math.random() * names.length)];
  }

  /**
   * Aplica template de tarefa selecionado
   */
  applyTemplate(templateKey: string): void {
    const template = this.getTemplate(templateKey);

    if (template) {
      this.taskName = template.name;
      this.taskPrompt = template.prompt;
    }
  }

  /**
   * Obtém template de tarefa com type safety
   */
  getTemplate(key: string): { name: string; prompt: string; output_format: string } | undefined {
    return this.taskTemplates[key as keyof typeof this.taskTemplates];
  }

  /**
   * Obtém nome do template com type safety (para uso no template HTML)
   */
  getTemplateName(key: string): string {
    const template = this.getTemplate(key);
    return template ? template.name : '';
  }

  /**
   * Adiciona arquivo de contexto
   */
  addContextFile(): void {
    if (this.newContextFile.trim()) {
      this.contextFiles.push(this.newContextFile.trim());
      this.newContextFile = '';
    }
  }

  /**
   * Remove arquivo de contexto
   */
  removeContextFile(index: number): void {
    this.contextFiles.splice(index, 1);
  }

  /**
   * Valida formulário
   */
  isValid(): boolean {
    // intervalValue pode ser string ou number dependendo do input
    const intervalValid = this.intervalValue !== null &&
                          this.intervalValue !== undefined &&
                          String(this.intervalValue).trim().length > 0 &&
                          Number(this.intervalValue) > 0;

    const cronValid = this.cronValue?.trim().length > 0;

    const validations = {
      displayName: this.displayName.trim().length > 0,
      title: this.title.trim().length > 0,
      projectPath: this.projectPath.trim().length > 0,  // Required: working directory
      taskName: this.taskName.trim().length > 0,
      taskPrompt: this.taskPrompt.trim().length > 0,
      schedule: this.scheduleType === 'interval' ? intervalValid : cronValid
    };

    const isValid = Object.values(validations).every(v => v);

    if (!isValid) {
      console.log('🏛️ [PROMOTE-MODAL] Validações:', validations);
      console.log('🏛️ [PROMOTE-MODAL] Valores:', {
        displayName: this.displayName,
        title: this.title,
        projectPath: this.projectPath,
        taskName: this.taskName,
        taskPrompt: this.taskPrompt?.substring(0, 50) + '...',
        scheduleType: this.scheduleType,
        intervalValue: this.intervalValue,
        intervalValueType: typeof this.intervalValue
      });
    }

    return isValid;
  }

  /**
   * Submete formulário de promoção
   * UPDATED: Agora usa novo endpoint POST /api/councilors/promote
   */
  async onSubmit(): Promise<void> {
    if (!this.isValid() || this.isSubmitting || !this.agent) return;

    this.isSubmitting = true;
    this.errorMessage = '';
    this.updateFooterButtons();

    try {
      // Construir valor de agendamento
      const scheduleValue =
        this.scheduleType === 'interval'
          ? `${this.intervalValue}${this.intervalUnit}`
          : this.cronValue;

      // Construir configuração do conselheiro
      const councilorConfig: CouncilorConfig = {
        title: this.title,
        schedule: {
          type: this.scheduleType,
          value: scheduleValue,
          enabled: this.scheduleEnabled
        },
        task: {
          name: this.taskName,
          prompt: this.taskPrompt,
          context_files: this.contextFiles.length > 0 ? this.contextFiles : undefined,
          output_format: 'checklist'
        },
        notifications: {
          on_success: this.notifyOnSuccess,
          on_warning: this.notifyOnWarning,
          on_error: this.notifyOnError,
          channels: [
            ...(this.notifyPanel ? ['panel' as const] : []),
            ...(this.notifyToast ? ['toast' as const] : []),
            ...(this.notifyEmail ? ['email' as const] : [])
          ]
        }
      };

      // ============================================================
      // NEW: Call POST /api/councilors/promote directly
      // ============================================================
      const promoteRequest: PromoteToCouncilorInstanceRequest = {
        agent_id: this.agent.id,
        councilor_config: councilorConfig,
        customization: {
          display_name: this.displayName
        },
        cwd: this.projectPath.trim() || undefined  // Working directory for execution
      };

      console.log('🏛️ [PROMOTE COUNCILOR] Chamando POST /api/councilors/promote...', promoteRequest);

      const response = await fetch('/api/councilors/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(promoteRequest)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Falha ao promover: ${response.status}`);
      }

      const result: PromoteToCouncilorInstanceResponse = await response.json();

      console.log('✅ [PROMOTE COUNCILOR] Promoção concluída:', result);
      console.log(`   - Instance ID: ${result.instance_id}`);
      console.log(`   - Screenplay ID: ${result.screenplay_id}`);
      console.log(`   - Conversation ID: ${result.conversation_id}`);

      // Emitir evento com resultado completo (para parent component atualizar)
      this.promoteInstance.emit(result);

      // LEGACY: Também emitir evento antigo para compatibilidade
      const legacyRequest: PromoteToCouncilorRequest = {
        councilor_config: councilorConfig,
        customization: { display_name: this.displayName }
      };
      this.promote.emit(legacyRequest);

      // Fechar modal após sucesso
      this.onClose();

    } catch (error) {
      console.error('❌ [PROMOTE COUNCILOR] Erro ao promover:', error);
      this.errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao promover conselheiro';
    } finally {
      this.isSubmitting = false;
      this.updateFooterButtons();
    }
  }

  // ============================================================
  // OVERRIDES DO BASEMODALCOMPONENT
  // ============================================================

  /**
   * Fecha o modal emitindo eventos close e closeModal.
   * @override
   */
  override onClose(): void {
    if (this.isSubmitting) return;

    this.close.emit();     // Compatibilidade com template que usa (close)
    this.closeModal.emit(); // Padrao BaseModalComponent
    super.onClose();
  }

  /**
   * Manipula clique no backdrop.
   * SEMPRE previne fechamento - usuario deve usar o X ou Cancelar.
   * @override
   */
  public override onBackdropClick(event: Event): void {
    // Sempre previne fechamento pelo backdrop neste modal
    event.stopPropagation();
  }

  /**
   * Determina se deve prevenir fechamento via ESC.
   * @override
   */
  protected override preventEscapeClose(): boolean {
    return this.isSubmitting;
  }

  /**
   * Determina se deve prevenir fechamento via backdrop.
   * @override
   */
  protected override preventBackdropClose(): boolean {
    return this.isSubmitting;
  }

  // ============================================================
  // MÉTODOS ESPECÍFICOS DO MODAL
  // ============================================================

  /**
   * Cancela e fecha modal
   */
  onCancel(): void {
    this.onClose();
  }

  /**
   * Formata descrição de agendamento
   */
  getScheduleDescription(): string {
    if (this.scheduleType === 'interval') {
      const unitNames = { m: 'minutos', h: 'horas', d: 'dias' };
      return `A cada ${this.intervalValue} ${unitNames[this.intervalUnit]}`;
    } else {
      // Interpretar cron básico
      if (this.cronValue === '0 9 * * 1') return 'Segundas-feiras às 9h';
      if (this.cronValue === '0 0 * * *') return 'Todos os dias à meia-noite';
      return this.cronValue;
    }
  }
}
