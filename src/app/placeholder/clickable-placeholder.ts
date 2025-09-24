import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-clickable-placeholder',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="block-placeholder"
         [attr.data-type]="blockType"
         (click)="onClick()"
         [ngClass]="'placeholder-' + blockType">

      <!-- Proposal Placeholder -->
      <div *ngIf="blockType === 'proposal'" class="placeholder-content">
        <div class="placeholder-header">
          <span class="icon">✨</span>
          <span class="title">{{ data?.title || 'Proposta de IA' }}</span>
          <span class="status" [ngClass]="'status-' + (data?.status || 'pending')">
            {{ getStatusText() }}
          </span>
        </div>
        <div class="placeholder-preview">
          {{ data?.description || 'Clique para editar proposta...' }}
        </div>
      </div>

      <!-- Execution Placeholder -->
      <div *ngIf="blockType === 'execution'" class="placeholder-content">
        <div class="placeholder-header">
          <span class="icon">▶️</span>
          <span class="title">{{ data?.title || 'Gatilho de Execução' }}</span>
          <span class="status" [ngClass]="'status-' + (data?.status || 'idle')">
            {{ getStatusText() }}
          </span>
        </div>
        <div class="placeholder-command">
          <code>{{ data?.command || 'npm run build' }}</code>
        </div>
      </div>

      <!-- Include Placeholder -->
      <div *ngIf="blockType === 'include'" class="placeholder-content">
        <div class="placeholder-header">
          <span class="icon">📦</span>
          <span class="title">{{ data?.title || 'Include Sub-Roteiro' }}</span>
        </div>
        <div class="placeholder-path">
          📁 {{ data?.path || 'roteiros/example.md' }}
        </div>
      </div>

      <div class="placeholder-actions">
        <span class="click-hint">Clique para editar</span>
      </div>
    </div>
  `,
  styles: [`
    .block-placeholder {
      border: 2px solid #e9ecef;
      border-radius: 8px;
      padding: 15px;
      margin: 10px 0;
      cursor: pointer;
      transition: all 0.2s ease;
      background: white;
      position: relative;
    }

    .block-placeholder:hover {
      border-color: #007bff;
      box-shadow: 0 2px 8px rgba(0,123,255,0.1);
      transform: translateY(-1px);
    }

    .placeholder-proposal {
      border-left: 4px solid #007bff;
    }

    .placeholder-execution {
      border-left: 4px solid #28a745;
    }

    .placeholder-include {
      border-left: 4px solid #ffc107;
    }

    .placeholder-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }

    .icon {
      font-size: 18px;
    }

    .title {
      font-weight: bold;
      color: #333;
      flex: 1;
    }

    .status {
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: bold;
      text-transform: uppercase;
    }

    .status-pending {
      background: #fff3cd;
      color: #856404;
    }

    .status-accepted {
      background: #d4edda;
      color: #155724;
    }

    .status-rejected {
      background: #f8d7da;
      color: #721c24;
    }

    .status-idle {
      background: #e2e3e5;
      color: #383d41;
    }

    .status-running {
      background: #cce5ff;
      color: #004085;
    }

    .status-success {
      background: #d4edda;
      color: #155724;
    }

    .status-failed {
      background: #f8d7da;
      color: #721c24;
    }

    .placeholder-preview {
      color: #666;
      font-size: 14px;
      line-height: 1.4;
      margin-bottom: 8px;
    }

    .placeholder-command {
      background: #f8f9fa;
      border-radius: 4px;
      padding: 8px;
      margin-bottom: 8px;
    }

    .placeholder-command code {
      color: #e83e8c;
      font-weight: bold;
    }

    .placeholder-path {
      color: #666;
      font-family: monospace;
      font-size: 13px;
      margin-bottom: 8px;
    }

    .placeholder-actions {
      display: flex;
      justify-content: flex-end;
    }

    .click-hint {
      color: #999;
      font-size: 12px;
      font-style: italic;
    }

    .block-placeholder:hover .click-hint {
      color: #007bff;
    }
  `]
})
export class ClickablePlaceholder {
  @Input() blockType: 'proposal' | 'execution' | 'include' = 'proposal';
  @Input() data: any = null;
  @Output() blockClicked = new EventEmitter<{type: string, data: any}>();

  onClick(): void {
    this.blockClicked.emit({
      type: this.blockType,
      data: this.data || this.getDefaultData()
    });
  }

  getStatusText(): string {
    const status = this.data?.status || 'pending';
    const statusMap: Record<string, string> = {
      pending: 'Pendente',
      accepted: 'Aceito',
      rejected: 'Rejeitado',
      idle: 'Pronto',
      running: 'Executando',
      success: 'Sucesso',
      failed: 'Falhou'
    };
    return statusMap[status] || status;
  }

  private getDefaultData(): any {
    switch (this.blockType) {
      case 'proposal':
        return {
          id: 'new-proposal',
          title: 'Nova Proposta',
          description: 'Descreva sua proposta aqui...',
          status: 'pending'
        };
      case 'execution':
        return {
          id: 'new-execution',
          title: 'Novo Gatilho',
          command: 'npm run build',
          status: 'idle'
        };
      case 'include':
        return {
          id: 'new-include',
          title: 'Novo Include',
          path: 'roteiros/example.md'
        };
      default:
        return {};
    }
  }
}