# Conductor Web

Project: conductor-web

## Contexto
Interface web para o ecossistema Conductor que transforma documentos Markdown estáticos em painéis de controle interativos ("Documentos Vivos"). Introduz o conceito de "Markdown aumentado por Agentes" onde emojis simples atuam como âncoras para instâncias de Agentes de IA. A aplicação renderiza uma camada visual sobre o texto, transformando cada emoji em componente interativo com persistência invisível via comentários HTML no próprio Markdown.

## Stack
- **Framework**: Angular 20.3.2 (latest)
- **Editor Rico**: TipTap 3.4+ (chat + edição markdown) com Starter Kit
- **Markdown**: marked 16.3+ (renderização), html-to-md, turndown (conversão)
- **Syntax Highlighting**: highlight.js 11.11 + lowlight 2.9
- **Real-time**: EventSource (SSE), WebSocket nativo
- **State Management**: RxJS 7.8 Observables + Angular Services
- **HTTP Client**: HttpClient (Angular built-in)
- **UI**: Angular CDK 20.2, Angular Animations 20.3
- **Build**: Vite + Angular Build 20.3, esbuild
- **Testing**: Jasmine 5.9, Karma 6.4, Karma Coverage
- **Dev Server**: ng serve com proxy config (hot reload)
- **TypeScript**: 5.9.2
- **Package Manager**: npm

## Capacidades Principais
- **Screenplay Interativo**: Carrega arquivos .md e renderiza automaticamente agentes interativos via emojis (🚀, 🎯, 🤖)
- **Persistência de Estado**: IDs únicos injetados no Markdown via comentários HTML invisíveis (`<!-- agent-id: ... -->`), sincronização automática
- **Ancoragem Robusta**: Estado de agentes sobrevive a edições no texto, persistido junto com arquivo .md
- **File System Access API**: Reload de screenplays diretamente do disco sem upload
- **Isolamento de Contexto**: State management limpo ao trocar entre documentos
- **Conversation System**: Gerenciamento de múltiplas conversas paralelas com diferentes agentes dentro de um screenplay
- **Histórico Persistente**: Todas mensagens armazenadas via API REST + MongoDB backend
- **Contexto Rico**: Cada conversa possui contexto markdown editável para documentar objetivos/escopo
- **Deleção Inteligente**: Remove iterações completas (pergunta + resposta) com sistema otimista + rollback automático
- **Edição de Título/Contexto**: Interface visual para organizar e documentar conversas
- **Gamification Real-time**: Sistema híbrido WebSocket + REST polling, exibe eventos de execução de agentes em ticker visual
- **Dados Históricos**: Carrega últimos 50 eventos do backend na inicialização
- **Categorização de Eventos**: Classifica como build, critical, analysis, success, alert (baseado em severidade)
- **Relatórios Detalhados**: Interface com abas (Resultado markdown, Prompt, JSON bruto), exibe duração/status/erros
- **Integração com Tasks**: Busca dados completos via task ID do backend
- **Reconhecimento de Voz**: Web Speech API para transcrição automática, inserção contextual no editor
- **Agentes Contextualizados**: Vinculação de instâncias de agentes a conversas específicas, herança de working directory do screenplay
- **Status em Tempo Real**: Tracking de execução (pending, queued, running, completed, error) com WebSocket updates
- **TipTap Editor**: Editor rico para chat com suporte a markdown, code blocks, task lists, placeholders, colors
