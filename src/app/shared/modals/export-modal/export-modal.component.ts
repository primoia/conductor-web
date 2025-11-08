import { Component, Input, Output, EventEmitter, OnInit, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BaseModalComponent } from '../base/base-modal.component';

/**
 * Modal for exporting screenplay to disk
 *
 * @example
 * ```html
 * <app-export-modal
 *   [isVisible]="showModal"
 *   [filename]="defaultFilename"
 *   (closeModal)="onClose()"
 *   (export)="onExport($event)">
 * </app-export-modal>
 * ```
 */
@Component({
  selector: 'app-export-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './export-modal.component.html',
  styleUrls: ['./export-modal.component.scss']
})
export class ExportModalComponent extends BaseModalComponent implements OnInit, OnChanges {
  /**
   * Default filename for export
   */
  @Input() filename = '';

  /**
   * Event emitted when user confirms export
   * Emits the filename
   */
  @Output() export = new EventEmitter<string>();

  /**
   * Temporary filename being edited
   */
  tempFilename = '';

  /**
   * Validation error message
   */
  errorMessage: string | null = null;

  /**
   * Initialize component
   */
  ngOnInit(): void {
    // Component initialization
  }

  /**
   * Watch for visibility changes to reset form
   */
  ngOnChanges(): void {
    if (this.isVisible) {
      this.tempFilename = this.filename || 'roteiro-vivo.md';
      this.errorMessage = null;
    }
  }

  /**
   * Check if the form is valid
   */
  get isValid(): boolean {
    const trimmed = this.tempFilename.trim();
    return trimmed.length > 0 && trimmed.endsWith('.md');
  }

  /**
   * Confirm export
   */
  onExport(): void {
    const trimmed = this.tempFilename.trim();

    if (!trimmed) {
      this.errorMessage = 'Por favor, informe um nome de arquivo';
      return;
    }

    if (!trimmed.endsWith('.md')) {
      this.errorMessage = 'O arquivo deve ter extensão .md';
      return;
    }

    // Basic filename validation (no path separators)
    if (trimmed.includes('/') || trimmed.includes('\\')) {
      this.errorMessage = 'O nome do arquivo não pode conter barras (/ ou \\)';
      return;
    }

    this.errorMessage = null;
    this.export.emit(trimmed);
    this.onClose();
  }

  /**
   * Handle Enter key in input
   */
  onEnterKey(): void {
    if (this.isValid) {
      this.onExport();
    }
  }
}
