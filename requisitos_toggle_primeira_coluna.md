# Toggle da Primeira Coluna (Menu Lateral)

## 📋 Visão Geral

Funcionalidade que permite ao usuário **esconder/mostrar a primeira coluna** (menu lateral com abas de navegação) através de um botão toggle, maximizando o espaço disponível para as colunas 2 (editor) e 3 (chat).

**Propósito de negócio:** Otimizar o uso do espaço horizontal da tela, permitindo que o usuário foque no editor e chat quando não precisa acessar o menu de navegação.

## 🎯 Requisitos Identificados

### Requisitos Funcionais

- **RF1**: O sistema deve permitir esconder a primeira coluna através de um botão
- **RF2**: O sistema deve permitir mostrar a primeira coluna novamente através do mesmo botão
- **RF3**: O botão deve mudar seu ícone/aparência conforme o estado (visível/escondido)
- **RF4**: As colunas 2 e 3 devem expandir automaticamente quando a coluna 1 é escondida
- **RF5**: A transição deve ser suave e animada
- **RF6**: O estado de visibilidade deve persistir durante a sessão do usuário

### Requisitos Não-Funcionais

- **RNF1**: A animação deve ter duração de 300ms para fluidez
- **RNF2**: O botão deve ser visualmente consistente com o design system existente
- **RNF3**: A interface deve permanecer responsiva durante a transição

## 🔄 Fluxo do Processo

### 1. Estado Inicial
A aplicação inicia com a primeira coluna **visível** por padrão, mostrando as abas de navegação (Agentes, Instâncias, Roteiros).

### 2. Ação do Usuário - Esconder
Quando o usuário clica no botão de toggle:
1. O sistema altera o estado `firstColumnVisible` para `false`
2. A primeira coluna desliza para fora da tela (esquerda) com animação de 300ms
3. As colunas 2 e 3 expandem proporcionalmente ocupando o espaço liberado
4. O ícone do botão muda para indicar que a coluna está escondida (ex: `▶`)

### 3. Ação do Usuário - Mostrar
Quando o usuário clica no botão novamente:
1. O sistema altera o estado `firstColumnVisible` para `true`
2. A primeira coluna desliza de volta para a posição original
3. As colunas 2 e 3 retornam às larguras proporcionais originais
4. O ícone do botão muda para indicar que a coluna está visível (ex: `◀`)

### 4. Interação com Splitter
O splitter entre colunas 2 e 3 continua funcionando independentemente do estado da primeira coluna.

## 🏗️ Componentes Principais

### Frontend (Angular)

#### **screenplay-interactive.ts**
- **Responsabilidade**: Gerenciar estado e lógica do toggle
- **Propriedades adicionadas**:
  - `firstColumnVisible: boolean = true` - Estado de visibilidade
- **Métodos adicionados**:
  - `toggleFirstColumn(): void` - Alterna visibilidade da coluna

#### **screenplay-interactive.html**
- **Responsabilidade**: Renderizar o botão e aplicar binding condicional
- **Modificações**:
  - Adicionar classe condicional `[class.first-column-hidden]` no container
  - Adicionar botão toggle estrategicamente posicionado
  - Binding de evento `(click)="toggleFirstColumn()"`

#### **screenplay-layout.css**
- **Responsabilidade**: Estilizar animações e estados visuais
- **Estilos adicionados**:
  - `.first-column` com `transition` para animação suave
  - `.first-column-hidden .first-column` com `transform: translateX(-100%)`
  - `.toggle-first-column-btn` para estilização do botão
  - Estados hover/active do botão

## 🔗 Relacionamentos e Dependências

### Layout de Colunas
O sistema atual usa um modelo de 3 colunas:

```
┌─────────────┬──────────────────────┬──────────────┐
│   Coluna 1  │      Coluna 2        │   Coluna 3   │
│   (Menu)    │     (Editor)         │    (Chat)    │
│   ~250px    │  screenplayWidth%    │  chatWidth%  │
└─────────────┴──────────────────────┴──────────────┘
```

Quando a **Coluna 1 é escondida**:

```
┌──────────────────────────────────┬──────────────┐
│          Coluna 2                │   Coluna 3   │
│         (Editor)                 │    (Chat)    │
│      screenplayWidth%            │  chatWidth%  │
└──────────────────────────────────┴──────────────┘
```

### Dependências
- **screenplay-container**: Container principal que aplica a classe condicional
- **screenplayWidth/chatWidth**: Propriedades que controlam proporções das colunas 2 e 3
- **Splitter**: Componente independente que continua funcionando normalmente

## 💡 Regras de Negócio Identificadas

1. **Visibilidade Padrão**: A primeira coluna sempre inicia **visível**
   - _Implementação_: `firstColumnVisible = true` no TypeScript

2. **Animação Obrigatória**: Todas as transições devem ser suaves
   - _Implementação_: `transition: transform 0.3s ease` no CSS

3. **Preservação do Splitter**: O splitter entre colunas 2 e 3 deve funcionar independentemente
   - _Implementação_: Lógica de splitter não é afetada pela visibilidade da coluna 1

4. **Ícone Dinâmico**: O botão deve indicar visualmente a ação que será executada
   - _Implementação_: Ícones condicionais `◀` (esconder) vs `▶` (mostrar)

5. **Posicionamento Estratégico**: O botão deve estar sempre acessível e não atrapalhar
   - _Implementação_: Posicionado no topo da segunda coluna (editor toolbar) ou flutuante

## 🎓 Conceitos-Chave

### Transform vs Display/Width
Usamos `transform: translateX()` ao invés de `display: none` ou `width: 0` porque:
- Mantém o elemento no DOM (melhor para acessibilidade)
- Permite animações suaves via GPU
- Preserva o estado interno da coluna (abas, scroll, etc.)

### Flexbox Layout
O layout usa **flexbox** para distribuir espaço:
- `.screenplay-container`: Container flex principal
- `.first-column`: Flex item com largura fixa
- `.screenplay-canvas` e `.chat-panel`: Flex items com larguras percentuais

### CSS Transitions
Animações CSS via `transition` são preferíveis a JavaScript porque:
- Melhor performance (executam na GPU)
- Código mais limpo e declarativo
- Sincronização automática de múltiplas propriedades

## 📌 Observações

### Alternativas de Posicionamento do Botão

**Opção 1: No topo do editor (recomendado)**
```html
<div class="editor-toolbar">
  <button class="toggle-first-column-btn">◀</button>
  <!-- resto dos botões -->
</div>
```
✅ Sempre visível
✅ Não interfere no conteúdo
✅ Consistente com outros controles

**Opção 2: Flutuante no canto**
```html
<button class="toggle-first-column-btn floating">◀</button>
```
✅ Sempre visível mesmo com scroll
⚠️ Pode sobrepor conteúdo

**Opção 3: No header das abas**
```html
<div class="first-column-tabs">
  <!-- abas -->
  <button class="collapse-btn">◀</button>
</div>
```
⚠️ Fica escondido quando a coluna está oculta

### Sugestões de Melhoria

1. **Persistência Local**: Salvar estado em `localStorage` para manter preferência entre sessões
   ```typescript
   localStorage.setItem('firstColumnVisible', this.firstColumnVisible.toString());
   ```

2. **Atalho de Teclado**: Adicionar `Ctrl+B` para toggle rápido
   ```typescript
   @HostListener('document:keydown.control.b', ['$event'])
   ```

3. **Responsividade**: Em telas pequenas (<1024px), esconder automaticamente a primeira coluna
   ```typescript
   @HostListener('window:resize')
   onResize() {
     if (window.innerWidth < 1024) this.firstColumnVisible = false;
   }
   ```

## 🔧 Implementação Técnica

### Propriedades TypeScript
```typescript
firstColumnVisible = true;

toggleFirstColumn(): void {
  this.firstColumnVisible = !this.firstColumnVisible;
}
```

### HTML Template
```html
<div class="screenplay-container"
     [class.first-column-hidden]="!firstColumnVisible">
  <div class="first-column">...</div>
  <!-- ... -->
</div>

<button class="toggle-first-column-btn"
        (click)="toggleFirstColumn()"
        [title]="firstColumnVisible ? 'Esconder menu' : 'Mostrar menu'">
  {{ firstColumnVisible ? '◀' : '▶' }}
</button>
```

### CSS Styles
```css
.first-column {
  transition: transform 0.3s ease;
}

.first-column-hidden .first-column {
  transform: translateX(-100%);
  pointer-events: none;
}

.toggle-first-column-btn {
  /* estilização do botão */
}
```

## 📊 Impacto Visual

### Antes (3 colunas)
- Coluna 1: ~250px fixos
- Coluna 2: 70% do espaço restante
- Coluna 3: 30% do espaço restante

### Depois (2 colunas)
- Coluna 1: Escondida (-100% via transform)
- Coluna 2: 70% da largura total
- Coluna 3: 30% da largura total

**Ganho de espaço**: ~250px + redistribuição proporcional das colunas 2 e 3

---

**Documentação gerada por Requirements Engineer**
_Traduzindo código em conhecimento de negócio_ 🔍
