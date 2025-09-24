import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProposalBlock, ProposalData } from '../blocks/proposal-block/proposal-block';
import { ExecutionTrigger, ExecutionTriggerData } from '../blocks/execution-trigger/execution-trigger';

@Component({
  selector: 'app-interactive-sidebar',
  standalone: true,
  imports: [CommonModule, ProposalBlock, ExecutionTrigger],
  template: `
    <div class="sidebar" [class.open]="isOpen" [class.closed]="!isOpen">
      <div class="sidebar-header">
        <h3>🧩 Blocos Interativos</h3>
        <button class="toggle-btn" (click)="toggle()">
          {{ isOpen ? '→' : '←' }}
        </button>
      </div>

      <div class="sidebar-content" *ngIf="isOpen">
        <div class="block-section" *ngIf="activeBlock">
          <div class="section-title">Editando Bloco:</div>

          <!-- Proposal Block -->
          <app-proposal-block
            *ngIf="activeBlock.type === 'proposal'"
            [data]="activeBlock.data"
            [editable]="true"
            (statusChange)="onProposalChange($event)">
          </app-proposal-block>

          <!-- Execution Trigger -->
          <app-execution-trigger
            *ngIf="activeBlock.type === 'execution'"
            [data]="activeBlock.data"
            [editable]="true"
            (execute)="onExecutionTrigger($event)">
          </app-execution-trigger>

          <div class="block-actions">
            <button class="btn btn-primary" (click)="saveToDocument()">
              💾 Salvar no Documento
            </button>
            <button class="btn btn-secondary" (click)="closeBlock()">
              ✕ Fechar
            </button>
          </div>
        </div>

        <div class="no-block" *ngIf="!activeBlock">
          <p>Selecione um bloco no editor para começar a editar</p>
          <div class="quick-actions">
            <button class="quick-btn" (click)="createProposal()">
              ✨ Nova Proposta
            </button>
            <button class="quick-btn" (click)="createExecution()">
              ▶️ Novo Gatilho
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .sidebar {
      position: fixed;
      top: 0;
      right: 0;
      height: 100vh;
      background: white;
      border-left: 2px solid #eee;
      box-shadow: -4px 0 20px rgba(0,0,0,0.1);
      transition: width 0.3s ease;
      z-index: 100;
      display: flex;
      flex-direction: column;
    }

    .sidebar.open {
      width: 400px;
    }

    .sidebar.closed {
      width: 50px;
    }

    .sidebar-header {
      padding: 15px;
      border-bottom: 1px solid #eee;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f8f9fa;
    }

    .sidebar.closed .sidebar-header h3 {
      display: none;
    }

    .toggle-btn {
      background: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 5px 10px;
      cursor: pointer;
      font-weight: bold;
    }

    .sidebar-content {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
    }

    .section-title {
      font-weight: bold;
      color: #666;
      margin-bottom: 15px;
    }

    .block-actions {
      margin-top: 20px;
      display: flex;
      gap: 10px;
      flex-direction: column;
    }

    .btn {
      padding: 10px 15px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-weight: bold;
    }

    .btn-primary {
      background: #007bff;
      color: white;
    }

    .btn-secondary {
      background: #6c757d;
      color: white;
    }

    .no-block {
      text-align: center;
      color: #666;
      padding: 40px 0;
    }

    .quick-actions {
      margin-top: 20px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .quick-btn {
      padding: 12px 15px;
      border: 2px dashed #ddd;
      background: white;
      border-radius: 8px;
      cursor: pointer;
      font-weight: bold;
      transition: all 0.2s;
    }

    .quick-btn:hover {
      border-color: #007bff;
      background: #f8f9ff;
    }
  `]
})
export class InteractiveSidebar {
  @Input() isOpen = false;
  @Output() blockSelected = new EventEmitter<any>();
  @Output() blockSaved = new EventEmitter<any>();

  activeBlock: any = null;

  toggle(): void {
    this.isOpen = !this.isOpen;
  }

  onProposalChange(status: 'accepted' | 'rejected'): void {
    console.log('Sidebar: Proposal status changed to', status);
  }

  onExecutionTrigger(data: ExecutionTriggerData): void {
    console.log('Sidebar: Execution triggered', data);
  }

  saveToDocument(): void {
    this.blockSaved.emit(this.activeBlock);
    this.closeBlock();
  }

  closeBlock(): void {
    this.activeBlock = null;
  }

  createProposal(): void {
    this.activeBlock = {
      type: 'proposal',
      data: {
        id: 'new-proposal',
        title: 'Nova Proposta',
        description: 'Descreva sua proposta aqui...',
        status: 'pending',
        createdAt: new Date()
      }
    };
  }

  createExecution(): void {
    this.activeBlock = {
      type: 'execution',
      data: {
        id: 'new-execution',
        title: 'Novo Gatilho',
        command: 'npm run build',
        status: 'idle',
        createdAt: new Date()
      }
    };
  }

  // Método público para ser chamado pelo editor
  editBlock(blockType: string, blockData: any): void {
    this.activeBlock = { type: blockType, data: blockData };
    this.isOpen = true;
  }
}