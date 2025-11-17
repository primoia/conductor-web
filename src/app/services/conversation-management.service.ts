/**
 * 🎯 Serviço de Gerenciamento de Conversas
 *
 * Responsável por gerenciar o estado e ciclo de vida das conversas
 * dentro do contexto do ScreenplayInteractive.
 *
 * Extração: Reduz ~300-400 linhas do screenplay-interactive.ts
 * Complexidade: MÉDIA-BAIXA
 * Risco: BAIXO (funcionalidade isolada)
 *
 * @author Refatoração - 2025-11-03
 */

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ConversationService, ConversationSummary } from './conversation.service';
import { LoggingService } from './logging.service';

/**
 * Interface para o componente ConductorChat
 * (usado para evitar dependência circular e manter tipagem)
 */
export interface ConductorChatComponent {
  activeScreenplayId: string | null;
  activeConversationId: string | null;
  createNewConversationForScreenplay(): void;
  clear(): void;
  setActiveConversation(conversationId: string | null): void;  // 🔒 BUG FIX: Adicionar método
  conversationListComponent?: any;
}

@Injectable({
  providedIn: 'root'
})
export class ConversationManagementService {

  /**
   * 🎯 Estado reativo: ID da conversa ativa
   */
  private activeConversationId$ = new BehaviorSubject<string | null>(null);

  /**
   * Observable público para componentes se inscreverem
   */
  public activeConversation$ = this.activeConversationId$.asObservable();

  constructor(
    private conversationService: ConversationService,
    private logging: LoggingService
  ) {}

  // ==========================================
  // Gerenciamento de Estado da Conversa Ativa
  // ==========================================

  /**
   * Define a conversa ativa
   * 🔥 NOVO: Também salva como última conversa usada no localStorage
   */
  setActiveConversation(conversationId: string | null, screenplayId?: string): void {
    this.logging.info(
      `🔄 [CONVERSATION-MGT] Conversa ativa mudou: ${conversationId || 'nenhuma'}`,
      'ConversationManagementService'
    );
    this.activeConversationId$.next(conversationId);

    // 🔥 NOVO: Salvar como última conversa usada se temos screenplay e conversation
    if (conversationId && screenplayId) {
      this.saveLastConversationForScreenplay(screenplayId, conversationId);
    }
  }

  /**
   * Retorna o ID da conversa ativa atual (síncrono)
   */
  getActiveConversationId(): string | null {
    return this.activeConversationId$.value;
  }

  /**
   * Retorna observable da conversa ativa
   */
  getActiveConversation$(): Observable<string | null> {
    return this.activeConversation$;
  }

  /**
   * Limpa o estado da conversa ativa
   */
  clearActiveConversation(): void {
    this.logging.info('🧹 [CONVERSATION-MGT] Limpando conversa ativa', 'ConversationManagementService');
    this.activeConversationId$.next(null);
  }

  // ==========================================
  // Memória de Última Conversa (localStorage)
  // ==========================================

  /**
   * 🔥 NOVO: Salva a última conversa usada para um screenplay específico
   */
  private saveLastConversationForScreenplay(screenplayId: string, conversationId: string): void {
    const key = `last_conversation_${screenplayId}`;
    localStorage.setItem(key, conversationId);
    this.logging.info(
      `💾 [CONVERSATION-MGT] Última conversa salva para screenplay ${screenplayId}: ${conversationId}`,
      'ConversationManagementService'
    );
  }

  /**
   * 🔥 NOVO: Recupera a última conversa usada para um screenplay específico
   */
  private getLastConversationForScreenplay(screenplayId: string): string | null {
    const key = `last_conversation_${screenplayId}`;
    const conversationId = localStorage.getItem(key);
    if (conversationId) {
      this.logging.info(
        `💾 [CONVERSATION-MGT] Última conversa recuperada para screenplay ${screenplayId}: ${conversationId}`,
        'ConversationManagementService'
      );
    }
    return conversationId;
  }

  // ==========================================
  // Garantir Conversas do Roteiro
  // ==========================================

  /**
   * Garante que o roteiro tem uma conversa e a carrega no chat
   *
   * Lógica extraída do screenplay-interactive.ts (~60 linhas)
   *
   * @param screenplayId ID do roteiro
   * @param conductorChat Referência ao componente de chat
   * @param preferredConversationId ID da conversa preferencial (da URL, por exemplo)
   */
  ensureScreenplayConversation(
    screenplayId: string,
    conductorChat: ConductorChatComponent,
    preferredConversationId?: string | null
  ): void {
    if (!conductorChat) {
      this.logging.warn(
        '⚠️ [CONVERSATION-MGT] ConductorChat não disponível',
        'ConversationManagementService'
      );
      return;
    }

    this.logging.info(
      `🔍 [CONVERSATION-MGT] Verificando conversas para screenplay: ${screenplayId}`,
      'ConversationManagementService',
      { preferredConversationId }
    );

    // Atualizar o activeScreenplayId no chat para filtrar conversas
    conductorChat.activeScreenplayId = screenplayId;

    // 🔥 FIX: Sempre buscar e mostrar lista de conversas, mas só auto-selecionar se não há preferência da URL
    // Buscar conversas deste roteiro
    this.conversationService.listConversations(20, 0, screenplayId).subscribe({
      next: (response) => {
        // Refresh lista de conversas para mostrar todas as conversas disponíveis
        if (conductorChat.conversationListComponent) {
          conductorChat.conversationListComponent.refresh();
        }

        // Se há conversa preferencial da URL, não auto-selecionar
        if (preferredConversationId) {
          this.logging.info(
            `⏭️ [CONVERSATION-MGT] Pulando auto-select - conversationId da URL será aplicado: ${preferredConversationId}`,
            'ConversationManagementService'
          );
          return;
        }

        // Se não há preferência da URL, comportamento normal
        if (response.conversations.length > 0) {
          // 🔥 NOVO: Tentar carregar última conversa usada para este screenplay
          const lastConversationId = this.getLastConversationForScreenplay(screenplayId);
          let conversationToLoad = null;

          // Verificar se a última conversa ainda existe na lista
          if (lastConversationId) {
            conversationToLoad = response.conversations.find(
              (c) => c.conversation_id === lastConversationId
            );
          }

          // Se não encontrou a última usada, usar a última da lista
          if (!conversationToLoad) {
            conversationToLoad = response.conversations[response.conversations.length - 1];
          }

          this.logging.info(
            `✅ [CONVERSATION-MGT] Carregando conversa ${lastConversationId ? 'memorizada' : 'última da lista'}: ${conversationToLoad.conversation_id}`,
            'ConversationManagementService'
          );

          // 🔒 BUG FIX: Usar setActiveConversation() para emitir evento activeConversationChanged
          // Isso garante que o screenplay-interactive atualize os agentes
          conductorChat.setActiveConversation(conversationToLoad.conversation_id);

          // Atualizar estado local e salvar no localStorage
          this.setActiveConversation(conversationToLoad.conversation_id, screenplayId);
        } else {
          // Não tem conversas, criar uma automaticamente
          this.logging.info(
            `🆕 [CONVERSATION-MGT] Criando conversa para roteiro sem conversas`,
            'ConversationManagementService'
          );
          conductorChat.createNewConversationForScreenplay();
        }
      },
      error: (error) => {
        this.logging.error(
          '❌ [CONVERSATION-MGT] Erro ao buscar conversas:',
          error,
          'ConversationManagementService'
        );

        // Em caso de erro, criar conversa automaticamente (só se não há URL param)
        if (!preferredConversationId) {
          conductorChat.createNewConversationForScreenplay();
        }
      }
    });
  }

  // ==========================================
  // Operações de Conversa
  // ==========================================

  /**
   * Deleta uma conversa
   */
  deleteConversation(conversationId: string): Observable<{ success: boolean; message: string }> {
    this.logging.info(
      `🗑️ [CONVERSATION-MGT] Deletando conversa: ${conversationId}`,
      'ConversationManagementService'
    );

    return this.conversationService.deleteConversation(conversationId);
  }

  /**
   * Lista conversas de um roteiro
   */
  listConversations(
    screenplayId?: string,
    limit: number = 20,
    skip: number = 0
  ): Observable<{ total: number; conversations: ConversationSummary[] }> {
    return this.conversationService.listConversations(limit, skip, screenplayId);
  }

  /**
   * Limpa completamente o estado do chat
   *
   * Usado quando troca de roteiro ou cria novo
   */
  clearChatState(conductorChat: ConductorChatComponent | null): void {
    this.logging.info('🧹 [CONVERSATION-MGT] Limpando estado do chat', 'ConversationManagementService');

    // Limpar estado local
    this.clearActiveConversation();

    // Limpar chat context se disponível
    if (conductorChat) {
      conductorChat.clear();
    }

    this.logging.info('✅ [CONVERSATION-MGT] Estado do chat limpo', 'ConversationManagementService');
  }
}
