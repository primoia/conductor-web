import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';

export interface ReportModalData {
  title: string;
  timestamp?: number;
  severity?: 'info' | 'warning' | 'error';
  details?: Record<string, unknown> | null;
  summary?: string | null; // markdown summary/result to render
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
            <button class="toggle-json-btn" *ngIf="data?.details" (click)="toggleJson()" [attr.aria-pressed]="showJson">
              {{ showJson ? 'Markdown' : 'JSON' }}
            </button>
            <button class="close-btn" (click)="requestClose()">×</button>
          </div>
        </div>

        <div class="modal-body">
          <div class="meta">
            <span class="sev" [class.warn]="data?.severity==='warning'" [class.err]="data?.severity==='error'">{{ severityIcon(data?.severity) }}</span>
            <span class="time" *ngIf="data?.timestamp">{{ formatRelative(data!.timestamp!) }}</span>
          </div>
          <div *ngIf="!showJson; else jsonView">
            <div class="markdown-content" *ngIf="getSummaryText(); else emptyView" [innerHTML]="formatMarkdown(getSummaryText())"></div>
          </div>
          <ng-template #jsonView>
            <pre class="details" *ngIf="data?.details as d">{{ d | json }}</pre>
          </ng-template>
          <ng-template #emptyView>
            <div class="empty">Sem detalhes adicionais.</div>
          </ng-template>
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
    .modal-content { background: #fff; border-radius: 12px; width: 520px; max-width: 92vw; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
    .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid #e5e7eb; }
    .header-actions { display: inline-flex; gap: 8px; align-items: center; }
    .modal-body { padding: 16px; }
    .modal-footer { padding: 12px 16px; display: flex; justify-content: flex-end; gap: 8px; border-top: 1px solid #e5e7eb; }
    .close-btn { background: transparent; border: none; font-size: 20px; cursor: pointer; }
    .toggle-json-btn { background: #f3f4f6; border: 1px solid #e5e7eb; padding: 6px 10px; border-radius: 6px; font-size: 12px; cursor: pointer; }
    .toggle-json-btn:hover { background: #e5e7eb; }
    .btn { padding: 6px 12px; border-radius: 8px; border: 1px solid #d1d5db; cursor: pointer; }
    .btn-primary { background: #edf2ff; border-color: #c7d2fe; }
    .btn-secondary { background: #f8fafc; }
    .meta { display: flex; align-items: center; gap: 8px; color: #6b7280; font-size: 12px; margin-bottom: 8px; }
    .sev { font-size: 16px; }
    .sev.warn { color: #f59e0b; }
    .sev.err { color: #ef4444; }
    .details { background: #f9fafb; border: 1px solid #e5e7eb; padding: 12px; border-radius: 8px; max-height: 300px; overflow: auto; }
    .empty { color: #9ca3af; font-style: italic; }
    /* Markdown content styling similar to chat/ticker */
    .markdown-content ::ng-deep pre { background-color: #f3f4f6; border-radius: 4px; padding: 12px; overflow-x: auto; font-family: 'Courier New', Courier, monospace; font-size: 12px; }
    .markdown-content ::ng-deep code { background-color: #f3f4f6; padding: 2px 4px; border-radius: 3px; font-family: 'Courier New', Courier, monospace; }
    .markdown-content ::ng-deep p { margin-top: 0; margin-bottom: 8px; }
    .markdown-content ::ng-deep ul, .markdown-content ::ng-deep ol { padding-left: 20px; margin-bottom: 8px; }
    .markdown-content ::ng-deep img { max-width: 100%; height: auto; display: block; }
    .markdown-content { overflow-wrap: anywhere; word-break: break-word; }
  `]
})
export class ReportModalComponent {
  @Input() isVisible = false;
  @Input() data: ReportModalData | null = null;

  @Output() close = new EventEmitter<void>();
  @Output() refresh = new EventEmitter<void>();

  showJson = false;

  constructor(private sanitizer: DomSanitizer) {}

  requestClose(): void { this.close.emit(); }
  requestRefresh(): void { this.refresh.emit(); }

  toggleJson(): void { this.showJson = !this.showJson; }

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

  getSummaryText(): string {
    if (!this.data) return '';
    if (this.data.summary && typeof this.data.summary === 'string') return this.data.summary;
    const maybeResult = (this.data.details as any)?.result;
    if (typeof maybeResult === 'string') return maybeResult;
    return '';
  }

  formatMarkdown(content: string): SafeHtml {
    if (!content) return '';
    const rawHtml = marked(content) as string;
    return this.sanitizer.bypassSecurityTrustHtml(rawHtml);
  }
}
