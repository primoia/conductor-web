import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
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

const DEFAULT_CONFIG: ConductorConfig = {
  api: {
    baseUrl: 'http://localhost:5006',
    endpoint: '/execute',
    streamEndpoint: '/api/v1/stream-execute',
    apiKey: 'test-api-key-123',
    timeout: 30000,
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
    StatusIndicatorComponent
  ],
  template: `
    <div class="conductor-chat">
      <div class="chat-header">
        <div class="header-content">
          <h3>🤖 Conductor Chat</h3>
          <div class="selected-agent" *ngIf="selectedAgentName">
            <span class="agent-emoji">{{ selectedAgentEmoji }}</span>
            <span class="agent-name">{{ selectedAgentName }}</span>
          </div>
        </div>
        <div class="header-actions">
          <button
            *ngIf="activeAgentContext"
            class="settings-btn"
            (click)="togglePersonaModal()"
            title="Ver contexto do agente">
            📋
          </button>
          <button
            *ngIf="activeAgentId"
            class="settings-btn"
            (click)="toggleAgentOptionsMenu()"
            title="Opções do agente">
            ⚙️
          </button>
          <app-status-indicator
            [isConnected]="chatState.isConnected"
            [isLoading]="chatState.isLoading"
          />
        </div>

        <!-- Agent Options Menu -->
        <div
          *ngIf="showAgentOptionsMenu"
          class="agent-options-menu">
          <button class="menu-item" (click)="editAgentCwd()">
            ✏️ Editar diretório
          </button>
          <button class="menu-item" (click)="viewAgentDetails()">
            ℹ️ Ver detalhes
          </button>
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
              <div class="context-label">👤 Persona</div>
              <div class="context-content">{{ activeAgentContext?.persona }}</div>
            </div>
            <div class="context-item">
              <div class="context-label">📜 Procedimento</div>
              <div class="context-content">{{ activeAgentContext?.operating_procedure }}</div>
            </div>
          </div>
        </div>
      </div>

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

        <app-chat-messages
          [messages]="chatState.messages"
          [isLoading]="chatState.isLoading"
          [progressMessage]="progressMessage"
          [streamingMessage]="streamingMessage"
          [autoScroll]="config.autoScroll"
        />
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

    .chat-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      background: #f0f3f7;
      color: #2c3e50;
      border-bottom: 1px solid #e1e4e8;
    }

    .header-content {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .settings-btn {
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
      opacity: 0.7;
      transition: all 0.2s;
      padding: 4px 8px;
      border-radius: 4px;
    }

    .settings-btn:hover {
      opacity: 1;
      background: rgba(0, 0, 0, 0.05);
    }

    .chat-header h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      color: #5a67d8;
    }

    .selected-agent {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: #48bb78;
      font-weight: 500;
    }

    .agent-emoji {
      font-size: 16px;
    }

    .agent-name {
      color: #48bb78;
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
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
      border-bottom: 2px solid #f59e0b;
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
      color: #92400e;
    }

    .define-cwd-btn {
      background: #f59e0b;
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
      background: #d97706;
      transform: translateY(-1px);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
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
      position: absolute;
      top: 60px;
      right: 20px;
      background: white;
      border: 1px solid #e1e4e8;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 1001;
      min-width: 200px;
      overflow: hidden;
      animation: fadeIn 0.2s ease;
    }

    .agent-options-menu .menu-item {
      display: block;
      width: 100%;
      padding: 12px 16px;
      background: white;
      border: none;
      text-align: left;
      cursor: pointer;
      font-size: 13px;
      color: #2c3e50;
      transition: background 0.2s;
      border-bottom: 1px solid #f0f3f7;
    }

    .agent-options-menu .menu-item:last-child {
      border-bottom: none;
    }

    .agent-options-menu .menu-item:hover {
      background: #f7fafc;
    }

    /* Input Blocked Overlay */
    .input-blocked-overlay {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(2px);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      border-top: 3px solid #f59e0b;
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
      background: #f59e0b;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }

    .blocked-btn:hover {
      background: #d97706;
      transform: translateY(-1px);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
    }
  `]
})
export class ConductorChatComponent implements OnInit, OnDestroy {
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

  private subscriptions = new Subscription();
  private connectionCheckInterval: any;

  constructor(
    private apiService: ConductorApiService,
    private screenplayService: ScreenplayService,
    private agentService: AgentService
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

  handleSendMessage(content: string): void {
    if (!content.trim() || this.chatState.isLoading) return;

    // Block sending if agent is selected but no cwd is defined
    if (this.isInputBlocked()) {
      console.warn('⚠️ [CHAT] Bloqueado: defina o diretório de trabalho primeiro');
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      content: content.trim(),
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
    if (this.currentMode === 'agent' && content.startsWith('@agent')) {
      // Parsing simples para o MVP
      if (content.includes('adicione um título')) {
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
      const cwdMatch = content.match(/\/[a-zA-Z0-9_.\-]+(?:\/[a-zA-Z0-9_.\-]+)+/);
      const cwd = cwdMatch ? cwdMatch[0] : this.activeAgentCwd || undefined;

      console.log('🎯 [CHAT] Executando agente diretamente:');
      console.log('   - agent_id (MongoDB):', this.selectedAgentDbId);
      console.log('   - instance_id:', this.activeAgentId);
      console.log('   - input_text:', content.trim());
      console.log('   - cwd extraído:', cwd || 'não encontrado na mensagem');

      this.addProgressMessage('🚀 Executando agente...');

      this.subscriptions.add(
        this.agentService.executeAgent(this.selectedAgentDbId, content.trim(), this.activeAgentId, cwd, this.activeScreenplayId || undefined).subscribe({
          next: (result) => {
            console.log('✅ Agent execution result:', result);
            this.progressMessage = null;

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
            this.handleError(error.error || error.message || 'Erro ao executar agente');
          }
        })
      );
      return;
    }

    // No active agent: use MCP tools system
    // Add mode context to message if in agent mode
    const messageWithContext = this.currentMode === 'agent'
      ? `[AGENT MODE - Can modify screenplay] ${content.trim()}`
      : content.trim();

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
   * Edit agent CWD from menu
   */
  editAgentCwd(): void {
    this.showAgentOptionsMenu = false;
    this.openCwdDefinitionModal();
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
}
