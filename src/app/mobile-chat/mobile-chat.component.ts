import { Component, OnInit, OnDestroy, ViewChild, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { Subscription } from 'rxjs';
import { ChatMessagesComponent } from '../shared/conductor-chat/components/chat-messages/chat-messages.component';
import { ChatInputComponent } from '../shared/conductor-chat/components/chat-input/chat-input.component';
import { StatusIndicatorComponent } from '../shared/conductor-chat/components/status-indicator/status-indicator.component';
import { PersonaEditModalComponent } from '../shared/persona-edit-modal/persona-edit-modal.component';
import { McpManagerModalComponent } from '../shared/mcp-manager-modal/mcp-manager-modal.component';
import { ConversationListComponent } from '../shared/conversation-list/conversation-list.component';
import { AgentSelectorModalComponent, AgentSelectionData } from '../living-screenplay-simple/agent-selector-modal/agent-selector-modal.component';
import { Message, ChatState, ChatMode, ConductorConfig } from '../shared/conductor-chat/models/chat.models';
import { ConversationService, Conversation, ConversationSummary, AgentInfo as ConvAgentInfo, Message as ConvMessage } from '../services/conversation.service';
import { AgentService, AgentContext } from '../services/agent.service';
import { NavigationStateService, NavigationState } from '../services/navigation-state.service';
import { MessageHandlingService, MessageParams, MessageHandlingCallbacks } from '../shared/conductor-chat/services/message-handling.service';
import { ModalStateService } from '../shared/conductor-chat/services/modal-state.service';
import { GamificationEventsService, GamificationEvent } from '../services/gamification-events.service';
import { ScreenplayStorage, ScreenplayListItem } from '../services/screenplay-storage';
import { NotificationService } from '../services/notification.service';
import { ConductorApiService } from '../shared/conductor-chat/services/conductor-api.service';
import { AgentExecutionService } from '../services/agent-execution';
import { SpeechRecognitionService } from '../shared/conductor-chat/services/speech-recognition.service';
import { environment } from '../../environments/environment';

import { ScreenplayViewerModalComponent } from './modals/screenplay-viewer-modal.component';
import { ScreenplaySelectorModalComponent } from './modals/screenplay-selector-modal.component';
import { ScreenplayEditorModalComponent } from './modals/screenplay-editor-modal.component';
import { AgentEventsModalComponent } from './modals/agent-events-modal.component';

const DEFAULT_CONFIG: ConductorConfig = {
  api: { baseUrl: '', endpoint: '/execute', streamEndpoint: '/api/v1/stream-execute', apiKey: 'test-api-key-123', timeout: 1800000, retryAttempts: 3 },
  mode: 'ask',
  welcomeMessage: 'Bem-vindo ao Conductor Mobile! Selecione um roteiro para comecar.',
  autoScroll: true,
  maxMessages: 100
};

@Component({
  selector: 'app-mobile-chat',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DragDropModule,
    ChatMessagesComponent,
    ChatInputComponent,
    StatusIndicatorComponent,
    PersonaEditModalComponent,
    McpManagerModalComponent,
    ConversationListComponent,
    AgentSelectorModalComponent,
    ScreenplayViewerModalComponent,
    ScreenplaySelectorModalComponent,
    ScreenplayEditorModalComponent,
    AgentEventsModalComponent
  ],
  template: `
    <div class="mobile-chat-root">
      <!-- TOP BAR -->
      <div class="top-bar">
        <button class="top-btn" (click)="onToggleSidebar()" title="Conversas">
          <span>{{ sidebarState === 'hidden' ? '☰' : '✕' }}</span>
        </button>
        <div class="top-title" (click)="showScreenplayViewer = !!activeScreenplayId">
          <app-status-indicator
            [isConnected]="chatState.isConnected"
            [isLoading]="chatState.isLoading"
          />
          <span class="screenplay-name">{{ activeScreenplayTitle || 'Selecionar Roteiro' }}</span>
        </div>
        <button class="top-btn events-btn" (click)="showAgentEvents = true" title="Eventos dos Agentes">
          <span>🔔</span>
          <span class="badge" *ngIf="resultEventCount > 0">{{ resultEventCount > 99 ? '99+' : resultEventCount }}</span>
        </button>
        <button class="top-btn events-btn" (click)="showDebugEvents = true" title="Eventos de Debug">
          <span>🐛</span>
          <span class="badge" *ngIf="debugEventCount > 0">{{ debugEventCount > 99 ? '99+' : debugEventCount }}</span>
        </button>
      </div>

      <!-- MAIN AREA -->
      <div class="main-area">
        <!-- CONVERSATION DOCK (left) -->
        <div
          class="conv-dock"
          [class.hidden]="sidebarState === 'hidden'"
          [class.compact]="sidebarState === 'compact'"
          [class.full]="sidebarState === 'full'">

          <!-- COMPACT DOCK -->
          <div class="dock-compact" *ngIf="sidebarState === 'compact'">
            <button class="dock-btn screenplay-btn" (click)="showScreenplaySelector = true" title="Selecionar roteiro">📝</button>
            <button class="dock-btn add-conv-btn" [disabled]="!activeScreenplayId" (click)="onCreateNewConversation()" title="Nova conversa">➕</button>
            <button class="dock-btn del-conv-btn" [disabled]="!activeConversationId" (click)="confirmDeleteConversation()" title="Excluir conversa">🗑️</button>
            <div class="dock-divider"></div>
            <div class="dock-divider"></div>
            <div
              class="dock-conv-list"
              cdkDropList
              cdkDropListLockAxis="y"
              (cdkDropListDropped)="onConversationDrop($event)">
              <div *ngFor="let conv of conversations" class="dock-conv-wrapper" cdkDrag [cdkDragStartDelay]="200">
                <div class="dock-conv-preview" *cdkDragPreview>{{ getConversationInitial(conv.title) }}</div>
                <div class="dock-conv-placeholder" *cdkDragPlaceholder></div>
                <button
                  class="dock-conv-item"
                  [class.active]="conv.conversation_id === activeConversationId"
                  [title]="conv.title"
                  (click)="onSelectConversation(conv.conversation_id)">
                  {{ getConversationInitial(conv.title) }}
                </button>
              </div>
            </div>
          </div>

          <!-- FULL SIDEBAR (modal on mobile) -->
          <div class="dock-full" *ngIf="sidebarState === 'full'">
            <div class="dock-full-header">
              <h3>Conversas</h3>
              <button class="close-sidebar-btn" (click)="sidebarState = 'compact'">✕</button>
            </div>
            <app-conversation-list
              [activeConversationId]="activeConversationId"
              [screenplayId]="activeScreenplayId"
              [agentInstances]="contextualAgents"
              (conversationSelected)="onSelectConversation($event); sidebarState = 'compact'"
              (conversationCreated)="onCreateNewConversation()"
              (conversationDeleted)="onDeleteConversation($event)">
            </app-conversation-list>
          </div>
        </div>

        <!-- CHAT COLUMN -->
        <div class="chat-column">
          <!-- CONVERSATION INFO BAR -->
          <div class="conv-info-bar" *ngIf="activeConversationId" (click)="openConvEditModal()">
            <span class="conv-info-title">{{ activeConversationTitle || 'Sem titulo' }}</span>
            <span class="conv-info-edit">✎</span>
          </div>

          <!-- CHAT MESSAGES -->
          <div class="chat-messages-area">
            <app-chat-messages
              [messages]="visibleMessages"
              [isLoading]="chatState.isLoading"
              [progressMessage]="progressMessage"
              [streamingMessage]="streamingMessage"
              [autoScroll]="config.autoScroll"
              [activeInstanceId]="activeAgentId || ''"
              [activeConversationId]="activeConversationId || ''"
              (messageToggled)="onMessageToggled($event)"
              (messageHidden)="onMessageHidden($event)"
            />
          </div>

          <!-- AGENT DOCK (horizontal) -->
          <div class="agent-dock">
            <div
              class="agent-dock-list"
              cdkDropList
              cdkDropListOrientation="horizontal"
              (cdkDropListDropped)="onAgentDrop($event)">
              <div *ngFor="let agent of contextualAgents" class="agent-dock-wrapper" cdkDrag [cdkDragStartDelay]="200">
                <div class="agent-drag-preview" *cdkDragPreview>{{ agent.emoji }}</div>
                <div class="agent-drag-placeholder" *cdkDragPlaceholder></div>
                <button
                  class="agent-dock-item"
                  [class.active]="activeAgentId === agent.id"
                  [title]="agent.definition?.title || agent.emoji"
                  (click)="onDockAgentClick(agent)">
                  {{ agent.emoji }}
                </button>
              </div>
            </div>
            <div class="agent-dock-spacer"></div>
            <button class="agent-dock-btn del-agent" (click)="confirmDeleteAgent()" [disabled]="!activeAgentId" title="Remover agente">🗑️</button>
            <button class="agent-dock-btn add-agent" (click)="showAgentSelector = true" [disabled]="!activeConversationId" title="Adicionar agente">➕</button>
            <button
              class="agent-dock-btn settings-btn"
              *ngIf="activeAgentId"
              (click)="showAgentOptions = !showAgentOptions"
              title="Opcoes do agente">
              ⚙️
            </button>
          </div>

          <!-- AGENT OPTIONS POPUP -->
          <div class="agent-options-popup" *ngIf="showAgentOptions" (click)="showAgentOptions = false">
            <div class="agent-options-menu" (click)="$event.stopPropagation()">
              <button class="opt-item" (click)="showAgentOptions = false; modalStateService.open('personaEditModal')">✏️ Editar Persona</button>
              <button class="opt-item" (click)="showAgentOptions = false; modalStateService.open('mcpManagerModal')">🔌 Gerenciar MCPs</button>
              <button class="opt-item" (click)="showAgentOptions = false; onDeleteAgentClick()">🗑️ Remover Agente</button>
            </div>
          </div>

          <!-- CHAT INPUT -->
          <div class="chat-input-area">
            <div class="input-blocked" *ngIf="isInputBlocked()">
              <span>{{ getBlockMessage() }}</span>
            </div>
            <app-chat-input
              [isLoading]="chatState.isLoading"
              (messageContentChanged)="onMessageContentChanged($event)"
              (enterPressed)="sendMessage()"
              (contentHeightChanged)="onContentHeightChanged($event)"
            />
          </div>

          <!-- CHAT FOOTER -->
          <div class="chat-footer">
            <span class="footer-agent-name" *ngIf="selectedAgentName && activeAgentId">{{ selectedAgentName }}</span>
            <div class="footer-spacer"></div>
            <button
              class="footer-btn mode-btn"
              [class.agent-mode]="currentMode === 'agent'"
              (click)="toggleMode()"
              [disabled]="chatState.isLoading"
              [title]="currentMode === 'ask' ? 'Modo Ask' : 'Modo Agent'">
              {{ currentMode === 'ask' ? '💬' : '🤖' }}
            </button>
            <button
              class="footer-btn mic-btn"
              [class.recording]="isRecording"
              (click)="toggleRecording()"
              [disabled]="chatState.isLoading || !speechSupported"
              [title]="isRecording ? 'Parar gravacao' : 'Gravar audio'">
              {{ isRecording ? '🔴' : '🎤' }}
            </button>
            <button
              class="footer-btn provider-btn"
              (click)="cycleProvider()"
              [disabled]="chatState.isLoading"
              [title]="'Provider: ' + getProviderLabel()">
              {{ getProviderLabel() }}
            </button>
            <button
              class="footer-btn send-btn"
              (click)="sendMessage()"
              [disabled]="chatState.isLoading || isEditorEmpty()">
              {{ chatState.isLoading ? '⏳' : '⬆️' }}
            </button>
          </div>
        </div>
      </div>

      <!-- MODALS -->
      <app-screenplay-selector-modal
        [isVisible]="showScreenplaySelector"
        [activeScreenplayId]="activeScreenplayId"
        (screenplaySelected)="onScreenplaySelected($event); showScreenplaySelector = false"
        (editScreenplay)="onEditScreenplay($event)"
        (closeModal)="showScreenplaySelector = false">
      </app-screenplay-selector-modal>

      <app-screenplay-viewer-modal
        [isVisible]="showScreenplayViewer"
        [screenplayId]="activeScreenplayId"
        (closeModal)="showScreenplayViewer = false">
      </app-screenplay-viewer-modal>

      <app-screenplay-editor-modal
        [isVisible]="showScreenplayEditor"
        [screenplayId]="editorScreenplayId"
        (saved)="onScreenplayEditorSaved($event)"
        (closeModal)="showScreenplayEditor = false">
      </app-screenplay-editor-modal>

      <app-agent-events-modal
        [isVisible]="showAgentEvents"
        [filterMode]="'result'"
        (closeModal)="showAgentEvents = false">
      </app-agent-events-modal>

      <app-agent-events-modal
        [isVisible]="showDebugEvents"
        [filterMode]="'debug'"
        (closeModal)="showDebugEvents = false">
      </app-agent-events-modal>

      <app-agent-selector-modal
        [isVisible]="showAgentSelector"
        [screenplayWorkingDirectory]="screenplayWorkingDirectory"
        (agentSelected)="onAgentSelected($event)"
        (closeModal)="showAgentSelector = false">
      </app-agent-selector-modal>

      <app-persona-edit-modal
        [isVisible]="modalStateService.isOpen('personaEditModal')"
        [instanceId]="activeAgentId"
        [agentId]="selectedAgentDbId"
        [currentPersona]="activeAgentContext?.persona || ''"
        (closeModal)="modalStateService.close('personaEditModal')"
        (personaSaved)="onPersonaSaved($event)">
      </app-persona-edit-modal>

      <app-mcp-manager-modal
        [isVisible]="modalStateService.isOpen('mcpManagerModal')"
        [instanceId]="activeAgentId"
        [instanceName]="selectedAgentName || ''"
        (closeModal)="modalStateService.close('mcpManagerModal')"
        (mcpsSaved)="onMcpsSaved($event)">
      </app-mcp-manager-modal>

      <!-- CONVERSATION EDIT MODAL -->
      <div class="conv-edit-backdrop" *ngIf="showConvEditModal" (click)="showConvEditModal = false">
        <div class="conv-edit-modal" (click)="$event.stopPropagation()" (touchstart)="$event.stopPropagation()" (touchend)="$event.stopPropagation()">
          <div class="conv-edit-header">
            <h3>Editar Conversa</h3>
            <button class="conv-edit-close" (click)="showConvEditModal = false">✕</button>
          </div>
          <div class="conv-edit-body">
            <label class="conv-edit-label">Titulo</label>
            <input
              class="conv-edit-input"
              type="text"
              inputmode="text"
              enterkeyhint="next"
              [(ngModel)]="editConvTitle"
              maxlength="100"
              placeholder="Titulo da conversa"
              (touchend)="$event.stopPropagation()">
            <label class="conv-edit-label">Contexto</label>
            <textarea
              class="conv-edit-textarea"
              inputmode="text"
              enterkeyhint="done"
              [(ngModel)]="editConvContext"
              rows="4"
              placeholder="Contexto markdown (opcional)"
              (touchend)="$event.stopPropagation()"></textarea>
          </div>
          <div class="conv-edit-footer">
            <button class="conv-edit-cancel" (click)="showConvEditModal = false">Cancelar</button>
            <button class="conv-edit-save" (click)="saveConversationEdit()" [disabled]="!editConvTitle || editConvTitle.trim().length < 3">Salvar</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    /* ================================================ */
    /* ROOT - Full viewport mobile-first */
    /* ================================================ */
    :host {
      display: block;
      position: fixed;
      inset: 0;
      overflow: hidden;
    }

    .mobile-chat-root {
      position: fixed;
      inset: 0;
      display: flex;
      flex-direction: column;
      background: #f8f9fa;
      overflow: hidden;
    }

    /* ================================================ */
    /* TOP BAR - 56px */
    /* ================================================ */
    .top-bar {
      display: flex;
      align-items: center;
      height: 56px;
      min-height: 56px;
      padding: 0 8px;
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      gap: 4px;
      flex-shrink: 0;
      z-index: 10;
    }

    .top-btn {
      width: 44px;
      height: 44px;
      border: none;
      background: rgba(255, 255, 255, 0.15);
      color: white;
      border-radius: 10px;
      font-size: 20px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background 0.2s;
      position: relative;
    }

    .top-btn:hover {
      background: rgba(255, 255, 255, 0.25);
    }

    .top-btn:active {
      background: rgba(255, 255, 255, 0.35);
    }

    .events-btn {
      position: relative;
      width: 36px;
      height: 36px;
      font-size: 16px;
      border-radius: 8px;
    }

    .badge {
      position: absolute;
      top: 0px;
      right: 0px;
      background: #ef4444;
      color: white;
      font-size: 10px;
      font-weight: 700;
      min-width: 16px;
      height: 16px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 4px;
      line-height: 1;
    }

    .top-title {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      cursor: pointer;
      padding: 6px 8px;
      border-radius: 8px;
      transition: background 0.2s;
    }

    .top-title:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    .top-title app-status-indicator {
      flex-shrink: 0;
      display: inline-flex;
    }

    .screenplay-name {
      font-size: 15px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      min-width: 0;
    }

    /* ================================================ */
    /* MAIN AREA - flex: 1 */
    /* ================================================ */
    .main-area {
      flex: 1;
      display: flex;
      min-height: 0;
      overflow: hidden;
    }

    /* ================================================ */
    /* CONVERSATION DOCK (left) */
    /* ================================================ */
    .conv-dock {
      flex-shrink: 0;
      transition: width 0.25s ease;
      background: #f0f3f7;
      border-right: 1px solid #e1e4e8;
      overflow: hidden;
      z-index: 5;
    }

    .conv-dock.hidden {
      width: 0;
      border-right: none;
    }

    .conv-dock.compact {
      width: 62px;
    }

    .conv-dock.full {
      position: absolute;
      top: 56px;
      left: 0;
      bottom: 0;
      width: 85%;
      max-width: 320px;
      background: #fff;
      z-index: 100;
      box-shadow: 4px 0 20px rgba(0, 0, 0, 0.15);
    }

    @media (min-width: 768px) {
      .conv-dock.compact { width: 68px; }
      .conv-dock.full {
        position: relative;
        top: auto;
        left: auto;
        bottom: auto;
        width: 280px;
        max-width: none;
        box-shadow: none;
      }
    }

    @media (min-width: 1024px) {
      .conv-dock.compact { width: 72px; }
    }

    /* COMPACT DOCK INTERNALS */
    .dock-compact {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 10px 0;
      height: 100%;
      gap: 2px;
    }

    .dock-btn {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      border: 1px solid #e1e4e8;
      background: #fff;
      font-size: 18px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s;
      flex-shrink: 0;
    }

    .dock-btn:hover:not(:disabled) {
      transform: scale(1.08);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
    }

    .dock-btn:active:not(:disabled) {
      transform: scale(0.95);
    }

    .dock-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .dock-btn.screenplay-btn {
      background: #f3e8ff;
      border-color: #d8b4fe;
      margin-bottom: 6px;
    }

    .dock-btn.add-conv-btn {
      background: #f0fdf4;
      border-color: #86efac;
    }

    .dock-btn.del-conv-btn {
      background: #fef2f2;
      border-color: #fecaca;
      font-size: 14px;
    }

    .dock-divider {
      width: 32px;
      height: 1px;
      background: #e1e4e8;
      margin: 6px 0;
      flex-shrink: 0;
    }

    .dock-conv-list {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      overflow-x: hidden;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 4px 0;
      scrollbar-width: thin;
    }

    .dock-conv-wrapper { display: flex; justify-content: center; }

    .dock-conv-item {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      border: 1px solid #e1e4e8;
      background: #fff;
      font-size: 16px;
      font-weight: 600;
      color: #4a5568;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s;
    }

    .dock-conv-item:hover {
      border-color: #a8b9ff;
      transform: scale(1.08);
    }

    .dock-conv-item.active {
      background: #ebf4ff;
      border-color: #7c9ff6;
      box-shadow: 0 0 0 2px rgba(124, 159, 246, 0.3);
      color: #2c5aa0;
    }

    .dock-conv-preview {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      background: #667eea;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
    }

    .dock-conv-placeholder {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      border: 2px dashed #a8b9ff;
      background: #f0f4ff;
    }

    /* FULL SIDEBAR */
    .dock-full {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .dock-full-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid #e2e8f0;
    }

    .dock-full-header h3 {
      margin: 0;
      font-size: 16px;
      color: #1e293b;
    }

    .close-sidebar-btn {
      width: 32px;
      height: 32px;
      border: none;
      background: #f1f5f9;
      border-radius: 8px;
      font-size: 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* ================================================ */
    /* CHAT COLUMN */
    /* ================================================ */
    .chat-column {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
      min-height: 0;
      overflow: hidden;
      background: #fff;
    }

    /* CHAT MESSAGES AREA */
    .chat-messages-area {
      flex: 1;
      min-height: 0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    /* ================================================ */
    /* AGENT DOCK (horizontal) */
    /* ================================================ */
    .agent-dock {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      background: #f8f9fa;
      border-top: 1px solid #e2e8f0;
      overflow-x: auto;
      flex-shrink: 0;
      scrollbar-width: none;
    }

    .agent-dock::-webkit-scrollbar { display: none; }

    .agent-dock-btn {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      border: 1px solid #e1e4e8;
      background: #fff;
      font-size: 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: all 0.15s;
    }

    .agent-dock-btn:hover:not(:disabled) {
      transform: scale(1.1);
    }

    .agent-dock-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .agent-dock-btn.del-agent {
      background: #fef2f2;
      border-color: #fecaca;
      font-size: 14px;
    }

    .agent-dock-btn.add-agent {
      background: #f0fdf4;
      border-color: #86efac;
    }

    .agent-dock-btn.settings-btn {
      background: #f1f5f9;
    }

    .agent-dock-list {
      display: flex;
      gap: 6px;
      overflow-x: auto;
      scrollbar-width: none;
    }

    .agent-dock-list::-webkit-scrollbar { display: none; }

    .agent-dock-item {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      border: 1px solid #e1e4e8;
      background: #fff;
      font-size: 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: all 0.15s;
    }

    .agent-dock-item:hover {
      transform: scale(1.1);
      border-color: #a8b9ff;
    }

    .agent-dock-item.active {
      background: #ebf4ff;
      border-color: #764ba2;
      box-shadow: 0 0 0 2px rgba(118, 75, 162, 0.3);
    }

    /* ================================================ */
    /* AGENT OPTIONS POPUP */
    /* ================================================ */
    .agent-options-popup {
      position: fixed;
      inset: 0;
      z-index: 1500;
      background: rgba(0, 0, 0, 0.15);
    }

    .agent-options-menu {
      position: fixed;
      bottom: 170px;
      right: 12px;
      background: #fff;
      border-radius: 12px;
      min-width: 220px;
      padding: 4px 0;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
      z-index: 1501;
    }

    .opt-item {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 14px 20px;
      border: none;
      background: none;
      font-size: 15px;
      color: #1e293b;
      cursor: pointer;
      text-align: left;
      transition: background 0.15s;
    }

    .opt-item:hover {
      background: #f1f5f9;
    }

    .opt-item:active {
      background: #e2e8f0;
    }

    /* ================================================ */
    /* CHAT INPUT AREA */
    /* ================================================ */
    .chat-input-area {
      position: relative;
      min-height: 48px;
      max-height: 140px;
      border-top: 1px solid #e2e8f0;
      background: #fff;
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
    }

    .chat-input-area ::ng-deep app-chat-input,
    .chat-input-area ::ng-deep .chat-input-wrapper {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }

    .input-blocked {
      position: absolute;
      inset: 0;
      background: rgba(255, 255, 255, 0.9);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2;
      font-size: 13px;
      color: #94a3b8;
      text-align: center;
      padding: 8px;
    }

    /* ================================================ */
    /* CHAT FOOTER */
    /* ================================================ */
    .chat-footer {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 8px;
      padding-bottom: calc(4px + env(safe-area-inset-bottom, 0px));
      background: #f8f9fa;
      border-top: 1px solid #e2e8f0;
      flex-shrink: 0;
    }

    .footer-btn {
      width: 36px;
      height: 36px;
      border: none;
      border-radius: 10px;
      font-size: 18px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s;
      flex-shrink: 0;
    }

    .mode-btn {
      background: #f1f5f9;
    }

    .mode-btn.agent-mode {
      background: #fef3c7;
    }

    .mic-btn {
      background: #f1f5f9;
    }

    .mic-btn.recording {
      background: #fee2e2;
      animation: pulse-recording 1.5s ease-in-out infinite;
    }

    .mic-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    @keyframes pulse-recording {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.1); }
    }

    .send-btn {
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
    }

    .send-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .send-btn:hover:not(:disabled) {
      transform: scale(1.05);
      box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4);
    }

    .provider-btn {
      width: auto !important;
      padding: 0 10px;
      background: #f1f5f9;
      font-size: 11px !important;
      font-weight: 600;
      color: #475569;
      white-space: nowrap;
    }

    .footer-agent-name {
      font-size: 12px;
      font-weight: 500;
      color: #667eea;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      min-width: 0;
      max-width: 120px;
    }

    .footer-spacer {
      flex: 1;
    }

    /* ================================================ */
    /* CONVERSATION INFO BAR */
    /* ================================================ */
    .conv-info-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: #f8f9fa;
      border-bottom: 1px solid #e2e8f0;
      cursor: pointer;
      flex-shrink: 0;
      transition: background 0.15s;
    }

    .conv-info-bar:hover {
      background: #f0f3f7;
    }

    .conv-info-bar:active {
      background: #e8ecf1;
    }

    .conv-info-title {
      flex: 1;
      font-size: 14px;
      font-weight: 500;
      color: #475569;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      min-width: 0;
    }

    .conv-info-edit {
      font-size: 18px;
      color: #94a3b8;
      flex-shrink: 0;
    }

    /* ================================================ */
    /* AGENT DOCK ADDITIONS */
    /* ================================================ */
    .agent-dock-wrapper {
      display: flex;
      flex-shrink: 0;
    }

    .agent-drag-preview {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      background: #667eea;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }

    .agent-drag-placeholder {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      border: 2px dashed #a8b9ff;
      background: #f0f4ff;
    }

    .agent-dock-spacer {
      flex: 1;
    }

    /* ================================================ */
    /* CONVERSATION EDIT MODAL */
    /* ================================================ */
    .conv-edit-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      z-index: 2000;
      display: flex;
      align-items: stretch;
      justify-content: center;
      padding: 0;
    }

    .conv-edit-modal {
      width: 100%;
      height: 100%;
      background: #fff;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    @media (min-width: 768px) {
      .conv-edit-backdrop {
        align-items: center;
        padding: 24px;
      }
      .conv-edit-modal {
        width: 90%;
        max-width: 800px;
        height: 85vh;
        border-radius: 16px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      }
    }

    .conv-edit-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid #e2e8f0;
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      flex-shrink: 0;
    }

    .conv-edit-header h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
    }

    .conv-edit-close {
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

    .conv-edit-close:hover {
      background: rgba(255, 255, 255, 0.3);
    }

    .conv-edit-body {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      -webkit-overflow-scrolling: touch;
    }

    .conv-edit-label {
      font-size: 13px;
      font-weight: 600;
      color: #475569;
      margin-top: 8px;
    }

    .conv-edit-input {
      padding: 12px 14px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      font-size: 15px;
      outline: none;
      transition: border-color 0.2s;
    }

    .conv-edit-input:focus {
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    .conv-edit-textarea {
      padding: 12px 14px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      font-size: 14px;
      font-family: inherit;
      outline: none;
      resize: vertical;
      flex: 1;
      min-height: 120px;
      transition: border-color 0.2s;
      line-height: 1.6;
    }

    .conv-edit-textarea:focus {
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    .conv-edit-footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 12px 20px;
      padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
      border-top: 1px solid #e2e8f0;
      flex-shrink: 0;
    }

    .conv-edit-cancel {
      padding: 10px 20px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: #fff;
      color: #64748b;
      font-size: 14px;
      cursor: pointer;
    }

    .conv-edit-save {
      padding: 10px 24px;
      border: none;
      border-radius: 8px;
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
    }

    .conv-edit-save:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `]
})
export class MobileChatComponent implements OnInit, OnDestroy {
  @ViewChild(ChatInputComponent) chatInputComponent!: ChatInputComponent;
  @ViewChild(ConversationListComponent) conversationListComponent!: ConversationListComponent;

  // Chat state
  chatState: ChatState = { messages: [], isConnected: false, isLoading: false };
  currentMode: ChatMode = 'ask';
  config: ConductorConfig = DEFAULT_CONFIG;
  selectedProvider = '';

  // Navigation state
  activeScreenplayId: string | null = null;
  activeConversationId: string | null = null;
  activeScreenplayTitle = '';

  // Agent state
  activeAgentId: string | null = null;
  selectedAgentDbId: string | null = null;
  selectedAgentName: string | null = null;
  selectedAgentEmoji: string | null = null;
  activeAgentContext: AgentContext | null = null;
  activeAgentCwd: string | null = null;
  contextualAgents: any[] = [];
  screenplayWorkingDirectory: string | null = null;

  // Conversations
  conversations: ConversationSummary[] = [];

  // UI state
  sidebarState: 'compact' | 'full' | 'hidden' = 'compact';
  showScreenplayViewer = false;
  showScreenplaySelector = false;
  showScreenplayEditor = false;
  editorScreenplayId: string | null = null;
  showAgentEvents = false;
  showDebugEvents = false;
  showAgentSelector = false;
  showAgentOptions = false;
  showConvEditModal = false;
  resultEventCount = 0;
  debugEventCount = 0;
  isRecording = false;
  speechSupported = false;
  activeConversationTitle = '';
  editConvTitle = '';
  editConvContext = '';

  // Message handling
  private messageContent = '';
  private progressMessages: Map<string, Message | null> = new Map();
  private streamingMessages: Map<string, Message | null> = new Map();
  private instanceToConversationMap: Map<string, string> = new Map();

  private subscriptions = new Subscription();
  private connectionCheckInterval: any;

  get progressMessage(): Message | null {
    if (!this.activeAgentId) return null;
    return this.progressMessages.get(this.activeAgentId) || null;
  }

  get streamingMessage(): Message | null {
    if (!this.activeAgentId) return null;
    return this.streamingMessages.get(this.activeAgentId) || null;
  }

  get visibleMessages(): Message[] {
    return this.chatState.messages.filter(m => !m.isHidden);
  }

  constructor(
    private route: ActivatedRoute,
    private apiService: ConductorApiService,
    private agentService: AgentService,
    private agentExecutionService: AgentExecutionService,
    private conversationService: ConversationService,
    private messageHandlingService: MessageHandlingService,
    public modalStateService: ModalStateService,
    private navigationStateService: NavigationStateService,
    private gamificationEventsService: GamificationEventsService,
    private screenplayStorage: ScreenplayStorage,
    private notificationService: NotificationService,
    private speechService: SpeechRecognitionService
  ) {}

  // ==========================================
  // Lifecycle
  // ==========================================

  async ngOnInit(): Promise<void> {
    // Initialize navigation state
    const state = await this.navigationStateService.initialize(this.route);
    this.applyNavigationState(state);

    // Subscribe to navigation state changes
    this.subscriptions.add(
      this.navigationStateService.state$.subscribe(navState => {
        this.applyNavigationState(navState);
      })
    );

    // Subscribe to event counts
    this.subscriptions.add(
      this.gamificationEventsService.events$.subscribe(events => {
        this.resultEventCount = events.filter(e => e.level === 'result').length;
        this.debugEventCount = events.filter(e => e.level === 'debug').length;
      })
    );

    // Speech recognition
    this.speechSupported = this.speechService.isSupported;
    this.subscriptions.add(
      this.speechService.isRecording$.subscribe(recording => {
        this.isRecording = recording;
      })
    );
    this.subscriptions.add(
      this.speechService.transcript$.subscribe(text => {
        if (text && this.chatInputComponent) {
          this.chatInputComponent.insertText(text);
        }
      })
    );

    // Check connection
    this.checkConnectionStatus();
    this.connectionCheckInterval = setInterval(() => this.checkConnectionStatus(), 30000);

    // If no screenplay, show selector
    if (!this.activeScreenplayId) {
      this.showScreenplaySelector = true;
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
    }
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.showConvEditModal) { this.showConvEditModal = false; return; }
    if (this.showAgentOptions) { this.showAgentOptions = false; return; }
    if (this.showAgentEvents) { this.showAgentEvents = false; return; }
    if (this.showDebugEvents) { this.showDebugEvents = false; return; }
    if (this.showScreenplayEditor) { this.showScreenplayEditor = false; return; }
    if (this.showScreenplayViewer) { this.showScreenplayViewer = false; return; }
    if (this.showScreenplaySelector) { this.showScreenplaySelector = false; return; }
    if (this.showAgentSelector) { this.showAgentSelector = false; return; }
    this.modalStateService.handleEscapeKey();
  }

  // ==========================================
  // Navigation State
  // ==========================================

  private applyNavigationState(state: NavigationState): void {
    const screenplayChanged = state.screenplayId !== this.activeScreenplayId;
    const conversationChanged = state.conversationId !== this.activeConversationId;

    this.activeScreenplayId = state.screenplayId;
    this.activeConversationId = state.conversationId;

    if (screenplayChanged && state.screenplayId) {
      this.loadScreenplayTitle(state.screenplayId);
      this.loadConversations();
      this.loadAgentsForScreenplay(state.screenplayId);
    } else if (screenplayChanged && !state.screenplayId) {
      this.activeScreenplayTitle = '';
      this.conversations = [];
      this.contextualAgents = [];
    }

    if (conversationChanged && state.conversationId) {
      this.loadConversation(state.conversationId);
    } else if (conversationChanged && !state.conversationId) {
      this.chatState.messages = [];
      this.activeConversationTitle = '';
      this.clearAgentState();
    }
  }

  // ==========================================
  // Screenplay
  // ==========================================

  async onScreenplaySelected(screenplayId: string): Promise<void> {
    console.log('📝 [MOBILE] Screenplay selected:', screenplayId);
    await this.navigationStateService.setScreenplay(screenplayId);
  }

  onEditScreenplay(screenplayId: string | null): void {
    this.editorScreenplayId = screenplayId;
    this.showScreenplayEditor = true;
  }

  onScreenplayEditorSaved(screenplayId: string): void {
    // Reload selector list
    this.showScreenplaySelector = false;
    setTimeout(() => {
      this.showScreenplaySelector = true;
    }, 100);

    // If editing the active screenplay, reload title
    if (screenplayId === this.activeScreenplayId) {
      this.loadScreenplayTitle(screenplayId);
    }
  }

  private loadScreenplayTitle(id: string): void {
    this.screenplayStorage.getScreenplay(id).subscribe({
      next: (sp) => { this.activeScreenplayTitle = sp.name; },
      error: () => { this.activeScreenplayTitle = 'Roteiro'; }
    });
  }

  // ==========================================
  // Conversations
  // ==========================================

  onSelectConversation(conversationId: string): void {
    if (conversationId === this.activeConversationId) return;

    this.instanceToConversationMap.clear();
    this.activeConversationId = conversationId;
    this.navigationStateService.setConversationWithInstance(conversationId, null);
    this.loadConversation(conversationId);
  }

  onCreateNewConversation(): void {
    if (!this.activeScreenplayId) return;

    const title = `Conversa ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

    this.conversationService.createConversation({
      title,
      screenplay_id: this.activeScreenplayId
    }).subscribe({
      next: (response) => {
        this.activeConversationId = response.conversation_id;
        this.activeConversationTitle = title;
        this.navigationStateService.setConversationWithInstance(response.conversation_id, null);

        // Reset agent state for new conversation
        this.activeAgentId = null;
        this.selectedAgentDbId = null;
        this.selectedAgentName = null;
        this.selectedAgentEmoji = null;
        this.activeAgentCwd = null;

        this.chatState.messages = [{
          id: `empty-${Date.now()}`,
          content: 'Nova conversa. Selecione um agente e comece!',
          type: 'system',
          timestamp: new Date()
        }];

        this.loadConversations();
      },
      error: (err) => {
        console.error('❌ [MOBILE] Error creating conversation:', err);
      }
    });
  }

  confirmDeleteConversation(): void {
    if (!this.activeConversationId) return;
    const title = this.activeConversationTitle || 'esta conversa';
    if (confirm(`Excluir "${title}"?\n\nEsta acao nao pode ser desfeita.`)) {
      this.onDeleteConversation(this.activeConversationId);
    }
  }

  onDeleteConversation(conversationId: string): void {
    this.conversationService.deleteConversation(conversationId).subscribe({
      next: () => {
        this.navigationStateService.deleteConversationState(this.activeScreenplayId!, conversationId);

        if (this.activeConversationId === conversationId) {
          this.activeConversationId = null;
          this.activeConversationTitle = '';
          this.chatState.messages = [];
          this.activeAgentId = null;
          this.selectedAgentDbId = null;
          this.selectedAgentName = null;
          this.selectedAgentEmoji = null;
        }

        this.loadConversations();
      },
      error: (err) => {
        console.error('❌ [MOBILE] Error deleting conversation:', err);
      }
    });
  }

  private loadConversations(): void {
    if (!this.activeScreenplayId) {
      this.conversations = [];
      return;
    }

    this.conversationService.listConversations(100, 0, this.activeScreenplayId).subscribe({
      next: (response) => {
        this.conversations = response.conversations.sort((a, b) => {
          if (a.display_order !== undefined && b.display_order !== undefined) {
            return a.display_order - b.display_order;
          }
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        });
      },
      error: () => { this.conversations = []; }
    });
  }

  private loadConversation(conversationId: string): void {
    this.conversationService.getConversation(conversationId).subscribe({
      next: (conversation) => {
        this.activeConversationTitle = conversation.title || '';

        const messages: Message[] = conversation.messages.map((msg: ConvMessage) => ({
          id: msg.id,
          content: msg.content,
          type: msg.type as 'user' | 'bot' | 'system',
          timestamp: new Date(msg.timestamp),
          agent: msg.agent,
          isDeleted: (msg as any).isDeleted || false,
          isHidden: (msg as any).isHidden || false,
          status: (msg as any).status,
          task_id: (msg as any).task_id
        }));

        this.chatState.messages = messages.length > 0 ? messages : [{
          id: `empty-${Date.now()}`,
          content: 'Nenhuma interacao ainda. Inicie a conversa abaixo.',
          type: 'system',
          timestamp: new Date()
        }];

        // Set active agent from conversation
        if (conversation.active_agent) {
          const agentInList = this.contextualAgents.find((a: any) =>
            a.id === conversation.active_agent!.instance_id
          );
          const isDeleted = agentInList && (agentInList.isDeleted || agentInList.is_deleted);

          if (!isDeleted) {
            this.activeAgentId = conversation.active_agent.instance_id;
            this.selectedAgentDbId = conversation.active_agent.agent_id;
            this.selectedAgentName = conversation.active_agent.name;
            this.selectedAgentEmoji = conversation.active_agent.emoji || null;
            this.navigationStateService.setInstance(conversation.active_agent.instance_id);
            this.loadAgentContext(conversation.active_agent.instance_id);

            // Add agent to dock if not already present
            if (!agentInList) {
              this.contextualAgents = [...this.contextualAgents, {
                id: conversation.active_agent.instance_id,
                agent_id: conversation.active_agent.agent_id,
                emoji: conversation.active_agent.emoji || '🤖',
                definition: { title: conversation.active_agent.name, description: '', unicode: '' },
                status: 'pending' as const,
                position: { x: 0, y: 0 },
                config: { cwd: this.screenplayWorkingDirectory || undefined }
              }];
            }

            if (agentInList?.config?.cwd) {
              this.activeAgentCwd = agentInList.config.cwd;
            } else {
              this.activeAgentCwd = localStorage.getItem(`agent-cwd-${this.activeAgentId}`) || this.screenplayWorkingDirectory || null;
            }
          } else {
            this.clearAgentState();
          }
        } else {
          this.clearAgentState();
        }

        this.chatState.isLoading = false;
      },
      error: (err) => {
        console.error('❌ [MOBILE] Error loading conversation:', err);
        this.chatState.isLoading = false;
      }
    });
  }

  onConversationDrop(event: CdkDragDrop<any[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    moveItemInArray(this.conversations, event.previousIndex, event.currentIndex);

    const orderUpdates = this.conversations.map((c, i) => ({
      conversation_id: c.conversation_id,
      display_order: i
    }));
    this.conversationService.updateConversationOrder(orderUpdates).subscribe({
      error: () => { this.loadConversations(); }
    });
  }

  getConversationInitial(title: string): string {
    if (!title) return '?';
    return title.charAt(0).toUpperCase();
  }

  // ==========================================
  // Agents
  // ==========================================

  private loadAgentsForScreenplay(screenplayId: string): void {
    // Start with empty agent dock - agents are added via + button or loaded from conversation
    this.contextualAgents = [];

    // Load screenplay working directory
    this.screenplayStorage.getScreenplay(screenplayId).subscribe({
      next: (sp) => {
        this.screenplayWorkingDirectory = sp.working_directory || sp.workingDirectory || null;
      },
      error: () => { this.screenplayWorkingDirectory = null; }
    });
  }

  onDockAgentClick(agent: any): void {
    this.activeAgentId = agent.id;
    this.selectedAgentDbId = agent.agent_id;
    this.selectedAgentName = agent.definition?.title || agent.emoji;
    this.selectedAgentEmoji = agent.emoji;
    this.activeAgentCwd = agent.config?.cwd || localStorage.getItem(`agent-cwd-${agent.id}`) || this.screenplayWorkingDirectory || null;

    this.navigationStateService.setInstance(agent.id);
    this.loadAgentContext(agent.id);

    // Set active agent on conversation
    if (this.activeConversationId) {
      this.conversationService.setActiveAgent(this.activeConversationId, {
        agent_info: {
          agent_id: agent.agent_id,
          instance_id: agent.id,
          name: agent.definition?.title || agent.emoji,
          emoji: agent.emoji
        }
      }).subscribe();
    }
  }

  onAgentSelected(selectionData: AgentSelectionData): void {
    this.showAgentSelector = false;

    const { agent, instanceId, cwd } = selectionData;

    // Add the new instance to contextual agents
    const newAgent = {
      id: instanceId,
      agent_id: agent.id,
      emoji: agent.emoji,
      definition: { title: agent.name, description: agent.description, unicode: '' },
      status: 'pending' as const,
      position: { x: 0, y: 0 },
      config: { cwd }
    };

    this.contextualAgents = [...this.contextualAgents, newAgent];

    // Auto-select the new agent
    setTimeout(() => {
      this.onDockAgentClick(newAgent);
    }, 200);
  }

  confirmDeleteAgent(): void {
    if (!this.activeAgentId) return;
    const name = this.selectedAgentName || 'este agente';
    if (confirm(`Remover "${name}"?\n\nO agente sera removido da barra.`)) {
      this.onDeleteAgentClick();
    }
  }

  onDeleteAgentClick(): void {
    if (!this.activeAgentId) return;

    const instanceId = this.activeAgentId;

    // Remove from dock immediately
    this.contextualAgents = this.contextualAgents.filter(a => a.id !== instanceId);

    if (this.contextualAgents.length > 0) {
      this.onDockAgentClick(this.contextualAgents[0]);
    } else {
      this.clearAgentState();
    }

    // Try to delete on server (fire-and-forget)
    this.agentService.deleteInstance(instanceId, true).subscribe({
      error: (err) => {
        console.error('❌ [MOBILE] Error deleting agent on server:', err);
      }
    });
  }

  private loadAgentContext(instanceId: string): void {
    this.agentService.getAgentContext(instanceId).subscribe({
      next: (context: AgentContext) => {
        this.activeAgentContext = context;
        if (context.cwd && context.cwd !== '/app') {
          this.activeAgentCwd = context.cwd;
        }
      },
      error: () => {
        this.activeAgentContext = null;
      }
    });
  }

  private clearAgentState(): void {
    this.activeAgentId = null;
    this.selectedAgentDbId = null;
    this.selectedAgentName = null;
    this.selectedAgentEmoji = null;
    this.activeAgentCwd = null;
    this.activeAgentContext = null;
  }

  // ==========================================
  // Messages
  // ==========================================

  onMessageContentChanged(content: string): void {
    this.messageContent = content;
  }

  onContentHeightChanged(_height: number): void {
    // Mobile layout auto-adjusts via flex
  }

  isEditorEmpty(): boolean {
    return !this.messageContent || this.messageContent.trim().length === 0;
  }

  sendMessage(): void {
    if (!this.messageContent.trim() || this.chatState.isLoading) return;
    if (this.isInputBlocked()) return;

    if (!this.activeAgentId || !this.selectedAgentDbId) {
      this.notificationService.showWarning('Selecione um agente primeiro.');
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      content: this.messageContent.trim(),
      type: 'user',
      timestamp: new Date()
    };

    const params: MessageParams = {
      message: this.messageContent,
      provider: this.selectedProvider || undefined,
      conversationId: this.activeConversationId || undefined,
      agentId: this.activeAgentId,
      agentDbId: this.selectedAgentDbId,
      agentName: this.selectedAgentName || 'Unknown',
      agentEmoji: this.selectedAgentEmoji || '🤖',
      cwd: this.activeAgentCwd || this.screenplayWorkingDirectory || undefined,
      screenplayId: this.activeScreenplayId || undefined,
      instanceId: this.activeAgentId
    };

    const callbacks: MessageHandlingCallbacks = {
      onProgressUpdate: (message: string, instanceId: string) => {
        const msgConvId = this.instanceToConversationMap.get(instanceId);
        if (msgConvId && msgConvId !== this.activeConversationId) return;

        if (message) {
          this.progressMessages.set(instanceId, {
            id: `progress-${instanceId}`,
            content: message,
            type: 'bot',
            timestamp: new Date(),
            status: 'pending'
          });
        } else {
          this.progressMessages.set(instanceId, null);
        }
      },
      onStreamingUpdate: (chunk: string, instanceId: string) => {
        const msgConvId = this.instanceToConversationMap.get(instanceId);
        if (msgConvId && msgConvId !== this.activeConversationId) return;

        const existing = this.streamingMessages.get(instanceId);
        if (existing) {
          this.streamingMessages.set(instanceId, {
            ...existing,
            content: existing.content + chunk
          });
        } else {
          this.streamingMessages.set(instanceId, {
            id: `streaming-${instanceId}`,
            content: chunk,
            type: 'bot',
            timestamp: new Date()
          });
        }
      },
      onLoadingChange: (isLoading: boolean) => {
        this.chatState.isLoading = isLoading;
      },
      onMessagesUpdate: (messages: Message[]) => {
        this.chatState.messages = messages;
      },
      onConversationReload: (conversationId: string) => {
        if (conversationId !== this.activeConversationId) return;
        if (this.activeAgentId) {
          this.instanceToConversationMap.delete(this.activeAgentId);
        }
        this.loadConversation(conversationId);
      }
    };

    if (this.activeConversationId && this.activeAgentId) {
      this.instanceToConversationMap.set(this.activeAgentId, this.activeConversationId);

      this.chatState.messages = [...this.chatState.messages.filter(m => !m.id.startsWith('empty-')), userMessage];

      this.messageHandlingService.sendMessageWithConversationModel(params, callbacks).subscribe({
        error: (err) => { console.error('❌ [MOBILE] Message error:', err); }
      });
    }

    // Clear editor
    if (this.chatInputComponent) {
      this.chatInputComponent.clearEditor();
    }
    this.messageContent = '';
  }

  async onMessageToggled(message: Message): Promise<void> {
    if (!message.id || !this.activeConversationId) return;

    const messageIndex = this.chatState.messages.findIndex(m => m.id === message.id);
    let userMessage: Message | null = null;
    for (let i = messageIndex - 1; i >= 0; i--) {
      if (this.chatState.messages[i].type === 'user') {
        userMessage = this.chatState.messages[i];
        break;
      }
    }

    const newState = !message.isDeleted;
    const originalBotState = message.isDeleted;
    const originalUserState = userMessage?.isDeleted;

    message.isDeleted = newState;
    if (userMessage) userMessage.isDeleted = newState;

    try {
      const botResp = await fetch(`/api/conversations/${this.activeConversationId}/messages/${message.id}/toggle`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }
      });
      if (!botResp.ok) throw new Error('Failed to toggle bot message');

      if (userMessage?.id) {
        await fetch(`/api/conversations/${this.activeConversationId}/messages/${userMessage.id}/toggle`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }
        });
      }
    } catch {
      message.isDeleted = originalBotState;
      if (userMessage) userMessage.isDeleted = originalUserState || false;
    }
  }

  async onMessageHidden(message: Message): Promise<void> {
    if (!message.id || !this.activeConversationId) return;

    const messageIndex = this.chatState.messages.findIndex(m => m.id === message.id);
    let userMessage: Message | null = null;
    for (let i = messageIndex - 1; i >= 0; i--) {
      if (this.chatState.messages[i].type === 'user') {
        userMessage = this.chatState.messages[i];
        break;
      }
    }

    message.isHidden = true;
    if (userMessage) userMessage.isHidden = true;

    try {
      const botResp = await fetch(`/api/conversations/${this.activeConversationId}/messages/${message.id}/hide`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }
      });
      if (!botResp.ok) throw new Error('Failed to hide bot message');

      if (userMessage?.id) {
        await fetch(`/api/conversations/${this.activeConversationId}/messages/${userMessage.id}/hide`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }
        });
      }
    } catch {
      message.isHidden = false;
      if (userMessage) userMessage.isHidden = false;
    }
  }

  // ==========================================
  // UI Helpers
  // ==========================================

  isInputBlocked(): boolean {
    if (!this.activeAgentId) return true;
    return false;
  }

  getBlockMessage(): string {
    if (!this.activeConversationId) return 'Selecione ou crie uma conversa primeiro.';
    if (!this.activeAgentId) return 'Selecione um agente para conversar.';
    return '';
  }

  toggleMode(): void {
    this.currentMode = this.currentMode === 'ask' ? 'agent' : 'ask';
  }

  toggleRecording(): void {
    this.speechService.toggleRecording();
  }

  private readonly providers = ['', 'claude', 'gemini', 'cursor-agent'];
  private readonly providerLabels: Record<string, string> = {
    '': 'Auto',
    'claude': 'Claude',
    'gemini': 'Gemini',
    'cursor-agent': 'Cursor'
  };

  cycleProvider(): void {
    const idx = this.providers.indexOf(this.selectedProvider);
    this.selectedProvider = this.providers[(idx + 1) % this.providers.length];
  }

  getProviderLabel(): string {
    return this.providerLabels[this.selectedProvider] || 'Auto';
  }

  openConvEditModal(): void {
    if (!this.activeConversationId) return;
    this.editConvTitle = this.activeConversationTitle || '';
    this.editConvContext = '';

    this.conversationService.getConversation(this.activeConversationId).subscribe({
      next: (conv) => {
        this.editConvTitle = conv.title || this.activeConversationTitle || '';
        this.editConvContext = (conv as any).context || '';
        this.showConvEditModal = true;
      },
      error: () => {
        this.showConvEditModal = true;
      }
    });
  }

  saveConversationEdit(): void {
    if (!this.activeConversationId || !this.editConvTitle?.trim()) return;

    const convId = this.activeConversationId;
    const newTitle = this.editConvTitle.trim();

    this.conversationService.updateConversationTitle(convId, newTitle).subscribe({
      next: () => {
        this.activeConversationTitle = newTitle;
        const conv = this.conversations.find(c => c.conversation_id === convId);
        if (conv) conv.title = newTitle;

        const ctx = this.editConvContext?.trim() || null;
        this.conversationService.updateConversationContext(convId, ctx).subscribe({
          next: () => { this.showConvEditModal = false; },
          error: () => { this.showConvEditModal = false; }
        });
      },
      error: (err) => {
        console.error('Error updating conversation:', err);
      }
    });
  }

  onAgentDrop(event: CdkDragDrop<any[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    moveItemInArray(this.contextualAgents, event.previousIndex, event.currentIndex);
  }

  focusEditor(): void {
    if (this.chatInputComponent && !this.chatState.isLoading) {
      this.chatInputComponent.focusEditor();
    }
  }

  onToggleSidebar(): void {
    if (this.sidebarState === 'hidden') {
      this.sidebarState = 'compact';
    } else if (this.sidebarState === 'compact') {
      this.sidebarState = 'hidden';
    } else {
      this.sidebarState = 'compact';
    }
  }

  onPersonaSaved(persona: string): void {
    if (this.activeAgentContext) {
      this.activeAgentContext = { ...this.activeAgentContext, persona };
    }
  }

  onMcpsSaved(mcps: any): void {
    console.log('✅ [MOBILE] MCPs saved');
  }

  private async checkConnectionStatus(): Promise<void> {
    try {
      this.chatState.isConnected = await this.apiService.checkConnection(this.config.api.apiKey);
    } catch {
      this.chatState.isConnected = false;
    }
  }
}
