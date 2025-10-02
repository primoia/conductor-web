import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ChatMessagesComponent } from './components/chat-messages/chat-messages.component';
import { ChatInputComponent } from './components/chat-input/chat-input.component';
import { StatusIndicatorComponent } from './components/status-indicator/status-indicator.component';
import { ConductorApiService } from './services/conductor-api.service';
import { Message, ChatState, ChatMode, ApiConfig, ConductorConfig } from './models/chat.models';
import { ScreenplayService } from '../../services/screenplay/screenplay.service';

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
        <h3>🤖 Conductor</h3>
        <app-status-indicator
          [isConnected]="chatState.isConnected"
          [isLoading]="chatState.isLoading"
        />
      </div>

      <app-chat-messages
        [messages]="chatState.messages"
        [isLoading]="chatState.isLoading"
        [progressMessage]="progressMessage"
        [streamingMessage]="streamingMessage"
        [autoScroll]="config.autoScroll"
      />

      <app-chat-input
        [isLoading]="chatState.isLoading"
        [mode]="currentMode"
        (messageSent)="handleSendMessage($event)"
        (modeChanged)="handleModeChange($event)"
      />

      <div class="chat-footer">
        <p>Conductor Gateway v3.1.0 | Powered by FastAPI + MCP</p>
      </div>
    </div>
  `,
  styles: [`
    .conductor-chat {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: white;
      border-left: 1px solid #e0e0e0;
    }

    .chat-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border-bottom: 2px solid #5568d3;
    }

    .chat-header h3 {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
    }

    .chat-footer {
      padding: 12px 20px;
      background: #f5f5f5;
      border-top: 1px solid #e0e0e0;
      text-align: center;
    }

    .chat-footer p {
      margin: 0;
      font-size: 12px;
      color: #666;
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

  private subscriptions = new Subscription();
  private connectionCheckInterval: any;

  constructor(
    private apiService: ConductorApiService,
    private screenplayService: ScreenplayService
  ) {}

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
}
