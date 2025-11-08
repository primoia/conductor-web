// =============================================================================
// MODAL HEADER COMPONENT - Conductor Web
// =============================================================================
// Versão: 1.0
// Data: 08/11/2025
// Descrição: Componente reutilizável para header de modais
// =============================================================================

import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Componente de header padronizado para modais.
 *
 * Fornece um header consistente com título e botão de fechar para todos
 * os modais do sistema.
 *
 * @component
 * @standalone
 *
 * @example
 * ```html
 * <app-modal-header
 *   [title]="'Editar Usuário'"
 *   [showCloseButton]="true"
 *   (close)="onClose()">
 * </app-modal-header>
 * ```
 *
 * @example
 * ```html
 * <!-- Com conteúdo customizado -->
 * <app-modal-header
 *   [title]="'Configurações'"
 *   [showCloseButton]="true"
 *   (close)="onClose()">
 *   <div class="header-actions">
 *     <button>Ação 1</button>
 *     <button>Ação 2</button>
 *   </div>
 * </app-modal-header>
 * ```
 */
@Component({
  selector: 'app-modal-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-header" [attr.aria-labelledby]="ariaLabelledBy">
      <div class="title-section">
        <h3 [id]="titleId" class="modal-title">
          {{ title }}
        </h3>
        <p *ngIf="subtitle" class="modal-subtitle">
          {{ subtitle }}
        </p>
      </div>

      <!-- Slot para conteúdo adicional (ex: badges, ícones) -->
      <div class="header-content" *ngIf="hasContent">
        <ng-content></ng-content>
      </div>

      <!-- Botão de fechar -->
      <button
        *ngIf="showCloseButton"
        type="button"
        class="close-btn"
        [attr.aria-label]="closeButtonAriaLabel"
        [disabled]="disableClose || disabled"
        (click)="onCloseClick()">
        {{ closeButtonText }}
      </button>
    </div>
  `,
  styleUrls: ['./modal-header.component.scss']
})
export class ModalHeaderComponent {
  // ===========================================================================
  // INPUTS
  // ===========================================================================

  /**
   * Título do modal exibido no header.
   *
   * @type {string}
   * @default ''
   */
  @Input() title: string = '';

  /**
   * ID único para o elemento de título (usado para aria-labelledby).
   *
   * @type {string}
   * @default 'modal-title'
   */
  @Input() titleId: string = 'modal-title';

  /**
   * Determina se o botão de fechar deve ser exibido.
   *
   * @type {boolean}
   * @default true
   */
  @Input() showCloseButton: boolean = true;

  /**
   * Texto do botão de fechar (padrão: ×).
   *
   * @type {string}
   * @default '×'
   */
  @Input() closeButtonText: string = '×';

  /**
   * Label ARIA para o botão de fechar (acessibilidade).
   *
   * @type {string}
   * @default 'Fechar modal'
   */
  @Input() closeButtonAriaLabel: string = 'Fechar modal';

  /**
   * Desabilita o botão de fechar (útil durante processamento).
   *
   * @type {boolean}
   * @default false
   */
  @Input() disableClose: boolean = false;

  /**
   * Indica se há conteúdo customizado no slot (ng-content).
   * Usado internamente para exibir/ocultar wrapper.
   *
   * @type {boolean}
   * @default false
   */
  @Input() hasContent: boolean = false;

  /**
   * ARIA labelledby attribute for accessibility.
   *
   * @type {string}
   * @optional
   */
  @Input() ariaLabelledBy?: string;

  /**
   * Subtitle text displayed below the main title.
   *
   * @type {string}
   * @optional
   */
  @Input() subtitle?: string;

  /**
   * Disables the entire header component.
   *
   * @type {boolean}
   * @default false
   */
  @Input() disabled: boolean = false;

  // ===========================================================================
  // OUTPUTS
  // ===========================================================================

  /**
   * Evento emitido quando o botão de fechar é clicado.
   *
   * @type {EventEmitter<void>}
   *
   * @example
   * ```typescript
   * onModalClose(): void {
   *   this.isVisible = false;
   * }
   * ```
   */
  @Output() close = new EventEmitter<void>();

  // ===========================================================================
  // MÉTODOS PÚBLICOS
  // ===========================================================================

  /**
   * Manipulador de clique no botão de fechar.
   * Emite o evento `close` para o componente pai.
   *
   * @public
   */
  onCloseClick(): void {
    if (!this.disableClose) {
      this.close.emit();
    }
  }
}

// =============================================================================
// FIM DO ARQUIVO
// =============================================================================
