# Plano de Melhorias: "Notícias dos Agentes"

## Resumo Executivo

Este documento apresenta um plano de melhorias para o sistema de "Notícias dos Agentes", transformando-o em um centro de observabilidade rico e navegável para acompanhar a execução de agentes em tempo real.

---

## 1. Diagnóstico do Sistema Atual

### 1.1 Arquitetura Atual

```
┌─────────────────────────────────────────────────────────────────┐
│                        FLUXO ATUAL                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Frontend ──────► Gateway ──────► Conductor ──────► MongoDB     │
│     │                                                   │        │
│     │                                                   ▼        │
│     │                                              tasks         │
│     │                                        (status: pending)   │
│     │                                                   │        │
│     │                                                   ▼        │
│     │                                              Watcher       │
│     │                                        (pega task, executa)│
│     │                                                   │        │
│     │                                                   ▼        │
│     │                                              tasks         │
│     │                                    (status: completed/error)│
│     │                                                            │
│     │◄──── WebSocket (porta 5006) ───── Apenas Conselheiros     │
│     │                                                            │
│     └──── SSE (por execução) ─────────── Apenas quem iniciou    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Problemas Identificados

| # | Problema | Impacto | Severidade |
|---|----------|---------|------------|
| 1 | **Watcher não emite eventos WebSocket** | Só quem iniciou a task (via SSE) vê o status | 🔴 Alto |
| 2 | **Eventos WebSocket só para Conselheiros** | Tasks normais não aparecem em tempo real | 🔴 Alto |
| 3 | **Sem cores distintas por status** | Difícil identificar visualmente o estado | 🟡 Médio |
| 4 | **Sem animação de "rodando"** | Usuário não sabe se algo está acontecendo | 🟡 Médio |
| 5 | **Clique não navega** | Perda de contexto, precisa buscar manualmente | 🔴 Alto |
| 6 | **Metadados insuficientes** | Eventos não têm screenplay_id, conversation_id | 🔴 Alto |
| 7 | **Histórico perde contexto após reload** | Eventos históricos não têm info de navegação | 🟡 Médio |

### 1.3 Estrutura da Task no MongoDB

```javascript
{
  "_id": ObjectId("..."),
  "task_id": "string",
  "agent_id": "Hunter_Agent",
  "instance_id": "instance-1764176308398-2xorzud10",
  "conversation_id": "cc8fa974-91c6-4119-9544-485710a67915",  // ✅ TEM
  "screenplay_id": "6927213d26cf31ec9983cfcb",                 // ✅ TEM
  "status": "pending" | "processing" | "completed" | "error",
  "prompt": "...",
  "result": "...",
  "exit_code": 0,
  "duration": 12.5,
  "created_at": ISODate("..."),
  "started_at": ISODate("..."),    // Quando watcher pegou
  "completed_at": ISODate("...")
}
```

**Insight:** Os metadados de navegação JÁ EXISTEM na task! O problema é que não estão sendo usados.

---

## 2. Plano de Melhorias

### Fase 1: Backend - Eventos em Tempo Real (Prioridade Alta)

#### 1.1 Watcher emitir eventos via HTTP → Gateway → WebSocket

O watcher roda fora do container e não tem acesso direto ao WebSocket. Solução: chamar endpoint HTTP do Gateway.

**Novo endpoint no Gateway:**

```python
# conductor-gateway/src/api/app.py

@app.post("/api/internal/task-event")
async def receive_task_event(event: dict):
    """
    Endpoint interno para o watcher emitir eventos de task.
    Repassa para WebSocket para broadcast.
    """
    event_type = event.get("type")  # task_started, task_completed, task_error
    data = event.get("data", {})

    # Broadcast via WebSocket
    await gamification_manager.broadcast(event_type, data)

    return {"success": True}
```

**Watcher emitindo eventos:**

```python
# claude_mongo_watcher.py - Adicionar nos pontos críticos

def emit_task_event(self, event_type: str, task_data: dict):
    """Emite evento para o Gateway via HTTP"""
    try:
        payload = {
            "type": event_type,
            "data": {
                "task_id": str(task_data.get("_id")),
                "agent_id": task_data.get("agent_id"),
                "agent_name": task_data.get("agent_name", task_data.get("agent_id")),
                "agent_emoji": task_data.get("emoji", "🤖"),
                "instance_id": task_data.get("instance_id"),
                "conversation_id": task_data.get("conversation_id"),
                "screenplay_id": task_data.get("screenplay_id"),
                "status": task_data.get("status"),
                "duration_ms": task_data.get("duration", 0) * 1000,
                "exit_code": task_data.get("exit_code"),
                "result_summary": (task_data.get("result", "")[:200] + "...")
                                  if len(task_data.get("result", "")) > 200
                                  else task_data.get("result", ""),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        }
        requests.post(f"{self.gateway_url}/api/internal/task-event", json=payload, timeout=5)
    except Exception as e:
        logger.warning(f"⚠️ Falha ao emitir evento: {e}")
```

**Pontos de emissão:**

| Momento | Tipo de Evento | Status |
|---------|----------------|--------|
| Watcher pega task | `task_started` | processing |
| Watcher completa task | `task_completed` | completed |
| Watcher falha task | `task_error` | error |

#### 1.2 Tipos de Eventos Padronizados

```typescript
// Frontend - types
interface TaskEvent {
  type: 'task_started' | 'task_completed' | 'task_error';
  data: {
    task_id: string;
    agent_id: string;
    agent_name: string;
    agent_emoji: string;
    instance_id: string;
    conversation_id: string;
    screenplay_id: string;
    status: 'pending' | 'processing' | 'completed' | 'error';
    duration_ms?: number;
    exit_code?: number;
    result_summary?: string;
    timestamp: string;
  };
}
```

---

### Fase 2: Frontend - UI Rica (Prioridade Alta)

#### 2.1 Sistema de Cores por Status

```css
/* event-ticker.component.ts - Cores */

.news-article {
  --status-pending: #f59e0b;     /* Amarelo - Aguardando */
  --status-running: #3b82f6;     /* Azul - Executando */
  --status-completed: #10b981;   /* Verde - Sucesso */
  --status-error: #ef4444;       /* Vermelho - Erro */
}

.news-article.status-pending {
  border-left-color: var(--status-pending);
  background: linear-gradient(90deg, #fef3c7 0%, transparent 20%);
}

.news-article.status-running {
  border-left-color: var(--status-running);
  background: linear-gradient(90deg, #dbeafe 0%, transparent 20%);
  animation: pulse-border 2s infinite;
}

.news-article.status-completed {
  border-left-color: var(--status-completed);
}

.news-article.status-error {
  border-left-color: var(--status-error);
  background: linear-gradient(90deg, #fee2e2 0%, transparent 20%);
}

@keyframes pulse-border {
  0%, 100% { border-left-width: 3px; }
  50% { border-left-width: 5px; }
}
```

#### 2.2 Indicador de "Rodando" com Animação

```html
<!-- event-ticker.component.ts - Template -->

<div class="article-header">
  <span class="agent-icon" [class.running]="ev.status === 'processing'">
    {{ ev.agentEmoji || '🤖' }}
    <span class="running-indicator" *ngIf="ev.status === 'processing'">
      <span class="dot"></span>
      <span class="dot"></span>
      <span class="dot"></span>
    </span>
  </span>
  <!-- ... -->
</div>
```

```css
.running-indicator {
  position: absolute;
  bottom: -4px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 2px;
}

.running-indicator .dot {
  width: 4px;
  height: 4px;
  background: #3b82f6;
  border-radius: 50%;
  animation: bounce 1.4s infinite ease-in-out;
}

.running-indicator .dot:nth-child(1) { animation-delay: -0.32s; }
.running-indicator .dot:nth-child(2) { animation-delay: -0.16s; }

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}
```

#### 2.3 Badge de Status no Título

```html
<div class="article-title">
  <span class="status-badge" [class]="'status-' + ev.status">
    {{ getStatusLabel(ev.status) }}
  </span>
  {{ ev.title }}
</div>
```

```typescript
getStatusLabel(status: string): string {
  const labels = {
    'pending': '⏳ Aguardando',
    'processing': '🔄 Executando',
    'completed': '✅ Concluído',
    'error': '❌ Erro'
  };
  return labels[status] || status;
}
```

---

### Fase 3: Navegação Contextual (Prioridade Alta)

#### 3.1 Clique para Navegar

Quando o usuário clicar em um evento, deve:
1. Carregar o screenplay correspondente
2. Selecionar a conversa correspondente
3. Destacar o agente correspondente

**Evento de clique:**

```typescript
// event-ticker.component.ts

onSelect(ev: GamificationEvent): void {
  // Emitir evento com metadados de navegação
  this.select.emit({
    ...ev,
    navigation: {
      screenplayId: ev.meta?.screenplay_id,
      conversationId: ev.meta?.conversation_id,
      agentId: ev.meta?.agent_id,
      instanceId: ev.meta?.instance_id
    }
  });
}
```

**Handler no screenplay-interactive.ts:**

```typescript
async onTickerSelect(ev: GamificationEvent): Promise<void> {
  const nav = ev.navigation;
  if (!nav) return;

  // 1. Carregar screenplay se diferente do atual
  if (nav.screenplayId && nav.screenplayId !== this.currentScreenplay?.id) {
    await this.loadScreenplayById(nav.screenplayId);
  }

  // 2. Selecionar conversa
  if (nav.conversationId && this.conductorChat) {
    this.conductorChat.selectConversation(nav.conversationId);
  }

  // 3. Destacar agente no dock
  if (nav.instanceId) {
    this.highlightAgentInDock(nav.instanceId);
  }

  // 4. Mostrar toast de confirmação
  this.showNotification(`Navegando para ${ev.agentName || 'agente'}`);
}
```

#### 3.2 Indicador Visual de Clicável

```css
.news-article {
  cursor: pointer;
  transition: all 0.2s ease;
}

.news-article:hover {
  background: #f3f4f6;
  transform: translateX(4px);
}

.news-article::after {
  content: '→';
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  opacity: 0;
  transition: opacity 0.2s;
  color: #6b7280;
}

.news-article:hover::after {
  opacity: 1;
}
```

---

### Fase 4: Melhorias Adicionais (Prioridade Média)

#### 4.1 Agrupamento por Agente

```html
<div class="agent-group" *ngFor="let group of groupedEvents">
  <div class="group-header">
    <span class="group-emoji">{{ group.emoji }}</span>
    <span class="group-name">{{ group.agentName }}</span>
    <span class="group-count">{{ group.events.length }}</span>
  </div>
  <div class="group-events">
    <div class="news-article" *ngFor="let ev of group.events">
      <!-- evento -->
    </div>
  </div>
</div>
```

#### 4.2 Filtro por Agente

```html
<div class="filter-bar">
  <!-- Filtros existentes -->
  <button ...>Todos</button>
  <button ...>Resultados</button>
  <button ...>Debug</button>

  <!-- Novo: Filtro por agente -->
  <select class="agent-filter" (change)="filterByAgent($event.target.value)">
    <option value="">Todos os Agentes</option>
    <option *ngFor="let agent of uniqueAgents" [value]="agent.id">
      {{ agent.emoji }} {{ agent.name }}
    </option>
  </select>
</div>
```

#### 4.3 Notificação Sonora (Opcional)

```typescript
// Para erros críticos
playNotificationSound(severity: string): void {
  if (severity === 'error' && this.soundEnabled) {
    const audio = new Audio('/assets/sounds/error.mp3');
    audio.volume = 0.3;
    audio.play().catch(() => {}); // Ignorar se bloqueado pelo browser
  }
}
```

---

## 3. Diagrama da Arquitetura Proposta

```
┌─────────────────────────────────────────────────────────────────┐
│                     ARQUITETURA PROPOSTA                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Frontend ──────► Gateway ──────► Conductor ──────► MongoDB     │
│     ▲                ▲                                  │        │
│     │                │                                  ▼        │
│     │                │                             tasks         │
│     │                │                       (status: pending)   │
│     │                │                                  │        │
│     │                │          ┌───────────────────────┤        │
│     │                │          ▼                       ▼        │
│     │                │      Watcher ◄──────────── Polling        │
│     │                │          │                                │
│     │                │          │ HTTP POST                      │
│     │                │          │ /api/internal/task-event       │
│     │                │          ▼                                │
│     │                └───── Gateway ────────┐                    │
│     │                    (recebe evento)    │                    │
│     │                                       ▼                    │
│     └─────────────── WebSocket ◄───── gamification_manager      │
│                    (broadcast)              .broadcast()         │
│                                                                  │
│  RESULTADO:                                                      │
│  ✅ TODOS os clientes conectados veem TODAS as tasks            │
│  ✅ Eventos em tempo real (não só conselheiros)                 │
│  ✅ Metadados completos para navegação                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Estimativa de Implementação

| Fase | Componentes | Complexidade | Arquivos Afetados |
|------|-------------|--------------|-------------------|
| 1 | Backend - Eventos | Média | `claude_mongo_watcher.py`, `app.py`, `websocket.py` |
| 2 | Frontend - UI Rica | Média | `event-ticker.component.ts`, `gamified-panel.component.ts` |
| 3 | Navegação | Alta | `screenplay-interactive.ts`, `event-ticker.component.ts`, `conductor-chat.component.ts` |
| 4 | Melhorias Extras | Baixa | `event-ticker.component.ts` |

---

## 5. Próximos Passos

1. **Validar plano** com stakeholders
2. **Implementar Fase 1** (Backend) - Crítico para funcionamento
3. **Implementar Fase 2** (UI Rica) - Melhoria visual imediata
4. **Implementar Fase 3** (Navegação) - Maior valor agregado
5. **Implementar Fase 4** (Extras) - Nice to have

---

## 6. Mockup Visual

```
┌─────────────────────────────────────────────────────────────────┐
│ Notícias dos Agentes                    [Todos] [Resultados] ▼  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 🔄 EXECUTANDO                                               │ │
│ │ 🕵️ Hunter Agent                                    há 5s → │ │
│ │ Buscando leads no LinkedIn...                               │ │
│ │ ○○○ (animação)                                              │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ✅ CONCLUÍDO                                                │ │
│ │ 📊 Analisador de Código                           há 2m → │ │
│ │ 15 arquivos analisados, 3 warnings encontrados              │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ❌ ERRO                                                     │ │
│ │ 🏛️ Conselheiro de Testes                         há 10m → │ │
│ │ Falha ao executar testes: timeout após 60s                  │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ⏳ AGUARDANDO                                               │ │
│ │ 🔧 Refatorador                                    há 15m → │ │
│ │ Aguardando na fila de execução...                           │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│ Agentes: 4 │ Execuções: 127 │ Última: 5s │ Investigações: 2     │
└─────────────────────────────────────────────────────────────────┘

LEGENDA DE CORES:
█ Amarelo = Aguardando (pending)
█ Azul = Executando (processing) + animação
█ Verde = Concluído (completed)
█ Vermelho = Erro (error)
→ = Clicável (navega para screenplay/conversa/agente)
```

---

*Documento gerado em: 2025-11-28*
*Autor: Claude (Análise de Arquitetura)*
