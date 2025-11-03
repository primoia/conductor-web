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
  loadConversation?(conversationId: string): void;
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
   */
  setActiveConversation(conversationId: string | null): void {
    this.logging.info(
      `🔄 [CONVERSATION-MGT] Conversa ativa mudou: ${conversationId || 'nenhuma'}`,
      'ConversationManagementService'
    );
    this.activeConversationId$.next(conversationId);
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
  // Garantir Conversas do Roteiro
  // ==========================================

  /**
   * Garante que o roteiro tem uma conversa e a carrega no chat
   *
   * Lógica extraída do screenplay-interactive.ts (~60 linhas)
   *
   * @param screenplayId ID do roteiro
   * @param conductorChat Referência ao componente de chat
   */
  ensureScreenplayConversation(
    screenplayId: string,
    conductorChat: ConductorChatComponent
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
      'ConversationManagementService'
    );

    // Atualizar o activeScreenplayId no chat para filtrar conversas
    conductorChat.activeScreenplayId = screenplayId;

    // Buscar conversas deste roteiro
    this.conversationService.listConversations(20, 0, screenplayId).subscribe({
      next: (response) => {
        if (response.conversations.length > 0) {
          // Já tem conversas, carregar a mais recente
          const latestConversation = response.conversations[0];

          this.logging.info(
            `✅ [CONVERSATION-MGT] Carregando conversa existente: ${latestConversation.conversation_id}`,
            'ConversationManagementService'
          );

          // Atualizar conversa ativa no chat
          conductorChat.activeConversationId = latestConversation.conversation_id;

          // Atualizar estado local
          this.setActiveConversation(latestConversation.conversation_id);

          // Carregar conversa se método disponível
          if (conductorChat.loadConversation) {
            conductorChat.loadConversation(latestConversation.conversation_id);
          }

          // Refresh lista de conversas
          if (conductorChat.conversationListComponent) {
            conductorChat.conversationListComponent.refresh();
          }
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

        // Em caso de erro, criar conversa automaticamente
        conductorChat.createNewConversationForScreenplay();
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
