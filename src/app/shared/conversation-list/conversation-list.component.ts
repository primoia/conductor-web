/**
 * 🔥 NOVO: Componente para listar e gerenciar conversas
 *
 * Permite ao usuário:
 * - Ver lista de conversas
 * - Criar nova conversa (botão +)
 * - Selecionar conversa ativa
 * - Deletar conversas
 *
 * Ref: PLANO_UX_MULTIPLAS_CONVERSAS.md - Fase 1
 * Data: 2025-11-02
 */

import { Component, OnInit, Output, EventEmitter, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConversationService, ConversationSummary } from '../../services/conversation.service';

@Component({
  selector: 'app-conversation-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="conversation-list">
      <div class="conversation-list-header">
        <h3>Conversas</h3>
        <button
          class="new-conversation-btn"
          (click)="onCreateNewConversation()"
          title="Criar nova conversa">
          +
        </button>
      </div>

      <div class="conversation-items" *ngIf="conversations.length > 0; else emptyState">
        <div
          *ngFor="let conv of conversations"
          class="conversation-item"
          [class.active]="conv.conversation_id === activeConversationId"
          (click)="onSelectConversation(conv.conversation_id)">

          <div class="conversation-header">
            <span
              *ngIf="editingConversationId !== conv.conversation_id"
              class="conversation-title"
              (dblclick)="startEditTitle(conv.conversation_id, conv.title)"
              title="Duplo clique para editar">
              {{ conv.title }}
            </span>
            <input
              *ngIf="editingConversationId === conv.conversation_id"
              type="text"
              class="title-edit-input"
              [(ngModel)]="editingTitle"
              (blur)="saveTitle(conv.conversation_id)"
              (keydown.enter)="saveTitle(conv.conversation_id)"
              (keydown.escape)="cancelEditTitle()"
              (click)="$event.stopPropagation()"
              #titleInput
            />
            <button
              class="delete-btn"
              (click)="onDeleteConversation($event, conv.conversation_id)"
              title="Deletar conversa">
              🗑️
            </button>
          </div>

          <div class="conversation-meta">
            <span class="participants" *ngIf="conv.participant_count > 0">
              {{ conv.participant_count }} agente(s)
            </span>
            <span class="count">{{ conv.message_count }} msgs</span>
          </div>

          <div class="conversation-date">
            {{ formatDate(conv.updated_at) }}
          </div>
        </div>
      </div>

      <ng-template #emptyState>
        <div class="empty-state">
          <p>📝 Nenhuma conversa ainda</p>
          <p class="hint">Clique no + para começar</p>
        </div>
      </ng-template>
    </div>
  `,
  styles: [`
    .conversation-list {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #f8f9fa;
      border-right: 1px solid #dee2e6;
    }

    .conversation-list-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      border-bottom: 1px solid #dee2e6;
      background: white;
    }

    .conversation-list-header h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #212529;
    }

    .new-conversation-btn {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: 2px solid #007bff;
      background: #007bff;
      color: white;
      font-size: 20px;
      font-weight: bold;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      padding: 0;
      line-height: 1;
    }

    .new-conversation-btn:hover {
      background: #0056b3;
      border-color: #0056b3;
      transform: scale(1.1);
    }

    .conversation-items {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
    }

    .conversation-item {
      background: white;
      border: 1px solid #dee2e6;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 8px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .conversation-item:hover {
      background: #f1f3f5;
      border-color: #adb5bd;
    }

    .conversation-item.active {
      background: #e7f1ff;
      border-color: #007bff;
      box-shadow: 0 2px 4px rgba(0, 123, 255, 0.1);
    }

    .conversation-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 8px;
    }

    .conversation-title {
      font-size: 14px;
      font-weight: 500;
      color: #212529;
      flex: 1;
      word-break: break-word;
      cursor: text;
    }

    .title-edit-input {
      font-size: 14px;
      font-weight: 500;
      color: #212529;
      flex: 1;
      border: 1px solid #007bff;
      border-radius: 4px;
      padding: 4px 8px;
      outline: none;
      background: white;
    }

    .title-edit-input:focus {
      border-color: #0056b3;
      box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
    }

    .delete-btn {
      background: none;
      border: none;
      font-size: 16px;
      cursor: pointer;
      padding: 0;
      margin-left: 8px;
      opacity: 0.5;
      transition: opacity 0.2s;
      flex-shrink: 0;
    }

    .delete-btn:hover {
      opacity: 1;
    }

    .conversation-meta {
      display: flex;
      gap: 12px;
      font-size: 12px;
      color: #6c757d;
      margin-bottom: 4px;
    }

    .conversation-date {
      font-size: 11px;
      color: #adb5bd;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      padding: 32px;
      text-align: center;
      color: #6c757d;
    }

    .empty-state p {
      margin: 8px 0;
    }

    .empty-state .hint {
      font-size: 13px;
      color: #adb5bd;
    }
  `]
})
export class ConversationListComponent implements OnInit {
  @Input() activeConversationId: string | null = null;
  @Input() screenplayId: string | null = null; // 🔥 NOVO: Filtrar conversas por roteiro
  @Output() conversationSelected = new EventEmitter<string>();
  @Output() conversationCreated = new EventEmitter<void>();
  @Output() conversationDeleted = new EventEmitter<string>();

  conversations: ConversationSummary[] = [];
  editingConversationId: string | null = null;
  editingTitle: string = '';
  originalTitle: string = '';

  constructor(private conversationService: ConversationService) {}

  ngOnInit(): void {
    this.loadConversations();
  }

  loadConversations(): void {
    this.conversationService.listConversations(20, 0, this.screenplayId || undefined).subscribe({
      next: (response) => {
        this.conversations = response.conversations.sort((a, b) => {
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        });
      },
      error: (error) => {
        console.error('❌ Erro ao carregar conversas:', error);
      }
    });
  }

  onCreateNewConversation(): void {
    this.conversationCreated.emit();
  }

  onSelectConversation(conversationId: string): void {
    if (conversationId !== this.activeConversationId) {
      this.conversationSelected.emit(conversationId);
    }
  }

  onDeleteConversation(event: Event, conversationId: string): void {
    event.stopPropagation(); // Prevent selecting the conversation

    if (confirm('Tem certeza que deseja deletar esta conversa?')) {
      this.conversationDeleted.emit(conversationId);
    }
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'agora';
    if (diffMins < 60) return `${diffMins}m atrás`;
    if (diffHours < 24) return `${diffHours}h atrás`;
    if (diffDays < 7) return `${diffDays}d atrás`;

    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }

  // Método público para recarregar a lista (chamado pelo componente pai)
  refresh(): void {
    this.loadConversations();
  }

  startEditTitle(conversationId: string, currentTitle: string): void {
    this.editingConversationId = conversationId;
    this.editingTitle = currentTitle;
    this.originalTitle = currentTitle;

    // Focar no input após o Angular renderizar
    setTimeout(() => {
      const input = document.querySelector('.title-edit-input') as HTMLInputElement;
      if (input) {
        input.focus();
        input.select();
      }
    }, 0);
  }

  saveTitle(conversationId: string): void {
    if (!this.editingTitle || this.editingTitle.trim().length < 3) {
      alert('O título deve ter no mínimo 3 caracteres');
      this.editingTitle = this.originalTitle;
      this.editingConversationId = null;
      return;
    }

    if (this.editingTitle.trim().length > 100) {
      alert('O título deve ter no máximo 100 caracteres');
      this.editingTitle = this.originalTitle;
      this.editingConversationId = null;
      return;
    }

    const trimmedTitle = this.editingTitle.trim();

    if (trimmedTitle === this.originalTitle) {
      // Sem mudança
      this.editingConversationId = null;
      return;
    }

    this.conversationService.updateConversationTitle(conversationId, trimmedTitle).subscribe({
      next: (response) => {
        console.log('✅ Título atualizado:', response);
        // Atualizar localmente
        const conv = this.conversations.find(c => c.conversation_id === conversationId);
        if (conv) {
          conv.title = response.new_title;
        }
        this.editingConversationId = null;
      },
      error: (error) => {
        console.error('❌ Erro ao atualizar título:', error);
        alert('Erro ao atualizar título: ' + (error.error?.detail || error.message));
        this.editingTitle = this.originalTitle;
        this.editingConversationId = null;
      }
    });
  }

  cancelEditTitle(): void {
    this.editingConversationId = null;
    this.editingTitle = '';
    this.originalTitle = '';
  }
}
