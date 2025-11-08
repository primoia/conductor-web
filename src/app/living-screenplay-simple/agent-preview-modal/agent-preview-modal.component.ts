import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseModalComponent } from '../../shared/modals/base/base-modal.component';
import { ModalHeaderComponent } from '../../shared/modals/base/modal-header.component';
import { ModalFooterComponent, ModalButton } from '../../shared/modals/base/modal-footer.component';

export interface PreviewData {
  originalText: string;
  proposedText: string;
  agentName: string;
  agentEmoji: string;
}

export interface PreviewAction {
  action: 'accept' | 'reject';
  proposedText?: string;
}

/**
 * Agent Preview Modal Component
 * Modal para visualizar e comparar texto original vs proposto por um agente
 *
 * ✅ Normalizado seguindo especificação de modais padrão v1.0
 * ✅ Estende BaseModalComponent para comportamentos consistentes
 * ✅ Usa componentes base reutilizáveis (ModalHeader, ModalFooter)
 * ✅ Implementa acessibilidade (ARIA, keyboard navigation)
 *
 * @extends BaseModalComponent
 */
@Component({
  selector: 'app-agent-preview-modal',
  standalone: true,
  imports: [CommonModule, ModalHeaderComponent, ModalFooterComponent],
  templateUrl: './agent-preview-modal.component.html',
  styleUrls: ['./agent-preview-modal.component.scss']
})
export class AgentPreviewModalComponent extends BaseModalComponent implements OnChanges {
  // Inputs específicos do modal
  @Input() override isVisible: boolean = false;
  @Input() previewData: PreviewData | null = null;
  @Input() isLoading: boolean = false;
  @Input() error: string | null = null;

  // Outputs específicos do modal
  @Output() accept = new EventEmitter<PreviewAction>();
  @Output() reject = new EventEmitter<PreviewAction>();
  @Output() close = new EventEmitter<void>();

  // ===========================================================================
  // LIFECYCLE HOOKS
  // ===========================================================================

  /**
   * Lifecycle hook - detecta mudanças nos inputs
   */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isVisible'] && this.isVisible) {
      console.log('[AgentPreviewModal] Modal opened with data:', this.previewData);
      this.onModalOpened();
    }
  }

  /**
   * Hook do BaseModalComponent: previne fechamento por ESC durante loading
   * @override
   */
  protected override preventEscapeClose(): boolean {
    return this.isLoading || super.preventEscapeClose();
  }

  /**
   * Hook do BaseModalComponent: previne fechamento por backdrop durante loading
   * @override
   */
  protected override preventBackdropClose(): boolean {
    return this.isLoading || super.preventBackdropClose();
  }

  // ===========================================================================
  // MODAL-SPECIFIC COMPUTED PROPERTIES
  // ===========================================================================

  /**
   * Calcula diferença de caracteres entre original e proposto
   */
  getDiff(): number {
    if (!this.previewData) return 0;
    return this.previewData.proposedText.length - this.previewData.originalText.length;
  }

  /**
   * Gera título do modal com emoji e nome do agente
   */
  getModalTitle(): string {
    if (!this.previewData) return 'Preview';
    return `${this.previewData.agentEmoji} ${this.previewData.agentName} - Preview`;
  }

  /**
   * Configura ações do footer (botões)
   */
  getFooterActions(): ModalButton[] {
    return [
      {
        label: 'Rejeitar',
        type: 'secondary',
        icon: '❌',
        action: 'reject'
      },
      {
        label: 'Aceitar',
        type: 'primary',
        icon: '✅',
        action: 'accept'
      }
    ];
  }

  /**
   * Handler de cliques em ações do footer
   */
  onFooterAction(action: string): void {
    if (action === 'accept') {
      this.onAccept();
    } else if (action === 'reject') {
      this.onReject();
    }
  }

  /**
   * Aceita a proposta do agente
   */
  onAccept(): void {
    if (this.previewData) {
      this.accept.emit({
        action: 'accept',
        proposedText: this.previewData.proposedText
      });
    }
  }

  /**
   * Rejeita a proposta do agente
   */
  onReject(): void {
    this.reject.emit({ action: 'reject' });
  }

  /**
   * Override do método onClose do BaseModalComponent
   * Emite eventos específicos do modal além do closeModal padrão
   * @override
   */
  public override onClose(): void {
    // Emite evento específico de fechamento
    this.close.emit();
    // Chama o método base para emitir closeModal também
    super.onClose();
  }

  /**
   * Override do onBackdropClick para executar reject ao fechar
   * @override
   */
  public override onBackdropClick(event: Event): void {
    // BaseModalComponent já valida event.target === event.currentTarget
    // e já chama preventBackdropClose() que considera isLoading
    if (event.target === event.currentTarget && !this.preventBackdropClose()) {
      this.onReject();
    }
  }
}
