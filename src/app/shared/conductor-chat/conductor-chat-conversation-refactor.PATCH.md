/**
 * 🔥 PATCH: Refatoração do conductor-chat.component.ts
 *
 * Este arquivo contém as mudanças necessárias para suportar o novo modelo
 * de conversas globais (conversation_id) mantendo compatibilidade com o modelo legado.
 *
 * INSTRUÇÕES DE APLICAÇÃO:
 * 1. Adicionar imports no topo do arquivo
 * 2. Adicionar propriedades na classe
 * 3. Injetar ConversationService no constructor
 * 4. Substituir método loadContextForAgent()
 * 5. Substituir método handleSendMessage()
 * 6. Adicionar métodos auxiliares
 *
 * Ref: PLANO_REFATORACAO_CONVERSATION_ID.md - Fase 2
 * Data: 2025-11-01
 */

// =====================================================
// 1. IMPORTS (adicionar no topo do arquivo, após os imports existentes)
// =====================================================

import { environment } from '../../../environments/environment';
import { ConversationService, Conversation, AgentInfo as ConvAgentInfo, Message as ConvMessage } from '../../services/conversation.service';

// =====================================================
// 2. PROPRIEDADES DA CLASSE (adicionar na classe ConductorChatComponent)
// =====================================================

// 🔥 NOVO MODELO: Conversas globais
private activeConversationId: string | null = null;  // ID da conversa ativa (novo modelo)
private conversationParticipants: ConvAgentInfo[] = [];  // Participantes da conversa

// =====================================================
// 3. CONSTRUCTOR (modificar para injetar ConversationService)
// =====================================================

constructor(
  private apiService: ConductorApiService,
  private screenplayService: ScreenplayService,
  private agentService: AgentService,
  private agentExecutionService: AgentExecutionService,
  private personaEditService: PersonaEditService,
  private speechService: SpeechRecognitionService,
  private conversationService: ConversationService  // 🔥 NOVO
) { }

// =====================================================
// 4. MÉTODO loadContextForAgent() REFATORADO
// =====================================================

/**
 * Load agent context (persona, procedure, history) and display in chat
 * 🔥 REFATORADO: Suporta modelo de conversas globais quando feature flag está ativa
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
  this.chatState.isLoading = true;

  // 🔥 NOVO MODELO: Usar conversas globais
  if (environment.features?.useConversationModel) {
    this.loadContextWithConversationModel(instanceId, agentName, agentEmoji, agentDbId, cwd, screenplayId);
    return;
  }

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
        // Recarregar conversa para mostrar mensagens atualizadas
        this.loadConversation(this.activeConversationId!);
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
      active_agent: agentInfo
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
        agent: msg.agent  // Informações do agente (para mensagens de bot)
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

  // Código original de loadContextForAgent (linhas 1960-2078)
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

// =====================================================
// 5. MÉTODO handleSendMessage() REFATORADO
// =====================================================

/**
 * 🔥 REFATORADO: Enviar mensagem usando modelo de conversas quando feature flag ativa
 */
handleSendMessage(data: {message: string, provider?: string}): void {
  if (!data.message.trim() || this.chatState.isLoading) return;

  if (this.isInputBlocked()) {
    console.warn('⚠️ [CHAT] Bloqueado: defina o diretório de trabalho primeiro');
    return;
  }

  this.forceSaveScreenplayIfNeeded();

  const userMessage: Message = {
    id: Date.now().toString(),
    content: data.message.trim(),
    type: 'user',
    timestamp: new Date()
  };

  // 🔥 NOVO MODELO: Usar conversas globais
  if (environment.features?.useConversationModel && this.activeConversationId && this.activeAgentId) {
    this.handleSendMessageWithConversationModel(data, userMessage);
    return;
  }

  // 🔄 MODELO LEGADO: Código original (linhas 1531-1721)
  this.handleSendMessageWithLegacyModel(data, userMessage);
}

/**
 * 🔥 NOVO: Enviar mensagem usando modelo de conversas globais
 */
private handleSendMessageWithConversationModel(data: {message: string, provider?: string}, userMessage: Message): void {
  console.log('🔥 [CHAT] Enviando mensagem usando modelo de conversas');

  // Adicionar mensagem do usuário à conversa no backend
  const agentInfo: ConvAgentInfo = {
    agent_id: this.selectedAgentDbId || '',
    instance_id: this.activeAgentId || '',
    name: this.selectedAgentName || 'Unknown',
    emoji: this.selectedAgentEmoji || undefined
  };

  // Adicionar mensagem à UI imediatamente
  this.chatState.messages = [...this.chatState.messages.filter(msg =>
    !msg.id.startsWith('empty-')
  ), userMessage];

  this.chatState.isLoading = true;

  // Adicionar mensagem ao backend
  this.conversationService.addMessage(this.activeConversationId!, {
    user_input: data.message.trim()
  }).subscribe({
    next: () => {
      console.log('✅ [CHAT] Mensagem do usuário salva no backend');

      // Executar agente
      const currentInstanceId = this.activeAgentId!;
      const currentAgentDbId = this.selectedAgentDbId!;

      this.progressMessages.set(currentInstanceId, null);
      this.streamingMessages.set(currentInstanceId, null);

      const cwdMatch = data.message.match(/\/[a-zA-Z0-9_.\-]+(?:\/[a-zA-Z0-9_.\-]+)+/);
      const cwd = cwdMatch ? cwdMatch[0] : this.activeAgentCwd || undefined;

      console.log('🎯 [CHAT] Executando agente (modelo conversas):');
      console.log('   - conversation_id:', this.activeConversationId);
      console.log('   - agent_id:', currentAgentDbId);
      console.log('   - instance_id:', currentInstanceId);

      this.addProgressMessage('🚀 Executando agente...', currentInstanceId);

      const executionState: AgentExecutionState = {
        id: this.activeAgentId!,
        emoji: this.selectedAgentEmoji || '🤖',
        title: this.selectedAgentName || 'Unknown Agent',
        prompt: data.message.trim(),
        status: 'running',
        logs: ['🚀 Agent execution started']
      };
      this.agentExecutionService.executeAgent(executionState);

      this.subscriptions.add(
        this.agentService.executeAgent(currentAgentDbId, data.message.trim(), currentInstanceId, cwd, this.activeScreenplayId || undefined, data.provider).subscribe({
          next: (result) => {
            this.progressMessages.set(currentInstanceId, null);
            this.agentExecutionService.completeAgent(currentInstanceId, result);

            let responseContent = result.result || result.data?.result || 'Execução concluída';
            if (typeof responseContent === 'object') {
              responseContent = JSON.stringify(responseContent, null, 2);
            }

            // Adicionar resposta ao backend
            this.conversationService.addMessage(this.activeConversationId!, {
              agent_response: responseContent,
              agent_info: agentInfo
            }).subscribe({
              next: () => {
                console.log('✅ [CHAT] Resposta do agente salva no backend');

                // Recarregar conversa para exibir resposta
                this.loadConversation(this.activeConversationId!);
                this.chatState.isLoading = false;
              },
              error: (error) => {
                console.error('❌ [CHAT] Erro ao salvar resposta:', error);

                // Ainda assim mostrar resposta na UI
                const responseMessage: Message = {
                  id: `response-${Date.now()}`,
                  content: responseContent,
                  type: 'bot',
                  timestamp: new Date(),
                  agent: agentInfo
                };
                this.chatState.messages = [...this.chatState.messages, responseMessage];
                this.chatState.isLoading = false;
              }
            });
          },
          error: (error) => {
            console.error('❌ Agent execution error:', error);
            this.progressMessages.set(currentInstanceId, null);
            this.agentExecutionService.cancelAgent(currentInstanceId);
            this.handleError(error.error || error.message || 'Erro ao executar agente', currentInstanceId);
          }
        })
      );
    },
    error: (error) => {
      console.error('❌ [CHAT] Erro ao salvar mensagem do usuário:', error);
      this.chatState.isLoading = false;
    }
  });
}

/**
 * 🔄 LEGADO: Enviar mensagem usando modelo antigo (código original)
 */
private handleSendMessageWithLegacyModel(data: {message: string, provider?: string}, userMessage: Message): void {
  console.log('🔄 [CHAT] Enviando mensagem usando modelo legado');

  // Código original de handleSendMessage (linhas 1550-1721)
  const filteredMessages = this.chatState.messages.filter(msg =>
    !msg.id.startsWith('empty-history-') &&
    msg.content !== 'Nenhuma interação ainda. Inicie a conversa abaixo.'
  );

  if (this.activeAgentId) {
    const agentHistory = this.chatHistories.get(this.activeAgentId) || [];
    const filteredAgentHistory = agentHistory.filter(msg =>
      !msg.id.startsWith('empty-history-') &&
      msg.content !== 'Nenhuma interação ainda. Inicie a conversa abaixo.'
    );
    this.chatHistories.set(this.activeAgentId, [...filteredAgentHistory, userMessage]);
    this.chatState.messages = this.chatHistories.get(this.activeAgentId) || [];
  } else {
    this.chatState.messages = [...filteredMessages, userMessage];
  }

  // Verificar comando @agent
  if (this.currentMode === 'agent' && data.message.startsWith('@agent')) {
    if (data.message.includes('adicione um título')) {
      this.screenplayService.dispatch({ intent: 'add_title' });

      const confirmationMessage: Message = {
        id: `confirmation-${Date.now()}`,
        content: '✅ Título adicionado ao documento!',
        type: 'bot',
        timestamp: new Date()
      };
      this.chatState.messages = [...this.chatState.messages, confirmationMessage];
      return;
    }
  }

  this.chatState.isLoading = true;

  if (this.activeAgentId) {
    if (!this.selectedAgentDbId) {
      console.error('❌ [CHAT] Não é possível executar: agent_id está undefined!');
      this.handleError('Agente não tem agent_id definido.', this.activeAgentId);
      return;
    }

    const currentInstanceId = this.activeAgentId;
    const currentAgentDbId = this.selectedAgentDbId;

    this.progressMessages.set(currentInstanceId, null);
    this.streamingMessages.set(currentInstanceId, null);

    const cwdMatch = data.message.match(/\/[a-zA-Z0-9_.\-]+(?:\/[a-zA-Z0-9_.\-]+)+/);
    const cwd = cwdMatch ? cwdMatch[0] : this.activeAgentCwd || undefined;

    this.addProgressMessage('🚀 Executando agente...', currentInstanceId);

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
      this.agentService.executeAgent(currentAgentDbId, data.message.trim(), currentInstanceId, cwd, this.activeScreenplayId || undefined, data.provider).subscribe({
        next: (result) => {
          this.progressMessages.set(currentInstanceId, null);
          this.agentExecutionService.completeAgent(currentInstanceId, result);

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

          const agentHistory = this.chatHistories.get(currentInstanceId) || [];
          this.chatHistories.set(currentInstanceId, [...agentHistory, responseMessage]);

          if (this.activeAgentId === currentInstanceId) {
            this.chatState.messages = this.chatHistories.get(currentInstanceId) || [];
          }

          this.chatState.isLoading = false;
        },
        error: (error) => {
          this.progressMessages.set(currentInstanceId, null);
          this.agentExecutionService.cancelAgent(currentInstanceId);
          this.handleError(error.error || error.message || 'Erro ao executar agente', currentInstanceId);
        }
      })
    );
    return;
  }

  // No active agent: use MCP tools system
  const messageWithContext = this.currentMode === 'agent'
    ? `[AGENT MODE - Can modify screenplay] ${data.message.trim()}`
    : data.message.trim();

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
