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

    return from(
      fetch(`${this.baseUrl}/api/agents/${agentId}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      }).then(async response => {
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Agent execution failed: ${response.status} ${errorText}`);
        }
        return response.json();
      })
    ).pipe(
      map((response: any) => {
        // Transform API response to ExecutionResult
        return {
          success: response.success !== false,
          result: response.result || response.data?.result || response.message,
          error: response.error,
          data: response.data || response
        } as ExecutionResult;
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
   * Generate a unique instance ID for a new agent instance
   */
  generateInstanceId(): string {
    return `instance-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
