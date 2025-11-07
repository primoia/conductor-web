# Página Screenplay: Resumo Executivo

## 📋 Visão Geral

A **Screenplay** é a interface principal do Conductor Web, funcionando como um **editor de documentos Markdown vivos** que integra inteligência artificial através de agentes executáveis. É onde o usuário cria, edita e orquestra roteiros que combinam documentação com automação.

## 🎯 Conceito Central

A premissa é transformar arquivos `.md` estáticos em **painéis de controle interativos**:
- Emojis no texto (🚀, 🎯, 🤖) atuam como **âncoras para agentes de IA**
- A aplicação injeta comentários HTML invisíveis (`<!-- agent-id: uuid -->`) para persistir o vínculo entre texto e agente
- O usuário pode acionar agentes diretamente do documento, passando contexto para executar tarefas complexas

## 🏗️ Organização dos Elementos

### **1. Projetos (Screenplays)**
- **Armazenamento**: MongoDB (coleção `screenplays`)
- **Identificação**: Cada roteiro tem um ID único, nome, descrição, tags
- **Persistência**: Conteúdo Markdown + metadados (data de criação, versão, diretório de trabalho)
- **Estados**: Novo, do banco de dados, ou importado do disco
- **Árvore de Roteiros**: Interface lateral (`screenplay-tree`) para navegar entre roteiros salvos

### **2. Arquivos .md (Conteúdo)**
- **Editor Interativo**: Componente `InteractiveEditor` baseado em TipTap
- **Sincronização**: O conteúdo do `.md` é sincronizado com o banco em tempo real
- **Dirty State**: Sistema de detecção de mudanças não salvas (flag `isDirty`)
- **Exportação/Importação**:
  - Importar do disco para o banco (`importFromDisk`)
  - Exportar do banco para disco (`exportToDisk`)
- **Chave Única**: Sistema de detecção de duplicatas via `fileKey` (hash do caminho)

### **3. Conversas (Conversations)**
- **Modelo**: Cada agente pode ter múltiplas conversas (`conversation_id`)
- **Histórico**: Mensagens são persistidas e associadas a conversas específicas
- **Sidebar**: Interface `ConversationListComponent` para gerenciar conversas
- **Contexto**: Cada conversa tem seu próprio contexto (persona, procedimento, histórico)
- **Seleção**: O usuário alterna entre conversas; o chat atualiza automaticamente
- **Auto-seleção de Agente**: Ao selecionar uma conversa, o último agente usado nela é automaticamente selecionado
- **Persistência via URL**: Estado da conversa ativa é mantido na URL via parâmetro `conversationId`

### **4. Contexto (Agent Context)**
- **Definição**: Cada agente possui:
  - **Persona**: Descrição do comportamento e especialização do agente
  - **Procedimento**: Instruções operacionais (operating procedure)
  - **Working Directory**: Diretório padrão para execução de comandos
- **Edição**: Contexto pode ser customizado por instância via modais
- **Herança**: Novos agentes herdam o diretório de trabalho do roteiro
- **Persistência**: Salvo no banco junto com a instância do agente

### **5. Chat (Conductor Chat)**
- **Componente**: `ConductorChatComponent` - painel direito da interface
- **Comunicação**: Stream de mensagens via API (`/api/v1/stream-execute`)
- **Dock de Agentes**: Lista de agentes instanciados disponíveis para interação
- **Estados**:
  - `isConnected`: Status da conexão com o backend
  - `isLoading`: Indica processamento em andamento
- **Mensagens**: Histórico completo de interações usuário-agente
- **Reordenação**: Drag-and-drop para organizar agentes no dock

### **6. Input (Entrada de Dados)**
- **Componente**: `ChatInputComponent` dentro do `ConductorChat`
- **Modos**:
  - **Ask**: Pergunta simples ao agente (sem execução)
  - **Execute**: Executa comando/tarefa via agente
- **Recursos**:
  - Reconhecimento de voz (`SpeechRecognitionService`)
  - Comandos slash (`/`) para ações rápidas
  - Envio via Enter ou botão
  - Placeholder dinâmico conforme contexto

### **7. Gerenciamento de Estado via URL**
- **Parâmetros de Query**:
  - `screenplayId`: ID do roteiro ativo
  - `conversationId`: ID da conversa selecionada
  - `instanceId`: ID do agente/instância selecionado
- **Funcionalidades**:
  - **Shareable URLs**: URLs completas podem ser compartilhadas e abertas em novas abas
  - **Estado Persistente**: Reload da página mantém screenplay, conversa e agente selecionados
  - **Deep Linking**: Possibilidade de linkar diretamente para um contexto específico
  - **Sincronização Automática**: URL é atualizada automaticamente ao trocar conversa ou agente
- **Comportamento**:
  - Ao carregar página com URL completa: restaura exatamente o estado especificado
  - Ao clicar numa conversa: URL é atualizada e último agente da conversa é auto-selecionado
  - Ao clicar num agente: URL é atualizada com o `instanceId`
  - Previne conflitos: seleções da URL têm prioridade sobre auto-seleção padrão

## 🔄 Fluxo de Trabalho Típico

1. **Criar ou Abrir Roteiro**: Usuário cria novo roteiro ou abre existente da árvore
2. **Escrever Markdown**: Redige documentação no editor central
3. **Adicionar Agentes**: Insere emojis ou usa modal para criar agentes
4. **Configurar Contexto**: Define persona, procedimento e diretório de trabalho
5. **Iniciar Conversa**: Seleciona agente no dock e envia mensagem no chat
6. **Executar Tarefas**: Agente processa e retorna resultados via stream
7. **Salvar**: Roteiro é persistido no banco (conteúdo + agentes + conversas)
8. **Exportar**: Opcionalmente exporta para disco mantendo histórico

## 🧩 Relacionamentos entre Componentes

```
Screenplay (Roteiro)
├── Content (Markdown)
│   └── Agent Anchors (Emojis com IDs)
├── Agent Instances
│   ├── Definition (emoji, title, description)
│   ├── Context (persona, procedure, cwd)
│   └── Conversations
│       └── Messages (histórico)
├── Working Directory (padrão do roteiro)
└── Metadata (nome, tags, versão)
```

## 💡 Regras de Negócio Principais

1. **Ancoragem Persistente**: IDs de agentes são injetados como comentários HTML no Markdown
2. **Isolamento de Estado**: Trocar de roteiro limpa o estado anterior (agentes, conversas, contexto)
3. **Detecção de Duplicatas**: Importar arquivo existente detecta via `fileKey` e oferece opções (sobrescrever, criar novo, vincular)
4. **Soft Delete**: Agentes e roteiros não são removidos fisicamente, apenas marcados como `isDeleted`
5. **Dirty State Management**: Sistema detecta mudanças não salvas e alerta o usuário
6. **Auto-Save Context**: Contexto de agentes é salvo automaticamente ao editar
7. **URL State Priority**: Parâmetros da URL têm prioridade sobre auto-seleções padrão para garantir deep linking
8. **Auto-seleção de Agente**: Ao trocar de conversa, o último agente usado (por data de atualização) é automaticamente selecionado
9. **Sincronização de URL**: Qualquer mudança de estado (conversa/agente) atualiza a URL em tempo real

## 🎓 Conceitos-Chave

- **Documento Vivo**: Markdown que não é apenas leitura, mas também execução
- **Agente Âncora**: Emoji que serve como ponto de entrada para IA
- **Screenplay**: Roteiro = Projeto = Documento + Agentes + Conversas
- **Instância de Agente**: Cada emoji no documento cria uma instância única
- **Conversa**: Thread de mensagens entre usuário e um agente específico
- **Working Directory**: Diretório onde agentes executam comandos (contexto de execução)

## 📌 Observações Técnicas

- **Layout**: Três colunas principais (menu lateral, editor central, chat direito)
- **Responsividade**: Colunas redimensionáveis via splitter
- **Tabs Laterais**: Abas para Catálogo, Instâncias e Árvore de Roteiros
- **Sincronização**: Conteúdo sincronizado via `ScreenplayStorage` (API REST)
- **Estado Global**: Gerenciado por serviços injetados (Angular DI)
- **Gamificação**: Painel inferior com eventos, KPIs e ticker de atividades
