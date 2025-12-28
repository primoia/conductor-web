import { Component, OnInit, OnDestroy, HostListener, Output, EventEmitter, Input, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { Subscription } from 'rxjs';
import { ChatMessagesComponent } from './components/chat-messages/chat-messages.component';
import { ChatInputComponent } from './components/chat-input/chat-input.component';
import { StatusIndicatorComponent } from './components/status-indicator/status-indicator.component';
import { ConductorApiService } from './services/conductor-api.service';
import { Message, ChatState, ChatMode, ApiConfig, ConductorConfig } from './models/chat.models';
import { ScreenplayService } from '../../services/screenplay/screenplay.service';
import { AgentService, AgentContext, ChatMessage } from '../../services/agent.service';
import { AgentExecutionService, AgentExecutionState } from '../../services/agent-execution';
import { PersonaEditService } from '../../services/persona-edit.service';
import { PersonaEditModalComponent } from '../persona-edit-modal/persona-edit-modal.component';
import { SpeechRecognitionService } from './services/speech-recognition.service';
import { MessageHandlingService, MessageParams, MessageHandlingCallbacks } from './services/message-handling.service';
import { ModalStateService, ModalType } from './services/modal-state.service';
import { environment } from '../../../environments/environment';
import { ConversationService, Conversation, AgentInfo as ConvAgentInfo, Message as ConvMessage } from '../../services/conversation.service';
import { NavigationStateService } from '../../services/navigation-state.service';
import { ConversationListComponent } from '../conversation-list/conversation-list.component';

const DEFAULT_CONFIG: ConductorConfig = {
  api: {
    baseUrl: '',
    endpoint: '/execute',
    streamEndpoint: '/api/v1/stream-execute',
    apiKey: 'test-api-key-123',
    timeout: 1800000, // 30 minutes timeout for long-running AI operations
    retryAttempts: 3
  },
  mode: 'ask',
  welcomeMessage: 'Olá! Sou o Conductor Chat. Posso executar agentes de IA para você.',
  autoScroll: true,
  maxMessages: 100
};

@Component({
  selector: 'app-conductor-chat',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DragDropModule,
    ChatMessagesComponent,
    ChatInputComponent,
    StatusIndicatorComponent,
    PersonaEditModalComponent,
    ConversationListComponent
  ],
  template: `
    <div class="conductor-chat-container">
      <!-- 🔥 NOVO: Sidebar com lista de conversas - TRÊS ESTADOS -->
      <div
        class="conversation-sidebar"
        [class.hidden]="sidebarState === 'hidden'"
        [class.compact]="sidebarState === 'compact'"
        [class.full]="sidebarState === 'full'"
        [class.conversation-modal-active]="sidebarState === 'full' && isMobile()"
        *ngIf="environment.features?.useConversationModel">

        <!-- Close button para mobile modal (apenas quando full) -->
        <button
          class="close-conversation-sidebar"
          *ngIf="sidebarState === 'full' && isMobile()"
          (click)="onToggleSidebarClick()"
          title="Fechar Conversas">
          ✕
        </button>

        <!-- VERSÃO COMPACTA (conversation-dock) -->
        <div class="conversation-dock" *ngIf="sidebarState === 'compact'">
          <!-- Botão ABRIR ROTEIRO no topo -->
          <button
            class="dock-action-btn open-screenplay-btn"
            (click)="onOpenScreenplayClick()"
            title="Abrir roteiro">
            📝
          </button>

          <div class="dock-separator"></div>

          <!-- Botão CRIAR NOVA CONVERSA -->
          <button
            class="dock-action-btn add-conversation-btn"
            [disabled]="!activeScreenplayId"
            (click)="createNewConversationWithoutExpanding()"
            [title]="activeScreenplayId ? 'Criar nova conversa' : 'Selecione um roteiro primeiro'">
            ➕
          </button>

          <div class="dock-separator"></div>

          <!-- Lista compacta de conversas (scrollável com drag & drop) -->
          <div
            class="dock-conversations-list"
            cdkDropList
            (cdkDropListDropped)="onConversationDrop($event)">
            <div
              *ngFor="let conv of conversations"
              class="dock-item-wrapper"
              cdkDrag>
              <!-- Drag preview -->
              <div class="dock-item-preview" *cdkDragPreview>
                {{ getConversationInitial(conv.title) }}
              </div>
              <!-- Placeholder durante drag -->
              <div class="dock-item-placeholder" *cdkDragPlaceholder></div>

              <!-- Drag handle (invisível mas ocupa espaço) -->
              <div class="dock-drag-handle" cdkDragHandle title="Arrastar para reordenar"></div>

              <!-- Botão clicável -->
              <button
                class="dock-conversation-item"
                [class.active]="conv.conversation_id === activeConversationId"
                [title]="conv.title"
                (click)="onSelectConversation(conv.conversation_id)">
                {{ getConversationInitial(conv.title) }}
              </button>
            </div>
          </div>
        </div>

        <!-- 🔥 NOVO: FABs quando hidden - mobile portrait -->
        <div class="mobile-fabs" *ngIf="sidebarState === 'hidden' && isMobile()">
          <!-- FAB Abrir Roteiro -->
          <button
            class="mobile-fab screenplay-fab"
            (click)="onOpenScreenplayClick()"
            title="Abrir roteiro">
            📝
          </button>

          <!-- FAB Mostrar Conversas -->
          <button
            class="mobile-fab conversation-fab"
            (click)="showCompactConversations()"
            title="Mostrar conversas">
            💬
          </button>
        </div>

        <!-- FAB (Floating Action Button) quando hidden - desktop/tablet -->
        <button
          *ngIf="sidebarState === 'hidden' && !isMobile()"
          class="conversation-fab"
          (click)="showCompactConversations()"
          title="Mostrar conversas">
          💬
        </button>

        <!-- VERSÃO COMPLETA (lista expandida) -->
        <div class="conversation-full" *ngIf="sidebarState === 'full'">
          <!-- Lista de conversas -->
          <app-conversation-list
            [activeConversationId]="activeConversationId"
            [screenplayId]="activeScreenplayId"
            [agentInstances]="contextualAgents"
            (conversationSelected)="onSelectConversation($event)"
            (conversationCreated)="onCreateNewConversation()"
            (conversationDeleted)="onDeleteConversation($event)"
            (contextEditRequested)="onContextEditRequested($event)">
          </app-conversation-list>
        </div>
      </div>

      <!-- Chat principal -->
      <div class="conductor-chat">
        <div class="chat-header">
        <div class="header-actions-left">
          <div class="selected-agent" *ngIf="selectedAgentName">
            <app-status-indicator
              [isConnected]="chatState.isConnected"
              [isLoading]="chatState.isLoading"
            />
            <span class="agent-emoji">{{ selectedAgentEmoji }}</span>
            <span class="agent-name">{{ selectedAgentName }}</span>
          </div>
        </div>
        <div class="header-center">
        </div>
        <div class="header-actions-right">
          <!-- Info button removed - use dock ? button instead -->
        </div>
      </div>

      <!-- Persona Modal -->
      <div class="modal-backdrop" *ngIf="modalStateService.isOpen('personaModal')" (click)="togglePersonaModal()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h4>📋 Contexto do Agente</h4>
            <button class="close-btn" (click)="togglePersonaModal()">✕</button>
          </div>
          <div class="modal-body">
            <div class="context-item">
              <div class="context-label">
                👤 Persona
                <span class="edited-indicator" *ngIf="isPersonaEdited">(editada)</span>
                <button class="restore-btn" *ngIf="isPersonaEdited" (click)="restorePersona()">
                  🔄 Restaurar original
                </button>
              </div>
              <div class="context-content">{{ getDisplayPersona() }}</div>
            </div>
            <div class="context-item">
              <div class="context-label">📜 Procedimento</div>
              <div class="context-content">{{ activeAgentContext?.operating_procedure }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Persona Edit Modal -->
      <app-persona-edit-modal
        [isVisible]="modalStateService.isOpen('personaEditModal')"
        [instanceId]="activeAgentId"
        [agentId]="selectedAgentDbId"
        [currentPersona]="activeAgentContext?.persona || ''"
        (closeModal)="closePersonaEditModal()"
        (personaSaved)="onPersonaSaved($event)">
      </app-persona-edit-modal>

      <!-- CWD Definition Modal -->
      <div class="modal-backdrop" *ngIf="modalStateService.isOpen('cwdModal')" (click)="closeCwdModal()">
        <div class="modal-content cwd-modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h4>📁 Definir Diretório de Trabalho</h4>
            <button class="close-btn" (click)="closeCwdModal()">✕</button>
          </div>
          <div class="modal-body">
            <p class="modal-description">
              Configure o diretório onde o agente executará os comandos.
            </p>
            <div class="cwd-input-group">
              <input
                type="text"
                class="cwd-input"
                [(ngModel)]="tempCwd"
                placeholder="/mnt/ramdisk/meu-projeto"
                (keydown.enter)="saveCwd()">
              <button class="save-btn" (click)="saveCwd()">Salvar</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Context Editor Modal -->
      <div class="modal-backdrop" *ngIf="modalStateService.isOpen('contextEditorModal')" (click)="closeContextEditorModal()">
        <div class="modal-content context-editor-modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h4>📋 Editar Contexto da Conversa</h4>
            <button class="close-btn" (click)="closeContextEditorModal()">✕</button>
          </div>
          <div class="modal-body">
            <p class="modal-description">
              Descreva o problema, bug ou feature desta conversa para dar contexto aos agentes.
            </p>

            <!-- Upload arquivo -->
            <div class="context-upload-section">
              <button class="upload-btn" (click)="openContextUpload()">
                📁 Upload arquivo .md
              </button>
            </div>

            <!-- Editor de Contexto -->
            <textarea
              class="context-textarea-modal"
              [(ngModel)]="conversationContext"
              placeholder="Descreva o problema, bug ou feature desta conversa em Markdown...

Exemplo:
## Bug: Login OAuth
O sistema não consegue autenticar usuários via Google OAuth.
Erro: 'invalid_token' na response..."
              rows="12">
            </textarea>

            <!-- Preview do Contexto -->
            <div class="context-preview-section" *ngIf="conversationContext">
              <h5>Preview:</h5>
              <div class="markdown-content" [innerHTML]="renderMarkdown(conversationContext)"></div>
            </div>

            <!-- Ações -->
            <div class="modal-actions">
              <button class="btn-primary" (click)="saveConversationContext()">
                💾 Salvar Contexto
              </button>
              <button class="btn-secondary" (click)="closeContextEditorModal()">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Input de Upload (Hidden) -->
      <input
        #contextFileInput
        type="file"
        accept=".md"
        style="display: none;"
        (change)="onContextFileSelected($event)"
      />

      <div class="chat-body">
        <!-- CWD Warning Banner -->
        <div class="cwd-warning-banner" *ngIf="showCwdWarning()">
          <div class="warning-content">
            <span class="warning-icon">⚠️</span>
            <span class="warning-text">Diretório de trabalho não definido.</span>
            <button class="define-cwd-btn" (click)="openCwdDefinitionModal()">
              Definir agora
            </button>
          </div>
        </div>

        <div class="chat-body-content">
          <!-- Agent Launcher Dock (movido para a ESQUERDA) -->
          <div class="agent-launcher-dock">
            <!-- Fixed Action Buttons at Top -->
            <button
              class="dock-action-btn add-agent-btn"
              (click)="onAddAgentClick()"
              title="Adicionar Agente">
              ➕
            </button>
            <button
              class="dock-action-btn delete-agent-btn"
              [disabled]="!activeAgentId"
              (click)="onDeleteAgentClick()"
              title="Excluir Agente Selecionado">
              🗑️
            </button>

            <!-- Toggle buttons moved to Settings menu (⚙️) -->
            <!--
            <button
              class="dock-action-btn toggle-sidebar-btn"
              (click)="onToggleSidebarClick()"
              [title]="isSidebarVisible ? 'Esconder conversas' : 'Mostrar conversas'"
              *ngIf="false">
              {{ isSidebarVisible ? '◀' : '▶' }}
            </button>

            <button
              class="dock-action-btn toggle-first-column-btn"
              (click)="onToggleFirstColumnClick()"
              [title]="firstColumnVisible ? 'Esconder menu lateral' : 'Mostrar menu lateral'"
              *ngIf="false">
              {{ firstColumnVisible ? '◀' : '▶' }}
            </button>
            -->

            <!-- Settings Button -->
            <button
              class="dock-action-btn settings-btn"
              [disabled]="!activeAgentId"
              (click)="toggleAgentOptionsMenu($event)"
              title="Opções do agente">
              ⚙️
            </button>

            <!-- 🔥 NOVO: Botão de Controle da Conversation Sidebar -->
            <button
              class="dock-action-btn conversation-toggle-btn"
              (click)="onToggleSidebarClick()"
              [title]="getConversationToggleTitle()"
              *ngIf="environment.features?.useConversationModel">
              {{ getConversationToggleIcon() }}
            </button>

            <!-- Separator -->
            <div class="dock-separator"></div>

            <!-- Agent List (scrollable) -->
            <div
              class="dock-agents-list"
              cdkDropList
              (cdkDropListDropped)="onAgentDrop($event)">
              <div
                *ngFor="let agent of contextualAgents"
                class="dock-item-wrapper"
                cdkDrag>
                <!-- Drag preview -->
                <div class="dock-item-preview" *cdkDragPreview>
                  {{ agent.emoji }}
                </div>
                <!-- Placeholder durante drag -->
                <div class="dock-item-placeholder" *cdkDragPlaceholder></div>

                <!-- Drag handle (invisível mas ocupa espaço) -->
                <div class="dock-drag-handle" cdkDragHandle title="Arrastar para reordenar"></div>

                <!-- Botão clicável -->
                <button
                  class="dock-item"
                  [class.active]="activeAgentId === agent.id"
                  [title]="agent.definition?.description || ''"
                  (click)="onDockAgentClick(agent)">
                  {{ agent.emoji }}
                </button>
              </div>
            </div>

            <!-- Agent Options Menu -->
            <div
              *ngIf="modalStateService.isOpen('agentOptionsMenu')"
              class="agent-options-menu"
              [style.top.px]="menuPosition.top"
              [style.left.px]="menuPosition.left">
              <button class="menu-item" (click)="viewAgentContext()">
                📋 Ver Contexto
              </button>
              <button class="menu-item" (click)="editPersona()">
                ✏️ Editar Persona
              </button>
              <button class="menu-item" (click)="editAgentCwd()">
                📁 Editar diretório
              </button>
              <button
                class="menu-item"
                (click)="onToggleSidebarClick()"
                *ngIf="environment.features?.useConversationModel">
                {{ sidebarState === 'hidden' ? '▶' : sidebarState === 'compact' ? '⇄' : '◀' }}
                {{ sidebarState === 'hidden' ? 'Mostrar' : sidebarState === 'compact' ? 'Expandir' : 'Compactar' }} Conversas
              </button>
              <button
                class="menu-item"
                (click)="onToggleFirstColumnClick()">
                {{ firstColumnVisible ? '◀' : '▶' }} {{ firstColumnVisible ? 'Esconder' : 'Mostrar' }} Menu Lateral
              </button>
              <button
                class="menu-item"
                (click)="toggleDockInfoModal()">
                ❓ Sobre a Dock de Agentes
              </button>
            </div>
          </div>

          <!-- Chat Messages (após o dock) -->
          <app-chat-messages
            [messages]="chatState.messages"
            [isLoading]="chatState.isLoading"
            [progressMessage]="progressMessage"
            [streamingMessage]="streamingMessage"
            [autoScroll]="config.autoScroll"
            (messageDeleted)="onMessageDeleted($event)"
          />
        </div>
      </div>

      <!-- Resize handle entre chat-messages e chat-input -->
      <div
        class="resize-handle"
        (mousedown)="onResizeStart($event)"
        title="Arraste para redimensionar o editor"
      >
        <div class="resize-handle-bar"></div>
      </div>

      <!-- CHAT INPUT AREA: Apenas editor, altura redimensionável -->
      <div class="chat-input-area" [style.height]="chatInputHeight" (click)="focusEditorInput()">
        <!-- Block input if no agent is selected or if agent has no cwd defined -->
        <div class="input-blocked-overlay" *ngIf="isInputBlocked()">
          <div class="blocked-message">
            <span class="blocked-icon">{{ getBlockMessage().icon }}</span>
            <span>{{ getBlockMessage().text }}</span>
            <button
              *ngIf="getBlockMessage().showButton"
              class="blocked-btn"
              (click)="openCwdDefinitionModal(); $event.stopPropagation()">
              Definir agora
            </button>
          </div>
        </div>

        <app-chat-input
          [isLoading]="chatState.isLoading"
          (messageContentChanged)="onMessageContentChanged($event)"
          (enterPressed)="sendMessage()"
          (contentHeightChanged)="onContentHeightChanged($event)"
        />
      </div>

      <!-- CHAT FOOTER: Apenas controls, SEMPRE 60px, NUNCA se move -->
      <div class="chat-footer">
        <div class="controls-row">
          <select
            id="provider-select"
            [(ngModel)]="selectedProvider"
            class="provider-dropdown"
            [disabled]="chatState.isLoading"
            title="Selecione o AI Provider para esta mensagem"
          >
            <option value="">Padrão</option>
            <option value="claude">Claude</option>
            <option value="gemini">Gemini</option>
            <option value="cursor-agent">Cursor Agent</option>
          </select>
          <!-- Send button -->
          <button
            class="icon-button send-button"
            (click)="sendMessage()"
            [disabled]="chatState.isLoading || isEditorEmpty()"
            [title]="chatState.isLoading ? 'Enviando...' : 'Enviar mensagem'"
          >
            <span *ngIf="!chatState.isLoading">⬆️</span>
            <span *ngIf="chatState.isLoading">⏳</span>
          </button>
          <!-- Mic button -->
          <button
            class="icon-button mic-button"
            [class.recording]="isRecording"
            (click)="toggleRecording()"
            [disabled]="chatState.isLoading || !speechSupported"
            [title]="getMicTitle()"
          >
            {{ isRecording ? '🔴' : '🎤' }}
          </button>
          <!-- Mode toggle switch -->
          <button
            class="icon-button mode-toggle"
            [class.agent-mode]="currentMode === 'agent'"
            (click)="toggleMode()"
            [disabled]="chatState.isLoading"
            [title]="currentMode === 'ask' ? 'Modo Ask (consulta)' : 'Modo Agent (modificar)'"
          >
            {{ currentMode === 'ask' ? '💬' : '🤖' }}
          </button>
        </div>
      </div>

      <!-- Dock Info Modal (merged with header info) -->
      <div class="modal-backdrop" *ngIf="modalStateService.isOpen('dockInfoModal')" (click)="toggleDockInfoModal()">
        <div class="modal-content dock-info-modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h4>💬 Conductor Chat - Ajuda</h4>
            <button class="close-btn" (click)="toggleDockInfoModal()">✕</button>
          </div>
          <div class="modal-body">
            <h5>Modos de Chat</h5>
            <ul>
              <li><strong>💬 Ask:</strong> Apenas perguntas e respostas</li>
              <li><strong>🤖 Agent:</strong> Pode modificar o roteiro</li>
            </ul>

            <h5>Controles</h5>
            <ul>
              <li><strong>Enter:</strong> Enviar mensagem</li>
              <li><strong>Shift+Enter:</strong> Nova linha</li>
              <li><strong>🎤:</strong> Gravação de voz</li>
            </ul>

            <h5>Indicadores</h5>
            <ul>
              <li><strong>🟢 Verde:</strong> Conectado</li>
              <li><strong>🟠 Laranja:</strong> Processando</li>
              <li><strong>🔴 Vermelho:</strong> Desconectado</li>
            </ul>

            <h5>📚 Dock de Agentes</h5>
            <p>A dock lateral exibe todos os agentes instanciados no roteiro.</p>

            <h5>Como Usar a Dock</h5>
            <ul>
              <li><strong>Clique</strong> em um emoji para ver o histórico do agente</li>
              <li><strong>Botões fixos no topo:</strong>
                <ul>
                  <li>➕ Adicionar novo agente</li>
                  <li>🗑️ Excluir agente selecionado</li>
                  <li>⚙️ Opções do agente ativo</li>
                  <li>? Informações e ajuda</li>
                </ul>
              </li>
              <li><strong>Borda roxa:</strong> agente ativo</li>
            </ul>

            <div class="nerd-section">
              <h5>🤓 Estatísticas Nerds</h5>
              <div class="nerd-stats">
                <div class="stat-item">
                  <span class="stat-label">Total de agentes:</span>
                  <span class="stat-value">{{ contextualAgents.length }}</span>
                </div>
                <div class="stat-item" *ngIf="activeAgentId">
                  <span class="stat-label">Instance ID:</span>
                  <code class="stat-value">{{ activeAgentId }}</code>
                </div>
                <div class="stat-item" *ngIf="activeAgentId">
                  <span class="stat-label">Agent ID:</span>
                  <code class="stat-value">{{ selectedAgentDbId || 'N/A' }}</code>
                </div>
                <div class="stat-item" *ngIf="activeAgentId">
                  <span class="stat-label">Nome:</span>
                  <span class="stat-value">{{ selectedAgentEmoji }} {{ selectedAgentName }}</span>
                </div>
                <div class="stat-item" *ngIf="activeAgentId">
                  <span class="stat-label">Diretório:</span>
                  <code class="stat-value">{{ activeAgentCwd || 'não definido' }}</code>
                </div>
                <div class="stat-item" *ngIf="activeAgentId">
                  <span class="stat-label">Persona editada:</span>
                  <span class="stat-value">{{ isPersonaEdited ? 'Sim' : 'Não' }}</span>
                </div>
                <div class="stat-item" *ngIf="contextualAgents.length > 0">
                  <span class="stat-label">Lista de IDs:</span>
                  <div class="stat-list">
                    <code *ngFor="let agent of contextualAgents" class="stat-list-item">
                      {{ agent.emoji }} {{ agent.id }}
                    </code>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Header Info Modal removed - use dock ? button instead -->
      </div> <!-- .conductor-chat -->
    </div> <!-- .conductor-chat-container -->
  `,
  styles: [`
    /* 🔥 NOVO: Container principal com sidebar */
    .conductor-chat-container {
      display: flex;
      /* height: 100vh; - REMOVIDO: permite que flex do pai (.chat-panel) controle a altura */
      height: 100%; /* Usa 100% da altura do pai */
      overflow: hidden;
    }

    /* 🔥 NOVO: Sidebar com lista de conversas - TRÊS ESTADOS */
    .conversation-sidebar {
      flex-shrink: 0;
      background: #f8f9fa;
      border-right: 1px solid #dee2e6;
      overflow: hidden;
      transition: width 0.3s ease, min-width 0.3s ease, max-width 0.3s ease, opacity 0.3s ease;
    }

    /* Estado: HIDDEN - Completamente escondida */
    .conversation-sidebar.hidden {
      width: 0;
      min-width: 0;
      max-width: 0;
      opacity: 0;
      border-right: none;
      overflow: hidden;
    }

    /* Estado: COMPACT - Barra de botões compacta (60px) */
    .conversation-sidebar.compact {
      width: 60px;
      min-width: 60px;
      max-width: 60px;
      background: #f0f3f7;
      border-right: 1px solid #e1e4e8;
    }

    /* Estado: FULL - Expandida/larga (280px) */
    .conversation-sidebar.full {
      width: 280px;
      min-width: 240px;
      max-width: 350px;
      background: #f8f9fa;
      border-right: 1px solid #dee2e6;
    }

    /* 🔥 NOVO: Conversation Dock - Versão compacta (similar à agent-launcher-dock) */
    .conversation-dock {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 12px 0;
      overflow: hidden;
    }

    .dock-conversations-list {
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
      overflow-x: hidden;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 0;
      width: 100%;
      scrollbar-width: thin;
      scrollbar-color: #d1d5db #f0f3f7;
    }

    .dock-conversations-list::-webkit-scrollbar {
      width: 4px;
    }

    .dock-conversations-list::-webkit-scrollbar-track {
      background: transparent;
    }

    .dock-conversations-list::-webkit-scrollbar-thumb {
      background: #d1d5db;
      border-radius: 2px;
    }

    .dock-conversations-list::-webkit-scrollbar-thumb:hover {
      background: #9ca3af;
    }

    .dock-conversation-item {
      width: 44px;
      height: 44px;
      border-radius: 8px;
      background: #ffffff;
      border: 1px solid #e1e4e8;
      cursor: pointer;
      font-size: 18px;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      position: relative;
      overflow: hidden;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
      color: #4a5568;
    }

    .dock-conversation-item:hover {
      background: #f7fafc;
      border-color: #a8b9ff;
      transform: scale(1.1);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .dock-conversation-item.active {
      background: #ebf4ff;
      border-color: #7c9ff6;
      box-shadow: 0 0 0 2px rgba(124, 159, 246, 0.3);
      transform: scale(1.05);
      color: #2c5aa0;
    }

    .dock-action-btn {
      width: 44px;
      height: 44px;
      border-radius: 8px;
      background: #ffffff;
      border: 1px solid #e1e4e8;
      cursor: pointer;
      font-size: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
      flex-shrink: 0;
    }

    .dock-action-btn:hover:not(:disabled) {
      background: #f7fafc;
      border-color: #a8b9ff;
      transform: scale(1.1);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .dock-action-btn:active:not(:disabled) {
      transform: scale(0.95);
    }

    .dock-action-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .dock-action-btn.open-screenplay-btn {
      background: #f3e8ff;
      border-color: #d8b4fe;
      color: #9333ea;
      font-size: 18px;
    }

    .dock-action-btn.open-screenplay-btn:hover {
      background: #e9d5ff;
      border-color: #c084fc;
      transform: scale(1.1);
    }

    .dock-action-btn.add-conversation-btn {
      background: #f0fdf4;
      border-color: #86efac;
      color: #16a34a;
    }

    .dock-action-btn.add-conversation-btn:hover:not(:disabled) {
      background: #dcfce7;
      border-color: #4ade80;
      transform: scale(1.1);
    }

    .dock-separator {
      width: 32px;
      height: 1px;
      background: #e1e4e8;
      margin: 8px 0;
      flex-shrink: 0;
    }

    /* 🔥 NOVO: FAB (Floating Action Button) quando sidebar está hidden */
    .conversation-fab {
      position: fixed;
      left: 16px;
      bottom: 80px;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border: none;
      box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
      cursor: pointer;
      font-size: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      color: white;
    }

    .conversation-fab:hover {
      transform: scale(1.1);
      box-shadow: 0 6px 24px rgba(102, 126, 234, 0.5);
    }

    .conversation-fab:active {
      transform: scale(0.95);
    }

    /* Animação de entrada do FAB */
    @keyframes fabSlideIn {
      from {
        transform: translateX(-100px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    .conversation-fab {
      animation: fabSlideIn 0.3s ease-out;
    }

    /* 🔥 NOVO: Mobile FABs container - múltiplos botões em mobile portrait */
    .mobile-fabs {
      position: fixed;
      left: 16px;
      bottom: 80px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      z-index: 1000;
      animation: fabSlideIn 0.3s ease-out;
    }

    .mobile-fab {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      border: none;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      cursor: pointer;
      font-size: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      color: white;
    }

    .mobile-fab:hover {
      transform: scale(1.1);
      box-shadow: 0 6px 24px rgba(0, 0, 0, 0.4);
    }

    .mobile-fab:active {
      transform: scale(0.95);
    }

    /* Estilo específico para FAB de roteiro */
    .mobile-fab.screenplay-fab {
      background: linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%);
      color: #9333ea;
      border: 2px solid #d8b4fe;
    }

    .mobile-fab.screenplay-fab:hover {
      background: linear-gradient(135deg, #e9d5ff 0%, #d8b4fe 100%);
      box-shadow: 0 6px 24px rgba(147, 51, 234, 0.4);
    }

    /* Estilo específico para FAB de conversas */
    .mobile-fab.conversation-fab {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }

    .mobile-fab.conversation-fab:hover {
      box-shadow: 0 6px 24px rgba(102, 126, 234, 0.5);
    }

    /* 🔥 NOVO: Versão Full com Header de Controles */
    .conversation-full {
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
    }

    .conversation-full app-conversation-list {
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }

    /* Chat principal */
    .conductor-chat {
      display: flex;
      flex-direction: column;
      flex: 1;
      /* height: 100vh; - REMOVIDO: permite que flex do pai controle a altura */
      background: #fafbfc;
      border-left: 1px solid #e1e4e8;
    }

    .chat-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      background: #ffffff;
      overflow: hidden;
      min-height: 0;
    }

    .chat-body-content {
      flex: 1;
      display: flex;
      flex-direction: row;
      overflow: hidden;
    }

    .chat-body-content app-chat-messages {
      flex: 1;
      min-width: 0;
    }

    .chat-body-content .agent-launcher-dock {
      flex-shrink: 0;
      width: 60px;
      background: transparent;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      min-height: 0;
      height: 100%;
      position: relative;
      padding: 12px 0;
      order: -1; /* Força ficar à esquerda no flexbox */
    }

    .dock-agents-list {
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
      overflow-x: hidden;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 0;
    }

    .dock-agents-list::-webkit-scrollbar {
      width: 4px;
    }

    .dock-agents-list::-webkit-scrollbar-track {
      background: transparent;
    }

    .dock-agents-list::-webkit-scrollbar-thumb {
      background: #d1d5db;
      border-radius: 2px;
    }

    .dock-agents-list::-webkit-scrollbar-thumb:hover {
      background: #9ca3af;
    }

    .chat-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 20px;
      background: #f8f9fa;
      color: #2c3e50;
      border-bottom: 1px solid #e1e4e8;
      flex-shrink: 0;
      gap: 12px;
      position: relative;
    }

    .header-actions-left {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
    }

    .header-center {
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .header-actions-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .header-icon-btn {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      background: #ffffff;
      border: 1px solid #e1e4e8;
      cursor: pointer;
      font-size: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', 'Segoe UI Symbol', 'Android Emoji', 'EmojiSymbols' !important;
    }

    .header-icon-btn:hover:not(:disabled) {
      background: #f8f9fa;
      border-color: #d0d7de;
      transform: translateY(-1px);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .header-icon-btn:active:not(:disabled) {
      transform: translateY(0);
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }

    .header-icon-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .add-agent-btn {
      background: #e8f5e9;
      border-color: #a5d6a7;
    }

    .add-agent-btn:hover:not(:disabled) {
      background: #c8e6c9;
      border-color: #81c784;
    }

    .delete-agent-btn {
      background: #ffebee;
      border-color: #ffcdd2;
    }

    .delete-agent-btn:hover:not(:disabled) {
      background: #ffcdd2;
      border-color: #ef9a9a;
    }

    .toggle-sidebar-btn {
      background: #e3f2fd;
      border-color: #90caf9;
    }

    .toggle-sidebar-btn:hover {
      background: #bbdefb;
      border-color: #64b5f6;
    }

    .toggle-first-column-btn {
      background: #f3e8ff;
      border-color: #d8b4fe;
      color: #7c3aed;
      font-weight: 700;
    }

    .toggle-first-column-btn:hover {
      background: #e9d5ff;
      border-color: #a78bfa;
    }

    .settings-btn {
      background: #e3f2fd;
      border-color: #bbdefb;
    }

    .settings-btn:hover:not(:disabled) {
      background: #bbdefb;
      border-color: #90caf9;
    }

    /* 🔥 NOVO: Botão de controle da conversation sidebar */
    .conversation-toggle-btn {
      background: #f3e8ff;
      border-color: #d8b4fe;
    }

    .conversation-toggle-btn:hover:not(:disabled) {
      background: #e9d5ff;
      border-color: #c084fc;
    }

    /* header-info-btn removed - use dock ? button instead */

    .selected-agent {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 500;
      color: #424242;
    }

    .agent-emoji {
      font-size: 20px;
    }

    .agent-name {
      color: #37474f;
      font-weight: 500;
    }

    /* Modal styles */
    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .modal-content {
      background: white;
      border-radius: 8px;
      max-width: 600px;
      width: 90%;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid #e1e4e8;
    }

    .modal-header h4 {
      margin: 0;
      font-size: 18px;
      color: #2c3e50;
    }

    .close-btn {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: #6b7280;
      padding: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: background 0.2s;
    }

    .close-btn:hover {
      background: #f3f4f6;
    }

    .modal-body {
      padding: 20px;
      overflow-y: auto;
    }

    .context-item {
      margin-bottom: 20px;
    }

    .context-item:last-child {
      margin-bottom: 0;
    }

    .context-label {
      font-size: 14px;
      font-weight: 600;
      color: #5a67d8;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .edited-indicator {
      font-size: 12px;
      color: #28a745;
      font-weight: 500;
      background: #d4edda;
      padding: 2px 6px;
      border-radius: 4px;
    }

    .restore-btn {
      background: #ffc107;
      color: #212529;
      border: none;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      margin-left: auto;
    }

    .restore-btn:hover {
      background: #e0a800;
      transform: translateY(-1px);
    }

    .context-content {
      font-size: 13px;
      color: #4a5568;
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-word;
      background: #f7fafc;
      padding: 12px;
      border-radius: 6px;
      border: 1px solid #e1e4e8;
    }

    /* Resize Handle */
    .resize-handle {
      height: 12px;
      cursor: ns-resize;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #fafbfc;
      border-top: 1px solid #e1e4e8;
      border-bottom: 1px solid #e1e4e8;
      user-select: none;
      flex-shrink: 0;
      z-index: 10;
    }

    .resize-handle:hover {
      background: #f0f3f7;
    }

    .resize-handle:hover .resize-handle-bar {
      background: #a8b9ff;
    }

    .resize-handle-bar {
      width: 40px;
      height: 3px;
      background: #e1e4e8;
      border-radius: 2px;
      transition: background 0.2s;
    }

    .resize-handle.resizing {
      background: #e8eaf6;
    }

    .resize-handle.resizing .resize-handle-bar {
      background: #667eea;
    }

    /* ============================================ */
    /* CHAT INPUT AREA - Redimensionável, APENAS editor */
    /* ============================================ */
    .chat-input-area {
      background: white;
      flex-shrink: 0; /* NEVER compress - maintains set height */
      min-height: 80px; /* Minimum: ~2-3 lines of text */
      max-height: 400px; /* Maximum: prevents taking too much space */
      display: flex;
      flex-direction: column;
      position: relative;
      overflow: hidden; /* CRITICAL: Prevents content from pushing outside bounds */
      border-top: 1px solid #e1e4e8;
    }

    /* ============================================ */
    /* CHAT FOOTER - SEMPRE 60px, NUNCA redimensiona */
    /* ============================================ */
    .chat-footer {
      background: white;
      border-top: 1px solid #e8eaed;
      flex-shrink: 0; /* NEVER compress */
      height: 60px; /* ALWAYS 60px - NEVER changes */
      min-height: 60px;
      max-height: 60px;
      display: flex;
      flex-direction: column;
      position: relative;
      z-index: 10; /* Always on top */
    }

    /* ============================================ */
    /* CONTROLS ROW - Dentro do footer fixo */
    /* ============================================ */
    .controls-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      background: white;
      height: 100%; /* Fill footer height (60px) */
    }

    /* Provider dropdown */
    .provider-dropdown {
      flex: 1;
      padding: 8px 12px;
      border: none;
      background-color: #f7fafc;
      color: #2d3748;
      font-size: 13px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      border-radius: 6px;
      cursor: pointer;
      transition: background-color 0.2s ease;
      outline: none;
      min-width: 100px;
    }

    .provider-dropdown:hover:not(:disabled) {
      background-color: #e2e8f0;
    }

    .provider-dropdown:focus {
      background-color: #e2e8f0;
    }

    .provider-dropdown:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Icon buttons */
    .icon-button {
      width: 36px;
      height: 36px;
      padding: 0;
      border: none;
      border-radius: 50%;
      font-size: 16px;
      cursor: pointer;
      transition: all 0.2s;
      outline: none;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .mode-toggle {
      background: #e3f2fd;
      color: #1976d2;
      border: 1px solid #bbdefb;
    }

    .mode-toggle:hover:not(:disabled) {
      background: #bbdefb;
      border-color: #90caf9;
      transform: scale(1.1);
    }

    .mode-toggle.agent-mode {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: 1px solid #5a67d8;
    }

    .mode-toggle.agent-mode:hover:not(:disabled) {
      background: linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%);
      transform: scale(1.1);
    }

    .mic-button {
      background: #f0f0f0;
      color: #333;
    }

    .mic-button:hover:not(:disabled) {
      background: #e0e0e0;
      transform: scale(1.1);
    }

    .mic-button.recording {
      background: #ff4444;
      color: white;
      animation: pulse 1s infinite;
    }

    .send-button {
      background: #ffffff;
      color: #667eea;
      border: 2px solid #667eea;
    }

    .send-button:hover:not(:disabled) {
      background: #f0f4ff;
      transform: scale(1.1);
      box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4);
    }

    .icon-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }

    @keyframes pulse {
      0%, 100% {
        opacity: 1;
      }
      50% {
        opacity: 0.7;
      }
    }

    /* Context Editor Modal Styles */
    .context-editor-modal {
      max-width: 700px;
      max-height: 90vh;
    }

    .context-upload-section {
      margin-bottom: 16px;
    }

    .upload-btn {
      padding: 8px 16px;
      background: #f3f4f6;
      border: 2px dashed #9ca3af;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      transition: all 0.2s;
    }

    .upload-btn:hover {
      background: #e5e7eb;
      border-color: #6b7280;
    }

    .context-textarea-modal {
      width: 100%;
      min-height: 200px;
      padding: 12px;
      border: 2px solid #e1e4e8;
      border-radius: 6px;
      font-family: monospace;
      font-size: 13px;
      resize: vertical;
      margin-bottom: 16px;
    }

    .context-textarea-modal:focus {
      outline: none;
      border-color: #0366d6;
    }

    .context-preview-section {
      margin-bottom: 16px;
      padding: 12px;
      background: #f6f8fa;
      border-radius: 6px;
      max-height: 300px;
      overflow-y: auto;
    }

    .context-preview-section h5 {
      margin: 0 0 8px 0;
      font-size: 12px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .modal-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }

    .btn-primary,
    .btn-secondary {
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.2s;
    }

    .btn-primary {
      background: #0366d6;
      color: white;
    }

    .btn-primary:hover {
      background: #0256c7;
    }

    .btn-secondary {
      background: #f3f4f6;
      color: #24292e;
    }

    .btn-secondary:hover {
      background: #e1e4e8;
    }

    /* Context Banner Styles (DEPRECATED - Removido do template) */
    .context-banner {
      background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
      border-bottom: 2px solid #9ca3af;
      padding: 16px 20px;
      animation: slideDown 0.3s ease;
    }

    .context-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }

    .context-icon {
      font-size: 18px;
    }

    .context-title {
      flex: 1;
      font-size: 14px;
      font-weight: 600;
      color: #374151;
    }

    .context-actions {
      display: flex;
      gap: 8px;
    }

    .context-action-btn {
      background: #6b7280;
      color: white;
      border: none;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .context-action-btn:hover {
      background: #4b5563;
      transform: translateY(-1px);
    }

    .context-editor {
      margin-top: 12px;
    }

    .context-textarea {
      width: 100%;
      padding: 12px;
      border: 2px solid #d1d5db;
      border-radius: 8px;
      font-size: 13px;
      font-family: 'Segoe UI', system-ui, sans-serif;
      line-height: 1.6;
      resize: vertical;
      min-height: 150px;
    }

    .context-textarea:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .context-editor-actions {
      display: flex;
      gap: 8px;
      margin-top: 8px;
      justify-content: flex-end;
    }

    .save-context-btn {
      background: #10b981;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }

    .save-context-btn:hover {
      background: #059669;
      transform: translateY(-1px);
    }

    .cancel-context-btn {
      background: #6b7280;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .cancel-context-btn:hover {
      background: #4b5563;
    }

    .context-preview {
      margin-top: 12px;
      padding: 12px;
      background: white;
      border-radius: 8px;
      border: 1px solid #d1d5db;
    }

    .markdown-content {
      font-size: 13px;
      line-height: 1.6;
      color: #374151;
    }

    .markdown-content h1 {
      font-size: 18px;
      font-weight: 700;
      margin: 8px 0;
      color: #111827;
    }

    .markdown-content h2 {
      font-size: 16px;
      font-weight: 600;
      margin: 6px 0;
      color: #1f2937;
    }

    .markdown-content h3 {
      font-size: 14px;
      font-weight: 600;
      margin: 4px 0;
      color: #374151;
    }

    .markdown-content code {
      background: #f3f4f6;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      color: #dc2626;
    }

    .markdown-content a {
      color: #3b82f6;
      text-decoration: underline;
    }

    .context-empty {
      padding: 24px;
      text-align: center;
      background: white;
      border-radius: 8px;
      border: 2px dashed #d1d5db;
      margin-top: 12px;
    }

    .empty-hint {
      font-size: 13px;
      color: #6b7280;
      margin: 0;
    }

    /* CWD Warning Banner */
    .cwd-warning-banner {
      background: linear-gradient(135deg, #e0f2fe 0%, #b3e5fc 100%);
      border-bottom: 2px solid #29b6f6;
      padding: 12px 20px;
      animation: slideDown 0.3s ease;
    }

    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .warning-content {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .warning-icon {
      font-size: 18px;
    }

    .warning-text {
      flex: 1;
      font-size: 13px;
      font-weight: 500;
      color: #0277bd;
    }

    .define-cwd-btn {
      background: #29b6f6;
      color: white;
      border: none;
      padding: 6px 14px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .define-cwd-btn:hover {
      background: #0288d1;
      transform: translateY(-1px);
      box-shadow: 0 4px 8px rgba(41, 182, 246, 0.3);
    }

    /* CWD Modal Styles */
    .cwd-modal {
      max-width: 500px;
    }

    .modal-description {
      font-size: 13px;
      color: #6b7280;
      margin-bottom: 16px;
      line-height: 1.5;
    }

    .cwd-input-group {
      display: flex;
      gap: 8px;
    }

    .cwd-input {
      flex: 1;
      padding: 8px 12px;
      border: 2px solid #e1e4e8;
      border-radius: 6px;
      font-size: 13px;
      font-family: 'Courier New', monospace;
      outline: none;
      transition: border-color 0.2s;
    }

    .cwd-input:focus {
      border-color: #007bff;
    }

    .save-btn {
      background: #007bff;
      color: white;
      border: none;
      padding: 8px 20px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }

    .save-btn:hover {
      background: #0056b3;
    }

    /* Agent Options Menu */
    .agent-options-menu {
      position: fixed;
      /* top e left são definidos dinamicamente via [style] no template */
      background: white;
      border: 1px solid #e1e4e8;
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
      z-index: 1001;
      min-width: 220px;
      overflow: hidden;
      animation: fadeInRight 0.2s ease;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(-8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes fadeInLeft {
      from {
        opacity: 0;
        transform: translateX(20px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    @keyframes fadeInRight {
      from {
        opacity: 0;
        transform: translateX(-20px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    .agent-options-menu .menu-item {
      display: block;
      width: 100%;
      padding: 14px 18px;
      background: white;
      border: none;
      text-align: left;
      cursor: pointer;
      font-size: 14px;
      color: #2c3e50;
      transition: all 0.2s;
      border-bottom: 1px solid #f0f3f7;
      font-weight: 500;
    }

    .agent-options-menu .menu-item:last-child {
      border-bottom: none;
    }

    .agent-options-menu .menu-item:hover {
      background: linear-gradient(90deg, #f0f4ff 0%, #f7fafc 100%);
      padding-left: 22px;
      color: #667eea;
    }

    /* Dock Info Modal */
    .dock-info-modal {
      max-width: 500px;
    }

    .dock-info-modal .modal-body {
      font-size: 14px;
      line-height: 1.7;
    }

    .dock-info-modal h5 {
      margin: 20px 0 10px 0;
      font-size: 15px;
      font-weight: 600;
      color: #667eea;
      border-bottom: 2px solid #e3f2fd;
      padding-bottom: 6px;
    }

    .dock-info-modal h5:first-child {
      margin-top: 0;
    }

    .dock-info-modal ul {
      margin: 12px 0;
      padding-left: 24px;
    }

    .dock-info-modal li {
      margin-bottom: 10px;
    }

    .dock-info-modal ul ul {
      margin-top: 8px;
      margin-bottom: 0;
    }

    /* Nerd Section Styles */
    .nerd-section {
      margin-top: 24px;
      padding-top: 20px;
      border-top: 2px dashed #e3f2fd;
    }

    .nerd-section h5 {
      color: #9c27b0;
      border-bottom-color: #f3e5f5;
    }

    .nerd-stats {
      background: #fafafa;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 16px;
    }

    .stat-item {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin-bottom: 12px;
      font-size: 13px;
    }

    .stat-item:last-child {
      margin-bottom: 0;
    }

    .stat-label {
      font-weight: 600;
      color: #616161;
      min-width: 120px;
    }

    .stat-value {
      color: #424242;
      word-break: break-all;
    }

    .stat-value code,
    code.stat-value {
      background: #fff3e0;
      color: #e65100;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 12px;
      font-family: 'Courier New', monospace;
    }

    .stat-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
    }

    .stat-list-item {
      background: #fff3e0;
      color: #e65100;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-family: 'Courier New', monospace;
      display: block;
    }

    /* Input Blocked Overlay */
    .input-blocked-overlay {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: rgba(33, 150, 243, 0.9);
      /* REMOVIDO: backdrop-filter: blur(2px); - performance issue */
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      border-top: 3px solid #1976d2;
      pointer-events: none; /* 🔥 Não bloquear cliques em elementos acima (FAB) */
    }

    .blocked-message {
      display: flex;
      align-items: center;
      pointer-events: auto; /* 🔥 Reabilitar cliques no conteúdo interno */
      gap: 12px;
      color: white;
      font-size: 13px;
      font-weight: 500;
    }

    .blocked-icon {
      font-size: 20px;
    }

    .blocked-btn {
      background: #1976d2;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      box-shadow: 0 2px 4px rgba(25, 118, 210, 0.3);
    }

    .blocked-btn:hover {
      background: #1565c0;
      transform: translateY(-1px);
      box-shadow: 0 4px 8px rgba(25, 118, 210, 0.4);
    }

    /* Agent Dock Styles */
    .dock-info-btn {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #f5f5f5;
      border: 1px solid #e0e0e0;
      cursor: pointer;
      font-size: 16px;
      font-weight: 700;
      font-family: Georgia, serif;
      color: #757575;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
      margin: 4px auto;
      flex-shrink: 0;
    }

    .dock-info-btn:hover {
      background: #e0e0e0;
      border-color: #bdbdbd;
      color: #424242;
      transform: scale(1.1);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .dock-action-btn {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #ffffff;
      border: 1px solid #e0e0e0;
      cursor: pointer;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
      margin: 4px auto;
      flex-shrink: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', 'Segoe UI Symbol', 'Android Emoji', 'EmojiSymbols' !important;
    }

    .dock-action-btn:hover:not(:disabled) {
      transform: scale(1.1);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .dock-action-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .dock-action-btn.add-agent-btn:hover:not(:disabled) {
      background: #c8e6c9;
      border-color: #81c784;
    }

    .dock-action-btn.delete-agent-btn:hover:not(:disabled) {
      background: #ffcdd2;
      border-color: #ef9a9a;
    }

    .dock-action-btn.settings-btn:hover:not(:disabled) {
      background: #bbdefb;
      border-color: #42a5f5;
    }

    /* 🔥 NOVO: Botão de controle da conversation sidebar */
    .dock-action-btn.conversation-toggle-btn {
      background: #f3e8ff;
      border-color: #d8b4fe;
    }

    .dock-action-btn.conversation-toggle-btn:hover:not(:disabled) {
      background: #e9d5ff;
      border-color: #c084fc;
    }

    .dock-separator {
      width: 30px;
      height: 1px;
      background: #d1d5db;
      margin: 8px auto;
      flex-shrink: 0;
    }

    .dock-item {
      width: 40px;
      height: 40px;
      min-width: 40px;
      min-height: 40px;
      flex-shrink: 0;
      border-radius: 8px;
      background: #ffffff;
      border: 1px solid #e1e4e8;
      cursor: pointer;
      font-size: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      position: relative;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', 'Segoe UI Symbol', 'Android Emoji', 'EmojiSymbols' !important;
    }

    .dock-item:hover {
      background: #f7fafc;
      border-color: #a8b9ff;
      transform: translateX(-2px);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .dock-item.active {
      background: #e8eaf6;
      border: 2px solid #667eea;
      box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
    }

    .dock-item.active::before {
      content: '';
      position: absolute;
      left: -4px;
      top: 50%;
      transform: translateY(-50%);
      width: 3px;
      height: 24px;
      background: #667eea;
      border-radius: 2px;
    }

    /* 🔥 NOVO: Estilos de Drag & Drop para Dock de Agentes */
    .cdk-drag-preview.dock-item {
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
      opacity: 0.9;
      cursor: grabbing !important;
    }

    .dock-item-preview {
      width: 40px;
      height: 40px;
      border-radius: 8px;
      background: #ffffff;
      border: 2px solid #667eea;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
    }

    .dock-item-placeholder {
      width: 40px;
      height: 50px; /* handle (8px) + gap (2px) + button (40px) */
      background: #f0f4ff;
      border: 2px dashed #a8b9ff;
      border-radius: 8px;
    }

    .cdk-drag-animating {
      transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
    }

    .dock-agents-list.cdk-drop-list-dragging .dock-item:not(.cdk-drag-placeholder) {
      transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
    }

    /* 🔥 NOVO: Wrapper e Handle para Drag & Drop de Agentes */
    .dock-item-wrapper {
      position: relative;
      width: 40px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
    }

    .dock-drag-handle {
      width: 30px;
      height: 8px;
      background: transparent;
      cursor: grab;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
      border-radius: 4px 4px 0 0;
      position: relative;
    }

    .dock-drag-handle::before {
      content: '⋮';
      color: #cbd5e0;
      font-size: 14px;
      font-weight: bold;
      line-height: 1;
      transform: rotate(90deg);
    }

    .dock-drag-handle:hover::before {
      color: #667eea;
    }

    .dock-drag-handle:active {
      cursor: grabbing;
    }

    .dock-item-wrapper.cdk-drag-animating {
      transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
    }

    .dock-agents-list.cdk-drop-list-dragging .dock-item-wrapper:not(.cdk-drag-placeholder) {
      transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
    }

    /* Close button for conversation sidebar - Hidden by default */
    .close-conversation-sidebar {
      display: none;
    }

    /* 🔥 NOVO: Responsividade para mobile - Fullscreen Modal */
    /* 🔥 RESPONSIVIDADE MOBILE - Três Estados */
    @media (max-width: 768px) {
      /* Estado HIDDEN: completamente escondido */
      .conversation-sidebar.hidden {
        display: none;
      }

      /* Estado COMPACT: barra estreita de 50px */
      .conversation-sidebar.compact {
        width: 50px !important;
        min-width: 50px !important;
        max-width: 50px !important;
        display: flex;
      }

      .conversation-sidebar.compact .dock-conversation-item {
        width: 36px;
        height: 36px;
        font-size: 16px;
      }

      .conversation-sidebar.compact .dock-action-btn {
        width: 36px;
        height: 36px;
        font-size: 18px;
      }

      /* Estado FULL: fullscreen modal */
      .conversation-sidebar.full {
        display: flex !important;
        flex-direction: column;
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        width: 100vw !important;
        max-width: 100vw !important;
        min-width: 100vw !important;
        z-index: 10000;
        background: white;
        border: none;
        animation: slideInLeft 0.3s ease-out;
        opacity: 1 !important;
      }

      /* Quando full no mobile, vira modal */
      .conversation-sidebar.conversation-modal-active {
        display: flex !important;
        flex-direction: column;
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        width: 100vw !important;
        max-width: 100vw !important;
        min-width: 100vw !important;
        z-index: 10000;
        background: white;
        border: none;
        animation: slideInLeft 0.3s ease-out;
        opacity: 1 !important;
      }

      @keyframes slideInLeft {
        from {
          transform: translateX(-100%);
        }
        to {
          transform: translateX(0);
        }
      }

      /* Show close button on mobile modal (apenas quando full) */
      .conversation-sidebar.full .close-conversation-sidebar,
      .conversation-sidebar.conversation-modal-active .close-conversation-sidebar {
        display: flex;
        position: absolute;
        top: 16px;
        left: 16px;
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.95);
        /* REMOVIDO: backdrop-filter: blur(10px); - performance issue */
        border: none;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        color: #333;
        font-size: 28px;
        font-weight: bold;
        line-height: 1;
        cursor: pointer;
        z-index: 10001;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
      }

      .close-conversation-sidebar:active {
        transform: scale(0.9);
        background: rgba(255, 255, 255, 0.8);
      }

      .close-conversation-sidebar:hover {
        background: rgba(255, 255, 255, 1);
        transform: scale(1.05);
      }

      .conductor-chat {
        border-left: none;
      }

      /* FAB no mobile - posição ajustada */
      .conversation-fab {
        left: 12px;
        bottom: 70px;
        width: 52px;
        height: 52px;
        font-size: 22px;
      }
    }

    /* 🔥 RESPONSIVIDADE TABLET (769px - 1024px) */
    @media (min-width: 769px) and (max-width: 1024px) {
      /* No tablet, compact continua em 60px mas fica mais confortável */
      .conversation-sidebar.compact {
        width: 60px !important;
        min-width: 60px !important;
        max-width: 60px !important;
      }

      /* Full no tablet usa largura reduzida para não ocupar muito espaço */
      .conversation-sidebar.full {
        width: 240px !important;
        min-width: 200px !important;
        max-width: 280px !important;
      }
    }
  `]
})
export class ConductorChatComponent implements OnInit, OnDestroy {
  @Input() contextualAgents: any[] = [];
  @Input() screenplayWorkingDirectory: string | null = null; // Working directory do screenplay para herança
  @Input() firstColumnVisible: boolean = true; // 🔥 NOVO: Estado do menu lateral
  @Output() addAgentRequested = new EventEmitter<void>();
  @Output() deleteAgentRequested = new EventEmitter<void>();
  @Output() agentDockClicked = new EventEmitter<any>();
  @Output() activeConversationChanged = new EventEmitter<string | null>(); // 🔥 NOVO: Notifica mudança de conversa
  @Output() agentOrderChanged = new EventEmitter<any[]>(); // 🔥 NOVO: Notifica reordenação de agentes
  @Output() conversationOrderChanged = new EventEmitter<any[]>(); // 🔥 NOVO: Notifica reordenação de conversas
  @Output() toggleFirstColumnRequested = new EventEmitter<void>(); // 🔥 NOVO: Solicita toggle do menu lateral
  @Output() openScreenplayModalRequested = new EventEmitter<void>(); // 🔥 NOVO: Solicita abertura do modal de roteiros

  @ViewChild(ChatInputComponent) chatInputComponent!: ChatInputComponent;
  @ViewChild(ConversationListComponent) conversationListComponent!: ConversationListComponent;

  chatState: ChatState = {
    messages: [],
    isConnected: false,
    isLoading: false
  };

  currentMode: ChatMode = 'ask';
  config: ConductorConfig = DEFAULT_CONFIG;

  // Agent context state
  activeAgentContext: AgentContext | null = null;
  activeAgentId: string | null = null; // instance_id
  selectedAgentDbId: string | null = null; // MongoDB agent_id
  selectedAgentName: string | null = null;
  selectedAgentEmoji: string | null = null;
  activeScreenplayId: string | null = null; // SAGA-006: Add screenplay ID for document association

  // CWD management
  tempCwd: string = '';

  // Menu positioning
  menuPosition = { top: 0, left: 0 };
  activeAgentCwd: string | null = null;

  // Resize functionality - controls chat INPUT AREA height (ONLY editor, not controls)
  // Initial height calculation:
  // - Text area for ~2-3 lines: 3 × 1.5 line-height × 13px font = ~58px
  // - Editor padding: 24px (12px top + 12px bottom)
  // - Total: ~80px for editor area (controls are separate, always 60px)
  chatInputHeight: string = '80px'; // Initial height (compact, auto-expands with content)
  private isResizing: boolean = false;
  private startY: number = 0;
  private startHeight: number = 0;

  // Controls state (moved from chat-input component)
  selectedProvider: string = ''; // '' = usar provider padrão do config.yaml
  isRecording: boolean = false;
  speechSupported: boolean = false;
  showPersonaModal: boolean = false;

  // 🔥 NOVO: Três estados para a sidebar de conversas
  // 'hidden' = completamente escondida
  // 'compact' = barra de botões compacta (60px, similar à agent-launcher-dock)
  // 'full' = expandida/larga (280px)
  sidebarState: 'hidden' | 'compact' | 'full' = 'compact'; // Default: compact

  // 🔥 NOVO: Lista local de conversas para o modo compacto
  private _conversations: Conversation[] = [];

  private messageContent: string = ''; // Content from editor

  // ✅ SOLUÇÃO BUG PARALELISMO: Mapa de históricos isolados por agente
  private chatHistories: Map<string, Message[]> = new Map();

  // ✅ SOLUÇÃO BUG PARALELISMO: Mapas de mensagens temporárias isoladas por agente
  private progressMessages: Map<string, Message | null> = new Map();
  private streamingMessages: Map<string, Message | null> = new Map();

  // 🔥 NOVO: Mapeamento de instanceId -> conversationId para validação de mensagens SSE
  private instanceToConversationMap: Map<string, string> = new Map();

  private subscriptions = new Subscription();
  private connectionCheckInterval: any;

  // 🔥 NOVO MODELO: Conversas globais
  public activeConversationId: string | null = null;  // ID da conversa ativa (novo modelo)
  private conversationParticipants: ConvAgentInfo[] = [];  // Participantes da conversa

  // 🔥 NOVO: Contexto da conversa
  public conversationContext: string = '';  // Contexto markdown da conversa
  private originalContext: string = '';  // Backup para cancelamento
  @ViewChild('contextFileInput') contextFileInput: any;

  // Expor environment para o template
  public environment = environment;

  // ✅ SOLUÇÃO BUG PARALELISMO: Getters para retornar mensagens temporárias do agente ativo
  get progressMessage(): Message | null {
    if (!this.activeAgentId) return null;
    return this.progressMessages.get(this.activeAgentId) || null;
  }

  get streamingMessage(): Message | null {
    if (!this.activeAgentId) return null;
    return this.streamingMessages.get(this.activeAgentId) || null;
  }

  constructor(
    private apiService: ConductorApiService,
    private screenplayService: ScreenplayService,
    private agentService: AgentService,
    private agentExecutionService: AgentExecutionService,
    private personaEditService: PersonaEditService,
    private speechService: SpeechRecognitionService,
    private conversationService: ConversationService,  // 🔥 NOVO
    private messageHandlingService: MessageHandlingService,  // 🔥 FASE 1.1
    public modalStateService: ModalStateService,  // 🔥 FASE 1.2 (public para template)
    private navigationStateService: NavigationStateService  // 🔥 Estado de navegação
  ) { }

  ngOnInit(): void {
    this.initializeChat();
    this.checkConnectionStatus();
    this.connectionCheckInterval = setInterval(() => {
      this.checkConnectionStatus();
    }, 30000);

    // 📱 Restaurar estado mobile da sidebar
    this.restoreMobileSidebarState();

    // 🔥 Carregar conversas se já houver um screenplay ativo
    if (this.activeScreenplayId) {
      this.loadConversations();
    }

    // Initialize speech recognition
    this.speechSupported = this.speechService.isSupported;

    // Subscribe to recording state
    this.subscriptions.add(
      this.speechService.isRecording$.subscribe(recording => {
        this.isRecording = recording;
      })
    );

    // Subscribe to transcript and insert into editor
    this.subscriptions.add(
      this.speechService.transcript$.subscribe(transcript => {
        if (transcript && this.chatInputComponent) {
          this.chatInputComponent.insertText(transcript);
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
    }
    // Remove resize listeners
    document.removeEventListener('mousemove', this.onResizeMove);
    document.removeEventListener('mouseup', this.onResizeEnd);
  }

  private initializeChat(): void {
    const welcomeMessage: Message = {
      id: Date.now().toString(),
      content: this.config.welcomeMessage,
      type: 'bot',
      timestamp: new Date()
    };

    this.chatState.messages = [welcomeMessage];
  }

  private async checkConnectionStatus(): Promise<void> {
    try {
      const isConnected = await this.apiService.checkConnection(this.config.api.apiKey);
      this.chatState.isConnected = isConnected;
    } catch (error) {
      this.chatState.isConnected = false;
    }
  }

  /**
   * Handle message content changes from editor
   */
  onMessageContentChanged(content: string): void {
    this.messageContent = content;
  }

  /**
   * 🔥 NOVO: Ajusta altura da área de input baseado no conteúdo
   */
  onContentHeightChanged(height: number): void {
    // Não ajustar altura se o usuário estiver redimensionando manualmente
    if (!this.isResizing) {
      this.chatInputHeight = `${height}px`;
    }
  }

  /**
   * Send message (called from controls-row in template)
   */
  sendMessage(): void {
    if (!this.messageContent.trim() || this.chatState.isLoading) return;

    const data = {
      message: this.messageContent.trim(),
      provider: this.selectedProvider || undefined
    };

    this.handleSendMessage(data);

    // Clear editor after sending
    if (this.chatInputComponent) {
      this.chatInputComponent.clearEditor();
    }

    // Reset messageContent
    this.messageContent = '';
  }

  /**
   * Check if editor is empty
   */
  isEditorEmpty(): boolean {
    return !this.messageContent || this.messageContent.trim().length === 0;
  }

  /**
   * Toggle speech recording
   */
  toggleRecording(): void {
    this.speechService.toggleRecording();
  }

  /**
   * Toggle chat mode
   */
  toggleMode(): void {
    this.currentMode = this.currentMode === 'ask' ? 'agent' : 'ask';
    this.handleModeChange(this.currentMode);
  }

  /**
   * Get microphone button title
   */
  getMicTitle(): string {
    if (!this.speechSupported) {
      return 'Reconhecimento de voz não suportado';
    }
    return this.isRecording
      ? 'Gravando... Clique para parar'
      : 'Clique para falar';
  }

  /**
   * Focus editor when clicking on chat-input-area
   */
  focusEditorInput(): void {
    if (this.chatInputComponent && !this.chatState.isLoading) {
      this.chatInputComponent.focusEditor();
    }
  }

  handleSendMessage(data: {message: string, provider?: string}): void {
    if (!data.message.trim() || this.chatState.isLoading) return;

    if (this.isInputBlocked()) {
      console.warn('⚠️ [CHAT] Bloqueado: defina o diretório de trabalho primeiro');
      return;
    }

    this.forceSaveScreenplayIfNeeded();

    // Validar que temos as informações necessárias
    if (!this.activeAgentId || !this.selectedAgentDbId) {
      console.error('❌ [CHAT] Agente não selecionado ou sem ID');
      return;
    }

    // Criar mensagem do usuário
    const userMessage: Message = {
      id: Date.now().toString(),
      content: data.message.trim(),
      type: 'user',
      timestamp: new Date()
    };

    // Preparar parâmetros para o serviço
    const params: MessageParams = {
      message: data.message,
      provider: data.provider,
      conversationId: this.activeConversationId || undefined,
      agentId: this.activeAgentId,
      agentDbId: this.selectedAgentDbId,
      agentName: this.selectedAgentName || 'Unknown',
      agentEmoji: this.selectedAgentEmoji || '🤖',
      cwd: this.activeAgentCwd || this.screenplayWorkingDirectory || undefined,
      screenplayId: this.activeScreenplayId || undefined,
      instanceId: this.activeAgentId
    };

    // Preparar callbacks
    const callbacks: MessageHandlingCallbacks = {
      onProgressUpdate: (message: string, instanceId: string) => {
        // 🔥 VALIDAÇÃO: Só processar se a mensagem pertence à conversa ativa
        const messageConversationId = this.instanceToConversationMap.get(instanceId);
        if (messageConversationId && messageConversationId !== this.activeConversationId) {
          console.log(`⏭️ [CHAT] Descartando progressUpdate de conversa diferente (${messageConversationId} != ${this.activeConversationId})`);
          return;
        }

        if (message) {
          this.addProgressMessage(message, instanceId);
        } else {
          this.progressMessages.set(instanceId, null);
        }
      },
      onStreamingUpdate: (chunk: string, instanceId: string) => {
        // 🔥 VALIDAÇÃO: Só processar se a mensagem pertence à conversa ativa
        const messageConversationId = this.instanceToConversationMap.get(instanceId);
        if (messageConversationId && messageConversationId !== this.activeConversationId) {
          console.log(`⏭️ [CHAT] Descartando streamingUpdate de conversa diferente (${messageConversationId} != ${this.activeConversationId})`);
          return;
        }

        this.appendToStreamingMessage(chunk, instanceId);
      },
      onLoadingChange: (isLoading: boolean) => {
        this.chatState.isLoading = isLoading;
      },
      onMessagesUpdate: (messages: Message[]) => {
        this.chatState.messages = messages;
      },
      onConversationReload: (conversationId: string) => {
        // 🔥 VALIDAÇÃO: Só recarregar se for a conversa ativa
        if (conversationId !== this.activeConversationId) {
          console.log(`⏭️ [CHAT] Descartando reload de conversa diferente (${conversationId} != ${this.activeConversationId})`);

          // Limpar mapeamento mesmo descartando
          if (this.activeAgentId) {
            this.instanceToConversationMap.delete(this.activeAgentId);
          }
          return; // ✋ Não recarrega se não for a conversa ativa
        }

        // 🔥 Limpar mapeamento após processar mensagem
        if (this.activeAgentId) {
          this.instanceToConversationMap.delete(this.activeAgentId);
          console.log(`🧹 [CHAT] Removido mapeamento: ${this.activeAgentId}`);
        }
        this.loadConversation(conversationId);
      }
    };

    // 🔥 NOVO MODELO: Usar conversas globais
    if (environment.features?.useConversationModel && this.activeConversationId && this.activeAgentId) {
      // 🔥 Registrar mapeamento instanceId -> conversationId para validação de SSE
      this.instanceToConversationMap.set(this.activeAgentId, this.activeConversationId);
      console.log(`📋 [CHAT] Registrado mapeamento: ${this.activeAgentId} -> ${this.activeConversationId}`);
      console.log(`📋 [CHAT] Conversação ativa no momento do envio: ${this.activeConversationId}`);

      // Adicionar mensagem à UI imediatamente
      this.chatState.messages = [...this.chatState.messages.filter(msg =>
        !msg.id.startsWith('empty-')
      ), userMessage];

      this.messageHandlingService.sendMessageWithConversationModel(params, callbacks).subscribe({
        next: (result) => {
          console.log('✅ [CHAT] Mensagem processada com sucesso');
        },
        error: (error) => {
          console.error('❌ [CHAT] Erro ao processar mensagem:', error);
          this.handleError(error, this.activeAgentId);
        }
      });
      return;
    }

    // 🔄 MODELO LEGADO: Código original
    this.messageHandlingService.sendMessageWithLegacyModel(
      params,
      this.chatState.messages,
      this.chatHistories,
      callbacks
    ).subscribe({
      next: (result) => {
        console.log('✅ [CHAT] Mensagem processada com sucesso (legado)');
      },
      error: (error) => {
        console.error('❌ [CHAT] Erro ao processar mensagem:', error);
        this.handleError(error, this.activeAgentId);
      }
    });
  }

  // 🔥 Métodos handleSendMessageWithConversationModel e handleSendMessageWithLegacyModel
  // foram movidos para MessageHandlingService (FASE 1.1)

  private handleStreamEvent(event: any): void {
    console.log('Stream event:', event);

    // Check if it's a final response
    if (event.success !== undefined) {
      // ✅ SOLUÇÃO BUG PARALELISMO: Limpar progresso do agente ativo (se houver)
      if (this.activeAgentId) {
        this.progressMessages.set(this.activeAgentId, null);
      }

      const currentStreamingMessage = this.streamingMessage;
      if (currentStreamingMessage) {
        this.chatState.messages = [...this.chatState.messages, currentStreamingMessage];

        // ✅ SOLUÇÃO BUG PARALELISMO: Limpar streaming do agente ativo
        if (this.activeAgentId) {
          this.streamingMessages.set(this.activeAgentId, null);
        }
      } else {
        const finalMessage: Message = {
          id: `final-${Date.now()}`,
          content: event.data?.result || event.data?.message || 'Execução concluída',
          type: 'bot',
          timestamp: new Date()
        };
        this.chatState.messages = [...this.chatState.messages, finalMessage];
      }

      this.chatState.isLoading = false;
      return;
    }

    // Handle SSE events
    switch (event.event) {
      case 'job_started':
        this.addProgressMessage('🚀 Iniciando execução...');
        break;
      case 'status_update':
        this.updateProgressMessage(event.data?.message || 'Processando...');
        break;
      case 'on_llm_start':
        this.updateProgressMessage('🤖 LLM iniciando análise...');
        break;
      case 'on_llm_new_token':
        if (event.data?.chunk) {
          this.appendToStreamingMessage(event.data.chunk);
        }
        break;
      case 'on_tool_start':
        if (event.data?.tool) {
          this.updateProgressMessage(`🔧 Usando ferramenta: ${event.data.tool.name || event.data.tool}...`);
        }
        break;
      case 'on_tool_end':
        if (event.data?.output) {
          const toolResult = event.data.output.substring(0, 100) + '...';
          const toolMessage: Message = {
            id: `tool-${Date.now()}`,
            content: `⚙️ Ferramenta concluída: ${toolResult}`,
            type: 'bot',
            timestamp: new Date()
          };
          this.chatState.messages = [...this.chatState.messages, toolMessage];
        }
        break;
      case 'result':
        // ✅ SOLUÇÃO BUG PARALELISMO: Limpar progresso do agente ativo
        if (this.activeAgentId) {
          this.progressMessages.set(this.activeAgentId, null);
        }
        break;
      case 'error':
        // ✅ SOLUÇÃO BUG PARALELISMO: Limpar progresso do agente ativo
        if (this.activeAgentId) {
          this.progressMessages.set(this.activeAgentId, null);
        }
        break;
    }
  }

  private addProgressMessage(text: string, instanceId?: string): void {
    const targetInstanceId = instanceId || this.activeAgentId;
    if (!targetInstanceId) return;

    const message: Message = {
      id: `progress-${Date.now()}`,
      content: text,
      type: 'bot',
      timestamp: new Date()
    };

    // ✅ SOLUÇÃO BUG PARALELISMO: Armazenar no mapa do agente correto
    this.progressMessages.set(targetInstanceId, message);
  }

  private updateProgressMessage(text: string, instanceId?: string): void {
    const targetInstanceId = instanceId || this.activeAgentId;
    if (!targetInstanceId) return;

    const existingMessage = this.progressMessages.get(targetInstanceId);

    if (existingMessage) {
      // ✅ SOLUÇÃO BUG PARALELISMO: Atualizar mensagem do agente correto
      this.progressMessages.set(targetInstanceId, { ...existingMessage, content: text });
    } else {
      this.addProgressMessage(text, targetInstanceId);
    }
  }

  private appendToStreamingMessage(token: string, instanceId?: string): void {
    const targetInstanceId = instanceId || this.activeAgentId;
    if (!targetInstanceId) return;

    const existingMessage = this.streamingMessages.get(targetInstanceId);

    if (!existingMessage) {
      // ✅ SOLUÇÃO BUG PARALELISMO: Criar nova mensagem de streaming para o agente correto
      this.streamingMessages.set(targetInstanceId, {
        id: `stream-${Date.now()}`,
        content: token,
        type: 'bot',
        timestamp: new Date()
      });
    } else {
      // ✅ SOLUÇÃO BUG PARALELISMO: Atualizar mensagem de streaming do agente correto
      this.streamingMessages.set(targetInstanceId, {
        ...existingMessage,
        content: existingMessage.content + token
      });
    }
  }

  private handleError(error: string, instanceId?: string | null): void {
    const targetInstanceId = instanceId || this.activeAgentId;

    // ✅ SOLUÇÃO BUG PARALELISMO: Limpar mensagens temporárias do agente correto
    if (targetInstanceId) {
      this.progressMessages.set(targetInstanceId, null);
      this.streamingMessages.set(targetInstanceId, null);
    }

    const errorMessage: Message = {
      id: (Date.now() + 1).toString(),
      content: `❌ Erro: ${error}`,
      type: 'bot',
      timestamp: new Date()
    };

    // ✅ SOLUÇÃO BUG PARALELISMO: Adicionar erro ao histórico do agente correto
    if (targetInstanceId) {
      const agentHistory = this.chatHistories.get(targetInstanceId) || [];
      this.chatHistories.set(targetInstanceId, [...agentHistory, errorMessage]);

      // Atualizar exibição APENAS se for o agente ativo
      if (this.activeAgentId === targetInstanceId) {
        this.chatState.messages = this.chatHistories.get(targetInstanceId) || [];
      }
    } else {
      // Sem agente ativo: comportamento padrão
      this.chatState.messages = [...this.chatState.messages, errorMessage];
    }

    this.chatState.isLoading = false;
  }

  handleModeChange(mode: ChatMode): void {
    this.currentMode = mode;
    console.log('Chat mode changed to:', mode);

    // Add system message about mode change
    const modeMessage: Message = {
      id: `mode-${Date.now()}`,
      content: mode === 'agent'
        ? '🤖 Modo Agent ativado: Posso modificar o screenplay'
        : '💬 Modo Ask ativado: Apenas consultas',
      type: 'bot',
      timestamp: new Date()
    };
    this.chatState.messages = [...this.chatState.messages, modeMessage];
  }

  /**
   * Load agent context (persona, procedure, history) and display in chat
   * @param instanceId - The agent instance ID to load context for
   * @param agentName - Optional agent name to display in header
   * @param agentEmoji - Optional agent emoji to display in header
   * @param agentDbId - Optional MongoDB agent_id for direct execution
   * @param cwd - Optional working directory for the agent
   * @param screenplayId - Optional screenplay ID for document association
   */
  loadContextForAgent(instanceId: string, agentName?: string, agentEmoji?: string, agentDbId?: string, cwd?: string, screenplayId?: string): void {
    console.log('================================================================================');
    console.log('📥 [CHAT] loadContextForAgent chamado:');
    console.log('   - instanceId (instance_id):', instanceId);
    console.log('   - agentDbId (agent_id MongoDB):', agentDbId);
    console.log('   - agentName:', agentName);
    console.log('   - agentEmoji:', agentEmoji);
    console.log('   - screenplayId:', screenplayId || 'não fornecido');
    console.log('   - Feature Flag useConversationModel:', environment.features?.useConversationModel);
    console.log('================================================================================');

    if (!agentDbId) {
      console.error('================================================================================');
      console.error('❌ [CHAT] ERRO CRÍTICO: agentDbId (agent_id) está undefined/null!');
      console.error('================================================================================');
    }

    this.activeAgentId = instanceId;
    this.selectedAgentDbId = agentDbId || null;
    this.selectedAgentName = agentName || null;
    this.selectedAgentEmoji = agentEmoji || null;
    this.activeScreenplayId = screenplayId || null;

    // 🔥 Carregar conversas quando o screenplay mudar
    if (this.activeScreenplayId) {
      this.loadConversations();
    }

    // 📁 Atualizar CWD do agente ativo
    this.activeAgentCwd = cwd || null;
    console.log('📁 [CHAT] CWD do agente ativo atualizado:', this.activeAgentCwd);

    // 🔥 NOVO MODELO: Usar conversas globais
    if (environment.features?.useConversationModel) {
      // 🔥 FIX: Só mostrar loading se não for apenas troca de agente na mesma conversa
      if (!this.activeConversationId) {
        this.chatState.isLoading = true;
      }
      this.loadContextWithConversationModel(instanceId, agentName, agentEmoji, agentDbId, cwd, screenplayId);
      return;
    }

    this.chatState.isLoading = true;

    // 🔄 MODELO LEGADO: Usar históricos isolados (código original)
    this.loadContextWithLegacyModel(instanceId, cwd);
  }

  /**
   * 🔥 NOVO: Carregar contexto usando modelo de conversas globais
   */
  private loadContextWithConversationModel(instanceId: string, agentName?: string, agentEmoji?: string, agentDbId?: string, cwd?: string, screenplayId?: string): void {
    console.log('🔥 [CHAT] Usando NOVO modelo de conversas globais');

    // Verificar se já existe uma conversa ativa ou se precisa criar
    if (this.activeConversationId) {
      // Trocar agente ativo na conversa existente
      console.log('🔄 [CHAT] Trocando agente ativo na conversa:', this.activeConversationId);

      const agentInfo: ConvAgentInfo = {
        agent_id: agentDbId || '',
        instance_id: instanceId,
        name: agentName || 'Unknown Agent',
        emoji: agentEmoji
      };

      // Atualizar agente ativo no backend
      this.conversationService.setActiveAgent(this.activeConversationId, { agent_info: agentInfo }).subscribe({
        next: () => {
          console.log('✅ [CHAT] Agente ativo atualizado com sucesso');
          // 🔥 FIX: NÃO recarregar conversa - ela já está carregada
          // Apenas atualizar o estado do agente localmente
          this.chatState.isLoading = false;
        },
        error: (error) => {
          console.error('❌ [CHAT] Erro ao atualizar agente ativo:', error);
          this.chatState.isLoading = false;
        }
      });
    } else {
      // Criar nova conversa
      console.log('🆕 [CHAT] Criando nova conversa');

      const agentInfo: ConvAgentInfo = {
        agent_id: agentDbId || '',
        instance_id: instanceId,
        name: agentName || 'Unknown Agent',
        emoji: agentEmoji
      };

      this.conversationService.createConversation({
        title: `Conversa com ${agentName}`,
        active_agent: agentInfo,
        screenplay_id: this.activeScreenplayId || undefined
      }).subscribe({
        next: (response) => {
          console.log('✅ [CHAT] Nova conversa criada:', response.conversation_id);
          this.activeConversationId = response.conversation_id;
          this.loadConversation(response.conversation_id);
        },
        error: (error) => {
          console.error('❌ [CHAT] Erro ao criar conversa:', error);
          this.chatState.isLoading = false;
        }
      });
    }

    // Carregar contexto do agente (persona, cwd, etc.) em background
    this.loadAgentMetadata(instanceId, cwd);
  }

  /**
   * 🔥 NOVO: Carregar conversa do backend
   */
  private loadConversation(conversationId: string): void {
    this.conversationService.getConversation(conversationId).subscribe({
      next: (conversation) => {
        console.log('✅ [CHAT] Conversa carregada:', conversation);

        // Converter mensagens do formato do backend para o formato da UI
        const messages: Message[] = conversation.messages.map((msg: ConvMessage) => ({
          id: msg.id,
          content: msg.content,
          type: msg.type as 'user' | 'bot' | 'system',
          timestamp: new Date(msg.timestamp),
          agent: msg.agent,  // Informações do agente (para mensagens de bot)
          isDeleted: (msg as any).isDeleted || false  // 🔥 Adicionar isDeleted
        }));

        // Exibir mensagens
        this.chatState.messages = messages.length > 0 ? messages : [{
          id: `empty-${Date.now()}`,
          content: 'Nenhuma interação ainda. Inicie a conversa abaixo.',
          type: 'system',
          timestamp: new Date()
        }];

        // Armazenar participantes
        this.conversationParticipants = conversation.participants;

        // 🔥 Carregar contexto da conversa
        this.conversationContext = conversation.context || '';

        // 🔒 FIX: Atualizar estado do agente ativo baseado no active_agent da conversa
        if (conversation.active_agent) {
          // Verificar se o agente ativo ainda existe e não foi deletado
          const agentStillExists = this.contextualAgents.some((agent: any) =>
            agent.id === conversation.active_agent!.instance_id &&
            !agent.isDeleted &&
            !agent.is_deleted
          );

          if (agentStillExists) {
            // Conversa tem um agente ativo e ele ainda existe
            this.activeAgentId = conversation.active_agent.instance_id;
            this.selectedAgentDbId = conversation.active_agent.agent_id;
            this.selectedAgentName = conversation.active_agent.name;
            this.selectedAgentEmoji = conversation.active_agent.emoji || null;
            console.log('✅ [CHAT] Agente ativo carregado:', conversation.active_agent.name);

            // Carregar CWD do agente dos contextualAgents
            const agentInstance = this.contextualAgents.find((agent: any) =>
              agent.id === conversation.active_agent!.instance_id
            );

            if (agentInstance?.config?.cwd) {
              this.activeAgentCwd = agentInstance.config.cwd;
              console.log('✅ [CHAT] CWD carregado do agente:', this.activeAgentCwd);
            } else {
              // Fallback para localStorage
              const storedCwd = localStorage.getItem(`agent-cwd-${this.activeAgentId}`);
              this.activeAgentCwd = storedCwd || null;
              if (storedCwd) {
                console.log('✅ [CHAT] CWD carregado do localStorage:', storedCwd);
              }
            }
          } else {
            // Agente foi deletado - limpar estado
            this.activeAgentId = null;
            this.selectedAgentDbId = null;
            this.selectedAgentName = null;
            this.selectedAgentEmoji = null;
            this.activeAgentCwd = null;
            console.log('⚠️ [CHAT] Agente ativo foi deletado, limpando estado');
          }
        } else {
          // Conversa sem agente ativo - limpar estado
          this.activeAgentId = null;
          this.selectedAgentDbId = null;
          this.selectedAgentName = null;
          this.selectedAgentEmoji = null;
          this.activeAgentCwd = null;
          console.log('⚠️ [CHAT] Conversa sem agente ativo');
        }

        this.chatState.isLoading = false;
        console.log('✅ [CHAT] Conversa exibida com', messages.length, 'mensagens');
      },
      error: (error) => {
        console.error('❌ [CHAT] Erro ao carregar conversa:', error);
        this.chatState.isLoading = false;
      }
    });
  }

  /**
   * 🔄 LEGADO: Carregar contexto usando modelo antigo (código original)
   */
  private loadContextWithLegacyModel(instanceId: string, cwd?: string): void {
    console.log('🔄 [CHAT] Usando modelo LEGADO de históricos isolados');

    // Verificar cache
    const cachedHistory = this.chatHistories.get(instanceId);
    if (cachedHistory) {
      console.log('✅ [CHAT] Histórico encontrado em cache local (paralelismo)');
      this.chatState.messages = cachedHistory;
      this.chatState.isLoading = false;
      this.loadContextFromBackend(instanceId, cwd);
      return;
    }

    // Código original de loadContextForAgent
    this.subscriptions.add(
      this.agentService.getAgentContext(instanceId).subscribe({
        next: (context: AgentContext) => {
          console.log('✅ Agent context loaded:', context);
          this.activeAgentContext = context;

          // Load cwd
          if (context.cwd) {
            this.activeAgentCwd = context.cwd;
          } else if (cwd) {
            this.activeAgentCwd = cwd;
          } else {
            const storedCwd = localStorage.getItem(`agent-cwd-${instanceId}`);
            this.activeAgentCwd = storedCwd || null;
          }

          // Map history messages
          const historyMessages: Message[] = [];
          context.history.forEach((record: any, index: number) => {
            // 🔍 DEBUG: Ver se _id está vindo do backend
            if (index === 0) {
              console.log('🔍 [DEBUG] Estrutura do record do backend:', record);
              console.log('🔍 [DEBUG] record._id:', record._id);
            }

            if (record.user_input && record.user_input.trim().length > 0) {
              historyMessages.push({
                id: `history-user-${index}`,
                content: record.user_input,
                type: 'user',
                timestamp: new Date(record.timestamp * 1000 || record.createdAt),
                _historyId: record._id,
                isDeleted: record.isDeleted || false
              });
            }

            if (record.ai_response) {
              let aiContent = record.ai_response;
              if (typeof aiContent === 'object') {
                aiContent = JSON.stringify(aiContent, null, 2);
              }
              if (aiContent.trim().length > 0) {
                historyMessages.push({
                  id: `history-bot-${index}`,
                  content: aiContent,
                  type: 'bot',
                  timestamp: new Date(record.timestamp * 1000 || record.createdAt),
                  _historyId: record._id,
                  isDeleted: record.isDeleted || false
                });
              }
            }
          });

          if (historyMessages.length === 0) {
            historyMessages.push({
              id: `empty-history-${Date.now()}`,
              content: 'Nenhuma interação ainda. Inicie a conversa abaixo.',
              type: 'system',
              timestamp: new Date()
            });
          }

          this.chatHistories.set(instanceId, historyMessages);
          this.chatState.messages = historyMessages;
          this.chatState.isLoading = false;
        },
        error: (error) => {
          console.error('❌ Error loading agent context:', error);
          this.chatState.isLoading = false;

          const isNotFound = error.status === 404;
          const message: Message = {
            id: `info-${Date.now()}`,
            content: isNotFound
              ? `ℹ️ Este agente ainda não foi executado. Nenhum contexto disponível.`
              : `❌ Erro ao carregar contexto: ${error.message}`,
            type: 'system',
            timestamp: new Date()
          };
          this.chatState.messages = [message];
        }
      })
    );
  }

  /**
   * 🔥 NOVO: Carregar metadados do agente (persona, cwd) em background
   */
  private loadAgentMetadata(instanceId: string, cwd?: string): void {
    this.agentService.getAgentContext(instanceId).subscribe({
      next: (context: AgentContext) => {
        this.activeAgentContext = context;

        if (context.cwd) {
          this.activeAgentCwd = context.cwd;
        } else if (cwd) {
          this.activeAgentCwd = cwd;
        } else {
          const storedCwd = localStorage.getItem(`agent-cwd-${instanceId}`);
          this.activeAgentCwd = storedCwd || null;
        }
      },
      error: (error) => {
        console.error('⚠️ [CHAT] Erro ao carregar metadados do agente:', error);
      }
    });
  }

  /**
   * Load agent context from backend (MongoDB) in background
   * Used when we already have cached history but need to update persona/cwd
   * @param instanceId - The agent instance ID
   * @param cwd - Optional working directory override
   */
  private loadContextFromBackend(instanceId: string, cwd?: string): void {
    this.subscriptions.add(
      this.agentService.getAgentContext(instanceId).subscribe({
        next: (context: AgentContext) => {
          console.log('✅ [CHAT] Contexto carregado do MongoDB (background):', context);
          this.activeAgentContext = context;

          // Load cwd from context
          if (context.cwd) {
            this.activeAgentCwd = context.cwd;
            console.log('✅ [CHAT] CWD atualizado do MongoDB:', this.activeAgentCwd);
          } else if (cwd) {
            this.activeAgentCwd = cwd;
          } else {
            const storedCwd = localStorage.getItem(`agent-cwd-${instanceId}`);
            this.activeAgentCwd = storedCwd || null;
          }
        },
        error: (error) => {
          console.warn('⚠️ [CHAT] Erro ao carregar contexto em background:', error);
          // Não é crítico - já temos o histórico em cache
        }
      })
    );
  }

  /**
   * Clear agent context and return to welcome state
   */
  clear(): void {
    console.log('🧹 Clearing agent context');
    this.activeAgentContext = null;
    this.activeAgentId = null;
    this.selectedAgentDbId = null;
    this.selectedAgentName = null;
    this.selectedAgentEmoji = null;
    this.chatState.messages = [];
    this.showPersonaModal = false;

    // ✅ SOLUÇÃO BUG PARALELISMO: Limpar mapas isolados
    this.chatHistories.clear();
    this.progressMessages.clear();
    this.streamingMessages.clear();
    console.log('✅ [CHAT] Mapas de históricos e mensagens temporárias limpos');

    this.initializeChat();
  }

  /**
   * Toggle persona modal visibility
   */
  togglePersonaModal(): void {
    this.modalStateService.toggle('personaModal');
  }

  /**
   * Check if CWD warning banner should be shown
   */
  showCwdWarning(): boolean {
    // Show warning if agent is selected but no cwd is defined (neither agent-specific nor screenplay)
    return this.activeAgentId !== null && !this.activeAgentCwd && !this.screenplayWorkingDirectory;
  }

  /**
   * Check if chat input should be blocked
   */
  isInputBlocked(): boolean {
    // Block input if no agent is selected
    if (!this.activeAgentId) {
      return true;
    }
    // Block input if agent is selected but no cwd is defined (neither agent-specific nor screenplay)
    return !this.activeAgentCwd && !this.screenplayWorkingDirectory;
  }

  /**
   * Get the appropriate block message based on the block reason
   */
  getBlockMessage(): { icon: string; text: string; showButton: boolean } {
    if (!this.activeAgentId) {
      return {
        icon: '🤖',
        text: 'Nenhum agente selecionado. Adicione um agente para começar.',
        showButton: false
      };
    }
    if (!this.activeAgentCwd) {
      return {
        icon: '🔒',
        text: 'Chat bloqueado. Defina o diretório de trabalho primeiro.',
        showButton: true
      };
    }
    return {
      icon: '',
      text: '',
      showButton: false
    };
  }

  /**
   * Open CWD definition modal
   */
  openCwdDefinitionModal(): void {
    this.tempCwd = this.activeAgentCwd || '';
    this.modalStateService.open('cwdModal');
  }

  /**
   * Close CWD definition modal
   */
  closeCwdModal(): void {
    this.modalStateService.close('cwdModal');
    this.tempCwd = '';
  }

  /**
   * Save CWD for the active agent
   */
  saveCwd(): void {
    if (this.tempCwd.trim() && this.activeAgentId) {
      const newCwd = this.tempCwd.trim();

      console.log('💾 [CHAT] Saving CWD:');
      console.log('   - Instance ID:', this.activeAgentId);
      console.log('   - CWD:', newCwd);

      // Save to MongoDB via AgentService
      this.subscriptions.add(
        this.agentService.updateInstanceCwd(this.activeAgentId, newCwd).subscribe({
          next: (result) => {
            console.log('✅ [CHAT] CWD saved to MongoDB:', result);

            // Update local state
            this.activeAgentCwd = newCwd;

            // Also store in localStorage as backup
            localStorage.setItem(`agent-cwd-${this.activeAgentId}`, newCwd);

            this.closeCwdModal();
          },
          error: (error) => {
            console.error('❌ [CHAT] MongoDB save failed:', error);

            // Fallback: use localStorage if MongoDB fails
            console.warn('⚠️ [CHAT] Usando localStorage como fallback');

            // Update local state
            this.activeAgentCwd = newCwd;

            // Store in localStorage
            localStorage.setItem(`agent-cwd-${this.activeAgentId}`, newCwd);

            console.log('✅ [CHAT] CWD saved to localStorage (fallback)');

            // Close modal - localStorage worked fine
            this.closeCwdModal();
          }
        })
      );
    }
  }

  /**
   * Toggle agent options menu
   */
  toggleAgentOptionsMenu(event?: MouseEvent): void {
    if (event) {
      const button = event.currentTarget as HTMLElement;
      const rect = button.getBoundingClientRect();

      // Store position for menu positioning
      this.menuPosition = {
        top: rect.top,
        left: rect.right + 10 // 10px margin from button
      };
    }
    this.modalStateService.toggle('agentOptionsMenu');
  }

  /**
   * Emit event to request adding a new agent
   */
  onAddAgentClick(): void {
    this.addAgentRequested.emit();
  }

  /**
   * Emit event to request deleting the active agent
   */
  onDeleteAgentClick(): void {
    this.deleteAgentRequested.emit();
  }

  /**
   * 🔥 NOVO: Emit event to request opening screenplay modal
   */
  onOpenScreenplayClick(): void {
    console.log('📝 [CHAT] Botão de roteiro clicado, emitindo evento...');
    this.openScreenplayModalRequested.emit();
    console.log('   - Evento openScreenplayModalRequested emitido');
  }

  /**
   * 🔥 NOVO: Toggle visibility da sidebar de conversas
   * Circula entre: compact → full → hidden → compact
   */
  onToggleSidebarClick(): void {
    // Circular entre os três estados
    const previousState = this.sidebarState;

    if (this.sidebarState === 'compact') {
      this.sidebarState = 'full';
    } else if (this.sidebarState === 'full') {
      this.sidebarState = 'hidden';
    } else {
      this.sidebarState = 'compact';
    }

    console.log('🔄 [SIDEBAR] Transição:', previousState, '→', this.sidebarState);

    // 🔄 Recarregar conversas ao tornar a sidebar visível
    if (this.sidebarState !== 'hidden') {
      // Pequeno delay para permitir que o componente seja renderizado
      setTimeout(() => {
        this.refreshConversationList();
      }, 100);
    }

    // 📱 Salvar estado da sidebar
    this.saveMobileSidebarState();
  }

  /**
   * 🔥 NOVO: Mostra conversas compactas (hidden → compact)
   */
  showCompactConversations(): void {
    this.sidebarState = 'compact';
    console.log('💬 [SIDEBAR] Conversas compactas visíveis');
    this.saveMobileSidebarState();

    // 🔥 Carregar conversas quando mostrar pela primeira vez
    if (this.activeScreenplayId && this._conversations.length === 0) {
      this.loadConversations();
    }
  }

  /**
   * 🔥 NOVO: Cria nova conversa SEM expandir a sidebar
   */
  createNewConversationWithoutExpanding(): void {
    // Simplesmente delega para o método existente sem mudar o estado
    this.onCreateNewConversation();
    console.log('➕ [SIDEBAR] Nova conversa criada (sidebar permanece compact)');
  }

  /**
   * 🔥 NOVO: Solicita toggle da primeira coluna (menu lateral)
   */
  onToggleFirstColumnClick(): void {
    this.toggleFirstColumnRequested.emit();
  }

  /**
   * 📱 Detectar se está no mobile (portrait mode com width <= 768px)
   */
  isMobile(): boolean {
    return window.innerWidth <= 768 && window.matchMedia('(orientation: portrait)').matches;
  }

  /**
   * 🔥 NOVO: Getter para acessar conversas do componente filho ou da lista local
   */
  get conversations(): any[] {
    // Se o conversationListComponent estiver disponível (modo full), usar dele
    if (this.conversationListComponent?.conversations) {
      return this.conversationListComponent.conversations;
    }
    // Caso contrário, usar a lista local (modo compacto)
    return this._conversations;
  }

  /**
   * 🔥 NOVO: Retorna a inicial do título da conversa para exibir na dock compacta
   */
  getConversationInitial(title: string): string {
    if (!title) return '?';

    // Remove espaços e pega a primeira letra maiúscula
    const firstChar = title.trim()[0];
    return firstChar ? firstChar.toUpperCase() : '?';
  }

  /**
   * 🔥 NOVO: Retorna o ícone correto para o botão de toggle baseado no estado atual
   */
  getConversationToggleIcon(): string {
    switch (this.sidebarState) {
      case 'hidden':
        return '💬'; // Mostrar
      case 'compact':
        return '⇄'; // Expandir
      case 'full':
        return '◀'; // Compactar/Esconder
      default:
        return '💬';
    }
  }

  /**
   * 🔥 NOVO: Retorna o título correto para o botão de toggle baseado no estado atual
   */
  getConversationToggleTitle(): string {
    switch (this.sidebarState) {
      case 'hidden':
        return 'Mostrar conversas (compacto)';
      case 'compact':
        return 'Expandir conversas';
      case 'full':
        return 'Compactar conversas';
      default:
        return 'Conversas';
    }
  }

  /**
   * 📱 Salvar estado da sidebar no localStorage
   */
  private saveMobileSidebarState(): void {
    const sidebarState = {
      state: this.sidebarState,
      timestamp: new Date().toISOString()
    };

    localStorage.setItem('chat-sidebar-state', JSON.stringify(sidebarState));
    console.log('💾 [SIDEBAR] Estado salvo:', sidebarState);
  }

  /**
   * 📱 Restaurar estado da sidebar do localStorage
   */
  private restoreMobileSidebarState(): void {
    // 🔥 No mobile portrait, começar sempre com sidebar hidden
    if (this.isMobile()) {
      this.sidebarState = 'hidden';
      console.log('📱 [SIDEBAR] Mobile portrait detectado, iniciando com sidebar hidden');
      return;
    }

    const savedState = localStorage.getItem('chat-sidebar-state');
    if (!savedState) {
      console.log('💾 [SIDEBAR] Nenhum estado salvo encontrado, usando default: compact');
      return;
    }

    try {
      const parsed = JSON.parse(savedState);
      const state = parsed.state;

      // Validar estado
      if (state === 'hidden' || state === 'compact' || state === 'full') {
        this.sidebarState = state;
        console.log('💾 [SIDEBAR] Estado restaurado:', this.sidebarState);
      } else {
        console.warn('⚠️ [SIDEBAR] Estado inválido no localStorage, usando default');
      }
    } catch (error) {
      console.error('❌ [SIDEBAR] Erro ao restaurar estado:', error);
      localStorage.removeItem('chat-sidebar-state');
    }
  }

  /**
   * Emit event when an agent is clicked in the dock
   */
  onDockAgentClick(agent: any): void {
    this.agentDockClicked.emit(agent);
  }

  /**
   * Handle message deletion with optimistic update + rollback
   * Deletes the entire iteration (user question + bot response)
   */
  async onMessageDeleted(message: Message): Promise<void> {
    if (!message.id || !this.activeConversationId) {
      console.warn('Cannot delete message without id or conversation_id');
      return;
    }

    // Find the user message that precedes this bot message
    const messageIndex = this.chatState.messages.findIndex(m => m.id === message.id);
    let userMessage: Message | null = null;

    // Look backwards to find the most recent user message
    for (let i = messageIndex - 1; i >= 0; i--) {
      if (this.chatState.messages[i].type === 'user') {
        userMessage = this.chatState.messages[i];
        break;
      }
    }

    // Prepare for rollback
    const originalBotDeletedState = message.isDeleted;
    const originalUserDeletedState = userMessage?.isDeleted;

    // Optimistic update: mark both messages as deleted in UI immediately
    message.isDeleted = true;
    if (userMessage) {
      userMessage.isDeleted = true;
    }

    try {
      const gatewayUrl = this.config.api.baseUrl || 'http://localhost:8080';

      // Delete bot message
      const botResponse = await fetch(`${gatewayUrl}/api/conversations/${this.activeConversationId}/messages/${message.id}/delete`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!botResponse.ok) {
        throw new Error(`Failed to delete bot message: ${botResponse.statusText}`);
      }

      console.log('✅ Bot message marked as deleted');

      // Delete user message if found
      if (userMessage && userMessage.id) {
        const userResponse = await fetch(`${gatewayUrl}/api/conversations/${this.activeConversationId}/messages/${userMessage.id}/delete`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (!userResponse.ok) {
          console.warn('⚠️ Failed to delete user message:', userResponse.statusText);
          // Don't throw - bot message is already deleted
        } else {
          console.log('✅ User message marked as deleted');
        }
      }

    } catch (error) {
      // Rollback on error
      console.error('❌ Error deleting iteration, rolling back:', error);
      message.isDeleted = originalBotDeletedState;
      if (userMessage) {
        userMessage.isDeleted = originalUserDeletedState || false;
      }

      // Show error notification to user
      alert('Erro ao inativar iteração. Por favor, tente novamente.');
    }
  }

  /**
   * Toggle dock info modal
   */
  toggleDockInfoModal(): void {
    this.modalStateService.toggle('dockInfoModal');
  }

  /**
   * Toggle header info modal (removed - use toggleDockInfoModal instead)
   */

  // ==========================================
  // 🔥 NOVO: Métodos de Gerenciamento de Conversas
  // ==========================================

  /**
   * Cria uma nova conversa
   */
  onCreateNewConversation(): void {
    console.log('🆕 [CHAT] Criando nova conversa...');

    // 🔒 FIX: Nova conversa deve começar vazia, sem agentes
    // O usuário deve adicionar agentes explicitamente via botão "➕ Adicionar Agente"
    const title = `Conversa ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

    this.conversationService.createConversation({
      title,
      active_agent: undefined,
      screenplay_id: this.activeScreenplayId || undefined
    }).subscribe({
      next: (response) => {
        console.log('✅ [CHAT] Nova conversa criada:', response.conversation_id);
        this.activeConversationId = response.conversation_id;
        this.activeConversationChanged.emit(this.activeConversationId); // 🔥 NOVO: Notificar mudança

        // 🔒 FIX: Limpar estado do agente ao criar nova conversa vazia
        this.activeAgentId = null;
        this.selectedAgentDbId = null;
        this.selectedAgentName = null;
        this.selectedAgentEmoji = null;
        this.activeAgentCwd = null;

        this.chatState.messages = [{
          id: `empty-${Date.now()}`,
          content: 'Nova conversa iniciada. Selecione um agente e comece a conversar!',
          type: 'system',
          timestamp: new Date()
        }];

        // Refresh the conversation list
        this.refreshConversationList();
      },
      error: (error) => {
        console.error('❌ [CHAT] Erro ao criar conversa:', error);
      }
    });
  }

  /**
   * Cria uma nova conversa automaticamente quando um novo roteiro é criado
   * Similar ao onCreateNewConversation(), mas sem interação do usuário
   */
  createNewConversationForScreenplay(): void {
    console.log('🆕 [CHAT] Criando nova conversa para novo roteiro...');

    const title = `Roteiro ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

    this.conversationService.createConversation({
      title,
      active_agent: undefined, // Agente será criado automaticamente pelo screenplay-interactive
      screenplay_id: this.activeScreenplayId || undefined
    }).subscribe({
      next: (response) => {
        console.log('✅ [CHAT] Nova conversa criada para roteiro:', response.conversation_id);
        this.activeConversationId = response.conversation_id;
        this.activeConversationChanged.emit(this.activeConversationId); // Notificar mudança
        this.chatState.messages = [];

        // Refresh the conversation list
        this.refreshConversationList();
      },
      error: (error) => {
        console.error('❌ [CHAT] Erro ao criar conversa para roteiro:', error);
      }
    });
  }

  /**
   * 🔥 NOVO: Método público para setar conversationId e emitir evento
   * Usado pelo ConversationManagementService para garantir que o evento seja disparado
   */
  setActiveConversation(conversationId: string | null): void {
    if (conversationId === this.activeConversationId) {
      console.log('ℹ️ [CHAT] Conversa já está ativa:', conversationId);
      return;
    }

    const previousConversationId = this.activeConversationId;
    console.log(`🔄 [CHAT] Trocando conversa ativa: ${previousConversationId} -> ${conversationId}`);

    // 🔥 LIMPEZA: Remover mapeamentos da conversa anterior para evitar mensagens SSE vazadas
    if (this.instanceToConversationMap.size > 0) {
      console.log(`🧹 [CHAT] Limpando ${this.instanceToConversationMap.size} mapeamento(s) da conversa anterior`);
      this.instanceToConversationMap.clear();
    }

    this.activeConversationId = conversationId;
    this.activeConversationChanged.emit(this.activeConversationId); // 🔥 Emite evento

    if (conversationId) {
      this.loadConversation(conversationId);
    }
  }

  /**
   * Seleciona uma conversa existente
   */
  onSelectConversation(conversationId: string): void {
    // Usa o método público para garantir consistência
    this.setActiveConversation(conversationId);
  }

  /**
   * Public method to select a conversation by ID (for external navigation)
   * Used by screenplay-interactive to navigate from ticker events
   */
  selectConversation(conversationId: string): void {
    console.log('🧭 [CHAT] Navegação externa - selecionando conversa:', conversationId);
    this.setActiveConversation(conversationId);
  }

  /**
   * Deleta uma conversa
   */
  onDeleteConversation(conversationId: string): void {
    console.log('🗑️ [CHAT] Deletando conversa:', conversationId);

    const wasActiveConversation = this.activeConversationId === conversationId;

    this.conversationService.deleteConversation(conversationId).subscribe({
      next: () => {
        console.log('✅ [CHAT] Conversa deletada com sucesso');

        // 🔥 Deletar estado de navegação do MongoDB
        if (this.activeScreenplayId) {
          this.navigationStateService.deleteConversationState(this.activeScreenplayId, conversationId);
        }

        // Refresh the conversation list primeiro
        this.refreshConversationList();

        // Se deletou a conversa ativa, selecionar a última conversa restante
        if (wasActiveConversation) {
          // Aguardar o refresh completar e selecionar última conversa
          setTimeout(() => {
            this.selectLastConversationAfterDelete();
          }, 100);
        }
      },
      error: (error) => {
        console.error('❌ [CHAT] Erro ao deletar conversa:', error);
      }
    });
  }

  /**
   * 🔥 NOVO: Seleciona a última conversa após deletar a ativa
   */
  private selectLastConversationAfterDelete(): void {
    if (this._conversations.length > 0) {
      // Selecionar a última conversa (mais recente)
      const lastConversation = this._conversations[0]; // Já vem ordenado por data
      console.log('🔄 [CHAT] Selecionando última conversa após delete:', lastConversation.conversation_id);
      this.setActiveConversation(lastConversation.conversation_id);
    } else {
      // Sem conversas restantes, limpar o chat
      console.log('🔄 [CHAT] Sem conversas restantes, limpando chat');
      this.activeConversationId = null;
      this.activeConversationChanged.emit(null);
      this.chatState.messages = [{
        id: `empty-${Date.now()}`,
        content: 'Selecione uma conversa ou crie uma nova.',
        type: 'system',
        timestamp: new Date()
      }];
    }
  }

  /**
   * Abre o modal de edição de contexto para uma conversa específica
   */
  onContextEditRequested(conversationId: string): void {
    console.log('📝 [CHAT] Editando contexto da conversa:', conversationId);

    // Se não for a conversa ativa, selecionar ela primeiro
    if (this.activeConversationId !== conversationId) {
      this.onSelectConversation(conversationId);
    }

    // Salvar contexto original para possível cancelamento
    this.originalContext = this.conversationContext;

    // Abrir o modal de contexto
    this.modalStateService.open('contextEditorModal');
  }

  /**
   * Atualiza a lista de conversas (chamado pelo componente pai ou por eventos)
   */
  refreshConversationList(): void {
    console.log('🔄 [CHAT] Atualizando lista de conversas');

    // Recarregar lista local
    this.loadConversations();

    // Atualizar componente filho se disponível
    if (this.conversationListComponent) {
      this.conversationListComponent.refresh();
    }
  }

  /**
   * Edit agent CWD from menu
   */
  editAgentCwd(): void {
    this.modalStateService.close('agentOptionsMenu');
    this.openCwdDefinitionModal();
  }

  /**
   * Edit persona from menu
   */
  editPersona(): void {
    this.modalStateService.close('agentOptionsMenu');

    // Verifica se há um agente ativo
    if (!this.activeAgentId) {
      console.warn('⚠️ [CHAT] Não é possível editar persona: nenhum agente ativo');
      return;
    }

    this.modalStateService.open('personaEditModal');
    console.log('✏️ [CHAT] Abrindo modal de edição de persona para agente:', this.activeAgentId);
  }

  /**
   * Close persona edit modal
   */
  closePersonaEditModal(): void {
    this.modalStateService.close('personaEditModal');
    console.log('✏️ [CHAT] Modal de edição de persona fechado');
  }

  /**
   * Handle persona saved event
   */
  onPersonaSaved(editedPersona: string): void {
    console.log('✅ [CHAT] Persona editada salva:', { 
      instanceId: this.activeAgentId, 
      personaLength: editedPersona.length 
    });
    
    // Atualiza o contexto local se necessário
    if (this.activeAgentContext) {
      this.activeAgentContext.persona = editedPersona;
    }
    
    this.closePersonaEditModal();
  }

  /**
   * Verifica se a persona foi editada
   */
  get isPersonaEdited(): boolean {
    return this.activeAgentId ? this.personaEditService.hasEditedPersona(this.activeAgentId) : false;
  }

  /**
   * Obtém a persona para exibição (editada ou original)
   */
  getDisplayPersona(): string {
    if (!this.activeAgentId || !this.activeAgentContext) {
      return '';
    }

    const editedPersona = this.personaEditService.loadPersona(this.activeAgentId);
    return editedPersona || this.activeAgentContext.persona;
  }

  /**
   * Restaura a persona original
   */
  restorePersona(): void {
    if (!this.activeAgentId) {
      console.warn('⚠️ [ConductorChat] Tentativa de restaurar persona sem agente ativo');
      return;
    }

    try {
      this.personaEditService.restoreOriginalPersona(this.activeAgentId);
      
      // Atualiza o contexto ativo
      if (this.activeAgentContext) {
        const originalPersona = this.personaEditService.getOriginalPersona(this.activeAgentId);
        if (originalPersona) {
          this.activeAgentContext.persona = originalPersona;
        }
      }
      
      console.log('✅ [ConductorChat] Persona original restaurada');
    } catch (error) {
      console.error('❌ [ConductorChat] Erro ao restaurar persona:', error);
    }
  }

  /**
   * View agent context from menu
   */
  viewAgentContext(): void {
    this.modalStateService.close('agentOptionsMenu');
    this.modalStateService.open('personaModal');
    console.log('📋 [CHAT] Abrindo modal de contexto do agente');
  }

  /**
   * View agent details from menu
   */
  viewAgentDetails(): void {
    this.modalStateService.close('agentOptionsMenu');

    const details = `
📋 Detalhes do Agente

🆔 Instance ID: ${this.activeAgentId || 'não definido'}
🤖 Agent ID: ${this.selectedAgentDbId || 'não definido'}
${this.selectedAgentEmoji || '🤖'} Nome: ${this.selectedAgentName || 'desconhecido'}
📁 Diretório: ${this.activeAgentCwd || 'não definido'}
✏️ Persona editada: ${this.activeAgentId ? this.personaEditService.hasEditedPersona(this.activeAgentId) ? 'Sim' : 'Não' : 'N/A'}
    `.trim();

    alert(details);
  }

  /**
   * Close options menu when clicking outside
   */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    // Close options menu if clicking outside
    if (!target.closest('.agent-options-menu') && !target.closest('.settings-btn')) {
      this.modalStateService.close('agentOptionsMenu');
    }
  }

  /**
   * Handle ESC key to close modals using ModalStateService
   */
  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(event: Event): void {
    // Usar o serviço para fechar o último modal aberto
    if (this.modalStateService.isAnyModalOpen()) {
      this.modalStateService.handleEscapeKey();
      event.preventDefault();
      event.stopPropagation();
    }
  }

  /**
   * 🔥 NOVO: Atalho Alt+B para esconder/mostrar conversas
   */
  @HostListener('document:keydown.alt.b', ['$event'])
  onToggleSidebarShortcut(event: Event): void {
    // Apenas ativa se a feature de conversas estiver habilitada
    if (this.environment.features?.useConversationModel) {
      event.preventDefault();
      event.stopPropagation();
      this.onToggleSidebarClick();
    }
  }

  /**
   * 🔥 NOVO: Atalho Alt+G para esconder/mostrar menu lateral
   */
  @HostListener('document:keydown.alt.g', ['$event'])
  onToggleFirstColumnShortcut(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.onToggleFirstColumnClick();
  }

  /**
   * Force save screenplay if it has unsaved changes before sending message
   * This prevents sending outdated data to the conductor
   */
  private forceSaveScreenplayIfNeeded(): void {
    // Check if we have an active screenplay ID and need to force save
    if (this.activeScreenplayId) {
      console.log('💾 [CHAT] Verificando se precisa forçar salvamento do screenplay...');

      // Emit a custom event to notify the screenplay component to force save
      const forceSaveEvent = new CustomEvent('forceSaveScreenplay', {
        detail: { screenplayId: this.activeScreenplayId }
      });

      // Dispatch the event on the document so the screenplay component can listen to it
      document.dispatchEvent(forceSaveEvent);

      console.log('📤 [CHAT] Evento forceSaveScreenplay disparado para screenplay:', this.activeScreenplayId);
    }
  }

  /**
   * Resize functionality - ONLY controls chat-input-area height (editor)
   * Footer with controls remains ALWAYS 60px fixed
   */
  onResizeStart(event: MouseEvent): void {
    event.preventDefault();
    this.isResizing = true;
    this.startY = event.clientY;

    // Get current height of chat-input-area (ONLY editor, not footer) in pixels
    const chatInputElement = document.querySelector('.chat-input-area') as HTMLElement;
    if (chatInputElement) {
      this.startHeight = chatInputElement.offsetHeight;
    }

    document.addEventListener('mousemove', this.onResizeMove);
    document.addEventListener('mouseup', this.onResizeEnd);

    // Add resizing class
    const handle = event.currentTarget as HTMLElement;
    handle.classList.add('resizing');
  }

  private onResizeMove = (event: MouseEvent): void => {
    if (!this.isResizing) return;

    // INVERTED: dragging UP increases editor area (more space for text), dragging DOWN decreases it
    // This feels more natural: pull handle up to get more text space
    const deltaY = this.startY - event.clientY; // INVERTED calculation
    const newHeight = this.startHeight + deltaY;

    // Set min and max heights for the INPUT AREA (editor only, controls are separate)
    // Min: 80px = ~2-3 lines of text with padding
    // Max: 400px = reasonable limit
    const minHeight = 80; // Minimum 80px (shows at least 2-3 lines)
    const maxHeight = 400; // Maximum 400px (reasonable limit for editor)

    const constrainedHeight = Math.min(Math.max(newHeight, minHeight), maxHeight);
    this.chatInputHeight = `${constrainedHeight}px`;
  };

  private onResizeEnd = (event: MouseEvent): void => {
    if (!this.isResizing) return;

    this.isResizing = false;
    document.removeEventListener('mousemove', this.onResizeMove);
    document.removeEventListener('mouseup', this.onResizeEnd);

    // Remove resizing class
    const handles = document.querySelectorAll('.resize-handle');
    handles.forEach(handle => handle.classList.remove('resizing'));
  };

  // ==========================================
  // 🔥 NOVO: Métodos de Contexto da Conversa
  // ==========================================

  toggleContextEditor(): void {
    this.modalStateService.toggle('contextEditor');
    if (this.modalStateService.isOpen('contextEditor')) {
      this.originalContext = this.conversationContext;
    }
  }

  saveConversationContext(): void {
    if (!this.activeConversationId) {
      console.error('❌ Nenhuma conversa ativa');
      return;
    }

    this.conversationService.updateConversationContext(this.activeConversationId, this.conversationContext).subscribe({
      next: (response) => {
        console.log('✅ Contexto atualizado:', response);
        this.modalStateService.close('contextEditor');
        this.modalStateService.close('contextEditorModal'); // Close modal version
        alert('Contexto salvo com sucesso! 🎉');
      },
      error: (error) => {
        console.error('❌ Erro ao atualizar contexto:', error);
        alert('Erro ao salvar contexto: ' + (error.error?.detail || error.message));
      }
    });
  }

  cancelContextEdit(): void {
    this.conversationContext = this.originalContext;
    this.modalStateService.close('contextEditor');
  }

  closeContextEditorModal(): void {
    this.conversationContext = this.originalContext;
    this.modalStateService.close('contextEditorModal');
  }

  openContextUpload(): void {
    this.contextFileInput?.nativeElement.click();
  }

  onContextFileSelected(event: any): void {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.md')) {
      alert('Por favor, selecione um arquivo .md');
      return;
    }

    if (!this.activeConversationId) {
      console.error('❌ Nenhuma conversa ativa');
      return;
    }

    this.conversationService.uploadContextFile(this.activeConversationId, file).subscribe({
      next: (response) => {
        console.log('✅ Arquivo carregado:', response);
        this.conversationContext = response.preview;

        // Carregar contexto completo da conversa
        this.loadConversationContext();

        alert(`Contexto carregado de ${response.filename} (${Math.round(response.size / 1024)}KB) 🎉`);
      },
      error: (error) => {
        console.error('❌ Erro ao fazer upload:', error);
        alert('Erro ao fazer upload: ' + (error.error?.detail || error.message));
      }
    });

    // Limpar o input
    event.target.value = '';
  }

  renderMarkdown(markdown: string): string {
    if (!markdown) return '';

    // Implementação básica de renderização de markdown
    // Para produção, considerar usar uma lib como marked.js
    let html = markdown;

    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // Bold
    html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');

    // Italic
    html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');

    // Code inline
    html = html.replace(/`(.*?)`/gim, '<code>$1</code>');

    // Links
    html = html.replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2" target="_blank">$1</a>');

    // Quebras de linha
    html = html.replace(/\n/gim, '<br>');

    return html;
  }

  /**
   * 🔥 NOVO: Handler para drag & drop de agentes no dock
   * Notifica o componente pai que a ordem mudou
   */
  onAgentDrop(event: CdkDragDrop<any[]>): void {
    if (event.previousIndex === event.currentIndex) {
      return; // Nenhuma mudança
    }

    console.log(`🔄 [AGENT-DRAG-DROP] Movendo agente de ${event.previousIndex} para ${event.currentIndex}`);

    // Criar cópia do array para não modificar o @Input diretamente
    const reorderedAgents = [...this.contextualAgents];

    // Reordenar localmente
    moveItemInArray(reorderedAgents, event.previousIndex, event.currentIndex);

    // Emitir evento para o componente pai com a nova ordem
    this.agentOrderChanged.emit(reorderedAgents);
  }

  /**
   * 🔥 NOVO: Handler para drag & drop de conversas no dock
   * Reordena as conversas localmente e persiste no backend
   */
  onConversationDrop(event: CdkDragDrop<any[]>): void {
    if (event.previousIndex === event.currentIndex) {
      return; // Nenhuma mudança
    }

    console.log(`🔄 [CONVERSATION-DRAG-DROP] Movendo conversa de ${event.previousIndex} para ${event.currentIndex}`);

    // Reordenar localmente
    moveItemInArray(this._conversations, event.previousIndex, event.currentIndex);

    // Persistir nova ordem no backend
    this.saveConversationOrder();

    // Emitir evento para o componente pai com a nova ordem
    this.conversationOrderChanged.emit(this._conversations);
  }

  /**
   * 🔥 NOVO: Salva ordem das conversas no MongoDB
   * Envia um array com conversation_id e display_order para cada conversa
   */
  private saveConversationOrder(): void {
    // Construir array de updates com base na posição atual
    const orderUpdates = this._conversations.map((conv, index) => ({
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

  /**
   * 🔥 NOVO: Carrega as conversas do screenplay ativo
   */
  private loadConversations(): void {
    if (!this.activeScreenplayId) {
      this._conversations = [];
      return;
    }

    console.log('🔄 [CONVERSATIONS] Carregando conversas do screenplay:', this.activeScreenplayId);

    this.conversationService.listConversations(100, 0, this.activeScreenplayId).subscribe({
      next: (response: any) => {
        // Ordenar por display_order se disponível, senão por updated_at
        this._conversations = response.conversations.sort((a: any, b: any) => {
          const aOrder = a.display_order;
          const bOrder = b.display_order;

          if (aOrder !== undefined && bOrder !== undefined) {
            return aOrder - bOrder;
          }

          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        });
        console.log(`✅ [CONVERSATIONS] ${this._conversations.length} conversas carregadas`);
      },
      error: (error: any) => {
        console.error('❌ [CONVERSATIONS] Erro ao carregar conversas:', error);
        this._conversations = [];
      }
    });
  }

  private loadConversationContext(): void {
    if (!this.activeConversationId) return;

    this.conversationService.getConversation(this.activeConversationId).subscribe({
      next: (conversation) => {
        this.conversationContext = conversation.context || '';
      },
      error: (error) => {
        console.error('❌ Erro ao carregar contexto da conversa:', error);
      }
    });
  }
}
