import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
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
        <app-status-indicator
          [isConnected]="chatState.isConnected"
          [isLoading]="chatState.isLoading"
        />
      </div>

      <!-- Agent Context Section -->
      <div class="agent-context" *ngIf="activeAgentContext">
        <div class="context-item">
          <div class="context-label">👤 Persona</div>
          <div class="context-content">{{ activeAgentContext.persona }}</div>
        </div>
        <div class="context-item">
          <div class="context-label">📜 Procedimento</div>
          <div class="context-content">{{ activeAgentContext.operating_procedure }}</div>
        </div>
      </div>

      <div class="chat-body">
        <app-chat-messages
          [messages]="chatState.messages"
          [isLoading]="chatState.isLoading"
          [progressMessage]="progressMessage"
          [streamingMessage]="streamingMessage"
          [autoScroll]="config.autoScroll"
        />
      </div>

      <div class="chat-footer">
        <app-chat-input
          [isLoading]="chatState.isLoading"
          [mode]="currentMode"
          (messageSent)="handleSendMessage($event)"
          (modeChanged)="handleModeChange($event)"
        />
        <p class="version-info">Conductor Gateway v3.1.0 | Powered by FastAPI + MCP</p>
      </div>
    </div>
  `,
  styles: [`
    .conductor-chat {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #343a40;
      border-left: 1px solid #495057;
    }

    .chat-body {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      background: #f9f9f9;
    }

    .chat-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      background: #343a40;
      color: white;
      border-bottom: 1px solid #495057;
    }

    .header-content {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .chat-header h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      color: #ffc107;
    }

    .selected-agent {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: #28a745;
      font-weight: 500;
    }

    .agent-emoji {
      font-size: 16px;
    }

    .agent-name {
      color: #28a745;
    }

    .agent-context {
      background: #495057;
      border-bottom: 1px solid #5a6268;
      padding: 12px 16px;
      max-height: 200px;
      overflow-y: auto;
    }

    .context-item {
      margin-bottom: 12px;
    }

    .context-item:last-child {
      margin-bottom: 0;
    }

    .context-label {
      font-size: 12px;
      font-weight: 600;
      color: #ffc107;
      margin-bottom: 4px;
    }

    .context-content {
      font-size: 13px;
      color: #f8f9fa;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .chat-footer {
      background: #495057;
      border-top: 1px solid #5a6268;
      flex-shrink: 0;
    }

    .version-info {
      margin: 0;
      padding: 8px 20px;
      font-size: 11px;
      text-align: center;
      color: #adb5bd;
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

    const userMessage: Message = {
      id: Date.now().toString(),
      content: content.trim(),
      type: 'user',
      timestamp: new Date()
    };

    this.chatState.messages = [...this.chatState.messages, userMessage];

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

      console.log('🎯 [CHAT] Executando agente diretamente:');
      console.log('   - agent_id (MongoDB):', this.selectedAgentDbId);
      console.log('   - instance_id:', this.activeAgentId);
      console.log('   - input_text:', content.trim());

      this.addProgressMessage('🚀 Executando agente...');

      this.subscriptions.add(
        this.agentService.executeAgent(this.selectedAgentDbId, content.trim(), this.activeAgentId).subscribe({
          next: (result) => {
            console.log('✅ Agent execution result:', result);
            this.progressMessage = null;

            const responseMessage: Message = {
              id: `response-${Date.now()}`,
              content: result.result || result.data?.result || 'Execução concluída',
              type: 'bot',
              timestamp: new Date()
            };
            this.chatState.messages = [...this.chatState.messages, responseMessage];
            this.chatState.isLoading = false;

            // Reload context to get updated history
            this.loadContextForAgent(this.activeAgentId!, this.selectedAgentName!, this.selectedAgentEmoji!, this.selectedAgentDbId!);
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
   */
  loadContextForAgent(instanceId: string, agentName?: string, agentEmoji?: string, agentDbId?: string): void {
    console.log('================================================================================');
    console.log('📥 [CHAT] loadContextForAgent chamado:');
    console.log('   - instanceId (instance_id):', instanceId);
    console.log('   - agentDbId (agent_id MongoDB):', agentDbId);
    console.log('   - agentName:', agentName);
    console.log('   - agentEmoji:', agentEmoji);
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
    this.chatState.isLoading = true;

    console.log('✅ [CHAT] Variáveis de estado atualizadas:');
    console.log('   - this.activeAgentId (instance_id):', this.activeAgentId);
    console.log('   - this.selectedAgentDbId (agent_id):', this.selectedAgentDbId);
    console.log('   - this.selectedAgentName:', this.selectedAgentName);
    console.log('   - this.selectedAgentEmoji:', this.selectedAgentEmoji);

    this.subscriptions.add(
      this.agentService.getAgentContext(instanceId).subscribe({
        next: (context: AgentContext) => {
          console.log('✅ Agent context loaded:', context);
          console.log('   - History count:', context.history?.length || 0);
          this.activeAgentContext = context;

          // Clear existing messages and load context
          this.chatState.messages = [];

          // Map history messages from backend format to UI format
          const historyMessages: Message[] = context.history.map((msg, index) => ({
            id: `history-${index}`,
            content: msg.content || '[Mensagem vazia]',
            type: msg.role === 'user' ? 'user' : msg.role === 'system' ? 'system' : 'bot',
            timestamp: new Date()
          }));

          // If history is empty, show a placeholder message
          if (historyMessages.length === 0) {
            historyMessages.push({
              id: `empty-history-${Date.now()}`,
              content: 'Nenhuma interação ainda. Inicie a conversa abaixo.',
              type: 'system',
              timestamp: new Date()
            });
          }

          this.chatState.messages = historyMessages;
          this.chatState.isLoading = false;
          console.log('✅ [CHAT] isLoading definido como FALSE após carregar contexto');
          console.log('   - chatState.isLoading:', this.chatState.isLoading);
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
    this.initializeChat();
  }
}
