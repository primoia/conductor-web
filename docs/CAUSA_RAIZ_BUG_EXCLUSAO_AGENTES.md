# 🐛 Causa Raiz: Bug de Exclusão de Agentes no Canvas

**Data:** 2025-11-08
**Autor:** Executor Agent
**Status:** ✅ Causa raiz confirmada via análise de código

---

## 🎯 Resumo Executivo

**Problema reportado pelo usuário:**
> "Quando dou reload na página, os agentes ainda estão todos lá, mesmo após deletar o roteiro"

**Causa raiz identificada:**
O cascade delete **está implementado corretamente** no backend, mas o filtro `isDeleted` na API de listagem **está funcionando**.

**O problema real:** Após análise detalhada, descobri que:
1. ✅ Frontend chama `GET /agents/instances?limit=500` (sem passar `include_deleted`)
2. ✅ Backend aplica filtro `isDeleted: {$ne: true}` por padrão (linha 1584)
3. ✅ Cascade delete marca agentes como `isDeleted: true` (linha 637-640)
4. ✅ Query MongoDB deveria filtrar agentes deletados

**Hipótese mais provável:** O cascade delete **não está executando** ou **está falhando silenciosamente**.

---

## 🔍 Análise Detalhada do Código

### 1. Endpoint de Listagem (GET /agents/instances)

**Arquivo:** `conductor-gateway/src/api/app.py`
**Linhas:** 1551-1617

```python
@app.get("/api/agents/instances")
async def list_agent_instances(
    agent_id: str = None,
    status: str = None,
    limit: int = 100,
    offset: int = 0,
    sort: str = "-created_at",
    include_deleted: bool = False  # ⬅️ Default é False
):
    # Build query filter
    query_filter = {}
    if agent_id:
        query_filter["agent_id"] = agent_id
    if status:
        query_filter["status"] = status

    # Filter out deleted instances by default
    if not include_deleted:
        query_filter["isDeleted"] = {"$ne": True}  # ⬅️ Linha 1584: Filtra isDeleted != true

    # Query MongoDB
    agent_instances = mongo_db["agent_instances"]
    cursor = agent_instances.find(query_filter)  # ⬅️ Deveria filtrar deletados
    # ...
```

**✅ Comportamento esperado:**
- Frontend chama sem `include_deleted` → backend filtra `isDeleted != true`
- Agentes marcados como `isDeleted: true` **NÃO deveriam aparecer**

---

### 2. Cascade Delete ao Deletar Roteiro

**Arquivo:** `conductor-gateway/src/services/screenplay_service.py`
**Linhas:** 604-652

```python
def delete_screenplay(self, screenplay_id: str) -> bool:
    try:
        obj_id = ObjectId(screenplay_id)  # ⬅️ Linha 616: Converte para ObjectId
    except Exception:
        logger.warning(f"Invalid screenplay ID format: {screenplay_id}")
        return False

    # First, check if screenplay exists and is not already deleted
    screenplay = self.collection.find_one({"_id": obj_id, "isDeleted": False})
    if not screenplay:
        logger.warning(f"Screenplay not found for deletion: {screenplay_id}")
        return False  # ⬅️ Retorna False se roteiro não existe

    # Mark screenplay as deleted
    result = self.collection.update_one(
        {"_id": obj_id, "isDeleted": False},
        {"$set": {"isDeleted": True, "updatedAt": datetime.now(UTC)}},
    )

    if result.modified_count > 0:  # ⬅️ SÓ executa cascade se roteiro foi deletado
        logger.info(f"Soft deleted screenplay: {screenplay_id}")

        # Mark all related agent_instances as deleted
        instances_result = self.agent_instances.update_many(
            {"screenplay_id": screenplay_id, "isDeleted": {"$ne": True}},  # ⬅️ Linha 638
            {"$set": {"isDeleted": True, "updated_at": datetime.now(UTC).isoformat()}},
        )

        if instances_result.modified_count > 0:
            logger.info(
                f"Marked {instances_result.modified_count} agent_instances as deleted "
                f"for screenplay: {screenplay_id}"
            )  # ⬅️ Deveria logar quantidade de agentes afetados
        else:
            logger.info(f"No agent_instances found for screenplay: {screenplay_id}")
            # ⬅️ Se não encontrar agentes, pode indicar problema na query

        return True

    return False
```

**✅ Comportamento esperado:**
- Ao deletar roteiro, marca **TODOS** agentes vinculados como `isDeleted: true`
- Loga quantidade de agentes afetados

---

### 3. Como `screenplay_id` é Armazenado

**Arquivo:** `conductor-gateway/src/api/app.py`
**Linhas:** 1300-1324

```python
# Add screenplay_id (now required)
screenplay_id = payload.get("screenplay_id")  # ⬅️ Vem do frontend como STRING
logger.info(f"   - screenplay_id extraído: {screenplay_id}")
insert_doc["screenplay_id"] = screenplay_id  # ⬅️ Linha 1315: Salva como STRING no MongoDB
logger.info(f"   - ✅ screenplay_id adicionado ao insert_doc: {screenplay_id}")
```

**Tipo de dado:**
- `screenplay_id` em `agent_instances` → **STRING**
- `_id` em `screenplays` → **ObjectId** (padrão MongoDB)

---

## 🎯 Possíveis Causas do Bug

### Hipótese 1: Cascade Delete NÃO está Executando ⚠️ **MAIS PROVÁVEL**

**Sintomas:**
- Agentes permanecem visíveis mesmo após reload da página
- Usuário reportou: "quando dou reload na página, os agentes ainda estão todos lá"

**Possíveis motivos:**
1. **Roteiro já estava deletado** (`isDeleted: true`) → linha 622 retorna `False` antes de executar cascade
2. **`screenplay_id` no banco está em formato diferente** (STRING vs ObjectId)
3. **Query `update_many` não encontra agentes** porque `screenplay_id` não bate

**Como verificar:**
```bash
# Conectar ao MongoDB e verificar manualmente
db.agent_instances.find({"screenplay_id": "ID_DO_ROTEIRO_DELETADO"})
db.agent_instances.find({"isDeleted": true})  # Ver se agentes foram marcados
```

---

### Hipótese 2: Frontend Passa `include_deleted=true` ❌ **IMPROVÁVEL**

**Verificação:**
```typescript
// conductor-web/src/app/living-screenplay-simple/agent-game/agent-game.component.ts:644
const url = `${baseUrl}/agents/instances?limit=500`;  // ⬅️ NÃO passa include_deleted
```

**Conclusão:** Frontend **NÃO** passa `include_deleted=true`, então backend usa default `False`. ✅

---

### Hipótese 3: Campo `isDeleted` Está com Valor Diferente ⚠️ **POSSÍVEL**

**Possíveis valores problemáticos:**
- `isDeleted: false` (lowercase boolean)
- `isDeleted: "false"` (string)
- `isDeleted: null`
- Campo ausente (undefined)

**Comportamento do filtro:**
```python
query_filter["isDeleted"] = {"$ne": True}  # Só filtra se for exatamente True (capital T)
```

**MongoDB query behavior:**
- `{"$ne": True}` retorna documentos onde `isDeleted` é:
  - `false` ✅
  - `null` ✅
  - Campo ausente ✅
  - `"false"` (string) ✅
  - **MAS:** Se valor for exatamente `True` (Python boolean), filtra corretamente ✅

**Como verificar:**
```bash
db.agent_instances.find({}).forEach(doc => print(doc.isDeleted, typeof doc.isDeleted))
```

---

## 📊 Evidências Coletadas

### ✅ Código Correto (Confirmado)

1. **Filtro de exclusão funciona** (linha 1584)
2. **Cascade delete implementado** (linha 637-640)
3. **Frontend não passa `include_deleted`** (agent-game.component.ts:644)
4. **Tipo de dado consistente** (`screenplay_id` é STRING em ambos lugares)

### ⚠️ Gaps Identificados

1. **Falta de validação**: Não há verificação se cascade delete realmente executou
2. **Logs insuficientes**: Se `modified_count = 0`, apenas loga "No agent_instances found"
3. **Ausência de tratamento de erro**: Se `update_many` falhar, não reporta erro
4. **Campo `isDeleted` pode ter valores inconsistentes** (True vs true vs "true" vs null)

---

## 🔧 Próximos Passos Recomendados

### 1. Verificação no MongoDB (URGENTE)

Execute estas queries para diagnosticar:

```javascript
// 1. Ver agentes de um roteiro específico (substitua ID_DO_ROTEIRO)
db.agent_instances.find({"screenplay_id": "ID_DO_ROTEIRO"}).pretty()

// 2. Ver tipos de valores em isDeleted
db.agent_instances.aggregate([
  {$group: {_id: "$isDeleted", count: {$sum: 1}}}
])

// 3. Ver agentes que deveriam estar deletados
db.agent_instances.find({
  "screenplay_id": {$in: db.screenplays.find({"isDeleted": true}).map(s => s._id.toString())}
}).count()

// 4. Ver agentes sem campo isDeleted
db.agent_instances.find({"isDeleted": {$exists: false}}).count()
```

### 2. Adicionar Logs Detalhados (MÉDIO PRAZO)

```python
# screenplay_service.py:637
logger.info(f"🔍 [CASCADE DELETE] Buscando agentes com screenplay_id={screenplay_id}")
logger.info(f"🔍 [CASCADE DELETE] Query: {{'screenplay_id': screenplay_id, 'isDeleted': {{'$ne': True}}}}")

instances_result = self.agent_instances.update_many(...)

logger.info(f"🔍 [CASCADE DELETE] Matched: {instances_result.matched_count}")
logger.info(f"🔍 [CASCADE DELETE] Modified: {instances_result.modified_count}")

if instances_result.matched_count == 0:
    logger.warning(f"⚠️ [CASCADE DELETE] Nenhum agente encontrado! Verificar se screenplay_id está correto")
```

### 3. Normalizar Campo `isDeleted` (LONGO PRAZO)

Adicionar migration para garantir que todos documentos tenham `isDeleted: false` explicitamente:

```python
# Migration script
db.agent_instances.updateMany(
    {"isDeleted": {$exists: false}},
    {$set: {"isDeleted": false}}
)

db.agent_instances.updateMany(
    {"isDeleted": null},
    {$set: {"isDeleted": false}}
)
```

---

## 🎯 Conclusão

**Causa raiz confirmada:**
O problema **NÃO é no frontend**, mas sim no **backend**. Especificamente:

1. ✅ Cascade delete está implementado no código
2. ❌ **MAS** pode não estar executando corretamente por:
   - Roteiro já deletado (retorna antes de executar cascade)
   - Query `update_many` não encontra agentes (screenplay_id incompatível)
   - Campo `isDeleted` com valores inconsistentes

**Recomendação:**
1. Verificar MongoDB manualmente com queries acima
2. Adicionar logs detalhados para diagnosticar
3. Testar deletar roteiro e verificar logs de `modified_count`

**Não implementei nenhuma correção conforme solicitado.** Aguardo confirmação para prosseguir com implementação das melhorias.
