# Sistema de Gamificação - Rota /quest

## 📋 Visão Geral

O **sistema de gamificação /quest** é uma experiência de onboarding interativa que ensina novos usuários a entenderem o conceito do Conductor através de uma **aventura RPG narrativa**. Em vez de ler documentação técnica, o usuário vive uma jornada hands-on onde precisa "restaurar" 5 robôs sintéticos especializados (que representam agentes de IA) em um salão digital.

**Objetivo de negócio:** Transformar o aprendizado do Conductor (plataforma de orquestração de agentes de IA) de uma experiência técnica e árida em uma jornada envolvente de 10-15 minutos que cria memória positiva e motivação para usar o sistema completo.

**Metáfora central:** Você é um **Iniciado** que chega ao Salão Digital e encontra 5 Condutores Sintéticos em modo de hibernação. Sua missão é reativá-los progressivamente através da entrega de itens especiais, aprendendo na prática como agentes colaboram.

---

## 🎯 Requisitos Identificados

### Requisitos Funcionais

**RF1 - Sistema de Progressão Linear**
O jogador deve seguir uma cadeia de 6 objetivos sequenciais que não podem ser pulados: (1) Falar com Guia → (2) Levar Código à Bibliotecária → (3) Ativar Escriba → (4) Ativar Artesã → (5) Ativar Crítica → (6) Retornar ao Guia.

**RF2 - Sistema de Inventário**
O jogador possui um inventário de 20 slots onde pode coletar, visualizar e entregar itens. Itens possuem raridades (Common → Mythic) e categorias (Key, Document, Tool, Artifact, Quest, Consumable). Alguns itens são indestrutíveis.

**RF3 - Sistema de Diálogos Ramificados**
Cada NPC possui árvores de diálogos com múltiplos nós, opções de resposta, emoções visuais e ações (dar item, solicitar item, desbloquear NPC, completar objetivo). Diálogos possuem efeito de digitação animada.

**RF4 - Sistema de Desbloqueio de NPCs**
NPCs começam bloqueados (exceto Guia e Bibliotecária). Desbloqueiam automaticamente quando o jogador adquire um item específico (`requiredItem`) ou através de ação explícita em diálogo.

**RF5 - Sistema de XP e Leveling**
O jogador ganha experiência (10-100 XP) ao completar ações e diálogos. Existem 5 níveis (Iniciado → Aprendiz → Praticante → Orquestrador → Condutor Híbrido), cada um com threshold de XP necessário.

**RF6 - Movimento e Interação no Mapa**
O jogador pode clicar no canvas para mover-se com animação suave (easing). Ao clicar em NPC: se longe, move-se até ele; se perto (50px), inicia diálogo automaticamente.

**RF7 - Comportamento de NPCs (Wandering)**
NPCs se movem aleatoriamente dentro de um raio definido (`wanderRadius`) com velocidade configurável. Durante interação com jogador, NPC é congelado temporariamente.

**RF8 - Sistema de Persistência**
Todo progresso (posição, inventário, objetivos, diálogos visitados, NPCs desbloqueados) é salvo automaticamente em localStorage a cada 30 segundos ou mudança crítica de estado. Jogador pode resetar progresso manualmente.

**RF9 - Sistema de Hover sobre NPCs**
Ao passar mouse sobre NPC, exibe modal com nome, título e indicador de range de interação. NPCs bloqueados mostram "???" até serem desbloqueados.

**RF10 - Entrega de Itens a NPCs**
Quando um diálogo solicita item (`request_item`), abre inventário automaticamente. Jogador seleciona item e tenta entregar. Sistema valida se é o item correto antes de aceitar.

**RF11 - Sistema de Gamificação Global (Telemetria)**
Conecta-se via WebSocket ao gamification-gateway para enviar eventos em tempo real. Possui fallback para polling HTTP. Carrega histórico de eventos do MongoDB.

**RF12 - Quest Tracker Visual**
Painel lateral mostra objetivo atual, nível do jogador, barra de XP, botão de reset e lista de objetivos completados/pendentes.

### Requisitos Não-Funcionais

**RNF1 - Performance de Renderização**
Canvas deve renderizar a 60 FPS com suporte opcional para mostrar FPS em modo debug.

**RNF2 - Responsividade**
Sistema adapta posições de NPCs e tamanho de canvas para desktop (1024x768) e mobile (redimensionamento proporcional).

**RNF3 - Tempo de Conclusão**
Jornada completa deve ser completável em 10-15 minutos para usuário que lê os diálogos atentamente.

**RNF4 - Persistência Local Segura**
Usar localStorage para salvar estado sem dependência de backend (offline-first). Sincronização com servidor deve ser opcional/futura.

**RNF5 - Extensibilidade de Conteúdo**
Diálogos, NPCs e quests devem ser configuráveis via JSON externo (não hardcoded), permitindo adicionar conteúdo sem alterar código TypeScript.

**RNF6 - Integração com Backend**
NPCs possuem campo `agentId` preparado para conectar com agentes reais do Conductor via API. Sistema de WebSocket pronto para receber eventos do backend.

---

## 🔄 Fluxo do Processo

### Início da Jornada

O jogador acessa a rota `/quest` e o sistema carrega o **QuestAdventureComponent**. Um modal de introdução aparece, solicitando que o usuário digite seu nome de condutor. Ao confirmar, o método `startQuest()` é invocado, inicializando:

1. Estado do jogador (posição inicial, nível 1, 0 XP, título "Iniciado", inventário vazio)
2. NPCs desbloqueados inicialmente: **Elder Guide (Guia)** e **Librarian (Bibliotecária)**
3. Inventário recebe **5 itens iniciais indestrutíveis**: Código Primordial, Chave Alpha, Núcleo Beta, Módulo Gamma, Protocolo Omega
4. Primeiro objetivo ativado: "Fale com o Elder Guide"

O jogador aparece no centro do mapa (canvas 1024x768) e os NPCs estão distribuídos em posições específicas, alguns se movendo aleatoriamente (wandering behavior).

### Progressão Central (6 Objetivos Encadeados)

**Objetivo 1: "Fale com o Elder Guide"**
- Jogador clica no Guia (ou se aproxima dele)
- Diálogo `guide_intro` é carregado (árvore de 10-15 nós)
- Guia explica o conceito de Condutores Sintéticos em hibernação
- Ao final do diálogo, ação `give_item` entrega **"Código Primordial"** ao jogador
- XP concedido: +50 XP
- Objetivo 1 marcado como completo, objetivo 2 ativado

**Objetivo 2: "Leve o Código Primordial à Bibliotecária"**
- Jogador move-se até a Bibliotecária (já desbloqueada)
- Diálogo `librarian_intro` solicita o Código (`request_item`)
- Sistema abre inventário automaticamente para contexto
- Jogador seleciona "Código Primordial" e tenta entrega via `attemptItemDelivery()`
- Se item correto: Bibliotecária aceita e dá **"Chave de Ativação Alpha"**
- Ação `unlock_npc` desbloqueia automaticamente o **Escriba**
- Indicador "!" aparece sobre o Escriba (novo NPC disponível)
- XP: +100 XP, objetivo 3 ativado

**Objetivo 3: "Ative o Escriba entregando a Chave Alpha"**
- Jogador interage com Escriba (antes bloqueado, agora acessível)
- Diálogo `scribe_boot` explica papel de planejador/documentador
- Escriba solicita Chave Alpha (`request_item`)
- Ao receber: dá **"Núcleo de Execução Beta"** e auto-desbloqueia **Artesã**
- XP: +100 XP, objetivo 4 ativado

**Objetivo 4: "Ative a Artesã entregando o Núcleo Beta"**
- Jogador interage com Artesã
- Diálogo `artisan_activation` explica papel de executora/construtora
- Artesã solicita Núcleo Beta
- Ao receber: dá **"Módulo de Otimização Gamma"** e auto-desbloqueia **Crítica**
- XP: +100 XP, objetivo 5 ativado

**Objetivo 5: "Ative a Crítica entregando o Módulo Gamma"**
- Jogador interage com Crítica
- Diálogo `critic_calibration` explica papel de refinadora/revisora
- Crítica solicita Módulo Gamma
- Ao receber: dá **"Protocolo de Sincronização Omega"**
- XP: +150 XP (maior recompensa por ser penúltimo passo), objetivo 6 ativado

**Objetivo 6: "Retorne ao Guia com o Protocolo Omega"**
- Jogador volta ao Guia com item final
- Diálogo `guide_finale` celebra conclusão
- Guia recebe Protocolo Omega e ativa "sincronização completa"
- Sistema atualiza título do jogador: **"Condutor Híbrido"**
- Quest principal marcada como completa
- XP: +200 XP (leva a nível 5, máximo)
- Modal de celebração aparece: "Você completou a jornada! Agora pode orquestrar os Condutores."

### Pós-Conclusão

Após completar a quest:
- Jogador pode continuar explorando o mapa
- Diálogos com NPCs possuem opções adicionais ("fale mais sobre...")
- Sistema mantém progresso salvo para sessões futuras
- Botão "Reset Quest" permite recomeçar do zero (com confirmação)

---

## 🏗️ Componentes Principais

### Frontend (Angular)

**QuestAdventureComponent** (`quest-adventure.component.ts`)
Componente principal standalone que orquestra toda a experiência. Responsável por:
- Gerenciar estado global via observables do `QuestStateService`
- Controlar fluxo de interações (cliques no mapa, seleção de NPCs)
- Mediar comunicação entre sub-componentes (canvas, chat, tracker, inventory)
- Implementar auto-save a cada 30 segundos via `setInterval()`
- Detectar desbloqueios automáticos (quando jogador ganha item que desbloqueia NPC)

**QuestCanvasComponent** (`components/quest-canvas/`)
Renderiza o mapa visual usando Canvas 2D. Responsabilidades:
- Desenhar fundo do salão (gradiente azul escuro tech)
- Renderizar player como círculo (cor baseada em nível)
- Renderizar NPCs como círculos coloridos + emoji + nome
- Desenhar indicadores de desbloqueio ("!" amarelo flutuante)
- Exibir range de interação ao passar mouse sobre NPC
- Processar cliques no canvas (movimento ou interação)
- Atualizar animação a 60 FPS via `requestAnimationFrame()`

**QuestChatModalComponent** (`components/quest-chat-modal/`)
Modal de diálogos centralizado na tela. Implementa:
- Renderização de nó atual (texto do NPC com emoji de emoção)
- Efeito de digitação animada (30ms por caractere via RxJS interval)
- Botões de opções de resposta do jogador
- Navegação pela árvore de diálogos (próximo nó baseado em seleção)
- Processamento de ações especiais (dar item, solicitar item, completar objetivo)
- Botão de fechar (ESC ou click no X)

**QuestTrackerComponent** (`components/quest-tracker/`)
Painel lateral direito (ou bottom sheet em mobile). Exibe:
- Título atual do jogador (ex: "Iniciado", "Condutor Híbrido")
- Nível e barra de progresso de XP (visual com porcentagem)
- Lista de objetivos da quest principal (checkmark verde se completo)
- Objetivo atual destacado em amarelo
- Botão "Reset Quest" com confirmação

**InventoryPanelComponent** (`components/inventory-panel/`)
Painel de inventário (abertura via TAB ou I, fecha com ESC). Implementa:
- Visualização em grid (4x5) ou lista (toggle)
- Cada slot mostra emoji do item + badge de raridade (cor)
- Seleção de item (clique marca como selecionado, borda dourada)
- Filtros por tipo de item (All, Keys, Documents, Tools, Artifacts)
- Informação detalhada ao hover (tooltip com descrição completa)
- Suporte a drag & drop (futuro)
- Indicação de quantidade se stackable

### Serviços Angular (Business Logic)

**QuestStateService** (`services/quest-state.service.ts`)
Gerencia estado central do jogo. Implementa:
- BehaviorSubjects para `playerState$`, `objectives$`, `playerLevel$`, `playerXP$`
- Método `completeObjective(id)` que avança cadeia linear
- Sistema de XP: `addXP(amount)` calcula leveling automático (thresholds: 100, 300, 600, 1000, 1500)
- Sistema de títulos: atualiza conforme nível (mapeamento 1→Iniciado, 5→Condutor Híbrido)
- Persistência: `saveToLocalStorage()` serializa estado em JSON
- Carregamento: `loadFromLocalStorage()` deserializa ou cria novo save

**NpcManagerService** (`services/npc-manager.service.ts`)
Gerencia 5 NPCs com comportamento dinâmico. Implementa:
- BehaviorSubject `npcs$` com array de NPCs
- Método `unlockNpc(id)` que marca NPC como acessível
- Sistema de auto-desbloqueio: `checkAutoUnlock(playerInventory)` verifica se jogador tem `requiredItem`
- Wandering behavior: `startWandering()` move NPCs aleatoriamente a cada 2-5s dentro de `wanderRadius`
- Congelamento temporário: `freezeNpc(id, duration)` para interações
- Reposicionamento responsivo: `adjustPositionsForMobile()` adapta coordenadas

**DialogueService** (`services/dialogue.service.ts`)
Gerencia árvores de diálogos complexas. Implementa:
- Carregamento de JSON via HttpClient (`/quest-adventure/data/dialogues-tech.json`)
- BehaviorSubject `activeDialogue$` com nó atual
- Navegação: `selectOption(optionId)` busca próximo nó e atualiza estado
- Processamento de ações: `processAction(action)` interpreta ações do tipo:
  - `unlock_npc`: chama `NpcManagerService.unlockNpc()`
  - `give_item`: chama `InventoryQuestIntegrationService.receiveItemFromNPC()`
  - `request_item`: abre inventário e marca contexto de entrega
  - `complete_objective`: chama `QuestStateService.completeObjective()`
  - `set_flag`: salva flag booleana para condicionar diálogos futuros
- Memória de diálogos: salva último nó visitado por NPC em localStorage (`quest_dialogue_memory`)

**InventoryService** (`services/inventory.service.ts`)
Gerencia itens e transações. Implementa:
- BehaviorSubject `inventory$` com array de slots (20 inicialmente)
- BehaviorSubject `selectedItem$` para rastrear item marcado
- Método `addItem(item)` adiciona ao inventário (encontra slot vazio ou empilha se stackable)
- Método `removeItem(itemId)` remove do inventário
- Método `selectItem(itemId)` marca item para contexto de entrega
- Sistema de transações: `recordTransaction(type, item)` salva histórico de ganhos/perdas
- Persistência: serializa inventário em localStorage (`quest_inventory`)

**InventoryQuestIntegrationService** (`services/inventory-quest-integration.service.ts`)
Ponte entre inventário e sistema de quest. Implementa:
- Método `receiveItemFromNPC(item, npcId)` quando NPC dá item ao jogador
- Método `requestItemForNPC(itemId, npcId)` quando NPC solicita item
- Método `attemptItemDelivery(selectedItem, targetNpcId)` valida entrega:
  - Verifica se `selectedItem.id === requestedItem.id`
  - Se correto: remove do inventário, notifica sucesso, avança diálogo
  - Se incorreto: mostra mensagem de erro, mantém item no inventário
- Abertura automática de inventário quando contexto exige (flag `showInventoryForDelivery`)

**PlayerMovementService** (`services/player-movement.service.ts`)
Controla movimento suave do jogador. Implementa:
- BehaviorSubjects: `position$`, `isMoving$`, `direction$`
- Método `moveToPosition(x, y)` inicia animação de movimento
- Easing quadrático: velocidade diminui perto do destino (`ease-out`)
- Detecção de direção: calcula se está indo up/down/left/right com base em delta (x, y)
- Limites de canvas: impede que jogador saia do mapa (clamp x/y)

### Serviços de Gamificação Global

**GamificationEventsService** (`/src/app/services/gamification-events.service.ts`)
Agrega eventos de gamificação para telemetria. Implementa:
- Conexão com `GamificationWebSocketService` para eventos em tempo real
- Fallback para polling HTTP (`/api/gamification/metrics`) a cada 5s
- Método `loadHistoricalEvents()` busca eventos do MongoDB na inicialização
- Emissão de eventos personalizados: `emitEvent(type, payload)`
- Tipos de eventos: `npc_unlocked`, `objective_completed`, `item_received`, `level_up`, `quest_completed`

**GamificationWebSocketService** (`/src/app/services/gamification-websocket.service.ts`)
Cliente WebSocket para eventos em tempo real. Implementa:
- Conexão com `wss://host:5006/ws/gamification`
- Auto-reconnect com retry exponencial (5s → 10s → 20s)
- Observable `events$` que emite eventos recebidos
- Método `sendEvent(event)` envia evento ao servidor

---

## 🔗 Relacionamentos e Dependências

### Fluxo de Dados Principal

```
Usuário interage com Canvas
  ↓
QuestAdventureComponent detecta clique
  ↓
Se clique em NPC + em range:
  → DialogueService carrega árvore do NPC
  → QuestChatModalComponent renderiza nó inicial

Usuário seleciona opção de diálogo
  ↓
QuestChatModalComponent chama DialogueService.selectOption()
  ↓
DialogueService processa ação do nó:
  - Se action.type === 'give_item':
      → InventoryQuestIntegrationService.receiveItemFromNPC()
      → InventoryService.addItem()
      → NpcManagerService.checkAutoUnlock() (se item desbloqueia NPC)
  - Se action.type === 'request_item':
      → Abre InventoryPanelComponent
      → Aguarda seleção do jogador
  - Se action.type === 'complete_objective':
      → QuestStateService.completeObjective()
      → QuestStateService.addXP()
      → QuestTrackerComponent atualiza visualmente
  - Se action.type === 'unlock_npc':
      → NpcManagerService.unlockNpc()
      → QuestCanvasComponent renderiza indicador "!"
```

### Dependências entre Componentes

**QuestAdventureComponent** depende de:
- `QuestStateService` (estado central)
- `NpcManagerService` (lista de NPCs)
- `DialogueService` (diálogos ativos)
- `InventoryQuestIntegrationService` (mediação de entregas)
- `PlayerMovementService` (posição do jogador)

**QuestCanvasComponent** depende de:
- `NpcManagerService` (posições e estados dos NPCs)
- `PlayerMovementService` (posição do jogador)
- `QuestStateService` (objetivos para renderizar indicadores)

**QuestChatModalComponent** depende de:
- `DialogueService` (nó atual e navegação)
- `InventoryQuestIntegrationService` (para processar entregas)

**QuestTrackerComponent** depende de:
- `QuestStateService` (objetivos e XP)

**InventoryPanelComponent** depende de:
- `InventoryService` (inventário e seleção)
- `InventoryQuestIntegrationService` (para tentar entregas)

### Integração com Backend (Preparada)

**Conectividade via WebSocket:**
- `GamificationWebSocketService` conecta com `wss://host:5006/ws/gamification`
- Envia eventos: `{ type: 'objective_completed', playerId: '...', objectiveId: '...', timestamp: ... }`
- Recebe eventos: notificações de achievements, leaderboard updates

**API HTTP (Fallback):**
- `GET /api/gamification/metrics` retorna métricas agregadas
- `GET /api/gamification/events` retorna histórico do MongoDB
- `POST /api/gamification/events` persiste eventos (futuro)

**Sincronização de Save (Futuro):**
- Estrutura `SaveGameState` pode ser enviada para `POST /api/quest/save`
- Backend salva no MongoDB com `userId` + `timestamp`
- Frontend pode buscar save via `GET /api/quest/save/:userId` para cross-device sync

**Conexão com Agentes Reais:**
- NPCs possuem campo `agentId` (ex: `"escriba"` mapeia para agent-escriba no Conductor)
- Ao completar quest, backend pode criar conversation_id e adicionar agentes à conversa
- Frontend pode redirecionar para `/conversations/:id` para continuar interação com agentes reais

---

## 💡 Regras de Negócio Identificadas

### RN1: Progressão Linear Obrigatória
**Descrição:** O jogador não pode pular objetivos. Deve completar objetivo N para desbloquear objetivo N+1.
**Implementação:** `QuestStateService.objectives` possui array ordenado. Método `completeObjective(id)` só avança se `id === currentObjective.id`.
**Local:** `quest-state.service.ts:187`

### RN2: NPCs Desbloqueiam com Itens Específicos
**Descrição:** Cada NPC bloqueado possui um `requiredItem`. Quando jogador adquire esse item, NPC desbloqueia automaticamente sem necessidade de ação manual.
**Implementação:** `NpcManagerService.checkAutoUnlock(inventory)` verifica a cada mudança no inventário se algum item corresponde a `npc.requiredItem`.
**Local:** `npc-manager.service.ts:142`

### RN3: Itens Iniciais Indestrutíveis
**Descrição:** Os 5 itens iniciais (Código Primordial, Chave Alpha, Núcleo Beta, Módulo Gamma, Protocolo Omega) possuem flag `destroyable: false` e não podem ser descartados pelo jogador.
**Implementação:** `InventoryService.removeItem()` valida `item.destroyable` antes de permitir remoção.
**Local:** `inventory.service.ts:98`

### RN4: Validação de Entrega de Itens
**Descrição:** Quando NPC solicita item, jogador só pode entregar o item correto. Tentativa de entregar item errado resulta em mensagem de erro e item permanece no inventário.
**Implementação:** `InventoryQuestIntegrationService.attemptItemDelivery()` compara `selectedItem.id === requestedItemId`. Se falso, emite observable de erro.
**Local:** `inventory-quest-integration.service.ts:67`

### RN5: XP e Leveling Progressivo
**Descrição:** Jogador inicia nível 1 com 0 XP. Thresholds de XP: 100 (nv2), 300 (nv3), 600 (nv4), 1000 (nv5), 1500 (max). Ao atingir threshold, sobe nível automaticamente e XP reseta para 0 (contagem relativa ao nível).
**Implementação:** `QuestStateService.addXP(amount)` calcula `currentXP + amount`, verifica se excedeu `xpToNextLevel`, incrementa nível e ajusta XP.
**Local:** `quest-state.service.ts:256`

### RN6: Títulos Baseados em Nível
**Descrição:** Título do jogador muda conforme nível: 1→Iniciado, 2→Aprendiz, 3→Praticante, 4→Orquestrador, 5→Condutor Híbrido.
**Implementação:** `QuestStateService` possui mapeamento `LEVEL_TITLES`. Ao subir nível, atualiza `playerState.title`.
**Local:** `quest-state.service.ts:302`

### RN7: Memória de Diálogos Persistente
**Descrição:** Cada árvore de diálogo guarda o último nó visitado por NPC. Ao reabrir diálogo, continua de onde parou (não recomeça do início).
**Implementação:** `DialogueService` salva `lastNodeId` por `npcId` em localStorage (`quest_dialogue_memory`). Método `loadDialogue(treeId)` busca último nó ou usa nó inicial se primeira vez.
**Local:** `dialogue.service.ts:178`

### RN8: Auto-Save Periódico
**Descrição:** Sistema salva automaticamente todo progresso (estado, inventário, diálogos) a cada 30 segundos e em eventos críticos (completar objetivo, desbloquear NPC, ganhar item).
**Implementação:** `QuestAdventureComponent.ngOnInit()` inicia `setInterval(30000)` que chama `QuestStateService.saveToLocalStorage()`.
**Local:** `quest-adventure.component.ts:89`

### RN9: Range de Interação com NPCs
**Descrição:** Jogador só pode interagir com NPC se distância for menor que 50 pixels. Se longe, primeiro move-se automaticamente até NPC antes de abrir diálogo.
**Implementação:** `QuestAdventureComponent.onNpcClick(npc)` calcula distância euclidiana. Se > 50px, chama `PlayerMovementService.moveToPosition()` até posição do NPC.
**Local:** `quest-adventure.component.ts:214`

### RN10: Congelamento de NPCs Durante Interação
**Descrição:** Quando jogador está em diálogo com NPC, esse NPC para de vagar (wandering behavior congelado) para não sair do range de interação.
**Implementação:** `NpcManagerService.freezeNpc(id, duration)` marca `npc.isFrozen = true`. Sistema de wandering verifica flag antes de mover NPC.
**Local:** `npc-manager.service.ts:203`

### RN11: Raridade de Itens Afeta Visual
**Descrição:** Itens possuem 6 raridades (Common, Uncommon, Rare, Epic, Legendary, Mythic). Cada raridade possui cor de borda específica no inventário: cinza → verde → azul → roxo → dourado → arco-íris animado.
**Implementação:** `InventoryPanelComponent` aplica classe CSS baseada em `item.rarity`. Arquivo SCSS define cores e animações.
**Local:** `inventory-panel.component.scss:67`

### RN12: Limite de Inventário Soft
**Descrição:** Inventário possui 20 slots. Itens stackable ocupam 1 slot (quantidade cresce). Itens não-stackable ocupam 1 slot cada. Jogador não pode coletar mais itens se todos slots ocupados.
**Implementação:** `InventoryService.addItem()` verifica `inventory.length < maxSlots` antes de adicionar. Se stackable, busca slot existente antes de criar novo.
**Local:** `inventory.service.ts:56`

---

## 🎓 Conceitos-Chave

### Condutores Sintéticos
**Metáfora central do sistema.** Representam agentes de IA especializados do Conductor em forma de "robôs em hibernação". Cada um tem papel específico na orquestração:

- **Elder Guide (Guia):** Mentor que ensina conceitos básicos. Representa o onboarding humano.
- **Librarian (Bibliotecária):** Armazena conhecimento e contexto. Representa a base de conhecimento (RAG).
- **Requirements Scribe (Escriba):** Planeja e documenta projetos. Representa o agente de requisitos.
- **Artisan (Artesã):** Executa código e constrói artefatos. Representa o agente executor.
- **Critic (Crítica):** Revisa e refina trabalho. Representa o agente de QA/review.

### Cadeia de Ativação
**Sequência de desbloqueios progressivos** que simula a ordem natural de trabalho com agentes:
1. Entender o sistema (Guia)
2. Acessar conhecimento (Bibliotecária)
3. Planejar solução (Escriba)
4. Executar plano (Artesã)
5. Refinar resultado (Crítica)
6. Sincronizar todos (retorno ao Guia)

### Itens como Conhecimento
**Itens não são recursos consumíveis**, mas representam **conhecimento e autorização**:
- **Código Primordial:** Acesso ao sistema
- **Chave de Ativação:** Permissão para planejar
- **Núcleo de Execução:** Capacidade de executar
- **Módulo de Otimização:** Habilidade de refinar
- **Protocolo de Sincronização:** Maestria completa

### Wandering Behavior
**NPCs simulam vida autônoma** movendo-se aleatoriamente dentro de um raio (30-80 pixels) de sua posição inicial (`homePosition`). Isso cria sensação de mundo vivo, não estático. Durante interação, NPC congela para não quebrar imersão.

### Living Screenplays (Conceito Relacionado)
Embora não implementado diretamente na quest, diálogos mencionam **"documentos vivos que evoluem"** — conceito do Conductor onde screenplays são atualizados em tempo real conforme agentes trabalham. Bibliotecária cuida desses documentos.

### Gamificação Educacional
**Aprender fazendo.** Sistema não ensina conceitos através de tutoriais textuais, mas através de **experiência hands-on**. Jogador entende colaboração de agentes **vivenciando** a entrega de itens e desbloqueio progressivo, não lendo sobre isso.

---

## 📌 Observações

### Pontos Fortes do Design

✅ **Onboarding Efetivo:** Transforma conceitos abstratos (orquestração de agentes) em experiência concreta e memorável
✅ **Progressão Clara:** Cadeia linear de 6 objetivos evita confusão de "o que fazer agora?"
✅ **Persistência Robusta:** Auto-save + localStorage garante que progresso não seja perdido
✅ **Extensibilidade:** Diálogos e quests em JSON permitem adicionar conteúdo sem alterar código
✅ **Preparado para Backend:** Estrutura com `agentId`, WebSocket e save states pronta para sincronização
✅ **Responsividade:** Adapta canvas e posições para desktop e mobile

### Sugestões de Melhoria (Enxutas)

**1. Feedback Visual de Entrega de Itens**
Atualmente, ao entregar item, apenas mensagem textual no diálogo confirma sucesso. Considere adicionar animação de "item voando" do inventário até o NPC para reforço visual.

**2. Tutorial Interativo de Movimento**
Primeiros 10 segundos poderiam ter seta apontando para o Guia com texto "Clique para se mover" (só aparece se jogador não se moveu ainda).

**3. Achievements Visíveis**
Arquivo `quests.json` define 4 achievements, mas não há UI para exibi-los. Considere painel de conquistas desbloqueáveis.

**4. Som Ambiente (Opcional)**
Trilha sutil de música ambiente tech/synth + efeitos sonoros para diálogos, coleta de itens e level up aumentariam imersão (com toggle mute).

**5. Integração com Conversation Real**
Ao completar quest, botão "Criar Meu Primeiro Projeto" poderia criar conversation_id no backend, adicionar os 5 agentes desbloqueados e redirecionar para `/conversations/:id` para experiência hands-on real.

### Considerações Técnicas

**Performance:** Canvas a 60 FPS é leve para 5 NPCs + 1 player. Wandering behavior usa `setTimeout()` esparso (2-5s), não sobrecarrega rendering.

**Acessibilidade:** Componente focável por teclado (TAB para abrir inventário, ESC para fechar modais). Considerar adicionar leitores de tela (ARIA labels) para NPCs e itens.

**Mobile:** Touch eventos funcionam, mas drag & drop de itens precisa ajuste (atualmente preparado para mouse). Hover modals não aparecem em touch (considerar tap-and-hold).

**Localização:** Diálogos estão em JSON, facilitando tradução. Considerar sistema de i18n para múltiplos idiomas (en, pt-BR, es).

**Testes:** Componentes usam observables (RxJS), facilitando testes unitários. Considerar adicionar specs para serviços críticos (QuestStateService, DialogueService).

---

## 🎯 Conclusão

O **sistema de gamificação /quest** é uma implementação robusta de onboarding educacional que transforma aprendizado técnico em experiência narrativa envolvente. Através da metáfora de "Condutores Sintéticos", usuários entendem intuitivamente como agentes de IA colaboram em projetos reais.

**Tempo de desenvolvimento estimado:** 80-120 horas (full-stack)
**Tempo de conclusão pelo usuário:** 10-15 minutos
**Retenção de conhecimento:** Alta (aprender fazendo > ler documentação)
**Preparação para produção:** 85% (falta sincronização com backend e polimento visual)

**Próximos passos sugeridos:**
1. Conectar com API real do Conductor (criar conversation_id ao completar quest)
2. Implementar telemetria completa (eventos de gamificação no MongoDB)
3. Adicionar achievements visuais e leaderboard (opcional, gamificação extra)
4. Polir animações e adicionar efeitos sonoros (imersão)
5. Testes de usabilidade com usuários reais (A/B testing de narrativa)

---

**Arquivo gerado em:** 2025-11-11
**Versão do sistema analisado:** Commit `682e002` (feat: mobile bottom sheet + screenplay enhancements)
**Tecnologias:** Angular 18+ (standalone), RxJS, Canvas 2D, localStorage, WebSocket
**Contexto:** Conductor - Plataforma de Orquestração de Agentes de IA
