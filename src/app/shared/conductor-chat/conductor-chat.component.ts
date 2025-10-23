import { Component, OnInit, OnDestroy, HostListener, Output, EventEmitter, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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

const DEFAULT_CONFIG: ConductorConfig = {
  api: {
    baseUrl: '',
    endpoint: '/execute',
    streamEndpoint: '/api/v1/stream-execute',
    apiKey: 'test-api-key-123',
    timeout: 600000, // 10 minutes timeout for long-running AI operations
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
    ChatMessagesComponent,
    ChatInputComponent,
    StatusIndicatorComponent,
    PersonaEditModalComponent
  ],
  template: `
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
      <div class="modal-backdrop" *ngIf="showPersonaModal" (click)="togglePersonaModal()">
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
        [isVisible]="showPersonaEditModal"
        [instanceId]="activeAgentId"
        [currentPersona]="activeAgentContext?.persona || ''"
        (closeModal)="closePersonaEditModal()"
        (personaSaved)="onPersonaSaved($event)">
      </app-persona-edit-modal>

      <!-- CWD Definition Modal -->
      <div class="modal-backdrop" *ngIf="showCwdModal" (click)="closeCwdModal()">
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
          <app-chat-messages
            [messages]="chatState.messages"
            [isLoading]="chatState.isLoading"
            [progressMessage]="progressMessage"
            [streamingMessage]="streamingMessage"
            [autoScroll]="config.autoScroll"
          />

          <!-- Agent Launcher Dock -->
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

            <!-- Settings Button -->
            <button
              class="dock-action-btn settings-btn"
              [disabled]="!activeAgentId"
              (click)="toggleAgentOptionsMenu()"
              title="Opções do agente">
              ⚙️
            </button>

            <!-- Info Button -->
            <button
              class="dock-info-btn"
              (click)="toggleDockInfoModal()"
              title="O que é a dock de agentes?">
              ?
            </button>

            <!-- Separator -->
            <div class="dock-separator"></div>

            <!-- Agent List (scrollable) -->
            <div class="dock-agents-list">
              <button
                *ngFor="let agent of contextualAgents"
                class="dock-item"
                [class.active]="activeAgentId === agent.id"
                [title]="agent.definition?.description || ''"
                (click)="onDockAgentClick(agent)">
                {{ agent.emoji }}
              </button>
            </div>

            <!-- Agent Options Menu -->
            <div
              *ngIf="showAgentOptionsMenu"
              class="agent-options-menu">
              <button class="menu-item" (click)="viewAgentContext()">
                📋 Ver Contexto
              </button>
              <button class="menu-item" (click)="editPersona()">
                ✏️ Editar Persona
              </button>
              <button class="menu-item" (click)="editAgentCwd()">
                📁 Editar diretório
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="chat-footer">
        <!-- Block input if agent is selected but no cwd is defined -->
        <div class="input-blocked-overlay" *ngIf="isInputBlocked()">
          <div class="blocked-message">
            <span class="blocked-icon">🔒</span>
            <span>Chat bloqueado. Defina o diretório de trabalho primeiro.</span>
            <button class="blocked-btn" (click)="openCwdDefinitionModal()">
              Definir agora
            </button>
          </div>
        </div>

        <app-chat-input
          [isLoading]="chatState.isLoading"
          [mode]="currentMode"
          (messageSent)="handleSendMessage($event)"
          (modeChanged)="handleModeChange($event)"
        />
      </div>

      <!-- Dock Info Modal (merged with header info) -->
      <div class="modal-backdrop" *ngIf="showDockInfoModal" (click)="toggleDockInfoModal()">
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
    </div>
  `,
  styles: [`
    .conductor-chat {
      display: flex;
      flex-direction: column;
      height: 100vh;
      background: #fafbfc;
      border-left: 1px solid #e1e4e8;
    }

    .chat-body {
      flex: 1 1 auto;
      min-height: 0;
      height: 0;
      display: flex;
      flex-direction: column;
      background: #ffffff;
      overflow: hidden;
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

    .settings-btn {
      background: #e3f2fd;
      border-color: #bbdefb;
    }

    .settings-btn:hover:not(:disabled) {
      background: #bbdefb;
      border-color: #90caf9;
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

    .chat-footer {
      background: #f0f3f7;
      border-top: 1px solid #e1e4e8;
      flex-shrink: 0;
      position: relative;
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
      top: 50%;
      right: 80px;
      transform: translateY(-50%);
      background: white;
      border: 1px solid #e1e4e8;
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
      z-index: 1001;
      min-width: 220px;
      overflow: hidden;
      animation: fadeInLeft 0.2s ease;
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
      backdrop-filter: blur(2px);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      border-top: 3px solid #1976d2;
    }

    .blocked-message {
      display: flex;
      align-items: center;
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
  `]
})
export class ConductorChatComponent implements OnInit, OnDestroy {
  @Input() contextualAgents: any[] = [];
  @Output() addAgentRequested = new EventEmitter<void>();
  @Output() deleteAgentRequested = new EventEmitter<void>();
  @Output() agentDockClicked = new EventEmitter<any>();

  chatState: ChatState = {
    messages: [],
    isConnected: false,
    isLoading: false
  };

  progressMessage: Message | null = null;
  streamingMessage: Message | null = null;
  currentMode: ChatMode = 'ask';
  config: ConductorConfig = DEFAULT_CONFIG;

  // Agent context state
  activeAgentContext: AgentContext | null = null;
  activeAgentId: string | null = null; // instance_id
  selectedAgentDbId: string | null = null; // MongoDB agent_id
  selectedAgentName: string | null = null;
  selectedAgentEmoji: string | null = null;
  activeScreenplayId: string | null = null; // SAGA-006: Add screenplay ID for document association
  showPersonaModal = false;

  // CWD management
  showCwdModal = false;
  tempCwd: string = '';
  activeAgentCwd: string | null = null;

  // Agent options menu
  showAgentOptionsMenu = false;

  // Persona edit modal
  showPersonaEditModal = false;

  // Dock info modal
  showDockInfoModal = false;

  private subscriptions = new Subscription();
  private connectionCheckInterval: any;

  constructor(
    private apiService: ConductorApiService,
    private screenplayService: ScreenplayService,
    private agentService: AgentService,
    private agentExecutionService: AgentExecutionService,
    private personaEditService: PersonaEditService
  ) { }

  ngOnInit(): void {
    this.initializeChat();
    this.checkConnectionStatus();
    this.connectionCheckInterval = setInterval(() => {
      this.checkConnectionStatus();
    }, 30000);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
    }
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

  handleSendMessage(data: {message: string, provider?: string}): void {
    if (!data.message.trim() || this.chatState.isLoading) return;

    // Block sending if agent is selected but no cwd is defined
    if (this.isInputBlocked()) {
      console.warn('⚠️ [CHAT] Bloqueado: defina o diretório de trabalho primeiro');
      return;
    }

    // Force save screenplay if it has unsaved changes before sending message
    this.forceSaveScreenplayIfNeeded();

    const userMessage: Message = {
      id: Date.now().toString(),
      content: data.message.trim(),
      type: 'user',
      timestamp: new Date()
    };

    // Remove placeholder messages before adding real user message
    const filteredMessages = this.chatState.messages.filter(msg =>
      !msg.id.startsWith('empty-history-') &&
      msg.content !== 'Nenhuma interação ainda. Inicie a conversa abaixo.'
    );

    this.chatState.messages = [...filteredMessages, userMessage];

    // Verificar se é um comando @agent (MVP)
    if (this.currentMode === 'agent' && data.message.startsWith('@agent')) {
      // Parsing simples para o MVP
      if (data.message.includes('adicione um título')) {
        this.screenplayService.dispatch({ intent: 'add_title' });

        const confirmationMessage: Message = {
          id: `confirmation-${Date.now()}`,
          content: '✅ Título adicionado ao documento!',
          type: 'bot',
          timestamp: new Date()
        };
        this.chatState.messages = [...this.chatState.messages, confirmationMessage];

        // Impede o envio da mensagem para a API de chat normal
        return;
      }
    }

    this.chatState.isLoading = true;

    // Clear any existing progress/streaming messages
    this.progressMessage = null;
    this.streamingMessage = null;

    // Check if we have an active agent selected
    if (this.activeAgentId) {
      if (!this.selectedAgentDbId) {
        console.error('❌ [CHAT] Não é possível executar: agent_id está undefined!');
        console.error('   - instance_id:', this.activeAgentId);
        console.error('   - agent_id:', this.selectedAgentDbId);
        this.handleError('Agente não tem agent_id definido. Verifique a âncora no markdown.');
        return;
      }

      // Extract cwd from message if present, or use saved cwd
      // Matches any absolute path (starts with /) with at least 2 segments
      // Examples: /mnt/ramdisk/foo, /home/user/project, /app/conductor
      const cwdMatch = data.message.match(/\/[a-zA-Z0-9_.\-]+(?:\/[a-zA-Z0-9_.\-]+)+/);
      const cwd = cwdMatch ? cwdMatch[0] : this.activeAgentCwd || undefined;

      console.log('🎯 [CHAT] Executando agente diretamente:');
      console.log('   - agent_id (MongoDB):', this.selectedAgentDbId);
      console.log('   - instance_id:', this.activeAgentId);
      console.log('   - input_text:', data.message.trim());
      console.log('   - cwd extraído:', cwd || 'não encontrado na mensagem');
      console.log('   - ai_provider:', data.provider || 'padrão (config.yaml)');

      this.addProgressMessage('🚀 Executando agente...');

      // Notify AgentExecutionService to update agent-game
      const executionState: AgentExecutionState = {
        id: this.activeAgentId,
        emoji: this.selectedAgentEmoji || '🤖',
        title: this.selectedAgentName || 'Unknown Agent',
        prompt: data.message.trim(),
        status: 'running',
        logs: ['🚀 Agent execution started']
      };
      this.agentExecutionService.executeAgent(executionState);

      this.subscriptions.add(
        this.agentService.executeAgent(this.selectedAgentDbId, data.message.trim(), this.activeAgentId, cwd, this.activeScreenplayId || undefined, data.provider).subscribe({
          next: (result) => {
            console.log('✅ Agent execution result:', result);
            this.progressMessage = null;

            // Update execution status to completed
            if (this.activeAgentId) {
              this.agentExecutionService.completeAgent(this.activeAgentId, result);
            }

            // Extract response content and ensure it's a string
            let responseContent = result.result || result.data?.result || 'Execução concluída';
            if (typeof responseContent === 'object') {
              console.warn('⚠️ Response is an object, converting to string:', responseContent);
              responseContent = JSON.stringify(responseContent, null, 2);
            }

            const responseMessage: Message = {
              id: `response-${Date.now()}`,
              content: responseContent,
              type: 'bot',
              timestamp: new Date()
            };
            this.chatState.messages = [...this.chatState.messages, responseMessage];
            this.chatState.isLoading = false;

            console.log('✅ [CHAT] Mensagem de resposta adicionada ao histórico local');
            console.log('   - Total de mensagens no chat:', this.chatState.messages.length);

            // DON'T reload context - keep local chat history
            // The backend will persist the history to MongoDB for next session
          },
          error: (error) => {
            console.error('❌ Agent execution error:', error);
            this.progressMessage = null;

            // Mark agent execution as failed
            if (this.activeAgentId) {
              this.agentExecutionService.cancelAgent(this.activeAgentId);
            }

            this.handleError(error.error || error.message || 'Erro ao executar agente');
          }
        })
      );
      return;
    }

    // No active agent: use MCP tools system
    // Add mode context to message if in agent mode
    const messageWithContext = this.currentMode === 'agent'
      ? `[AGENT MODE - Can modify screenplay] ${data.message.trim()}`
      : data.message.trim();

    // Send message via API
    this.subscriptions.add(
      this.apiService.sendMessage(messageWithContext, this.config.api).subscribe({
        next: (event: any) => {
          this.handleStreamEvent(event);
        },
        error: (error) => {
          this.handleError(error);
        },
        complete: () => {
          console.log('Stream completed');
        }
      })
    );
  }

  private handleStreamEvent(event: any): void {
    console.log('Stream event:', event);

    // Check if it's a final response
    if (event.success !== undefined) {
      this.progressMessage = null;

      if (this.streamingMessage) {
        this.chatState.messages = [...this.chatState.messages, this.streamingMessage];
        this.streamingMessage = null;
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
        this.progressMessage = null;
        break;
      case 'error':
        this.progressMessage = null;
        break;
    }
  }

  private addProgressMessage(text: string): void {
    this.progressMessage = {
      id: `progress-${Date.now()}`,
      content: text,
      type: 'bot',
      timestamp: new Date()
    };
  }

  private updateProgressMessage(text: string): void {
    if (this.progressMessage) {
      this.progressMessage = { ...this.progressMessage, content: text };
    } else {
      this.addProgressMessage(text);
    }
  }

  private appendToStreamingMessage(token: string): void {
    if (!this.streamingMessage) {
      this.streamingMessage = {
        id: `stream-${Date.now()}`,
        content: token,
        type: 'bot',
        timestamp: new Date()
      };
    } else {
      this.streamingMessage = {
        ...this.streamingMessage,
        content: this.streamingMessage.content + token
      };
    }
  }

  private handleError(error: string): void {
    this.progressMessage = null;
    this.streamingMessage = null;

    const errorMessage: Message = {
      id: (Date.now() + 1).toString(),
      content: `❌ Erro: ${error}`,
      type: 'bot',
      timestamp: new Date()
    };

    this.chatState.messages = [...this.chatState.messages, errorMessage];
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
    console.log('================================================================================');

    if (!agentDbId) {
      console.error('================================================================================');
      console.error('❌ [CHAT] ERRO CRÍTICO: agentDbId (agent_id) está undefined/null!');
      console.error('   O agente não poderá ser executado sem um agent_id válido do MongoDB.');
      console.error('   Verifique se a instância do agente tem a propriedade agent_id definida.');
      console.error('   Verifique a âncora no markdown: <!-- agent-instance: uuid, agent-id: NOME_DO_AGENTE -->');
      console.error('================================================================================');
    }

    this.activeAgentId = instanceId;
    this.selectedAgentDbId = agentDbId || null;
    this.selectedAgentName = agentName || null;
    this.selectedAgentEmoji = agentEmoji || null;
    this.activeScreenplayId = screenplayId || null; // SAGA-006: Store screenplay ID for document association
    // Don't set activeAgentCwd here - it will be loaded from MongoDB in getAgentContext
    this.chatState.isLoading = true;

    console.log('✅ [CHAT] Variáveis de estado atualizadas:');
    console.log('   - this.activeAgentId (instance_id):', this.activeAgentId);
    console.log('   - this.selectedAgentDbId (agent_id):', this.selectedAgentDbId);
    console.log('   - this.selectedAgentName:', this.selectedAgentName);
    console.log('   - this.selectedAgentEmoji:', this.selectedAgentEmoji);
    console.log('   - this.activeScreenplayId:', this.activeScreenplayId);

    this.subscriptions.add(
      this.agentService.getAgentContext(instanceId).subscribe({
        next: (context: AgentContext) => {
          console.log('✅ Agent context loaded:', context);
          console.log('   - History count:', context.history?.length || 0);
          console.log('   - CWD from MongoDB:', context.cwd);
          console.log('   - Raw history:', JSON.stringify(context.history, null, 2));
          this.activeAgentContext = context;

          // Load cwd from context (MongoDB) if available, otherwise use parameter or localStorage
          if (context.cwd) {
            this.activeAgentCwd = context.cwd;
            console.log('✅ [CHAT] CWD loaded from MongoDB:', this.activeAgentCwd);
          } else if (cwd) {
            this.activeAgentCwd = cwd;
            console.log('✅ [CHAT] CWD loaded from parameter:', this.activeAgentCwd);
          } else {
            // Fallback to localStorage
            const storedCwd = localStorage.getItem(`agent-cwd-${instanceId}`);
            if (storedCwd) {
              this.activeAgentCwd = storedCwd;
              console.log('✅ [CHAT] CWD loaded from localStorage:', this.activeAgentCwd);
            } else {
              this.activeAgentCwd = null;
              console.log('⚠️ [CHAT] No CWD found for this instance');
            }
          }

          // Clear existing messages and load context
          this.chatState.messages = [];

          // Map history messages from backend format to UI format
          // Backend format: { user_input: "...", ai_response: "..." }
          // Frontend format: { role: "user", content: "..." }
          const historyMessages: Message[] = [];

          context.history.forEach((record: any, index: number) => {
            // Add user message if present
            if (record.user_input && record.user_input.trim().length > 0) {
              historyMessages.push({
                id: `history-user-${index}`,
                content: record.user_input,
                type: 'user',
                timestamp: new Date(record.timestamp * 1000 || record.createdAt)
              });
            }

            // Add AI response if present
            if (record.ai_response) {
              let aiContent = record.ai_response;
              // Ensure content is a string
              if (typeof aiContent === 'object') {
                aiContent = JSON.stringify(aiContent, null, 2);
              }
              if (aiContent.trim().length > 0) {
                historyMessages.push({
                  id: `history-bot-${index}`,
                  content: aiContent,
                  type: 'bot',
                  timestamp: new Date(record.timestamp * 1000 || record.createdAt)
                });
              }
            }
          });

          // If history is empty, show a placeholder message
          if (historyMessages.length === 0) {
            console.log('ℹ️ [CHAT] Histórico vazio do MongoDB, mostrando placeholder');
            historyMessages.push({
              id: `empty-history-${Date.now()}`,
              content: 'Nenhuma interação ainda. Inicie a conversa abaixo.',
              type: 'system',
              timestamp: new Date()
            });
          } else {
            console.log('✅ [CHAT] Histórico carregado do MongoDB com sucesso');
            console.log('   - Mensagens carregadas:', historyMessages.length);
            historyMessages.forEach((msg, i) => {
              console.log(`   - [${i}] ${msg.type}: ${msg.content.substring(0, 50)}...`);
            });
          }

          this.chatState.messages = historyMessages;
          this.chatState.isLoading = false;
          console.log('✅ [CHAT] isLoading definido como FALSE após carregar contexto');
          console.log('   - chatState.isLoading:', this.chatState.isLoading);
          console.log('   - Total de mensagens no chat:', this.chatState.messages.length);
        },
        error: (error) => {
          console.error('❌ Error loading agent context:', error);
          this.chatState.isLoading = false;
          console.log('✅ [CHAT] isLoading definido como FALSE após erro');
          console.log('   - chatState.isLoading:', this.chatState.isLoading);

          // Treat 404 as "no context yet" instead of an error
          const isNotFound = error.status === 404;

          const message: Message = {
            id: `info-${Date.now()}`,
            content: isNotFound
              ? `ℹ️ Este agente ainda não foi executado. Nenhum contexto disponível.\n\nClique duas vezes no agente no roteiro para executá-lo.`
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
    this.initializeChat();
  }

  /**
   * Toggle persona modal visibility
   */
  togglePersonaModal(): void {
    this.showPersonaModal = !this.showPersonaModal;
  }

  /**
   * Check if CWD warning banner should be shown
   */
  showCwdWarning(): boolean {
    // Show warning if agent is selected but no cwd is defined
    return this.activeAgentId !== null && !this.activeAgentCwd;
  }

  /**
   * Check if chat input should be blocked
   */
  isInputBlocked(): boolean {
    // Block input if agent is selected but no cwd is defined
    return this.activeAgentId !== null && !this.activeAgentCwd;
  }

  /**
   * Open CWD definition modal
   */
  openCwdDefinitionModal(): void {
    this.tempCwd = this.activeAgentCwd || '';
    this.showCwdModal = true;
  }

  /**
   * Close CWD definition modal
   */
  closeCwdModal(): void {
    this.showCwdModal = false;
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
  toggleAgentOptionsMenu(): void {
    this.showAgentOptionsMenu = !this.showAgentOptionsMenu;
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
   * Emit event when an agent is clicked in the dock
   */
  onDockAgentClick(agent: any): void {
    this.agentDockClicked.emit(agent);
  }

  /**
   * Toggle dock info modal
   */
  toggleDockInfoModal(): void {
    this.showDockInfoModal = !this.showDockInfoModal;
  }

  /**
   * Toggle header info modal (removed - use toggleDockInfoModal instead)
   */

  /**
   * Edit agent CWD from menu
   */
  editAgentCwd(): void {
    this.showAgentOptionsMenu = false;
    this.openCwdDefinitionModal();
  }

  /**
   * Edit persona from menu
   */
  editPersona(): void {
    this.showAgentOptionsMenu = false;
    
    // Verifica se há um agente ativo
    if (!this.activeAgentId) {
      console.warn('⚠️ [CHAT] Não é possível editar persona: nenhum agente ativo');
      return;
    }
    
    this.showPersonaEditModal = true;
    console.log('✏️ [CHAT] Abrindo modal de edição de persona para agente:', this.activeAgentId);
  }

  /**
   * Close persona edit modal
   */
  closePersonaEditModal(): void {
    this.showPersonaEditModal = false;
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
    this.showAgentOptionsMenu = false;
    this.showPersonaModal = true;
    console.log('📋 [CHAT] Abrindo modal de contexto do agente');
  }

  /**
   * View agent details from menu
   */
  viewAgentDetails(): void {
    this.showAgentOptionsMenu = false;

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
      this.showAgentOptionsMenu = false;
    }
  }

  /**
   * Handle ESC key to close modals
   */
  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(event: Event): void {
    // Close dock info modal if open
    if (this.showDockInfoModal) {
      this.toggleDockInfoModal();
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    // Close persona edit modal if open
    if (this.showPersonaEditModal) {
      this.closePersonaEditModal();
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    // Close persona modal if open
    if (this.showPersonaModal) {
      this.togglePersonaModal();
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    // Close CWD modal if open
    if (this.showCwdModal) {
      this.closeCwdModal();
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    // Close agent options menu if open
    if (this.showAgentOptionsMenu) {
      this.showAgentOptionsMenu = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
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
}
