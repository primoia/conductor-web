import { Component, EventEmitter, HostListener, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CouncilorReport } from '../../models/councilor.types';

/**
 * Modal para exibir relatório detalhado de um conselheiro
 *
 * Mostra:
 * - Estatísticas gerais (total execuções, taxa sucesso)
 * - Lista de execuções recentes
 * - Próxima execução agendada
 */
@Component({
  selector: 'app-councilor-report-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './councilor-report-modal.component.html',
  styleUrls: ['./councilor-report-modal.component.css']
})
export class CouncilorReportModalComponent implements OnInit {
  @Input() report: CouncilorReport | null = null;
  @Input() councilorName: string = '';
  @Output() close = new EventEmitter<void>();

  ngOnInit(): void {
    console.log('📋 Report modal opened:', this.report);
  }

  /**
   * Fecha o modal
   */
  onClose(): void {
    this.close.emit();
  }

  @HostListener('document:keydown.escape')
  handleEsc(): void {
    this.onClose();
  }

  /**
   * Formata data para exibição amigável
   */
  formatDate(date?: Date | string): string {
    if (!date) return 'N/A';

    const d = new Date(date);
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Formata duração em millisegundos para formato legível
   */
  formatDuration(ms?: number): string {
    if (!ms) return 'N/A';

    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);

    if (minutes > 0) {
      const secs = seconds % 60;
      return `${minutes}m ${secs}s`;
    }

    return `${seconds}s`;
  }

  /**
   * Obtém classe CSS baseada na severidade
   */
  getSeverityClass(severity: string): string {
    switch (severity) {
      case 'error': return 'severity-error';
      case 'warning': return 'severity-warning';
      case 'success': return 'severity-success';
      default: return 'severity-info';
    }
  }

  /**
   * Obtém emoji baseado na severidade
   */
  getSeverityEmoji(severity: string): string {
    switch (severity) {
      case 'error': return '🔥';
      case 'warning': return '⚠️';
      case 'success': return '✅';
      default: return 'ℹ️';
    }
  }

  /**
   * Obtém label traduzido da severidade
   */
  getSeverityLabel(severity: string): string {
    switch (severity) {
      case 'error': return 'Erro';
      case 'warning': return 'Alerta';
      case 'success': return 'Sucesso';
      default: return 'Info';
    }
  }

  /**
   * Obtém classe CSS baseada no status
   */
  getStatusClass(status: string): string {
    switch (status) {
      case 'completed': return 'status-completed';
      case 'running': return 'status-running';
      case 'error': return 'status-error';
      default: return 'status-pending';
    }
  }

  /**
   * Obtém label traduzido do status
   */
  getStatusLabel(status: string): string {
    switch (status) {
      case 'completed': return 'Concluído';
      case 'running': return 'Executando';
      case 'error': return 'Erro';
      default: return 'Pendente';
    }
  }
}
