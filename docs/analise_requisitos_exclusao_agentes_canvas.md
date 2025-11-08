# Análise de Requisitos: Exclusão de Agentes no Canvas do Game

## 📋 Visão Geral

O sistema atual apresenta um problema de sincronização entre a exclusão lógica de agentes (marcação `isDeleted` no banco de dados) e sua remoção visual do canvas do game. Quando um agente é deletado ou quando um roteiro completo é removido, os agentes permanecem visíveis no canvas (`class="game-canvas"`), mesmo que tenham sido marcados como deletados no MongoDB.

Este documento mapeia o fluxo completo de criação, exibição e exclusão de agentes para identificar onde ocorre a falha de sincronização.

---

## 🎯 Requisitos Identificados

### Requisitos Funcionais Atuais

- **RF1**: O sistema deve criar instâncias de agentes no MongoDB e exibi-las no canvas do game
- **RF2**: O sistema deve permitir a exclusão de agentes individuais (soft delete - flag `isDeleted`)
- **RF3**: O sistema deve permitir a exclusão de roteiros inteiros (soft delete)
- **RF4**: O canvas do game deve carregar agentes da API do backend periodicamente (sync a cada 30 segundos)
- **RF5**: O sistema deve filtrar agentes deletados (`isDeleted: true`) ao buscar da API

### Requisitos Não-Funcionais Identificados

- **RNF1**: A API do backend possui um parâmetro `include_deleted` que controla se agentes deletados devem ser retornados (padrão: `false`)
- **RNF2**: O canvas utiliza sincronização periódica para atualizar a lista de agentes, mas não possui sincronização imediata em tempo real

### Requisito Problemático (Gap Identificado)

- **RF-GAP**: O sistema **NÃO** remove visualmente os agentes do canvas quando são deletados até que ocorra o próximo ciclo de sincronização periódica (30 segundos), **MAS MESMO NO PRÓXIMO CICLO**, a API continua retornando agentes deletados porque o frontend **NÃO** está passando o parâmetro `include_deleted=false` explicitamente na chamada.

---

## 🔄 Fluxo Atual do Processo

### 1. Criação de Agentes

**Início**: Usuário cria um novo agente através da interface

1. **Frontend (screenplay-interactive.ts)**:
   - Agente é adicionado ao `Map<string, AgentInstance>` local (linha ~708-735)
   - Instância é enviada ao MongoDB via API

2. **Backend (conductor-gateway/app.py)**:
   - Recebe requisição POST `/api/agents/instances`
   - Cria documento no MongoDB na coleção `agent_instances`
   - Documento inclui campos: `instance_id`, `agent_id`, `screenplay_id`, `emoji`, `definition`, `status`, `isDeleted: false`

3. **Canvas (agent-game.component.ts)**:
   - Método `loadAgentsFromBFF()` é chamado no `ngAfterViewInit` (linha ~220)
   - Faz chamada GET para `${baseUrl}/agents/instances?limit=500` (linha ~644)
   - **PROBLEMA**: Não passa explicitamente `include_deleted=false`
   - Recebe lista de agentes e cria personagens visuais (`AgentCharacter`)
   - Adiciona cada agente ao array `this.agents[]` (linha ~746)
   - Renderiza agentes no canvas usando animação frame-by-frame

### 2. Sincronização Periódica

**Processamento**: Canvas sincroniza com backend a cada 30 segundos

1. **Método `startPeriodicSync()` (agent-game.component.ts ~linha 222)**:
   - Configura `setInterval` com `SYNC_INTERVAL_MS = 30000`
   - A cada 30 segundos, chama `loadAgentsFromBFF()`
   - Limpa array `this.agents = []` (linha ~659)
   - Recarrega todos os agentes do backend

2. **Problema**: Durante o recarregamento:
   - A query `${baseUrl}/agents/instances?limit=500` **não especifica** `include_deleted=false`
   - Backend aceita a ausência do parâmetro e usa **padrão `false`** (linha 1558 do app.py)
   - **MAS**: Se houver algum problema no filtro do MongoDB ou se a lógica de filtragem não estiver funcionando corretamente, agentes deletados podem vazar

### 3. Exclusão de Agente Individual

**Início**: Usuário clica no botão de deletar agente

1. **Frontend (conductor-chat.component.ts)**:
   - Emite evento `deleteAgentRequested` (linha ~2864)

2. **ScreenplayInteractive (screenplay-interactive.ts)**:
   - Método `deleteAgent(instanceId)` é chamado (linha ~708)
   - Remove instância do `Map` local: `this.agentInstances.delete(instanceId)` (linha ~718)
   - Atualiza UI local: `updateLegacyAgentsFromInstances()`, `updateAvailableEmojis()`, `updateAgentDockLists()` (linhas ~721-723)
   - Chama `deleteAgentFromMongoDB(instanceId)` (linha ~726)
   - **Chama `this.agentGame.removeAgent(instanceId)`** (linha ~730) ← **REMOVE DO CANVAS IMEDIATAMENTE**

3. **Backend (app.py)**:
   - Recebe DELETE `/api/agents/instances/{instance_id}`
   - **Faz soft delete**: Define `isDeleted: true` e `deleted_at: timestamp` no MongoDB
   - **NÃO remove** o documento do banco, apenas marca como deletado

4. **Canvas (agent-game.component.ts)**:
   - Método `removeAgent(instanceId)` é chamado (linha ~2250)
   - Encontra agente no array `this.agents` e remove via `splice()` (linha ~2254)
   - **SUCESSO**: Agente é removido visualmente do canvas imediatamente

**Finalização**: Agente é marcado como deletado no MongoDB e removido do canvas

### 4. Exclusão de Roteiro Completo

**Início**: Usuário deleta um roteiro inteiro

1. **Frontend (screenplay-manager.ts)**:
   - Método `deleteScreenplay()` é chamado (linha ~309)
   - Chama `screenplayStorage.deleteScreenplay(id)` (linha ~313)
   - Emite evento `action: 'delete'` (linha ~324)

2. **Backend (screenplay-storage.ts → conductor-gateway/screenplays.py)**:
   - Recebe DELETE `/api/screenplays/{id}`
   - **Faz soft delete do roteiro**: Define `isDeleted: true` no screenplay
   - **NÃO deleta automaticamente** as instâncias de agentes associadas ao roteiro

3. **Problema Crítico - Agentes Órfãos**:
   - As instâncias de agentes vinculadas ao roteiro **NÃO são marcadas como deletadas**
   - O campo `screenplay_id` dos agentes ainda aponta para o roteiro deletado
   - Não existe cascade delete ou lógica de limpeza automática

4. **Canvas (agent-game.component.ts)**:
   - No próximo ciclo de sincronização (30 segundos), chama `loadAgentsFromBFF()`
   - Query: `${baseUrl}/agents/instances?limit=500`
   - Backend retorna **TODOS os agentes**, incluindo aqueles cujo `screenplay_id` aponta para roteiro deletado
   - Agentes órfãos continuam sendo renderizados no canvas

**Finalização (incorreta)**: Roteiro é deletado, mas agentes órfãos permanecem no canvas indefinidamente

---

## 🏗️ Componentes Principais

### Frontend (Angular)

#### **AgentGameComponent** (`agent-game/agent-game.component.ts`)
- **Responsabilidade**: Renderizar agentes no canvas como personagens animados
- **Dados mantidos**: Array `agents: AgentCharacter[]` (linha ~110)
- **Métodos críticos**:
  - `loadAgentsFromBFF()` (linha ~637): Busca agentes da API e popula array
  - `addAgentFromBFF(agentData)` (linha ~690): Cria `AgentCharacter` a partir de dados da API
  - `removeAgent(instanceId)` (linha ~2250): Remove agente do array visual
  - `clearAllAgents()` (linha ~2244): Limpa todos os agentes do canvas
  - `startPeriodicSync()` (linha ~222): Sincronização automática a cada 30 segundos

#### **ScreenplayInteractive** (`screenplay-interactive.ts`)
- **Responsabilidade**: Orquestrar criação, edição e exclusão de agentes
- **Dados mantidos**: `Map<string, AgentInstance> agentInstances`
- **Métodos críticos**:
  - `deleteAgent(instanceId)` (linha ~708): Deleta agente e sincroniza com canvas
  - `deleteAgentFromMongoDB(instanceId)` (linha ~740): Chama API de DELETE

#### **ScreenplayManager** (`screenplay-manager.ts`)
- **Responsabilidade**: Gerenciar roteiros (criar, renomear, deletar)
- **Métodos críticos**:
  - `deleteScreenplay()` (linha ~309): Deleta roteiro via API
  - **NÃO** possui lógica para deletar agentes associados

#### **AgentInstanceManagementService** (`agent-instance-management.service.ts`)
- **Responsabilidade**: Gerenciar ciclo de vida de instâncias de agentes em memória
- **Dados mantidos**: `BehaviorSubject<Map<string, AgentInstance>>`
- **Métodos críticos**:
  - `removeInstance(id, softDelete)` (linha ~174): Remove ou marca como deletado
  - `getActiveInstances()` (linha ~272): Filtra instâncias não deletadas (`!instance.isDeleted`)
  - `getVisibleInstances()` (linha ~280): Filtra não deletadas e não ocultas

### Backend (Python)

#### **API Gateway** (`conductor-gateway/src/api/app.py`)

##### **Endpoint de Listagem de Agentes**
- **URL**: `GET /api/agents/instances` (linha 1551-1617)
- **Parâmetros aceitos**:
  - `agent_id`: Filtrar por ID do agente (opcional)
  - `status`: Filtrar por status (opcional)
  - `limit`: Limite de resultados (padrão: 100, máx: 500)
  - `offset`: Paginação (padrão: 0)
  - `sort`: Ordenação (padrão: `-created_at`)
  - **`include_deleted`**: Incluir agentes deletados (padrão: `false`)

- **Lógica de filtragem** (linhas 1575-1584):
  ```python
  query_filter = {}
  if agent_id:
      query_filter["agent_id"] = agent_id
  if status:
      query_filter["status"] = status

  # Filter out deleted instances by default
  if not include_deleted:
      query_filter["isDeleted"] = {"$ne": True}
  ```

- **Query MongoDB**:
  ```python
  agent_instances = mongo_db["agent_instances"]
  cursor = agent_instances.find(query_filter)
  cursor = cursor.sort(sort_field, sort_direction).skip(offset).limit(limit)
  ```

##### **Endpoint de Exclusão de Agentes**
- **URL**: `DELETE /api/agents/instances/{instance_id}` (linha 1836-1915)
- **Parâmetros aceitos**:
  - `instance_id`: ID da instância do agente (path parameter)
  - `hard`: Booleano para hard delete (padrão: `false`) - NÃO IMPLEMENTADO NO SISTEMA ATUAL
  - `cascade`: Booleano para deletar dados relacionados (padrão: `false`) - NÃO IMPLEMENTADO NO SISTEMA ATUAL

- **Comportamento (Soft Delete)**:
  1. Marca instância como deletada: `isDeleted: true`, `deleted_at: timestamp`
  2. Marca mensagens de histórico como deletadas: propaga `isDeleted` para collection `history`
  3. Retorna: `{"success": true, "deletion_type": "soft", "history_messages_affected": N}`

#### **Screenplays Router** (`conductor-gateway/src/api/routers/screenplays.py`)

##### **Endpoint de Exclusão de Roteiros**
- **URL**: `DELETE /screenplays/{screenplay_id}` (linha 290-320)
- **Comportamento**:
  1. Chama `ScreenplayService.delete_screenplay(screenplay_id)`
  2. Retorna 204 No Content em sucesso
  3. Retorna 404 se roteiro não encontrado

#### **ScreenplayService** (`conductor-gateway/src/services/screenplay_service.py`)

##### **Método `delete_screenplay(screenplay_id)`** (linha 604-652)
- **Responsabilidade**: Implementa a lógica de soft delete de roteiros **COM CASCADE DELETE**

- **Fluxo de Execução**:
  1. **Valida `screenplay_id`** e converte para `ObjectId` (linhas 615-619)
  2. **Verifica se roteiro existe** e não está deletado (linhas 622-625)
  3. **Marca roteiro como deletado** (linhas 627-631):
     ```python
     result = self.collection.update_one(
         {"_id": obj_id, "isDeleted": False},
         {"$set": {"isDeleted": True, "updatedAt": datetime.now(UTC)}}
     )
     ```
  4. **✅ IMPLEMENTA CASCADE DELETE** (linhas 636-648):
     ```python
     instances_result = self.agent_instances.update_many(
         {"screenplay_id": screenplay_id, "isDeleted": {"$ne": True}},
         {"$set": {"isDeleted": True, "updated_at": datetime.now(UTC).isoformat()}}
     )
     logger.info(f"Marked {instances_result.modified_count} agent_instances as deleted")
     ```

- **Retorno**:
  - `True` se exclusão bem-sucedida
  - `False` se roteiro não encontrado

---

## 🔗 Relacionamentos e Dependências

### Fluxo de Dados (Criação → Exibição)

```
Usuário cria agente
    ↓
ScreenplayInteractive.createAgent()
    ↓
POST /api/agents/instances (Backend)
    ↓
MongoDB: agent_instances (document criado com isDeleted: false)
    ↓
AgentGameComponent.loadAgentsFromBFF() [próximo ciclo ou inicial]
    ↓
GET /api/agents/instances?limit=500
    ↓
Backend filtra: { isDeleted: { $ne: true } }
    ↓
AgentGameComponent.addAgentFromBFF() → adiciona ao array this.agents[]
    ↓
Canvas renderiza agente visualmente
```

### Fluxo de Exclusão Individual (Funcionando Corretamente)

```
Usuário deleta agente
    ↓
ConductorChat.deleteAgentRequested.emit()
    ↓
ScreenplayInteractive.deleteAgent(instanceId)
    ↓
1. this.agentInstances.delete(instanceId) [memória local]
2. DELETE /api/agents/instances/{instanceId} [MongoDB: isDeleted=true]
3. this.agentGame.removeAgent(instanceId) [remove do canvas IMEDIATAMENTE]
    ↓
AgentGameComponent.removeAgent(instanceId)
    ↓
this.agents.splice(index, 1) → remove do array
    ↓
Canvas para de renderizar o agente visualmente
```

**✅ Status**: Este fluxo **FUNCIONA CORRETAMENTE** porque há sincronização explícita com o canvas via `removeAgent()`.

### Fluxo de Exclusão de Roteiro (Problemático)

```
Usuário deleta roteiro
    ↓
ScreenplayManager.deleteScreenplay()
    ↓
DELETE /api/screenplays/{id}
    ↓
Backend: screenplay.isDeleted = true
    ↓
❌ PROBLEMA: Nenhuma lógica deleta ou marca isDeleted nos agentes vinculados
    ↓
MongoDB: agent_instances ainda possuem isDeleted=false mas screenplay_id aponta para roteiro deletado
    ↓
Após 30 segundos (próximo sync):
    ↓
AgentGameComponent.loadAgentsFromBFF()
    ↓
GET /api/agents/instances?limit=500
    ↓
Backend retorna agentes órfãos porque isDeleted ainda é false
    ↓
Canvas continua renderizando agentes órfãos
```

**❌ Status**: Este fluxo **FALHA** porque não há cascade delete ou sincronização entre roteiro e instâncias de agentes.

---

## 💡 Regras de Negócio Identificadas

### Regra 1: Soft Delete para Agentes
- **Descrição**: Agentes não são removidos fisicamente do banco, apenas marcados como deletados
- **Campo**: `isDeleted: boolean`, `deleted_at: string (ISO timestamp)`
- **Implementação**:
  - Backend: `app.py` linha ~1583-1584
  - Frontend: `agent-instance-management.service.ts` linha ~187-190

### Regra 2: Soft Delete para Roteiros
- **Descrição**: Roteiros não são removidos fisicamente do banco, apenas marcados como deletados
- **Campo**: `isDeleted: boolean`
- **Implementação**:
  - Backend: `screenplays.py`
  - Frontend: `screenplay-storage.ts` linha ~226-246

### Regra 3: Filtragem de Deletados por Padrão
- **Descrição**: API retorna apenas agentes não deletados por padrão, a menos que `include_deleted=true` seja passado
- **Implementação**: Backend `app.py` linha ~1558, 1583

### Regra 4: Sincronização Periódica do Canvas
- **Descrição**: Canvas recarrega lista de agentes a cada 30 segundos
- **Implementação**: `agent-game.component.ts` linha ~157, 222

### Regra 5 (AUSENTE - Causa do Bug): Cascade Delete de Agentes ao Deletar Roteiro
- **Descrição esperada**: Quando um roteiro é deletado, todos os agentes vinculados a ele deveriam ser marcados como deletados
- **Implementação**: **NÃO EXISTE**
- **Impacto**: Agentes órfãos permanecem no banco e no canvas indefinidamente

---

## 🎓 Conceitos-Chave

### AgentInstance vs AgentCharacter

- **AgentInstance**: Modelo de dados de negócio (TypeScript interface)
  - Representa a instância de um agente no MongoDB
  - Campos: `id`, `agent_id`, `emoji`, `definition`, `status`, `position`, `isDeleted`, etc.
  - Gerenciado por: `AgentInstanceManagementService`

- **AgentCharacter**: Modelo visual para renderização no canvas (TypeScript interface)
  - Representa um agente como personagem animado no game
  - Campos: `id`, `agentId`, `screenplayId`, `emoji`, `position`, `velocity`, `sprite`, `executionMetrics`, etc.
  - Gerenciado por: `AgentGameComponent`
  - **Relacionamento**: Criado a partir de `AgentInstance` retornado pela API

### Soft Delete vs Hard Delete

- **Soft Delete**: Documento permanece no banco, mas é marcado como `isDeleted: true`
  - **Vantagem**: Dados não são perdidos, podem ser restaurados
  - **Desvantagem**: Requer filtragem em todas as queries

- **Hard Delete**: Documento é removido fisicamente do banco
  - **Vantagem**: Dados são permanentemente removidos
  - **Desvantagem**: Irreversível, perda de dados

O sistema utiliza **Soft Delete** para agentes e roteiros.

### Sincronização Reativa vs Periódica

- **Reativa**: Atualização imediata via eventos ou chamadas explícitas
  - Exemplo: `this.agentGame.removeAgent(instanceId)` após deletar agente individual

- **Periódica**: Atualização em intervalos regulares
  - Exemplo: `setInterval()` a cada 30 segundos no canvas

O sistema utiliza **ambas**:
- Exclusão individual: sincronização **reativa** (funciona bem)
- Carregamento inicial e refresh: sincronização **periódica** (pode deixar dados defasados)

---

## 📌 Observações e Gaps Identificados

### ✅ Gap 1: Cascade Delete em Roteiros - **JÁ IMPLEMENTADO NO BACKEND**
**Descoberta**: Ao analisar o código, identifiquei que o backend **JÁ IMPLEMENTA** cascade delete corretamente.

**Onde está implementado**:
- Backend: `ScreenplayService.delete_screenplay()` em `screenplay_service.py:636-648`
- Lógica: `update_many({"screenplay_id": screenplay_id}, {"$set": {"isDeleted": True}})`

**Status**: ✅ Funcionalidade corretamente implementada no backend

**Observação**: Este gap foi inicialmente identificado como ausente, mas a análise completa do código revelou que existe e funciona corretamente.

### ❌ Gap 2 (CRÍTICO): Falta de Sincronização Imediata do Canvas ao Deletar Roteiro
**Problema**: Ao deletar um roteiro, o canvas não é notificado imediatamente. Ele só perceberá a mudança no próximo ciclo de 30 segundos.

**Onde ocorre**:
- `screenplay-manager.ts:324` → emite evento `action: 'delete'`, mas não há listener que sincronize o canvas
- `agent-game.component.ts` → não escuta eventos de exclusão de roteiro

**Impacto**: Usuário vê agentes no canvas por até 30 segundos após deletar roteiro, **causando confusão e aparência de bug**.

**Status**: ❌ Este é o gap crítico que causa o problema reportado

**Soluções possíveis**:
1. Adicionar listener no `ScreenplayManager` que chame `this.agentGame.loadAgentsFromBFF()` imediatamente após deletar roteiro
2. Emitir evento que o `AgentGameComponent` escute para forçar reload
3. Chamar `clearAllAgents()` para limpar canvas e esperar próximo sync recarregar automaticamente

### ⚠️ Gap 3: Ausência de Parâmetro `include_deleted=false` Explícito no Frontend
**Problema**: Embora o backend aceite o parâmetro `include_deleted` e use `false` como padrão, o frontend não o passa explicitamente.

**Onde ocorre**: `agent-game.component.ts:644` → `${baseUrl}/agents/instances?limit=500`

**Impacto**: Dependência implícita do comportamento padrão do backend. Se o backend mudar o padrão, o frontend quebrará silenciosamente.

**Status**: ⚠️ Não causa problema atualmente, mas é fragilidade no código

**Recomendação**: Passar explicitamente `include_deleted=false` para tornar a intenção clara e evitar bugs futuros.

### ✅ Gap 4: Filtragem por Screenplay Deletado - **NÃO É NECESSÁRIO**
**Análise inicial incorreta**: Pensei que seria necessário filtrar agentes cujo `screenplay_id` aponta para roteiro deletado.

**Descoberta**: Como o backend **JÁ marca agentes como deletados via cascade delete**, a filtragem por `isDeleted` já resolve o problema.

**Status**: ✅ Não é necessário implementar lógica adicional de filtragem

**Conclusão**: A implementação atual do backend é suficiente. O único problema real é a latência visual no frontend (Gap 2).

---

## 🎯 Resumo Executivo: Causa Raiz do Bug

O problema relatado ("a quantidade de agentes instanciados não diminui quando um roteiro é excluído ou quando um agente é excluído") tem **análise em dois cenários**:

### ✅ Caso 1: Exclusão de Agente Individual - **FUNCIONA PERFEITAMENTE**
- **Sintoma**: Agente some do canvas imediatamente após exclusão
- **Por quê funciona**: `ScreenplayInteractive.deleteAgent()` chama explicitamente `this.agentGame.removeAgent(instanceId)` (linha 730)
- **Fluxo completo**:
  1. DELETE `/api/agents/instances/{instance_id}` marca `isDeleted=true` no MongoDB
  2. Frontend remove do array local `this.agents[]` imediatamente
  3. Canvas para de renderizar o agente instantaneamente
- **Conclusão**: ✅ Sem problemas neste fluxo

### ⚠️ Caso 2: Exclusão de Roteiro - **BACKEND IMPLEMENTADO, MAS FRONTEND NÃO SINCRONIZA**

#### **Descoberta Importante: Backend JÁ IMPLEMENTA Cascade Delete**

Ao analisar o código-fonte, **descobri que o backend JÁ possui lógica de cascade delete**:

**Arquivo**: `conductor-gateway/src/services/screenplay_service.py:636-648`

```python
# Mark all related agent_instances as deleted
instances_result = self.agent_instances.update_many(
    {"screenplay_id": screenplay_id, "isDeleted": {"$ne": True}},
    {"$set": {"isDeleted": True, "updated_at": datetime.now(UTC).isoformat()}}
)
```

**Isso significa que:**
1. ✅ Quando um roteiro é deletado, **todos os agentes vinculados SÃO marcados como `isDeleted=true` no MongoDB**
2. ✅ Na próxima chamada da API GET `/api/agents/instances`, esses agentes **NÃO serão retornados** (filtro `isDeleted: {$ne: true}`)
3. ⚠️ **MAS**: O canvas só recarrega a cada 30 segundos (sincronização periódica)
4. ❌ **PROBLEMA REAL**: Frontend **não possui sincronização imediata** ao deletar roteiro

#### **Causa Raiz Atualizada: Falta de Sincronização Frontend**

**O problema NÃO é no backend, mas sim na UI:**

- **Backend**: ✅ Cascade delete implementado corretamente
- **Frontend**: ❌ Canvas não é notificado imediatamente quando roteiro é deletado
- **Resultado**: Agente desaparece após até **30 segundos** (próximo ciclo de `loadAgentsFromBFF()`)

**Fluxo atual (problemático apenas na latência visual):**
```
Usuário deleta roteiro
    ↓
DELETE /screenplays/{id} → Backend marca roteiro e agentes como isDeleted=true ✅
    ↓
❌ Frontend NÃO notifica o canvas imediatamente
    ↓
⏱️ Aguarda até 30 segundos (próximo sync periódico)
    ↓
Canvas chama loadAgentsFromBFF() → GET /api/agents/instances
    ↓
Backend retorna apenas agentes NÃO deletados ✅
    ↓
Canvas é reconstruído sem os agentes deletados ✅
```

**Soluções possíveis** (não implementadas neste documento de análise):
1. **Frontend (Recomendado)**: Adicionar listener de exclusão de roteiro que chame `clearAllAgents()` ou force `loadAgentsFromBFF()` imediatamente
2. **Frontend (Alternativa)**: Filtrar localmente agentes cujo `screenplay_id` corresponde ao roteiro deletado
3. **Melhoria UX**: Adicionar indicador visual durante os 30 segundos até o próximo sync

---

## 🔍 Arquivos Relevantes Analisados

### Frontend (Angular)
- `src/app/living-screenplay-simple/agent-game/agent-game.component.ts` (2280 linhas)
- `src/app/living-screenplay-simple/agent-game/agent-game.component.html` (330 linhas)
- `src/app/living-screenplay-simple/screenplay-interactive.ts` (linha 708-759)
- `src/app/living-screenplay-simple/screenplay-manager/screenplay-manager.ts` (linha 309-332)
- `src/app/services/screenplay-storage.ts` (linha 226-246)
- `src/app/services/agent-instance-management.service.ts` (447 linhas)
- `src/app/shared/conductor-chat/conductor-chat.component.ts` (linha 1838, 2864)

### Backend (Python)
- `conductor-gateway/src/api/app.py` (linha 1551-1617: endpoint GET /api/agents/instances)
- `conductor-gateway/src/api/routers/screenplays.py` (rota DELETE screenplay)
- `conductor-gateway/src/services/screenplay_service.py`

### Modelos de Dados
- **MongoDB Collections**:
  - `agent_instances`: Armazena instâncias de agentes
    - Campos: `instance_id`, `agent_id`, `screenplay_id`, `emoji`, `definition`, `status`, `isDeleted`, `deleted_at`
  - `screenplays`: Armazena roteiros
    - Campos: `id`, `name`, `content`, `isDeleted`, `updated_at`

---

**Documento gerado em**: 2025-11-07
**Versão**: 1.0
**Status**: Análise completa - Não inclui implementação de soluções
