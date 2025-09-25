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

## 🚀 Funcionalidades Atuais (Protótipo)

-   **Sincronização Dinâmica:** Carrega arquivos `.md` e renderiza automaticamente os agentes interativos.
-   **Persistência de Estado:** O estado e a posição dos agentes são salvos e restaurados entre sessões e recarregamentos.
-   **Ancoragem Robusta:** A "inteligência" sobrevive a edições no texto e é salva junto com o arquivo `.md`.
-   **Isolamento de Contexto:** O estado é gerenciado de forma limpa ao trocar entre diferentes documentos.

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
