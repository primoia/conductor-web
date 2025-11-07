# Conductor Web - Chat Implementation Exploration Report

## Executive Summary

The conductor-web project is an **Angular 20+ standalone application** with a comprehensive chat system featuring Server-Sent Events (SSE) streaming, multiple agents, conversations management, and real-time message handling. The application uses a modular architecture with service-based communication.

---

## 1. Project Architecture Overview

### Technology Stack
- **Framework**: Angular 20+ (Standalone Components)
- **Build Tool**: Vite + Angular CLI
- **Real-Time Communication**: Server-Sent Events (SSE) with EventSource API
- **State Management**: RxJS Observables
- **Rich Text Editor**: TipTap (for message input)
- **HTTP Client**: Angular HttpClient
- **Package Manager**: npm

### Project Structure
```
conductor-web/
├── src/
│   ├── app/
│   │   ├── shared/
│   │   │   ├── conductor-chat/          # 🎯 MAIN CHAT COMPONENT
│   │   │   │   ├── components/
│   │   │   │   │   ├── chat-input/
│   │   │   │   │   ├── chat-messages/
│   │   │   │   │   └── status-indicator/
│   │   │   │   ├── services/
│   │   │   │   │   ├── conductor-api.service.ts
│   │   │   │   │   ├── message-handling.service.ts
│   │   │   │   │   ├── modal-state.service.ts
│   │   │   │   │   └── speech-recognition.service.ts
│   │   │   │   ├── models/
│   │   │   │   │   └── chat.models.ts
│   │   │   │   └── conductor-chat.component.ts
│   │   │   └── conversation-list/
│   │   ├── services/
│   │   │   ├── agent.service.ts         # 🔥 Agent execution via SSE
│   │   │   ├── conversation.service.ts  # 🔥 Global conversations
│   │   │   ├── agent-execution.ts
│   │   │   └── message-handling.service.ts
│   │   └── living-screenplay-simple/
│   └── environments/
│       ├── environment.ts
│       ├── environment.development.ts
│       ├── environment.prod.ts
│       └── environment.docker.ts
└── package.json
```

---

## 2. Send Button Implementation

### 2.1 Location & Template
**File**: `/mnt/ramdisk/primoia-main/conductor-community/conductor/conductor-web/src/app/shared/conductor-chat/conductor-chat.component.ts`
**Line**: 357-366

```html
<!-- Send button -->
<button
  class="icon-button send-button"
  (click)="sendMessage()"
  [disabled]="chatState.isLoading || isEditorEmpty()"
  [title]="chatState.isLoading ? 'Enviando...' : 'Enviar mensagem'"
>
  <span *ngIf="!chatState.isLoading">⬆️</span>
  <span *ngIf="chatState.isLoading">⏳</span>
</button>
```

### 2.2 CSS Styling
**Lines**: 977-987

```css
.send-button {
  background: #ffffff;
  color: #667eea;
  border: 2px solid #667eea;
}

.send-button:hover:not(:disabled) {
  background: #f0f4ff;
  transform: scale(1.1);
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4);
}
```

### 2.3 Button Behavior
- **Icon**: Changes from ⬆️ (idle) to ⏳ (loading)
- **State**: Disabled when `chatState.isLoading` is true or editor is empty
- **Action**: Calls `sendMessage()` method on click or when user presses Enter

---

## 3. Current Chat Implementation

### 3.1 Chat Component (Main)
**File**: `conductor-chat.component.ts` (2000+ lines)

#### Key Features:
1. **Two Chat Models**:
   - **Conversation Model** (NEW): Global conversations shared between agents
   - **Legacy Model** (OLD): Per-agent chat histories

2. **Component Properties**:
   ```typescript
   chatState: ChatState = {
     messages: [],
     isConnected: false,
     isLoading: false
   };
   
   messageContent: string = '';
   selectedAgentName: string = '';
   selectedAgentEmoji: string = '🤖';
   activeConversationId: string | null = null;
   ```

3. **Core Methods**:
   - `sendMessage()` - Validates and sends message
   - `handleSendMessage(data)` - Routes to conversation or legacy model
   - `handleStreamEvent(event)` - Processes SSE events

#### Configuration:
```typescript
const DEFAULT_CONFIG: ConductorConfig = {
  api: {
    baseUrl: '',  // Empty - routes include /api/
    endpoint: '/execute',
    streamEndpoint: '/api/v1/stream-execute',
    apiKey: 'test-api-key-123',
    timeout: 600000,  // 10 minutes
    retryAttempts: 3
  },
  mode: 'ask',
  welcomeMessage: 'Olá! Sou o Conductor Chat...',
  autoScroll: true,
  maxMessages: 100
};
```

### 3.2 Input Component
**File**: `components/chat-input/chat-input.component.ts`

#### Features:
- **Rich Text Editor**: TipTap (ProseMirror-based)
- **Formatting Support**: Bold, italic, code, headers, lists, task lists
- **Extensions**: Syntax highlighting, code blocks, placeholders
- **Keyboard Shortcuts**:
  - `Enter` = Send message
  - `Shift+Enter` = New line
- **Paste Handling**: HTML to Markdown conversion via Turndown

#### Output Events:
```typescript
@Output() messageContentChanged = new EventEmitter<string>();
@Output() enterPressed = new EventEmitter<void>();
```

### 3.3 Messages Component
**File**: `components/chat-messages/chat-messages.component.ts`

#### Displays:
- User messages
- Bot messages (with Markdown rendering)
- System messages
- Progress messages (intermediate updates)
- Streaming messages (real-time chunks)
- Typing indicator

#### Features:
- Copy-to-clipboard button
- Message deletion (soft delete)
- Markdown content rendering with `marked` library
- Auto-scroll to latest message

---

## 4. API Integration Layer

### 4.1 Conductor API Service
**File**: `services/conductor-api.service.ts` (133 lines)

#### Two-Phase SSE Streaming:

**Phase 1: Start Execution**
```typescript
POST /api/v1/stream-execute
Headers: {
  'Content-Type': 'application/json',
  'X-API-Key': apiKey
}
Body: {
  uid: Date.now().toString(),
  title: "Stream Message",
  textEntries: [{
    uid: "1",
    content: message
  }],
  targetType: "conductor",
  isTemplate: false,
  createdAt: Date.now(),
  updatedAt: Date.now()
}
Response: { job_id: "..." }
```

**Phase 2: Connect to Stream**
```typescript
EventSource: /api/v1/stream/{job_id}
Events:
  - onmessage: Stream data
  - end_of_stream: Stream completion
  - onerror: Connection error
```

#### Observable Pattern:
```typescript
sendMessage(message: string, config: ApiConfig): Observable<StreamEvent | ApiResponse>
```

### 4.2 Agent Service (Primary Execution)
**File**: `services/agent.service.ts` (600+ lines)

#### executeAgent Method:
```typescript
executeAgent(
  agentId: string,
  inputText: string,
  instanceId: string,
  cwd?: string,
  documentId?: string,
  aiProvider?: string,
  conversationId?: string
): Observable<ExecutionResult>
```

#### Implementation: SSE Streaming
```typescript
// Step 1: POST to /api/v1/stream-execute
const startUrl = `${this.baseUrl}/api/v1/stream-execute`;
const { job_id } = await startResponse.json();

// Step 2: Connect to EventSource
const eventSource = new EventSource(
  `${this.baseUrl}/api/v1/stream/${job_id}`
);

// Step 3: Listen to events
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  switch(data.event) {
    case 'task_started':
    case 'status_update':
    case 'result':
    case 'error':
      // Handle each event type
  }
};

eventSource.addEventListener('end_of_stream', () => {
  eventSource.close();
  observer.next(finalResult);
  observer.complete();
});
```

#### SSE Events Handled:
```
- task_started: Task initiated
- status_update: Progress messages
- result: Final result
- error: Execution error
- end_of_stream: Stream completion
```

### 4.3 Conversation Service
**File**: `services/conversation.service.ts` (211 lines)

#### API Endpoints:
```typescript
POST   /conversations/              // Create conversation
GET    /conversations/{id}          // Get conversation
GET    /conversations/              // List conversations
POST   /conversations/{id}/messages // Add message
GET    /conversations/{id}/messages // Get messages
PUT    /conversations/{id}/agent    // Set active agent
PUT    /conversations/{id}/context  // Update context
DELETE /conversations/{id}          // Delete conversation
```

#### Data Models:
```typescript
interface Conversation {
  conversation_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  active_agent?: AgentInfo;
  participants: AgentInfo[];
  messages: Message[];
  screenplay_id?: string;
  context?: string;  // Markdown field
}

interface Message {
  id: string;
  type: 'user' | 'bot';
  content: string;
  timestamp: string;
  agent?: AgentInfo;
}

interface AgentInfo {
  agent_id: string;
  instance_id: string;
  name: string;
  emoji?: string;
}
```

### 4.4 Agent Service (REST Endpoints)
**File**: `services/agent.service.ts`

#### Available Endpoints:
```typescript
GET /api/agents                     // Get all agents
GET /api/agents/instances           // Get agent instances
POST /api/agents/{id}/execute       // Execute agent (legacy sync)
POST /api/v1/stream-execute         // Execute with streaming
GET /api/v1/stream/{job_id}         // SSE stream
GET /health                         // Health check
```

---

## 5. Streaming & Real-Time Implementation

### 5.1 SSE (Server-Sent Events) Architecture

#### Two-Phase Flow:
1. **Initialization Phase**:
   - Client sends execution request to `/api/v1/stream-execute`
   - Backend returns `job_id`
   - Takes ~100-500ms typically

2. **Streaming Phase**:
   - Client opens EventSource to `/api/v1/stream/{job_id}`
   - Backend sends events in real-time
   - Client processes events and updates UI
   - Stream ends with `end_of_stream` event

#### Event Types:
```typescript
interface StreamEvent {
  event: string;      // 'task_started', 'status_update', 'result', 'error'
  data?: any;
}
```

### 5.2 Observable Subscription Pattern

```typescript
// In message-handling.service.ts
this.agentService.executeAgent(...).subscribe({
  next: (result) => {
    // Handle successful result
    callbacks.onStreamingUpdate(chunk, instanceId);
  },
  error: (error) => {
    // Handle error
    callbacks.onLoadingChange(false);
  }
});
```

### 5.3 Progress & Streaming Messages

**Progress Messages**:
- Intermediate status updates
- Displayed as italic/muted messages
- Cleared when final result arrives

**Streaming Messages**:
- Real-time token streaming from LLM
- Appended chunk-by-chunk
- Replaced with final message when complete

---

## 6. Message Handling Service

**File**: `services/message-handling.service.ts` (345 lines)

### Two Implementation Models:

#### Model 1: Conversation Model (NEW)
```typescript
sendMessageWithConversationModel(
  params: MessageParams,
  callbacks: MessageHandlingCallbacks
): Observable<MessageExecutionResult>
```

- Uses global conversation ID
- Saves messages to backend
- Multiple agents can participate
- Shared message history

#### Model 2: Legacy Model (OLD)
```typescript
sendMessageWithLegacyModel(
  params: MessageParams,
  currentMessages: Message[],
  chatHistories: Map<string, Message[]>,
  callbacks: MessageHandlingCallbacks
): Observable<MessageExecutionResult>
```

- Per-agent local history
- No backend persistence
- Isolated conversations
- Maintains backward compatibility

### Message Flow:
1. User enters message
2. `sendMessage()` validates input
3. `handleSendMessage()` creates user message
4. Routes to appropriate model (conversation or legacy)
5. `messageHandlingService` sends message
6. `agentService.executeAgent()` initiates SSE
7. Stream events update UI via callbacks
8. Response added to history

---

## 7. Chat Models & Interfaces

**File**: `models/chat.models.ts`

```typescript
interface Message {
  id: string;
  content: string;
  type: 'user' | 'bot' | 'system';
  timestamp: Date;
  isStreaming?: boolean;
  isDeleted?: boolean;
  _historyId?: string;  // MongoDB _id for deletion
  agent?: {
    agent_id: string;
    instance_id: string;
    name: string;
    emoji?: string;
  };
}

interface ChatState {
  messages: Message[];
  isConnected: boolean;
  isLoading: boolean;
  currentStreamingMessageId?: string;
}

interface ApiConfig {
  baseUrl: string;
  endpoint: string;
  streamEndpoint?: string;
  apiKey: string;
  timeout?: number;
  retryAttempts?: number;
}

type ChatMode = 'ask' | 'agent';

interface ConductorConfig {
  api: ApiConfig;
  mode: ChatMode;
  welcomeMessage: string;
  autoScroll: boolean;
  maxMessages: number;
}
```

---

## 8. Complete Message Send Flow

```
User Input
    ↓
chatInputComponent.enterPressed event (Enter key)
    ↓
sendMessage() [conductor-chat.component.ts]
    ├─ Validate: !empty && !loading
    ├─ Clear editor
    ↓
handleSendMessage(data)
    ├─ Check input blocked
    ├─ Create Message object
    ├─ Prepare MessageParams
    ├─ Check: useConversationModel?
    ↓
messageHandlingService.sendMessageWithConversationModel/Legacy()
    ├─ Create user message
    ├─ Save to backend (conversation model)
    ├─ Update UI: onMessagesUpdate()
    ├─ Call callbacks: onLoadingChange(true)
    ↓
agentService.executeAgent()
    ├─ Create ExecutionRequest
    ├─ POST to /api/v1/stream-execute
    ├─ Get job_id from response
    ↓
agentService.executeAgentViaSSE()
    ├─ Open EventSource(/api/v1/stream/{job_id})
    ├─ Listen to events:
    │   ├─ task_started
    │   ├─ status_update → callbacks.onProgressUpdate()
    │   ├─ result → save response
    │   └─ error → callbacks.onLoadingChange(false)
    ├─ end_of_stream → eventSource.close()
    ↓
UI Updates:
    ├─ chatState.messages updated
    ├─ progressMessage shown/hidden
    ├─ streamingMessage accumulated
    ├─ isLoading flag toggled
    ↓
Final Message Added to History
```

---

## 9. Stream Event Processing

### In conductor-chat.component.ts:

```typescript
private handleStreamEvent(event: any): void {
  // Final response
  if (event.success !== undefined) {
    // Add streaming message to history
    // Clear progress/streaming
    this.chatState.isLoading = false;
    return;
  }

  // Handle SSE events
  switch(event.event) {
    case 'job_started':
      this.addProgressMessage('🚀 Iniciando execução...');
      break;
      
    case 'status_update':
      this.addProgressMessage(event.data?.message);
      break;
      
    case 'on_llm_new_token':
      this.appendToStreamingMessage(event.data?.chunk);
      break;
      
    case 'result':
      // Final result received
      break;
      
    case 'error':
      this.handleError(event.data?.error);
      break;
  }
}
```

---

## 10. Architecture Decisions

### Design Patterns Used:
1. **Observable Pattern**: RxJS for async operations
2. **Service-Based Architecture**: Separation of concerns
3. **Two-Phase Streaming**: Init phase + stream phase
4. **Callback Pattern**: Parent-child communication
5. **State Management**: Centralized ChatState object

### Key Architectural Features:
- **Standalone Components**: No NgModule dependency
- **Empty baseUrl**: Routes include `/api/` explicitly
- **Timeout**: 10 minutes for long-running operations
- **Retry Logic**: Configurable retry attempts
- **Soft Deletes**: Messages marked as deleted, not removed
- **Conversation Isolation**: Per-agent or global based on feature flag

### Environment Configuration:
```typescript
// environment.ts
export const environment = {
  features: {
    useConversationModel: true,  // Toggle between models
  },
  apiUrl: '',  // Empty (routes have /api/)
};
```

---

## 11. Key File Paths & Locations

### Main Components:
- `/mnt/ramdisk/primoia-main/conductor-community/conductor/conductor-web/src/app/shared/conductor-chat/conductor-chat.component.ts` (2000+ lines)
- `/mnt/ramdisk/primoia-main/conductor-community/conductor/conductor-web/src/app/shared/conductor-chat/components/chat-input/chat-input.component.ts`
- `/mnt/ramdisk/primoia-main/conductor-community/conductor/conductor-web/src/app/shared/conductor-chat/components/chat-messages/chat-messages.component.ts`

### Services:
- `/mnt/ramdisk/primoia-main/conductor-community/conductor/conductor-web/src/app/shared/conductor-chat/services/conductor-api.service.ts`
- `/mnt/ramdisk/primoia-main/conductor-community/conductor/conductor-web/src/app/shared/conductor-chat/services/message-handling.service.ts` (345 lines)
- `/mnt/ramdisk/primoia-main/conductor-community/conductor/conductor-web/src/app/services/agent.service.ts` (600+ lines)
- `/mnt/ramdisk/primoia-main/conductor-community/conductor/conductor-web/src/app/services/conversation.service.ts` (211 lines)

### Models:
- `/mnt/ramdisk/primoia-main/conductor-community/conductor/conductor-web/src/app/shared/conductor-chat/models/chat.models.ts`

### Documentation:
- `/mnt/ramdisk/primoia-main/conductor-community/conductor/conductor-web/src/app/shared/conductor-chat/README.md`

---

## 12. Technology Details

### Rich Text Editor (TipTap):
- **Extensions**: StarterKit, CodeBlockLowlight, Placeholder, TaskList
- **Syntax Highlighting**: lowlight (common languages)
- **Markdown Support**: Full formatting via Turndown converter
- **Features**: Copy, paste, undo/redo, collaborative editing ready

### Real-Time Communication:
- **Protocol**: Server-Sent Events (EventSource API)
- **Fallback**: None specified (requires EventSource support)
- **Timeout**: 10 minutes per operation
- **Connection**: Auto-reconnect on error

### State Management:
- **Library**: RxJS
- **Pattern**: Observable with subscription
- **Cleanup**: Automatic unsubscribe on component destroy
- **Error Handling**: Centralized error callbacks

---

## 13. Feature Flags & Configuration

### Environment Features:
```typescript
interface EnvironmentFeatures {
  useConversationModel?: boolean;  // Toggle between conversation and legacy
}
```

### Chat Modes:
1. **Ask Mode (💬)**: Read-only queries, no screenplay modification
2. **Agent Mode (🤖)**: Can execute actions, modify screenplay

### Available AI Providers:
- Default (from config.yaml)
- Claude
- Gemini
- Cursor Agent

---

## 14. Summary & Key Insights

### Strengths:
1. **Modern Architecture**: Standalone Angular components with RxJS
2. **Real-Time Streaming**: Two-phase SSE for reliable streaming
3. **Flexible Models**: Conversation and legacy models for different use cases
4. **Rich Editor**: TipTap with full formatting support
5. **Modular Services**: Clear separation between API, message handling, and agent execution
6. **Error Handling**: Comprehensive error handling with callbacks
7. **Type Safety**: Full TypeScript interfaces

### Current Implementation Status:
- Send button: Located at line 357-366
- CSS: Lines 977-987
- Click Handler: Calls `sendMessage()` method
- States: Disabled during loading or when editor empty
- Icons: ⬆️ (send) / ⏳ (loading)

### Integration Points:
1. **Chat Input** → Send Message
2. **Send Message** → Message Handling Service
3. **Message Service** → Agent Service
4. **Agent Service** → SSE Streaming
5. **SSE Events** → UI Updates
6. **Final Result** → Message History

---

## 15. API Endpoints Summary

### Agent Execution:
```
POST /api/v1/stream-execute     - Start execution, get job_id
GET  /api/v1/stream/{job_id}    - SSE stream
GET  /health                     - Health check
```

### Conversation Management:
```
POST   /conversations/                    - Create
GET    /conversations/{id}                - Get one
GET    /conversations/                    - List all
POST   /conversations/{id}/messages       - Add message
GET    /conversations/{id}/messages       - Get messages
PUT    /conversations/{id}/agent          - Set active agent
PUT    /conversations/{id}/context        - Update context
DELETE /conversations/{id}                - Delete
```

### Agent Management:
```
GET    /api/agents                        - List agents
GET    /api/agents/instances              - Get instances
```

---

This comprehensive report provides a complete understanding of the conductor-web chat implementation, from the UI layer (send button) through the streaming infrastructure to the backend integration.
