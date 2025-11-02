# 🔍 Diagnóstico: Problema no Carregamento de Agentes Minions (.game-canvas)

## 📋 Visão Geral

O componente `AgentGameComponent` não está renderizando os agentes minions no canvas conforme esperado. Este documento analisa a causa raiz do problema e propõe soluções.

---

## 🎯 Localização dos Arquivos

### Componente Principal
- **Classe TypeScript**: `/src/app/living-screenplay-simple/agent-game/agent-game.component.ts` (2900+ linhas)
- **Template HTML**: `/src/app/living-screenplay-simple/agent-game/agent-game.component.html` (linha 83-89)
- **Estilos CSS**: `/src/app/living-screenplay-simple/agent-game/agent-game.component.css` (linha 240-248)

### HTML do Canvas
```html
<canvas
  #gameCanvas
  class="game-canvas"
  (click)="onCanvasClick($event)"
  (mousemove)="onCanvasMouseMove($event)"
  (mouseleave)="onCanvasMouseLeave($event)">
</canvas>
```

### CSS do Canvas
```css
.game-canvas {
  width: 100%;
  height: 100%;
  cursor: pointer;
  display: block;
  flex: 1;
  min-height: 0;
  object-fit: contain;
}
```

---

## 🔄 Fluxo de Inicialização (ngAfterViewInit)

O componente segue este fluxo de inicialização:

```typescript
ngAfterViewInit(): void {
  1. initCanvas()              // Inicializa contexto 2D e ResizeObserver
  2. loadSprites()             // Cria sprites programaticamente
  3. generatePlants()          // Gera plantas decorativas
  4. loadAgentsFromBFF()       // 🚨 PONTO CRÍTICO - Busca agentes da API
  5. startGameLoop()           // Inicia loop de animação
  6. startPeriodicSync()       // Sincronização a cada 30s
}
```

---

## 🐛 Causa Raiz Identificada

### ⚠️ **Problema 1: Carregamento Assíncrono de Sprites**

**Localização**: `agent-game.component.ts:590-600`

```typescript
private createWalkingCharacterSprite(gender: 'male' | 'female' = 'male'): SpriteAnimation {
  // ... código de desenho do sprite ...

  // 🚨 PROBLEMA AQUI
  const img = new Image();
  img.src = tempCanvas.toDataURL(); // Cria Data URL, mas não espera carregar

  return {
    image: img,  // ❌ Imagem pode não estar carregada ainda!
    frameWidth,
    frameHeight,
    totalFrames,
    animationSpeed: 8
  };
}
```

**Explicação**:
- O método `toDataURL()` converte o canvas temporário em uma Data URL (base64)
- A imagem é atribuída ao objeto `img` **mas não é aguardado o carregamento**
- Quando `addAgentFromBFF()` tenta usar o sprite (linha 696-727), a imagem pode ainda não estar pronta
- Resultado: **sprite.image existe, mas pode não ter dados renderizáveis ainda**

---

### ⚠️ **Problema 2: Sem Fallback Garantido na Renderização**

**Localização**: `agent-game.component.ts:1495-1515`

```typescript
private renderAgent(agent: AgentCharacter): void {
  // ... código de trail e indicadores ...

  // 🚨 CONDIÇÃO FRÁGIL
  if (agent.sprite && agent.sprite.image && agent.sprite.totalFrames > 0) {
    // Tenta desenhar sprite
    this.ctx.drawImage(
      agent.sprite.image,  // ❌ Se a imagem não carregou, nada aparece!
      agent.sprite.currentFrame * agent.sprite.frameWidth,
      0,
      agent.sprite.frameWidth,
      agent.sprite.frameHeight,
      x - agent.radius,
      y - agent.radius,
      agent.radius * 2,
      agent.radius * 2
    );
  } else {
    // Fallback: desenhar emoji
    this.ctx.font = '24px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(agent.emoji, x, y);
  }
}
```

**Explicação**:
- A condição `agent.sprite.image` retorna `true` mesmo se a imagem não terminou de carregar
- `drawImage()` falha silenciosamente se a imagem não está pronta
- O fallback de emoji **só é acionado se `sprite` for nulo/undefined**, não se a imagem não carregou

---

### ⚠️ **Problema 3: Possível Ausência de Dados da API**

**Localização**: `agent-game.component.ts:637-683`

```typescript
private async loadAgentsFromBFF(): Promise<void> {
  try {
    const url = `${baseUrl}/api/agents/instances?limit=500`;
    const response = await this.http.get<{ success: boolean, count: number, instances: any[] }>(url).toPromise();

    if (response && response.success && response.instances && response.instances.length > 0) {
      // ✅ Agentes encontrados
      response.instances.forEach((agentData) => {
        this.addAgentFromBFF(agentData);
      });
    } else {
      // ⚠️ Sem agentes - canvas vazio
      console.warn('⚠️ [AGENT-GAME] No agents found in BFF response, no agents will be displayed');
      this.agents = [];
    }
  } catch (error) {
    // ❌ Erro na API - canvas vazio
    console.error('❌ [AGENT-GAME] Error loading agents from BFF:', error);
    this.agents = [];
  }
}
```

**Explicação**:
- Se a API não retornar agentes (`instances.length === 0`), o canvas fica vazio
- Se houver erro de rede/autenticação, o canvas também fica vazio
- **Não há agentes de teste/mock para desenvolvimento**

---

## 🛠️ Soluções Propostas

### ✅ **Solução 1: Aguardar Carregamento de Sprites**

Modificar `createWalkingCharacterSprite` para retornar uma Promise:

```typescript
private async createWalkingCharacterSpriteAsync(gender: 'male' | 'female' = 'male'): Promise<SpriteAnimation> {
  const frameWidth = 48;
  const frameHeight = 48;
  const totalFrames = 5;

  // ... código de desenho no canvas ...

  // ✅ Criar imagem e aguardar carregamento
  const img = new Image();

  return new Promise((resolve, reject) => {
    img.onload = () => {
      console.log(`✅ [SPRITE] Sprite ${gender} carregado com sucesso`);
      resolve({
        image: img,
        frameWidth,
        frameHeight,
        totalFrames,
        animationSpeed: 8
      });
    };

    img.onerror = (error) => {
      console.error(`❌ [SPRITE] Erro ao carregar sprite ${gender}:`, error);
      reject(error);
    };

    img.src = tempCanvas.toDataURL();
  });
}
```

E modificar `loadSprites()` e `createCharacterSprites()`:

```typescript
private async loadSprites(): Promise<void> {
  try {
    await this.createCharacterSpritesAsync();
    console.log('🎨 [SPRITES] Sprites carregados com sucesso');
  } catch (error) {
    console.error('❌ [SPRITES] Erro ao carregar sprites:', error);
  }
}

private async createCharacterSpritesAsync(): Promise<void> {
  const spriteMale = await this.createWalkingCharacterSpriteAsync('male');
  this.spriteAnimations.set('character-male', spriteMale);

  const spriteFemale = await this.createWalkingCharacterSpriteAsync('female');
  this.spriteAnimations.set('character-female', spriteFemale);
}
```

E ajustar `ngAfterViewInit()`:

```typescript
async ngAfterViewInit(): Promise<void> {
  this.initCanvas();
  await this.loadSprites();  // ✅ Aguardar sprites antes de continuar
  this.generatePlants();
  await this.loadAgentsFromBFF();  // ✅ Já é async
  this.startGameLoop();
  this.startPeriodicSync();
  // ... resto do código ...
}
```

---

### ✅ **Solução 2: Melhorar Fallback de Renderização**

Adicionar verificação de imagem completa:

```typescript
private renderAgent(agent: AgentCharacter): void {
  const { x, y } = agent.position;

  // ... código de trail e indicadores ...

  // ✅ Verificar se sprite está pronto E a imagem carregou
  const spriteReady = agent.sprite
    && agent.sprite.image
    && agent.sprite.totalFrames > 0
    && agent.sprite.image.complete  // ✅ Verificar se a imagem carregou
    && agent.sprite.image.naturalWidth > 0;  // ✅ Verificar dimensões válidas

  if (spriteReady) {
    try {
      this.ctx.drawImage(
        agent.sprite.image,
        agent.sprite.currentFrame * agent.sprite.frameWidth,
        0,
        agent.sprite.frameWidth,
        agent.sprite.frameHeight,
        x - agent.radius,
        y - agent.radius,
        agent.radius * 2,
        agent.radius * 2
      );
    } catch (error) {
      // ✅ Se drawImage falhar, usar fallback
      console.warn(`⚠️ [RENDER] Falha ao desenhar sprite de ${agent.name}, usando emoji`, error);
      this.renderAgentEmoji(agent);
    }
  } else {
    // Fallback: desenhar emoji
    this.renderAgentEmoji(agent);
  }
}

// ✅ Método auxiliar para desenhar emoji
private renderAgentEmoji(agent: AgentCharacter): void {
  this.ctx.font = '24px Arial';
  this.ctx.textAlign = 'center';
  this.ctx.textBaseline = 'middle';
  this.ctx.fillText(agent.emoji, agent.position.x, agent.position.y);
}
```

---

### ✅ **Solução 3: Adicionar Agentes de Teste para Desenvolvimento**

Modificar `loadAgentsFromBFF()` para incluir fallback:

```typescript
private async loadAgentsFromBFF(): Promise<void> {
  try {
    const url = `${baseUrl}/api/agents/instances?limit=500`;
    const response = await this.http.get<{ success: boolean, count: number, instances: any[] }>(url).toPromise();

    if (response && response.success && response.instances && response.instances.length > 0) {
      console.log('🎮 [AGENT-GAME] Loaded agents from BFF:', response.instances);
      this.agents = [];
      response.instances.forEach((agentData) => {
        this.addAgentFromBFF(agentData);
      });
      this.groupAgentsByType();
      console.log(`✅ [LOAD] Carregados ${this.agents.length} agentes.`);
    } else {
      console.warn('⚠️ [AGENT-GAME] No agents found in BFF response');
      // ✅ Adicionar agentes de teste em desenvolvimento
      if (!environment.production) {
        console.log('🧪 [DEV] Criando agentes de teste...');
        this.createTestAgents();
      } else {
        this.agents = [];
      }
    }
  } catch (error) {
    console.error('❌ [AGENT-GAME] Error loading agents from BFF:', error);
    // ✅ Fallback para ambiente de desenvolvimento
    if (!environment.production) {
      console.log('🧪 [DEV] Erro ao carregar da API, criando agentes de teste...');
      this.createTestAgents();
    } else {
      this.agents = [];
    }
  }
}

// ✅ Método para criar agentes de teste
private createTestAgents(): void {
  const testAgents = [
    { emoji: '🤖', name: 'Test Bot Alpha', agent_id: 'test_001' },
    { emoji: '🧪', name: 'Test Runner Beta', agent_id: 'test_002' },
    { emoji: '📚', name: 'Doc Generator Gamma', agent_id: 'test_003' },
    { emoji: '🔐', name: 'Security Checker Delta', agent_id: 'test_004' },
  ];

  testAgents.forEach(data => {
    this.addAgentFromBFF({
      instance_id: `test_instance_${Date.now()}_${Math.random()}`,
      agent_id: data.agent_id,
      screenplay_id: 'test_screenplay',
      emoji: data.emoji,
      definition: { title: data.name, emoji: data.emoji }
    });
  });

  console.log(`✅ [TEST] Criados ${this.agents.length} agentes de teste`);
}
```

---

### ✅ **Solução 4: Adicionar Logs de Diagnóstico**

Adicionar logs no método de renderização para entender o que está acontecendo:

```typescript
private renderAgent(agent: AgentCharacter): void {
  const { x, y } = agent.position;

  // ✅ Log de diagnóstico (pode ser removido após correção)
  if (!agent.sprite || !agent.sprite.image) {
    console.warn(`⚠️ [RENDER] Agente ${agent.name} sem sprite ou imagem`);
  } else if (!agent.sprite.image.complete) {
    console.warn(`⚠️ [RENDER] Sprite de ${agent.name} ainda não carregou`);
  } else if (agent.sprite.image.naturalWidth === 0) {
    console.warn(`⚠️ [RENDER] Sprite de ${agent.name} tem dimensões inválidas`);
  }

  // ... resto do código de renderização ...
}
```

---

## 📊 Checklist de Verificação

Para diagnosticar o problema em tempo real, verificar:

- [ ] **Console do navegador** tem logs `🎨 [SPRITES] Sprites carregados com sucesso`?
- [ ] **Console do navegador** tem logs `✅ [LOAD] Carregados X agentes`?
- [ ] **API BFF** está respondendo em `/api/agents/instances`?
- [ ] **Canvas** tem dimensões válidas (não é 0x0)?
- [ ] **Sprites** têm `image.complete === true` e `naturalWidth > 0`?
- [ ] **Game loop** está rodando (usar `toggleDebug()` no console)?

### Comandos de Debug Disponíveis (no console do navegador):

```javascript
// Ver métricas de todos os agentes
debugAgentMetrics()

// Ver métricas de um agente específico
debugAgent("nome_do_agente")

// Ativar painel de debug visual
toggleDebug()
```

---

## 💡 Regras de Negócio Relevantes

### **RN1: Sprites Programáticos**
Os sprites dos minions são gerados programaticamente via canvas 2D, não carregados de arquivos externos. Isso torna o sistema independente de assets externos, mas requer tratamento assíncrono correto.

### **RN2: Gênero Aleatório**
Cada agente tem 50% de chance de ser masculino (macacão azul) ou feminino (vestido rosa com coração), definido em `agent-game.component.ts:695`.

### **RN3: Fallback de Emoji**
Se o sprite falhar, o sistema deve usar o emoji do agente como fallback visual (`agent-game.component.ts:1510-1515`).

### **RN4: Renderização Contínua**
O game loop roda continuamente via `requestAnimationFrame`, então problemas de renderização são persistentes e visíveis imediatamente.

---

## 🎓 Conceitos-Chave

### **Canvas 2D Context**
Contexto de renderização obtido via `canvas.getContext('2d')`, usado para todos os comandos de desenho.

### **Data URL**
Representação base64 de uma imagem, gerada por `canvas.toDataURL()`. Permite criar imagens sem arquivos externos.

### **Image.complete**
Propriedade booleana que indica se uma imagem HTMLImageElement terminou de carregar.

### **naturalWidth/naturalHeight**
Dimensões originais da imagem. Se `naturalWidth === 0`, a imagem não carregou ou é inválida.

### **Game Loop**
Loop de animação contínuo usando `requestAnimationFrame`, chamando `update()` e `render()` a cada frame (~60 FPS).

---

## 📌 Conclusão

### Causa Raiz Provável:
**Os sprites não estão completamente carregados quando `renderAgent()` tenta desenhá-los**, resultando em falha silenciosa de `drawImage()` e nenhum fallback de emoji.

### Prioridade de Implementação:
1. **Solução 1** (Aguardar sprites) - **ALTA** - Resolve o problema na raiz
2. **Solução 2** (Melhorar fallback) - **ALTA** - Garante visibilidade dos agentes
3. **Solução 3** (Agentes de teste) - **MÉDIA** - Facilita desenvolvimento
4. **Solução 4** (Logs de diagnóstico) - **BAIXA** - Apenas para debugging

### Próximos Passos:
1. Implementar Solução 1 para tornar `loadSprites()` assíncrono
2. Implementar Solução 2 para validar `image.complete` antes de desenhar
3. Testar com agentes reais da API
4. Adicionar agentes de teste se necessário (Solução 3)

---

**Documento gerado em**: 2025-11-02
**Versão do Angular**: 20.3.2
**Arquivo analisado**: `agent-game.component.ts` (2900+ linhas)
