import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';
import { marked } from 'marked';
import { BaseModalComponent } from '../../shared/modals/base/base-modal.component';
import { ModalHeaderComponent } from '../../shared/modals/base/modal-header.component';
import { ModalFooterComponent, ModalButton } from '../../shared/modals/base/modal-footer.component';

export interface ReportModalData {
  title: string;
  timestamp?: number;
  severity?: 'info' | 'warning' | 'error';
  taskId?: string;  // ← NOVO: ID da task para buscar detalhes completos
  details?: Record<string, unknown> | null;
  summary?: string | null; // markdown summary/result to render
}

export interface TaskDetails {
  task_id: string;
  agent_id: string;
  agent_name: string;
  agent_emoji: string;
  prompt: string | null;
  result: string | null;
  status: string;
  severity: string;
  created_at: string;
  completed_at: string;
  duration: number;
  error: string | null;
  is_councilor: boolean;
}

/**
 * Modal para exibição de relatórios de tarefas
 *
 * ✅ Normalizado seguindo especificação de modais padrão v1.0
 * ✅ Estende BaseModalComponent para comportamentos consistentes
 * ✅ Usa componentes base reutilizáveis (ModalHeader, ModalFooter)
 * ✅ Implementa acessibilidade (ARIA, keyboard navigation)
 *
 * Exibe detalhes completos de tarefas executadas por agentes, incluindo:
 * - Resultado da tarefa (com markdown rendering)
 * - Prompt original enviado ao agente
 * - Dados completos em formato JSON
 * - Metadados (timestamp, severity, status)
 *
 * @extends BaseModalComponent
 */
@Component({
  selector: 'app-report-modal',
  standalone: true,
  imports: [CommonModule, ModalHeaderComponent, ModalFooterComponent],
  templateUrl: './report-modal.component.html',
  styleUrl: './report-modal.component.scss'
})
export class ReportModalComponent extends BaseModalComponent implements OnChanges {
  @Input() override isVisible = false;
  @Input() data: ReportModalData | null = null;

  @Output() close = new EventEmitter<void>();
  @Output() refresh = new EventEmitter<void>();
  @Output() override closeModal = new EventEmitter<void>();

  // ===========================================================================
  // STATE MANAGEMENT
  // ===========================================================================

  activeTab: 'result' | 'prompt' | 'json' = 'result';
  fullTaskData: TaskDetails | null = null;
  isLoadingDetails = false;
  loadError: string | null = null;
  footerButtons: ModalButton[] = [];

  constructor(
    private sanitizer: DomSanitizer,
    private http: HttpClient
  ) {
    super(); // Call parent constructor
    this.setupFooterButtons();
  }

  // ===========================================================================
  // LIFECYCLE HOOKS
  // ===========================================================================

  /**
   * Configura os botões do footer do modal.
   * @private
   */
  private setupFooterButtons(): void {
    this.footerButtons = [
      {
        label: 'Fechar',
        type: 'secondary',
        action: 'close'
      },
      {
        label: 'Atualizar agora',
        type: 'primary',
        action: 'refresh'
      }
    ];
  }

  ngOnChanges(changes: SimpleChanges): void {
    // When modal becomes visible, load full task details
    if (changes['isVisible'] && this.isVisible && this.data?.taskId) {
      this.loadFullDetails();
    }

    // Reset state when modal is closed
    if (changes['isVisible'] && !this.isVisible) {
      this.fullTaskData = null;
      this.loadError = null;
      this.activeTab = 'result';
    }
  }

  // ===========================================================================
  // DATA LOADING
  // ===========================================================================

  async loadFullDetails(): Promise<void> {
    if (!this.data?.taskId) {
      console.warn('No taskId provided, skipping full details load');
      return;
    }

    this.isLoadingDetails = true;
    this.loadError = null;

    try {
      console.log(`Loading full task details for taskId: ${this.data.taskId}`);

      const response: any = await this.http
        .get(`/api/tasks/${this.data.taskId}/details`)
        .toPromise();

      if (response?.success && response.task) {
        this.fullTaskData = response.task;
        console.log('Successfully loaded task details:', this.fullTaskData);
      } else {
        this.loadError = 'Resposta inválida do servidor';
      }
    } catch (error: any) {
      console.warn('Could not load full task details:', error);

      // For 404 errors, just show fallback data (not a critical error)
      if (error?.status === 404) {
        console.info('Task not in database, showing summary data only');
        this.loadError = null;  // Don't show error, just use summary data
      } else {
        // For other errors, show error message
        this.loadError = error?.error?.detail || 'Erro ao carregar detalhes da tarefa';
      }
    } finally {
      this.isLoadingDetails = false;
    }
  }

  // ===========================================================================
  // EVENT HANDLERS
  // ===========================================================================

  /**
   * Manipula ações dos botões do footer.
   * @param action - Ação disparada pelo botão
   */
  handleFooterAction(action: string): void {
    switch (action) {
      case 'close':
        this.requestClose();
        break;
      case 'refresh':
        this.requestRefresh();
        break;
    }
  }

  requestClose(): void { this.close.emit(); }
  requestRefresh(): void { this.refresh.emit(); }

  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================

  severityIcon(sev: ReportModalData['severity']): string {
    switch (sev) {
      case 'error': return '⛔';
      case 'warning': return '⚠️';
      default: return 'ℹ️';
    }
  }

  formatRelative(ts: number): string {
    const diff = Date.now() - ts; const s = Math.floor(diff/1000);
    if (s < 60) return `${s}s`; const m = Math.floor(s/60);
    if (m < 60) return `${m}m`; const h = Math.floor(m/60);
    if (h < 24) return `${h}h`; const d = Math.floor(h/24);
    return `${d}d`;
  }

  hasPromptData(): boolean {
    if (this.fullTaskData?.prompt) {
      return true;
    }
    const details = this.data?.details as any;
    return !!(details?.prompt || details?.input_text);
  }

  getPromptText(): string {
    // Try full task data first
    if (this.fullTaskData?.prompt) {
      return this.fullTaskData.prompt;
    }

    // Fallback to event data
    const details = this.data?.details as any;
    const maybePrompt = details?.prompt || details?.input_text;
    if (typeof maybePrompt === 'string') return maybePrompt;

    return 'Prompt não disponível';
  }

  getResultText(): string {
    // Try full task data first (complete, not truncated)
    if (this.fullTaskData?.result) {
      return this.fullTaskData.result;
    }

    // Try error if task failed
    if (this.fullTaskData?.error) {
      return `**Erro:**\n\n${this.fullTaskData.error}`;
    }

    // Fallback to summary (truncated)
    return this.getSummaryText();
  }

  getSummaryText(): string {
    if (!this.data) return '';
    if (this.data.summary && typeof this.data.summary === 'string') return this.data.summary;
    const maybeResult = (this.data.details as any)?.result;
    if (typeof maybeResult === 'string') return maybeResult;
    return 'Sem resultado disponível';
  }

  formatMarkdown(content: string): SafeHtml {
    if (!content) return '';
    const rawHtml = marked(content) as string;
    return this.sanitizer.bypassSecurityTrustHtml(rawHtml);
  }

  // ===========================================================================
  // OVERRIDES DO BASEMODALCOMPONENT
  // ===========================================================================

  /**
   * Fecha o modal
   * @override
   */
  override onClose(): void {
    this.closeModal.emit();
    super.onClose();
  }

  /**
   * Override do onBackdropClick para permitir fechar o modal ao clicar no backdrop
   * @override
   */
  public override onBackdropClick(event: Event): void {
    if (event.target === event.currentTarget && !this.preventBackdropClose()) {
      this.requestClose();
    }
  }
}
