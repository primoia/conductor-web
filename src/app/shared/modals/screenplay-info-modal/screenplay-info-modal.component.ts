import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseModalComponent } from '../base/base-modal.component';

/**
 * Keyboard shortcut definition
 */
export interface KeyboardShortcut {
  keys: string[];
  description: string;
}

/**
 * Modal for displaying screenplay keyboard shortcuts
 *
 * @example
 * ```html
 * <app-screenplay-info-modal
 *   [isVisible]="showModal"
 *   (closeModal)="onClose()">
 * </app-screenplay-info-modal>
 * ```
 */
@Component({
  selector: 'app-screenplay-info-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './screenplay-info-modal.component.html',
  styleUrls: ['./screenplay-info-modal.component.scss']
})
export class ScreenplayInfoModalComponent extends BaseModalComponent {
  /**
   * List of keyboard shortcuts to display
   */
  shortcuts: KeyboardShortcut[] = [
    {
      keys: ['Ctrl', 'S'],
      description: 'Salvar roteiro'
    },
    {
      keys: ['Ctrl', 'N'],
      description: 'Novo roteiro'
    },
    {
      keys: ['Ctrl', 'O'],
      description: 'Abrir roteiro do banco'
    },
    {
      keys: ['Ctrl', 'Shift', 'A'],
      description: 'Adicionar agente'
    },
    {
      keys: ['Ctrl', 'E'],
      description: 'Exportar para disco'
    },
    {
      keys: ['Ctrl', 'I'],
      description: 'Importar do disco'
    }
  ];
}
