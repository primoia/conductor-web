import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { ConversationService, AgentInfo as ConvAgentInfo } from '../../../services/conversation.service';
import { AgentService } from '../../../services/agent.service';
import { AgentExecutionService, AgentExecutionState } from '../../../services/agent-execution';
import { Message } from '../models/chat.models';

/**
 * Parâmetros para envio de mensagem
 */
export interface MessageParams {
  message: string;
  provider?: string;
  conversationId?: string;
  agentId: string;
  agentDbId: string;
  agentName: string;
  agentEmoji: string;
  cwd?: string;
  screenplayId?: string;
  instanceId: string;
}

/**
 * Resultado de execução de mensagem
 */
export interface MessageExecutionResult {
  success: boolean;
  userMessage: Message;
  responseMessage?: Message;
  error?: string;
}

/**
 * Callbacks para comunicação com o componente
 */
export interface MessageHandlingCallbacks {
  onProgressUpdate: (message: string, instanceId: string) => void;
  onStreamingUpdate: (chunk: string, instanceId: string) => void;
  onLoadingChange: (isLoading: boolean) => void;
  onMessagesUpdate: (messages: Message[]) => void;
  onConversationReload?: (conversationId: string) => void;
}

/**
 * 🔥 FASE 1.1: MessageHandlingService
 *
 * Serviço responsável por unificar a lógica de envio de mensagens entre os modelos:
 * - Conversation Model (novo): Usa conversas globais com backend
 * - Legacy Model (antigo): Usa histórico local por agente
 *
 * Remove ~400 linhas de código duplicado do componente principal.
 */
@Injectable({
  providedIn: 'root'
})
export class MessageHandlingService {

  constructor(
    private conversationService: ConversationService,
    private agentService: AgentService,
    private agentExecutionService: AgentExecutionService
  ) {}

  /**
   * Enviar mensagem usando modelo de conversas globais (NOVO)
   */
  sendMessageWithConversationModel(
    params: MessageParams,
    callbacks: MessageHandlingCallbacks
  ): Observable<MessageExecutionResult> {
    console.log('🔥 [MESSAGE-SERVICE] Enviando mensagem usando modelo de conversas');

    const userMessage: Message = {
      id: Date.now().toString(),
      content: params.message.trim(),
      type: 'user',
      timestamp: new Date()
    };

    const agentInfo: ConvAgentInfo = {
      agent_id: params.agentDbId,
      instance_id: params.instanceId,
      name: params.agentName,
      emoji: params.agentEmoji || undefined
    };

    // Notificar loading
    callbacks.onLoadingChange(true);

    // Adicionar mensagem ao backend
    return this.conversationService.addMessage(params.conversationId!, {
      user_input: params.message.trim()
    }).pipe(
      tap(() => console.log('✅ [MESSAGE-SERVICE] Mensagem do usuário salva no backend')),
      map(() => {
        // Executar agente
        this.executeAgentWithConversationModel(params, agentInfo, callbacks);

        return {
          success: true,
          userMessage
        };
      }),
      catchError((error) => {
        console.error('❌ [MESSAGE-SERVICE] Erro ao salvar mensagem do usuário:', error);
        callbacks.onLoadingChange(false);
        return of({
          success: false,
          userMessage,
          error: error.message || 'Erro ao salvar mensagem'
        });
      })
    );
  }

  /**
   * Enviar mensagem usando modelo legado (ANTIGO)
   */
  sendMessageWithLegacyModel(
    params: MessageParams,
    currentMessages: Message[],
    chatHistories: Map<string, Message[]>,
    callbacks: MessageHandlingCallbacks
  ): Observable<MessageExecutionResult> {
    console.log('🔄 [MESSAGE-SERVICE] Enviando mensagem usando modelo legado');

    const userMessage: Message = {
      id: Date.now().toString(),
      content: params.message.trim(),
      type: 'user',
      timestamp: new Date()
    };

    // Filtrar mensagens vazias
    const filteredMessages = currentMessages.filter(msg =>
      !msg.id.startsWith('empty-history-') &&
      msg.content !== 'Nenhuma interação ainda. Inicie a conversa abaixo.'
    );

    // Atualizar histórico do agente
    if (params.agentId) {
      const agentHistory = chatHistories.get(params.agentId) || [];
      const filteredAgentHistory = agentHistory.filter(msg =>
        !msg.id.startsWith('empty-history-') &&
        msg.content !== 'Nenhuma interação ainda. Inicie a conversa abaixo.'
      );
      chatHistories.set(params.agentId, [...filteredAgentHistory, userMessage]);
      callbacks.onMessagesUpdate(chatHistories.get(params.agentId) || []);
    } else {
      callbacks.onMessagesUpdate([...filteredMessages, userMessage]);
    }

    // Notificar loading
    callbacks.onLoadingChange(true);

    // Executar agente
    this.executeAgentWithLegacyModel(params, chatHistories, callbacks);

    return of({
      success: true,
      userMessage
    });
  }

  /**
   * Executar agente com modelo de conversas
   */
  private executeAgentWithConversationModel(
    params: MessageParams,
    agentInfo: ConvAgentInfo,
    callbacks: MessageHandlingCallbacks
  ): void {
    // Detectar CWD da mensagem ou usar o configurado
    const cwdMatch = params.message.match(/\/[a-zA-Z0-9_.\-]+(?:\/[a-zA-Z0-9_.\-]+)+/);
    const cwd = cwdMatch ? cwdMatch[0] : params.cwd;

    console.log('🎯 [MESSAGE-SERVICE] Executando agente (modelo conversas):');
    console.log('   - conversation_id:', params.conversationId);
    console.log('   - agent_id:', params.agentDbId);
    console.log('   - instance_id:', params.instanceId);

    callbacks.onProgressUpdate('🚀 Executando agente...', params.instanceId);

    // Notificar AgentExecutionService
    const executionState: AgentExecutionState = {
      id: params.instanceId,
      emoji: params.agentEmoji || '🤖',
      title: params.agentName || 'Unknown Agent',
      prompt: params.message.trim(),
      status: 'running',
      logs: ['🚀 Agent execution started']
    };
    this.agentExecutionService.executeAgent(executionState);

    // Executar agente
    this.agentService.executeAgent(
      params.agentDbId,
      params.message.trim(),
      params.instanceId,
      cwd,
      params.screenplayId,
      params.provider,
      params.conversationId  // 🔥 Passar conversation_id
    ).subscribe({
      next: (result) => {
        callbacks.onProgressUpdate('', params.instanceId); // Limpar progresso
        this.agentExecutionService.completeAgent(params.instanceId, result);

        let responseContent = result.result || result.data?.result || 'Execução concluída';
        if (typeof responseContent === 'object') {
          responseContent = JSON.stringify(responseContent, null, 2);
        }

        // Salvar resposta no backend
        this.conversationService.addMessage(params.conversationId!, {
          agent_response: responseContent,
          agent_info: agentInfo
        }).subscribe({
          next: () => {
            console.log('✅ [MESSAGE-SERVICE] Resposta do agente salva no backend');

            // Recarregar conversa
            if (callbacks.onConversationReload) {
              callbacks.onConversationReload(params.conversationId!);
            }

            callbacks.onLoadingChange(false);
          },
          error: (error) => {
            console.error('❌ [MESSAGE-SERVICE] Erro ao salvar resposta:', error);

            // Ainda assim mostrar resposta na UI
            const responseMessage: Message = {
              id: `response-${Date.now()}`,
              content: responseContent,
              type: 'bot',
              timestamp: new Date(),
              agent: agentInfo
            };

            // Notificar componente sobre nova mensagem
            // O componente deve adicionar à lista
            callbacks.onLoadingChange(false);
          }
        });
      },
      error: (error) => {
        console.error('❌ [MESSAGE-SERVICE] Agent execution error:', error);
        callbacks.onProgressUpdate('', params.instanceId); // Limpar progresso
        this.agentExecutionService.cancelAgent(params.instanceId);
        callbacks.onLoadingChange(false);

        // Adicionar mensagem de erro
        const errorMessage: Message = {
          id: `error-${Date.now()}`,
          content: `❌ Erro: ${error.error || error.message || 'Erro ao executar agente'}`,
          type: 'bot',
          timestamp: new Date()
        };
      }
    });
  }

  /**
   * Executar agente com modelo legado
   */
  private executeAgentWithLegacyModel(
    params: MessageParams,
    chatHistories: Map<string, Message[]>,
    callbacks: MessageHandlingCallbacks
  ): void {
    // Detectar CWD da mensagem ou usar o configurado
    const cwdMatch = params.message.match(/\/[a-zA-Z0-9_.\-]+(?:\/[a-zA-Z0-9_.\-]+)+/);
    const cwd = cwdMatch ? cwdMatch[0] : params.cwd;

    callbacks.onProgressUpdate('🚀 Executando agente...', params.instanceId);

    // Notificar AgentExecutionService
    const executionState: AgentExecutionState = {
      id: params.instanceId,
      emoji: params.agentEmoji || '🤖',
      title: params.agentName || 'Unknown Agent',
      prompt: params.message.trim(),
      status: 'running',
      logs: ['🚀 Agent execution started']
    };
    this.agentExecutionService.executeAgent(executionState);

    // Executar agente
    this.agentService.executeAgent(
      params.agentDbId,
      params.message.trim(),
      params.instanceId,
      cwd,
      params.screenplayId,
      params.provider,
      params.conversationId  // 🔥 Passar conversation_id
    ).subscribe({
      next: (result) => {
        callbacks.onProgressUpdate('', params.instanceId); // Limpar progresso
        this.agentExecutionService.completeAgent(params.instanceId, result);

        let responseContent = result.result || result.data?.result || 'Execução concluída';
        if (typeof responseContent === 'object') {
          responseContent = JSON.stringify(responseContent, null, 2);
        }

        const responseMessage: Message = {
          id: `response-${Date.now()}`,
          content: responseContent,
          type: 'bot',
          timestamp: new Date()
        };

        // Atualizar histórico do agente
        const agentHistory = chatHistories.get(params.instanceId) || [];
        chatHistories.set(params.instanceId, [...agentHistory, responseMessage]);

        // Atualizar mensagens no componente se este é o agente ativo
        callbacks.onMessagesUpdate(chatHistories.get(params.instanceId) || []);
        callbacks.onLoadingChange(false);
      },
      error: (error) => {
        console.error('❌ [MESSAGE-SERVICE] Agent execution error:', error);
        callbacks.onProgressUpdate('', params.instanceId); // Limpar progresso
        this.agentExecutionService.cancelAgent(params.instanceId);
        callbacks.onLoadingChange(false);

        // Adicionar mensagem de erro ao histórico
        const errorMessage: Message = {
          id: `error-${Date.now()}`,
          content: `❌ Erro: ${error.error || error.message || 'Erro ao executar agente'}`,
          type: 'bot',
          timestamp: new Date()
        };

        const agentHistory = chatHistories.get(params.instanceId) || [];
        chatHistories.set(params.instanceId, [...agentHistory, errorMessage]);
        callbacks.onMessagesUpdate(chatHistories.get(params.instanceId) || []);
      }
    });
  }
}
