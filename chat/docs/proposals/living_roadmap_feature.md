# Proposta de Feature: O Roteiro Vivo (The Living Roadmap)

## 1. Resumo Executivo

Esta proposta detalha o conceito do "Roteiro Vivo", um paradigma de desenvolvimento assistido por IA que transforma um documento Markdown em uma interface interativa, executável e colaborativa para o gerenciamento completo do ciclo de vida de um projeto de software. A ideia central é unificar planejamento, execução, revisão e documentação em um único artefato dinâmico, onde desenvolvedores e agentes de IA colaboram em tempo real. Esta abordagem visa reduzir drasticamente a carga cognitiva, acelerar o desenvolvimento, melhorar a qualidade do código e democratizar o processo de criação de software.

## 2. Arquitetura de Suporte

A implementação do Roteiro Vivo se baseia na arquitetura de microsserviços existente:

*   **`conductor-web`**: Evolui de uma simples UI para um **Ambiente de Desenvolvimento Assistido (ADE)** completo, funcionando como um editor de Markdown inteligente, painel de controle e interface de colaboração.
*   **`conductor-gateway`**: Atua como um **Orquestrador e Tradutor Semântico**, interpretando a linguagem natural do usuário e as interações no Roteiro Vivo, e traduzindo-as em comandos estruturados para o motor de execução.
*   **`conductor`**: Funciona como o **Motor de Execução** puro, hospedando agentes ultra-especialistas que realizam tarefas técnicas (escrever código, rodar testes, etc.) de forma eficiente e confiável, baseados nos comandos recebidos do gateway.

## 3. As Camadas Evolutivas do Roteiro Vivo

O conceito foi desenvolvido através de várias camadas de funcionalidade, cada uma construindo sobre a anterior.

### Camada 1: O Gerador de Comandos Interativo

*   **Conceito**: A UI não executa comandos imediatamente. Ela primeiro mostra ao usuário o comando CLI que a IA gerou.
*   **Interface**: Apresenta o comando em um bloco com duas ações:
    1.  **Copiar**: Permite que o usuário copie o comando para usá-lo em seu terminal, possivelmente para modificação.
    2.  **▶️ Executar**: Envia o comando para execução através do gateway.
*   **Benefício**: Transparência total e uma ferramenta de aprendizado ativa, ensinando os usuários a usar o CLI do `conductor` organicamente.

### Camada 2: O Ciclo de Proposta, Revisão e Execução

*   **Conceito**: Agentes não modificam o roteiro ou criam arquivos diretamente. Eles criam "propostas de alteração", análogas a um Pull Request.
*   **Interface**:
    1.  O agente apresenta um bloco de proposta (ex: um snippet de código TDD).
    2.  O usuário humano tem as opções **✅ Aceitar** ou **❌ Rejeitar**.
    3.  Ao aceitar, a proposta não é executada imediatamente. Em vez disso, ela é incorporada ao roteiro como um **Gatilho de Execução Adiada**.
*   **Benefício**: Garante controle e supervisão humana, prevenindo ações indesejadas e separando a fase de planejamento da fase de execução.

### Camada 3: Artefatos Embutidos e Visão Macro/Micro

*   **Conceito**: O conteúdo de uma proposta aceita (como um bloco de código) é embutido diretamente no Roteiro Vivo, mas de forma recolhível.
*   **Interface**:
    *   **Visão Macro**: O roteiro exibe uma linha única e limpa: `▶️ [TESTE] Teste para a função X.`
    *   **Visão Micro**: Ao clicar no item, ele se expande para mostrar o bloco de código completo.
*   **Benefício**: Mantém o roteiro principal legível e focado no alto nível (macro), enquanto permite o acesso instantâneo aos detalhes da implementação (micro) sem troca de contexto.

### Camada 4: O Roteiro Modular (Transclusão)

*   **Conceito**: A capacidade de incluir um arquivo Markdown dentro de outro usando uma sintaxe especial, como `!include(path/to/sub-plan.md)`.
*   **Interface**: O `conductor-web` renderiza a linha `!include` como um módulo expansível, que, ao ser clicado, carrega e exibe o conteúdo do sub-roteiro em linha.
*   **Benefício**: Permite a modularização e reutilização de planos, a separação de responsabilidades por equipes e a componentização do conhecimento do projeto. Torna o sistema escalável para projetos e equipes grandes.

### Camada 5: Papéis e Permissões (RBAC)

*   **Conceito**: Introduz um Controle de Acesso Baseado em Papel para a edição e execução do Roteiro Vivo.
*   **Interface**: A UI do `conductor-web` se adapta ao papel do usuário logado:
    *   **Arquiteto/Analista**: Foca no "o quê" e "porquê". Pode editar a estrutura e os requisitos, mas não configurar os agentes executores.
    *   **Engenheiro/Desenvolvedor**: Foca no "como". Traduz os requisitos em propostas de ação com `@agent`s.
    *   **Revisor/QA**: Foca na "validação". Pode aprovar/rejeitar propostas e acionar os gatilhos `▶️ Play`.
*   **Benefício**: Cria um fluxo de trabalho seguro e organizado, espelhando a dinâmica de uma equipe de desenvolvimento real e garantindo a separação de responsabilidades.

## 4. Análise de Viabilidade e Utilidade

*   **Viabilidade**: A implementação é complexa, mas tecnicamente viável com tecnologias web modernas (editores de texto avançados, WebSockets, frameworks reativos). A arquitetura de microsserviços proposta é sólida e suporta essa complexidade. Precedentes de mercado como GitHub Copilot Workspace validam a direção da indústria para este tipo de ferramenta.
*   **Utilidade**: O valor é transformador. A ferramenta unifica o fluxo de desenvolvimento, reduz a carga cognitiva, acelera a produção de código, melhora a qualidade através da automação de boas práticas e serve como uma poderosa ferramenta de onboarding e aprendizado.

## 5. Visão Final

O "Roteiro Vivo" representa a evolução de um IDE para um **Ambiente de Desenvolvimento Assistido (ADE)**. Ele transforma o processo de desenvolvimento de uma série de comandos discretos em um diálogo colaborativo e contínuo entre o arquiteto humano e uma equipe de agentes de IA, tudo orquestrado através de um documento central, vivo e executável.
