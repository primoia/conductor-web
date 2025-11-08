import { Component, Input, Output, EventEmitter, OnInit, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BaseModalComponent } from '../base/base-modal.component';

/**
 * Modal for configuring screenplay working directory
 *
 * @example
 * ```html
 * <app-working-dir-modal
 *   [isVisible]="showModal"
 *   [currentDirectory]="currentDir"
 *   (closeModal)="onClose()"
 *   (save)="onSave($event)">
 * </app-working-dir-modal>
 * ```
 */
@Component({
  selector: 'app-working-dir-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './working-dir-modal.component.html',
  styleUrls: ['./working-dir-modal.component.scss']
})
export class WorkingDirModalComponent extends BaseModalComponent implements OnInit, OnChanges {
  /**
   * Current working directory path
   */
  @Input() currentDirectory: string | null = null;

  /**
   * Event emitted when directory is saved
   * Emits the new directory path
   */
  @Output() save = new EventEmitter<string>();

  /**
   * Temporary directory path being edited
   */
  tempDirectory = '';

  /**
   * Validation error message
   */
  errorMessage: string | null = null;

  /**
   * Initialize component
   */
  ngOnInit(): void {
    // Component initialization if needed
  }

  /**
   * Watch for visibility changes to reset form
   */
  ngOnChanges(): void {
    if (this.isVisible) {
      this.tempDirectory = this.currentDirectory || '';
      this.errorMessage = null;
    }
  }

  /**
   * Check if the form is valid
   */
  get isValid(): boolean {
    return this.tempDirectory.trim().length > 0;
  }

  /**
   * Save the new working directory
   */
  onSave(): void {
    if (!this.isValid) {
      this.errorMessage = 'Por favor, informe um diretório válido';
      return;
    }

    const trimmedDir = this.tempDirectory.trim();

    // Basic validation for absolute path
    if (!trimmedDir.startsWith('/')) {
      this.errorMessage = 'O caminho deve ser absoluto (começar com /)';
      return;
    }

    this.errorMessage = null;
    this.save.emit(trimmedDir);
    this.onClose();
  }

  /**
   * Handle Enter key in input
   */
  onEnterKey(): void {
    if (this.isValid) {
      this.onSave();
    }
  }
}
