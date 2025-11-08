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

## 5. Trabalhando com Conversas

### 5.1 Criando uma Nova Conversa

1. **Abra o Screenplay:** Carregue ou crie um screenplay na aplicação
2. **Clique no botão "+" na sidebar de conversas** para criar uma nova conversa
3. **Dê um título descritivo** (ex: "Implementação de autenticação")
4. **Adicione contexto** (opcional): Use markdown para documentar o objetivo da conversa

### 5.2 Gerenciando Conversas

-   **Editar Título/Contexto:** Clique no ícone de edição ao lado da conversa
-   **Deletar Conversa:** Use o botão de deletar (⚠️ ação irreversível)
-   **Reordenar:** Arraste e solte conversas para reorganizar a lista
-   **Visualizar Metadados:** Veja quais agentes participam e quantas mensagens existem

### 5.3 Usando o Chat

#### Enviando Mensagens

1. **Selecione uma conversa** na sidebar
2. **Digite sua mensagem** no editor TipTap (suporta markdown)
3. **Pressione Enter** ou clique no botão de enviar
4. **Aguarde a resposta** do agente (acompanhe via ticker de eventos)

#### Entrada por Voz

1. **Clique no ícone do microfone** no editor de chat
2. **Fale sua mensagem** (navegadores compatíveis: Chrome, Edge)
3. **A transcrição será inserida automaticamente** no editor
4. **Revise e envie** a mensagem

#### Deletando Iterações

Para remover uma interação completa (pergunta + resposta):

1. **Passe o mouse sobre a mensagem do bot** que deseja deletar
2. **Clique no botão de deletar**
3. **A pergunta correspondente também será removida**
4. **Se houver erro, a ação será revertida automaticamente**

### 5.4 Contexto de Working Directory

Cada screenplay possui um diretório de trabalho (`working_directory`) que é herdado pelas conversas:

-   **Configuração automática:** O diretório é propagado do screenplay para o chat
-   **Bloqueio inteligente:** Se não houver working directory, o chat será bloqueado com mensagem explicativa
-   **Exibido na UI:** O caminho do diretório é mostrado na interface do chat

## 6. Sistema de Gamificação e Observabilidade

### 6.1 Painel de Gamificação

O **Gamified Panel** oferece visibilidade em tempo real sobre o que os agentes estão fazendo:

-   **Ticker de Eventos:** Feed rolante mostrando execuções de agentes
-   **Categorização por Severidade:**
    -   🟢 **Info:** Execuções normais bem-sucedidas
    -   🟡 **Warning:** Avisos ou situações que requerem atenção
    -   🔴 **Error:** Falhas ou erros durante execução

### 6.2 Visualizando Relatórios Detalhados

Ao clicar em um evento no ticker:

1. **Modal de Relatório é aberto**
2. **Navegue pelas abas:**
    -   **Resultado:** Markdown formatado com o resultado da execução
    -   **Prompt:** Veja exatamente o que foi enviado ao agente
    -   **JSON:** Dados brutos para depuração
3. **Veja metadados:**
    -   Nome e emoji do agente
    -   Duração da execução
    -   Status e severidade
    -   Timestamps de criação e conclusão

## 7. Gerenciamento de Screenplay

### 7.1 Carregando Screenplay

-   **Botão "📁 Carregar Markdown"**: Abre um screenplay do disco
-   **Sincronização automática:** Agentes são carregados e renderizados

### 7.2 Recarregando do Disco

Para atualizar um screenplay com mudanças feitas externamente:

1. **Clique no botão "🔄 Reload" na árvore de screenplay**
2. **Selecione o arquivo atualizado** usando o file picker
3. **O conteúdo é recarregado mantendo o estado dos agentes**
4. **Conversas e histórico são preservados**

**Requisitos:** Navegadores compatíveis com File System Access API (Chrome, Edge)

### 7.3 Salvando Mudanças

-   **Salvar Automático:** Mudanças no editor são refletidas no disco
-   **Preservação de Âncoras:** IDs de agentes (`<!-- agent-id: ... -->`) são mantidos
-   **Sincronização Bidirecional:** Edições externas podem ser recarregadas

## 8. Vinculando Agentes a Conversas

### 8.1 Criando Instância de Agente

1. **Adicione um emoji-âncora** no screenplay (ex: `🚀`)
2. **O agente é criado automaticamente** com UUID único
3. **Clique no agente rico** para interagir

### 8.2 Associando Agente a Conversa

-   **Via URL:** Use parâmetros `?conversation={id}&instance={id}`
-   **Via UI:** Selecione agente ativo na interface de conversa
-   **Múltiplos Participantes:** Uma conversa pode ter vários agentes

### 8.3 Status do Agente

Os agentes podem ter os seguintes status:

-   🔵 **Pending:** Aguardando primeira execução
-   🟡 **Queued:** Na fila para execução
-   🔄 **Running:** Executando atualmente
-   ✅ **Completed:** Execução concluída com sucesso
-   ❌ **Error:** Execução falhou

## 9. Boas Práticas

### 9.1 Organização de Conversas

-   **Títulos descritivos:** Use nomes que indicam o objetivo (ex: "Refatorar módulo de autenticação")
-   **Contexto rico:** Documente requisitos, restrições e objetivos no campo de contexto
-   **Uma conversa por tópico:** Evite misturar assuntos não relacionados

### 9.2 Uso de Agentes

-   **Escolha emojis semanticamente corretos:** Use 🔐 para segurança, 🚀 para performance, etc.
-   **Posicione próximo ao contexto:** Coloque agentes perto do texto relevante no documento
-   **Revise resultados:** Sempre verifique a aba "Resultado" no modal de relatório

### 9.3 Gestão de Histórico

-   **Delete iterações irrelevantes:** Mantenha conversas limpas removendo tentativas falhas
-   **Preserve contexto importante:** Não delete iterações que contêm decisões arquiteturais
-   **Use contexto markdown:** Documente decisões importantes no campo de contexto

## 10. Salvando e Compartilhando

-   **Salvar:** Ao clicar no botão **"💾 Salvar Markdown"**, a aplicação salva uma nova versão do seu arquivo `.md`. Este novo arquivo contém as âncoras de ID (`<!-- agent-id: ... -->`) escondidas no texto, garantindo que toda a "inteligência" seja preservada.
-   **Compartilhar:** Você pode compartilhar este arquivo `.md` salvo com qualquer pessoa. Quando eles o abrirem no Conductor Web, verão o mesmo estado e os mesmos agentes que você, pois a informação está contida no próprio arquivo e ligada ao banco de dados.
-   **Versionamento:** Use git para versionar screenplays com histórico de mudanças
-   **Portabilidade:** Screenplays são arquivos markdown padrão, legíveis em qualquer editor

## 11. Solução de Problemas

### 11.1 Chat Bloqueado

**Problema:** Mensagem "Working directory não configurado"

**Solução:**
-   Verifique se o screenplay possui `working_directory` configurado
-   Recarregue o screenplay se necessário
-   Contate administrador do backend para configurar diretório

### 11.2 Eventos Não Aparecem no Ticker

**Problema:** Ticker de eventos vazio

**Solução:**
-   Verifique conexão WebSocket (console do navegador)
-   Aguarde alguns segundos para carregamento de histórico
-   Recarregue a página se o problema persistir

### 11.3 Erro ao Deletar Mensagem

**Problema:** Mensagem reaparece após deleção

**Solução:**
-   Verifique console para erro de rede
-   Confirme que backend está acessível
-   Tente novamente após alguns segundos

### 11.4 Transcrição de Voz Não Funciona

**Problema:** Botão de microfone não responde

**Solução:**
-   Use navegador compatível (Chrome, Edge)
-   Permita acesso ao microfone quando solicitado
-   Verifique se microfone está funcionando em outras aplicações
