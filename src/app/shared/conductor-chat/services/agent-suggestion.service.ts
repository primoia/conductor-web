import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, catchError, tap } from 'rxjs';

/**
 * Single agent suggestion
 */
export interface AgentSuggestion {
  agent_id: string;
  name: string;
  emoji: string;
  description: string;
  score: number;
  reason: string;
}

/**
 * Response from agent suggestion endpoint
 */
export interface AgentSuggestResponse {
  suggested: AgentSuggestion | null;
  alternatives: AgentSuggestion[];
  current_is_best: boolean;
  message: string;
}

/**
 * Request for agent suggestion
 */
export interface AgentSuggestRequest {
  message: string;
  current_agent_id?: string;
}

/**
 * Agent Suggestion Service (POC)
 *
 * Calls the backend to suggest the best agent for a given message.
 * Currently uses text similarity - will be replaced by Qdrant vector search.
 */
@Injectable({
  providedIn: 'root'
})
export class AgentSuggestionService {

  constructor(private http: HttpClient) {}

  /**
   * Suggest the best agent for a message
   *
   * Uses relative URL since nginx proxies /api to the gateway
   */
  suggestAgent(message: string, currentAgentId?: string): Observable<AgentSuggestResponse> {
    const request: AgentSuggestRequest = {
      message,
      current_agent_id: currentAgentId
    };

    console.log('🧠 [SUGGEST] Requesting agent suggestion for:', message.substring(0, 50));

    // Use relative URL - nginx proxies /api to gateway
    return this.http.post<AgentSuggestResponse>(
      '/api/agents/suggest',
      request
    ).pipe(
      tap(response => {
        console.log('🧠 [SUGGEST] Response:', response);
      }),
      catchError(error => {
        console.warn('🧠 [SUGGEST] Error (falling back to current agent):', error);
        // Return empty response on error - don't block the user
        return of({
          suggested: null,
          alternatives: [],
          current_is_best: true,
          message: 'Erro ao sugerir agente'
        });
      })
    );
  }
}
