# 📖 Guia do Usuário: Utilizando o Editor de Documentos Vivos

Este guia explica como usar a interface do Conductor Web para criar e interagir com "Documentos Vivos Aumentados por Agentes".

## 1. Conceitos Básicos

-   **Documento Vivo:** Um arquivo Markdown que também funciona como um painel de controle para executar tarefas de IA.
-   **Agente Rico:** Um elemento visual interativo (um círculo sobre um emoji) que representa uma tarefa ou um agente de IA. Cada agente rico tem um estado (pendente, concluído, etc.).
-   **Âncora de Agente:** Um emoji no texto (ex: `🚀`) que marca o local onde um Agente Rico deve aparecer.

## 2. Criando seu Primeiro Documento Vivo

O processo é projetado para ser intuitivo e começar com um fluxo de trabalho que você já conhece.

1.  **Escreva Markdown:** Comece escrevendo um documento Markdown normal. Pode ser um plano de projeto, um documento de requisitos, ou anotações técnicas.
2.  **Adicione Âncoras:** Nos locais onde você quer que a IA realize uma tarefa, adicione um emoji correspondente. Consulte a lista abaixo para saber o que cada emoji significa.
    *Exemplo: "Precisamos criar um endpoint para retornar os dados do usuário. 🤖"*
3.  **Carregue na Aplicação:** Use o botão **"📁 Carregar Markdown"** para abrir seu arquivo na aplicação Conductor Web.

Pronto! A aplicação irá automaticamente detectar suas âncoras-emoji e criar os Agentes Ricos interativos sobre o seu texto.

## 3. Lista de Agentes (Emojis) Disponíveis

Cada emoji está associado a um tipo de tarefa ou agente específico.

| Emoji | Título do Agente      | Descrição da Tarefa                               |
| :---: | --------------------- | ------------------------------------------------- |
|  `🎬`  | Agente de Cena        | Define o início de uma cena ou take.              |
|  `📝`  | Agente Narrativo      | Descreve ações ou contexto narrativo.             |
|  `💡`  | Agente de Insight     | Marca uma ideia, dica ou ponto de atenção.        |
|  `✨`  | Agente de Melhoria    | Sugere uma melhoria ou efeito especial.           |
|  `🚀`  | Agente de Performance | Monitora ou executa tarefas de performance.       |
|  `🔐`  | Agente de Autenticação| Gerencia tarefas relacionadas à autenticação.     |
|  `📊`  | Agente de Análise     | Coleta ou processa métricas e dados.              |
|  `🛡️`  | Agente de Segurança   | Verifica ou implementa medidas de segurança.      |
|  `⚡`  | Agente de Velocidade  | Otimiza ou mede a velocidade de resposta.         |
|  `🎯`  | Agente de Objetivo    | Foca em um objetivo ou requisito específico.      |
|  `🧠`  | Agente de IA          | Realiza processamento genérico com IA.            |
|  `💻`  | Agente de Sistema     | Gerencia recursos do sistema ou código.           |
|  `📱`  | Agente Mobile         | Lida com tarefas relacionadas a interfaces mobile.|

## 4. Interagindo com os Agentes

Uma vez que seu documento está carregado, você pode interagir com os Agentes Ricos:

-   **Verificar o Estado:** A cor e o ícone do agente indicarão seu estado atual (ex: um círculo cinza para 'pendente', verde com um cheque para 'concluído').
-   **Arrastar:** Você pode arrastar os agentes para reposicioná-los visualmente. O estado da posição é salvo.
-   **Clicar (Funcionalidade Futura):** Em breve, clicar em um agente abrirá um menu de ações, como "Executar", "Ver Logs", "Ver Resultados".

## 5. Salvando e Compartilhando

-   **Salvar:** Ao clicar no botão **"💾 Salvar Markdown"**, a aplicação salva uma nova versão do seu arquivo `.md`. Este novo arquivo contém as âncoras de ID (`<!-- agent-id: ... -->`) escondidas no texto, garantindo que toda a "inteligência" seja preservada.
-   **Compartilhar:** Você pode compartilhar este arquivo `.md` salvo com qualquer pessoa. Quando eles o abrirem no Conductor Web, verão o mesmo estado e os mesmos agentes que você, pois a informação está contida no próprio arquivo e ligada ao banco de dados.
