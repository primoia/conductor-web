# Edição de Título e Contexto de Conversas

## 📋 Visão Geral

O sistema atual de conversas do Conductor permite criar, listar e gerenciar conversas vinculadas a roteiros (screenplays). Este documento analisa duas melhorias solicitadas:

1. **Edição de título de conversa**: Permitir que o usuário renomeie conversas diretamente na interface
2. **Campo de contexto/problema**: Adicionar um campo para descrever o problema ou feature sendo trabalhada em cada conversa, que será injetado no prompt dos agentes

## 🎯 Requisitos Identificados

### Requisitos Funcionais - Edição de Título

- **RF1**: Usuário pode clicar no título de uma conversa na lista para editá-lo
- **RF2**: Edição deve ser inline (diretamente no item da lista) ou via modal/dialog
- **RF3**: Título deve ser atualizado em tempo real após confirmação
- **RF4**: Validação: título não pode ser vazio e deve ter limite de caracteres
- **RF5**: API deve fornecer endpoint PUT/PATCH para atualizar título da conversa

### Requisitos Funcionais - Campo de Contexto/Problema

- **RF6**: Cada conversa deve ter um campo `context` ou `problem_description` opcional
- **RF7**: Campo deve ser editável na interface da conversa (não apenas na criação)
- **RF8**: Contexto deve ser injetado no prompt XML enviado aos agentes via `PromptEngine`
- **RF9**: Campo deve suportar texto longo (markdown) para descrever bugs, features, requisitos, etc.
- **RF10**: Campo deve aparecer no XML do prompt dentro de uma nova seção `<conversation_context>`

### Requisitos Não-Funcionais

- **RNF1**: Edição de título deve ser responsiva (< 500ms para atualização visual)
- **RNF2**: Contexto deve ser limitado a ~2000 caracteres para evitar prompts muito longos
- **RNF3**: Mudanças devem ser retrocompatíveis (conversas antigas sem contexto devem funcionar)

## 🔄 Fluxo do Processo Atual

### Criação e Listagem de Conversas

1. **Criação**: Usuário clica no botão `+` na `ConversationListComponent`
2. **Backend**: `ConversationService` cria nova conversa no MongoDB com título padrão
3. **Estrutura MongoDB**:
   ```javascript
   {
     conversation_id: "uuid",
     title: "Conversa 2025-11-03 14:30",
     created_at: "ISO_DATE",
     updated_at: "ISO_DATE",
     active_agent: {...},
     participants: [...],
     messages: [...],
     screenplay_id: "screenplay_uuid"
   }
   ```
4. **Listagem**: Frontend busca conversas filtradas por `screenplay_id`
5. **Exibição**: Cada conversa mostra título, número de mensagens e agentes participantes

### Geração de Prompts (Conductor Backend)

1. **Trigger**: Quando agente recebe mensagem do usuário
2. **PromptEngine**: Carrega contexto do agente (persona, instructions, playbook, screenplay)
3. **Formato XML**: Constrói XML estruturado em `build_xml_prompt()`
4. **Estrutura Atual**:
   ```xml
   <prompt>
     <system_context>
       <persona>...</persona>
       <instructions>...</instructions>
       <playbook>...</playbook>
       <screenplay>...</screenplay>  <!-- Contexto do roteiro -->
     </system_context>
     <conversation_history>
       <turn><user>...</user><assistant>...</assistant></turn>
     </conversation_history>
     <user_request>...</user_request>
   </prompt>
   ```

## 🏗️ Componentes Principais

### Frontend (Angular)

- **ConversationListComponent** (`conversation-list.component.ts:23-279`):
  - Lista conversas com título, metadados e ações
  - Atualmente permite criar, selecionar e deletar conversas
  - **Ponto de integração**: Adicionar modo de edição inline no título

- **ConversationService** (`conversation.service.ts:77-163`):
  - Service Angular que faz chamadas HTTP para API
  - Métodos existentes: `createConversation`, `getConversation`, `addMessage`, etc.
  - **Necessário**: Adicionar método `updateConversation()` ou `updateTitle()`

### Backend (Conductor API - Python)

- **ConversationService** (`conversation_service.py:28-514`):
  - Gerencia conversas no MongoDB
  - Métodos: `create_conversation`, `get_conversation_by_id`, `add_message`, etc.
  - **Necessário**: Adicionar método `update_conversation_title()` e `update_conversation_context()`

- **Rotas API** (`conversations.py:100-449`):
  - Endpoints REST: POST `/conversations/`, GET `/{id}`, DELETE `/{id}`, etc.
  - **Necessário**: Adicionar `PATCH /conversations/{id}` para atualizações parciais

- **PromptEngine** (`prompt_engine.py:16-724`):
  - Constrói prompts para LLMs em formato XML ou texto
  - Já carrega `screenplay_content` e injeta em `<screenplay>` (linhas 324-360, 636-641)
  - **Ponto de integração**: Adicionar lógica para carregar `conversation_context` e injetar em nova seção XML

### Gateway (FastAPI Proxy)

- **Conversations Router** (`conversations.py:84-139`):
  - Proxy transparente entre frontend e Conductor backend
  - **Necessário**: Adicionar rota proxy para PATCH

## 🔗 Relacionamentos e Dependências

```
┌─────────────────────────────────────────────────────────────┐
│                       Frontend (Angular)                     │
│                                                              │
│  ConversationListComponent  ←→  ConversationService (HTTP)  │
│         (edita título)              (updateTitle)            │
└──────────────────────────┬───────────────────────────────────┘
                           │ HTTP PATCH /api/conversations/{id}
┌──────────────────────────▼───────────────────────────────────┐
│                   Gateway (FastAPI Proxy)                    │
│                                                              │
│           Proxy Router: encaminha para Conductor            │
└──────────────────────────┬───────────────────────────────────┘
                           │ HTTP PATCH /conversations/{id}
┌──────────────────────────▼───────────────────────────────────┐
│                  Conductor Backend (Python)                  │
│                                                              │
│  API Router  →  ConversationService  →  MongoDB              │
│   (PATCH)        (update_title,          (conversations)     │
│                   update_context)                            │
└──────────────────────────┬───────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────┐
│                      PromptEngine                            │
│                                                              │
│  1. Carrega conversation_context do MongoDB via             │
│     conversation_id                                          │
│  2. Injeta em <conversation_context> no XML                 │
│  3. Agente recebe contexto completo no prompt               │
└──────────────────────────────────────────────────────────────┘
```

## 💡 Regras de Negócio Identificadas

1. **Regra: Título Obrigatório**
   - Toda conversa deve ter um título (gerado automaticamente se não fornecido)
   - _Implementação_: `ConversationService.create_conversation()` linha 98

2. **Regra: Conversas Vinculadas a Roteiros**
   - Conversas pertencem a um screenplay (campo `screenplay_id`)
   - Filtro por roteiro na listagem
   - _Implementação_: `list_conversations(screenplay_id)` linha 325-361

3. **Regra: Screenplay no Prompt**
   - PromptEngine já carrega conteúdo do screenplay e injeta no prompt
   - Acesso via `instance_id` → `screenplay_id` → `content`
   - _Implementação_: `_load_screenplay_context()` linha 324-360

4. **Regra: Histórico Unificado**
   - Múltiplos agentes compartilham o mesmo histórico de conversa
   - Mensagens incluem metadados do agente que respondeu
   - _Implementação_: `add_message()` linha 148-220

## 🎓 Conceitos-Chave

### Conversation (Conversa)
Unidade independente de diálogo que pode envolver múltiplos agentes. Cada conversa possui:
- Identificador único (`conversation_id`)
- Título editável
- Histórico de mensagens unificado
- Lista de participantes (agentes)
- Vínculo com um roteiro (screenplay)

### Screenplay (Roteiro)
Contexto mais amplo que agrupa múltiplas conversas. Contém:
- Descrição geral do projeto
- Informações de setup e configuração
- É injetado no prompt de todos os agentes via `<screenplay>`

### PromptEngine
Motor responsável por construir o prompt final enviado à LLM. Combina:
- Persona do agente
- Instruções específicas
- Playbook (boas práticas)
- Screenplay (contexto do projeto)
- Histórico da conversa
- Nova mensagem do usuário

### Problema vs Feature (Contexto da Conversa)
Cada conversa pode representar:
- **Bug**: Problema específico a ser resolvido
- **Feature**: Nova funcionalidade a ser implementada
- **Refatoração**: Melhoria de código existente
- **Investigação**: Exploração de algum aspecto do sistema

O campo `problem_description` ou `context` serviria para descrever isso de forma estruturada.

## 📌 Sugestões de Implementação

### 1. Edição de Título de Conversa

#### Frontend (Angular)

**Modificar `ConversationListComponent`**:

```typescript
// Adicionar estado para modo de edição
editingConversationId: string | null = null;
editingTitle: string = "";

// Método para entrar em modo de edição
startEditTitle(event: Event, conversation: ConversationSummary): void {
  event.stopPropagation();
  this.editingConversationId = conversation.conversation_id;
  this.editingTitle = conversation.title;
}

// Método para salvar título
saveTitle(conversationId: string): void {
  if (!this.editingTitle.trim()) {
    alert('Título não pode ser vazio');
    return;
  }

  this.conversationService.updateTitle(conversationId, this.editingTitle)
    .subscribe({
      next: () => {
        this.editingConversationId = null;
        this.loadConversations(); // Recarregar lista
      },
      error: (error) => {
        console.error('Erro ao atualizar título:', error);
      }
    });
}

// Método para cancelar edição
cancelEdit(): void {
  this.editingConversationId = null;
  this.editingTitle = "";
}
```

**Atualizar template HTML**:

```html
<div class="conversation-header">
  <!-- Modo normal: exibir título -->
  <span
    *ngIf="editingConversationId !== conv.conversation_id"
    class="conversation-title"
    (dblclick)="startEditTitle($event, conv)">
    {{ conv.title }}
  </span>

  <!-- Modo edição: input inline -->
  <input
    *ngIf="editingConversationId === conv.conversation_id"
    type="text"
    class="title-edit-input"
    [(ngModel)]="editingTitle"
    (blur)="saveTitle(conv.conversation_id)"
    (keyup.enter)="saveTitle(conv.conversation_id)"
    (keyup.escape)="cancelEdit()"
    autofocus />

  <!-- Botão de editar -->
  <button
    *ngIf="editingConversationId !== conv.conversation_id"
    class="edit-btn"
    (click)="startEditTitle($event, conv)"
    title="Editar título">
    ✏️
  </button>

  <button class="delete-btn" ...>🗑️</button>
</div>
```

**Adicionar método no `ConversationService`**:

```typescript
// src/app/services/conversation.service.ts

updateTitle(conversationId: string, title: string): Observable<{success: boolean}> {
  return this.http.patch<{success: boolean}>(
    `${this.apiUrl}/${conversationId}`,
    { title }
  );
}
```

#### Backend (Conductor API - Python)

**Adicionar método no `ConversationService`**:

```python
# src/core/services/conversation_service.py

def update_conversation_title(self, conversation_id: str, title: str) -> bool:
    """
    Atualiza o título de uma conversa.

    Args:
        conversation_id: ID da conversa
        title: Novo título

    Returns:
        bool: True se atualizado com sucesso
    """
    try:
        # Validação
        if not title or not title.strip():
            logger.error("Título não pode ser vazio")
            return False

        if len(title) > 200:
            logger.error("Título muito longo (máximo 200 caracteres)")
            return False

        timestamp = datetime.utcnow().isoformat()

        result = self.conversations.update_one(
            {"conversation_id": conversation_id},
            {
                "$set": {
                    "title": title.strip(),
                    "updated_at": timestamp
                }
            }
        )

        if result.matched_count == 0:
            logger.error(f"❌ Conversa não encontrada: {conversation_id}")
            return False

        logger.info(f"✅ Título atualizado: '{title}' para conversa {conversation_id}")
        return True

    except Exception as e:
        logger.error(f"❌ Erro ao atualizar título: {e}", exc_info=True)
        return False
```

**Adicionar rota na API**:

```python
# src/api/routes/conversations.py

class UpdateConversationRequest(BaseModel):
    """Request para atualizar dados da conversa."""
    title: Optional[str] = Field(None, description="Novo título")
    context: Optional[str] = Field(None, description="Contexto/problema da conversa")

@router.patch("/{conversation_id}", summary="Atualizar conversa")
def update_conversation(
    conversation_id: str = Path(..., description="ID da conversa"),
    request: UpdateConversationRequest = ...
):
    """
    Atualiza dados de uma conversa (título, contexto, etc).

    Args:
        conversation_id: ID da conversa
        request: Campos a atualizar (apenas os fornecidos serão atualizados)

    Returns:
        Confirmação de sucesso
    """
    try:
        success = False

        if request.title is not None:
            success = conversation_service.update_conversation_title(
                conversation_id, request.title
            )

        if request.context is not None:
            success = conversation_service.update_conversation_context(
                conversation_id, request.context
            )

        if not success:
            raise HTTPException(status_code=400, detail="Erro ao atualizar conversa")

        return {"success": True, "message": "Conversa atualizada com sucesso"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Erro ao atualizar conversa: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro ao atualizar conversa: {str(e)}")
```

#### Gateway (FastAPI)

**Adicionar rota proxy**:

```python
# src/conductor-gateway/src/api/routers/conversations.py

@router.patch("/{conversation_id}")
async def update_conversation(
    conversation_id: str = Path(...),
    request: Request = None
):
    """Proxy: Atualizar conversa (título, contexto, etc)."""
    return await proxy_request("PATCH", f"/conversations/{conversation_id}", request)
```

### 2. Campo de Contexto/Problema da Conversa

#### Backend - Estrutura de Dados

**Modificar schema MongoDB**:

```javascript
// Collection: conversations
{
  conversation_id: "uuid",
  title: "Fix user authentication bug",
  context: {
    type: "bug",  // ou "feature", "refactor", "investigation"
    description: "Usuários não conseguem fazer login após atualização do sistema...",
    created_at: "ISO_DATE",
    updated_at: "ISO_DATE"
  },
  created_at: "ISO_DATE",
  updated_at: "ISO_DATE",
  active_agent: {...},
  participants: [...],
  messages: [...],
  screenplay_id: "screenplay_uuid"
}
```

**Adicionar método no `ConversationService`**:

```python
# src/core/services/conversation_service.py

def update_conversation_context(
    self,
    conversation_id: str,
    context_type: str = "feature",
    description: str = ""
) -> bool:
    """
    Atualiza o contexto/problema de uma conversa.

    Args:
        conversation_id: ID da conversa
        context_type: Tipo do contexto (bug, feature, refactor, investigation)
        description: Descrição detalhada

    Returns:
        bool: True se atualizado com sucesso
    """
    try:
        # Validação
        valid_types = ["bug", "feature", "refactor", "investigation"]
        if context_type not in valid_types:
            logger.error(f"Tipo inválido: {context_type}")
            return False

        if len(description) > 2000:
            logger.error("Descrição muito longa (máximo 2000 caracteres)")
            return False

        timestamp = datetime.utcnow().isoformat()

        result = self.conversations.update_one(
            {"conversation_id": conversation_id},
            {
                "$set": {
                    "context": {
                        "type": context_type,
                        "description": description,
                        "updated_at": timestamp
                    },
                    "updated_at": timestamp
                }
            }
        )

        if result.matched_count == 0:
            logger.error(f"❌ Conversa não encontrada: {conversation_id}")
            return False

        logger.info(f"✅ Contexto atualizado para conversa {conversation_id}")
        return True

    except Exception as e:
        logger.error(f"❌ Erro ao atualizar contexto: {e}", exc_info=True)
        return False
```

#### PromptEngine - Injeção no XML

**Modificar `PromptEngine.build_xml_prompt()`**:

```python
# src/core/prompt_engine.py

def _load_conversation_context(self, conversation_id: Optional[str]) -> str:
    """
    Carrega o contexto da conversa atual.

    Args:
        conversation_id: ID da conversa

    Returns:
        str: Descrição do contexto ou string vazia
    """
    if not conversation_id:
        return ""

    try:
        from pymongo import MongoClient
        import os

        mongo_uri = os.getenv("MONGO_URI")
        if not mongo_uri:
            return ""

        client = MongoClient(mongo_uri)
        db = client.conductor_state

        conversation = db.conversations.find_one(
            {"conversation_id": conversation_id},
            {"context": 1}
        )

        if not conversation or "context" not in conversation:
            return ""

        context = conversation["context"]
        context_type = context.get("type", "unknown")
        description = context.get("description", "")

        if not description:
            return ""

        logger.info(f"Contexto da conversa carregado: {context_type}")
        return f"**Tipo**: {context_type}\n\n{description}"

    except Exception as e:
        logger.warning(f"Falha ao carregar contexto da conversa: {e}")
        return ""

def build_xml_prompt(
    self,
    conversation_history: List[Dict],
    message: str,
    include_history: bool = True,
    conversation_id: Optional[str] = None  # NOVO parâmetro
) -> str:
    """Constrói o prompt final usando uma estrutura XML otimizada."""
    # ... código existente ...

    # Carrega e escapa o conteúdo do contexto da conversa
    conversation_context_content = self._load_conversation_context(conversation_id)
    conversation_context_cdata = self._escape_xml_cdata(conversation_context_content)

    # Monta a seção do contexto da conversa se disponível
    conversation_context_section = ""
    if conversation_context_content:
        conversation_context_section = f"""        <conversation_context>
            <![CDATA[{conversation_context_cdata}]]>
        </conversation_context>"""

    # Monta o prompt XML final
    final_prompt = f"""<prompt>
    <system_context>
        <persona>
            <![CDATA[{persona_cdata}]]>
        </persona>
        <instructions>
            <![CDATA[{instructions_cdata}]]>
        </instructions>
        <playbook>
            <![CDATA[{playbook_cdata}]]>
        </playbook>{screenplay_section}{conversation_context_section}
    </system_context>
    <conversation_history>
{history_xml}
    </conversation_history>
    <user_request>
        <![CDATA[{message_cdata}]]>
    </user_request>
</prompt>"""

    # ... resto do código ...
```

**Atualizar chamadas do PromptEngine**:

Onde o `build_xml_prompt()` é chamado, passar o `conversation_id`:

```python
# Exemplo: em algum executor de agente
prompt = prompt_engine.build_xml_prompt(
    conversation_history=history,
    message=user_message,
    conversation_id=conversation_id  # Passar conversation_id aqui
)
```

#### Frontend - UI para Editar Contexto

**Adicionar ao componente de conversa** (não na lista, mas na view de conversa ativa):

```typescript
// Exemplo: conductor-chat.component.ts

conversationContext: {type: string, description: string} | null = null;
editingContext: boolean = false;

loadConversationContext(): void {
  if (!this.activeConversationId) return;

  this.conversationService.getConversation(this.activeConversationId)
    .subscribe({
      next: (conversation) => {
        this.conversationContext = conversation.context || null;
      }
    });
}

saveContext(type: string, description: string): void {
  if (!this.activeConversationId) return;

  this.conversationService.updateContext(
    this.activeConversationId,
    type,
    description
  ).subscribe({
    next: () => {
      this.editingContext = false;
      this.loadConversationContext();
    }
  });
}
```

**Template HTML** (adicionar no topo do chat):

```html
<div class="conversation-context-banner" *ngIf="conversationContext">
  <div class="context-header">
    <span class="context-type-badge" [class]="conversationContext.type">
      {{ conversationContext.type }}
    </span>
    <button (click)="editingContext = true">Editar Contexto</button>
  </div>
  <p class="context-description">{{ conversationContext.description }}</p>
</div>

<!-- Modal de edição -->
<div class="context-edit-modal" *ngIf="editingContext">
  <select [(ngModel)]="contextType">
    <option value="bug">Bug</option>
    <option value="feature">Feature</option>
    <option value="refactor">Refactor</option>
    <option value="investigation">Investigation</option>
  </select>
  <textarea
    [(ngModel)]="contextDescription"
    placeholder="Descreva o problema ou feature..."
    maxlength="2000">
  </textarea>
  <button (click)="saveContext(contextType, contextDescription)">Salvar</button>
  <button (click)="editingContext = false">Cancelar</button>
</div>
```

### 3. Exemplo de Prompt Final com Contexto

Com as modificações propostas, o prompt XML enviado ao agente ficaria assim:

```xml
<prompt>
    <system_context>
        <persona>
            <![CDATA[Você é um Requirements Engineer especializado...]]>
        </persona>
        <instructions>
            <![CDATA[Analise o código e extraia requisitos...]]>
        </instructions>
        <playbook>
            <![CDATA[## BEST PRACTICES...]]>
        </playbook>
        <screenplay>
            <![CDATA[# Conductor Community

            Self-contained repository for running Conductor stack...]]>
        </screenplay>
        <conversation_context>
            <![CDATA[**Tipo**: bug

            Usuários não conseguem fazer login após a atualização do sistema de autenticação.
            O erro ocorre especificamente quando tentam usar OAuth via Google.
            Logs mostram "invalid_token" mas o token parece válido.]]>
        </conversation_context>
    </system_context>
    <conversation_history>
        <turn timestamp="2025-11-03T14:30:00">
            <user><![CDATA[Analise o código de autenticação]]></user>
            <assistant><![CDATA[Vou analisar os arquivos...]]></assistant>
        </turn>
    </conversation_history>
    <user_request>
        <![CDATA[Verifique se há problemas na validação do token OAuth]]>
    </user_request>
</prompt>
```

## 📊 Benefícios da Implementação

### Edição de Título
- ✅ Melhor organização das conversas
- ✅ Identificação rápida do assunto de cada conversa
- ✅ UX mais intuitiva e fluida

### Campo de Contexto
- ✅ Agentes recebem contexto preciso sobre o que estão trabalhando
- ✅ Prompts mais direcionados geram respostas mais relevantes
- ✅ Diferenciação clara entre bugs, features, refactorings
- ✅ Histórico estruturado de problemas resolvidos
- ✅ Rastreabilidade: qual conversa tratou qual problema

## ⚠️ Considerações de Design

### 1. Onde Editar o Contexto?

**Opção A**: Na lista de conversas (card expandido)
- ✅ Acesso rápido
- ❌ Ocupa espaço visual

**Opção B**: Dentro da conversa ativa (banner no topo do chat)
- ✅ Mais espaço para edição
- ✅ Contexto sempre visível durante a conversa
- ✅ **Recomendado**

### 2. Contexto vs Screenplay

**Diferença**:
- **Screenplay**: Contexto geral do PROJETO (setup, arquitetura, decisões globais)
- **Conversation Context**: Contexto específico do PROBLEMA/FEATURE sendo trabalhado

**Exemplo**:
- Screenplay: "Conductor Community - Sistema de orquestração de agentes com Angular + Python"
- Context: "Bug: Usuários não conseguem fazer login via OAuth Google"

**Hierarquia**:
```
Screenplay (Projeto)
  ├─ Conversation 1 (Bug: Login OAuth)
  ├─ Conversation 2 (Feature: Dashboard de métricas)
  └─ Conversation 3 (Refactor: Simplificar PromptEngine)
```

### 3. Retrocompatibilidade

- Conversas antigas sem campo `context` devem funcionar normalmente
- PromptEngine deve verificar se `context` existe antes de injetar
- Frontend deve exibir botão "Adicionar Contexto" se conversa não tiver

## 🎯 Priorização Sugerida

**Fase 1 - Quick Win (1-2 dias)**:
1. Implementar edição de título (backend + frontend)
2. Testar em produção

**Fase 2 - Campo de Contexto (2-3 dias)**:
1. Adicionar campo `context` no MongoDB
2. Criar endpoints de atualização
3. Implementar UI básica para edição

**Fase 3 - Integração com Prompts (1 dia)**:
1. Modificar PromptEngine para carregar e injetar contexto
2. Testar geração de prompts
3. Validar qualidade das respostas dos agentes

**Fase 4 - Refinamentos (1 dia)**:
1. Adicionar tipos de contexto (bug, feature, etc.)
2. Melhorar UI/UX
3. Documentação

## 📝 Resumo Executivo

Sim, **faz total sentido** ter um campo de contexto/problema nas conversas! A implementação é viável e segue o padrão já estabelecido pelo `screenplay_content` no PromptEngine.

**Vantagens**:
- Agentes trabalham com contexto preciso do problema específico
- Diferenciação entre projeto (screenplay) e tarefa (conversation context)
- Estruturação melhor do trabalho (bugs vs features vs refactorings)
- Histórico rastreável de problemas resolvidos

**Esforço**: ~5-7 dias de desenvolvimento full-stack

**Riscos**: Baixos (mudanças aditivas, retrocompatíveis)

**Recomendação**: ✅ Implementar ambas funcionalidades
