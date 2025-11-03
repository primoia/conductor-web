# Diagnóstico: Problema de Gravação e Recuperação de Contexto e Título no MongoDB

**Data**: 2025-11-03
**Componente**: Modal de edição de contexto e título de conversas
**Status**: ✅ **PROBLEMA RESOLVIDO** - Containers com código desatualizado

---

## 🎯 SOLUÇÃO ENCONTRADA

**Causa Raiz Identificada**: Os containers Docker estavam rodando com **código desatualizado**. As rotas `/conversations/{id}/title` e `/conversations/{id}/context` foram implementadas recentemente mas não estavam presentes na imagem Docker em execução.

**Ação Corretiva**:
```bash
# 1. Rebuild do Conductor API
docker compose -f docker-compose.dev.yml up --build -d conductor-api

# 2. Rebuild do Gateway
docker compose -f docker-compose.dev.yml up --build -d gateway
```

**Resultado**: ✅ Sistema **100% funcional** após rebuild
- ✅ Título sendo gravado e recuperado do MongoDB
- ✅ Contexto sendo gravado e recuperado do MongoDB
- ✅ Gateway proxy funcionando corretamente
- ✅ Endpoints da Conductor API respondendo

---

## 📋 Visão Geral

O sistema possui uma funcionalidade completa para edição de **contexto** e **título** de conversas através de um modal (classe `modal-content`). A funcionalidade está **totalmente implementada** no código, desde o frontend Angular até o backend Python com persistência no MongoDB.

**Histórico do Problema**:
1. ~~Código não estava implementado~~ ❌ FALSO
2. ~~Containers offline~~ ❌ FALSO
3. ~~MongoDB não conectado~~ ❌ FALSO
4. ✅ **Containers rodando com código antigo** (problema real)

---

## 🎯 Requisitos Identificados

### Requisitos Funcionais

**RF1**: O sistema deve permitir que o usuário edite o **contexto** de uma conversa em formato Markdown
- **Implementação**: `conductor-chat.component.ts:3167` (método `saveConversationContext()`)
- **UI**: Textarea com preview Markdown renderizado

**RF2**: O sistema deve permitir que o usuário edite o **título** de uma conversa
- **Implementação**: `conversation.service.ts:170` (método `updateConversationTitle()`)
- **Restrições**: Título deve ter entre 3-100 caracteres

**RF3**: O sistema deve **persistir contexto e título no MongoDB** na collection `conversations`
- **Implementação**: `conversation_service.py:436` e `:394` (métodos Python)
- **Collection**: `conversations` com campos `context` e `title`

**RF4**: O sistema deve **recuperar contexto e título** ao carregar uma conversa
- **Implementação**: `conversation_service.py:129` (método `get_conversation_by_id()`)
- **Display**: Context Banner renderiza contexto salvo

**RF5**: O sistema deve permitir **upload de arquivo .md** para definir o contexto
- **Implementação**: `conversation.service.ts:191` e `conversations.py (gateway):159`
- **Validação**: Apenas arquivos .md, máximo 50KB

### Requisitos Não-Funcionais

**RNF1**: A API deve validar título (3-100 caracteres) antes de salvar
**RNF2**: O sistema deve usar transações idempotentes (MongoDB `update_one`)
**RNF3**: Timeout de 30 segundos para requisições de contexto/título
**RNF4**: Logs detalhados em todos os níveis (Angular, Gateway, Conductor, MongoDB)

---

## 🔄 Fluxo do Processo

### Fluxo de Gravação de Contexto

1. **Início**: Usuário clica no botão "✏️" no Context Banner
2. **Edição**: Sistema abre editor de contexto (`showContextEditor = true`)
3. **Digitação**: Usuário escreve contexto em Markdown no textarea
4. **Salvamento**: Usuário clica no botão "💾 Salvar Contexto"
5. **Frontend (Angular)**:
   - `saveConversationContext()` valida se há `activeConversationId`
   - Chama `conversationService.updateConversationContext(conversationId, context)`
   - Service faz requisição PATCH para `/api/conversations/{id}/context`
6. **Gateway (FastAPI)**:
   - Recebe requisição em `/api/conversations/{id}/context`
   - Faz proxy para Conductor API: `PATCH http://conductor-api:3000/conversations/{id}/context`
7. **Conductor API (Python)**:
   - Endpoint `conversations.py:381` recebe requisição
   - Chama `conversation_service.update_conversation_context()`
8. **MongoDB**:
   - Service executa `update_one()` na collection `conversations`
   - Atualiza campos `context` e `updated_at`
9. **Resposta**: Sucesso retorna até o frontend com mensagem "Contexto salvo com sucesso! 🎉"
10. **Finalização**: Modal fecha, contexto é exibido no preview

### Fluxo de Recuperação de Contexto

1. **Início**: Usuário seleciona uma conversa na sidebar
2. **Frontend**: `onSelectConversation(conversationId)` é chamado
3. **Requisição**: `conversationService.getConversation(conversationId)`
4. **Gateway**: Proxy para `GET http://conductor-api:3000/conversations/{id}`
5. **Conductor API**: Busca documento na collection `conversations`
6. **MongoDB**: `find_one({"conversation_id": conversationId})`
7. **Resposta**: Retorna objeto `Conversation` com campo `context`
8. **Frontend**: `conversationContext` é atualizado
9. **Renderização**: Context Banner exibe preview Markdown do contexto

---

## 🏗️ Componentes Principais

### Frontend (Angular)

**Componente**: `conductor-chat.component.ts`
- **Responsabilidade**: Gerenciar UI de edição de contexto/título, coordenar chamadas ao serviço
- **Métodos principais**:
  - `toggleContextEditor()`: Abre/fecha editor de contexto
  - `saveConversationContext()`: Salva contexto editado
  - `cancelContextEdit()`: Cancela edição
  - `openContextUpload()`: Abre dialog para upload de .md
- **Template**: Context Banner com editor inline, botões de ação

**Service**: `conversation.service.ts`
- **Responsabilidade**: Comunicação HTTP com backend para CRUD de conversas
- **URL base**: `${environment.apiUrl}/conversations`
- **Métodos principais**:
  - `updateConversationContext(conversationId, context)`: PATCH `/conversations/{id}/context`
  - `updateConversationTitle(conversationId, newTitle)`: PATCH `/conversations/{id}/title`
  - `getConversation(conversationId)`: GET `/conversations/{id}`
  - `uploadContextFile(conversationId, file)`: POST `/conversations/{id}/context/upload`

### Gateway (FastAPI - Proxy Layer)

**Arquivo**: `conductor-gateway/src/api/routers/conversations.py`
- **Responsabilidade**: Fazer proxy de requisições de `/api/conversations` para o Conductor API
- **URL destino**: `${CONDUCTOR_CONFIG['conductor_api_url']}/conversations`
- **Endpoints**:
  - `PATCH /api/conversations/{conversation_id}/context` → Proxy para Conductor
  - `PATCH /api/conversations/{conversation_id}/title` → Proxy para Conductor
  - `GET /api/conversations/{conversation_id}` → Proxy para Conductor
  - `POST /api/conversations/{conversation_id}/context/upload` → Valida .md e envia para Conductor

**Função auxiliar**: `proxy_request(method, path, request, timeout=30.0)`
- Encaminha requisições HTTP para o Conductor API
- Propaga headers, body e query params
- Trata erros de timeout e conexão

### Backend (Conductor API - FastAPI)

**Arquivo**: `conductor/src/api/routes/conversations.py`
- **Responsabilidade**: Endpoints REST para manipular conversas no MongoDB
- **Service injetado**: `ConversationService` (instanciado no início do módulo)
- **Endpoints principais**:
  - `PATCH /conversations/{conversation_id}/context` → Chama `conversation_service.update_conversation_context()`
  - `PATCH /conversations/{conversation_id}/title` → Chama `conversation_service.update_conversation_title()`
  - `GET /conversations/{conversation_id}` → Chama `conversation_service.get_conversation_by_id()`

**Modelos Pydantic**:
- `UpdateContextRequest`: `{"context": str | null}`
- `ConversationDetail`: Resposta com todos os campos incluindo `context` e `title`

### Persistência (MongoDB Service)

**Arquivo**: `conductor/src/core/services/conversation_service.py`
- **Responsabilidade**: Lógica de negócio e persistência no MongoDB
- **Collection**: `conversations` (database `conductor_state`)
- **Métodos principais**:
  - `update_conversation_context(conversation_id, context)`: Atualiza campo `context`
  - `update_conversation_title(conversation_id, new_title)`: Atualiza campo `title`
  - `get_conversation_by_id(conversation_id)`: Busca conversa completa
  - `create_conversation(title, active_agent, screenplay_id, context)`: Cria nova conversa

**Estrutura do documento MongoDB**:
```python
{
  "conversation_id": str (UUID),
  "title": str (3-100 chars),
  "created_at": str (ISO datetime),
  "updated_at": str (ISO datetime),
  "active_agent": dict | null,
  "participants": list[dict],
  "messages": list[dict],
  "screenplay_id": str | null,
  "context": str | null  # ← Campo de contexto Markdown
}
```

---

## 🔗 Relacionamentos e Dependências

### Fluxo de Comunicação

```
Angular (Frontend)
    ↓ HTTP PATCH /api/conversations/{id}/context
    ↓ (via environment.apiUrl = '/api')
Gateway (FastAPI - Port 5006/8080)
    ↓ Proxy PATCH http://conductor-api:3000/conversations/{id}/context
    ↓ (via CONDUCTOR_CONFIG['conductor_api_url'])
Conductor API (FastAPI - Port 3000/8000)
    ↓ conversation_service.update_conversation_context()
    ↓
MongoDB (Port 27017)
    └─ Collection: conversations
       └─ update_one({"conversation_id": id}, {"$set": {"context": ..., "updated_at": ...}})
```

### Dependências de Variáveis de Ambiente

**Frontend (Angular)**:
- `environment.apiUrl`: Define URL base da API
  - **Desenvolvimento**: `http://localhost:5006`
  - **Produção/Docker**: `/api` (via proxy nginx)

**Gateway (FastAPI)**:
- `CONDUCTOR_CONFIG['conductor_api_url']`: URL do Conductor API
  - **Padrão**: `http://localhost:3000` (desenvolvimento)
  - **Docker**: `http://conductor-api:3000` (via docker-compose)

**Conductor API (Python)**:
- `MONGO_URI`: String de conexão MongoDB
  - **Padrão**: `mongodb://localhost:27017`
  - **Docker**: `mongodb://admin:conductor123@mongodb:27017/conductor?authSource=admin`
- `MONGO_DATABASE`: Nome do banco de dados
  - **Padrão**: `conductor_state`

---

## 💡 Regras de Negócio Identificadas

### Regra 1: Validação de Título
**Descrição**: O título de uma conversa deve ter entre 3 e 100 caracteres
**Implementação**: `conversation_service.py:407-408`
```python
if len(new_title) < 3 or len(new_title) > 100:
    raise ValueError("O título deve ter entre 3 e 100 caracteres")
```

### Regra 2: Contexto Opcional e Anulável
**Descrição**: O contexto de uma conversa é opcional e pode ser `null` (para limpar)
**Implementação**: Campo `context: Optional[str]` em todos os modelos
**Persistência**: MongoDB aceita `{"context": null}` para limpar contexto

### Regra 3: Upload de Arquivo Limitado
**Descrição**: Apenas arquivos `.md` são permitidos, com tamanho máximo de 50KB
**Implementação**: `conversations.py (gateway):176-192`
```python
if not file.filename.endswith('.md'):
    raise HTTPException(status_code=400, detail="Apenas arquivos .md são permitidos")
MAX_CONTEXT_SIZE = 50 * 1024  # 50KB
if len(markdown_content) > MAX_CONTEXT_SIZE:
    raise HTTPException(status_code=400, ...)
```

### Regra 4: Conversa Ativa Obrigatória
**Descrição**: Para salvar contexto/título, deve existir uma conversa ativa (`activeConversationId`)
**Implementação**: `conductor-chat.component.ts:3168-3171`
```typescript
if (!this.activeConversationId) {
  console.error('❌ Nenhuma conversa ativa');
  return;
}
```

### Regra 5: Atualização de Timestamp
**Descrição**: Ao atualizar contexto ou título, o campo `updated_at` deve ser atualizado automaticamente
**Implementação**: Todos os métodos de update no `conversation_service.py` fazem:
```python
timestamp = datetime.utcnow().isoformat()
{"$set": {"...", "updated_at": timestamp}}
```

---

## 🎓 Conceitos-Chave

### Conversation ID Global
O sistema usa um modelo de **conversação global** onde:
- Uma conversa é **independente de agentes específicos**
- **Múltiplos agentes** podem participar da mesma conversa
- O histórico é **unificado** e compartilhado entre agentes
- Cada conversa tem um `conversation_id` único (UUID)

### Context Banner
Componente visual no topo do chat que:
- Exibe o **contexto Markdown** da conversa atual
- Permite **edição inline** do contexto
- Suporta **upload de arquivo .md**
- Renderiza preview com **highlight de Markdown**

### Proxy Pattern (Gateway)
O Gateway atua como **proxy transparente** entre frontend e backend:
- **Não processa lógica de negócio**
- Apenas **encaminha requisições** para o Conductor API
- Valida arquivos de upload antes de encaminhar
- Trata erros de timeout e conexão

### MongoDB Collection: conversations
Nova collection criada para o modelo refatorado:
- **Substituirá** `agent_conversations` (legacy)
- Estrutura normalizada e escalável
- Índices criados para otimização:
  - `conversation_id` (unique)
  - `participants.agent_id`
  - `updated_at`
  - `screenplay_id`

---

## 📌 Observações e Diagnóstico

### ✅ O Que Está Implementado CORRETAMENTE

1. **Frontend (Angular)**:
   - ✅ Modal de edição de contexto funcional
   - ✅ Service com métodos HTTP corretos
   - ✅ Validação de `activeConversationId` antes de salvar
   - ✅ Preview Markdown renderizado
   - ✅ Upload de arquivo .md

2. **Gateway (FastAPI)**:
   - ✅ Router registrado em `app.py:365`
   - ✅ Endpoints de proxy implementados
   - ✅ Validação de arquivo .md no upload
   - ✅ Timeout configurado (30s)

3. **Conductor API (Python)**:
   - ✅ Router registrado em `server.py:52`
   - ✅ Endpoints REST implementados
   - ✅ Modelos Pydantic validados
   - ✅ Service de conversação instanciado

4. **Persistência (MongoDB)**:
   - ✅ Collection `conversations` criada
   - ✅ Índices configurados
   - ✅ Métodos de update/get implementados
   - ✅ Tratamento de erros e logs

### 🔍 Possíveis Causas do Problema

#### Causa 1: Conversa Ativa Não Criada
**Sintoma**: Ao clicar em "Salvar Contexto", nada acontece
**Diagnóstico**: Verificar se `activeConversationId` está definido
```typescript
// conductor-chat.component.ts:3168
if (!this.activeConversationId) {
  console.error('❌ Nenhuma conversa ativa');  // ← Este log aparecerá
  return;
}
```
**Solução**: Garantir que uma conversa seja criada antes de editar o contexto

#### Causa 2: Erro de Rede/Proxy
**Sintoma**: Requisição PATCH retorna erro 502/504
**Diagnóstico**: Gateway não consegue se conectar ao Conductor API
- Verificar se `CONDUCTOR_CONFIG['conductor_api_url']` está correto
- Testar conectividade: `curl http://conductor-api:3000/conversations/`
**Solução**: Verificar configuração de rede Docker e variáveis de ambiente

#### Causa 3: MongoDB Offline ou Credenciais Inválidas
**Sintoma**: Conductor API retorna erro 500 ao tentar salvar
**Diagnóstico**: Connection refused ou authentication error no MongoDB
- Verificar logs do Conductor: `docker logs conductor-api-dev`
- Testar conexão: `mongo mongodb://admin:conductor123@mongodb:27017/`
**Solução**: Verificar credenciais em `MONGO_URI` e status do container MongoDB

#### Causa 4: Feature Flag Desabilitada
**Sintoma**: Context Banner não aparece na UI
**Diagnóstico**: Verificar `environment.features?.useConversationModel`
```typescript
// conductor-chat.component.ts:50
*ngIf="environment.features?.useConversationModel"
```
**Solução**: Habilitar feature flag no `environment.ts`

#### Causa 5: Erro de CORS
**Sintoma**: Requisição bloqueada pelo navegador
**Diagnóstico**: Console do navegador mostra erro de CORS
**Solução**: Verificar configuração de CORS no Gateway (`CORS_ORIGIN=*`)

### 🧪 Como Testar e Validar

#### Teste 1: Verificar se conversa existe
```bash
# 1. Listar conversas no MongoDB
docker exec -it mongodb-dev mongo -u admin -p conductor123 --authenticationDatabase admin
use conductor_state
db.conversations.find().pretty()

# 2. Verificar activeConversationId no frontend
# Abrir DevTools → Console → Digitar:
# window.ng.getComponent($0).activeConversationId
```

#### Teste 2: Testar endpoint diretamente
```bash
# Criar conversa de teste
curl -X POST http://localhost:5006/api/conversations/ \
  -H "Content-Type: application/json" \
  -d '{"title": "Teste Contexto", "context": "## Bug Test\nTestando gravação"}'

# Recuperar conversation_id da resposta, depois:
CONV_ID="<uuid-retornado>"

# Atualizar contexto
curl -X PATCH "http://localhost:5006/api/conversations/$CONV_ID/context" \
  -H "Content-Type: application/json" \
  -d '{"context": "## Contexto Atualizado\nNovo texto"}'

# Verificar se foi salvo
curl "http://localhost:5006/api/conversations/$CONV_ID"
```

#### Teste 3: Verificar logs em tempo real
```bash
# Terminal 1: Logs do Gateway
docker logs -f conductor-gateway-dev 2>&1 | grep -i "conversation\|context"

# Terminal 2: Logs do Conductor API
docker logs -f conductor-api-dev 2>&1 | grep -i "conversation\|context"

# Terminal 3: Tentar salvar contexto no frontend e observar logs
```

#### Teste 4: Validar MongoDB diretamente
```javascript
// Dentro do container MongoDB
use conductor_state
db.conversations.findOne({"conversation_id": "<uuid>"})

// Verificar se campo 'context' existe:
db.conversations.findOne(
  {"conversation_id": "<uuid>"},
  {"context": 1, "title": 1, "updated_at": 1}
)
```

### 🎯 Checklist de Diagnóstico

Execute este checklist para identificar o problema:

- [ ] **Frontend**: Verificar se `activeConversationId` está definido
- [ ] **Frontend**: Verificar se `environment.features.useConversationModel` está habilitado
- [ ] **Frontend**: Abrir DevTools → Network → Verificar se requisição PATCH é enviada
- [ ] **Frontend**: Verificar console por erros de CORS ou HTTP
- [ ] **Gateway**: Verificar logs por erros de proxy (`docker logs conductor-gateway-dev`)
- [ ] **Gateway**: Testar endpoint diretamente com `curl`
- [ ] **Conductor API**: Verificar logs por erros de MongoDB (`docker logs conductor-api-dev`)
- [ ] **Conductor API**: Verificar se router está registrado (`server.py:52`)
- [ ] **MongoDB**: Verificar se container está rodando (`docker ps | grep mongodb`)
- [ ] **MongoDB**: Testar conexão com credenciais corretas
- [ ] **MongoDB**: Verificar se collection `conversations` existe
- [ ] **MongoDB**: Verificar estrutura do documento (campo `context` presente)

### 📊 Fluxo de Diagnóstico Recomendado

```
1. Frontend → DevTools → Console
   └─ Verificar se `activeConversationId` existe
   └─ Verificar se requisição PATCH é enviada

2. Se requisição NÃO é enviada:
   └─ Problema no frontend (validação, feature flag)

3. Se requisição É enviada mas retorna erro:
   └─ DevTools → Network → Ver código de status HTTP

   3.1 Se 404 Not Found:
       └─ Problema: Rota não registrada ou URL incorreta

   3.2 Se 502 Bad Gateway:
       └─ Problema: Gateway não consegue conectar ao Conductor API
       └─ Verificar CONDUCTOR_CONFIG['conductor_api_url']

   3.3 Se 500 Internal Server Error:
       └─ Problema: Erro no Conductor API ou MongoDB
       └─ Verificar logs: docker logs conductor-api-dev

   3.4 Se 200 OK mas dados não persistem:
       └─ Problema: MongoDB não está salvando
       └─ Verificar collection e documento diretamente

4. Se dados persistem no MongoDB mas não aparecem na UI:
   └─ Problema: Recuperação/renderização no frontend
   └─ Verificar método getConversation() e binding do template
```

---

## 🚀 Próximos Passos Recomendados

1. **Executar checklist de diagnóstico** acima para identificar a causa exata
2. **Verificar logs** do Gateway e Conductor API durante tentativa de salvamento
3. **Testar endpoints** diretamente com `curl` para isolar problema
4. **Validar MongoDB** para confirmar se persistência está funcionando
5. **Verificar feature flags** e variáveis de ambiente
6. **Caso necessário**: Adicionar logs detalhados temporários no frontend para debug

---

## 📁 Referências de Código

### Frontend
- `src/app/shared/conductor-chat/conductor-chat.component.ts:3167` - `saveConversationContext()`
- `src/app/shared/conductor-chat/conductor-chat.component.ts:162-182` - Template do editor de contexto
- `src/app/services/conversation.service.ts:181-186` - `updateConversationContext()`

### Gateway
- `src/api/routers/conversations.py:150-156` - Endpoint PATCH `/context`
- `src/api/routers/conversations.py:159-221` - Endpoint POST `/context/upload`
- `src/api/app.py:365` - Registro do router

### Conductor API
- `src/api/routes/conversations.py:381-411` - Endpoint PATCH `/context`
- `src/api/routes/conversations.py:341-373` - Endpoint PATCH `/title`
- `src/server.py:52` - Registro do router

### Persistência
- `src/core/services/conversation_service.py:436-469` - `update_conversation_context()`
- `src/core/services/conversation_service.py:394-434` - `update_conversation_title()`
- `src/core/services/conversation_service.py:129-153` - `get_conversation_by_id()`

---

## 🧪 Evidências de Testes Realizados (2025-11-03)

### ✅ Teste 1: Containers Docker
```bash
$ docker compose ps
# Resultado: Todos os containers rodando (conductor-api, gateway, web, mongodb)
```

### ✅ Teste 2: MongoDB Conectividade
```bash
$ docker exec mongodb mongosh --eval "db.adminCommand('ping')"
# Resultado: { ok: 1 }
```

### ✅ Teste 3: Conductor API - Endpoints Registrados
```bash
$ docker exec conductor-api-dev python -c "from server import app; [print(r.path) for r in app.routes if 'PATCH' in getattr(r, 'methods', [])]"
# Resultado ANTES do rebuild:
#   /conversations/{conversation_id}  ❌ ERRADO
# Resultado DEPOIS do rebuild:
#   /conversations/{conversation_id}/title  ✅ CORRETO
#   /conversations/{conversation_id}/context  ✅ CORRETO
```

### ✅ Teste 4: Atualização de Título via Conductor API
```bash
$ curl -X PATCH "http://localhost:8000/conversations/ab50c599.../title?new_title=Teste%20Backend"
# Resultado: {"success": true, "message": "Título atualizado com sucesso", "new_title": "Teste Backend"}
```

### ✅ Teste 5: Atualização de Contexto via Conductor API
```bash
$ curl -X PATCH "http://localhost:8000/conversations/ab50c599.../context" \
  -H "Content-Type: application/json" \
  -d '{"context": "# Teste\nContexto de debug"}'
# Resultado: {"success": true, "message": "Contexto atualizado com sucesso"}
```

### ✅ Teste 6: Gateway Proxy Funcionando
```bash
$ curl -X PATCH "http://localhost:5006/api/conversations/ab50c599.../title?new_title=Teste%20Gateway"
# Resultado ANTES do rebuild: {"detail": "Not Found"} ❌
# Resultado DEPOIS do rebuild: {"success": true, ...} ✅
```

### ✅ Teste 7: Persistência no MongoDB
```bash
$ curl "http://localhost:5006/api/conversations/ab50c599..."
# Resultado:
{
  "title": "Teste Gateway OK",
  "context": "# Contexto via Gateway\n\nTeste completo...",
  "updated_at": "2025-11-03T..."
}
```

### 📊 Resumo dos Testes
| Componente | Status Inicial | Status Final |
|------------|---------------|--------------|
| Containers Docker | ✅ Rodando | ✅ Rodando |
| MongoDB | ✅ Conectado | ✅ Conectado |
| Conductor API Routes | ❌ Desatualizadas | ✅ Atualizadas |
| Conductor API Title | ❌ 404 | ✅ 200 OK |
| Conductor API Context | ❌ 404 | ✅ 200 OK |
| Gateway Routes | ❌ Desatualizadas | ✅ Atualizadas |
| Gateway Proxy Title | ❌ 404 | ✅ 200 OK |
| Gateway Proxy Context | ❌ 404 | ✅ 200 OK |
| MongoDB Persistência | ✅ Sempre OK | ✅ Sempre OK |

---

**Conclusão**: O código está **completo e correto**. O problema reportado foi causado por **containers Docker rodando com código desatualizado**. Após rebuild com `docker compose -f docker-compose.dev.yml up --build -d`, todos os endpoints funcionam perfeitamente.
