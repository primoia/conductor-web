import { Injectable } from '@angular/core';
import { Observable, from, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

/**
 * Agent model based on conductor agent definitions
 */
export interface Agent {
  id: string;
  name: string;
  emoji: string;
  description: string;
  prompt?: string;
  model?: string;
}

/**
 * Execution result from agent execution
 */
export interface ExecutionResult {
  success: boolean;
  result?: string;
  error?: string;
  data?: any;
}

/**
 * Chat message from agent context history
 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  [key: string]: any; // For other fields like timestamp, _id
}

/**
 * Agent context including persona, procedure, and history
 */
export interface AgentContext {
  persona: string;
  operating_procedure: string;
  history: ChatMessage[];
}

/**
 * Request payload for agent execution
 */
interface ExecutionRequest {
  input_text: string;
  instance_id: string;
}

@Injectable({
  providedIn: 'root'
})
export class AgentService {
  private baseUrl: string;

  constructor() {
    // Auto-detect base URL based on environment
    const currentHost = window.location.hostname;

    if (currentHost === 'localhost' || currentHost === '127.0.0.1') {
      this.baseUrl = 'http://localhost:5006';
    } else {
      this.baseUrl = `http://${currentHost}:5006`;
    }

    console.log(`[AgentService] Using API Base URL: ${this.baseUrl}`);
  }

  /**
   * Get all available agents from the gateway
   */
  getAgents(): Observable<Agent[]> {
    return from(
      fetch(`${this.baseUrl}/api/agents`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }).then(response => {
        if (!response.ok) {
          throw new Error(`Failed to fetch agents: ${response.status} ${response.statusText}`);
        }
        return response.json();
      })
    ).pipe(
      map((agents: any[]) => {
        // Transform API response to Agent model
        return agents.map(agent => ({
          id: agent.id || agent._id || agent.name,
          name: agent.name,
          emoji: agent.emoji || '🤖',
          description: agent.description || agent.prompt || '',
          prompt: agent.prompt,
          model: agent.model
        }));
      }),
      catchError(error => {
        console.error('[AgentService] Error fetching agents:', error);
        return throwError(() => new Error('Failed to fetch agents'));
      })
    );
  }

  /**
   * Execute an agent with given input text and instance context
   * @param agentId - The ID of the agent to execute
   * @param inputText - The text to process
   * @param instanceId - The instance ID for context isolation
   */
  executeAgent(agentId: string, inputText: string, instanceId: string): Observable<ExecutionResult> {
    const requestBody: ExecutionRequest = {
      input_text: inputText,
      instance_id: instanceId
    };

    console.log('🚀 [AGENT SERVICE] executeAgent chamado:');
    console.log('   - agentId (agent_id):', agentId);
    console.log('   - inputText:', inputText);
    console.log('   - instanceId (instance_id):', instanceId);
    console.log('   - Request Body:', JSON.stringify(requestBody, null, 2));
    console.log('   - URL:', `${this.baseUrl}/api/agents/${agentId}/execute`);
    
    if (!agentId) {
      console.error('❌ [AGENT SERVICE] ERRO: agentId está undefined/null!');
      console.error('   O agente não pode ser executado sem um agent_id válido.');
    }
    
    if (!instanceId) {
      console.warn('⚠️ [AGENT SERVICE] AVISO: instanceId está undefined/null!');
      console.warn('   O histórico não será isolado por instância.');
    }
    
    console.log('   - Enviando requisição POST para o gateway...');

    return from(
      fetch(`${this.baseUrl}/api/agents/${agentId}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      }).then(async response => {
        console.log('📥 [AGENT SERVICE] Resposta recebida do gateway:');
        console.log('   - Status:', response.status, response.statusText);
        console.log('   - Headers:', Object.fromEntries(response.headers.entries()));
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Agent execution failed: ${response.status} ${errorText}`);
        }
        return response.json();
      })
    ).pipe(
      map((response: any) => {
        console.log('✅ [AGENT SERVICE] Resposta JSON do gateway:', JSON.stringify(response, null, 2));
        // Transform API response to ExecutionResult
        const result = {
          success: response.success !== false,
          result: response.result || response.data?.result || response.message,
          error: response.error,
          data: response.data || response
        } as ExecutionResult;
        console.log('✅ [AGENT SERVICE] ExecutionResult final:', JSON.stringify(result, null, 2));
        return result;
      }),
      catchError(error => {
        console.error('[AgentService] Error executing agent:', error);
        return throwError(() => ({
          success: false,
          error: error.message || 'Agent execution failed'
        } as ExecutionResult));
      })
    );
  }

  /**
   * Get agent context (persona, operating_procedure, history) for a specific instance
   * @param instanceId - The instance ID to fetch context for
   */
  getAgentContext(instanceId: string): Observable<AgentContext> {
    console.log('📖 [AGENT SERVICE] getAgentContext chamado:');
    console.log('   - instanceId:', instanceId);
    console.log('   - URL:', `${this.baseUrl}/api/agents/context/${instanceId}`);

    return from(
      fetch(`${this.baseUrl}/api/agents/context/${instanceId}`)
        .then(async response => {
          console.log('📥 [AGENT SERVICE] Resposta de getAgentContext:');
          console.log('   - Status:', response.status, response.statusText);
          if (!response.ok) {
            // Create error with status information for better handling
            const error: any = new Error(`Failed to fetch context for agent ${instanceId}`);
            error.status = response.status;
            error.statusText = response.statusText;
            throw error;
          }
          return response.json();
        })
    ).pipe(
      catchError(error => {
        console.error(`[AgentService] Error fetching context for ${instanceId}:`, error);
        // Preserve status information in the error
        const wrappedError: any = new Error('Failed to fetch agent context');
        wrappedError.status = error.status || 500;
        wrappedError.originalError = error;
        return throwError(() => wrappedError);
      })
    );
  }

  /**
   * Generate a unique instance ID for a new agent instance
   */
  generateInstanceId(): string {
    return `instance-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
