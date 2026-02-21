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

import { Component, OnInit, Output, EventEmitter, Input, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { ConversationService, ConversationSummary } from '../../services/conversation.service';

@Component({
  selector: 'app-conversation-list',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule],
  template: `
    <div class="conversation-list">
      <div class="conversation-list-header">
        <h3>Conversas</h3>
        <div class="header-actions">
          <button
            class="new-conversation-btn"
            [disabled]="!screenplayId"
            (click)="onCreateNewConversation()"
            [title]="screenplayId ? 'Criar nova conversa' : 'Selecione um roteiro primeiro'">
            +
          </button>
        </div>
      </div>

      <div
        class="conversation-items"
        *ngIf="conversations.length > 0; else emptyState"
        cdkDropList
        (cdkDropListDropped)="onDrop($event)">
        <div
          *ngFor="let conv of conversations"
          class="conversation-item"
          [class.active]="conv.conversation_id === activeConversationId"
          (click)="onSelectConversation(conv.conversation_id)"
          cdkDrag>

          <!-- Placeholder durante drag -->
          <div class="conversation-placeholder" *cdkDragPlaceholder></div>

          <!-- Content wrapper -->
          <div class="conversation-content">
            <!-- Título -->
            <span class="conversation-title" [title]="conv.title">
              {{ conv.title }}
            </span>

            <!-- Botões de ação compactos -->
            <div class="conversation-actions">
              <button
                class="action-btn edit-btn"
                (click)="onEditContext($event, conv)"
                title="Editar conversa">
                📝
              </button>
              <button
                class="action-btn clone-btn"
                (click)="onCloneConversation($event, conv.conversation_id)"
                title="Clonar conversa">
                🔀
              </button>
              <button
                class="action-btn delete-btn"
                (click)="onDeleteConversation($event, conv.conversation_id)"
                title="Deletar conversa">
                🗑️
              </button>
            </div>
          </div> <!-- /conversation-content -->

          <!-- Drag handle (direita) -->
          <div class="drag-handle" cdkDragHandle title="Arrastar para reordenar">
            ⋮⋮
          </div>
        </div>
      </div>

      <ng-template #emptyState>
        <div class="empty-state">
          <p *ngIf="!screenplayId">📋 Selecione um roteiro</p>
          <p class="hint" *ngIf="!screenplayId">Escolha um roteiro para ver suas conversas</p>

          <p *ngIf="screenplayId">📝 Nenhuma conversa ainda</p>
          <p class="hint" *ngIf="screenplayId">Clique no + para começar</p>
        </div>
      </ng-template>
    </div>

    <!-- Modal de Confirmação de Delete -->
    <div class="modal-overlay delete-overlay" *ngIf="showDeleteModal" (click)="closeDeleteModal()">
      <div class="modal-content delete-confirm-modal" (click)="$event.stopPropagation()">
        <div class="modal-header delete-header">
          <h3>🗑️ Excluir Conversa</h3>
          <button class="modal-close-btn" (click)="closeDeleteModal()">×</button>
        </div>

        <div class="modal-body">
          <div class="conversation-display" *ngIf="conversationToDelete">
            <div class="conversation-icon">💬</div>
            <div class="conversation-delete-details">
              <div class="conversation-name-large">{{ conversationToDelete.title }}</div>
              <div class="conversation-meta-large">{{ conversationToDelete.message_count }} mensagens</div>
            </div>
          </div>
          <p class="delete-warning">Esta ação não pode ser desfeita. Todas as mensagens serão perdidas.</p>
        </div>

        <div class="modal-footer">
          <button class="modal-cancel-btn" (click)="closeDeleteModal()">Cancelar</button>
          <button class="modal-delete-btn" (click)="confirmDeleteConversation()">Excluir Conversa</button>
        </div>
      </div>
    </div>

    <!-- Modal de Edição -->
    <div class="modal-overlay" *ngIf="showEditModal" (click)="closeEditModal()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3>Editar Conversa</h3>
          <button class="modal-close-btn" (click)="closeEditModal()">×</button>
        </div>

        <div class="modal-body">
          <div class="form-group">
            <label for="modal-title">Título</label>
            <input
              id="modal-title"
              type="text"
              class="modal-title-input"
              [(ngModel)]="editModalTitle"
              placeholder="Digite o título da conversa"
              maxlength="100"
            />
          </div>

          <div class="form-group">
            <label for="modal-context">Contexto (Markdown)</label>
            <textarea
              id="modal-context"
              class="modal-context-input"
              [(ngModel)]="editModalContext"
              placeholder="Digite o contexto da conversa em Markdown..."
              rows="10"
            ></textarea>
          </div>

          <div class="chain-settings">
            <h4>Cadeia de Agentes</h4>

            <div class="form-group toggle-group">
              <label class="toggle-label" for="modal-auto-delegate">
                <span>Auto-delegar</span>
                <span class="toggle-hint">Agentes podem chamar outros agentes sem esperar o humano</span>
              </label>
              <label class="toggle-switch">
                <input
                  id="modal-auto-delegate"
                  type="checkbox"
                  [(ngModel)]="editModalAutoDelegate"
                />
                <span class="toggle-slider"></span>
              </label>
            </div>

            <div class="form-group" *ngIf="editModalAutoDelegate">
              <label for="modal-chain-depth">Limite de ciclos autonomos</label>
              <input
                id="modal-chain-depth"
                type="number"
                class="modal-title-input chain-depth-input"
                [(ngModel)]="editModalMaxChainDepth"
                placeholder="Global (10)"
                min="1"
                max="100"
              />
              <span class="field-hint">Vazio = usa limite global. Max 100.</span>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="modal-cancel-btn" (click)="closeEditModal()">Cancelar</button>
          <button class="modal-save-btn" (click)="saveEditModal()">Salvar</button>
        </div>
      </div>
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

    .header-actions {
      display: flex;
      gap: 8px;
      align-items: center;
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

    .new-conversation-btn:hover:not(:disabled) {
      background: #0056b3;
      border-color: #0056b3;
      transform: scale(1.1);
    }

    .new-conversation-btn:disabled {
      background: #6c757d;
      border-color: #6c757d;
      opacity: 0.5;
      cursor: not-allowed;
    }

    .conversation-items {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
    }

    .conversation-item {
      background: white;
      border: 1px solid #dee2e6;
      border-radius: 6px;
      padding: 8px 10px;
      margin-bottom: 6px;
      cursor: pointer;
      transition: all 0.2s;
      position: relative;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .conversation-content {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      min-width: 0; /* Permite text overflow */
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

    .conversation-title {
      font-size: 14px;
      font-weight: 500;
      color: #212529;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex: 1;
      min-width: 0;
    }

    /* Botões de ação compactos */
    .conversation-actions {
      display: flex;
      gap: 0;
      flex-shrink: 0;
    }

    .action-btn {
      background: transparent;
      border: none;
      border-radius: 3px;
      font-size: 12px;
      cursor: pointer;
      padding: 2px 4px;
      transition: all 0.15s;
      opacity: 0.6;
    }

    .conversation-item:hover .action-btn {
      opacity: 1;
    }

    .action-btn:hover {
      background: #e9ecef;
    }

    .edit-btn:hover {
      background: #e7f1ff;
    }

    .clone-btn:hover {
      background: #e8f5e9;
    }

    .delete-btn:hover {
      background: #ffe5e5;
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

    /* Drag & Drop Styles */
    .drag-handle {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 14px;
      color: #ced4da;
      cursor: grab;
      font-size: 12px;
      line-height: 1;
      user-select: none;
      flex-shrink: 0;
      opacity: 0.5;
    }

    .conversation-item:hover .drag-handle {
      opacity: 1;
      color: #adb5bd;
    }

    .drag-handle:active {
      cursor: grabbing;
    }

    .drag-handle:hover {
      color: #6c757d;
    }

    .cdk-drag-preview {
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
      opacity: 0.8;
    }

    .cdk-drag-animating {
      transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
    }

    .conversation-items.cdk-drop-list-dragging .conversation-item:not(.cdk-drag-placeholder) {
      transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
    }

    .conversation-placeholder {
      background: #e9ecef;
      border: 2px dashed #adb5bd;
      border-radius: 6px;
      min-height: 36px;
    }

    /* Modal Styles */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    }

    .modal-content {
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      max-width: 600px;
      width: 90%;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px;
      border-bottom: 1px solid #dee2e6;
    }

    .modal-header h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #212529;
    }

    .modal-close-btn {
      background: none;
      border: none;
      font-size: 28px;
      line-height: 1;
      color: #6c757d;
      cursor: pointer;
      padding: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: all 0.2s;
    }

    .modal-close-btn:hover {
      background: #f8f9fa;
      color: #212529;
    }

    .modal-body {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
    }

    .form-group {
      margin-bottom: 20px;
    }

    .form-group label {
      display: block;
      margin-bottom: 8px;
      font-size: 14px;
      font-weight: 500;
      color: #495057;
    }

    .modal-title-input {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #ced4da;
      border-radius: 4px;
      font-size: 14px;
      transition: border-color 0.2s;
    }

    .modal-title-input:focus {
      outline: none;
      border-color: #007bff;
      box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
    }

    .modal-context-input {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #ced4da;
      border-radius: 4px;
      font-size: 14px;
      font-family: 'Courier New', monospace;
      resize: vertical;
      min-height: 200px;
      transition: border-color 0.2s;
    }

    .modal-context-input:focus {
      outline: none;
      border-color: #007bff;
      box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 20px;
      border-top: 1px solid #dee2e6;
      background: #f8f9fa;
    }

    .modal-cancel-btn,
    .modal-save-btn {
      padding: 8px 20px;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      border: none;
    }

    .modal-cancel-btn {
      background: white;
      color: #6c757d;
      border: 1px solid #dee2e6;
    }

    .modal-cancel-btn:hover {
      background: #f8f9fa;
      border-color: #adb5bd;
    }

    .modal-save-btn {
      background: #007bff;
      color: white;
    }

    .modal-save-btn:hover {
      background: #0056b3;
    }

    /* Chain Settings Styles */
    .chain-settings {
      border-top: 1px solid #dee2e6;
      padding-top: 16px;
      margin-top: 8px;
    }

    .chain-settings h4 {
      margin: 0 0 12px 0;
      font-size: 14px;
      font-weight: 600;
      color: #495057;
    }

    .toggle-group {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .toggle-label {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1;
    }

    .toggle-label span:first-child {
      font-weight: 500;
      color: #495057;
    }

    .toggle-hint {
      font-size: 12px;
      color: #6c757d;
    }

    .toggle-switch {
      position: relative;
      display: inline-block;
      width: 44px;
      height: 24px;
      flex-shrink: 0;
    }

    .toggle-switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }

    .toggle-slider {
      position: absolute;
      cursor: pointer;
      top: 0; left: 0; right: 0; bottom: 0;
      background: #ced4da;
      border-radius: 24px;
      transition: 0.3s;
    }

    .toggle-slider:before {
      content: "";
      position: absolute;
      height: 18px;
      width: 18px;
      left: 3px;
      bottom: 3px;
      background: white;
      border-radius: 50%;
      transition: 0.3s;
    }

    .toggle-switch input:checked + .toggle-slider {
      background: #007bff;
    }

    .toggle-switch input:checked + .toggle-slider:before {
      transform: translateX(20px);
    }

    .chain-depth-input {
      width: 120px !important;
    }

    .field-hint {
      display: block;
      font-size: 12px;
      color: #6c757d;
      margin-top: 4px;
    }

    /* Delete Confirmation Modal Styles */
    .delete-overlay {
      z-index: 10001;
    }

    .delete-confirm-modal {
      max-width: 450px;
    }

    .delete-header h3 {
      color: #dc3545;
    }

    .conversation-display {
      display: flex;
      gap: 16px;
      align-items: center;
      padding: 16px;
      background: #f8f9fa;
      border-radius: 8px;
      margin-bottom: 16px;
    }

    .conversation-icon {
      font-size: 48px;
      flex-shrink: 0;
    }

    .conversation-delete-details {
      flex: 1;
      min-width: 0;
    }

    .conversation-name-large {
      font-weight: 600;
      font-size: 18px;
      color: #333;
      margin-bottom: 4px;
      word-break: break-word;
    }

    .conversation-meta-large {
      font-size: 14px;
      color: #666;
    }

    .delete-warning {
      color: #856404;
      background: #fff3cd;
      border: 1px solid #ffeeba;
      border-radius: 4px;
      padding: 12px;
      font-size: 14px;
      margin: 0;
    }

    .modal-delete-btn {
      padding: 8px 20px;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      border: none;
      background: #dc3545;
      color: white;
    }

    .modal-delete-btn:hover {
      background: #c82333;
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(220, 53, 69, 0.3);
    }

    .modal-delete-btn:active {
      background: #bd2130;
      transform: translateY(0);
    }
  `]
})
export class ConversationListComponent implements OnInit {
  @Input() activeConversationId: string | null = null;
  @Input() screenplayId: string | null = null; // 🔥 NOVO: Filtrar conversas por roteiro
  @Input() agentInstances: any[] = []; // 🔥 NOVO: Lista de instâncias de agentes para contar os ativos
  @Output() conversationSelected = new EventEmitter<string>();
  @Output() conversationCreated = new EventEmitter<void>();
  @Output() conversationDeleted = new EventEmitter<string>();
  @Output() conversationCloned = new EventEmitter<string>(); // Emite conversation_id da nova conversa clonada
  @Output() contextEditRequested = new EventEmitter<string>(); // Emite conversation_id para editar contexto

  conversations: ConversationSummary[] = [];

  // 🔥 NOVO: Estado do modal de edição
  showEditModal = false;
  editingConversation: ConversationSummary | null = null;
  editModalTitle = '';
  editModalContext = '';
  editModalAutoDelegate = false;
  editModalMaxChainDepth: number | null = null;

  // 🔥 NOVO: Estado do modal de confirmação de delete
  showDeleteModal = false;
  conversationToDelete: ConversationSummary | null = null;

  constructor(private conversationService: ConversationService) {}

  ngOnInit(): void {
    this.loadConversations();
  }

  loadConversations(): void {
    // 🔒 BUG FIX: Não carregar conversas se não há roteiro selecionado
    // Isso evita que todas as conversas sejam mostradas e previne criação de agentes sem roteiro
    if (!this.screenplayId) {
      console.log('⚠️ Nenhum roteiro selecionado, não carregando conversas');
      this.conversations = [];
      return;
    }

    this.conversationService.listConversations(20, 0, this.screenplayId).subscribe({
      next: (response) => {
        // 🔥 NOVO: Ordenar por display_order se disponível, senão por updated_at
        this.conversations = response.conversations.sort((a, b) => {
          const aOrder = (a as any).display_order;
          const bOrder = (b as any).display_order;

          // Se ambos têm display_order, usar isso
          if (aOrder !== undefined && bOrder !== undefined) {
            return aOrder - bOrder;
          }

          // Se apenas um tem display_order, ele vem primeiro
          if (aOrder !== undefined) return -1;
          if (bOrder !== undefined) return 1;

          // Caso contrário, ordenar por data de atualização (mais recente primeiro)
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

  /**
   * 🔥 NOVO: Conta agentes ativos (não deletados) em uma conversa
   */
  getActiveAgentCount(conversationId: string): number {
    return this.agentInstances.filter(agent =>
      agent.conversation_id === conversationId &&
      !agent.isDeleted &&
      !agent.is_deleted
    ).length;
  }

  /**
   * 🔥 NOVO: Abre modal para editar título e contexto da conversa
   */
  onEditContext(event: Event, conversation: ConversationSummary): void {
    event.stopPropagation(); // Prevent selecting the conversation

    // Buscar dados completos da conversa do backend para garantir que o contexto seja carregado
    this.conversationService.getConversation(conversation.conversation_id).subscribe({
      next: (fullConversation) => {
        this.editingConversation = conversation;
        this.editModalTitle = fullConversation.title;
        this.editModalContext = fullConversation.context || '';
        this.editModalAutoDelegate = fullConversation.auto_delegate !== false;
        this.editModalMaxChainDepth = fullConversation.max_chain_depth ?? 10;
        this.showEditModal = true;

        // Focar no contexto após o modal abrir
        setTimeout(() => {
          const contextInput = document.querySelector('.modal-context-input') as HTMLTextAreaElement;
          if (contextInput) {
            contextInput.focus();
          }
        }, 100);
      },
      error: (error) => {
        console.error('❌ Erro ao carregar dados da conversa:', error);
        alert('Erro ao carregar dados da conversa');
      }
    });
  }

  /**
   * 🔥 NOVO: Salva alterações do modal
   */
  saveEditModal(): void {
    if (!this.editingConversation) return;

    if (!this.editModalTitle || this.editModalTitle.trim().length < 3) {
      alert('O título deve ter no mínimo 3 caracteres');
      return;
    }

    const conversationId = this.editingConversation.conversation_id;
    const trimmedTitle = this.editModalTitle.trim();
    const trimmedContext = this.editModalContext.trim();

    // Atualizar título
    this.conversationService.updateConversationTitle(conversationId, trimmedTitle).subscribe({
      next: () => {
        console.log('✅ Título atualizado com sucesso');

        // Atualizar contexto se houver
        if (trimmedContext !== (this.editingConversation?.context || '')) {
          this.conversationService.updateConversationContext(conversationId, trimmedContext || null).subscribe({
            next: () => {
              console.log('✅ Contexto atualizado com sucesso');
              this.saveChainSettings(conversationId);
            },
            error: (error: any) => {
              console.error('❌ Erro ao atualizar contexto:', error);
              alert('Título atualizado, mas erro ao atualizar contexto');
              this.saveChainSettings(conversationId);
            }
          });
        } else {
          this.saveChainSettings(conversationId);
        }
      },
      error: (error: any) => {
        console.error('❌ Erro ao atualizar título:', error);
        alert('Erro ao atualizar conversa');
      }
    });
  }

  /**
   * Salva chain settings (auto_delegate, max_chain_depth) e fecha o modal.
   */
  private saveChainSettings(conversationId: string): void {
    const settings: { max_chain_depth?: number | null; auto_delegate?: boolean } = {
      auto_delegate: this.editModalAutoDelegate,
    };

    // Only send max_chain_depth if auto_delegate is on
    if (this.editModalAutoDelegate) {
      settings.max_chain_depth = this.editModalMaxChainDepth || 0; // 0 = reset to global
    }

    this.conversationService.updateConversationSettings(conversationId, settings).subscribe({
      next: () => {
        console.log('✅ Chain settings atualizados');
        this.closeEditModal();
        this.loadConversations();
      },
      error: (error: any) => {
        console.error('❌ Erro ao atualizar chain settings:', error);
        this.closeEditModal();
        this.loadConversations();
      }
    });
  }

  /**
   * 🔥 NOVO: Fecha modal de edição
   */
  closeEditModal(): void {
    this.showEditModal = false;
    this.editingConversation = null;
    this.editModalTitle = '';
    this.editModalContext = '';
    this.editModalAutoDelegate = false;
    this.editModalMaxChainDepth = null;
  }

  /**
   * Close modals with ESC key
   */
  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(event: Event): void {
    if (this.showDeleteModal) {
      this.closeDeleteModal();
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (this.showEditModal) {
      this.closeEditModal();
      event.preventDefault();
      event.stopPropagation();
    }
  }

  onDeleteConversation(event: Event, conversationId: string): void {
    console.log('🗑️ [CONV-LIST] onDeleteConversation called:', conversationId);
    event.stopPropagation(); // Prevent selecting the conversation
    event.preventDefault();

    // Encontrar a conversa para mostrar no modal
    const conversation = this.conversations.find(c => c.conversation_id === conversationId);
    if (conversation) {
      this.conversationToDelete = conversation;
      this.showDeleteModal = true;
    }
  }

  /**
   * 🔥 NOVO: Clona uma conversa com todas as mensagens e agentes instanciados
   */
  onCloneConversation(event: Event, conversationId: string): void {
    console.log('📋 [CONV-LIST] onCloneConversation called:', conversationId);
    event.stopPropagation();
    event.preventDefault();

    // Chamar API de clone
    fetch(`/api/conversations/${conversationId}/clone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to clone: ${response.statusText}`);
        }
        return response.json();
      })
      .then(data => {
        console.log('✅ [CONV-LIST] Conversa clonada:', data);

        // Recarregar lista de conversas
        this.loadConversations();

        // Emitir evento com o novo conversation_id para selecionar
        if (data.cloned_conversation?.conversation_id) {
          this.conversationCloned.emit(data.cloned_conversation.conversation_id);
        }
      })
      .catch(error => {
        console.error('❌ [CONV-LIST] Erro ao clonar conversa:', error);
        alert('Erro ao clonar conversa. Por favor, tente novamente.');
      });
  }

  /**
   * 🔥 NOVO: Fecha modal de confirmação de delete
   */
  closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.conversationToDelete = null;
  }

  /**
   * 🔥 NOVO: Confirma e executa a exclusão da conversa
   */
  confirmDeleteConversation(): void {
    if (!this.conversationToDelete) return;

    const conversationId = this.conversationToDelete.conversation_id;
    console.log('🗑️ [CONV-LIST] Confirming delete for:', conversationId);

    this.closeDeleteModal();
    this.conversationDeleted.emit(conversationId);
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


  /**
   * 🔥 NOVO: Handler para drag & drop
   * Reordena conversas localmente e persiste no backend
   */
  onDrop(event: CdkDragDrop<ConversationSummary[]>): void {
    if (event.previousIndex === event.currentIndex) {
      return; // Nenhuma mudança
    }

    console.log(`🔄 [DRAG-DROP] Movendo conversa de ${event.previousIndex} para ${event.currentIndex}`);

    // Reordenar array localmente
    moveItemInArray(this.conversations, event.previousIndex, event.currentIndex);

    // Persistir nova ordem no backend
    this.saveConversationOrder();
  }

  /**
   * 🔥 NOVO: Salva ordem das conversas no MongoDB
   * Envia um array com conversation_id e display_order para cada conversa
   */
  private saveConversationOrder(): void {
    // Construir array de updates com base na posição atual
    const orderUpdates = this.conversations.map((conv, index) => ({
      conversation_id: conv.conversation_id,
      display_order: index
    }));

    console.log('💾 [SAVE-ORDER] Salvando ordem das conversas:', orderUpdates);

    // Chamar serviço para atualizar ordem no backend
    this.conversationService.updateConversationOrder(orderUpdates).subscribe({
      next: (response) => {
        console.log('✅ [SAVE-ORDER] Ordem salva com sucesso:', response);
      },
      error: (error) => {
        console.error('❌ [SAVE-ORDER] Erro ao salvar ordem:', error);
        // Recarregar conversas para restaurar ordem original
        this.loadConversations();
        alert('Erro ao salvar ordem das conversas. Ordem restaurada.');
      }
    });
  }
}
