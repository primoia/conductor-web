# Diagnóstico: Task #81 — Agentes instanciados no mobile não aparecem no desktop

## 📋 Resumo Executivo

**Sintoma**: Agentes adicionados via interface mobile (`/m`) funcionam no mobile, mas **não aparecem** ao abrir a mesma conversa no desktop (`/screenplay`).

**Root Cause Identificada**: O componente mobile **NÃO persiste** as instâncias de agentes no banco de dados (MongoDB) via API `POST /api/agents/instances`. As instâncias existem apenas em memória local (`contextualAgents[]`) e em `localStorage`, tornando-as invisíveis para o desktop.

**Severidade**: 🔴 **Crítica** — quebra de sincronização cross-device entre mobile e desktop.

---

## 🔍 Análise Detalhada

### Fluxo Desktop (Screenplay) — ✅ CORRETO

**Arquivo**: `src/app/living-screenplay-simple/screenplay-interactive.ts`

**Método**: `onAgentSelected(selectionData: AgentSelectionData)` (linha ~3412)

**Passos executados**:
1. Recebe dados do modal de seleção (`AgentSelectorModalComponent`):
   ```typescript
   const { agent, instanceId, cwd } = selectionData;
   ```

2. Cria objeto `AgentInstance` em memória:
   ```typescript
   const newInstance: AgentInstance = {
     id: instanceId,
     agent_id: agent.id,
     conversation_id: this.activeConversationId || undefined,
     emoji: agent.emoji,
     definition: { title: agent.name, ... },
     status: 'pending',
     position: { x: 100, y: 100 },
     config: { cwd: cwd, ... }
   };
   this.agentInstances.set(instanceId, newInstance);
   ```

3. **🔑 PONTO CRÍTICO**: Persiste no MongoDB via API:
   ```typescript
   // Linha 3487
   this.createAgentInstanceInMongoDB(instanceId, agent.id, newInstance.position, cwd);
   ```

4. Método `_createAgentInstanceInMongoDB` (linha ~688):
   ```typescript
   const response = await fetch(`${baseUrl}/api/agents/instances`, {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       instance_id: instanceId,
       agent_id: agentId,
       position: position,
       screenplay_id: screenplayId,
       conversation_id: instance?.conversation_id || null,
       emoji: instance?.emoji || '🎬',
       definition: instance?.definition || { ... },
       cwd: cwd,
       // ...
     })
   });
   ```

**Resultado**: Instância é salva no MongoDB, visível para todos os clientes (mobile + desktop).

---

### Fluxo Mobile — ❌ PROBLEMA

**Arquivo**: `src/app/mobile-chat/mobile-chat.component.ts`

**Método**: `onAgentSelected(selectionData: AgentSelectionData)` (linha ~2005)

**Passos executados**:
1. Recebe dados do modal de seleção (mesmo modal usado no desktop):
   ```typescript
   const { agent, instanceId, cwd } = selectionData;
   ```

2. Cria objeto local apenas em memória:
   ```typescript
   const newAgent = {
     id: instanceId,
     agent_id: agent.id,
     emoji: agent.emoji,
     definition: { title: agent.name, description: agent.description, unicode: '' },
     status: 'pending' as const,
     position: { x: 0, y: 0 },
     config: { cwd }
   };
   this.contextualAgents = [...this.contextualAgents, newAgent];
   ```

3. **🚨 PROBLEMA IDENTIFICADO**: **NÃO** chama API para persistir no banco:
   - Não há chamada a `POST /api/agents/instances`
   - Não há método equivalente a `createAgentInstanceInMongoDB`
   - A instância existe **apenas em `contextualAgents[]`** (memória local)

4. Auto-seleciona o agente e atualiza conversa ativa:
   ```typescript
   setTimeout(() => {
     this.onDockAgentClick(newAgent);
   }, 200);
   ```

5. Método `onDockAgentClick` (linha ~1982) atualiza apenas a conversa com `active_agent`:
   ```typescript
   this.conversationService.setActiveAgent(this.activeConversationId, {
     agent_info: {
       agent_id: agent.agent_id,
       instance_id: agent.id,
       name: agent.definition?.title || agent.emoji,
       emoji: agent.emoji
     }
   }).subscribe();
   ```

**Resultado**:
- ✅ Conversa sabe qual agente está ativo (`active_agent` field)
- ❌ **Instância NÃO existe no MongoDB** (`agent_instances` collection)
- ❌ Desktop não consegue carregar a instância ao abrir a conversa

---

## 🎯 Root Cause

O mobile **assume** que a instância existe no banco (pois envia `instance_id` para a API de conversas), mas **nunca cria o registro** em `agent_instances` collection.

### Comparação lado a lado:

| Ação                     | Desktop (Screenplay)                     | Mobile (mobile-chat)           |
|--------------------------|------------------------------------------|--------------------------------|
| Criar objeto em memória  | ✅ `agentInstances.set()`                | ✅ `contextualAgents.push()`   |
| Persistir no MongoDB     | ✅ `POST /api/agents/instances`          | ❌ **NÃO PERSISTE**            |
| Atualizar conversa       | ✅ Implícito via `conversation_id`       | ✅ `setActiveAgent()`          |
| Visível no desktop?      | ✅ Sim                                   | ❌ Não                         |

---

## 📁 Arquivos e Linhas Afetadas

### 🐛 Arquivo com o bug:
**`src/app/mobile-chat/mobile-chat.component.ts`**

- **Linha 2005**: Método `onAgentSelected(selectionData: AgentSelectionData)`
  - **Problema**: Não persiste instância no banco
  - **Necessário**: Adicionar chamada a API `POST /api/agents/instances`

- **Linha 2011-2021**: Criação do objeto `newAgent`
  - **Problema**: Objeto existe apenas em memória local
  - **Necessário**: Enviar payload completo para MongoDB

### ✅ Arquivo de referência (implementação correta):
**`src/app/living-screenplay-simple/screenplay-interactive.ts`**

- **Linha 3412-3492**: Método `onAgentSelected()`
- **Linha 688-750**: Método `_createAgentInstanceInMongoDB()`
- **Linha 754-756**: Método auxiliar `createAgentInstanceInMongoDB()`

---

## 🛠️ Proposta de Fix

### Opção 1: Adicionar persistência no mobile (RECOMENDADA)

Modificar `mobile-chat.component.ts` para chamar a API após criar a instância local.

**Implementação**:

```typescript
// mobile-chat.component.ts, linha ~2005
onAgentSelected(selectionData: AgentSelectionData): void {
  this.showAgentSelector = false;

  const { agent, instanceId, cwd } = selectionData;

  // Add the new instance to contextual agents (memória local)
  const newAgent = {
    id: instanceId,
    agent_id: agent.id,
    emoji: agent.emoji,
    definition: { title: agent.name, description: agent.description, unicode: '' },
    status: 'pending' as const,
    position: { x: 0, y: 0 },
    config: { cwd }
  };

  this.contextualAgents = [...this.contextualAgents, newAgent];

  // 🔥 NOVO: Persistir instância no MongoDB
  this.persistAgentInstanceToMongoDB(instanceId, agent.id, cwd)
    .then(() => {
      console.log('✅ [MOBILE] Instância persistida no MongoDB:', instanceId);
    })
    .catch((err) => {
      console.error('❌ [MOBILE] Erro ao persistir instância:', err);
      // Instância continua em memória local, mas será perdida ao recarregar
    });

  // Auto-select the new agent
  setTimeout(() => {
    this.onDockAgentClick(newAgent);
  }, 200);
}

// 🔥 NOVO: Método para persistir instância no MongoDB
private async persistAgentInstanceToMongoDB(
  instanceId: string,
  agentId: string,
  cwd?: string
): Promise<void> {
  const payload: any = {
    instance_id: instanceId,
    agent_id: agentId,
    position: { x: 0, y: 0 }, // Posição não é relevante no mobile
    created_at: new Date().toISOString(),
    is_system_default: false,
    is_hidden: false,
    screenplay_id: this.activeScreenplayId,
    conversation_id: this.activeConversationId,
    emoji: this.contextualAgents.find(a => a.id === instanceId)?.emoji || '🤖',
    definition: this.contextualAgents.find(a => a.id === instanceId)?.definition || {
      title: 'Agent',
      description: '',
      unicode: ''
    }
  };

  if (cwd) {
    payload.cwd = cwd;
  }

  const response = await fetch(`/api/agents/instances`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create instance: ${response.status} ${errorText}`);
  }

  return response.json();
}
```

### Opção 2: Criar serviço compartilhado (MELHOR PRÁTICA)

Extrair lógica de persistência para `AgentService` e reutilizar em mobile + desktop.

**Implementação**:

1. Adicionar método em `src/app/services/agent.service.ts`:
   ```typescript
   createInstance(payload: {
     instance_id: string;
     agent_id: string;
     screenplay_id: string | null;
     conversation_id: string | null;
     emoji: string;
     definition: any;
     position?: { x: number; y: number };
     cwd?: string;
   }): Observable<any> {
     return from(
       fetch(`${this.baseUrl}/api/agents/instances`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           ...payload,
           created_at: new Date().toISOString(),
           is_system_default: false,
           is_hidden: false
         })
       }).then(async response => {
         if (!response.ok) {
           const errorText = await response.text();
           throw new Error(`Failed to create instance: ${response.status} ${errorText}`);
         }
         return response.json();
       })
     ).pipe(
       catchError(error => {
         console.error('[AgentService] Error creating instance:', error);
         return throwError(() => new Error('Failed to create instance'));
       })
     );
   }
   ```

2. Usar em `mobile-chat.component.ts`:
   ```typescript
   onAgentSelected(selectionData: AgentSelectionData): void {
     const { agent, instanceId, cwd } = selectionData;

     const newAgent = { /* ... */ };
     this.contextualAgents = [...this.contextualAgents, newAgent];

     // Persistir via serviço
     this.agentService.createInstance({
       instance_id: instanceId,
       agent_id: agent.id,
       screenplay_id: this.activeScreenplayId,
       conversation_id: this.activeConversationId,
       emoji: agent.emoji,
       definition: { title: agent.name, description: agent.description, unicode: '' },
       cwd: cwd
     }).subscribe({
       next: () => console.log('✅ Instância criada'),
       error: (err) => console.error('❌ Erro:', err)
     });

     setTimeout(() => this.onDockAgentClick(newAgent), 200);
   }
   ```

3. Refatorar `screenplay-interactive.ts` para usar o mesmo serviço (migração futura).

---

## 🧪 Plano de Teste

### Teste 1: Reproduzir o bug
1. Abrir mobile (`/m`)
2. Criar nova conversa
3. Adicionar agente via botão "+"
4. Enviar mensagem (verificar que funciona)
5. Abrir desktop (`/screenplay`) com a mesma conversa
6. **Verificar**: Agente NÃO aparece no dock ❌

### Teste 2: Validar o fix
1. Aplicar fix (Opção 1 ou 2)
2. Repetir passos 1-4
3. Abrir desktop (`/screenplay`) com a mesma conversa
4. **Verificar**: Agente APARECE no dock ✅
5. **Verificar**: Mensagens anteriores estão associadas ao agente ✅
6. **Verificar**: Console do navegador confirma `POST /api/agents/instances` ✅

### Teste 3: Validar sincronização bidirecional
1. Desktop: Criar conversa e adicionar agente
2. Mobile: Abrir mesma conversa → agente deve aparecer ✅
3. Mobile: Adicionar segundo agente
4. Desktop: Recarregar conversa → ambos agentes devem aparecer ✅

### Teste 4: Validar fallback em caso de erro
1. Simular falha na API (ex: gateway offline)
2. Mobile: Adicionar agente
3. **Verificar**: Agente aparece no mobile (memória local) ✅
4. **Verificar**: Console exibe erro mas não quebra UI ✅
5. Restaurar gateway e recarregar página
6. **Verificar**: Agente desaparece (não foi persistido) ⚠️
   - **Opcional**: Implementar retry ou persistência em fila

---

## 💡 Recomendações Adicionais

### 1. Sincronização de `display_order`
O desktop calcula `display_order` para ordenar agentes no dock (linha 3443-3455 do `screenplay-interactive.ts`). O mobile não implementa isso. Sugerimos:
- Adicionar campo `display_order` no payload do mobile
- Calcular baseado em `contextualAgents.length`

### 2. Tratamento de erros
Atualmente, o desktop faz `fire-and-forget` (linha 3487). Sugerimos:
- Adicionar `.catch()` ou `.subscribe()` com tratamento de erro
- Exibir notificação ao usuário em caso de falha

### 3. Limpeza de `localStorage`
O mobile salva ordem do dock em `localStorage` (linha 2402):
```typescript
localStorage.setItem(`agent-dock-order-${conversationId}`, JSON.stringify(ids));
```
**Problema**: Se instância não existe no banco, essa ordem fica "órfã". Sugerimos:
- Validar se `instance_id` existe no MongoDB antes de salvar ordem
- OU: Limpar entrada do `localStorage` ao detectar 404 na API

### 4. Migração de instâncias órfãs
Se houver agentes criados no mobile antes do fix:
- Script de migração para criar registros no MongoDB baseado em `conversations.active_agent`
- OU: Avisar usuário que agentes antigos foram perdidos

---

## 📊 Impacto da Correção

| Aspecto                  | Antes do Fix                  | Depois do Fix                  |
|--------------------------|-------------------------------|--------------------------------|
| Agentes no mobile        | ✅ Funcionam                  | ✅ Funcionam                   |
| Agentes no desktop       | ❌ Invisíveis (criados mobile)| ✅ Visíveis (ambos)            |
| Sincronização            | ❌ Quebrada                   | ✅ Cross-device                |
| Persistência             | ❌ Apenas memória local       | ✅ MongoDB (permanente)        |
| Histórico de mensagens   | ⚠️ Agente desassociado        | ✅ Vinculado corretamente      |

---

## 🎓 Conceitos-Chave

### Agent Instance vs Agent Definition
- **Agent Definition** (`agents` collection): Template do agente (nome, emoji, persona, MCPs)
- **Agent Instance** (`agent_instances` collection): Instância ativa vinculada a uma conversa/screenplay
- Um mesmo Agent pode ter múltiplas Instances (ex: mesmo agente em conversas diferentes)

### Fluxo de Vinculação
```
User seleciona agente no modal
  → Gera instanceId único (UUID)
  → Cria instance em memória (contextualAgents[])
  → 🔑 Persiste no MongoDB (POST /api/agents/instances)
  → Vincula à conversa (setActiveAgent)
  → Mensagens futuras referenciam instance_id
```

### Por que `instance_id` é importante?
- Permite múltiplas instâncias do mesmo agente com contextos diferentes (personas, MCPs, cwd)
- Vincula mensagens a instâncias específicas (histórico)
- Permite editar persona/MCPs sem afetar outras instâncias

---

## 📌 Conclusão

**Root Cause**: Mobile não persiste instâncias de agentes no MongoDB.

**Solução**: Adicionar chamada `POST /api/agents/instances` em `mobile-chat.component.ts:onAgentSelected()`.

**Esforço**: ~2-4 horas (Opção 1) ou ~1 dia (Opção 2 com refactor).

**Prioridade**: 🔴 Alta — bug afeta experiência cross-device, recurso core da aplicação.

---

**Documento gerado por**: Claude Code (Requirements Engineer Agent)
**Data**: 2026-02-16
**Versão**: 1.0
