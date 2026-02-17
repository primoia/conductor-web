import { Injectable } from '@angular/core';
import { Observable, from, throwError } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';

/**
 * Agent model based on conductor agent definitions
 */
export interface Agent {
  id: string;
  name: string;
  title?: string; // Alias for name
  emoji: string;
  description: string;
  prompt?: string;
  model?: string;
  isSystemDefault?: boolean; // Flag for system/custom agents
  is_councilor?: boolean; // Flag indicating agent is promoted to councilor
  mcp_configs?: string[]; // List of MCP sidecars assigned to this agent
  created_at?: string; // ISO date string when agent was created
  group?: string; // Agent group/category (development, crm, documentation, devops, orchestration, testing, career, other)
  tags?: string[]; // Tags for search and filtering
}

/**
 * MCP Registry Entry from Gateway /mcp/list
 * Includes on-demand status information
 */
export interface MCPRegistryEntry {
  name: string;
  type: 'internal' | 'external';
  url: string;
  host_url?: string;
  status: 'healthy' | 'unhealthy' | 'unknown' | 'stopped' | 'starting';
  tools_count: number;
  docker_compose_path?: string;
  auto_shutdown_minutes?: number;
  last_used?: string;
  metadata?: {
    category?: string;
    description?: string;
    [key: string]: any;
  };
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
  conversation_id?: string; // Conversation ID for context
  screenplay_id?: string; // Screenplay ID for project context
  save_to_conversation?: boolean; // BFF saves messages server-side
}

@Injectable({
  providedIn: 'root'
})
export class AgentService {
  /**
   * 🔒 IMPORTANTE: baseUrl deve ser VAZIO (empty string)
   * Todas as rotas DEVEM incluir /api/ explicitamente no path
   * Exemplo: `${this.baseUrl}/api/agents/instances`
   * Isso evita duplicação de /api/ no path
   */
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
      map((response: any) => {
        // API returns {total, agents} - extract the agents array
        const agents = Array.isArray(response) ? response : (response.agents || []);
        // Transform API response to Agent model
        return agents.map((agent: any) => ({
          id: agent.agent_id || agent.id,  // Support both API response formats
          name: agent.name,
          emoji: agent.emoji || '🤖',
          description: agent.description || agent.prompt || '',
          prompt: agent.prompt,
          model: agent.model,
          is_councilor: agent.is_councilor || false,  // Flag for councilor status
          mcp_configs: agent.mcp_configs || [], // List of MCP sidecars
          created_at: agent.created_at || null, // ISO date string when agent was created
          group: agent.group || 'other', // Agent group/category
          tags: agent.tags || [] // Tags for search
        }));
      }),
      catchError(error => {
        console.error('[AgentService] Error fetching agents:', error);
        return throwError(() => new Error('Failed to fetch agents'));
      })
    );
  }

  /**
   * Get available MCP sidecars from the discovery service
   * @deprecated Use getAvailableMcps() instead - this endpoint only shows running containers
   */
  getAvailableSidecars(): Observable<string[]> {
    console.warn('[AgentService] getAvailableSidecars() is deprecated. Use getAvailableMcps() instead.');
    // Redirect to new method and extract just names
    return this.getAvailableMcps().pipe(
      map(mcps => mcps.map(m => m.name))
    );
  }

  /**
   * Get all available MCPs from the Gateway registry (includes stopped MCPs)
   * This is the preferred method for MCP discovery in on-demand mode
   */
  getAvailableMcps(): Observable<MCPRegistryEntry[]> {
    return from(
      fetch(`${this.baseUrl}/mcp/list`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }).then(response => {
        if (!response.ok) {
          throw new Error(`Failed to fetch MCPs: ${response.status} ${response.statusText}`);
        }
        return response.json();
      })
    ).pipe(
      map((response: any) => {
        // Response format: { items: MCPRegistryEntry[], total, healthy_count, ... }
        if (response && response.items && Array.isArray(response.items)) {
          return response.items as MCPRegistryEntry[];
        }
        return [];
      }),
      catchError(error => {
        console.error('[AgentService] Error fetching MCPs from registry:', error);
        return throwError(() => new Error('Failed to fetch MCPs'));
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
   * @param conversationId - Optional conversation ID for context
   * @param screenplayId - Optional screenplay ID for project context
   */
  executeAgent(agentId: string, inputText: string, instanceId: string, cwd?: string, documentId?: string, aiProvider?: string, conversationId?: string, screenplayId?: string): Observable<ExecutionResult> {
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

    // Add conversation_id to request body if provided
    if (conversationId) {
      requestBody.conversation_id = conversationId;
    }

    // Add screenplay_id to request body if provided
    if (screenplayId) {
      requestBody.screenplay_id = screenplayId;
    }

    // BFF saves user input + bot response server-side when conversation model is active
    if (conversationId) {
      requestBody.save_to_conversation = true;
    }

    console.log('🚀 [AGENT SERVICE] executeAgent chamado:');
    console.log('   - agentId (agent_id):', agentId);
    console.log('   - inputText:', inputText);
    console.log('   - instanceId (instance_id):', instanceId);
    console.log('   - cwd:', cwd || 'não fornecido');
    console.log('   - document_id:', documentId || 'não fornecido');
    console.log('   - ai_provider:', aiProvider || 'padrão (config.yaml)');
    console.log('   - conversation_id:', conversationId || 'não fornecido');
    console.log('   - screenplay_id:', screenplayId || 'não fornecido');
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
   * @param filters Optional filters (agent_id, status, screenplay_id, conversation_id)
   */
  loadAllInstances(filters?: { agent_id?: string; status?: string; screenplay_id?: string; conversation_id?: string; sort?: string }): Observable<any[]> {
    console.log('📥 [AGENT SERVICE] loadAllInstances chamado');
    console.log('   - Filters:', filters);

    let url = `${this.baseUrl}/api/agents/instances`;

    // Add query parameters
    const params = new URLSearchParams();
    if (filters?.agent_id) params.append('agent_id', filters.agent_id);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.screenplay_id) params.append('screenplay_id', filters.screenplay_id);
    if (filters?.conversation_id) params.append('conversation_id', filters.conversation_id);
    if (filters?.sort) params.append('sort', filters.sort);

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
   * Update the MCP configurations for an agent instance
   * These are EXTRA MCPs that this instance uses on top of the agent template MCPs
   * @param instanceId - The instance ID to update
   * @param mcpConfigs - Array of MCP names to add to this instance
   */
  updateInstanceMcpConfigs(instanceId: string, mcpConfigs: string[]): Observable<any> {
    console.log('🔌 [AGENT SERVICE] updateInstanceMcpConfigs chamado:');
    console.log('   - instanceId:', instanceId);
    console.log('   - mcp_configs:', mcpConfigs);

    return from(
      fetch(`${this.baseUrl}/api/agents/instances/${instanceId}/mcp-configs`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mcp_configs: mcpConfigs })
      }).then(async response => {
        console.log('📥 [AGENT SERVICE] Resposta de updateInstanceMcpConfigs:');
        console.log('   - Status:', response.status, response.statusText);
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to update instance mcp_configs: ${response.status} ${errorText}`);
        }
        return response.json();
      })
    ).pipe(
      map((response: any) => {
        console.log('✅ [AGENT SERVICE] mcp_configs da instância atualizado:', response);
        return response;
      }),
      catchError(error => {
        console.error('[AgentService] Error updating instance mcp_configs:', error);
        return throwError(() => new Error('Failed to update instance mcp_configs'));
      })
    );
  }

  /**
   * Get the MCP configurations for an agent instance
   * Returns both template MCPs (inherited) and instance MCPs (extra)
   * @param instanceId - The instance ID to fetch MCPs for
   */
  getInstanceMcpConfigs(instanceId: string): Observable<{ template_mcps: string[]; instance_mcps: string[]; combined: string[] }> {
    console.log('🔌 [AGENT SERVICE] getInstanceMcpConfigs chamado:', instanceId);

    return from(
      fetch(`${this.baseUrl}/api/agents/instances/${instanceId}/mcp-configs`)
        .then(async response => {
          if (!response.ok) {
            throw new Error(`Failed to get instance mcp_configs: ${response.status}`);
          }
          return response.json();
        })
    ).pipe(
      map((response: any) => {
        console.log('✅ [AGENT SERVICE] mcp_configs da instância:', response);
        return {
          template_mcps: response.template_mcps || [],
          instance_mcps: response.instance_mcps || [],
          combined: response.combined || []
        };
      }),
      catchError(error => {
        console.error('[AgentService] Error getting instance mcp_configs:', error);
        return throwError(() => new Error('Failed to get instance mcp_configs'));
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

  /**
   * Create a new agent definition (normalized format)
   * @param agentData - The agent data to create
   * @returns Observable with the creation result
   */
  createAgent(agentData: {
    name: string;           // Must end with _Agent
    description: string;    // 10-200 chars
    persona_content: string; // Min 50 chars, must start with #
    emoji?: string;
    group?: string;         // Agent group/category
    tags?: string[];
    mcp_configs?: string[];
  }): Observable<{ status: string; agent_id: string; message: string }> {
    console.log('🛠️ [AGENT SERVICE] createAgent chamado (normalized):');
    console.log('   - name:', agentData.name);
    console.log('   - description:', agentData.description);
    console.log('   - emoji:', agentData.emoji);
    console.log('   - group:', agentData.group);
    console.log('   - tags:', agentData.tags);
    console.log('   - mcp_configs:', agentData.mcp_configs);
    console.log('   - persona_content:', agentData.persona_content?.substring(0, 50) + '...');

    const payload = {
      name: agentData.name,
      description: agentData.description,
      persona_content: agentData.persona_content,
      emoji: agentData.emoji || '🤖',
      group: agentData.group || 'other',
      tags: agentData.tags || [],
      mcp_configs: agentData.mcp_configs || []
    };

    console.log('   - Payload:', JSON.stringify(payload, null, 2));
    console.log('   - URL:', `${this.baseUrl}/api/agents`);

    return from(
      fetch(`${this.baseUrl}/api/agents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      }).then(async response => {
        console.log('📥 [AGENT SERVICE] Resposta de createAgent:');
        console.log('   - Status:', response.status, response.statusText);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ detail: response.statusText }));
          throw new Error(errorData.detail || `Failed to create agent: ${response.status}`);
        }
        return response.json();
      })
    ).pipe(
      map((response: any) => {
        console.log('✅ [AGENT SERVICE] Agente criado:', response);
        return {
          status: response.status || 'success',
          agent_id: response.agent_id,
          message: response.message || 'Agent created successfully'
        };
      }),
      catchError(error => {
        console.error('[AgentService] Error creating agent:', error);
        return throwError(() => new Error(error.message || 'Failed to create agent'));
      })
    );
  }

  /**
   * Update an agent's definition (full update)
   * @param agentId - The agent ID (e.g., "MyAgent_Agent")
   * @param updates - Fields to update
   */
  updateAgent(agentId: string, updates: {
    name?: string;
    description?: string;
    group?: string;
    emoji?: string;
    tags?: string[];
    persona_content?: string;
    mcp_configs?: string[];
  }): Observable<{ status: string; agent_id: string; updated_fields: string[] }> {
    console.log('📝 [AGENT SERVICE] updateAgent chamado:');
    console.log('   - agentId:', agentId);
    console.log('   - updates:', updates);

    return from(
      fetch(`${this.baseUrl}/api/agents/${agentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates)
      }).then(async response => {
        console.log('📥 [AGENT SERVICE] Resposta de updateAgent:');
        console.log('   - Status:', response.status, response.statusText);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ detail: response.statusText }));
          throw new Error(errorData.detail || `Failed to update agent: ${response.status}`);
        }
        return response.json();
      })
    ).pipe(
      map((response: any) => {
        console.log('✅ [AGENT SERVICE] Agente atualizado:', response);
        return {
          status: response.status || 'success',
          agent_id: response.agent_id,
          updated_fields: response.updated_fields || []
        };
      }),
      catchError(error => {
        console.error('[AgentService] Error updating agent:', error);
        return throwError(() => new Error(error.message || 'Failed to update agent'));
      })
    );
  }

  /**
   * Get an agent's persona content
   * @param agentId - The agent ID
   */
  getAgentPersona(agentId: string): Observable<{ agent_id: string; persona_content: string; has_persona: boolean }> {
    console.log('📄 [AGENT SERVICE] getAgentPersona chamado:', agentId);

    return from(
      fetch(`${this.baseUrl}/api/agents/${agentId}/persona`)
        .then(async response => {
          if (!response.ok) {
            throw new Error(`Failed to get agent persona: ${response.status}`);
          }
          return response.json();
        })
    ).pipe(
      map((response: any) => {
        console.log('✅ [AGENT SERVICE] Persona obtida:', response);
        return {
          agent_id: response.agent_id,
          persona_content: response.persona_content || '',
          has_persona: response.has_persona || false
        };
      }),
      catchError(error => {
        console.error('[AgentService] Error getting agent persona:', error);
        return throwError(() => new Error('Failed to get agent persona'));
      })
    );
  }

  /**
   * Update MCP configurations for an agent (template level, affects all instances)
   * @param agentId - The agent ID (e.g., "MyAgent_Agent")
   * @param mcpConfigs - Array of MCP names to bind to this agent
   */
  updateAgentMcpConfigs(agentId: string, mcpConfigs: string[]): Observable<Agent> {
    console.log('🔌 [AGENT SERVICE] updateAgentMcpConfigs chamado:');
    console.log('   - agentId:', agentId);
    console.log('   - mcp_configs:', mcpConfigs);

    return from(
      fetch(`${this.baseUrl}/api/agents/${agentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mcp_configs: mcpConfigs })
      }).then(async response => {
        console.log('📥 [AGENT SERVICE] Resposta de updateAgentMcpConfigs:');
        console.log('   - Status:', response.status, response.statusText);
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to update agent: ${response.status} ${errorText}`);
        }
        return response.json();
      })
    ).pipe(
      switchMap((response: any) => {
        console.log('✅ [AGENT SERVICE] Agente atualizado:', response);
        // Extract agent from response
        const agent = response.agent || response;
        return from([{
          id: agent.id || agent.agent_id,
          name: agent.name,
          emoji: agent.emoji || '🤖',
          description: agent.description || '',
          mcp_configs: agent.mcp_configs || []
        } as Agent]);
      }),
      catchError(error => {
        console.error('[AgentService] Error updating agent mcp_configs:', error);
        return throwError(() => new Error(error.message || 'Failed to update agent'));
      })
    );
  }
}
