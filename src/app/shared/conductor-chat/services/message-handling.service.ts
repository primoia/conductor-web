import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, tap, switchMap } from 'rxjs/operators';
import { ConversationService, AgentInfo as ConvAgentInfo } from '../../../services/conversation.service';
import { AgentService } from '../../../services/agent.service';
import { AgentExecutionService, AgentExecutionState } from '../../../services/agent-execution';
import { NotificationService } from '../../../services/notification.service';
import { AgentSuggestionService, AgentSuggestResponse, AgentSuggestCompareResponse } from './agent-suggestion.service';
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
    private agentExecutionService: AgentExecutionService,
    private notificationService: NotificationService,
    private agentSuggestionService: AgentSuggestionService
  ) {}

  /**
   * Enviar mensagem usando modelo de conversas globais (NOVO)
   *
   * 🔥 FLUXO HÍBRIDO DE OBSERVABILIDADE:
   * 1. Emite evento local task_inputted (feedback imediato amarelo)
   * 2. Chama rota original /api/agents/{agent_id}/execute
   * 3. Gateway/Watcher emitem eventos via WebSocket
   * 4. Resposta volta pelo fluxo original
   *
   * 🧠 AGENT SUGGESTION (POC):
   * - Before sending, checks if another agent would be better suited
   * - Shows notification if a better agent is suggested
   * - Continues with current agent (user can switch manually)
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

    // 🔥 Evento task_submitted é emitido pelo Gateway via WebSocket
    // (persistido no MongoDB e broadcast para todos os clientes)

    // Notificar loading
    callbacks.onLoadingChange(true);

    // 🧠 POC: Check for agent suggestion before sending (COMPARE MODE)
    return this.agentSuggestionService.suggestAgentCompare(params.message, params.agentDbId).pipe(
      tap((compare: AgentSuggestCompareResponse) => {
        // Build comparison notification showing both sources
        const kh = compare.knowledge_hub;
        const ql = compare.qdrant_local;

        // Extract scores and names
        const khAgent = kh?.suggested?.agent_id || 'none';
        const khScore = kh?.suggested?.score ? Math.round(kh.suggested.score * 100) : 0;
        const khEmoji = kh?.suggested?.emoji || '❓';

        const qlAgent = ql?.suggested?.agent_id || 'none';
        const qlScore = ql?.suggested?.score ? Math.round(ql.suggested.score * 100) : 0;
        const qlEmoji = ql?.suggested?.emoji || '❓';

        // Always show A/B comparison if we have results from either source
        if (khAgent !== 'none' || qlAgent !== 'none') {
          // Build comparison message
          let msg = '🔬 A/B:\n';
          msg += `🌐 KH: ${khEmoji} ${khAgent.replace('_Agent', '')} (${khScore}%)\n`;
          msg += `📦 Local: ${qlEmoji} ${qlAgent.replace('_Agent', '')} (${qlScore}%)`;

          if (khAgent === qlAgent && khAgent !== 'none') {
            msg += '\n✅ Concordam!';
          } else if (khAgent !== 'none' && qlAgent !== 'none') {
            msg += `\n⚠️ Divergem`;
          }

          this.notificationService.showInfo(msg, 8000);
          console.log('🧠 [SUGGEST-COMPARE] A/B Results:', { kh: khAgent, ql: qlAgent, winner: compare.winner });
        } else {
          console.log('🧠 [SUGGEST-COMPARE] No results from either source');
        }
      }),
      switchMap(() => {
        // BFF now saves user input + bot placeholder server-side (save_to_conversation=true)
        // Just execute the agent directly
        this.executeAgentWithConversationModel(params, agentInfo, callbacks);

        return of({
          success: true,
          userMessage
        });
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

    callbacks.onProgressUpdate('Aguardando processamento...', params.instanceId);

    // Notificar AgentExecutionService
    const executionState: AgentExecutionState = {
      id: params.instanceId,
      emoji: params.agentEmoji || '🤖',
      title: params.agentName || 'Unknown Agent',
      prompt: params.message.trim(),
      status: 'running',
      logs: ['🚀 Agent execution started']
    };
    this.agentExecutionService.trackAgent(executionState);

    // Executar agente
    this.agentService.executeAgent(
      params.agentDbId,
      params.message.trim(),
      params.instanceId,
      cwd,
      params.screenplayId,  // documentId
      params.provider,      // aiProvider
      params.conversationId,  // 🔥 Passar conversation_id
      params.screenplayId   // 🔥 Passar screenplay_id
    ).subscribe({
      next: (result) => {
        callbacks.onProgressUpdate('', params.instanceId); // Limpar progresso
        this.agentExecutionService.completeAgent(params.instanceId, result);

        let responseContent = result.result || result.data?.result || 'Execução concluída';
        if (typeof responseContent === 'object') {
          responseContent = JSON.stringify(responseContent, null, 2);
        }

        // BFF already saved the response server-side (save_to_conversation=true)
        // Just reload conversation to pick up the updated messages
        console.log('✅ [MESSAGE-SERVICE] BFF salvou resposta server-side, recarregando conversa');

        if (callbacks.onConversationReload) {
          callbacks.onConversationReload(params.conversationId!);
        }

        callbacks.onLoadingChange(false);
      },
      error: (error) => {
        console.error('❌ [MESSAGE-SERVICE] Agent execution error:', error);
        this.agentExecutionService.cancelAgent(params.instanceId);

        // Extract user-friendly error message from gateway response
        const errorMsg = this.extractErrorMessage(error);
        callbacks.onProgressUpdate(errorMsg, params.instanceId);

        // Reload conversation (if placeholder exists in MongoDB)
        if (callbacks.onConversationReload) {
          callbacks.onConversationReload(params.conversationId!);
        }

        callbacks.onLoadingChange(false);
      }
    });
  }

  /**
   * Extrai mensagem de erro legível do response do gateway
   */
  private extractErrorMessage(error: any): string {
    const msg = error?.message || error?.error || '';
    // Gateway returns: "Agent execution failed: 400 {"detail":"..."}"
    const detailMatch = msg.match(/"detail"\s*:\s*"([^"]+)"/);
    if (detailMatch) {
      return detailMatch[1];
    }
    return msg || 'Erro ao executar agente';
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

    callbacks.onProgressUpdate('Aguardando processamento...', params.instanceId);

    // Notificar AgentExecutionService
    const executionState: AgentExecutionState = {
      id: params.instanceId,
      emoji: params.agentEmoji || '🤖',
      title: params.agentName || 'Unknown Agent',
      prompt: params.message.trim(),
      status: 'running',
      logs: ['🚀 Agent execution started']
    };
    this.agentExecutionService.trackAgent(executionState);

    // Executar agente
    this.agentService.executeAgent(
      params.agentDbId,
      params.message.trim(),
      params.instanceId,
      cwd,
      params.screenplayId,  // documentId
      params.provider,      // aiProvider
      params.conversationId,  // 🔥 Passar conversation_id
      params.screenplayId   // 🔥 Passar screenplay_id
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
        const errorMsg = this.extractErrorMessage(error);
        const errorMessage: Message = {
          id: `error-${Date.now()}`,
          content: `❌ ${errorMsg}`,
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
