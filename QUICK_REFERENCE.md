# Conductor Web - Quick Reference Guide

## Send Button Quick Facts

| Property | Value |
|----------|-------|
| **Location** | `/src/app/shared/conductor-chat/conductor-chat.component.ts` |
| **Lines** | 357-366 (HTML), 977-987 (CSS) |
| **CSS Classes** | `.icon-button .send-button` |
| **Handler** | `(click)="sendMessage()"` |
| **Icons** | ⬆️ (idle), ⏳ (loading) |
| **Disabled When** | `chatState.isLoading \|\| isEditorEmpty()` |
| **Color** | Purple (#667eea) |

---

## File Quick Links

### Main Components
```
chat-input/
  └── chat-input.component.ts          # Rich text editor (TipTap)

chat-messages/
  └── chat-messages.component.ts       # Message display & markdown rendering

conductor-chat.component.ts            # Main component (2000+ lines)
```

### Services (Execution Flow)
```
services/
├── conductor-api.service.ts           # SSE initialization
├── message-handling.service.ts        # Route to conversation/legacy model
└── modal-state.service.ts

app/services/
├── agent.service.ts                   # Execute via SSE streaming
├── conversation.service.ts            # Backend conversation API
└── agent-execution.ts
```

### Models
```
models/chat.models.ts                  # All TypeScript interfaces
```

---

## API Endpoints (from gateway)

### Execute Agent
```
POST /api/v1/stream-execute
  ↓ Get job_id
GET /api/v1/stream/{job_id}           # SSE stream
```

### Conversations
```
POST   /conversations/
GET    /conversations/{id}
POST   /conversations/{id}/messages
PUT    /conversations/{id}/agent
```

---

## Message Send Flow (One-Page Summary)

```typescript
// 1. User clicks send button or presses Enter
sendMessage()
  ↓
// 2. Validate & prepare message
handleSendMessage(data)
  ↓
// 3. Route to model (conversation or legacy)
messageHandlingService.sendMessageWithConversationModel()
  ↓
// 4. Execute agent with streaming
agentService.executeAgent()
  ↓
// 5. Two-phase streaming:
//    Phase 1: POST /api/v1/stream-execute → job_id
//    Phase 2: EventSource /api/v1/stream/{job_id}
  ↓
// 6. Process SSE events and update UI
eventSource.onmessage
  ↓
// 7. Final message added to history
```

---

## Key TypeScript Interfaces

### ChatState
```typescript
{
  messages: Message[];
  isConnected: boolean;
  isLoading: boolean;
  currentStreamingMessageId?: string;
}
```

### Message
```typescript
{
  id: string;
  content: string;
  type: 'user' | 'bot' | 'system';
  timestamp: Date;
  isStreaming?: boolean;
  isDeleted?: boolean;
  agent?: { agent_id, instance_id, name, emoji };
}
```

### ApiConfig
```typescript
{
  baseUrl: '';                          // Empty (routes have /api/)
  endpoint: '/execute';
  streamEndpoint: '/api/v1/stream-execute';
  apiKey: string;
  timeout: 600000;                      // 10 minutes
  retryAttempts: 3;
}
```

---

## Component Hierarchy

```
app-conductor-chat (main)
├── conversation-sidebar (if useConversationModel)
├── chat-header
│   └── agent-name & status-indicator
├── agent-launcher-dock (left side)
│   ├── add-agent-btn
│   ├── delete-agent-btn
│   ├── settings-btn
│   └── agent-list (draggable)
├── chat-body-content
│   └── app-chat-messages
│       ├── message (user)
│       ├── message (bot with markdown)
│       ├── progress-message
│       ├── streaming-message
│       └── typing-indicator
├── resize-handle
├── chat-input-area
│   └── app-chat-input
│       └── TipTap editor
└── chat-footer
    ├── provider-select
    ├── send-button (⬆️)
    ├── mic-button (🎤)
    └── mode-toggle (💬/🤖)
```

---

## CSS Classes

### Button Styling
```css
.icon-button              /* 36px circle, 16px emoji */
.send-button             /* Purple border, white bg */
.send-button:hover       /* Light blue bg, scale 1.1 */
.send-button:disabled    /* Opacity 0.5 */
```

### Editor
```css
.tiptap-editor-container /* Full height, scrollable */
.ProseMirror             /* Editor content area */
.ProseMirror:focus       /* Blue border, white bg */
```

---

## Feature Flags

### Environment
```typescript
useConversationModel: true  // Toggle between conversation and legacy models
```

### Chat Modes
- **Ask (💬)**: Read-only, no screenplay modification
- **Agent (🤖)**: Can execute actions, modify screenplay

### AI Providers
- Default (from config.yaml)
- Claude
- Gemini
- Cursor Agent

---

## SSE Event Types

```typescript
'task_started'          // Agent started
'status_update'         // Progress message
'on_llm_new_token'      // Token streaming
'on_tool_start'         // Tool execution started
'on_tool_end'           // Tool execution completed
'result'                // Final result
'error'                 // Execution error
'end_of_stream'         // Stream complete
```

---

## Configuration Locations

### Component Configuration
```
conductor-chat.component.ts, line 23-36:
DEFAULT_CONFIG
```

### Environment Configuration
```
src/environments/environment.ts
src/environments/environment.development.ts
src/environments/environment.prod.ts
src/environments/environment.docker.ts
```

---

## Common Tasks

### Add a New Button
1. Add to chat-footer section in template
2. Add click handler method to component
3. Add CSS styling (.icon-button class)

### Change Send Button Icon
Edit line 364-365 in conductor-chat.component.ts:
```html
<span *ngIf="!chatState.isLoading">⬆️</span>  <!-- Change emoji here -->
<span *ngIf="chatState.isLoading">⏳</span>
```

### Add New Message Type
1. Extend `type` in Message interface (chat.models.ts)
2. Add display logic in chat-messages.component.ts
3. Add CSS styling

### Connect New API Endpoint
1. Add method to agent.service.ts or conversation.service.ts
2. Use RxJS Observable pattern
3. Handle errors and subscribe from component

---

## Debug Tips

### Enable Logging
Console logs are prefixed:
- `[ConductorApiService]` - API calls
- `[SSE]` - Streaming events
- `[MESSAGE-SERVICE]` - Message handling
- `[AGENT SERVICE]` - Agent execution

### Check State
```typescript
// In browser console:
// Component state is accessible via Angular DevTools
```

### Network Tab
Monitor these endpoints:
- POST `/api/v1/stream-execute`
- GET `/api/v1/stream/{job_id}` (EventSource)
- POST `/conversations/{id}/messages`

---

## Technologies Used

| Technology | Purpose |
|-----------|---------|
| **Angular 20+** | Framework |
| **Vite** | Build tool |
| **RxJS** | Async operations |
| **TipTap** | Rich text editing |
| **EventSource** | SSE streaming |
| **marked** | Markdown rendering |
| **Turndown** | HTML to Markdown |
| **HttpClient** | REST API calls |

---

## Module Structure

All components are **standalone** (no NgModule):
```typescript
@Component({
  selector: 'app-conductor-chat',
  standalone: true,
  imports: [...]
})
```

---

## Development Notes

1. **baseUrl is intentionally empty** - Routes include `/api/` explicitly
2. **10-minute timeout** - For long-running AI operations
3. **Soft deletes** - Messages marked deleted, not removed
4. **Two chat models** - Conversation (new) vs Legacy (old)
5. **EventSource** - Requires modern browser support
6. **TipTap editor** - Rich formatting, collaborative ready

---

## Resources

- Main README: `/src/app/shared/conductor-chat/README.md`
- Full Report: `/CHAT_IMPLEMENTATION_REPORT.md`
- Component: `/src/app/shared/conductor-chat/conductor-chat.component.ts`
- Services: `/src/app/services/`
