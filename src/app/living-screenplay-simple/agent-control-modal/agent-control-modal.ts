import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseModalComponent } from '../../shared/modals/base/base-modal.component';
import { ModalHeaderComponent } from '../../shared/modals/base/modal-header.component';
import { ModalFooterComponent, ModalButton } from '../../shared/modals/base/modal-footer.component';

// Interface for agent instance (copied from parent)
interface AgentInstance {
  id: string;
  emoji: string;
  definition: { title: string; description: string; unicode: string; };
  status: 'pending' | 'queued' | 'running' | 'completed' | 'error';
  position: { x: number; y: number; };
  executionState?: any;
}

// Events emitted by this modal
export interface AgentControlModalEvents {
  execute: { agent: AgentInstance; prompt: string };
  cancel: { agentId: string };
  close: void;
}

/**
 * Agent Control Modal Component
 * Modal para controlar execução de agentes
 *
 * ✅ Normalizado seguindo especificação de modais padrão v1.0
 * ✅ Estende BaseModalComponent para comportamentos consistentes
 * ✅ Usa componentes base reutilizáveis (ModalHeader, ModalFooter)
 * ✅ Implementa acessibilidade (ARIA, keyboard navigation)
 *
 * @extends BaseModalComponent
 */
@Component({
  selector: 'app-agent-control-modal',
  standalone: true,
  imports: [CommonModule, ModalHeaderComponent, ModalFooterComponent],
  templateUrl: './agent-control-modal.html',
  styleUrl: './agent-control-modal.scss'
})
export class AgentControlModal extends BaseModalComponent implements OnChanges {
  @Input() agent: AgentInstance | null = null;
  @Input() executionLogs: string[] = [];
  @Input() override isVisible: boolean = false;

  @Output() execute = new EventEmitter<{ agent: AgentInstance; prompt: string }>();
  @Output() cancel = new EventEmitter<{ agentId: string }>();
  @Output() override closeModal = new EventEmitter<void>();

  agentPrompt: string = '';
  private lastAgentId: string | null = null;

  constructor() {
    super(); // Call parent constructor
  }

  ngOnChanges(): void {
    // Clear prompt only when a different agent is selected
    if (this.agent && this.isVisible && this.agent.id !== this.lastAgentId) {
      this.agentPrompt = '';
      this.lastAgentId = this.agent.id;
      console.log('🔄 Modal opened with new agent, prompt cleared for:', this.agent.definition.title);
    }
  }

  onPromptInput(event: any): void {
    this.agentPrompt = event.target.value;
    console.log('📝 Prompt input:', this.agentPrompt, 'Length:', this.agentPrompt.length, 'Trimmed:', this.agentPrompt.trim().length);
  }

  onExecute(): void {
    if (this.agent && this.agentPrompt.trim()) {
      this.execute.emit({
        agent: this.agent,
        prompt: this.agentPrompt.trim()
      });
    }
  }

  onCancel(): void {
    if (this.agent) {
      this.cancel.emit({ agentId: this.agent.id });
    }
  }

  // ===========================================================================
  // OVERRIDES DO BASEMODALCOMPONENT
  // ===========================================================================

  /**
   * Fecha o modal
   * @override
   */
  override onClose(): void {
    this.closeModal.emit();
    super.onClose();
  }

  /**
   * Override do onBackdropClick para usar o método onClose customizado
   * @override
   */
  public override onBackdropClick(event: Event): void {
    if (event.target === event.currentTarget && !this.preventBackdropClose()) {
      this.onClose();
    }
  }

  /**
   * Hook do BaseModalComponent: previne fechamento por ESC durante execução
   * @override
   */
  protected override preventEscapeClose(): boolean {
    // Prevent closing during execution
    return (this.agent?.status === 'running' || this.agent?.status === 'queued') || super.preventEscapeClose();
  }

  /**
   * Hook do BaseModalComponent: previne fechamento por backdrop durante execução
   * @override
   */
  protected override preventBackdropClose(): boolean {
    // Prevent closing during execution
    return (this.agent?.status === 'running' || this.agent?.status === 'queued') || super.preventBackdropClose();
  }

  // ===========================================================================
  // MODAL-SPECIFIC METHODS
  // ===========================================================================

  getStatusText(status: string): string {
    switch (status) {
      case 'pending': return 'Pendente';
      case 'queued': return 'Na Fila';
      case 'running': return 'Executando';
      case 'completed': return 'Concluído';
      case 'error': return 'Erro';
      default: return 'Desconhecido';
    }
  }

  getResultDisplay(result: any): string {
    if (!result) return 'Nenhum resultado disponível';

    if (typeof result === 'string') {
      return result;
    }

    if (typeof result === 'object') {
      if (result.result) return result.result;
      if (result.message) return result.message;
      if (result.content) return result.content;
      return JSON.stringify(result, null, 2);
    }

    return String(result);
  }

  /**
   * Gera título do modal com emoji e nome do agente
   */
  getModalTitle(): string {
    if (!this.agent) return 'Controle de Agente';
    return `${this.agent.emoji} ${this.agent.definition.title}`;
  }

  /**
   * Configura ações do footer (botões) baseado no status
   */
  getFooterActions(): ModalButton[] {
    if (!this.agent) return [];

    switch (this.agent.status) {
      case 'pending':
        return [
          {
            label: 'Fechar',
            type: 'secondary',
            action: 'close'
          },
          {
            label: 'Executar Agente',
            type: 'primary',
            icon: '🚀',
            action: 'execute',
            disabled: !this.agentPrompt.trim()
          }
        ];

      case 'queued':
      case 'running':
        return [
          {
            label: 'Cancelar Execução',
            type: 'danger',
            icon: '❌',
            action: 'cancel'
          }
        ];

      case 'completed':
        return [
          {
            label: 'Fechar',
            type: 'secondary',
            action: 'close'
          },
          {
            label: 'Executar Novamente',
            type: 'primary',
            icon: '🔄',
            action: 'execute'
          }
        ];

      case 'error':
        return [
          {
            label: 'Fechar',
            type: 'secondary',
            action: 'close'
          },
          {
            label: 'Tentar Novamente',
            type: 'primary',
            icon: '🔄',
            action: 'execute'
          }
        ];

      default:
        return [
          {
            label: 'Fechar',
            type: 'secondary',
            action: 'close'
          }
        ];
    }
  }

  /**
   * Handler de cliques em ações do footer
   */
  onFooterAction(action: string): void {
    switch (action) {
      case 'execute':
        this.onExecute();
        break;
      case 'cancel':
        this.onCancel();
        break;
      case 'close':
        this.onClose();
        break;
    }
  }
}