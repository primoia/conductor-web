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
 * Backend returns: { user_input: string, ai_response: string, ... }
 * Frontend expects: { role: string, content: string }
 */
export interface ChatMessage {
  role?: 'user' | 'assistant' | 'system';
  content?: string;
  user_input?: string;  // Backend format
  ai_response?: string; // Backend format
  [key: string]: any; // For other fields like timestamp, _id
}

/**
 * Agent context including persona, procedure, history, and configuration
 */
export interface AgentContext {
  persona: string;
  operating_procedure: string;
  history: ChatMessage[];
  cwd?: string; // Working directory from agent instance
}

/**
 * Request payload for agent execution
 */
interface ExecutionRequest {
  input_text: string;
  instance_id: string;
  cwd?: string;
  document_id?: string; // SAGA-006: Add document_id for screenplay association
  ai_provider?: string; // Phase 2: Add ai_provider for provider selection
}

@Injectable({
  providedIn: 'root'
})
export class AgentService {
  private baseUrl: string = '';

  constructor() {
    console.log(`[AgentService] Using API Base URL: ${this.baseUrl || 'empty (routes have /api/)'}`);
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
          id: agent.agent_id || agent.name,  // Use agent_id (name) not _id (ObjectId)
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
   * @param cwd - Optional working directory path
   * @param documentId - Optional document ID for screenplay association
   * @param aiProvider - Optional AI provider override (e.g., 'claude', 'gemini')
   */
  executeAgent(agentId: string, inputText: string, instanceId: string, cwd?: string, documentId?: string, aiProvider?: string): Observable<ExecutionResult> {
    const requestBody: ExecutionRequest = {
      input_text: inputText,
      instance_id: instanceId
    };

    // Add cwd to request body if provided
    if (cwd) {
      requestBody.cwd = cwd;
    }

    // Add document_id to request body if provided
    if (documentId) {
      requestBody.document_id = documentId;
    }

    // Add ai_provider to request body if provided
    if (aiProvider) {
      requestBody.ai_provider = aiProvider;
    }

    console.log('🚀 [AGENT SERVICE] executeAgent chamado:');
    console.log('   - agentId (agent_id):', agentId);
    console.log('   - inputText:', inputText);
    console.log('   - instanceId (instance_id):', instanceId);
    console.log('   - cwd:', cwd || 'não fornecido');
    console.log('   - document_id:', documentId || 'não fornecido');
    console.log('   - ai_provider:', aiProvider || 'padrão (config.yaml)');
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
        console.log('   - response.result type:', typeof response.result);
        console.log('   - response.result value:', response.result);
        console.log('   - response.data:', response.data);
        console.log('   - response.message:', response.message);

        // Extract the actual AI response text
        let resultText = '';

        // Try different possible response formats from backend
        if (typeof response.result === 'string' && response.result.trim().length > 0) {
          resultText = response.result;
        } else if (typeof response === 'string' && response.trim().length > 0) {
          resultText = response;
        } else if (response.ai_response && typeof response.ai_response === 'string') {
          resultText = response.ai_response;
        } else if (response.data?.ai_response && typeof response.data.ai_response === 'string') {
          resultText = response.data.ai_response;
        } else if (response.data?.result && typeof response.data.result === 'string') {
          resultText = response.data.result;
        } else if (response.message && typeof response.message === 'string') {
          resultText = response.message;
        } else if (response.output && typeof response.output === 'string') {
          resultText = response.output;
        } else if (response.response && typeof response.response === 'string') {
          resultText = response.response;
        } else if (response.result && typeof response.result === 'object') {
          // If result is an object, try to extract text from it
          if (response.result.result && typeof response.result.result === 'string') {
            // Nested result.result
            resultText = response.result.result;
          } else if (response.result.ai_response) {
            resultText = response.result.ai_response;
          } else if (response.result.output) {
            resultText = response.result.output;
          } else if (response.result.text) {
            resultText = response.result.text;
          } else {
            console.error('❌ Could not extract text from result object:', response.result);
            resultText = 'Erro: Resposta em formato não reconhecido. Verifique os logs do console.';
          }
        } else {
          // Last resort - show error message
          console.error('❌ Could not extract text from response:', response);
          resultText = 'Erro: Resposta em formato não reconhecido. Verifique os logs do console.';
        }

        // Ensure we have some content
        if (!resultText || resultText.trim().length === 0) {
          resultText = 'Resposta vazia do agente';
        }

        const result = {
          success: response.success !== false,
          result: resultText,
          error: response.error,
          data: response
        } as ExecutionResult;

        console.log('✅ [AGENT SERVICE] ExecutionResult final - result text:', resultText.substring(0, 100));
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
   * Update the working directory (cwd) for an agent instance
   * @param instanceId - The instance ID to update
   * @param cwd - The new working directory path
   */
  updateInstanceCwd(instanceId: string, cwd: string): Observable<any> {
    console.log('📁 [AGENT SERVICE] updateInstanceCwd chamado:');
    console.log('   - instanceId:', instanceId);
    console.log('   - cwd:', cwd);

    return from(
      fetch(`${this.baseUrl}/api/agents/instances/${instanceId}/cwd`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cwd })
      }).then(async response => {
        console.log('📥 [AGENT SERVICE] Resposta de updateInstanceCwd:');
        console.log('   - Status:', response.status, response.statusText);
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to update instance cwd: ${response.status} ${errorText}`);
        }
        return response.json();
      })
    ).pipe(
      catchError(error => {
        console.error('[AgentService] Error updating instance cwd:', error);
        return throwError(() => new Error('Failed to update instance cwd'));
      })
    );
  }

  /**
   * Load all agent instances from MongoDB
   * @param filters Optional filters (agent_id, status)
   */
  loadAllInstances(filters?: { agent_id?: string; status?: string }): Observable<any[]> {
    console.log('📥 [AGENT SERVICE] loadAllInstances chamado');
    console.log('   - Filters:', filters);

    let url = `${this.baseUrl}/api/agents/instances`;

    // Add query parameters
    const params = new URLSearchParams();
    if (filters?.agent_id) params.append('agent_id', filters.agent_id);
    if (filters?.status) params.append('status', filters.status);

    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    return from(
      fetch(url)
        .then(async response => {
          console.log('📥 [AGENT SERVICE] Resposta de loadAllInstances:');
          console.log('   - Status:', response.status, response.statusText);
          if (!response.ok) {
            throw new Error(`Failed to load instances: ${response.status}`);
          }
          return response.json();
        })
    ).pipe(
      map((response: any) => {
        console.log('✅ [AGENT SERVICE] Instâncias carregadas:', response.count);
        return response.instances || [];
      }),
      catchError(error => {
        console.error('[AgentService] Error loading instances:', error);
        return throwError(() => new Error('Failed to load instances'));
      })
    );
  }

  /**
   * Get a specific agent instance from MongoDB
   * @param instanceId - The instance ID to fetch
   */
  getInstanceById(instanceId: string): Observable<any> {
    console.log('📥 [AGENT SERVICE] getInstanceById chamado:', instanceId);

    return from(
      fetch(`${this.baseUrl}/api/agents/instances/${instanceId}`)
        .then(async response => {
          console.log('📥 [AGENT SERVICE] Resposta de getInstanceById:');
          console.log('   - Status:', response.status, response.statusText);
          if (!response.ok) {
            const error: any = new Error(`Failed to get instance: ${response.status}`);
            error.status = response.status;
            throw error;
          }
          return response.json();
        })
    ).pipe(
      map((response: any) => {
        console.log('✅ [AGENT SERVICE] Instância obtida:', response.instance);
        return response.instance;
      }),
      catchError(error => {
        console.error('[AgentService] Error getting instance:', error);
        const wrappedError: any = new Error('Failed to get instance');
        wrappedError.status = error.status || 500;
        return throwError(() => wrappedError);
      })
    );
  }

  /**
   * Update an agent instance in MongoDB
   * @param instanceId - The instance ID to update
   * @param updates - Fields to update (position, status, config, etc.)
   */
  updateInstance(instanceId: string, updates: any): Observable<any> {
    console.log('📝 [AGENT SERVICE] updateInstance chamado:');
    console.log('   - instanceId:', instanceId);
    console.log('   - updates:', updates);

    return from(
      fetch(`${this.baseUrl}/api/agents/instances/${instanceId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates)
      }).then(async response => {
        console.log('📥 [AGENT SERVICE] Resposta de updateInstance:');
        console.log('   - Status:', response.status, response.statusText);
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to update instance: ${response.status} ${errorText}`);
        }
        return response.json();
      })
    ).pipe(
      map((response: any) => {
        console.log('✅ [AGENT SERVICE] Instância atualizada:', response);
        return response;
      }),
      catchError(error => {
        console.error('[AgentService] Error updating instance:', error);
        return throwError(() => new Error('Failed to update instance'));
      })
    );
  }

  /**
   * Delete an agent instance from MongoDB
   * @param instanceId - The instance ID to delete
   * @param cascade - If true, also delete related data (history, logs)
   */
  deleteInstance(instanceId: string, cascade: boolean = false): Observable<any> {
    console.log('🗑️ [AGENT SERVICE] deleteInstance chamado:');
    console.log('   - instanceId:', instanceId);
    console.log('   - cascade:', cascade);

    const url = `${this.baseUrl}/api/agents/instances/${instanceId}${cascade ? '?cascade=true' : ''}`;

    return from(
      fetch(url, {
        method: 'DELETE'
      }).then(async response => {
        console.log('📥 [AGENT SERVICE] Resposta de deleteInstance:');
        console.log('   - Status:', response.status, response.statusText);
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to delete instance: ${response.status} ${errorText}`);
        }
        return response.json();
      })
    ).pipe(
      map((response: any) => {
        console.log('✅ [AGENT SERVICE] Instância deletada:', response);
        return response;
      }),
      catchError(error => {
        console.error('[AgentService] Error deleting instance:', error);
        return throwError(() => new Error('Failed to delete instance'));
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
