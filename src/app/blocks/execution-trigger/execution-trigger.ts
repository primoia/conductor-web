import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface ExecutionTriggerData {
  id: string;
  title: string;
  description: string;
  command: string;
  status: 'idle' | 'running' | 'success' | 'failed';
  output?: string;
  error?: string;
  type?: 'test' | 'build' | 'deploy' | 'script' | 'custom';
  createdAt: Date;
  lastExecuted?: Date;
}

@Component({
  selector: 'app-execution-trigger',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './execution-trigger.html',
  styleUrls: ['./execution-trigger.scss']
})
export class ExecutionTrigger {
  @Input() data: ExecutionTriggerData = {
    id: '',
    title: '',
    description: '',
    command: '',
    status: 'idle',
    type: 'custom',
    createdAt: new Date()
  };

  @Input() editable: boolean = true;
  @Output() execute = new EventEmitter<ExecutionTriggerData>();
  @Output() dataChange = new EventEmitter<ExecutionTriggerData>();
  @Output() delete = new EventEmitter<void>();

  isExpanded = false;
  isEditing = false;

  onExecute(): void {
    if (this.canExecute()) {
      this.data.status = 'running';
      this.data.lastExecuted = new Date();
      this.execute.emit(this.data);
    }
  }

  canExecute(): boolean {
    return this.data.status === 'idle' || this.data.status === 'failed';
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

  onCommandChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.data.command = target.value;
  }

  getStatusIcon(): string {
    switch (this.data.status) {
      case 'running':
        return '⏳';
      case 'success':
        return '✅';
      case 'failed':
        return '❌';
      default:
        return '▶️';
    }
  }

  getStatusText(): string {
    switch (this.data.status) {
      case 'running':
        return 'Executando...';
      case 'success':
        return 'Sucesso';
      case 'failed':
        return 'Falhou';
      default:
        return 'Pronto';
    }
  }

  getStatusClass(): string {
    return `status-${this.data.status}`;
  }

  getTypeIcon(): string {
    switch (this.data.type) {
      case 'test':
        return '🧪';
      case 'build':
        return '🔨';
      case 'deploy':
        return '🚀';
      case 'script':
        return '📜';
      default:
        return '⚡';
    }
  }

  getTypeLabel(): string {
    switch (this.data.type) {
      case 'test':
        return 'Teste';
      case 'build':
        return 'Build';
      case 'deploy':
        return 'Deploy';
      case 'script':
        return 'Script';
      default:
        return 'Customizado';
    }
  }

  copyCommand(): void {
    if (this.data.command) {
      navigator.clipboard.writeText(this.data.command).then(() => {
        console.log('Command copied to clipboard');
      }).catch(err => {
        console.error('Failed to copy command: ', err);
      });
    }
  }

  getExecutionDuration(): string {
    if (!this.data.lastExecuted) return '';

    const now = new Date();
    const diff = now.getTime() - this.data.lastExecuted.getTime();
    const seconds = Math.floor(diff / 1000);

    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  }
}