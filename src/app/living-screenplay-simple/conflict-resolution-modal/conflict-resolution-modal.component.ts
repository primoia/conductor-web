import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Screenplay } from '../../services/screenplay-storage';

export interface ConflictResolution {
  action: 'overwrite' | 'keep-existing' | 'rename' | 'cancel';
  newName?: string;
}

@Component({
  selector: 'app-conflict-resolution-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './conflict-resolution-modal.component.html',
  styleUrl: './conflict-resolution-modal.component.scss'
})
export class ConflictResolutionModalComponent implements OnInit {
  @Input() isVisible: boolean = false;
  @Input() existingScreenplay: Screenplay | null = null;
  @Input() newFileName: string = '';
  @Input() newContent: string = '';
  @Output() resolve = new EventEmitter<ConflictResolution>();

  showRenameInput: boolean = false;
  newName: string = '';

  ngOnInit(): void {
    if (this.newFileName) {
      this.newName = this.newFileName;
    }
  }

  get existingContentLength(): number {
    return this.existingScreenplay?.content?.length || 0;
  }

  get newContentLength(): number {
    return this.newContent?.length || 0;
  }

  get contentDifference(): string {
    const diff = this.newContentLength - this.existingContentLength;
    if (diff === 0) return 'mesmo tamanho';
    if (diff > 0) return `+${diff} caracteres`;
    return `${diff} caracteres`;
  }

  onOverwrite(): void {
    this.resolve.emit({ action: 'overwrite' });
    this.close();
  }

  onKeepExisting(): void {
    this.resolve.emit({ action: 'keep-existing' });
    this.close();
  }

  onShowRename(): void {
    this.showRenameInput = true;
    // Generate suggested name with counter
    const baseName = this.newName.replace(/\s*\(\d+\)$/, '');
    this.newName = `${baseName} (1)`;
  }

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

  onCancel(): void {
    this.resolve.emit({ action: 'cancel' });
    this.close();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.onCancel();
    }
  }

  private close(): void {
    this.showRenameInput = false;
    this.isVisible = false;
  }
}
