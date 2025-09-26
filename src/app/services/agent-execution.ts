import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

// Agent execution state interface
export interface AgentExecutionState {
  id: string;
  emoji: string;
  title: string;
  prompt: string;
  status: 'pending' | 'queued' | 'running' | 'completed' | 'error';
  logs: string[];
  result?: any;
  startTime?: Date;
  endTime?: Date;
  error?: string;
}

// SSE event structure based on chat reference
interface SSEEvent {
  event: string;
  data: any;
}

// Configuration for conductor gateway
interface ConductorConfig {
  baseUrl: string;
  apiKey: string;
  streamEndpoint: string;
}

@Injectable({
  providedIn: 'root'
})
export class AgentExecutionService {
  private readonly MAX_CONCURRENT_AGENTS = 5; // Browser connection limit consideration

  // Queue management
  private pendingAgentsQueue: AgentExecutionState[] = [];
  private runningAgents = new Map<string, EventSource>();

  // State management
  private agentStateSubject = new BehaviorSubject<Map<string, AgentExecutionState>>(new Map());
  public agentState$ = this.agentStateSubject.asObservable();

  // Configuration
  private config: ConductorConfig = {
    baseUrl: 'http://localhost:5005', // Porta corrigida para 5005
    apiKey: 'test-api-key-123',
    streamEndpoint: '/api/v1/stream-execute'
  };

  constructor() { }

  /**
   * Main method to execute an agent - adds to queue or starts immediately
   */
  public executeAgent(agent: AgentExecutionState): void {
    this.updateAgentState(agent.id, { ...agent, status: 'queued', logs: ['Agent added to queue...'] });

    if (this.runningAgents.size < this.MAX_CONCURRENT_AGENTS) {
      this._startAgentExecution(agent);
    } else {
      this.pendingAgentsQueue.push(agent);
      this.updateAgentState(agent.id, {
        logs: [...(this.getAgentState(agent.id)?.logs || []), `Waiting in queue (position ${this.pendingAgentsQueue.length})...`]
      });
    }
  }

  /**
   * Get current state of a specific agent
   */
  public getAgentState(agentId: string): AgentExecutionState | undefined {
    return this.agentStateSubject.getValue().get(agentId);
  }

  /**
   * Get all agent states as array
   */
  public getAllAgentStates(): AgentExecutionState[] {
    return Array.from(this.agentStateSubject.getValue().values());
  }

  /**
   * Cancel a running or queued agent
   */
  public cancelAgent(agentId: string): void {
    // Remove from queue if pending
    this.pendingAgentsQueue = this.pendingAgentsQueue.filter(a => a.id !== agentId);

    // Close SSE connection if running
    const eventSource = this.runningAgents.get(agentId);
    if (eventSource) {
      eventSource.close();
      this.runningAgents.delete(agentId);
      this.updateAgentState(agentId, {
        status: 'error',
        error: 'Cancelled by user',
        endTime: new Date(),
        logs: [...(this.getAgentState(agentId)?.logs || []), 'Agent execution cancelled']
      });
      this._processNextInQueue();
    }
  }

  /**
   * Process the next agent in queue when a slot becomes available
   */
  private _processNextInQueue(): void {
    if (this.pendingAgentsQueue.length > 0 && this.runningAgents.size < this.MAX_CONCURRENT_AGENTS) {
      const nextAgent = this.pendingAgentsQueue.shift()!;
      this._startAgentExecution(nextAgent);
    }
  }

  /**
   * Start actual execution of an agent using SSE communication
   */
  private async _startAgentExecution(agent: AgentExecutionState): Promise<void> {
    this.updateAgentState(agent.id, {
      status: 'running',
      startTime: new Date(),
      logs: [...(this.getAgentState(agent.id)?.logs || []), 'Starting agent execution...']
    });

    try {
      // Step 1: Initialize execution via POST request
      const startUrl = `${this.config.baseUrl}${this.config.streamEndpoint}`;
      console.log('Starting streaming execution:', startUrl);

      const payload = {
        uid: Date.now().toString(),
        title: "Agent Execution",
        textEntries: [{
          uid: "1",
          content: agent.prompt
        }],
        targetType: "conductor",
        isTemplate: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      console.log('Payload:', JSON.stringify(payload, null, 2));

      const response = await fetch(startUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.config.apiKey,
        },
        body: JSON.stringify(payload)
      });

      console.log('Response status:', response.status, response.statusText);

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const { job_id } = await response.json();

      this.updateAgentState(agent.id, {
        logs: [...(this.getAgentState(agent.id)?.logs || []), `Job started with ID: ${job_id}`]
      });

      // Step 2: Connect to SSE stream
      const streamUrl = `${this.config.baseUrl}/api/v1/stream/${job_id}`;
      const eventSource = new EventSource(streamUrl);
      this.runningAgents.set(agent.id, eventSource);

      eventSource.onopen = () => {
        this.updateAgentState(agent.id, {
          logs: [...(this.getAgentState(agent.id)?.logs || []), 'Connected to execution stream']
        });
      };

      eventSource.onmessage = (event) => {
        try {
          const data: SSEEvent = JSON.parse(event.data);
          this._handleSSEEvent(agent.id, data);
        } catch (parseError) {
          console.error('Error parsing SSE data:', parseError);
          this.updateAgentState(agent.id, {
            logs: [...(this.getAgentState(agent.id)?.logs || []), 'Error parsing stream data']
          });
        }
      };

      eventSource.addEventListener('end_of_stream', () => {
        this._finalizeExecution(agent.id, false);
      });

      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        this._finalizeExecution(agent.id, true, 'SSE connection failed');
      };

    } catch (error) {
      console.error('Agent execution error:', error);
      this._finalizeExecution(agent.id, true, error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * Handle different types of SSE events
   */
  private _handleSSEEvent(agentId: string, data: SSEEvent): void {
    const currentLogs = this.getAgentState(agentId)?.logs || [];

    switch (data.event) {
      case 'job_started':
        this.updateAgentState(agentId, {
          logs: [...currentLogs, '🚀 Job execution started']
        });
        break;

      case 'status_update':
        this.updateAgentState(agentId, {
          logs: [...currentLogs, `📊 ${data.data?.message || 'Processing...'}`]
        });
        break;

      case 'on_llm_start':
        this.updateAgentState(agentId, {
          logs: [...currentLogs, '🤖 LLM analysis starting...']
        });
        break;

      case 'on_llm_new_token':
        if (data.data?.chunk) {
          this.updateAgentState(agentId, {
            logs: [...currentLogs, `🔤 ${data.data.chunk}`]
          });
        }
        break;

      case 'on_tool_start':
        if (data.data?.tool) {
          const toolName = data.data.tool.name || data.data.tool;
          this.updateAgentState(agentId, {
            logs: [...currentLogs, `🔧 Using tool: ${toolName}`]
          });
        }
        break;

      case 'on_tool_end':
        if (data.data?.output) {
          const toolResult = data.data.output.substring(0, 100) + (data.data.output.length > 100 ? '...' : '');
          this.updateAgentState(agentId, {
            logs: [...currentLogs, `⚙️ Tool completed: ${toolResult}`]
          });
        }
        break;

      case 'result':
        const result = data.data;
        let resultMessage = '✅ Agent execution completed successfully';

        // Extract the actual result content
        if (result && typeof result === 'object') {
          if (result.result) {
            resultMessage = `✅ Result: ${result.result}`;
          } else if (result.message) {
            resultMessage = `✅ Result: ${result.message}`;
          } else if (result.content) {
            resultMessage = `✅ Result: ${result.content}`;
          } else {
            resultMessage = `✅ Result: ${JSON.stringify(result)}`;
          }
        } else if (result && typeof result === 'string') {
          resultMessage = `✅ Result: ${result}`;
        }

        console.log('📋 Full result data:', result);

        this.updateAgentState(agentId, {
          status: 'completed',
          result: result,
          endTime: new Date(),
          logs: [...currentLogs, resultMessage]
        });
        this._finalizeExecution(agentId, false);
        break;

      case 'error':
        this._finalizeExecution(agentId, true, data.data?.error || 'Execution error occurred');
        break;

      default:
        this.updateAgentState(agentId, {
          logs: [...currentLogs, `📝 ${data.event}: ${JSON.stringify(data.data).substring(0, 100)}`]
        });
        break;
    }
  }

  /**
   * Finalize execution and clean up resources
   */
  private _finalizeExecution(agentId: string, isError: boolean, errorMessage?: string): void {
    const eventSource = this.runningAgents.get(agentId);
    if (eventSource) {
      eventSource.close();
      this.runningAgents.delete(agentId);
    }

    if (isError) {
      this.updateAgentState(agentId, {
        status: 'error',
        error: errorMessage || 'Unknown error',
        endTime: new Date(),
        logs: [...(this.getAgentState(agentId)?.logs || []), `❌ Error: ${errorMessage || 'Unknown error'}`]
      });
    } else if (this.getAgentState(agentId)?.status !== 'completed') {
      this.updateAgentState(agentId, {
        status: 'completed',
        endTime: new Date()
      });
    }

    // Process next agent in queue
    this._processNextInQueue();
  }

  /**
   * Update agent state and emit to subscribers
   */
  private updateAgentState(id: string, partialState: Partial<AgentExecutionState>): void {
    const currentStates = this.agentStateSubject.getValue();
    const currentState = currentStates.get(id) || {
      id,
      emoji: '🤖',
      title: 'Unknown Agent',
      prompt: '',
      status: 'pending',
      logs: []
    } as AgentExecutionState;

    const newState = { ...currentState, ...partialState };
    currentStates.set(id, newState);
    this.agentStateSubject.next(new Map(currentStates));
  }
}
