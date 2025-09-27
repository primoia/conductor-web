# Living Documents Agent Execution Integration

## Overview

This implementation connects the "Living Document" (`/screenplay`) functionality with the Conductor Gateway backend, replacing mock agent execution with real-time communication via Server-Sent Events (SSE).

## Architecture

### Core Components

1. **AgentExecutionService** (`src/app/services/agent-execution.ts`)
   - Manages agent execution queue with concurrency limit (5 simultaneous agents)
   - Handles SSE communication with conductor-gateway
   - Provides real-time status updates via RxJS observables

2. **ScreenplayInteractiveComponent** (enhanced)
   - Integrates with AgentExecutionService
   - Shows visual status indicators on agent circles
   - Displays execution queue and running agents in control panel

### Key Features

#### Queue Management
- **Concurrency Limit**: Maximum 5 agents can execute simultaneously (respects browser connection limits)
- **Automatic Queue Processing**: When an agent completes, the next queued agent starts automatically
- **Cancellation Support**: Users can cancel running or queued agents

#### Real-time Communication
- **SSE Integration**: Uses Server-Sent Events for streaming logs and results
- **Event Handling**: Processes various event types:
  - `job_started`: Execution begins
  - `status_update`: Progress messages
  - `on_llm_start`: LLM analysis begins
  - `on_llm_new_token`: Streaming LLM responses
  - `on_tool_start/end`: Tool usage notifications
  - `result`: Final execution result
  - `error`: Execution failures

#### Visual Indicators
- **Agent Status Badges**: Circular indicators on agent icons
  - ⏳ **Queued** (yellow, pulsing animation)
  - ⚡ **Running** (blue, spinning animation)
  - ✅ **Completed** (green)
  - ❌ **Error** (red)

- **Control Panel Status**:
  - Running agents list with cancel buttons
  - Queue status showing position and count
  - Real-time updates

## API Integration

### Conductor Gateway Endpoints

**POST** `/api/v1/stream-execute`
```json
{
  "uid": "agent-id-uuid",
  "title": "Agent Title",
  "textEntries": [{
    "uid": "1",
    "content": "Agent prompt/command"
  }],
  "targetType": "conductor",
  "isTemplate": false,
  "createdAt": 1640995200000,
  "updatedAt": 1640995200000
}
```

**Response:**
```json
{
  "job_id": "unique-job-identifier"
}
```

**SSE Stream:** `/api/v1/stream/{job_id}`
- Provides real-time execution events
- Automatically closes on completion or error

## Usage

### For Users
1. **Execute Agent**: Double-click any agent emoji in the Living Document
2. **Monitor Progress**: Watch status indicators and control panel
3. **Cancel Execution**: Click ❌ button next to running agents
4. **View Queue**: See queued agents in control panel

### For Developers

#### Agent Execution
```typescript
// Create execution state
const executionState: AgentExecutionState = {
  id: 'agent-uuid',
  emoji: '🤖',
  title: 'My Agent',
  prompt: 'Execute task...',
  status: 'pending',
  logs: []
};

// Start execution
this.agentExecutionService.executeAgent(executionState);
```

#### Subscribe to Updates
```typescript
// Listen to all agent state changes
this.agentExecutionService.agentState$.subscribe(
  (agentStates: Map<string, AgentExecutionState>) => {
    // Handle state updates
  }
);
```

#### Check Agent Status
```typescript
const state = this.agentExecutionService.getAgentState('agent-id');
console.log(state?.status); // 'pending' | 'queued' | 'running' | 'completed' | 'error'
console.log(state?.logs);   // Real-time execution logs
```

## Configuration

The service uses these default settings:

```typescript
private config: ConductorConfig = {
  baseUrl: 'http://localhost:5006',
  apiKey: 'test-api-key-123',
  streamEndpoint: '/api/v1/stream-execute'
};
```

## Error Handling

- **Network Errors**: Automatically handled with descriptive error messages
- **SSE Connection Issues**: Reconnection logic and fallback error states
- **API Failures**: Detailed error logging and user feedback
- **Cancellation**: Graceful cleanup of resources and connections

## Performance Considerations

- **Connection Pooling**: Respects browser's 6-connection limit per domain
- **Memory Management**: Automatic cleanup of closed EventSource connections
- **Queue Efficiency**: FIFO processing with immediate slot allocation

## Future Enhancements

- **Retry Logic**: Automatic retry for failed agents
- **Persistence**: Save/restore execution state across browser sessions
- **Batch Execution**: Execute multiple related agents in sequence
- **Execution History**: Track and display previous executions
- **Custom Prompts**: Allow users to modify agent prompts before execution

## Testing

To test the implementation:

1. **Start Conductor Gateway**: Ensure backend is running on `localhost:5006`
2. **Open Living Document**: Navigate to `/screenplay`
3. **Create Agents**: Add emoji agents to the markdown
4. **Execute**: Double-click agents to start execution
5. **Monitor**: Watch real-time status updates

## Troubleshooting

### Common Issues

1. **"SSE connection failed"**: Check if conductor-gateway is running
2. **Agents stuck in queue**: Check browser's network tab for connection limits
3. **No status updates**: Verify SSE endpoint URL and CORS configuration
4. **Execution timeout**: Check conductor-gateway logs for backend issues

### Debug Information

All execution events are logged to console with prefixes:
- `🚀 Starting execution for agent:`
- `📊 SSE Event received:`
- `❌ Agent execution error:`
- `✅ Agent execution completed successfully`
