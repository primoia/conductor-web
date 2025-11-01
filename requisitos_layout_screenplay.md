# Layout de 3 Colunas do Screenplay

## 📋 Visão Geral

O **Screenplay Interactive** é a interface principal do Conductor Web, organizada em um layout de 3 colunas que permite aos usuários criar, editar e orquestrar "Documentos Vivos" (Living Screenplays) com Agentes de IA. A arquitetura visual é projetada para separar navegação, edição e interação com agentes, oferecendo um fluxo de trabalho intuitivo e produtivo.

O componente principal está localizado em:
- **Caminho do template HTML**: `src/app/living-screenplay-simple/screenplay-interactive.html`
- **Caminho do componente TypeScript**: `src/app/living-screenplay-simple/screenplay-interactive.ts`
- **Caminho dos estilos principais**: `src/app/living-screenplay-simple/screenplay-layout.css`

---

## 🎯 Requisitos Identificados

### Requisitos Funcionais

- **RF1**: O sistema deve exibir uma interface de 3 colunas (navegação, edição, chat) que seja redimensionável e responsiva
- **RF2**: A primeira coluna deve permitir navegação entre roteiros, visualização de agentes instanciados e acesso ao catálogo de agentes através de abas
- **RF3**: A coluna central deve fornecer um editor Markdown interativo com suporte a comandos de barra (/) e sintaxe rica
- **RF4**: A terceira coluna deve permitir interação via chat com agentes de IA instanciados, incluindo dock visual para seleção rápida
- **RF5**: O sistema deve permitir criação, abertura, salvamento e exportação de roteiros através de uma toolbar
- **RF6**: Modais devem permitir configuração de diretório de trabalho, visualização de atalhos, gerenciamento de agentes e resolução de conflitos
- **RF7**: O sistema deve exibir status de salvamento, KPIs de execução e eventos de agentes em tempo real

### Requisitos Não-Funcionais

- **RNF1**: A interface deve ser responsiva e manter usabilidade em diferentes resoluções de tela
- **RNF2**: As três colunas devem ser redimensionáveis via splitter arrastável
- **RNF3**: O salvamento automático deve ocorrer 3 segundos após a última modificação (debounce)
- **RNF4**: A interface deve suportar atalhos de teclado para operações comuns (Ctrl+S, Ctrl+N, Ctrl+O, etc.)

---

## 🔄 Fluxo do Processo

### Inicialização

1. **Carregamento do Componente**: Quando o usuário acessa o Screenplay Interactive, o componente Angular `ScreenplayInteractive` é inicializado
2. **Configuração de Layout**: A largura inicial das colunas é definida (70% para screenplay-canvas + primeira coluna, 30% para chat-panel)
3. **Carregamento de Estado**: Se há um ID de roteiro na URL (`?screenplayId=xxx`), o sistema carrega o roteiro do MongoDB
4. **Sincronização de Agentes**: O sistema busca agentes instanciados e os exibe na primeira coluna e no dock do chat

### Operação Normal

1. **Navegação (Primeira Coluna)**: O usuário alterna entre as abas de Roteiros, Instâncias e Catálogo para explorar conteúdo
2. **Edição (Coluna Central)**: O usuário digita no editor Markdown, que parseia emojis como âncoras de agentes e salva automaticamente
3. **Interação com Agentes (Terceira Coluna)**: O usuário seleciona um agente no dock e envia mensagens para execução de tarefas
4. **Feedback em Tempo Real**: O painel gamificado no rodapé exibe eventos, KPIs e status de execução dos agentes

### Operações Avançadas

1. **Criação de Agente**: Usuário clica em "➕ Adicionar Agente" → abre modal de seleção → escolhe agente do catálogo → agente é instanciado no roteiro
2. **Configuração de Diretório**: Usuário clica em "⚙️ Configurações" → "📁 Configurar Diretório de Trabalho" → define `cwd` para novos agentes
3. **Exportação para Disco**: Usuário clica em "📤 Exportar" → define nome do arquivo → escolhe local → arquivo `.md` é baixado com agentes embarcados
4. **Resolução de Conflitos**: Se um roteiro importado tem mesmo nome que um existente, modal de conflito permite escolher entre substituir, renomear ou cancelar

---

## 🏗️ Componentes Principais

### 🎨 Estrutura Visual

```
┌─────────────────────────────────────────────────────────────────────┐
│                        .screenplay-layout                           │
├──────────────┬─────────────────────────────────┬────────────────────┤
│ .first-column│     .screenplay-canvas          │   .chat-panel      │
│              │                                  │                    │
│  🎬 Abas     │  📝 Toolbar                      │  💬 Chat Header    │
│  ┌────────┐ │  ┌───────────────────────────┐  │  ┌──────────────┐ │
│  │Roteiros│ │  │📄 📂 💾 📥 📤 🏛️ ⚙️      │  │  │ Agent: 🚀    │ │
│  │Instance│ │  └───────────────────────────┘  │  └──────────────┘ │
│  │Catálogo│ │                                  │                    │
│  └────────┘ │  📄 Editor Markdown              │  🗨️ Mensagens     │
│             │  ┌───────────────────────────┐  │  ┌──────────────┐ │
│  📂 Projetos│  │# Título                   │  │  │ User: ...    │ │
│   └─ README │  │                           │  │  │ Agent: ...   │ │
│   └─ docs   │  │Digite aqui...             │  │  │              │ │
│             │  │                           │  │  └──────────────┘ │
│  🤖 Agentes │  │                           │  │                    │
│   • 🚀 x3   │  └───────────────────────────┘  │  🎯 Dock          │
│   • 🧪 x1   │                                  │  ┌──────────────┐ │
│             │  🎮 Painel Gamificado            │  │ ➕ 🗑️ ⚙️   │ │
│             │  ┌───────────────────────────┐  │  │ ─────────    │ │
│             │  │📰 Notícias │ Agentes: 4   │  │  │ 🚀 🧪 🔐   │ │
│             │  │▼ Ticker de Eventos        │  │  └──────────────┘ │
│             │  └───────────────────────────┘  │                    │
└──────────────┴─────────────────────────────────┴────────────────────┘
```

---

## 🔹 Primeira Coluna: `.first-column`

### 📌 Responsabilidade

Navegação contextual e acesso rápido a recursos do sistema. Organizada em três abas que oferecem diferentes visões do workspace.

### 🧩 Estrutura HTML

**Classe CSS**: `.first-column`
**Caminho**: `screenplay-interactive.html:4`

```html
<div class="first-column">
  <!-- Navegação de Abas -->
  <div class="first-column-tabs">
    <button class="tab-button" [class.active]="activeTab === 'catalog'">
      🤖 Agentes
    </button>
    <button class="tab-button" [class.active]="activeTab === 'instances'">
      🎭 Instâncias
    </button>
    <button class="tab-button" [class.active]="activeTab === 'tree'">
      🎬 Roteiros
    </button>
  </div>

  <!-- Conteúdo das Abas -->
  <div class="first-column-content">
    <!-- Aba 1: Árvore de Roteiros -->
    <app-screenplay-tree *ngIf="activeTab === 'tree'"></app-screenplay-tree>

    <!-- Aba 2: Agentes Instanciados (Minigame) -->
    <app-agent-game *ngIf="activeTab === 'instances'"></app-agent-game>

    <!-- Aba 3: Catálogo de Agentes -->
    <app-agent-catalog *ngIf="activeTab === 'catalog'"></app-agent-catalog>
  </div>
</div>
```

### 🎯 Abas Disponíveis

#### 1️⃣ Aba "🎬 Roteiros" (`activeTab === 'tree'`)

**Componente**: `ScreenplayTreeComponent`
**Caminho**: `src/app/living-screenplay-simple/screenplay-tree/screenplay-tree.component.ts`
**Template**: `screenplay-tree.component.html`
**Estilos**: `screenplay-tree.component.css`

**Funcionalidade**:
- Exibe uma árvore hierárquica de roteiros agrupados por projeto
- Permite abertura de roteiros existentes com um clique
- Suporta edição de metadados (nome, caminho) via modal
- Oferece opção de recarregar roteiro do disco
- Sanitiza caminhos sensíveis (remove `/mnt/ramdisk/primoia-main/`, etc.)

**Eventos Emitidos**:
- `openScreenplay`: Quando usuário clica em um arquivo de roteiro
- `updateScreenplay`: Quando metadados são editados
- `reloadFromDisk`: Quando usuário solicita recarga do disco

**Classes de Estilo Principais**:
- `.tree-node`: Nó individual da árvore
- `.tree-node-project`: Pasta de projeto (expansível)
- `.tree-node-file`: Arquivo de roteiro (clicável)

#### 2️⃣ Aba "🎭 Instâncias" (`activeTab === 'instances'`)

**Componente**: `AgentGameComponent`
**Caminho**: `src/app/living-screenplay-simple/agent-game/agent-game.component.ts`
**Template**: `agent-game.component.html`
**Estilos**: `agent-game.component.css`

**Funcionalidade**:
- Exibe agentes instanciados em uma visualização gamificada (canvas 2D)
- Cada agente é representado por um sprite animado com emoji
- Mostra métricas de execução (total de execuções, tempo médio)
- Permite filtros por tipo de agente e busca por nome
- Indica agentes "conselheiros" (councilors) com badge especial

**Interface de Dados**:
```typescript
interface AgentCharacter {
  id: string;
  agentId: string;
  screenplayId: string;
  name: string;
  emoji: string;
  position: { x: number, y: number };
  executionMetrics: {
    totalExecutions: number;
    averageExecutionTime: number;
    isCurrentlyExecuting: boolean;
  };
  isCouncilor?: boolean;
}
```

**Classes de Estilo Principais**:
- `.agent-game-canvas`: Canvas HTML5 para renderização
- `.agent-metrics-panel`: Painel de métricas lateral

#### 3️⃣ Aba "🤖 Agentes" (`activeTab === 'catalog'`)

**Componente**: `AgentCatalogComponent`
**Caminho**: `src/app/living-screenplay-simple/agent-catalog/agent-catalog.component.ts`
**Template**: `agent-catalog.component.html`
**Estilos**: `agent-catalog.component.css`

**Funcionalidade**:
- Lista todos os agentes disponíveis no sistema
- Permite busca por nome, descrição ou emoji
- Filtra agentes por tipo: "Todos", "Sistema", "Personalizado"
- Permite criação de novo agente customizado
- Exibe preview com emoji, título e descrição de cada agente

**Eventos Emitidos**:
- `selectAgent`: Quando usuário escolhe um agente para instanciar
- `createAgent`: Quando usuário solicita criação de novo agente

**API Utilizada**:
- **GET** `${gatewayUrl}/api/agents`: Lista agentes disponíveis

**Classes de Estilo Principais**:
- `.agent-catalog-search`: Campo de busca
- `.agent-catalog-filters`: Botões de filtro
- `.agent-catalog-grid`: Grade de cards de agentes
- `.agent-card`: Card individual de agente

### 🎨 Estilos Principais (`.first-column`)

**Arquivo**: `screenplay-layout.css:21-28`

```css
.first-column {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f8f9fa;
  border-right: 1px solid #e1e4e8;
  overflow: hidden;
}
```

**Sistema de Abas** (`screenplay-layout.css:30-70`):
- `.first-column-tabs`: Container de navegação de abas
- `.tab-button`: Botão de aba individual
- `.tab-button.active`: Aba selecionada (gradiente roxo)
- `.first-column-content`: Container de conteúdo (muda baseado em `activeTab`)

---

## 🔹 Coluna Central: `.screenplay-canvas`

### 📌 Responsabilidade

Área principal de edição de roteiros, incluindo toolbar de ações, editor Markdown interativo e painel de status/eventos no rodapé.

### 🧩 Estrutura HTML

**Classe CSS**: `.screenplay-canvas`
**Caminho**: `screenplay-interactive.html:56`

```html
<div class="screenplay-canvas" #canvas>
  <!-- Toolbar de Edição -->
  <div class="editor-toolbar">
    <div class="toolbar-buttons">
      <button class="toolbar-btn new-btn" title="Novo Roteiro">📄</button>
      <button class="toolbar-btn open-btn" title="Abrir do Banco...">📂</button>
      <button class="toolbar-btn save-btn-toolbar" [class.dirty]="isDirty">💾</button>
      <button class="toolbar-btn import-btn" title="Importar do Disco...">📥</button>
      <button class="toolbar-btn export-btn" title="Exportar para Disco...">📤</button>
      <button class="toolbar-btn" title="Conselheiros">🏛️</button>
      <button class="toolbar-btn settings-btn" title="Configurações">⚙️</button>
    </div>
  </div>

  <!-- Área de Edição -->
  <div class="editor-content">
    <app-interactive-editor
      [content]="editorContent"
      [placeholder]="'Digite / para comandos...'"
      (contentChange)="handleContentUpdate($event)"
      (blockCommand)="onBlockCommand($event)">
    </app-interactive-editor>
  </div>

  <!-- Rodapé com Painel Gamificado -->
  <div class="editor-footer">
    <app-gamified-panel>
      <app-event-ticker></app-event-ticker>
    </app-gamified-panel>
  </div>
</div>
```

### 🛠️ Toolbar de Edição (`.editor-toolbar`)

**Caminho HTML**: `screenplay-interactive.html:58-124`
**Estilos**: `screenplay-layout.css:184-498`

**Botões Disponíveis**:

| Emoji | Classe CSS | Função | Atalho |
|-------|-----------|--------|--------|
| 📄 | `.new-btn` | Criar novo roteiro | Ctrl+N |
| 📂 | `.open-btn` | Abrir roteiro do banco | Ctrl+O |
| 💾 | `.save-btn-toolbar` | Salvar roteiro | Ctrl+S |
| 📥 | `.import-btn` | Importar arquivo do disco | Ctrl+I |
| 📤 | `.export-btn` | Exportar para disco | Ctrl+E |
| 🏛️ | (sem classe) | Dashboard de Conselheiros | - |
| ⚙️ | `.settings-btn` | Menu de configurações | - |

**Estados Visuais**:
- `.saving`: Botão de salvamento girando (animação `spin`)
- `.dirty`: Botão de salvamento pulsando (conteúdo modificado)
- `:disabled`: Botão desabilitado (opacidade 50%)

**Menu de Configurações** (`.screenplay-settings-menu`):
- Aparece ao clicar em "⚙️"
- **Item 1**: "📁 Configurar Diretório de Trabalho" → Abre modal de `cwd`
- **Item 2**: "⌨️ Atalhos de Teclado" → Exibe modal de atalhos

### 📝 Editor Markdown (`.editor-content`)

**Componente**: `InteractiveEditor`
**Caminho**: `src/app/interactive-editor/interactive-editor.ts`
**Template**: `interactive-editor.html`
**Estilos**: `interactive-editor.scss`

**Tecnologia Base**: **TipTap Editor** (ProseMirror)

**Extensões Configuradas**:
- `StarterKit`: Formatação básica (negrito, itálico, listas)
- `Placeholder`: Texto de placeholder customizável
- `CodeBlockLowlight`: Blocos de código com syntax highlighting
- `TaskList` + `TaskItem`: Listas de tarefas interativas (checkboxes)

**Comandos de Barra (Slash Commands)**:
Ao digitar `/`, um menu contextual aparece com as seguintes opções:

| Comando | Descrição | Shortcut |
|---------|-----------|----------|
| `/h1` | Título 1 | - |
| `/h2` | Título 2 | - |
| `/h3` | Título 3 | - |
| `/p` | Parágrafo | - |
| `/code` | Bloco de Código | - |
| `/ul` | Lista com marcadores | - |
| `/ol` | Lista numerada | - |
| `/task` | Lista de tarefas | - |
| `/quote` | Citação | - |
| `/proposta` | Bloco de proposta (Roteiro Vivo) | - |
| `/gatilho` | Gatilho de execução | - |
| `/include` | Incluir sub-roteiro | - |

**Eventos Emitidos**:
- `contentChange`: Sempre que o conteúdo do editor muda (retorna Markdown)
- `blockCommand`: Quando um comando de barra customizado é executado

**Persistência de Agentes**:
- Emojis no texto são parseados como âncoras de agentes
- Comentários HTML invisíveis (`<!-- agent-instance:uuid -->`) ligam emojis a instâncias no MongoDB
- Ao salvar, o Markdown é sincronizado com a base de dados

**Classes de Estilo Principais**:
- `.interactive-editor-content`: Container do editor TipTap
- `.ProseMirror`: Classe raiz do ProseMirror
- `.task-list` / `.task-item`: Listas de tarefas estilizadas

### 🎮 Painel Gamificado (`.editor-footer`)

**Componente**: `GamifiedPanelComponent`
**Caminho**: `src/app/living-screenplay-simple/gamified-panel/gamified-panel.component.ts`

**Estados**:
- **Collapsed** (`.collapsed`): Exibe apenas título e botão de expandir
- **Expanded** (`.expanded`): Exibe título, ticker de eventos e KPIs no rodapé

**Estrutura**:
```html
<div class="gamified-panel">
  <div class="panel-header">
    <span>📰 Notícias dos Agentes</span>
    <button class="toggle-btn">▼</button>
  </div>
  <div class="panel-body">
    <!-- Event Ticker (conteúdo projetado via ng-content) -->
    <app-event-ticker></app-event-ticker>
  </div>
  <div class="panel-footer" *ngIf="state === 'expanded'">
    <div class="kpis">
      <div class="kpi">Agentes: 4</div>
      <div class="kpi">Execuções: 127</div>
      <div class="kpi">Última: há 2min</div>
      <div class="kpi">Investigações: 0</div>
    </div>
  </div>
</div>
```

**Sub-componente**: `EventTickerComponent`
**Caminho**: `src/app/living-screenplay-simple/event-ticker/event-ticker.component.ts`

**Funcionalidade**:
- Exibe eventos em tempo real de execuções de agentes
- Suporta filtros: "Todos", "Resultados", "Debug"
- Permite seleção de evento para detalhamento
- Oferece botão "🔍 Investigar" para criar nova investigação a partir de um evento

**Tipos de Evento**:
- `result`: Resultado de execução de agente (sucesso/erro)
- `debug`: Log de depuração interno
- `info`: Informação geral

**Classes de Estilo Principais**:
- `.event-ticker`: Container do ticker
- `.event-item`: Item individual de evento
- `.event-item.result`: Evento de resultado (azul)
- `.event-item.debug`: Evento de debug (cinza)

### 🎨 Estilos Principais (`.screenplay-canvas`)

**Arquivo**: `screenplay-layout.css:174-298`

```css
.screenplay-canvas {
  flex: 1;
  position: relative;
  background: #ffffff;
  overflow: auto;
  display: flex;
  flex-direction: column;
}

.editor-toolbar {
  display: flex;
  flex-direction: column;
  padding: 0;
  background: #f8f9fa;
  border-bottom: 1px solid #e1e4e8;
  flex-shrink: 0;
}

.editor-content {
  flex: 1;
  position: relative;
  overflow: auto;
}

.editor-footer {
  padding: 8px 16px;
  background: #f8f9fa;
  border-top: 1px solid #e1e4e8;
  flex-shrink: 0;
}
```

---

## 🔹 Terceira Coluna: `.chat-panel`

### 📌 Responsabilidade

Interface de comunicação com agentes de IA, incluindo histórico de mensagens, entrada de texto, dock de agentes e controles de execução.

### 🧩 Estrutura HTML

**Classe CSS**: `.chat-panel`
**Caminho**: `screenplay-interactive.html:257`

```html
<div class="chat-panel" [style.width.%]="chatWidth">
  <app-conductor-chat
    #conductorChat
    [contextualAgents]="contextualAgents"
    (addAgentRequested)="openAgentSelector()"
    (deleteAgentRequested)="onDeleteAgentClick()"
    (agentDockClicked)="onDockAgentClick($event)">
  </app-conductor-chat>
</div>
```

### 💬 Componente de Chat

**Componente**: `ConductorChatComponent`
**Caminho**: `src/app/shared/conductor-chat/conductor-chat.component.ts`
**Template**: Inline (definido no próprio componente via `template:`)

**Estrutura Visual**:

```
┌───────────────────────────────┐
│  Chat Header                  │
│  ┌──────────────────────────┐ │
│  │ 🟢 🚀 Performance Agent  │ │
│  └──────────────────────────┘ │
├───────────────────────────────┤
│  Chat Body                    │
│  ┌──────────────────────────┐ │
│  │ [Histórico de Mensagens] │ │
│  │                          │ │
│  │ User: Analise o código   │ │
│  │ Agent: Analisando...     │ │
│  │ Agent: ✅ Concluído!     │ │
│  └──────────────────────────┘ │
├───────────────────────────────┤
│  Agent Launcher Dock          │
│  ┌────┐                       │
│  │ ➕ │ Adicionar Agente      │
│  │ 🗑️ │ Excluir Agente        │
│  │ ⚙️ │ Opções                │
│  │ ❓ │ Info                  │
│  ├────┤                       │
│  │ 🚀 │ Performance Agent     │
│  │ 🧪 │ Test Agent            │
│  │ 🔐 │ Auth Agent            │
│  └────┘                       │
├───────────────────────────────┤
│  Chat Input                   │
│  ┌──────────────────────────┐ │
│  │ Digite sua mensagem... 🎤│ │
│  └──────────────────────────┘ │
└───────────────────────────────┘
```

### 🎛️ Elementos do Chat

#### 1. **Chat Header** (`.chat-header`)

**Funcionalidade**:
- Exibe agente atualmente selecionado (emoji + nome)
- Mostra indicador de status (conectado/carregando)
- Oferece ações rápidas (removido botão de info, agora na dock)

**Elementos**:
- `<app-status-indicator>`: Indicador verde/vermelho de conexão
- `.selected-agent`: Nome e emoji do agente ativo

#### 2. **Chat Body** (`.chat-body`)

**Sub-componente**: `ChatMessagesComponent`
**Caminho**: `src/app/shared/conductor-chat/components/chat-messages/chat-messages.component.ts`

**Funcionalidade**:
- Renderiza histórico de mensagens do usuário e agente
- Suporta streaming de respostas (mensagens parciais)
- Auto-scroll para última mensagem
- Exibe indicador de "digitando..." quando agente está processando

**Estrutura de Mensagem**:
```typescript
interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  isStreaming?: boolean;
}
```

**Banner de Aviso CWD**:
- Aparece quando agente selecionado não tem `cwd` configurado
- Botão "Definir agora" abre modal de configuração

#### 3. **Agent Launcher Dock** (`.agent-launcher-dock`)

**Funcionalidade**:
- Barra vertical fixa no lado direito do chat
- Botões de ação no topo: ➕ (adicionar), 🗑️ (excluir), ⚙️ (opções), ❓ (info)
- Lista scrollável de agentes instanciados
- Clique em um agente o seleciona para conversa
- Agente ativo recebe classe `.active` (destaque visual)

**Eventos**:
- `addAgentRequested`: Emitido ao clicar em ➕
- `deleteAgentRequested`: Emitido ao clicar em 🗑️
- `agentDockClicked`: Emitido ao clicar em um emoji de agente

**Menu de Opções** (`.agent-options-menu`):
Aparece ao clicar em ⚙️, oferece:
- "📋 Ver Contexto": Exibe modal com persona e procedimento operacional
- "✏️ Editar Persona": Abre editor de persona customizada
- "📁 Configurar Diretório": Define `cwd` para o agente
- "💬 Histórico de Conversas": Exibe histórico completo de mensagens

#### 4. **Chat Input** (`.chat-input`)

**Sub-componente**: `ChatInputComponent`
**Caminho**: `src/app/shared/conductor-chat/components/chat-input/chat-input.component.ts`

**Funcionalidade**:
- Campo de texto para digitação de mensagens
- Botão de envio (ícone de avião/seta)
- Botão de reconhecimento de voz 🎤 (speech-to-text)
- Suporta Enter para enviar, Shift+Enter para nova linha
- Desabilitado quando agente está processando

**Eventos**:
- `messageSent`: Emitido ao enviar mensagem

### 🎨 Estilos Principais (`.chat-panel`)

**Arquivo**: `screenplay-layout.css:159-172`

```css
.chat-panel {
  height: 100vh;
  overflow: hidden;
  transition: width 0.1s ease-out;
  flex-shrink: 0;
  display: flex;
  flex-direction: row;
  position: relative;
}

.chat-panel app-conductor-chat {
  flex: 1;
  min-width: 0;
}
```

**Estilos do Dock** (definidos no componente `conductor-chat`):
- `.agent-launcher-dock`: Barra vertical fixa
- `.dock-action-btn`: Botões de ação (➕, 🗑️, ⚙️)
- `.dock-item`: Item de agente individual (emoji)
- `.dock-item.active`: Agente selecionado (borda azul, shadow)

---

## 🔗 Relacionamentos e Dependências

### Fluxo de Dados entre Colunas

1. **Primeira Coluna → Coluna Central**:
   - Ao abrir um roteiro da árvore (`ScreenplayTreeComponent`), evento `openScreenplay` é emitido
   - `ScreenplayInteractive` captura o evento e carrega o conteúdo no `InteractiveEditor`
   - O editor exibe o Markdown e parseia agentes embarcados

2. **Coluna Central → Terceira Coluna**:
   - Quando o editor detecta emojis de agentes, instâncias são criadas/atualizadas
   - `ScreenplayInteractive` atualiza a propriedade `contextualAgents` passada para `ConductorChatComponent`
   - O dock do chat é repopulado com os agentes do roteiro atual

3. **Terceira Coluna → Coluna Central**:
   - Ao executar um agente no chat, resultados podem modificar o conteúdo do roteiro
   - Mudanças são refletidas no `InteractiveEditor` via binding de `content`
   - Salvamento automático sincroniza com MongoDB

### Comunicação com Backend

**Gateway API**: `${environment.gatewayUrl || 'http://localhost:3001'}`

| Endpoint | Método | Usado Por | Função |
|----------|--------|-----------|--------|
| `/api/agents` | GET | `AgentCatalogComponent` | Listar agentes disponíveis |
| `/api/agents/instances` | GET | `AgentGameComponent` | Listar instâncias de agentes |
| `/api/screenplays` | GET | `ScreenplayTreeComponent` | Listar roteiros salvos |
| `/api/screenplays/:id` | GET | `ScreenplayInteractive` | Carregar roteiro específico |
| `/api/screenplays` | POST | `ScreenplayInteractive` | Salvar novo roteiro |
| `/api/screenplays/:id` | PUT | `ScreenplayInteractive` | Atualizar roteiro existente |
| `/execute` | POST | `ConductorChatComponent` | Executar agente com mensagem |
| `/api/v1/stream-execute` | POST | `ConductorChatComponent` | Executar com streaming (SSE) |

### Serviços Angular Compartilhados

**Serviços Utilizados** (via Dependency Injection):

1. **`ScreenplayService`** (`src/app/services/screenplay/screenplay.service.ts`):
   - Gerencia operações CRUD de roteiros
   - Sincroniza com MongoDB
   - Emite eventos de mudança de estado

2. **`AgentExecutionService`** (`src/app/services/agent-execution.ts`):
   - Rastreia estado de execução de agentes (pending, queued, running, completed, error)
   - Subscrição via Observable para atualizações em tempo real

3. **`AgentMetricsService`** (`src/app/services/agent-metrics.service.ts`):
   - Coleta e agrega métricas de execução
   - Fornece dados para `AgentGameComponent` e `GamifiedPanelComponent`

4. **`ScreenplayKpiService`** (`src/app/services/screenplay-kpi.service.ts`):
   - Calcula KPIs de roteiro (agentes ativos, execuções totais, última execução)
   - Atualiza painel gamificado em tempo real

5. **`GamificationEventsService`** (`src/app/services/gamification-events.service.ts`):
   - Publica eventos de execução para o ticker
   - Suporta filtros (all, result, debug)

6. **`NotificationService`** (`src/app/services/notification.service.ts`):
   - Exibe toasts de notificação (sucesso, erro, aviso)
   - Usado em operações de salvamento, exportação, etc.

7. **`CouncilorSchedulerService`** (`src/app/services/councilor-scheduler.service.ts`):
   - Gerencia agentes "conselheiros" (promoted agents)
   - Agenda execuções automáticas periódicas

---

## 🔧 Menus e Modais Acionados por Botões

### 📌 Modais da Toolbar (Coluna Central)

#### 1. **Modal de Exportação** (`.export-modal`)

**Acionado por**: Botão "📤 Exportar" na toolbar
**Caminho HTML**: `screenplay-interactive.html:226-251`
**Estilos**: `screenplay-layout.css:500-670`

**Funcionalidade**:
- Solicita nome do arquivo para exportação
- Padrão: `roteiro-vivo.md`
- Ao confirmar, abre diálogo nativo do sistema operacional para escolher local de salvamento
- Arquivo `.md` inclui agentes embarcados como comentários HTML

**Estrutura**:
```html
<div class="modal-overlay">
  <div class="export-modal">
    <div class="modal-header">
      <h3>📤 Exportar Roteiro para Disco</h3>
      <button class="close-btn">×</button>
    </div>
    <div class="modal-body">
      <input [(ngModel)]="exportFilename" placeholder="roteiro-vivo.md">
    </div>
    <div class="modal-footer">
      <button class="btn-cancel">Cancelar</button>
      <button class="btn-export">Escolher Local e Exportar</button>
    </div>
  </div>
</div>
```

**Método Associado**: `confirmExport()` em `ScreenplayInteractive`

#### 2. **Modal de Diretório de Trabalho** (`.working-dir-modal`)

**Acionado por**: Menu "⚙️ Configurações" → "📁 Configurar Diretório de Trabalho"
**Caminho HTML**: `screenplay-interactive.html:303-339`
**Estilos**: `screenplay-layout.css:782-951`

**Funcionalidade**:
- Define diretório padrão (`cwd`) para novos agentes do roteiro atual
- Exemplo: `/mnt/ramdisk/primoia-main/conductor-community`
- Novos agentes herdam automaticamente este `cwd`
- Salvo no campo `metadata.workingDirectory` do roteiro no MongoDB

**Estrutura**:
```html
<div class="modal-overlay">
  <div class="modal-content working-dir-modal">
    <div class="modal-header">
      <h3>📁 Configurar Diretório de Trabalho do Roteiro</h3>
    </div>
    <div class="modal-body">
      <div class="current-dir">
        <label>Diretório Atual:</label>
        <code>{{ currentWorkingDirectory }}</code>
      </div>
      <input [(ngModel)]="tempWorkingDirectory" placeholder="/caminho/do/projeto">
    </div>
    <div class="modal-footer">
      <button class="btn-cancel">Cancelar</button>
      <button class="btn-save">Salvar Diretório</button>
    </div>
  </div>
</div>
```

**Método Associado**: `saveWorkingDirectory()` em `ScreenplayInteractive`

#### 3. **Modal de Atalhos de Teclado** (`.screenplay-info-modal`)

**Acionado por**: Menu "⚙️ Configurações" → "⌨️ Atalhos de Teclado"
**Caminho HTML**: `screenplay-interactive.html:341-382`
**Estilos**: `screenplay-layout.css:684-760`

**Funcionalidade**:
- Exibe lista de atalhos de teclado disponíveis
- Apenas leitura (não permite customização)

**Atalhos Listados**:

| Atalho | Descrição |
|--------|-----------|
| Ctrl+S | Salvar roteiro |
| Ctrl+N | Novo roteiro |
| Ctrl+O | Abrir roteiro do banco |
| Ctrl+Shift+A | Adicionar agente |
| Ctrl+E | Exportar para disco |
| Ctrl+I | Importar do disco |

**Estrutura**:
```html
<div class="modal-overlay">
  <div class="screenplay-info-modal">
    <div class="modal-header">
      <h3>⌨️ Atalhos de Teclado</h3>
    </div>
    <div class="modal-body">
      <div class="shortcuts-grid">
        <div class="shortcut-item">
          <kbd>Ctrl</kbd> + <kbd>S</kbd>
          <span>Salvar roteiro</span>
        </div>
        <!-- ... outros atalhos ... -->
      </div>
    </div>
  </div>
</div>
```

#### 4. **Modal de Seleção de Agente** (`AgentSelectorModalComponent`)

**Acionado por**:
- Botão "➕" no dock do chat
- Atalho Ctrl+Shift+A
- Método `openAgentSelector()` em `ScreenplayInteractive`

**Caminho**: `src/app/living-screenplay-simple/agent-selector-modal/agent-selector-modal.component.ts`
**Template**: `agent-selector-modal.component.html`

**Funcionalidade**:
- Lista todos os agentes disponíveis no catálogo
- Permite busca e filtro
- Ao selecionar um agente, emite evento `agentSelected`
- Agente é instanciado no roteiro atual

**Eventos Emitidos**:
- `agentSelected`: Emite objeto `Agent` selecionado
- `close`: Fecha o modal sem selecionar

#### 5. **Modal de Preview de Agente** (`AgentPreviewModalComponent`)

**Acionado por**: Após selecionar agente no `AgentSelectorModal`
**Caminho**: `src/app/living-screenplay-simple/agent-preview-modal/agent-preview-modal.component.ts`
**Template**: `agent-preview-modal.component.html`

**Funcionalidade**:
- Exibe detalhes completos do agente antes de instanciar
- Mostra: emoji, título, descrição, persona, procedimento operacional
- Botões "Aceitar" / "Rejeitar"

**Eventos Emitidos**:
- `accept`: Confirma instanciação do agente
- `reject`: Cancela operação
- `close`: Fecha o modal

#### 6. **Modal de Resolução de Conflitos** (`ConflictResolutionModalComponent`)

**Acionado por**: Importação de roteiro com nome duplicado
**Caminho**: `src/app/living-screenplay-simple/conflict-resolution-modal/conflict-resolution-modal.component.ts`
**Template**: `conflict-resolution-modal.component.html`

**Funcionalidade**:
- Detecta quando arquivo importado tem mesmo nome de roteiro existente
- Oferece 3 opções:
  1. **Substituir**: Sobrescreve roteiro existente
  2. **Renomear**: Cria novo roteiro com nome diferente
  3. **Cancelar**: Aborta importação

**Estrutura de Dados**:
```typescript
interface ConflictResolution {
  action: 'replace' | 'rename' | 'cancel';
  newName?: string; // Usado apenas se action === 'rename'
}
```

**Eventos Emitidos**:
- `resolve`: Emite decisão do usuário

#### 7. **Modal de Dashboard de Conselheiros** (`CouncilorsDashboardComponent`)

**Acionado por**: Botão "🏛️ Conselheiros" na toolbar
**Caminho**: `src/app/living-screenplay-simple/councilors-dashboard/councilors-dashboard.component.ts`
**Template**: `councilors-dashboard.component.html`

**Funcionalidade**:
- Lista agentes promovidos a "conselheiros" (ministros)
- Conselheiros executam tarefas automaticamente em agenda configurável
- Permite promover novos agentes
- Exibe métricas de cada conselheiro (execuções, sucesso, falhas)

**Eventos Emitidos**:
- `close`: Fecha o dashboard
- `promoteNew`: Abre modal de promoção de agente

#### 8. **Modal de Promoção de Conselheiro** (`PromoteCouncilorModalComponent`)

**Acionado por**: Botão "Promover Novo" no Dashboard de Conselheiros
**Caminho**: `src/app/living-screenplay-simple/promote-councilor-modal/promote-councilor-modal.component.ts`
**Template**: `promote-councilor-modal.component.html`

**Funcionalidade**:
- Exibe formulário para configurar agente conselheiro
- Define: título, descrição, agenda de execução (cron), prioridade
- Ao confirmar, agente é promovido e adicionado ao scheduler

**Eventos Emitidos**:
- `promote`: Emite configuração do conselheiro
- `close`: Cancela operação

### 📌 Modais do Chat Panel (Terceira Coluna)

#### 9. **Modal de Contexto do Agente** (`.modal-backdrop`)

**Acionado por**: Menu de opções do agente (⚙️) → "📋 Ver Contexto"
**Caminho HTML**: Inline no template de `ConductorChatComponent`

**Funcionalidade**:
- Exibe persona e procedimento operacional do agente selecionado
- Indica se persona foi editada (badge "editada")
- Oferece botão "🔄 Restaurar original" se editada

**Estrutura**:
```html
<div class="modal-backdrop">
  <div class="modal-content">
    <div class="modal-header">
      <h4>📋 Contexto do Agente</h4>
    </div>
    <div class="modal-body">
      <div class="context-item">
        <div>👤 Persona</div>
        <div>{{ activeAgentContext?.persona }}</div>
      </div>
      <div class="context-item">
        <div>📜 Procedimento</div>
        <div>{{ activeAgentContext?.operating_procedure }}</div>
      </div>
    </div>
  </div>
</div>
```

#### 10. **Modal de Edição de Persona** (`PersonaEditModalComponent`)

**Acionado por**: Menu de opções do agente (⚙️) → "✏️ Editar Persona"
**Caminho**: `src/app/shared/persona-edit-modal/persona-edit-modal.component.ts`

**Funcionalidade**:
- Permite customizar a persona de um agente específico
- Persona editada é salva no campo `customPersona` da instância
- Afeta apenas aquela instância, não o agente global

**Eventos Emitidos**:
- `personaSaved`: Emite nova persona customizada
- `closeModal`: Fecha o modal

#### 11. **Modal de Configuração de CWD do Agente** (`.cwd-modal`)

**Acionado por**: Menu de opções do agente (⚙️) → "📁 Configurar Diretório"
**Caminho HTML**: Inline no template de `ConductorChatComponent`

**Funcionalidade**:
- Define `cwd` específico para o agente selecionado
- Sobrescreve `cwd` padrão do roteiro (se existir)
- Usado quando agente precisa rodar em diretório diferente dos demais

**Estrutura**:
```html
<div class="modal-backdrop">
  <div class="modal-content cwd-modal">
    <div class="modal-header">
      <h4>📁 Definir Diretório de Trabalho</h4>
    </div>
    <div class="modal-body">
      <input [(ngModel)]="tempCwd" placeholder="/mnt/ramdisk/meu-projeto">
      <button (click)="saveCwd()">Salvar</button>
    </div>
  </div>
</div>
```

**Método Associado**: `saveCwd()` em `ConductorChatComponent`

#### 12. **Modal de Informações da Dock** (`.dock-info-modal`)

**Acionado por**: Botão "❓" no dock de agentes
**Caminho HTML**: Inline no template de `ConductorChatComponent`

**Funcionalidade**:
- Explica o que é o dock de agentes
- Tutorial rápido de como usar (adicionar, selecionar, excluir)

### 📌 Modais Globais (Independentes de Coluna)

#### 13. **Modal de Gerenciador de Roteiros** (`ScreenplayManager`)

**Acionado por**: Botão "📂 Abrir do Banco..." na toolbar
**Caminho**: `src/app/living-screenplay-simple/screenplay-manager/screenplay-manager.ts`
**Template**: `screenplay-manager.html`

**Funcionalidade**:
- Lista todos os roteiros salvos no MongoDB
- Permite busca por nome
- Oferece ações: abrir, renomear, excluir
- Exibe data de criação e última modificação

**Eventos Emitidos**:
- `action`: Emite evento `ScreenplayManagerEvent` com tipo de ação e ID do roteiro
- `close`: Fecha o modal

#### 14. **Modal de Criação de Agente** (`AgentCreatorComponent`)

**Acionado por**: Botão "Criar Novo" no `AgentCatalogComponent`
**Caminho**: `src/app/living-screenplay-simple/agent-creator/agent-creator.component.ts`
**Template**: `agent-creator.component.html`

**Funcionalidade**:
- Formulário para criar agente customizado
- Campos: nome, descrição, emoji, persona, procedimento operacional
- Salva agente no MongoDB via API

**Eventos Emitidos**:
- `agentCreated`: Emite objeto `AgentCreationData` com dados do novo agente
- `close`: Fecha o modal sem criar

#### 15. **Modal de Confirmação de Exclusão** (`.delete-confirm-modal`)

**Acionado por**: Botão "🗑️ Excluir Agente" no dock do chat
**Caminho HTML**: `screenplay-interactive.html:268-292`

**Funcionalidade**:
- Exibe informações do agente a ser excluído (emoji, nome, descrição)
- Requer confirmação explícita antes de excluir
- Exclusão remove instância do MongoDB e do roteiro

**Estrutura**:
```html
<div class="modal-backdrop">
  <div class="modal-content delete-confirm-modal">
    <div class="modal-header">
      <h3>🗑️ Excluir Agente</h3>
    </div>
    <div class="modal-body">
      <div class="agent-display">
        <div>{{ agentToDelete.emoji }}</div>
        <div>{{ agentToDelete.definition.title }}</div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-secondary">Cancelar</button>
      <button class="btn-danger">Excluir Agente</button>
    </div>
  </div>
</div>
```

**Método Associado**: `confirmDeleteAgent()` em `ScreenplayInteractive`

#### 16. **Modal de Relatório** (`ReportModalComponent`)

**Acionado por**: Clique em evento no ticker com tipo "result"
**Caminho**: `src/app/living-screenplay-simple/report-modal/report-modal.component.ts`
**Template**: `report-modal.component.html`

**Funcionalidade**:
- Exibe relatório detalhado de execução de agente
- Mostra: timestamp, status, mensagem, logs, duração
- Botão "🔄 Refresh" atualiza dados do relatório

**Eventos Emitidos**:
- `close`: Fecha o modal
- `refresh`: Recarrega dados do relatório

#### 17. **Modal de Launcher de Investigação** (`InvestigationLauncherComponent`)

**Acionado por**: Botão "🔍 Investigar" em um evento do ticker
**Caminho**: `src/app/living-screenplay-simple/investigation-launcher/investigation-launcher.component.ts`
**Template**: `investigation-launcher.component.html`

**Funcionalidade**:
- Permite criar nova investigação a partir de um evento
- Seleciona agente investigador e define contexto
- Investigação é uma execução especial de agente com foco analítico

**Eventos Emitidos**:
- `launchInvestigation`: Emite `InvestigationRequest` com agente e contexto
- `close`: Cancela investigação

#### 18. **Modal de Personalização de Agentes** (`AgentPersonalizationModalComponent`)

**Acionado por**: Botão "⚙️" no painel gamificado (quando expandido)
**Caminho**: `src/app/living-screenplay-simple/agent-personalization-modal/agent-personalization-modal.component.ts`
**Template**: `agent-personalization-modal.component.html`

**Funcionalidade**:
- Configurações globais de exibição de agentes
- Opções de tema, visualização (lista/grid), filtros padrão
- Configurações salvas em localStorage

**Eventos Emitidos**:
- `close`: Fecha o modal

#### 19. **Toast de Notificação** (`NotificationToastComponent`)

**Acionado por**: Chamadas ao `NotificationService` em qualquer componente
**Caminho**: `src/app/living-screenplay-simple/notification-toast/notification-toast.component.ts`
**Template**: `notification-toast.component.html`

**Funcionalidade**:
- Exibe notificações temporárias no canto superior direito
- Tipos: sucesso (verde), erro (vermelho), aviso (amarelo), info (azul)
- Auto-dismiss após 3-5 segundos

**Exemplos de Uso**:
```typescript
this.notificationService.success('Roteiro salvo com sucesso!');
this.notificationService.error('Erro ao executar agente');
this.notificationService.warning('Diretório de trabalho não definido');
```

---

## 🎨 Classes CSS Principais por Seção

### Layout Geral

| Classe | Arquivo | Linha | Descrição |
|--------|---------|-------|-----------|
| `.screenplay-layout` | `screenplay-layout.css` | 6 | Container principal (display: flex, 100vh) |
| `.screenplay-container` | `screenplay-layout.css` | 13 | Container das 3 colunas (redimensionável) |
| `.splitter` | `screenplay-layout.css` | 134 | Divisor arrastável entre colunas |

### Primeira Coluna

| Classe | Arquivo | Linha | Descrição |
|--------|---------|-------|-----------|
| `.first-column` | `screenplay-layout.css` | 21 | Container da primeira coluna |
| `.first-column-tabs` | `screenplay-layout.css` | 31 | Navegação de abas |
| `.tab-button` | `screenplay-layout.css` | 40 | Botão de aba individual |
| `.tab-button.active` | `screenplay-layout.css` | 62 | Aba ativa (gradiente roxo) |
| `.first-column-content` | `screenplay-layout.css` | 73 | Container de conteúdo das abas |

### Coluna Central

| Classe | Arquivo | Linha | Descrição |
|--------|---------|-------|-----------|
| `.screenplay-canvas` | `screenplay-layout.css` | 174 | Container da coluna central |
| `.editor-toolbar` | `screenplay-layout.css` | 184 | Barra de ferramentas |
| `.toolbar-btn` | `screenplay-layout.css` | 219 | Botão da toolbar |
| `.toolbar-btn.saving` | `screenplay-layout.css` | 249 | Estado "salvando" (gira) |
| `.toolbar-btn.dirty` | `screenplay-layout.css` | 256 | Estado "modificado" (pulsa) |
| `.editor-content` | `screenplay-layout.css` | 273 | Container do editor Markdown |
| `.editor-footer` | `screenplay-layout.css` | 281 | Rodapé com painel gamificado |

### Terceira Coluna

| Classe | Arquivo | Linha | Descrição |
|--------|---------|-------|-----------|
| `.chat-panel` | `screenplay-layout.css` | 159 | Container do painel de chat |
| `.chat-header` | (inline) | - | Cabeçalho do chat (agente ativo) |
| `.chat-body` | (inline) | - | Corpo com mensagens |
| `.agent-launcher-dock` | (inline) | - | Dock de agentes vertical |
| `.dock-item` | (inline) | - | Item de agente no dock |
| `.dock-item.active` | (inline) | - | Agente selecionado |

### Modais

| Classe | Arquivo | Linha | Descrição |
|--------|---------|-------|-----------|
| `.modal-overlay` | `screenplay-layout.css` | 501 | Fundo escuro semitransparente |
| `.export-modal` | `screenplay-layout.css` | 525 | Modal de exportação |
| `.modal-header` | `screenplay-layout.css` | 546 | Cabeçalho padrão de modal |
| `.modal-body` | `screenplay-layout.css` | 585 | Corpo do modal |
| `.modal-footer` | `screenplay-layout.css` | 625 | Rodapé com botões de ação |
| `.working-dir-modal` | `screenplay-layout.css` | 783 | Modal de configuração de CWD |
| `.screenplay-info-modal` | `screenplay-layout.css` | 685 | Modal de atalhos de teclado |
| `.screenplay-settings-menu` | `screenplay-layout.css` | 953 | Menu dropdown de configurações |

---

## 💡 Regras de Negócio Identificadas

### Regra 1: Persistência de Agentes via Comentários HTML
**Descrição**: Cada instância de agente no roteiro é identificada por um UUID v4 único, embarcado no Markdown como comentário HTML invisível (`<!-- agent-instance:uuid -->`).
**Implementação**: `screenplay-interactive.ts:61-79` (interface `AgentInstance`) e lógica de parsing em `markdown-screenplay.ts`

### Regra 2: Sincronização Dual (MongoDB + Markdown)
**Descrição**: O estado dos agentes é salvo tanto no MongoDB (coleção `agent_instances`) quanto no arquivo Markdown (comentários HTML), garantindo persistência e portabilidade.
**Implementação**: Métodos `save()` e `syncAgentsWithMarkdown()` em `screenplay-interactive.ts`

### Regra 3: Salvamento Automático com Debounce
**Descrição**: Após qualquer modificação no editor, um salvamento automático é agendado para 3 segundos depois. Novas modificações resetam o timer.
**Implementação**: `screenplay-interactive.ts:256-260` (propriedade `AUTO_SAVE_DELAY` e `autoSaveTimeout`)

### Regra 4: Isolamento de Histórico de Chat por Agente
**Descrição**: Cada instância de agente mantém seu próprio histórico de conversas isolado. Trocar de agente no dock muda o contexto do chat.
**Implementação**: `conductor-chat.component.ts` e lógica de carregamento de histórico via `agentId`

### Regra 5: Herança de CWD (Diretório de Trabalho)
**Descrição**: Novos agentes criados em um roteiro herdam automaticamente o `cwd` configurado no roteiro. Agentes podem ter `cwd` customizado individual.
**Implementação**: Propriedade `currentWorkingDirectory` em `screenplay-interactive.ts` e modal de configuração

### Regra 6: Redimensionamento Proporcional de Colunas
**Descrição**: Ao arrastar o splitter, as colunas redimensionam proporcionalmente. A soma das larguras sempre é 100%.
**Implementação**: Método `onSplitterMouseDown()` e cálculo de `screenplayWidth` / `chatWidth` em `screenplay-interactive.ts:150-152`

### Regra 7: Identificação de Agentes por Emoji
**Descrição**: Cada emoji no texto corresponde a uma definição de agente no dicionário `AGENT_DEFINITIONS`. O sistema permite múltiplas instâncias do mesmo emoji.
**Implementação**: `screenplay-interactive.ts:82-102` (constante `AGENT_DEFINITIONS`)

### Regra 8: Status de Execução em Tempo Real
**Descrição**: O status de cada agente (pending, queued, running, completed, error) é sincronizado via `AgentExecutionService` e refletido visualmente no dock e na lista de instâncias.
**Implementação**: Subscrição a `agentExecutionService.agentState$` em `screenplay-interactive.ts:300`

### Regra 9: Conselheiros (Councilors) com Execução Agendada
**Descrição**: Agentes promovidos a "conselheiros" são executados automaticamente em intervalos regulares (configuráveis via cron). Aparecem com badge especial na lista de instâncias.
**Implementação**: `CouncilorSchedulerService` e propriedade `isCouncilor` em `AgentInstance`

### Regra 10: Conflito de Nomes na Importação
**Descrição**: Ao importar um arquivo `.md` com nome que já existe no banco, o sistema exibe modal de resolução com opções: substituir, renomear ou cancelar.
**Implementação**: `ConflictResolutionModalComponent` acionado em `handleFileSelect()` de `screenplay-interactive.ts`

---

## 🎓 Conceitos-Chave

### Documento Vivo (Living Screenplay)
Arquivo Markdown que contém não apenas texto, mas também agentes de IA "vivos" embarcados como âncoras (emojis). Esses agentes podem ser acionados para executar tarefas contextuais diretamente no documento.

### Âncora de Agente
Um emoji específico no texto que atua como ponto de ancoragem para uma instância de agente. Por exemplo, `🚀` pode representar um "Performance Agent" que monitora métricas do sistema.

### Instância de Agente
Um agente específico ligado a um emoji em um roteiro. Cada instância tem ID único, posição no documento, histórico de conversas isolado e configuração individual (cwd, persona customizada, etc.).

### Agent Dock
Barra vertical no painel de chat que exibe emojis de agentes instanciados no roteiro atual. Permite seleção rápida de qual agente conversar.

### Conselheiro (Councilor)
Agente promovido que executa tarefas automaticamente em intervalos regulares (agendamento via cron). Usado para monitoramento contínuo, testes periódicos, etc.

### Splitter
Divisor arrastável entre colunas que permite redimensionamento manual da interface. Mantém proporções e limites mínimos/máximos.

### KPIs (Key Performance Indicators)
Métricas exibidas no painel gamificado: número de agentes ativos, total de execuções, última execução, investigações ativas. Atualizados em tempo real.

### Event Ticker
Componente que exibe fluxo contínuo de eventos de execução de agentes (resultados, logs de debug, avisos). Suporta filtros e permite investigação a partir de eventos.

### CWD (Current Working Directory)
Diretório de trabalho onde agentes executam comandos shell. Pode ser definido globalmente no roteiro ou individualmente por agente.

### Persona Customizada
Versão editada da persona padrão de um agente, aplicada apenas àquela instância específica. Permite ajustes finos de comportamento sem alterar o agente global.

### Markdown Aumentado
Conceito de usar Markdown como formato base e adicionar uma camada de inteligência (agentes, comandos de barra, sintaxe estendida) sem quebrar compatibilidade com renderizadores padrão.

---

## 📌 Observações

### Performance e Escalabilidade
- **Renderização de Canvas**: O `AgentGameComponent` usa Canvas 2D para renderizar até centenas de agentes simultaneamente. Performance pode degradar com >500 instâncias.
- **Polling de Métricas**: O `ScreenplayKpiService` faz polling a cada 30 segundos. Para sistemas de alta frequência, considerar WebSockets.
- **Auto-save**: O debounce de 3 segundos evita salvamentos excessivos, mas mudanças rápidas podem causar race conditions. Implementar fila de salvamento seria ideal.

### Acessibilidade
- **Atalhos de Teclado**: Todos os principais botões têm atalhos de teclado configurados (`@HostListener` em `screenplay-interactive.ts`).
- **ARIA Labels**: O painel gamificado tem `role="complementary"` e `aria-label`, mas outros componentes precisariam de melhorias de acessibilidade.
- **Contraste de Cores**: Alguns botões coloridos (roxo, azul) podem ter baixo contraste em temas claros.

### Segurança
- **Sanitização de Caminhos**: O `ScreenplayTreeComponent` remove prefixos sensíveis (`/home/`, `/Users/`) antes de exibir caminhos, evitando vazamento de informações.
- **Validação de CWD**: Não há validação se o `cwd` configurado existe ou se o usuário tem permissões. Agentes podem falhar silenciosamente.
- **XSS no Editor**: O TipTap tem sanitização embutida, mas cuidado ao renderizar HTML customizado de agentes.

### Melhorias Sugeridas (Opcional)
- **Drag & Drop de Agentes**: Permitir arrastar emojis do catálogo diretamente para o editor
- **Busca Global**: Campo de busca que procura em todos os roteiros simultaneamente
- **Temas Customizáveis**: Suportar light/dark mode com persistência em localStorage
- **Exportação Batch**: Exportar múltiplos roteiros de uma vez
- **Versionamento**: Histórico de versões de roteiros (tipo "Time Machine")
- **Colaboração Real-Time**: Usar WebSockets para edição colaborativa (tipo Google Docs)

### Dependências Externas
- **TipTap**: Editor WYSIWYG baseado em ProseMirror
- **Lowlight**: Syntax highlighting para blocos de código
- **TurndownService**: Conversão HTML → Markdown
- **RxJS**: Programação reativa para gerenciamento de estado
- **Angular 18+**: Framework base

### Estrutura de Arquivos Resumida
```
src/app/living-screenplay-simple/
├── screenplay-interactive.html          # Template principal das 3 colunas
├── screenplay-interactive.ts            # Lógica do componente principal
├── screenplay-layout.css                # Estilos do layout
├── screenplay-controls.css              # Estilos dos controles
├── screenplay-agents.css                # Estilos dos agentes
├── screenplay-popup.css                 # Estilos de popups
├── screenplay-animations.css            # Animações CSS
├── screenplay-tree/
│   ├── screenplay-tree.component.ts     # Árvore de roteiros
│   ├── screenplay-tree.component.html
│   └── screenplay-tree.component.css
├── agent-game/
│   ├── agent-game.component.ts          # Minigame de instâncias
│   ├── agent-game.component.html
│   └── agent-game.component.css
├── agent-catalog/
│   ├── agent-catalog.component.ts       # Catálogo de agentes
│   ├── agent-catalog.component.html
│   └── agent-catalog.component.css
├── gamified-panel/
│   └── gamified-panel.component.ts      # Painel de KPIs/eventos
├── event-ticker/
│   └── event-ticker.component.ts        # Ticker de eventos
└── [20+ outros modais e componentes auxiliares]
```

---

## 🎬 Conclusão

O layout de 3 colunas do Screenplay Interactive é uma arquitetura robusta e modular que separa claramente as responsabilidades de **navegação**, **edição** e **interação com agentes**. A estrutura permite workflows eficientes, desde a criação de roteiros até a execução de tarefas complexas com múltiplos agentes de IA.

A persistência dual (MongoDB + Markdown) garante que os documentos são tanto portáveis quanto sincronizados com estado em banco de dados, enquanto o sistema de âncoras de emojis oferece uma interface natural e visual para trabalhar com agentes.

Este documento serve como referência completa para desenvolvedores, designers e analistas que precisam entender ou estender o sistema Screenplay Interactive.

---

**Arquivo gerado automaticamente por Claude (Requirements Engineer Agent)**
**Data**: 2025-11-01
**Versão**: 1.0.0
