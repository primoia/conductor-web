# 🎼 Conductor Web: A Interface para Documentos Vivos

Este projeto é a interface de front-end para o ecossistema Conductor, transformando documentos Markdown estáticos em painéis de controle interativos para orquestrar Agentes de IA.

## ✨ Visão do Projeto: Markdown Aumentado por Agentes

A premissa central do Conductor Web é que a documentação não deve ser apenas descritiva, mas também executável. Esta aplicação introduz o conceito de "Documentos Vivos", onde o formato simples e universal do Markdown é "aumentado" com uma camada de inteligência persistente.

### Como Funciona?

1.  **Âncoras de Agentes:** Emojis simples (como `🚀`, `🎯`, `🤖`) dentro de um arquivo `.md` atuam como âncoras para instâncias de Agentes de IA.
2.  **Camada Interativa:** A aplicação renderiza uma camada visual sobre o texto, transformando cada emoji em um componente interativo (um "agente rico").
3.  **Persistência Invisível:** Um ID único para cada agente é injetado de volta no Markdown usando comentários HTML (`<!-- agent-id: ... -->`), que são invisíveis em renderizadores padrão. Isso cria um vínculo persistente entre o texto e o estado do agente.
4.  **Orquestração:** Através desta interface, um usuário pode acionar agentes do poderoso backend do **Conductor**, passando o contexto do documento para executar tarefas complexas como geração de código, análise, testes e muito mais.

Em suma, este projeto transforma o ato de escrever documentação no ato de programar um fluxo de trabalho de IA.

---

## 🚀 Funcionalidades Principais

### 📝 Screenplay Interativo
-   **Sincronização Dinâmica:** Carrega arquivos `.md` e renderiza automaticamente os agentes interativos.
-   **Persistência de Estado:** O estado e a posição dos agentes são salvos e restaurados entre sessões e recarregamentos.
-   **Ancoragem Robusta:** A "inteligência" sobrevive a edições no texto e é salva junto com o arquivo `.md`.
-   **Reload de Disco:** Recarga screenplays diretamente do sistema de arquivos usando File System Access API.
-   **Isolamento de Contexto:** O estado é gerenciado de forma limpa ao trocar entre diferentes documentos.

### 💬 Sistema de Conversas Unificado
-   **Múltiplas Conversas:** Gerencie diversas conversas paralelas com diferentes agentes dentro de um mesmo screenplay.
-   **Histórico Persistente:** Todas as mensagens são armazenadas e podem ser recuperadas entre sessões.
-   **Contexto Rico:** Cada conversa possui contexto markdown editável para documentar objetivos e escopo.
-   **Deleção Inteligente:** Remova iterações completas (pergunta + resposta) com sistema otimista e rollback automático.
-   **Edição de Título e Contexto:** Interface visual para organizar e documentar conversas.

### 🎮 Sistema de Gamificação em Tempo Real
-   **Eventos Híbridos:** Combina WebSocket para tempo real com polling de métricas como fallback.
-   **Dados Históricos:** Carrega últimos 50 eventos do backend na inicialização.
-   **Ticker Visual:** Exibe eventos de execução de agentes em tempo real com diferentes níveis de severidade.
-   **Categorização Inteligente:** Classifica eventos como build, critical, analysis, success ou alert.

### 📊 Sistema de Relatórios Detalhados
-   **Interface com Abas:** Navegue entre Resultado (markdown), Prompt e JSON bruto.
-   **Detalhes Completos:** Exibe informações de execução incluindo duração, status e erros.
-   **Integração com Tasks:** Busca dados completos do backend via task ID.
-   **Renderização de Markdown:** Apresenta resultados formatados de forma legível.

### 🎤 Integração de Voz
-   **Reconhecimento de Fala:** Transcrição automática usando Web Speech API.
-   **Inserção Contextual:** Texto transcrito é inserido automaticamente no editor de mensagens.
-   **Interface Intuitiva:** Botão de microfone com toggle para iniciar/parar gravação.

### 🎯 Agentes Contextualizados
-   **Vinculação a Conversas:** Cada instância de agente pode ser associada a uma conversa específica.
-   **Working Directory:** Herança automática do diretório de trabalho do screenplay.
-   **Múltiplos Participantes:** Conversas podem ter vários agentes colaborando.
-   **Status em Tempo Real:** Acompanhe execução (pending, queued, running, completed, error).

---

## 🏗️ Arquitetura e Tecnologias

### Stack Tecnológico
- **Framework:** Angular 20.3.2
- **Editor de Texto Rico:** TipTap (para chat e edição markdown)
- **Renderização Markdown:** Biblioteca `marked`
- **Comunicação em Tempo Real:** WebSocket + Server-Sent Events (SSE)
- **API Backend:** FastAPI (Python) com MongoDB
- **Gerenciamento de Estado:** RxJS Observables + Services

### Componentes Principais

#### Frontend (Angular)
- **ScreenplayInteractive** (`screenplay-interactive.ts`): Componente central para gerenciar screenplays interativos e instâncias de agentes
- **ConductorChatComponent**: Interface de chat unificada com suporte a múltiplos agentes
- **ConversationListComponent**: Sidebar para navegação e gerenciamento de conversas
- **ReportModalComponent**: Visualização detalhada de resultados de tarefas
- **GamifiedPanelComponent**: Painel de gamificação com ticker de eventos

#### Serviços
- **ConversationService**: CRUD de conversas e mensagens via API REST
- **GamificationEventsService**: Sistema híbrido de eventos (WebSocket + REST)
- **ScreenplayService**: Gerenciamento de screenplays e sincronização com disco
- **SpeechRecognitionService**: Integração com Web Speech API
- **AgentMetricsService**: Polling de métricas de execução de agentes

### Modelos de Dados

```typescript
// Conversa com histórico de mensagens
interface Conversation {
  conversation_id: string;
  title: string;
  context?: string;  // Markdown
  participants: AgentInfo[];
  messages: Message[];
  screenplay_id?: string;
}

// Instância de agente vinculada a conversa
interface AgentInstance {
  id: string;  // UUID
  agent_id?: string;
  conversation_id?: string;
  emoji: string;
  status: 'pending' | 'queued' | 'running' | 'completed' | 'error';
  config?: { cwd?: string };
}

// Evento de gamificação
interface GamificationEvent {
  id: string;
  title: string;
  severity: 'info' | 'warning' | 'error';
  timestamp: number;
  category?: 'build' | 'critical' | 'analysis' | 'success' | 'alert';
}
```

Para documentação arquitetural completa, consulte:
- [Visão e Conceito](/docs/01_VISION_AND_CONCEPT.md)
- [Arquitetura da Solução](/docs/02_ARCHITECTURE.md)
- [Guia do Usuário](/docs/03_USER_GUIDE.md)

---

## 🛠️ Desenvolvimento e Execução (Baseado no Angular CLI v20.3.2)

### Servidor de Desenvolvimento

Para iniciar um servidor de desenvolvimento local, execute:

```bash
ng serve
```

Navegue para `http://localhost:4200/`. A aplicação será recarregada automaticamente se você modificar os arquivos-fonte.

### Geração de Código (Scaffolding)

Para gerar um novo componente, execute:

```bash
ng generate component nome-do-componente
```

Você também pode usar `ng generate directive|pipe|service|class|guard|interface|enum|module`.

### Build para Produção

Para construir o projeto para produção, execute:

```bash
ng build
```

Os artefatos da construção serão armazenados no diretório `dist/`.

### Executando Testes Unitários

Para executar os testes unitários via [Karma](https://karma-runner.github.io), use o seguinte comando:

```bash
ng test
```

---

## 📚 Recursos Adicionais

Para mais informações sobre o Angular CLI, visite a [Visão Geral e Referência de Comandos do Angular CLI](https://angular.dev/tools/cli).
