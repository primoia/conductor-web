# Análise: Troca de Agente com Manutenção de Histórico

## 📋 Visão Geral

Esta análise examina a viabilidade técnica de **trocar o agente ativo no chat mantendo todo o histórico de mensagens**, permitindo que uma conversa iniciada com um agente (ex: RequirementsEngineer_Agent) possa ser continuada por outro agente (ex: Executor_Agent) sem perder o contexto da discussão.

**Cenário Desejado:**
1. Usuário inicia conversa com **RequirementsEngineer_Agent**
2. Agente analisa requisitos e responde
3. Usuário **troca para Executor_Agent** via dock
4. Executor_Agent **vê todo o histórico** da conversa anterior
5. Executor_Agent pode executar ações baseado no contexto já discutido

---

## 🎯 Status Atual da Implementação

### ✅ O que JÁ funciona

#### 1. **Isolamento de Históricos por Agente**

O sistema já implementa um **mapa de históricos isolados** por `instance_id` (UUID único de cada agente):

**Localização:** `conductor-chat.component.ts:1382`

```typescript
// ✅ SOLUÇÃO BUG PARALELISMO: Mapa de históricos isolados por agente
private chatHistories: Map<string, Message[]> = new Map();
```

**Como funciona:**
- Cada agente instanciado tem um histórico **completamente isolado**
- Ao trocar de agente via dock, o histórico do agente selecionado é carregado
- Mensagens enviadas são armazenadas **apenas** no histórico do agente ativo

**Código de troca de agente:** `conductor-chat.component.ts:1913-2078`

```typescript
loadContextForAgent(instanceId: string, agentName?: string, agentEmoji?: string,
                    agentDbId?: string, cwd?: string, screenplayId?: string): void {
  // ...

  // ✅ Verificar se já temos histórico em cache
  const cachedHistory = this.chatHistories.get(instanceId);
  if (cachedHistory) {
    console.log('✅ [CHAT] Histórico encontrado em cache local (paralelismo)');
    this.chatState.messages = cachedHistory; // Exibe histórico isolado
    // ...
  }
}
```

#### 2. **Persistência em MongoDB**

O histórico de cada agente é salvo no MongoDB e carregado automaticamente:

**Localização:** `conductor-chat.component.ts:1960-2078`

```typescript
this.agentService.getAgentContext(instanceId).subscribe({
  next: (context: AgentContext) => {
    // Mapeia histórico do MongoDB para o formato do chat
    context.history.forEach((record: any, index: number) => {
      if (record.user_input) {
        historyMessages.push({
          id: `history-user-${index}`,
          content: record.user_input,
          type: 'user',
          // ...
        });
      }
      if (record.ai_response) {
        historyMessages.push({
          id: `history-bot-${index}`,
          content: record.ai_response,
          type: 'bot',
          // ...
        });
      }
    });

    // Armazena no mapa isolado
    this.chatHistories.set(instanceId, historyMessages);
    this.chatState.messages = historyMessages;
  }
});
```

#### 3. **Cache Local com Persistência Remota**

O sistema usa uma estratégia híbrida:
- **Cache em memória** (`chatHistories` Map) para respostas instantâneas
- **MongoDB** como fonte de verdade persistente
- Ao trocar de agente, primeiro verifica cache, depois MongoDB

---

## ❌ O que NÃO funciona (Impedimento Atual)

### Problema: Históricos São Completamente Isolados

**Comportamento Atual:**
```
AgentA (RequirementsEngineer):
├─ Mensagem 1: User: "Analise os requisitos do sistema X"
├─ Mensagem 2: Agent: "Sistema X possui 5 requisitos principais..."
└─ [HISTÓRICO ISOLADO NO MONGODB: agent_history com instance_id=UUID-A]

AgentB (Executor):
└─ [HISTÓRICO VAZIO - NÃO VÊ mensagens do AgentA]
```

**Localização do Comportamento:** `conductor-chat.component.ts:1558-1565`

```typescript
// Se há um agente ativo, adiciona ao histórico isolado do agente
if (this.activeAgentId) {
  const agentHistory = this.chatHistories.get(this.activeAgentId) || [];
  this.chatHistories.set(this.activeAgentId, [...agentHistory, userMessage]);
  this.chatState.messages = this.chatHistories.get(this.activeAgentId) || [];
} else {
  // Sem agente ativo: comportamento padrão
  this.chatState.messages = [...filteredMessages, userMessage];
}
```

**Por que isso acontece?**
1. Cada `instance_id` tem sua própria coleção de mensagens no MongoDB
2. O método `loadContextForAgent()` **só carrega** o histórico do `instanceId` fornecido
3. Não há mecanismo para **compartilhar** ou **mesclar** históricos entre agentes

---

## 🔄 Fluxo Técnico Atual vs. Desejado

### Fluxo Atual (Isolado)

```
1. User seleciona RequirementsEngineer_Agent (instance_id: UUID-A)
   ↓
2. loadContextForAgent(UUID-A) → carrega histórico de UUID-A do MongoDB
   ↓
3. chatHistories.set(UUID-A, [msg1, msg2, msg3])
   ↓
4. User envia "Analise requisitos"
   ↓
5. Mensagem adicionada APENAS ao histórico de UUID-A
   ↓
6. User clica em Executor_Agent (instance_id: UUID-B)
   ↓
7. loadContextForAgent(UUID-B) → carrega histórico de UUID-B (VAZIO)
   ↓
8. chatHistories.set(UUID-B, []) ← PROBLEMA: não vê msg1, msg2, msg3
```

### Fluxo Desejado (Histórico Compartilhado)

```
1. User seleciona RequirementsEngineer_Agent (instance_id: UUID-A)
   ↓
2. loadContextForAgent(UUID-A) → carrega histórico de UUID-A
   ↓
3. chatHistories.set(UUID-A, [msg1, msg2, msg3])
   ↓
4. User envia "Analise requisitos"
   ↓
5. Mensagem adicionada ao histórico de UUID-A
   ↓
6. User clica em Executor_Agent (instance_id: UUID-B) + OPÇÃO "Usar histórico de UUID-A"
   ↓
7. loadContextForAgent(UUID-B, {shareHistoryFrom: UUID-A}) ← NOVO
   ↓
8. chatHistories.set(UUID-B, [msg1, msg2, msg3]) ← COPIA histórico de UUID-A
   ↓
9. Executor_Agent recebe contexto completo ao executar!
```

---

## 💡 Soluções Técnicas Possíveis

### ✅ Solução 1: Histórico Compartilhado via UI (Recomendada)

**Conceito:** Adicionar botão/modal na dock para permitir que o usuário **escolha compartilhar** o histórico ao trocar de agente.

**Modificações necessárias:**

#### 1.1. Adicionar opção na Dock

**Arquivo:** `conductor-chat.component.ts:183-190`

```typescript
<button
  *ngFor="let agent of contextualAgents"
  class="dock-item"
  [class.active]="activeAgentId === agent.id"
  (click)="onDockAgentClick(agent)"
  (contextmenu)="onDockAgentRightClick($event, agent)"> <!-- NOVO: menu contexto -->
  {{ agent.emoji }}
</button>
```

**Adicionar menu de contexto:**

```typescript
<!-- NOVO: Context Menu para Dock -->
<div *ngIf="showDockContextMenu" class="dock-context-menu"
     [style.top.px]="contextMenuY" [style.left.px]="contextMenuX">
  <button class="menu-item" (click)="switchAgentKeepHistory()">
    🔄 Trocar e manter histórico
  </button>
  <button class="menu-item" (click)="switchAgentNewHistory()">
    🆕 Trocar com histórico novo
  </button>
  <button class="menu-item" (click)="closeContextMenu()">
    ❌ Cancelar
  </button>
</div>
```

#### 1.2. Implementar lógica de cópia de histórico

**Adicionar ao componente:**

```typescript
// NOVO: Flag para controlar compartilhamento
private shareHistoryFromInstance: string | null = null;

/**
 * Troca de agente mantendo histórico do agente anterior
 */
switchAgentKeepHistory(): void {
  if (!this.activeAgentId || !this.selectedAgentForSwitch) return;

  // Guarda o instanceId do agente ATUAL (de onde copiar histórico)
  this.shareHistoryFromInstance = this.activeAgentId;

  // Carrega contexto do NOVO agente
  this.loadContextForAgent(
    this.selectedAgentForSwitch.id,
    this.selectedAgentForSwitch.name,
    this.selectedAgentForSwitch.emoji,
    this.selectedAgentForSwitch.agentDbId,
    this.selectedAgentForSwitch.cwd,
    this.activeScreenplayId
  );

  this.closeContextMenu();
}

/**
 * Modificar loadContextForAgent para suportar cópia de histórico
 */
loadContextForAgent(instanceId: string, agentName?: string, agentEmoji?: string,
                    agentDbId?: string, cwd?: string, screenplayId?: string): void {
  // ... (código existente)

  // ✅ NOVA LÓGICA: Se há histórico para compartilhar
  if (this.shareHistoryFromInstance) {
    const sourceHistory = this.chatHistories.get(this.shareHistoryFromInstance);

    if (sourceHistory && sourceHistory.length > 0) {
      console.log('🔄 [CHAT] Copiando histórico de:', this.shareHistoryFromInstance);
      console.log('   Para agente:', instanceId);
      console.log('   Mensagens copiadas:', sourceHistory.length);

      // Copia o histórico para o novo agente
      this.chatHistories.set(instanceId, [...sourceHistory]);
      this.chatState.messages = sourceHistory;
      this.chatState.isLoading = false;

      // Limpa flag
      this.shareHistoryFromInstance = null;
      return; // Não carrega do MongoDB
    }
  }

  // ... (continua com lógica existente de carregar do MongoDB)
}
```

#### 1.3. Persistir histórico compartilhado no MongoDB

**Importante:** Quando o usuário envia uma mensagem com histórico copiado, o backend precisa saber do contexto anterior.

**Modificação no envio de mensagem:** `conductor-chat.component.ts:1638`

```typescript
this.agentService.executeAgent(
  currentAgentDbId,
  data.message.trim(),
  currentInstanceId,
  cwd,
  this.activeScreenplayId || undefined,
  data.provider,
  // NOVO: enviar histórico copiado se existir
  this.chatHistories.get(currentInstanceId) // passa histórico completo
).subscribe({ /* ... */ });
```

**Modificação no backend (Python):**

O backend precisa aceitar um parâmetro opcional `shared_history` e incluir no contexto do agente:

```python
# backend/conductor/src/core/services/agent_execution.py

async def execute_agent(
    agent_id: str,
    user_input: str,
    instance_id: str,
    cwd: Optional[str] = None,
    screenplay_id: Optional[str] = None,
    ai_provider: Optional[str] = None,
    shared_history: Optional[List[dict]] = None  # NOVO
):
    # ...

    # Se há histórico compartilhado, incluir no contexto
    if shared_history:
        # Converter para formato do LangChain
        messages = []
        for msg in shared_history:
            if msg['type'] == 'user':
                messages.append(HumanMessage(content=msg['content']))
            elif msg['type'] == 'bot':
                messages.append(AIMessage(content=msg['content']))

        # Adicionar ao contexto do agente
        context['shared_history'] = messages
```

---

### ✅ Solução 2: Histórico de Conversação Global (Alternativa)

**Conceito:** Criar um **histórico de conversação** unificado, independente de agentes, que todos os agentes podem acessar.

**Estrutura de dados proposta:**

```typescript
// NOVO: Histórico de conversação global
interface Conversation {
  id: string; // UUID da conversação
  title: string; // Título gerado automaticamente ou definido pelo usuário
  messages: Message[]; // Todas as mensagens da thread
  participants: string[]; // Lista de instance_ids dos agentes que participaram
  createdAt: Date;
  updatedAt: Date;
}

// NOVO: Service para gerenciar conversações
@Injectable()
export class ConversationService {
  private activeConversation: Conversation | null = null;

  startConversation(title?: string): Conversation {
    return {
      id: uuidv4(),
      title: title || `Conversa ${new Date().toLocaleString()}`,
      messages: [],
      participants: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  addMessageToConversation(conversationId: string, message: Message, agentId: string) {
    const conv = this.getConversation(conversationId);
    conv.messages.push(message);

    // Adiciona agente como participante se ainda não estiver
    if (!conv.participants.includes(agentId)) {
      conv.participants.push(agentId);
    }

    this.saveConversation(conv);
  }

  getConversationHistory(conversationId: string): Message[] {
    return this.getConversation(conversationId).messages;
  }
}
```

**Vantagens:**
- Histórico **independente** de agentes
- Permite múltiplos agentes na **mesma thread**
- Facilita features futuras como "resumo de conversação", "exportar conversa"

**Desvantagens:**
- Mudança **mais invasiva** no código existente
- Precisa de UI para gerenciar conversações (criar, renomear, arquivar)
- Complexidade maior no backend (nova coleção MongoDB)

---

### ⚠️ Solução 3: Merge Automático (Não Recomendada)

**Conceito:** Sempre que trocar de agente, **mesclar automaticamente** o histórico do agente anterior.

**Problemas:**
- **Poluição de contexto:** Agente executor veria conversas irrelevantes
- **Sem controle do usuário:** Usuário pode querer histórico limpo
- **Dificulta debugging:** Não fica claro qual agente disse o quê

**Conclusão:** Descartada por UX ruim.

---

## 🏗️ Componentes Afetados

### Frontend (Angular)

| Componente | Arquivo | Mudanças Necessárias |
|------------|---------|---------------------|
| `ConductorChatComponent` | `conductor-chat.component.ts` | Adicionar menu contexto na dock, lógica de cópia de histórico |
| `ChatMessagesComponent` | `chat-messages.component.ts` | (sem mudanças) |
| Interface `Message` | `chat.models.ts` | Adicionar campo opcional `conversationId` (Solução 2) |
| `AgentService` | `agent.service.ts` | Modificar `executeAgent()` para aceitar histórico compartilhado |

### Backend (Python)

| Módulo | Arquivo | Mudanças Necessárias |
|--------|---------|---------------------|
| Agent Execution | `core/services/agent_execution.py` | Aceitar parâmetro `shared_history`, incluir no contexto do agente |
| Agent API | `api/routes/agents.py` | Endpoint `POST /execute` aceitar `shared_history` no body |
| Conversation Service | `core/services/conversation.py` | **(Solução 2)** Novo serviço para gerenciar conversações |
| Conversation Model | `core/models/conversation.py` | **(Solução 2)** Novo schema MongoDB |

---

## 📊 Regras de Negócio Identificadas

### Regra 1: Isolamento de Histórico por Instância (Atual)

**Descrição:** Cada `instance_id` de agente mantém seu próprio histórico isolado no MongoDB (`agent_history` collection).
**Implementação:** `conductor-chat.component.ts:1382` (mapa `chatHistories`)
**Impacto:** Impede compartilhamento automático de contexto entre agentes.

### Regra 2: Histórico como Contexto de Execução

**Descrição:** O histórico de conversas é enviado ao backend como contexto para o LLM entender o que já foi discutido.
**Implementação:** Backend adiciona histórico ao prompt via LangChain `ChatMessageHistory`
**Impacto:** Se novo agente não recebe histórico, perde todo o contexto.

### Regra 3: Persistência Dual (Cache + MongoDB)

**Descrição:** Histórico é mantido em cache (`Map`) para performance e sincronizado com MongoDB para persistência.
**Implementação:** `conductor-chat.component.ts:1948-2078`
**Impacto:** Mudanças precisam atualizar ambos os locais.

### Regra 4: Mensagens Têm Ownership

**Descrição:** Cada mensagem no histórico está vinculada a um `instance_id` específico no MongoDB.
**Implementação:** Campo `instance_id` na collection `agent_history`
**Impacto:** Copiar histórico requer **duplicar** registros no MongoDB ou criar nova collection de conversações.

---

## 🔗 Relacionamentos e Dependências

### Fluxo de Dados: Troca de Agente

```
┌─────────────────────────────────────────────────────────────────┐
│ USER CLICA EM AGENTE NA DOCK                                    │
└────────────┬────────────────────────────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────────────────────────────┐
│ onDockAgentClick(agent)                                         │
│ conductor-chat.component.ts:2244                                │
└────────────┬────────────────────────────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────────────────────────────┐
│ agentDockClicked.emit(agent)                                    │
│ Emite evento para ScreenplayInteractive                         │
└────────────┬────────────────────────────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────────────────────────────┐
│ ScreenplayInteractive.onDockAgentClick(agent)                   │
│ screenplay-interactive.ts                                       │
└────────────┬────────────────────────────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────────────────────────────┐
│ conductorChatComponent.loadContextForAgent(                     │
│   agent.id, agent.name, agent.emoji, agent.agentId, agent.cwd) │
└────────────┬────────────────────────────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────────────────────────────┐
│ 1. Verifica cache: chatHistories.get(instanceId)               │
│    ├─ Se encontrou → exibe imediatamente                       │
│    └─ Se não encontrou → carrega do MongoDB                    │
│                                                                 │
│ 2. agentService.getAgentContext(instanceId)                     │
│    ↓                                                            │
│    GET /api/agents/instances/{instanceId}/context               │
│    ↓                                                            │
│    MongoDB: agent_history.find({instance_id: instanceId})      │
│    ↓                                                            │
│    Retorna: {history: [{user_input, ai_response}, ...]}        │
│                                                                 │
│ 3. Mapeia para formato UI (Message[])                          │
│                                                                 │
│ 4. Armazena no cache: chatHistories.set(instanceId, messages)  │
│                                                                 │
│ 5. Exibe no chat: chatState.messages = messages                │
└─────────────────────────────────────────────────────────────────┘
```

### Dependências de Código

```
ConductorChatComponent
├─ chatHistories: Map<string, Message[]> ← Armazena históricos isolados
├─ activeAgentId: string ← Instance ID do agente ativo
├─ loadContextForAgent() ← Carrega histórico do MongoDB
├─ handleSendMessage() ← Envia mensagem e adiciona ao histórico
└─ agentService.getAgentContext() ← Busca histórico no backend

AgentService
├─ getAgentContext(instanceId) ← GET /api/agents/instances/{id}/context
├─ executeAgent(...) ← POST /api/v1/stream-execute
└─ updateInstanceCwd(...) ← PUT /api/agents/instances/{id}/cwd

Backend (Python)
├─ GET /agents/instances/{instance_id}/context
│   └─ Retorna agent_history do MongoDB
├─ POST /api/v1/stream-execute
│   └─ Executa agente com histórico como contexto
└─ MongoDB: agent_history collection
    └─ Documentos: {instance_id, user_input, ai_response, timestamp}
```

---

## 🎓 Conceitos-Chave

### Histórico de Agente vs. Histórico de Conversação

- **Histórico de Agente:** Vinculado a um `instance_id` específico. Representa todas as interações que **aquele agente específico** teve.
- **Histórico de Conversação:** Vinculado a uma **thread de discussão**, independente de quais agentes participaram. Representa o **contexto completo** de uma tarefa/discussão.

**Analogia:**
- **Agente:** "Eu sou o RequirementsEngineer_Agent e me lembro de todas as análises que **eu** fiz"
- **Conversação:** "Esta thread é sobre implementar feature X, e teve participação do RequirementsEngineer + Executor"

### Cache Local vs. Fonte de Verdade (MongoDB)

O sistema usa uma arquitetura híbrida:
- **Cache (Map):** Armazena históricos em memória para acesso instantâneo. Limpo ao recarregar a página.
- **MongoDB:** Fonte de verdade persistente. Históricos sobrevivem a recarregamentos e podem ser acessados de qualquer dispositivo.

**Implicação:** Ao implementar compartilhamento de histórico, é preciso decidir:
- Copiar histórico **apenas no cache** (temporário, só nesta sessão)
- Copiar histórico **no MongoDB** (permanente, cria duplicação de dados)

---

## 📌 Recomendações de Implementação

### 🥇 Opção Recomendada: Solução 1 (Menu Contexto na Dock)

**Por quê?**
- ✅ Menor impacto no código existente
- ✅ UX clara: usuário **escolhe** quando compartilhar histórico
- ✅ Não polui históricos de agentes
- ✅ Rápida de implementar (1-2 dias de desenvolvimento)

**Passos de implementação:**

1. **Frontend - Adicionar UI (2-3 horas):**
   - Menu de contexto ao clicar com botão direito na dock
   - Opções: "Trocar e manter histórico" / "Trocar com histórico limpo"

2. **Frontend - Lógica de cópia (2-3 horas):**
   - Método `switchAgentKeepHistory()`
   - Modificar `loadContextForAgent()` para aceitar flag `shareHistoryFrom`
   - Copiar histórico do mapa `chatHistories`

3. **Backend - Aceitar histórico compartilhado (3-4 horas):**
   - Modificar endpoint `POST /api/v1/stream-execute` para aceitar `shared_history`
   - Incluir histórico compartilhado no contexto do LangChain
   - **(Opcional)** Persistir no MongoDB com flag `shared_from: instance_id`

4. **Testes (2-3 horas):**
   - Testar fluxo completo: Agent A → conversa → troca para Agent B com histórico
   - Validar que Agent B vê contexto completo
   - Verificar que histórico de Agent A não foi modificado

**Estimativa total:** 10-12 horas de desenvolvimento

### 🥈 Opção Futura: Solução 2 (Conversações Globais)

**Quando considerar:**
- Se houver necessidade de **múltiplos agentes colaborando** na mesma task
- Se precisar de features como "exportar conversação", "resumo automático"
- Se houver plano de adicionar **threading** (threads de discussão, como no Slack)

**Estimativa:** 2-3 dias de desenvolvimento + design de UX

---

## ⚠️ Considerações de UX

### Feedback Visual Necessário

Quando implementar histórico compartilhado, é importante indicar visualmente:

1. **Badge no chat:** "Este agente está vendo histórico compartilhado de RequirementsEngineer_Agent"
2. **Cores diferenciadas:** Mensagens do agente anterior em tom mais claro
3. **Separador visual:** Linha divisória indicando "▼ Histórico compartilhado de RequirementsEngineer_Agent"

**Exemplo de UI:**

```
┌──────────────────────────────────────────────────────┐
│ 🟢 🤖 Executor_Agent                                 │
│ 📋 Visualizando histórico de RequirementsEngineer    │
├──────────────────────────────────────────────────────┤
│                                                      │
│ ▼ Histórico compartilhado de RequirementsEngineer   │
│                                                      │
│ [User] Analise os requisitos do sistema X           │
│ [RequirementsEngineer] Sistema X possui 5 req...    │
│                                                      │
│ ──────────────────────────────────────────────────  │
│ ▼ Início da conversa com Executor_Agent             │
│                                                      │
│ [User] Execute os requisitos identificados          │
│ [Executor] Iniciando execução...                    │
└──────────────────────────────────────────────────────┘
```

---

## 🎯 Conclusão

### ✅ Viabilidade Técnica: **SIM, é viável**

O sistema **já possui a infraestrutura necessária** para implementar compartilhamento de histórico:
- Mapas de históricos isolados (`chatHistories`)
- Persistência em MongoDB
- Sistema de troca de agentes via dock

### 🛠️ Mudanças Necessárias: **Moderadas**

**Frontend:**
- Adicionar menu contexto na dock (~5 linhas HTML + CSS)
- Implementar lógica de cópia de histórico (~50 linhas TypeScript)
- Feedback visual de histórico compartilhado (~20 linhas HTML/CSS)

**Backend:**
- Aceitar parâmetro `shared_history` no endpoint de execução (~30 linhas Python)
- Incluir histórico no contexto do LangChain (~20 linhas Python)

**Total:** ~125 linhas de código + testes

### 📅 Tempo de Implementação Estimado

- **Solução 1 (Recomendada):** 10-12 horas (1-2 dias)
- **Solução 2 (Conversações):** 16-24 horas (2-3 dias)

### 🚀 Próximos Passos Sugeridos

1. **Prototipar UI** do menu contexto na dock (Figma/mockup)
2. **Validar com usuários** se o fluxo faz sentido
3. **Implementar MVP** com Solução 1
4. **Coletar feedback** de uso real
5. **Evoluir para Solução 2** se houver demanda

---

**Arquivo gerado em:** 2025-11-01
**Autor:** Requirements Engineer Agent (Claude)
**Versão:** 1.0
