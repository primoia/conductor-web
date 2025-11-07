import { Component, EventEmitter, HostListener, Input, Output, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';
import { marked } from 'marked';

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

@Component({
  selector: 'app-report-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-overlay" *ngIf="isVisible" (click)="requestClose()">
      <div class="modal-content report-modal" role="dialog" aria-modal="true" aria-label="Detalhes do evento" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3>{{ data?.title || 'Relatório' }}</h3>
          <div class="header-actions">
            <button class="close-btn" (click)="requestClose()">×</button>
          </div>
        </div>

        <div class="modal-body">
          <div class="meta">
            <span class="sev" [class.warn]="data?.severity==='warning'" [class.err]="data?.severity==='error'">{{ severityIcon(data?.severity) }}</span>
            <span class="time" *ngIf="data?.timestamp">{{ formatRelative(data!.timestamp!) }}</span>
          </div>

          <!-- Loading state -->
          <div class="loading" *ngIf="isLoadingDetails">
            <div class="spinner"></div>
            <span>Carregando detalhes completos...</span>
          </div>

          <!-- Error state -->
          <div class="error-message" *ngIf="loadError">
            <span>⚠️ {{ loadError }}</span>
          </div>

          <!-- Content with tabs -->
          <div *ngIf="!isLoadingDetails && !loadError">
            <!-- Tabs (show even without fullTaskData for fallback to summary) -->
            <div class="tabs">
              <button class="tab-btn" [class.active]="activeTab === 'result'" (click)="activeTab = 'result'">
                ✅ Resultado
              </button>
              <button class="tab-btn" [class.active]="activeTab === 'prompt'" (click)="activeTab = 'prompt'" *ngIf="hasPromptData()">
                📝 Prompt
              </button>
              <button class="tab-btn" [class.active]="activeTab === 'json'" (click)="activeTab = 'json'">
                🔧 JSON
              </button>
            </div>

            <!-- Tab content -->
            <div class="tab-content">
              <!-- Result tab -->
              <div *ngIf="activeTab === 'result'">
                <div class="markdown-content" [innerHTML]="formatMarkdown(getResultText())"></div>
                <div class="info-badge" *ngIf="!fullTaskData">
                  ℹ️ Exibindo resumo (dados completos não disponíveis)
                </div>
              </div>

              <!-- Prompt tab -->
              <div *ngIf="activeTab === 'prompt'">
                <div class="markdown-content" [innerHTML]="formatMarkdown(getPromptText())"></div>
              </div>

              <!-- JSON tab -->
              <div *ngIf="activeTab === 'json'">
                <pre class="details">{{ (fullTaskData || data?.details) | json }}</pre>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" (click)="requestClose()">Fechar</button>
          <button class="btn btn-primary" (click)="requestRefresh()">Atualizar agora</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .modal-content { background: #fff; border-radius: 12px; width: 1200px; max-width: 95vw; min-height: 500px; max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
    .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid #e5e7eb; flex-shrink: 0; }
    .header-actions { display: inline-flex; gap: 8px; align-items: center; }
    .modal-body { padding: 16px; overflow-y: auto; flex: 1; min-height: 0; }
    .modal-footer { padding: 12px 16px; display: flex; justify-content: flex-end; gap: 8px; border-top: 1px solid #e5e7eb; flex-shrink: 0; }
    .close-btn { background: transparent; border: none; font-size: 20px; cursor: pointer; }
    .btn { padding: 6px 12px; border-radius: 8px; border: 1px solid #d1d5db; cursor: pointer; }
    .btn-primary { background: #edf2ff; border-color: #c7d2fe; }
    .btn-secondary { background: #f8fafc; }
    .meta { display: flex; align-items: center; gap: 8px; color: #6b7280; font-size: 12px; margin-bottom: 12px; }
    .sev { font-size: 16px; }
    .sev.warn { color: #f59e0b; }
    .sev.err { color: #ef4444; }
    .details { background: #f9fafb; border: 1px solid #e5e7eb; padding: 12px; border-radius: 8px; max-height: 500px; overflow: auto; font-family: 'Courier New', Courier, monospace; font-size: 12px; }
    .empty { color: #9ca3af; font-style: italic; text-align: center; padding: 40px; }
    .loading { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 40px; color: #6b7280; }
    .spinner { border: 3px solid #f3f4f6; border-top: 3px solid #667eea; border-radius: 50%; width: 24px; height: 24px; animation: spin 1s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .error-message { color: #ef4444; background: #fef2f2; padding: 12px; border-radius: 8px; margin-bottom: 12px; }
    .info-badge { color: #0369a1; background: #e0f2fe; padding: 10px 12px; border-radius: 6px; margin-top: 16px; font-size: 12px; border-left: 3px solid #0284c7; }

    /* Tabs styling */
    .tabs { display: flex; gap: 4px; margin-bottom: 16px; border-bottom: 2px solid #e5e7eb; }
    .tab-btn { background: none; border: none; padding: 10px 16px; cursor: pointer; font-size: 14px; font-weight: 500; color: #6b7280; border-bottom: 2px solid transparent; margin-bottom: -2px; transition: all 0.2s; }
    .tab-btn:hover { color: #374151; background: #f9fafb; }
    .tab-btn.active { color: #667eea; border-bottom-color: #667eea; }

    .tab-content { min-height: 200px; }

    /* Markdown content styling similar to chat/ticker */
    .markdown-content ::ng-deep pre { background-color: #f3f4f6; border-radius: 4px; padding: 12px; overflow-x: auto; font-family: 'Courier New', Courier, monospace; font-size: 12px; }
    .markdown-content ::ng-deep code { background-color: #f3f4f6; padding: 2px 4px; border-radius: 3px; font-family: 'Courier New', Courier, monospace; }
    .markdown-content ::ng-deep p { margin-top: 0; margin-bottom: 8px; }
    .markdown-content ::ng-deep ul, .markdown-content ::ng-deep ol { padding-left: 20px; margin-bottom: 8px; }
    .markdown-content ::ng-deep img { max-width: 100%; height: auto; display: block; }
    .markdown-content { overflow-wrap: anywhere; word-break: break-word; }
  `]
})
export class ReportModalComponent implements OnChanges {
  @Input() isVisible = false;
  @Input() data: ReportModalData | null = null;

  @Output() close = new EventEmitter<void>();
  @Output() refresh = new EventEmitter<void>();

  // State management
  activeTab: 'result' | 'prompt' | 'json' = 'result';
  fullTaskData: TaskDetails | null = null;
  isLoadingDetails = false;
  loadError: string | null = null;

  constructor(
    private sanitizer: DomSanitizer,
    private http: HttpClient
  ) {}

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

  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(event: Event): void {
    if (this.isVisible) {
      this.requestClose();
    }
  }

  requestClose(): void { this.close.emit(); }
  requestRefresh(): void { this.refresh.emit(); }

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
}
