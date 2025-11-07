# Conductor Web - Architecture Diagrams

## 1. Send Button Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     User Interaction Layer                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Chat Input              Send Button              Mic Button     │
│  ┌──────────────┐       ┌──────────┐            ┌───────────┐   │
│  │ TipTap Editor│       │ ⬆️ / ⏳  │            │ 🎤 / 🔴  │   │
│  │ Rich Text    │──────→│ (click)  │            │ Recording │   │
│  │ Enter = Send │       │ (Enter)  │            │           │   │
│  └──────────────┘       └────┬─────┘            └───────────┘   │
│                               │                                   │
│                    sendMessage() triggered                        │
│                               ↓                                   │
└───────────────────────────────┼───────────────────────────────────┘
                                │
┌───────────────────────────────┼───────────────────────────────────┐
│             Validation Layer (conductor-chat.component)          │
├───────────────────────────────┼───────────────────────────────────┤
│                               ↓                                   │
│  ┌──────────────────────────────────────┐                        │
│  │ sendMessage()                        │                        │
│  │ ├─ Check !messageContent.trim()      │                        │
│  │ ├─ Check !chatState.isLoading        │                        │
│  │ └─ Proceed: handleSendMessage()      │                        │
│  └────────┬─────────────────────────────┘                        │
│           │                                                       │
└───────────┼───────────────────────────────────────────────────────┘
            │
┌───────────┼───────────────────────────────────────────────────────┐
│        Message Preparation Layer (handleSendMessage)             │
├───────────┼───────────────────────────────────────────────────────┤
│           ↓                                                       │
│  ┌──────────────────────────────────────┐                        │
│  │ 1. Create Message object             │                        │
│  │    id: Date.now().toString()         │                        │
│  │    content: user input               │                        │
│  │    type: 'user'                      │                        │
│  │                                      │                        │
│  │ 2. Create MessageParams              │                        │
│  │    message, provider, agentId        │                        │
│  │    conversationId, cwd, etc          │                        │
│  │                                      │                        │
│  │ 3. Create Callbacks                  │                        │
│  │    onProgressUpdate                  │                        │
│  │    onStreamingUpdate                 │                        │
│  │    onLoadingChange                   │                        │
│  │    onMessagesUpdate                  │                        │
│  └────────┬─────────────────────────────┘                        │
│           │                                                       │
└───────────┼───────────────────────────────────────────────────────┘
            │
            ↓
    ┌───────────────────┐
    │ useConversationModel?
    │ (feature flag)
    └────┬──────────────┘
         │
    ┌────┴─────────────────────┐
    │                           │
    ↓                           ↓
 [YES]                        [NO]
    │                           │
    ↓                           ↓
Conversation           Legacy Model
Model Service          Service
    │                           │
```

## 2. Message Flow (Complete Stack)

```
┌────────────────────────────────────────────────────────────────────────┐
│ FRONTEND (Angular Component Layer)                                      │
├────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  messageHandlingService.sendMessageWithConversationModel()             │
│  ├─ Save user message via conversationService.addMessage()            │
│  ├─ Call agentService.executeAgent()                                   │
│  └─ Return Observable<MessageExecutionResult>                          │
│                                                                          │
└────┬───────────────────────────────────────────────────────────────────┘
     │
     ↓
┌────────────────────────────────────────────────────────────────────────┐
│ SERVICE LAYER (API Communication)                                      │
├────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  agentService.executeAgent()                                           │
│  ├─ Create ExecutionRequest object                                     │
│  └─ Call executeAgentViaSSE()                                          │
│                                                                          │
│  executeAgentViaSSE() - TWO PHASE STREAMING:                           │
│  ├─ PHASE 1: POST /api/v1/stream-execute                              │
│  │   Request: {                                                        │
│  │     agent_id,                                                       │
│  │     instance_id,                                                    │
│  │     conversation_id,                                                │
│  │     screenplay_id,                                                  │
│  │     cwd,                                                            │
│  │     ai_provider,                                                    │
│  │     textEntries: [{ uid, content }]                                │
│  │   }                                                                 │
│  │   Response: { job_id: "xyz" }                                      │
│  │                                                                      │
│  ├─ PHASE 2: EventSource /api/v1/stream/{job_id}                      │
│  │   onmessage: Handle stream events                                  │
│  │   end_of_stream: Close and complete                                │
│  │   onerror: Handle connection errors                                │
│  │                                                                      │
│  └─ Return Observable<ExecutionResult>                                │
│                                                                          │
└────┬───────────────────────────────────────────────────────────────────┘
     │
     ↓ HTTP/SSE
┌────────────────────────────────────────────────────────────────────────┐
│ BACKEND GATEWAY (Conductor Gateway)                                    │
├────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  POST /api/v1/stream-execute                                          │
│  ├─ 1. Create execution job                                            │
│  ├─ 2. Generate job_id                                                 │
│  └─ 3. Return job_id to client                                         │
│                                                                          │
│  Background: Start agent execution                                      │
│  ├─ Load agent configuration                                           │
│  ├─ Prepare context                                                    │
│  └─ Execute via AI provider                                            │
│                                                                          │
│  GET /api/v1/stream/{job_id}                                          │
│  └─ SSE Stream: Send events as execution progresses                   │
│     ├─ task_started                                                    │
│     ├─ status_update (progress messages)                              │
│     ├─ on_llm_new_token (token streaming)                             │
│     ├─ on_tool_start / on_tool_end                                    │
│     ├─ result (final response)                                         │
│     ├─ error (if execution fails)                                      │
│     └─ end_of_stream (completion)                                      │
│                                                                          │
└────┬───────────────────────────────────────────────────────────────────┘
     │ SSE Events
     ↓
┌────────────────────────────────────────────────────────────────────────┐
│ FRONTEND (Event Processing Layer)                                      │
├────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  eventSource.onmessage                                                 │
│  └─ Process each event:                                                │
│     ├─ task_started → addProgressMessage()                            │
│     ├─ status_update → addProgressMessage(msg)                        │
│     ├─ on_llm_new_token → appendToStreamingMessage(chunk)             │
│     ├─ result → finalize message                                       │
│     └─ error → handleError()                                           │
│                                                                          │
│  UI Update Callbacks (from message-handling.service):                 │
│  ├─ onProgressUpdate(message, instanceId)                             │
│  │  └─ Update progressMessage display                                 │
│  ├─ onStreamingUpdate(chunk, instanceId)                              │
│  │  └─ Append to streamingMessage                                     │
│  ├─ onLoadingChange(isLoading)                                        │
│  │  └─ Update chatState.isLoading                                     │
│  └─ onMessagesUpdate(messages[])                                      │
│     └─ Update chatState.messages                                      │
│                                                                          │
└────┬───────────────────────────────────────────────────────────────────┘
     │
     ↓
┌────────────────────────────────────────────────────────────────────────┐
│ UI RENDERING LAYER (Angular Components)                               │
├────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  chat-messages.component.ts                                            │
│  ├─ Display user message (already in chatState.messages)              │
│  ├─ Display progress message (if progressMessage exists)              │
│  ├─ Display streaming message (if streamingMessage exists)            │
│  ├─ Display final message (when end_of_stream)                        │
│  ├─ Auto-scroll to bottom                                              │
│  └─ Render markdown with 'marked' library                             │
│                                                                          │
│  conductor-chat.component.ts                                           │
│  ├─ Update send button: ⬆️ → ⏳ (loading)                            │
│  ├─ Clear input editor after message sent                             │
│  ├─ Clear progress/streaming messages when done                       │
│  └─ Enable send button when message complete                          │
│                                                                          │
└────────────────────────────────────────────────────────────────────────┘
```

## 3. Component Tree

```
app-conductor-chat (root component, 2000+ lines)
│
├─ [Sidebar] conversation-list (optional, feature flag)
│  ├─ conversation items
│  └─ create new conversation
│
├─ chat-header
│  ├─ selected-agent info
│  └─ status-indicator
│
├─ agent-launcher-dock
│  ├─ add-agent button
│  ├─ delete-agent button
│  ├─ settings button
│  └─ agent-list (CDK drag-drop)
│     ├─ dock-item (agent button)
│     └─ drag preview
│
├─ chat-body-content
│  └─ app-chat-messages (scrollable)
│     ├─ message (user)
│     ├─ message (bot with markdown)
│     │  ├─ copy button
│     │  └─ delete button
│     ├─ progress-message (italic)
│     ├─ streaming-message (real-time)
│     └─ typing-indicator (3 dots)
│
├─ resize-handle (draggable splitter)
│
├─ chat-input-area
│  └─ app-chat-input
│     └─ TipTap Editor (ProseMirror)
│        ├─ Placeholder text
│        ├─ Syntax highlighting
│        ├─ Formatting toolbar
│        └─ Keyboard shortcuts
│
└─ chat-footer (60px fixed)
   ├─ provider-select dropdown
   ├─ send-button (⬆️)
   ├─ mic-button (🎤)
   └─ mode-toggle (💬/🤖)
```

## 4. Data Flow Diagram

```
User Types Message
    ↓
┌─────────────────────────────────┐
│ chatInputComponent              │
│ ├─ TipTap Editor                │
│ └─ onUpdate event               │
└────────┬────────────────────────┘
         │ messageContentChanged event
         ↓
┌─────────────────────────────────┐
│ conductor-chat.component        │
│ ├─ messageContent = "..."       │
│ └─ isEditorEmpty() = false      │
└────────┬────────────────────────┘
         │ User clicks send or Enter
         ↓
┌─────────────────────────────────┐
│ sendMessage()                   │
│ ├─ Validate                     │
│ ├─ Clear editor                 │
│ └─ Call handleSendMessage()     │
└────────┬────────────────────────┘
         │
         ↓
┌─────────────────────────────────┐
│ handleSendMessage()             │
│ ├─ Create Message object        │
│ ├─ Create MessageParams         │
│ ├─ Check feature flag           │
│ └─ Route to service             │
└────────┬────────────────────────┘
         │
    ┌────┴──────────────┐
    ↓                   ↓
[CONVERSATION]      [LEGACY]
    │                   │
    ↓                   ↓
messageHandlingService.sendMessageWith...()
    │
    ├─ Create user message
    ├─ Save to backend (conversation model)
    ├─ Call callbacks.onMessagesUpdate()
    └─ Call agentService.executeAgent()
         │
         ├─ Create ExecutionRequest
         └─ Call executeAgentViaSSE()
              │
              ├─ Phase 1: POST /stream-execute
              │  └─ Get job_id
              │
              └─ Phase 2: EventSource /stream/{job_id}
                 ├─ onmessage
                 │  ├─ Parse event
                 │  ├─ Call appropriate callback
                 │  │  ├─ onProgressUpdate()
                 │  │  ├─ onStreamingUpdate()
                 │  │  ├─ onLoadingChange()
                 │  │  └─ onMessagesUpdate()
                 │  └─ Emit via observer
                 │
                 └─ end_of_stream
                    ├─ Close EventSource
                    └─ Complete Observable
```

## 5. Service Dependencies

```
┌──────────────────────────────────────────────────┐
│         conductor-chat.component.ts              │
│                                                  │
│  Injects:                                        │
│  ├─ MessageHandlingService                      │
│  ├─ AgentService                                │
│  ├─ ConversationService                         │
│  ├─ SpeechRecognitionService                    │
│  ├─ ModalStateService                           │
│  ├─ ScreenplayService                           │
│  └─ PersonaEditService                          │
└────────┬───────────────────────────────────────┘
         │
         ├─ MessageHandlingService (345 lines)
         │  ├─ Injects:
         │  │  ├─ ConversationService
         │  │  ├─ AgentService
         │  │  └─ AgentExecutionService
         │  │
         │  └─ Methods:
         │     ├─ sendMessageWithConversationModel()
         │     └─ sendMessageWithLegacyModel()
         │
         ├─ AgentService (600+ lines)
         │  ├─ Methods:
         │  │  ├─ getAgents()
         │  │  ├─ getAgentInstances()
         │  │  ├─ executeAgent()
         │  │  └─ executeAgentViaSSE()
         │  │
         │  └─ Uses:
         │     ├─ EventSource API
         │     └─ fetch() for HTTP
         │
         ├─ ConversationService (211 lines)
         │  ├─ Uses:
         │  │  └─ HttpClient
         │  │
         │  └─ Methods:
         │     ├─ createConversation()
         │     ├─ getConversation()
         │     ├─ listConversations()
         │     ├─ addMessage()
         │     └─ setActiveAgent()
         │
         └─ Other Services
            ├─ ConductorApiService (133 lines)
            │  └─ sendMessage() [deprecated]
            │
            ├─ ScreenplayService
            ├─ PersonaEditService
            └─ SpeechRecognitionService
```

## 6. State Management Flow

```
┌──────────────────────────────────────┐
│    chatState: ChatState              │
│                                      │
│  messages: Message[]                 │
│  isConnected: boolean                │
│  isLoading: boolean                  │
│  currentStreamingMessageId?: string  │
└────┬─────────────────────────────────┘
     │
     ├─ Updated by:
     │  ├─ onMessagesUpdate() callback
     │  │  └─ Add user/bot message
     │  │
     │  ├─ appendToStreamingMessage()
     │  │  └─ Append chunk to streaming
     │  │
     │  ├─ onLoadingChange() callback
     │  │  └─ Set isLoading = true/false
     │  │
     │  └─ Check connection
     │     └─ Set isConnected = true/false
     │
     └─ Used by Template:
        ├─ *ngIf="chatState.isLoading"
        │  └─ Show loading spinner
        │
        ├─ [disabled]="chatState.isLoading"
        │  └─ Disable send button
        │
        ├─ *ngFor="let message of chatState.messages"
        │  └─ Render all messages
        │
        └─ [messages]="chatState.messages"
           └─ Pass to chat-messages component
```

## 7. SSE Event Processing Timeline

```
TIME    CLIENT                          SERVER/NETWORK
────────────────────────────────────────────────────────

T0      POST /api/v1/stream-execute
        └─ Send execution request       ├─ Receive
                                        ├─ Create job
                                        └─ Return job_id
        ←─── job_id response ───────────┘

T1      Open EventSource
        /api/v1/stream/{job_id}         ├─ Accept connection
                                        └─ Start execution

T2      Process onmessage               ├─ Execute task
        ├─ task_started            ←────┤ Send task_started
        └─ addProgressMessage()         │

T3      Process onmessage               ├─ Task progressing
        ├─ status_update           ←────┤ Send status_update
        └─ addProgressMessage()         │

T4      Process onmessage               ├─ Calling LLM
        ├─ on_llm_new_token        ←────┤ Send tokens (stream)
        ├─ appendToStreamingMessage()   │
        ├─ appendToStreamingMessage()   │
        └─ ...repeat...                 │

T5      Process onmessage               ├─ Task complete
        ├─ result               ←────────┤ Send result event
        └─ Store final message          │

T6      Process end_of_stream            ├─ Send end_of_stream
        ├─ eventSource.close()    ←─────┤
        ├─ observer.complete()          │
        └─ chatState.isLoading = false  │

T7      UI Updates
        ├─ Final message displayed
        ├─ Send button enabled
        └─ Ready for new message
```

## 8. Model Comparison: Conversation vs Legacy

```
FEATURE              | CONVERSATION MODEL  | LEGACY MODEL
─────────────────────┼─────────────────────┼──────────────────
Global Conversations | YES                 | NO
Backend Storage      | YES                 | NO (in-memory)
Multi-Agent Support  | YES                 | NO (single agent)
Shared History       | YES                 | NO (isolated)
Persistence          | Permanent           | Session only
Message ID Format    | UUID                | timestamp
Agent Context        | Shared              | Per-agent
Add Message Flow     | Backend + UI        | UI only
Feature Flag         | useConversationModel| fallback
Service             | ConversationService | Local Map
Default             | environment.ts      | -
```

---

These diagrams provide visual representations of the conductor-web chat architecture, data flow, and component interactions.
