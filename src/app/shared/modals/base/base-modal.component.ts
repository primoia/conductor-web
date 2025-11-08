// =============================================================================
// BASE MODAL COMPONENT - Conductor Web
// =============================================================================
// Versão: 1.0
// Data: 08/11/2025
// Descrição: Componente abstrato base para todos os modais do sistema
// =============================================================================

import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';

/**
 * Classe abstrata base para componentes modais.
 *
 * Esta classe fornece funcionalidade comum para todos os modais do sistema,
 * incluindo gerenciamento de visibilidade, fechamento, e comportamentos
 * acessíveis (ESC key, backdrop click).
 *
 * @abstract
 * @class BaseModalComponent
 *
 * @example
 * ```typescript
 * @Component({
 *   selector: 'app-my-modal',
 *   templateUrl: './my-modal.component.html',
 *   styleUrls: ['./my-modal.component.scss']
 * })
 * export class MyModalComponent extends BaseModalComponent {
 *   // Sua implementação específica
 * }
 * ```
 *
 * @example
 * ```html
 * <!-- No template pai -->
 * <app-my-modal
 *   [isVisible]="showModal"
 *   (closeModal)="onModalClosed()">
 * </app-my-modal>
 * ```
 */
@Component({
  template: '',
  standalone: true
})
export abstract class BaseModalComponent {
  // ===========================================================================
  // INPUTS E OUTPUTS
  // ===========================================================================

  /**
   * Controla a visibilidade do modal.
   * Quando `true`, o modal é exibido. Quando `false`, é ocultado.
   *
   * @type {boolean}
   * @default false
   */
  @Input() isVisible: boolean = false;

  /**
   * Evento emitido quando o modal deve ser fechado.
   * O componente pai deve ouvir este evento e definir `isVisible = false`.
   *
   * @type {EventEmitter<void>}
   *
   * @example
   * ```typescript
   * onModalClosed(): void {
   *   this.showModal = false;
   * }
   * ```
   */
  @Output() closeModal = new EventEmitter<void>();

  // ===========================================================================
  // PROPRIEDADES PROTEGIDAS
  // ===========================================================================

  /**
   * Indica se o modal está processando uma operação (ex: salvando dados).
   * Quando `true`, impede fechamento acidental do modal.
   *
   * @type {boolean}
   * @protected
   * @default false
   */
  protected isProcessing: boolean = false;

  // ===========================================================================
  // HOST LISTENERS
  // ===========================================================================

  /**
   * Manipulador de evento para a tecla ESC.
   * Fecha o modal quando ESC é pressionado, exceto se:
   * - Modal não está visível
   * - preventEscapeClose() retorna true
   *
   * @param {KeyboardEvent} event - Evento de teclado
   */
  @HostListener('document:keydown.escape')
  handleEscapeKey(): void {
    if (this.isVisible && !this.preventEscapeClose()) {
      this.onClose();
    }
  }

  // ===========================================================================
  // MÉTODOS PÚBLICOS
  // ===========================================================================

  /**
   * Fecha o modal emitindo o evento `closeModal`.
   *
   * Este método pode ser sobrescrito em classes derivadas para adicionar
   * lógica customizada antes de fechar (ex: confirmação).
   *
   * @public
   * @example
   * ```typescript
   * <button (click)="onClose()">Fechar</button>
   * ```
   */
  public onClose(): void {
    if (!this.preventClose()) {
      this.closeModal.emit();
    }
  }

  /**
   * Manipulador para cliques no backdrop (overlay).
   * Fecha o modal apenas se o clique foi no backdrop, não no conteúdo.
   *
   * @param {Event} event - Evento de clique
   * @public
   *
   * @example
   * ```html
   * <div class="modal-backdrop" (click)="onBackdropClick($event)">
   *   <div class="modal-content" (click)="$event.stopPropagation()">
   *     <!-- Conteúdo do modal -->
   *   </div>
   * </div>
   * ```
   */
  public onBackdropClick(event: Event): void {
    // Verifica se o clique foi exatamente no backdrop, não em elementos filhos
    if (event.target === event.currentTarget && !this.preventBackdropClose()) {
      this.onClose();
    }
  }

  // ===========================================================================
  // HOOKS PROTEGIDOS (Override Optional)
  // ===========================================================================

  /**
   * Hook que determina se o modal pode ser fechado via ESC.
   *
   * Sobrescreva este método em classes derivadas para implementar
   * lógica customizada de prevenção de fechamento.
   *
   * @protected
   * @returns {boolean} `true` para prevenir fechamento, `false` para permitir
   *
   * @example
   * ```typescript
   * protected override preventEscapeClose(): boolean {
   *   // Previne fechamento se estiver salvando
   *   return this.isProcessing;
   * }
   * ```
   */
  protected preventEscapeClose(): boolean {
    return this.isProcessing;
  }

  /**
   * Hook que determina se o modal pode ser fechado ao clicar no backdrop.
   *
   * Sobrescreva este método para customizar o comportamento.
   *
   * @protected
   * @returns {boolean} `true` para prevenir fechamento, `false` para permitir
   *
   * @example
   * ```typescript
   * protected override preventBackdropClose(): boolean {
   *   // Previne fechamento se houver alterações não salvas
   *   return this.hasUnsavedChanges;
   * }
   * ```
   */
  protected preventBackdropClose(): boolean {
    return this.isProcessing;
  }

  /**
   * Hook genérico que determina se o modal pode ser fechado.
   *
   * Sobrescreva para implementar validação customizada antes de fechar.
   *
   * @protected
   * @returns {boolean} `true` para prevenir fechamento, `false` para permitir
   *
   * @example
   * ```typescript
   * protected override preventClose(): boolean {
   *   if (this.hasUnsavedChanges) {
   *     return !confirm('Descartar alterações?');
   *   }
   *   return false;
   * }
   * ```
   */
  protected preventClose(): boolean {
    return false;
  }

  // ===========================================================================
  // LIFECYCLE HOOKS (Optional Override)
  // ===========================================================================

  /**
   * Chamado quando o modal é aberto (isVisible muda para true).
   *
   * Sobrescreva para executar lógica ao abrir o modal
   * (ex: focar primeiro campo, carregar dados).
   *
   * @protected
   * @example
   * ```typescript
   * protected override onModalOpened(): void {
   *   this.loadData();
   *   setTimeout(() => this.focusFirstInput(), 100);
   * }
   * ```
   */
  protected onModalOpened(): void {
    // Implementação opcional nas classes derivadas
  }

  /**
   * Chamado quando o modal é fechado (antes de emitir closeModal).
   *
   * Sobrescreva para executar lógica ao fechar o modal
   * (ex: limpar formulário, resetar estado).
   *
   * @protected
   * @example
   * ```typescript
   * protected override onModalClosed(): void {
   *   this.resetForm();
   *   this.clearErrors();
   * }
   * ```
   */
  protected onModalClosed(): void {
    // Implementação opcional nas classes derivadas
  }

  // ===========================================================================
  // UTILITY METHODS
  // ===========================================================================

  /**
   * Define o estado de processamento do modal.
   * Quando em processamento, o modal não pode ser fechado acidentalmente.
   *
   * @protected
   * @param {boolean} processing - Estado de processamento
   *
   * @example
   * ```typescript
   * async onSave(): Promise<void> {
   *   this.setProcessing(true);
   *   try {
   *     await this.saveData();
   *     this.onClose();
   *   } finally {
   *     this.setProcessing(false);
   *   }
   * }
   * ```
   */
  protected setProcessing(processing: boolean): void {
    this.isProcessing = processing;
  }

  /**
   * Verifica se o modal está em estado de processamento.
   *
   * @protected
   * @returns {boolean} `true` se estiver processando
   */
  protected getProcessing(): boolean {
    return this.isProcessing;
  }
}

// =============================================================================
// INTERFACE PARA CONFIGURAÇÃO DE MODAIS (OPCIONAL)
// =============================================================================

/**
 * Interface para dados passados ao modal.
 * Pode ser estendida por modais específicos.
 *
 * @interface ModalData
 * @template T - Tipo dos dados customizados
 *
 * @example
 * ```typescript
 * interface MyModalData extends ModalData<User> {
 *   mode: 'create' | 'edit';
 * }
 * ```
 */
export interface ModalData<T = any> {
  /** Dados principais do modal */
  data?: T;
  /** Título do modal (opcional) */
  title?: string;
  /** Modo de operação (opcional) */
  mode?: string;
  /** Configurações adicionais */
  config?: Record<string, any>;
}

/**
 * Interface para resultado de ação do modal.
 *
 * @interface ModalResult
 * @template T - Tipo do resultado
 *
 * @example
 * ```typescript
 * const result: ModalResult<User> = {
 *   success: true,
 *   data: updatedUser,
 *   action: 'save'
 * };
 * ```
 */
export interface ModalResult<T = any> {
  /** Indica se a ação foi bem-sucedida */
  success: boolean;
  /** Dados retornados pelo modal */
  data?: T;
  /** Ação executada */
  action?: string;
  /** Mensagem de erro (se houver) */
  error?: string;
}

// =============================================================================
// FIM DO ARQUIVO
// =============================================================================
