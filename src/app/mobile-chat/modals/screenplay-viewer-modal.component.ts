import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ScreenplayStorage, Screenplay } from '../../services/screenplay-storage';
import { marked } from 'marked';

@Component({
  selector: 'app-screenplay-viewer-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-backdrop" *ngIf="isVisible" (click)="onClose()">
      <div class="modal-container" (click)="$event.stopPropagation()" (touchstart)="$event.stopPropagation()" (touchend)="$event.stopPropagation()">
        <!-- Header -->
        <div class="modal-header">
          <h3 class="modal-title">{{ screenplay?.name || 'Carregando...' }}</h3>
          <button class="close-btn" (click)="onClose()">✕</button>
        </div>

        <!-- Body -->
        <div class="modal-body">
          <div class="loading-state" *ngIf="isLoading">
            <div class="spinner"></div>
            <span>Carregando roteiro...</span>
          </div>

          <div class="error-state" *ngIf="error && !isLoading">
            <span class="error-icon">⚠️</span>
            <span>{{ error }}</span>
          </div>

          <div
            class="markdown-content"
            *ngIf="!isLoading && !error && renderedContent"
            [innerHTML]="renderedContent">
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      z-index: 2000;
      display: flex;
      align-items: stretch;
      justify-content: center;
      padding: 0;
    }

    .modal-container {
      width: 100%;
      height: 100%;
      background: #fff;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    @media (min-width: 768px) {
      .modal-backdrop {
        align-items: center;
        padding: 24px;
      }
      .modal-container {
        width: 90%;
        max-width: 800px;
        height: 85vh;
        border-radius: 16px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      }
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid #e2e8f0;
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      flex-shrink: 0;
    }

    .modal-title {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .close-btn {
      background: rgba(255, 255, 255, 0.2);
      border: none;
      color: white;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      font-size: 18px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background 0.2s;
    }

    .close-btn:hover {
      background: rgba(255, 255, 255, 0.3);
    }

    .modal-body {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      -webkit-overflow-scrolling: touch;
    }

    .loading-state, .error-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 40px;
      color: #64748b;
    }

    .error-icon {
      font-size: 32px;
    }

    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid #e2e8f0;
      border-top-color: #667eea;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .markdown-content {
      line-height: 1.7;
      color: #1e293b;
      font-size: 15px;
    }

    .markdown-content h1 { font-size: 24px; margin: 24px 0 12px; color: #0f172a; }
    .markdown-content h2 { font-size: 20px; margin: 20px 0 10px; color: #1e293b; }
    .markdown-content h3 { font-size: 17px; margin: 16px 0 8px; color: #334155; }
    .markdown-content p { margin: 8px 0; }
    .markdown-content ul, .markdown-content ol { padding-left: 24px; }
    .markdown-content li { margin: 4px 0; }
    .markdown-content code {
      background: #f1f5f9;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 13px;
    }
    .markdown-content pre {
      background: #1e293b;
      color: #e2e8f0;
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
      font-size: 13px;
    }
    .markdown-content pre code {
      background: none;
      padding: 0;
      color: inherit;
    }
    .markdown-content blockquote {
      border-left: 3px solid #667eea;
      margin: 12px 0;
      padding: 8px 16px;
      background: #f8fafc;
      color: #475569;
    }
  `]
})
export class ScreenplayViewerModalComponent implements OnChanges {
  @Input() isVisible = false;
  @Input() screenplayId: string | null = null;
  @Output() closeModal = new EventEmitter<void>();

  screenplay: Screenplay | null = null;
  renderedContent: SafeHtml | null = null;
  isLoading = false;
  error: string | null = null;

  constructor(
    private screenplayStorage: ScreenplayStorage,
    private sanitizer: DomSanitizer
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isVisible'] && this.isVisible && this.screenplayId) {
      this.loadScreenplay(this.screenplayId);
    }
  }

  private loadScreenplay(id: string): void {
    this.isLoading = true;
    this.error = null;

    this.screenplayStorage.getScreenplay(id).subscribe({
      next: (screenplay) => {
        this.screenplay = screenplay;
        const html = marked.parse(screenplay.content || '') as string;
        this.renderedContent = this.sanitizer.bypassSecurityTrustHtml(html);
        this.isLoading = false;
      },
      error: (err) => {
        this.error = 'Erro ao carregar roteiro.';
        this.isLoading = false;
        console.error('❌ [ScreenplayViewer] Error loading screenplay:', err);
      }
    });
  }

  onClose(): void {
    this.closeModal.emit();
  }
}
