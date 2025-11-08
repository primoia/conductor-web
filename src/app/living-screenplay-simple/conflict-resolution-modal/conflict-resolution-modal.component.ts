import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BaseModalComponent } from '../../shared/modals/base/base-modal.component';
import { Screenplay } from '../../services/screenplay-storage';
import { ModalHeaderComponent } from '../../shared/modals/base/modal-header.component';
import { ModalFooterComponent, ModalButton } from '../../shared/modals/base/modal-footer.component';

/**
 * Interface para resolução de conflitos de arquivos
 */
export interface ConflictResolution {
  action: 'overwrite' | 'keep-existing' | 'rename' | 'cancel';
  newName?: string;
}

/**
 * Modal para resolução de conflitos de arquivos
 *
 * ✅ Normalizado seguindo especificação de modais padrão v1.0
 * ✅ Estende BaseModalComponent para comportamentos consistentes
 * ✅ Usa componentes base reutilizáveis (ModalHeader, ModalFooter)
 * ✅ Implementa acessibilidade (ARIA, keyboard navigation)
 *
 * Permite ao usuário escolher entre:
 * - Sobrescrever o arquivo existente
 * - Manter o arquivo existente
 * - Renomear o novo arquivo
 * - Cancelar a operação
 *
 * @extends BaseModalComponent
 */
@Component({
  selector: 'app-conflict-resolution-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalHeaderComponent, ModalFooterComponent],
  templateUrl: './conflict-resolution-modal.component.html',
  styleUrl: './conflict-resolution-modal.component.scss'
})
export class ConflictResolutionModalComponent extends BaseModalComponent implements OnInit {
  @Input() override isVisible: boolean = false;
  @Input() existingScreenplay: Screenplay | null = null;
  @Input() newFileName: string = '';
  @Input() newContent: string = '';
  @Output() resolve = new EventEmitter<ConflictResolution>();
  @Output() override closeModal = new EventEmitter<void>();

  showRenameInput: boolean = false;
  newName: string = '';

  constructor() {
    super(); // Call parent constructor
  }

  ngOnInit(): void {
    if (this.newFileName) {
      this.newName = this.newFileName;
    }
  }

  /**
   * Retorna o tamanho do conteúdo existente
   */
  get existingContentLength(): number {
    return this.existingScreenplay?.content?.length || 0;
  }

  /**
   * Retorna o tamanho do novo conteúdo
   */
  get newContentLength(): number {
    return this.newContent?.length || 0;
  }

  /**
   * Retorna a diferença de tamanho entre os arquivos
   */
  get contentDifference(): string {
    const diff = this.newContentLength - this.existingContentLength;
    if (diff === 0) return 'mesmo tamanho';
    if (diff > 0) return `+${diff} caracteres`;
    return `${diff} caracteres`;
  }

  /**
   * Retorna os botões para o modo padrão (não renomear)
   */
  get defaultButtons(): ModalButton[] {
    return [
      {
        label: 'Sobrescrever',
        icon: 'fas fa-sync-alt',
        type: 'danger',
        action: 'overwrite',
        ariaLabel: 'Substituir o roteiro existente pelo novo'
      },
      {
        label: 'Manter Existente',
        icon: 'fas fa-ban',
        type: 'secondary',
        action: 'keep-existing',
        ariaLabel: 'Manter o roteiro existente e descartar o novo'
      },
      {
        label: 'Renomear',
        icon: 'fas fa-edit',
        type: 'primary',
        action: 'rename',
        ariaLabel: 'Salvar com um nome diferente'
      }
    ];
  }

  /**
   * Retorna os botões para o modo renomear
   */
  get renameButtons(): ModalButton[] {
    return [
      {
        label: 'Voltar',
        icon: 'fas fa-arrow-left',
        type: 'secondary',
        action: 'back'
      },
      {
        label: 'Confirmar Renomeação',
        icon: 'fas fa-check',
        type: 'primary',
        action: 'confirm-rename',
        disabled: !this.newName.trim()
      }
    ];
  }

  /**
   * Manipula ações dos botões do footer.
   * @param action - Ação disparada pelo botão
   */
  handleFooterAction(action: string): void {
    switch (action) {
      case 'overwrite':
        this.onOverwrite();
        break;
      case 'keep-existing':
        this.onKeepExisting();
        break;
      case 'rename':
        this.onShowRename();
        break;
      case 'back':
        this.showRenameInput = false;
        break;
      case 'confirm-rename':
        this.onRename();
        break;
    }
  }

  /**
   * Sobrescreve o arquivo existente
   */
  onOverwrite(): void {
    this.resolve.emit({ action: 'overwrite' });
    this.close();
  }

  /**
   * Mantém o arquivo existente
   */
  onKeepExisting(): void {
    this.resolve.emit({ action: 'keep-existing' });
    this.close();
  }

  /**
   * Mostra o input de renomeação
   */
  onShowRename(): void {
    this.showRenameInput = true;
    // Generate suggested name with counter
    const baseName = this.newName.replace(/\s*\(\d+\)$/, '');
    this.newName = `${baseName} (1)`;
  }

  /**
   * Renomeia o arquivo
   */
  onRename(): void {
    if (!this.newName.trim()) {
      return;
    }

    this.resolve.emit({
      action: 'rename',
      newName: this.newName.trim()
    });
    this.close();
  }

  /**
   * Cancela a operação
   */
  onCancel(): void {
    this.resolve.emit({ action: 'cancel' });
    this.close();
  }

  // ===========================================================================
  // OVERRIDES DO BASEMODALCOMPONENT
  // ===========================================================================

  /**
   * Fecha o modal
   * @override
   */
  override onClose(): void {
    this.showRenameInput = false;
    this.closeModal.emit();
    super.onClose();
  }

  /**
   * Override do onBackdropClick para usar o método onCancel customizado
   * @override
   */
  public override onBackdropClick(event: Event): void {
    if (event.target === event.currentTarget && !this.preventBackdropClose()) {
      this.onCancel();
    }
  }

  /**
   * Método interno de fechamento
   */
  private close(): void {
    this.onClose();
  }
}
