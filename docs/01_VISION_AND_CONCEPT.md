# 📄 Visão e Conceito: Documentos Vivos Aumentados por Agentes

## 1. O Problema: A Divisão Entre Ideia e Execução

No desenvolvimento de software moderno, existe um abismo fundamental entre a **documentação** e o **código**.

-   **Documentos (Requisitos, Planos, Arquitetura):** São estáticos, descritivos e rapidamente se tornam desatualizados. Eles representam a *intenção*.
-   **Código (A Aplicação):** É dinâmico, funcional e a fonte final da verdade. Ele representa a *execução*.

Essa divisão cria atrito, retrabalho e uma desconexão persistente entre o que foi planejado e o que foi construído. A documentação se torna um artefato histórico em vez de uma ferramenta viva.

## 2. A Solução: Unificando Intenção com Execução

O **Conductor Web** propõe uma solução radical para este problema: **transformar o próprio documento em uma interface de execução.**

A premissa é simples, mas poderosa: *E se um documento de requisitos não apenas descrevesse uma funcionalidade, mas também pudesse orquestrar sua criação? E se um plano de projeto pudesse acionar os agentes de IA responsáveis por executar cada etapa?*

Este projeto introduz o paradigma de **"Documentos Vivos"**, onde o formato universal e legível do Markdown é "aumentado" com uma camada de inteligência persistente, conectando diretamente a intenção humana à capacidade de execução da IA.

## 3. O Paradigma: Markdown Como uma Interface de Programação

No coração desta visão está a redefinição do papel do Markdown. Ele deixa de ser um formato passivo para se tornar um "painel de controle" interativo.

-   **Âncoras de Agentes:** Emojis simples e semanticamente ricos (como `🚀` para performance, `🔐` para segurança, `🤖` para geração de código) são usados como "âncoras" no texto. Eles são a representação visual de uma tarefa ou de um conceito.

-   **Camada Interativa:** A aplicação Conductor Web renderiza uma camada visual sobre o documento. Cada emoji-âncora ganha vida como um "agente rico" — um componente clicável, com estado (pendente, em progresso, concluído), capaz de acionar fluxos de trabalho complexos.

-   **Persistência Invisível:** Para criar um vínculo robusto entre o texto e o estado do agente (armazenado em um banco de dados como o MongoDB), um ID único (UUID) é injetado no Markdown através de um comentário HTML (`<!-- agent-id: ... -->`). Esta âncora é invisível para renderizadores comuns, preservando a limpeza e a portabilidade do documento, mas é a chave para a "memória" do sistema.

-   **Orquestração Contextual:** Ao interagir com um agente rico, o usuário aciona o ecossistema de agentes do **Conductor** no backend. Crucialmente, o **contexto local** do documento (o parágrafo ou a seção ao redor da âncora) é passado como input para o agente. Isso permite que a IA opere com um entendimento preciso da tarefa, diretamente a partir da fonte de requisitos.

## 4. Casos de Uso e Potencial

Esta abordagem desbloqueia fluxos de trabalho que antes eram impossíveis:

-   **Requisitos Executáveis:** Um documento de requisitos de produto (PRD) pode ter um agente `🤖` ao lado de cada especificação de funcionalidade. Clicar nele aciona um `CodeGenerator_Agent` para criar o boilerplate do código.
-   **Planos de Projeto Vivos:** Um plano de projeto pode listar tarefas com emojis `✅`. Clicar neles pode acionar um `Testing_Agent` para validar a implementação ou um `Deployment_Agent` para mover um card no Jira.
-   **Documentação Interativa:** A documentação de uma API pode ter agentes `⚡` que executam testes de performance em tempo real naquele endpoint específico.
-   **Code Reviews Contextuais:** Um desenvolvedor pode solicitar um code review simplesmente colocando um emoji `🧐` em um bloco de código dentro de um documento de pull request.

Em suma, o Conductor Web visa fechar o ciclo entre a ideação e a automação, transformando o ato de escrever em uma forma de programar e orquestrar sistemas de Inteligência Artificial.

## 5. Evolução do Sistema: Funcionalidades Implementadas

Desde a concepção inicial, o sistema evoluiu significativamente com novas capacidades:

### 5.1 Sistema de Conversas Contextualizadas

O conceito original de agentes isolados foi expandido para um **modelo de conversas persistentes**:

-   **Conversas como Unidade de Contexto:** Cada conversa agrupa múltiplas iterações (perguntas e respostas) com um ou mais agentes, mantendo contexto compartilhado.
-   **Histórico Recuperável:** Todo o histórico de mensagens é preservado no backend (MongoDB), permitindo retomar conversas em qualquer momento.
-   **Contexto Markdown:** Cada conversa possui um campo de contexto editável em markdown, servindo como "termos de referência" para os agentes.
-   **Múltiplos Agentes Colaborativos:** Uma única conversa pode ter vários agentes participantes, cada um com sua especialização.

### 5.2 Gamificação e Observabilidade

Para dar visibilidade ao "trabalho invisível" dos agentes, foi implementado um **sistema de gamificação em tempo real**:

-   **Eventos Híbridos:** Combina comunicação WebSocket (tempo real) com polling REST (fallback) e carregamento de histórico.
-   **Ticker Visual:** Interface estilo "feed de notícias" exibindo execuções de agentes com diferentes níveis de severidade (info, warning, error).
-   **Categorização Semântica:** Eventos classificados automaticamente (build, critical, analysis, success, alert) com base no resultado.
-   **Dados Históricos:** Inicialização com últimos 50 eventos do backend, proporcionando contexto imediato.

### 5.3 Interação Multimodal

A interface foi expandida para suportar **entrada de voz**:

-   **Reconhecimento de Fala:** Integração com Web Speech API para transcrição automática.
-   **Inserção Contextual:** Texto transcrito é inserido diretamente no editor TipTap, permitindo fluxo contínuo entre fala e escrita.
-   **Interface Intuitiva:** Botão de microfone com toggle para controle simples de gravação.

### 5.4 Sistema de Relatórios Detalhados

Para permitir análise profunda das execuções, foi criado um **modal de relatórios com múltiplas visualizações**:

-   **Interface com Abas:** Navegação entre Resultado (markdown renderizado), Prompt (entrada do agente) e JSON (dados brutos).
-   **Metadados Completos:** Exibição de duração, timestamps, status, erros e identificadores.
-   **Integração com Backend:** Busca automática de dados completos via task ID quando disponível.

### 5.5 Gestão Avançada de Screenplay

O conceito de screenplay evoluiu com **capacidades de gerenciamento de ciclo de vida**:

-   **Reload de Disco:** Uso da File System Access API para recarregar screenplays diretamente do sistema de arquivos sem perder estado.
-   **Working Directory Inheritance:** Propagação automática do diretório de trabalho do screenplay para conversas e agentes.
-   **Sincronização Bidirecional:** Mudanças no editor são refletidas no disco e vice-versa, mantendo sempre a fonte de verdade atualizada.

### 5.6 Deleção Inteligente de Histórico

Para permitir correção de curso em conversas, foi implementado um **sistema de deleção com rollback**:

-   **Deleção de Iterações:** Remove pares completos de pergunta (usuário) + resposta (agente).
-   **Atualização Otimista:** UI atualizada imediatamente para feedback instantâneo.
-   **Rollback Automático:** Se a operação no backend falhar, o estado da UI é revertido automaticamente.
-   **Soft Delete:** Mensagens marcadas como deletadas permanecem no banco para auditoria futura.

Estas evoluções transformam o Conductor Web de um protótipo conceitual em uma **plataforma completa de orquestração de IA contextualizada por documentos**.
