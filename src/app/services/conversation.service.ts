/**
 * 🔥 NOVO: Serviço para gerenciar conversas globais
 *
 * Este serviço implementa o novo modelo de conversações onde:
 * - Uma conversa é independente de agentes específicos
 * - Múltiplos agentes podem participar da mesma conversa
 * - Histórico é unificado e compartilhado entre agentes
 *
 * Ref: PLANO_REFATORACAO_CONVERSATION_ID.md - Fase 2
 * Data: 2025-11-01
 */

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

// ==========================================
// Interfaces/Modelos
// ==========================================

export interface AgentInfo {
  agent_id: string;
  instance_id: string;
  name: string;
  emoji?: string;
}

export interface Message {
  id: string;
  type: 'user' | 'bot';
  content: string;
  timestamp: string;
  agent?: AgentInfo;  // Presente apenas em mensagens de bot
}

export interface Conversation {
  conversation_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  active_agent?: AgentInfo;
  participants: AgentInfo[];
  messages: Message[];
}

export interface ConversationSummary {
  conversation_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  participant_count: number;
}

export interface CreateConversationRequest {
  title?: string;
  active_agent?: AgentInfo;
}

export interface AddMessageRequest {
  user_input?: string;
  agent_response?: string;
  agent_info?: AgentInfo;
}

export interface SetActiveAgentRequest {
  agent_info: AgentInfo;
}

@Injectable({
  providedIn: 'root'
})
export class ConversationService {
  private readonly apiUrl: string;

  constructor(private http: HttpClient) {
    this.apiUrl = `${environment.apiUrl}/conversations`;
  }

  /**
   * Cria uma nova conversa.
   */
  createConversation(request: CreateConversationRequest): Observable<{ conversation_id: string; title: string; created_at: string }> {
    return this.http.post<{ conversation_id: string; title: string; created_at: string }>(
      this.apiUrl,
      request
    );
  }

  /**
   * Obtém uma conversa pelo ID.
   */
  getConversation(conversationId: string): Observable<Conversation> {
    return this.http.get<Conversation>(`${this.apiUrl}/${conversationId}`);
  }

  /**
   * Adiciona uma mensagem (usuário e/ou agente) à conversa.
   */
  addMessage(conversationId: string, request: AddMessageRequest): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(
      `${this.apiUrl}/${conversationId}/messages`,
      request
    );
  }

  /**
   * Define o agente ativo para a próxima resposta.
   */
  setActiveAgent(conversationId: string, request: SetActiveAgentRequest): Observable<{ success: boolean; message: string }> {
    return this.http.put<{ success: boolean; message: string }>(
      `${this.apiUrl}/${conversationId}/active-agent`,
      request
    );
  }

  /**
   * Lista conversas recentes.
   */
  listConversations(limit: number = 20, skip: number = 0): Observable<{ total: number; conversations: ConversationSummary[] }> {
    return this.http.get<{ total: number; conversations: ConversationSummary[] }>(
      this.apiUrl,
      {
        params: {
          limit: limit.toString(),
          skip: skip.toString()
        }
      }
    );
  }

  /**
   * Deleta uma conversa.
   */
  deleteConversation(conversationId: string): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(
      `${this.apiUrl}/${conversationId}`
    );
  }

  /**
   * Obtém as mensagens de uma conversa.
   */
  getConversationMessages(conversationId: string, limit?: number): Observable<{ conversation_id: string; total: number; messages: Message[] }> {
    const params: any = {};
    if (limit) {
      params.limit = limit.toString();
    }

    return this.http.get<{ conversation_id: string; total: number; messages: Message[] }>(
      `${this.apiUrl}/${conversationId}/messages`,
      { params }
    );
  }
}
