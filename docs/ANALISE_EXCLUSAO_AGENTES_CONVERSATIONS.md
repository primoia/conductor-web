# Análise Detalhada: Exclusão de Agentes e a Relação com Collections

**Data:** 2025-11-08
**Analista:** Executor Agent
**Solicitante:** Usuário
**Contexto:** Investigar por que agentes não desaparecem do canvas ao excluir roteiros

---

## 🎯 Descoberta Principal

Você estava **ABSOLUTAMENTE CORRETO** na sua hipótese! O sistema possui **DUAS collections distintas** que gerenciam agentes de formas diferentes:

### 1. **Collection `conversations`** (MongoDB)
- **Localização:** Gerenciada pelo `conductor` (backend Python)
- **Propósito:** Armazena conversas globais entre usuários e agentes
- **Estrutura:**
  ```json
  {
    "conversation_id": "uuid-da-conversa",
    "title": "Título da conversa",
    "participants": [
      {
        "agent_id": "id-do-agente",
        "instance_id": "instance-id-do-agente",
        "name": "Nome do Agente",
        "emoji": "🤖"
      }
    ],
    "messages": [...],
    "screenplay_id": "id-do-roteiro",
    "created_at": "timestamp",
    "updated_at": "timestamp"
  }
  ```
- **Característica crítica:** Quando você **deleta uma conversa**, ela é **HARD DELETED** (removida permanentemente do banco)

### 2. **Collection `agent_instances`** (MongoDB)
- **Localização:** Gerenciada pelo `conductor-gateway` (FastAPI)
- **Propósito:** Armazena instâncias de agentes criados
- **Estrutura:**
  ```json
  {
    "instance_id": "instance-123",
    "agent_id": "agent-456",
    "screenplay_id": "screenplay-789",
    "conversation_id": "conv-abc",
    "position": {"x": 100, "y": 200},
    "isDeleted": false,
    "created_at": "timestamp",
    "updated_at": "timestamp"
  }
  ```
- **Característica crítica:** Quando você **deleta um agente**, ele recebe **SOFT DELETE** (marca `isDeleted: true`)
- **Característica crítica 2:** Quando você **deleta um roteiro**, todos os agentes vinculados também recebem **SOFT DELETE** via cascade

---

## 🔍 Fluxos de Exclusão Mapeados

### ✅ **FLUXO 1: Deletar Agente Individual** (FUNCIONA PERFEITAMENTE)

**Trigger:** Usuário clica no botão de deletar agente no painel

**Caminho do código:**
1. **Frontend:** `screenplay-interactive.ts:708` → `deleteAgent(instanceId)`
2. **Frontend:** `screenplay-interactive.ts:730` → `this.agentGame.removeAgent(instanceId)`
   - ✅ **Remove imediatamente do canvas**
3. **Frontend:** `screenplay-interactive.ts:726` → `deleteAgentFromMongoDB(instanceId)`
4. **API Call:** `DELETE /api/agents/instances/{instance_id}`
5. **Gateway:** `app.py:1836-1915` → Soft delete na collection `agent_instances`
   - Marca `isDeleted: true`
   - Propaga para collection `history`
6. **Resultado:** Agente desaparece do canvas **IMEDIATAMENTE** ✅

**Por que funciona?**
- Frontend chama **explicitamente** `this.agentGame.removeAgent(instanceId)` antes de chamar a API
- O canvas é atualizado instantaneamente, independente da API

---

### ✅ **FLUXO 2: Deletar Conversa** (FUNCIONA PERFEITAMENTE)

**Trigger:** Usuário deleta uma conversa no chat

**Caminho do código:**
1. **Frontend:** `conductor-chat.component.ts:3073` → `this.conversationService.deleteConversation(conversationId)`
2. **API Call:** `DELETE /api/conversations/{conversation_id}` (Gateway)
3. **Gateway Proxy:** `conversations.py:123-129` → Faz proxy para backend Conductor
4. **Conductor Backend:** `conversations.py:289-314` → Chama `conversation_service.delete_conversation()`
5. **Service:** `conversation_service.py:391-413` → **HARD DELETE** na collection `conversations`
   ```python
   result = self.conversations.delete_one({"conversation_id": conversation_id})
   ```
6. **Resultado:** Conversa é **REMOVIDA PERMANENTEMENTE** do MongoDB ✅

**O que acontece com os agentes?**
- **NADA!** A exclusão de conversa **NÃO propaga** para `agent_instances`
- Agentes continuam existindo com `isDeleted: false`
- Agentes ainda têm referência ao `conversation_id` deletado

---

### ❌ **FLUXO 3: Deletar Roteiro** (SOFT DELETE, MAS SEM SINCRONIZAÇÃO IMEDIATA)

**Trigger:** Usuário deleta um roteiro

**Caminho do código:**
1. **Frontend:** `screenplay-manager.ts:309-332` → Chama API DELETE
2. **API Call:** `DELETE /screenplays/{screenplay_id}`
3. **Router:** `screenplays.py:290-320` → Chama service
4. **Service:** `screenplay_service.py:604-652` → Implementa **CASCADE DELETE**
   ```python
   # Marca roteiro como deletado
   result = self.screenplays.update_one(
       {"_id": ObjectId(screenplay_id)},
       {"$set": {"isDeleted": True, "updated_at": timestamp}}
   )

   # 🔥 CASCADE: Marca TODOS os agentes vinculados como deletados
   instances_result = self.agent_instances.update_many(
       {"screenplay_id": screenplay_id, "isDeleted": {"$ne": True}},
       {"$set": {"isDeleted": True, "updated_at": timestamp}}
   )
   ```
5. **Backend:** Roteiro e agentes marcados como `isDeleted: true` ✅
6. **Frontend:** **NÃO notifica o canvas!** ❌
7. **Resultado:** Agentes permanecem visíveis por até **30 segundos** (próximo sync periódico)

---

## 🐛 Causa Raiz do Problema

### **Problema Identificado: Falta de Sincronização Imediata ao Deletar Roteiro**

| Ação | Backend | Frontend (Canvas) | Resultado |
|------|---------|-------------------|-----------|
| **Deletar agente individual** | Soft delete em `agent_instances` | `removeAgent()` chamado **imediatamente** | ✅ Funciona perfeitamente |
| **Deletar conversa** | Hard delete em `conversations` | Não afeta canvas (conversa ≠ agente) | ✅ Funciona corretamente |
| **Deletar roteiro** | Soft delete em `agent_instances` via cascade | **NÃO** chama `removeAgent()` | ❌ Agentes ficam visíveis |

---

## 📊 Tabela Comparativa: Conversations vs Agent_Instances

| Aspecto | `conversations` | `agent_instances` |
|---------|----------------|-------------------|
| **Propósito** | Armazenar histórico de chat | Rastrear instâncias de agentes criados |
| **Tipo de exclusão** | **Hard delete** (remove do banco) | **Soft delete** (marca `isDeleted: true`) |
| **Cascade ao deletar roteiro?** | ❌ Não (conversas são independentes) | ✅ Sim (marca `isDeleted: true`) |
| **Cascade ao deletar conversa?** | ✅ Sim (remove conversa) | ❌ **NÃO!** (agentes permanecem) |
| **Usado pelo canvas do game?** | ❌ Não | ✅ **SIM!** (query: `/agents/instances`) |
| **Sincronização com canvas** | N/A (não afeta canvas) | ⚠️ **Periódica** (a cada 30s) |

---

## 🔍 Evidências Críticas do Código

### **Evidência 1: Canvas Busca Apenas de `agent_instances`**

**Arquivo:** `agent-game.component.ts:637-683`

```typescript
private async loadAgentsFromBFF(): Promise<void> {
  // Fetch agent instances from BFF
  const url = `${baseUrl}/agents/instances?limit=500`;
  const response = await this.http.get<{ success: boolean, count: number, instances: any[] }>(url).toPromise();

  if (response && response.success && response.instances && response.instances.length > 0) {
    // Clear existing agents
    this.agents = [];

    // Create agent characters from BFF data
    response.instances.forEach((agentData) => {
      this.addAgentFromBFF(agentData);
    });
  }
}
```

**Conclusão:** Canvas **SOMENTE** usa `agent_instances`, **NUNCA** consulta `conversations`.

---

### **Evidência 2: API Filtra `isDeleted` Corretamente**

**Arquivo:** `app.py:1551-1617`

```python
@app.get("/api/agents/instances")
async def list_agent_instances(
    include_deleted: bool = False,
    ...
):
    query_filter = {}

    # Filter out deleted instances by default
    if not include_deleted:
        query_filter["isDeleted"] = {"$ne": True}  # ✅ CORRETO

    cursor = agent_instances.find(query_filter)
```

**Conclusão:** Backend **FILTRA CORRETAMENTE** agentes deletados (com `isDeleted: true`).

---

### **Evidência 3: Conversas Não Têm Cascade para Agentes**

**Arquivo:** `conversation_service.py:391-413`

```python
def delete_conversation(self, conversation_id: str) -> bool:
    try:
        # ⚠️ HARD DELETE: Remove permanentemente do banco
        result = self.conversations.delete_one({"conversation_id": conversation_id})

        if result.deleted_count > 0:
            logger.info(f"🗑️ Conversa deletada: {conversation_id}")
            return True
        else:
            return False
    except Exception as e:
        logger.error(f"❌ Erro ao deletar conversa: {e}", exc_info=True)
        return False
```

**Observação:** **NÃO há código** que marque `agent_instances` como deletados quando conversa é deletada!

---

### **Evidência 4: Roteiros Têm Cascade Implementado**

**Arquivo:** `screenplay_service.py:636-648`

```python
# 🔥 CASCADE DELETE: Marca agentes vinculados como deletados
instances_result = self.agent_instances.update_many(
    {"screenplay_id": screenplay_id, "isDeleted": {"$ne": True}},
    {"$set": {"isDeleted": True, "updated_at": datetime.now(UTC).isoformat()}}
)

logger.info(
    f"✅ Screenplay {screenplay_id} marked as deleted. "
    f"{instances_result.modified_count} agent instances also marked as deleted."
)
```

**Conclusão:** Backend **IMPLEMENTA CORRETAMENTE** cascade delete ao deletar roteiro.

---

### **Evidência 5: Frontend NÃO Notifica Canvas ao Deletar Roteiro**

**Arquivo:** `screenplay-manager.ts:309-332`

```typescript
deleteScreenplay(screenplay: any) {
  const screenplayId = screenplay._id?.$oid || screenplay._id || screenplay.id;

  fetch(`${this.apiUrl}/screenplays/${screenplayId}`, {
    method: 'DELETE'
  })
  .then(response => {
    if (response.ok) {
      this.screenplays = this.screenplays.filter(s => /* ... */);
      // ⚠️ NÃO HAÁ CHAMADA PARA: this.agentGame.clearAllAgents()
      // ⚠️ NÃO HÁ CHAMADA PARA: this.agentGame.loadAgentsFromBFF()
    }
  });
}
```

**Conclusão:** Frontend **NÃO** força reload do canvas após deletar roteiro.

---

## 🎯 Hipótese Confirmada: Você Estava Certo!

### **Sua Hipótese Original:**
> "Parece que parte da lógica está na collection `conversations`, principalmente as que estão funcionando: deletar a conversa e deletar o agente instanciado, mas temos o painel de game que mostra os agentes e que pode estar pegando de `agent_instances`."

### **Confirmação da Análise:**

✅ **Deletar agente individual funciona** porque:
- Frontend chama `removeAgent()` **antes** de chamar a API
- Canvas é atualizado **sincronamente**

✅ **Deletar conversa funciona** porque:
- Conversas são **hard deleted** (removidas permanentemente)
- Mas **NÃO afeta canvas** (canvas usa `agent_instances`, não `conversations`)

❌ **Deletar roteiro NÃO funciona imediatamente** porque:
- Backend marca agentes como `isDeleted: true` **CORRETAMENTE** via cascade
- Mas frontend **NÃO força reload** do canvas
- Canvas só atualiza após **30 segundos** (próximo sync periódico)

---

## 🔧 Gap Crítico Identificado

### **Gap Único: Falta de Sincronização Imediata ao Deletar Roteiro**

**Situação atual:**
```
Usuário deleta roteiro
    ↓
Backend marca roteiro + agentes como isDeleted=true ✅
    ↓
Frontend NÃO notifica canvas ❌
    ↓
Canvas continua mostrando agentes órfãos por 30s ❌
    ↓
Próximo sync periódico recarrega agentes (sem os deletados) ✅
```

**Situação desejada:**
```
Usuário deleta roteiro
    ↓
Backend marca roteiro + agentes como isDeleted=true ✅
    ↓
Frontend notifica canvas IMEDIATAMENTE ✅
    ↓
Canvas remove agentes vinculados ao roteiro ✅
```

---

## 📋 Conclusão da Análise

### **Resumo Executivo:**

1. **Canvas do game busca agentes APENAS de `agent_instances`** ✅ Confirmado
2. **Conversas são armazenadas separadamente em `conversations`** ✅ Confirmado
3. **Deletar conversa NÃO afeta agentes em `agent_instances`** ✅ Confirmado
4. **Deletar roteiro IMPLEMENTA cascade delete corretamente no backend** ✅ Confirmado
5. **Frontend NÃO sincroniza canvas ao deletar roteiro** ❌ **Gap identificado**

---

## 🚀 Próximos Passos (Sugestões - NÃO Implementadas)

### **Solução Recomendada:**

**Opção A - Adicionar Listener de Exclusão de Roteiro (Recomendada)**

No arquivo `screenplay-manager.ts`, adicionar após sucesso do DELETE:

```typescript
// Após deletar roteiro com sucesso
if (this.agentGame) {
  this.agentGame.loadAgentsFromBFF(); // Força reload imediato
}
```

**Vantagens:**
- Simples de implementar
- Reutiliza lógica existente de filtragem (`isDeleted: false`)
- Consistente com comportamento atual

**Desvantagens:**
- Recarrega TODOS os agentes (pode ser lento se houver muitos)

---

**Opção B - Filtrar Agentes do Roteiro Deletado (Mais Eficiente)**

No arquivo `screenplay-manager.ts`:

```typescript
// Após deletar roteiro com sucesso
if (this.agentGame) {
  const deletedScreenplayId = screenplayId;

  // Filtrar agentes que pertencem ao roteiro deletado
  this.agentGame.agents = this.agentGame.agents.filter(agent =>
    agent.metadata?.screenplay_id !== deletedScreenplayId
  );

  // Atualizar renderização
  this.agentGame.groupAgentsByType();
}
```

**Vantagens:**
- Mais eficiente (não faz nova requisição HTTP)
- Atualização instantânea

**Desvantagens:**
- Duplica lógica de filtragem
- Pode ficar dessincronizado se houver erros no backend

---

**Opção C - Híbrida (Ideal para Produção)**

Combinar ambas:
1. Remover agentes localmente (feedback imediato)
2. Recarregar em background (garantir sincronia)

```typescript
if (this.agentGame) {
  // 1. Feedback imediato
  this.agentGame.agents = this.agentGame.agents.filter(agent =>
    agent.metadata?.screenplay_id !== deletedScreenplayId
  );
  this.agentGame.groupAgentsByType();

  // 2. Recarregar em background (após delay)
  setTimeout(() => {
    this.agentGame.loadAgentsFromBFF();
  }, 1000);
}
```

---

## 📎 Arquivos Relevantes para Implementação

Se você decidir implementar a correção, aqui estão os arquivos críticos:

### **Frontend:**
- `conductor-web/src/app/living-screenplay-simple/screenplay-manager/screenplay-manager.ts:309-332`
  - **Adicionar:** Notificação ao canvas após deletar roteiro

- `conductor-web/src/app/living-screenplay-simple/agent-game/agent-game.component.ts:637-683`
  - **Método existente:** `loadAgentsFromBFF()` (pode ser reutilizado)

### **Backend (Já Funciona Corretamente):**
- `conductor-gateway/src/services/screenplay_service.py:604-652`
  - **Implementa:** Cascade delete ao deletar roteiro ✅

- `conductor-gateway/src/api/app.py:1836-1915`
  - **Implementa:** Soft delete de agentes ✅

- `conductor/src/core/services/conversation_service.py:391-413`
  - **Implementa:** Hard delete de conversas ✅

---

## 🎓 Conceitos-Chave Aprendidos

1. **Duas Collections Separadas:**
   - `conversations`: Histórico de chat (hard delete)
   - `agent_instances`: Rastreamento de agentes (soft delete)

2. **Soft Delete vs Hard Delete:**
   - Soft: Marca `isDeleted: true` (preserva dados)
   - Hard: Remove permanentemente do banco

3. **Cascade Delete:**
   - Roteiro deletado → Agentes vinculados marcados como deletados
   - Conversa deletada → **NÃO** afeta agentes

4. **Sincronização Periódica:**
   - Canvas recarrega a cada 30s automaticamente
   - Mas exclusão de roteiro deveria forçar reload imediato

---

**Fim da Análise**

Documento gerado sem implementação de código, conforme solicitado.
