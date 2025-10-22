import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-save-status',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './save-status.component.html',
  styleUrl: './save-status.component.scss'
})
export class SaveStatusComponent {
  @Input() isDirty: boolean = false;
  @Input() isSaving: boolean = false;
  @Input() lastSaved: Date | null = null;
  @Input() error: string | null = null;

  get statusClass(): string {
    if (this.error) return 'error';
    if (this.isSaving) return 'saving';
    if (this.isDirty) return 'dirty';
    return 'saved';
  }

  get statusIcon(): string {
    if (this.error) return 'fas fa-exclamation-circle';
    if (this.isSaving) return 'fas fa-spinner fa-spin';
    if (this.isDirty) return 'fas fa-circle';
    return 'fas fa-check-circle';
  }

  get statusText(): string {
    if (this.error) return 'Erro ao salvar';
    if (this.isSaving) return 'Salvando...';
    if (this.isDirty) return 'Alterações não salvas';
    return 'Salvo';
  }

  get formattedLastSaved(): string {
    if (!this.lastSaved) return '';

    const now = new Date();
    const diff = now.getTime() - this.lastSaved.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (seconds < 60) return 'agora mesmo';
    if (minutes < 60) return `há ${minutes} min`;
    if (hours < 24) return `há ${hours}h`;

    return this.lastSaved.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}
