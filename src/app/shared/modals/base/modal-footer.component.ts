// =============================================================================
// MODAL FOOTER COMPONENT - Conductor Web
// =============================================================================
// Versão: 1.0
// Data: 08/11/2025
// Descrição: Componente reutilizável para footer de modais
// =============================================================================

import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Tipo de botão no footer do modal.
 */
export type ButtonType = 'primary' | 'secondary' | 'danger' | 'success' | 'warning';

/**
 * Interface para configuração de botões do footer.
 *
 * @interface ModalButton
 *
 * @example
 * ```typescript
 * const buttons: ModalButton[] = [
 *   {
 *     label: 'Cancelar',
 *     type: 'secondary',
 *     action: 'cancel'
 *   },
 *   {
 *     label: 'Salvar',
 *     type: 'primary',
 *     action: 'save',
 *     disabled: !this.isValid,
 *     loading: this.isSaving
 *   }
 * ];
 * ```
 */
export interface ModalButton {
  /** Texto exibido no botão */
  label: string;
  /** Tipo/estilo do botão */
  type: ButtonType;
  /** Identificador da ação (emitido no evento buttonClick) */
  action: string;
  /** Se o botão está desabilitado */
  disabled?: boolean;
  /** Se o botão está em estado de loading */
  loading?: boolean;
  /** Label ARIA para acessibilidade */
  ariaLabel?: string;
  /** Ícone a ser exibido (classe CSS ou HTML) */
  icon?: string;
  /** Se o botão deve ocupar toda largura (mobile) */
  fullWidth?: boolean;
}

/**
 * Componente de footer padronizado para modais.
 *
 * Fornece um footer consistente com botões de ação configuráveis
 * seguindo a hierarquia padrão (danger → secondary → primary).
 *
 * @component
 * @standalone
 *
 * @example
 * ```html
 * <!-- Uso simples com botões padrão -->
 * <app-modal-footer
 *   [buttons]="footerButtons"
 *   (buttonClick)="onButtonClick($event)">
 * </app-modal-footer>
 * ```
 *
 * @example
 * ```typescript
 * // No componente TypeScript
 * footerButtons: ModalButton[] = [
 *   { label: 'Cancelar', type: 'secondary', action: 'cancel' },
 *   { label: 'Deletar', type: 'danger', action: 'delete' },
 *   { label: 'Salvar', type: 'primary', action: 'save', loading: this.isSaving }
 * ];
 *
 * onButtonClick(action: string): void {
 *   switch (action) {
 *     case 'cancel': this.close(); break;
 *     case 'delete': this.confirmDelete(); break;
 *     case 'save': this.save(); break;
 *   }
 * }
 * ```
 */
@Component({
  selector: 'app-modal-footer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-footer" [class.align-left]="alignLeft" [class.compact]="compact">
      <!-- Slot para conteúdo customizado à esquerda -->
      <div class="footer-left" *ngIf="hasLeftContent">
        <ng-content select="[left]"></ng-content>
      </div>

      <!-- Botões de ação -->
      <div class="footer-actions">
        <button
          *ngFor="let button of buttons"
          type="button"
          [class]="getButtonClass(button)"
          [disabled]="button.disabled || button.loading"
          [attr.aria-label]="button.ariaLabel || button.label"
          (click)="onButtonClick(button)">

          <!-- Spinner de loading -->
          <span *ngIf="button.loading" class="spinner"></span>

          <!-- Ícone (se houver) -->
          <span *ngIf="button.icon && !button.loading" [innerHTML]="button.icon"></span>

          <!-- Label do botão -->
          <span class="button-label">{{ button.loading ? loadingText : button.label }}</span>
        </button>
      </div>

      <!-- Slot para conteúdo customizado à direita -->
      <div class="footer-right" *ngIf="hasRightContent">
        <ng-content select="[right]"></ng-content>
      </div>
    </div>
  `,
  styleUrls: ['./modal-footer.component.scss']
})
export class ModalFooterComponent {
  // ===========================================================================
  // INPUTS
  // ===========================================================================

  /**
   * Array de configurações de botões a serem exibidos.
   *
   * @type {ModalButton[]}
   * @default []
   */
  @Input() buttons: ModalButton[] = [];

  /**
   * Texto exibido quando um botão está em loading.
   *
   * @type {string}
   * @default 'Processando...'
   */
  @Input() loadingText: string = 'Processando...';

  /**
   * Alinha os botões à esquerda em vez de à direita.
   *
   * @type {boolean}
   * @default false
   */
  @Input() alignLeft: boolean = false;

  /**
   * Usa padding reduzido (footer compacto).
   *
   * @type {boolean}
   * @default false
   */
  @Input() compact: boolean = false;

  /**
   * Indica se há conteúdo customizado no slot esquerdo.
   *
   * @type {boolean}
   * @default false
   */
  @Input() hasLeftContent: boolean = false;

  /**
   * Indica se há conteúdo customizado no slot direito.
   *
   * @type {boolean}
   * @default false
   */
  @Input() hasRightContent: boolean = false;

  // ===========================================================================
  // OUTPUTS
  // ===========================================================================

  /**
   * Evento emitido quando um botão é clicado.
   * Retorna o `action` do botão clicado.
   *
   * @type {EventEmitter<string>}
   *
   * @example
   * ```typescript
   * onButtonClick(action: string): void {
   *   if (action === 'save') {
   *     this.saveData();
   *   } else if (action === 'cancel') {
   *     this.close();
   *   }
   * }
   * ```
   */
  @Output() buttonClick = new EventEmitter<string>();

  // ===========================================================================
  // MÉTODOS PÚBLICOS
  // ===========================================================================

  /**
   * Retorna a classe CSS apropriada para o botão baseado no tipo.
   *
   * @param {ModalButton} button - Configuração do botão
   * @returns {string} - Classes CSS do botão
   * @public
   */
  getButtonClass(button: ModalButton): string {
    const classes = ['btn', `btn-${button.type}`];

    if (button.loading) {
      classes.push('btn-loading');
    }

    if (button.fullWidth) {
      classes.push('btn-full-width');
    }

    return classes.join(' ');
  }

  /**
   * Manipulador de clique no botão.
   * Emite o evento `buttonClick` com o action do botão.
   *
   * @param {ModalButton} button - Botão clicado
   * @public
   */
  onButtonClick(button: ModalButton): void {
    if (!button.disabled && !button.loading) {
      this.buttonClick.emit(button.action);
    }
  }
}

// =============================================================================
// FACTORY FUNCTIONS PARA CRIAÇÃO RÁPIDA DE BOTÕES
// =============================================================================

/**
 * Cria um botão de cancelar padrão.
 *
 * @param {Partial<ModalButton>} overrides - Propriedades a sobrescrever
 * @returns {ModalButton}
 *
 * @example
 * ```typescript
 * const cancelButton = createCancelButton();
 * const customCancel = createCancelButton({ label: 'Voltar' });
 * ```
 */
export function createCancelButton(overrides?: Partial<ModalButton>): ModalButton {
  return {
    label: 'Cancelar',
    type: 'secondary',
    action: 'cancel',
    ...overrides
  };
}

/**
 * Cria um botão de confirmar/salvar padrão.
 *
 * @param {Partial<ModalButton>} overrides - Propriedades a sobrescrever
 * @returns {ModalButton}
 *
 * @example
 * ```typescript
 * const saveButton = createConfirmButton({ loading: this.isSaving });
 * const submitButton = createConfirmButton({ label: 'Enviar', action: 'submit' });
 * ```
 */
export function createConfirmButton(overrides?: Partial<ModalButton>): ModalButton {
  return {
    label: 'Confirmar',
    type: 'primary',
    action: 'confirm',
    ...overrides
  };
}

/**
 * Cria um botão de deletar padrão.
 *
 * @param {Partial<ModalButton>} overrides - Propriedades a sobrescrever
 * @returns {ModalButton}
 *
 * @example
 * ```typescript
 * const deleteButton = createDeleteButton({ disabled: !canDelete });
 * ```
 */
export function createDeleteButton(overrides?: Partial<ModalButton>): ModalButton {
  return {
    label: 'Deletar',
    type: 'danger',
    action: 'delete',
    ...overrides
  };
}

/**
 * Cria um conjunto padrão de botões (Cancelar + Confirmar).
 *
 * @param {object} options - Opções de customização
 * @returns {ModalButton[]}
 *
 * @example
 * ```typescript
 * const buttons = createDefaultButtons({
 *   confirmLabel: 'Salvar',
 *   confirmDisabled: !this.isValid,
 *   confirmLoading: this.isSaving
 * });
 * ```
 */
export function createDefaultButtons(options?: {
  cancelLabel?: string;
  confirmLabel?: string;
  confirmDisabled?: boolean;
  confirmLoading?: boolean;
}): ModalButton[] {
  return [
    createCancelButton({ label: options?.cancelLabel }),
    createConfirmButton({
      label: options?.confirmLabel,
      disabled: options?.confirmDisabled,
      loading: options?.confirmLoading
    })
  ];
}

// =============================================================================
// FIM DO ARQUIVO
// =============================================================================
