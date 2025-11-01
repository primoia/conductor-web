# Catálogo de Agentes (`AgentCatalogComponent`)

## 📋 Visão Geral
O **Catálogo de Agentes** (`AgentCatalogComponent`) é um componente de interface crucial, localizado na primeira coluna do layout do Screenplay. Sua principal responsabilidade é servir como uma "vitrine" central onde os usuários podem descobrir, pesquisar e selecionar os agentes de IA disponíveis para serem utilizados em seus roteiros. Ele atua como o ponto de partida para a instanciação de novos agentes, separando claramente os agentes padrão do sistema ("System") daqueles criados e customizados pelos próprios usuários ("Custom").

## 🎯 Requisitos Identificados
### Requisitos Funcionais
- **RF1: Listagem de Agentes**: O sistema deve buscar e exibir todos os agentes disponíveis a partir de um endpoint de API (`/api/agents`).
- **RF2: Criação de Agente**: O sistema deve fornecer um botão de atalho ("➕ Novo") que sinaliza a intenção de criar um novo agente personalizado.
- **RF3: Busca Textual**: O usuário deve poder buscar agentes por nome, descrição ou emoji através de um campo de texto. A busca deve ser case-insensitive e atualizar a lista dinamicamente.
- **RF4: Filtragem por Tipo**: O usuário deve poder filtrar a lista de agentes com base em seu tipo, utilizando os botões: "Todos", "Sistema" e "Personalizados".
- **RF5: Seleção de Agente**: Ao clicar no card de um agente, o sistema deve notificar o componente pai sobre a seleção, enviando os dados do agente escolhido para que ele possa ser instanciado.
- **RF6: Exibição de Estados**: A interface deve comunicar claramente o estado atual do processo de carregamento:
    - **Carregamento**: Exibir uma animação e a mensagem "Carregando agentes...".
    - **Erro**: Exibir uma mensagem de erro e um botão para "Tentar Novamente".
    - **Vazio**: Exibir uma mensagem informativa ("📭 Nenhum agente encontrado") quando a busca ou filtro não retornam resultados.
- **RF7: Diferenciação Visual de Tipos**: Agentes do tipo "Sistema" e "Personalizado" devem possuir estilos visuais distintos (cor de fundo do card e badge de tipo) para fácil identificação.
- **RF8: Contagem de Agentes**: O sistema deve exibir um contador no rodapé que informa o número de agentes sendo exibidos em relação ao número total de agentes carregados (ex: "10 de 25 agentes").

### Requisitos Não-Funcionais
- **RNF1: Performance de Carregamento**: O componente deve carregar a lista de agentes de forma assíncrona, sem bloquear a interface do usuário.
- **RNF2: Responsividade da Filtragem**: A busca e a filtragem devem ser executadas no lado do cliente (client-side) para garantir uma resposta instantânea às interações do usuário.
- **RNF3: Usabilidade e Feedback Visual**: A interface deve ser intuitiva, com feedback claro para ações do usuário, como efeitos de `hover` nos cards de agente e um estado `active` para o filtro selecionado.

## 🔄 Fluxo do Processo
1.  **Início (Inicialização)**: Quando o `AgentCatalogComponent` é carregado, ele define seu estado para `isLoading = true` e dispara o método `loadAgents()`.
2.  **Busca de Dados**: O método `loadAgents()` faz uma requisição HTTP GET para o endpoint `/api/agents` (o URL base é obtido do arquivo de ambiente).
3.  **Renderização**:
    - **Sucesso**: Se a API retorna os dados com sucesso, a lista de agentes é armazenada, o estado `isLoading` é definido como `false`, e os agentes são renderizados na tela.
    - **Falha**: Se a requisição falha, o estado `isLoading` é definido como `false` e uma mensagem de erro é armazenada e exibida na tela, junto com um botão que permite ao usuário disparar `loadAgents()` novamente.
4.  **Interação do Usuário**:
    - **Busca**: O usuário digita no campo de busca. A cada alteração (`input`), o método `onSearchChange()` chama `applyFilters()`, que filtra a lista de agentes localmente.
    - **Filtro**: O usuário clica em um dos botões de filtro ("Todos", "Sistema", "Personalizados"). O método `onFilterChange()` atualiza o filtro ativo e chama `applyFilters()`.
    - **Seleção**: O usuário clica em um card de agente. O método `onSelectAgent()` é chamado, emitindo o evento `selectAgent` com o objeto do agente selecionado como payload.
    - **Criação**: O usuário clica no botão "➕ Novo". O método `onCreateAgent()` é chamado, emitindo o evento `createAgent`.

## 🏗️ Componentes Principais
### Frontend (Angular)
- **`AgentCatalogComponent`**: Componente principal que encapsula toda a lógica de apresentação, busca de dados e interação do usuário para o catálogo de agentes.
- **`HttpClient` (Serviço Angular)**: Utilizado para realizar a comunicação com a API backend e buscar a lista de agentes.

## 🔗 Relacionamentos e Dependências
- **Componente Pai (`ScreenplayInteractive`)**: O `AgentCatalogComponent` é um componente filho, tipicamente contido dentro de uma das abas da primeira coluna do layout principal. Ele não age de forma isolada.
- **Saídas (`@Output`)**:
    - `selectAgent`: Emite um evento para o componente pai quando um agente é selecionado. O pai é responsável por capturar este evento e iniciar o processo de instanciação do agente no roteiro.
    - `createAgent`: Emite um evento para o componente pai para sinalizar que o modal de criação de agente deve ser aberto.
- **Backend API**: O componente depende de um endpoint de API (ex: `http://localhost:3001/api/agents`) para obter sua lista de dados. A URL exata é configurável através dos arquivos de ambiente do Angular (`environment.ts`).
- **Modelo de Dados (`Agent`)**: O componente utiliza a interface `Agent` para tipar os objetos que representam os agentes.

## 💡 Regras de Negócio Identificadas
1.  **Fonte Única de Verdade**: A lista de todos os agentes disponíveis é obtida exclusivamente através do endpoint `/api/agents`.
2.  **Classificação de Agentes**: Um agente é classificado como "Sistema" se a propriedade booleana `isSystemDefault` for `true`. Caso contrário, é classificado como "Personalizado". Esta regra de negócio determina a lógica de filtragem e a estilização visual.
3.  **Lógica de Busca Abrangente**: A funcionalidade de busca é projetada para ser amigável, pesquisando o termo digitado (de forma case-insensitive) nos campos `title`, `name`, `description` e `emoji` de cada agente.
4.  **Filtragem no Cliente**: Para agilidade, toda a lógica de busca e filtragem é executada no frontend sobre a lista completa de agentes já carregada, evitando novas chamadas de API a cada interação.

## 🎓 Conceitos-Chave
- **Catálogo de Agentes**: Refere-se à coleção completa de definições de agentes que podem ser instanciados em um roteiro. É o "menu" de funcionalidades de IA disponíveis.
- **Agente de Sistema**: Um agente padrão, pré-configurado e fornecido com a aplicação. Geralmente, não pode ser modificado pelo usuário final.
- **Agente Personalizado**: Um agente que foi criado pelo próprio usuário, com persona e procedimentos operacionais customizados.
- **Instanciação de Agente**: O processo de criar uma "cópia" funcional de um agente a partir do catálogo e associá-la a um roteiro específico. O catálogo apenas lista as "plantas" (definições), não as instâncias ativas.

## 📌 Observações
- O componente é bem encapsulado, gerenciando seus próprios estados de carregamento, erro e vazio, o que o torna robusto e reutilizável.
- A dependência do arquivo de `environment` para a URL da API é uma boa prática que permite implantar o frontend em diferentes ambientes (desenvolvimento, produção) sem alterar o código-fonte.
- A estilização utiliza classes CSS modernas e um layout baseado em Flexbox, com atenção a detalhes de UX como transições e feedback visual (`hover`, `focus-within`).