import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface PreviewData {
  originalText: string;
  proposedText: string;
  agentName: string;
  agentEmoji: string;
}

export interface PreviewAction {
  action: 'accept' | 'reject';
  proposedText?: string;
}

@Component({
  selector: 'app-agent-preview-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-backdrop" *ngIf="isVisible" (click)="onBackdropClick()">
      <div class="modal-content" (click)="onContentClick($event)">
        <div class="modal-header">
          <h3>{{ previewData?.agentEmoji }} {{ previewData?.agentName }} - Preview</h3>
          <button class="close-btn" (click)="onReject()">×</button>
        </div>

        <div class="modal-body">
          <!-- Loading state -->
          <div *ngIf="isLoading" class="loading-state">
            <div class="spinner"></div>
            <p>Processando com {{ previewData?.agentName }}...</p>
          </div>

          <!-- Error state -->
          <div *ngIf="error && !isLoading" class="error-state">
            <div class="error-icon">⚠️</div>
            <p>{{ error }}</p>
            <button class="retry-btn" (click)="onReject()">Fechar</button>
          </div>

          <!-- Diff view -->
          <div *ngIf="!isLoading && !error && previewData" class="diff-container">
            <div class="diff-section">
              <div class="section-header original-header">
                <span class="header-icon">📝</span>
                <span class="header-title">Texto Original</span>
              </div>
              <div class="text-content original-text">{{ previewData.originalText }}</div>
            </div>

            <div class="diff-arrow">→</div>

            <div class="diff-section">
              <div class="section-header proposed-header">
                <span class="header-icon">✨</span>
                <span class="header-title">Texto Proposto</span>
              </div>
              <div class="text-content proposed-text">{{ previewData.proposedText }}</div>
            </div>
          </div>

          <!-- Character count -->
          <div *ngIf="!isLoading && !error && previewData" class="stats">
            <div class="stat-item">
              <span class="stat-label">Original:</span>
              <span class="stat-value">{{ previewData.originalText.length }} caracteres</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Proposto:</span>
              <span class="stat-value">{{ previewData.proposedText.length }} caracteres</span>
            </div>
            <div class="stat-item" [class.stat-positive]="getDiff() > 0" [class.stat-negative]="getDiff() < 0">
              <span class="stat-label">Diferença:</span>
              <span class="stat-value">{{ getDiff() > 0 ? '+' : '' }}{{ getDiff() }} caracteres</span>
            </div>
          </div>
        </div>

        <div class="modal-footer" *ngIf="!isLoading && !error">
          <button class="btn btn-reject" (click)="onReject()">
            ❌ Rejeitar
          </button>
          <button class="btn btn-accept" (click)="onAccept()">
            ✅ Aceitar
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1200;
      animation: fadeIn 0.2s ease;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .modal-content {
      background: white;
      border-radius: 16px;
      max-width: 900px;
      width: 95%;
      max-height: 85vh;
      overflow: hidden;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      display: flex;
      flex-direction: column;
      animation: slideIn 0.3s ease;
    }

    @keyframes slideIn {
      from {
        transform: translateY(-30px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 24px 28px;
      border-bottom: 2px solid #eee;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border-radius: 16px 16px 0 0;
    }

    .modal-header h3 {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
    }

    .close-btn {
      background: rgba(255, 255, 255, 0.2);
      border: none;
      font-size: 28px;
      cursor: pointer;
      color: white;
      padding: 0;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: all 0.2s;
    }

    .close-btn:hover {
      background: rgba(255, 255, 255, 0.3);
      transform: scale(1.1);
    }

    .modal-body {
      padding: 28px;
      overflow-y: auto;
      flex: 1;
      background: #f8f9fa;
    }

    .loading-state,
    .error-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
      text-align: center;
      color: #666;
    }

    .spinner {
      border: 4px solid #f3f3f3;
      border-top: 4px solid #667eea;
      border-radius: 50%;
      width: 50px;
      height: 50px;
      animation: spin 1s linear infinite;
      margin-bottom: 20px;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .error-icon {
      font-size: 56px;
      margin-bottom: 20px;
    }

    .retry-btn {
      margin-top: 20px;
      padding: 10px 24px;
      background: #667eea;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 15px;
      font-weight: 500;
      transition: all 0.2s;
    }

    .retry-btn:hover {
      background: #5568d3;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }

    .diff-container {
      display: grid;
      grid-template-columns: 1fr 60px 1fr;
      gap: 20px;
      margin-bottom: 24px;
    }

    .diff-section {
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .section-header {
      padding: 16px 20px;
      font-weight: 600;
      font-size: 15px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .original-header {
      background: #fff3cd;
      color: #856404;
      border-bottom: 2px solid #ffc107;
    }

    .proposed-header {
      background: #d4edda;
      color: #155724;
      border-bottom: 2px solid #28a745;
    }

    .header-icon {
      font-size: 18px;
    }

    .text-content {
      padding: 20px;
      font-size: 14px;
      line-height: 1.7;
      min-height: 200px;
      max-height: 400px;
      overflow-y: auto;
      white-space: pre-wrap;
      word-wrap: break-word;
      font-family: 'Monaco', 'Menlo', monospace;
    }

    .original-text {
      color: #333;
      background: #fffbf0;
    }

    .proposed-text {
      color: #155724;
      background: #f0f9f4;
      font-weight: 500;
    }

    .diff-arrow {
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 32px;
      color: #667eea;
      font-weight: bold;
    }

    .stats {
      display: flex;
      justify-content: space-around;
      padding: 20px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .stat-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
    }

    .stat-label {
      font-size: 12px;
      color: #666;
      text-transform: uppercase;
      font-weight: 600;
      letter-spacing: 0.5px;
    }

    .stat-value {
      font-size: 16px;
      font-weight: 700;
      color: #333;
    }

    .stat-positive .stat-value {
      color: #28a745;
    }

    .stat-negative .stat-value {
      color: #dc3545;
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 16px;
      padding: 20px 28px;
      border-top: 2px solid #eee;
      background: white;
      border-radius: 0 0 16px 16px;
    }

    .btn {
      padding: 12px 28px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 15px;
      font-weight: 600;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }

    .btn-reject {
      background: #6c757d;
      color: white;
    }

    .btn-reject:hover {
      background: #5a6268;
    }

    .btn-accept {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .btn-accept:hover {
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }

    /* Scrollbar styling */
    .text-content::-webkit-scrollbar {
      width: 8px;
    }

    .text-content::-webkit-scrollbar-track {
      background: #f1f1f1;
      border-radius: 4px;
    }

    .text-content::-webkit-scrollbar-thumb {
      background: #888;
      border-radius: 4px;
    }

    .text-content::-webkit-scrollbar-thumb:hover {
      background: #555;
    }
  `]
})
export class AgentPreviewModalComponent implements OnChanges {
  @Input() isVisible: boolean = false;
  @Input() previewData: PreviewData | null = null;
  @Input() isLoading: boolean = false;
  @Input() error: string | null = null;

  @Output() accept = new EventEmitter<PreviewAction>();
  @Output() reject = new EventEmitter<PreviewAction>();
  @Output() close = new EventEmitter<void>();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isVisible'] && this.isVisible) {
      console.log('[AgentPreviewModal] Modal opened with data:', this.previewData);
    }
  }

  getDiff(): number {
    if (!this.previewData) return 0;
    return this.previewData.proposedText.length - this.previewData.originalText.length;
  }

  onAccept(): void {
    if (this.previewData) {
      this.accept.emit({
        action: 'accept',
        proposedText: this.previewData.proposedText
      });
    }
  }

  onReject(): void {
    this.reject.emit({ action: 'reject' });
  }

  onBackdropClick(): void {
    if (!this.isLoading) {
      this.onReject();
    }
  }

  onContentClick(event: Event): void {
    event.stopPropagation();
  }
}
