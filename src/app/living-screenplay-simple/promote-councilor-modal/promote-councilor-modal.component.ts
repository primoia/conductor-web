import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AgentWithCouncilor,
  CouncilorConfig,
  PromoteToCouncilorRequest,
  COUNCILOR_TASK_TEMPLATES
} from '../../models/councilor.types';
import { ModalHeaderComponent } from '../../shared/modals/base/modal-header.component';
import { ModalFooterComponent, ModalButton } from '../../shared/modals/base/modal-footer.component';
import { BaseModalComponent } from '../../shared/modals/base/base-modal.component';

/**
 * Modal para promover um agente a conselheiro.
 *
 * Permite configurar:
 * - Nome e cargo do conselheiro
 * - Tarefa automática (nome, prompt, arquivos de contexto)
 * - Periodicidade (interval ou cron)
 * - Notificações
 *
 * @extends BaseModalComponent
 * ✓ Implementa BaseModalComponent
 * ✓ Usa isVisible para controle de exibição
 * ✓ Emite closeModal ao fechar
 * ✓ Suporta fechamento via ESC (gerenciado pelo BaseModalComponent)
 * ✓ Suporta fechamento via backdrop (gerenciado pelo BaseModalComponent)
 *
 * @example
 * ```html
 * <app-promote-councilor-modal
 *   [isVisible]="showModal"
 *   [agent]="selectedAgent"
 *   (promote)="handlePromote($event)"
 *   (closeModal)="handleClose()">
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
export class PromoteCouncilorModalComponent extends BaseModalComponent implements OnInit {
  @Input() override isVisible = false;
  @Input() agent?: AgentWithCouncilor;
  @Output() override closeModal = new EventEmitter<void>();
  @Output() promote = new EventEmitter<PromoteToCouncilorRequest>();

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

  // Estado de carregamento
  isSubmitting: boolean = false;
  footerButtons: ModalButton[] = [];

  constructor() {
    super();
  }

  ngOnInit(): void {
    this.setupFooterButtons();
    if (this.agent) {
      // Pré-preencher com dados do agente
      this.displayName = this.agent.customization?.display_name || this.generateDefaultName();
      this.title = `Conselheiro de ${this.agent.title || this.agent.name}`;

      // Se não há nome de tarefa, usar um padrão
      if (!this.taskName) {
        this.taskName = `Monitoramento de ${this.agent.name}`;
      }

      // Se não há prompt de tarefa, usar um padrão
      if (!this.taskPrompt) {
        this.taskPrompt = `Analise o projeto e identifique possíveis melhorias relacionadas a ${this.agent.description || this.agent.name}.`;
      }
    }
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
    return (
      this.displayName.trim().length > 0 &&
      this.title.trim().length > 0 &&
      this.taskName.trim().length > 0 &&
      this.taskPrompt.trim().length > 0 &&
      (this.scheduleType === 'interval' ? this.intervalValue.length > 0 : this.cronValue.length > 0)
    );
  }

  /**
   * Submete formulário de promoção
   */
  async onSubmit(): Promise<void> {
    if (!this.isValid() || this.isSubmitting) return;

    this.isSubmitting = true;
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

      // Construir request de promoção
      const request: PromoteToCouncilorRequest = {
        councilor_config: councilorConfig,
        customization: {
          display_name: this.displayName
        }
      };

      // Emitir evento de promoção
      this.promote.emit(request);

      console.log('✅ [PROMOTE COUNCILOR] Promoção solicitada:', request);
    } catch (error) {
      console.error('❌ [PROMOTE COUNCILOR] Erro ao promover:', error);
    } finally {
      this.isSubmitting = false;
      this.updateFooterButtons();
    }
  }

  // ============================================================
  // OVERRIDES DO BASEMODALCOMPONENT
  // ============================================================

  /**
   * Fecha o modal emitindo evento closeModal.
   * @override
   */
  override onClose(): void {
    this.closeModal.emit();
    super.onClose();
  }

  /**
   * Manipula clique no backdrop.
   * Previne fechamento se modal estiver processando.
   * @override
   */
  public override onBackdropClick(event: Event): void {
    if (this.preventBackdropClose()) {
      event.stopPropagation();
      return;
    }
    super.onBackdropClick(event);
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
