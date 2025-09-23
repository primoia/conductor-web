import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface ProposalData {
  id: string;
  title: string;
  description: string;
  codeContent?: string;
  language?: string;
  status: 'pending' | 'accepted' | 'rejected';
  agent?: string;
  createdAt: Date;
}

@Component({
  selector: 'app-proposal-block',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './proposal-block.html',
  styleUrls: ['./proposal-block.scss']
})
export class ProposalBlock {
  @Input() data: ProposalData = {
    id: '',
    title: '',
    description: '',
    status: 'pending',
    createdAt: new Date()
  };

  @Input() editable: boolean = true;
  @Output() statusChange = new EventEmitter<'accepted' | 'rejected'>();
  @Output() dataChange = new EventEmitter<ProposalData>();
  @Output() delete = new EventEmitter<void>();

  isExpanded = false;
  isEditing = false;

  onAccept(): void {
    this.data.status = 'accepted';
    this.statusChange.emit('accepted');
    this.dataChange.emit(this.data);
  }

  onReject(): void {
    this.data.status = 'rejected';
    this.statusChange.emit('rejected');
    this.dataChange.emit(this.data);
  }

  toggleExpanded(): void {
    this.isExpanded = !this.isExpanded;
  }

  startEditing(): void {
    if (this.editable) {
      this.isEditing = true;
    }
  }

  stopEditing(): void {
    this.isEditing = false;
    this.dataChange.emit(this.data);
  }

  onDelete(): void {
    this.delete.emit();
  }

  onTitleChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.data.title = target.value;
  }

  onDescriptionChange(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    this.data.description = target.value;
  }

  onCodeChange(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    this.data.codeContent = target.value;
  }

  getStatusIcon(): string {
    switch (this.data.status) {
      case 'accepted':
        return '✅';
      case 'rejected':
        return '❌';
      default:
        return '⏳';
    }
  }

  getStatusClass(): string {
    return `status-${this.data.status}`;
  }

  copyCode(): void {
    if (this.data.codeContent) {
      navigator.clipboard.writeText(this.data.codeContent).then(() => {
        console.log('Code copied to clipboard');
      }).catch(err => {
        console.error('Failed to copy code: ', err);
      });
    }
  }
}