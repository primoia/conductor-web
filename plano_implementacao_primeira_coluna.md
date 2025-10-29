# 📋 Plano de Implementação: Sistema de Abas na Primeira Coluna

## 🎯 Objetivo

Transformar a `first-column` (atualmente apenas `<app-agent-game>`) em um sistema de abas com 3 visualizações:

1. **Aba 1**: 🎬 Árvore de Roteiros (arquivos markdown importados)
2. **Aba 2**: 🎭 Agentes Instanciados (o que já existe: `agent-game`)
3. **Aba 3**: 🤖 Catálogo de Agentes (definições disponíveis)

---

## 🔍 Análise da Estrutura Atual

### Localização
- **Arquivo HTML**: `/src/app/living-screenplay-simple/screenplay-interactive.html:4-6`
- **Componente Atual**: `<app-agent-game>` (visualização de agentes instanciados)
- **CSS**: `/src/app/living-screenplay-simple/screenplay-layout.css:21-26`

### Estrutura Atual da `first-column`
```html
<div class="first-column">
  <app-agent-game #agentGame></app-agent-game>
</div>
```

**Função do `agent-game`**:
- Canvas interativo mostrando agentes instanciados
- Filtros por status, tipo, execuções
- Métricas de performance
- Modos de visualização: "Por Instância" e "Por Agente"

---

## 📐 Arquitetura Proposta

### Estrutura HTML (Nova)
```html
<div class="first-column">
  <div class="first-column-tabs">
    <button
      class="tab-button"
      [class.active]="activeTab === 'tree'"
      (click)="setActiveTab('tree')">
      🎬 Roteiros
    </button>
    <button
      class="tab-button"
      [class.active]="activeTab === 'instances'"
      (click)="setActiveTab('instances')">
      🎭 Instâncias
    </button>
    <button
      class="tab-button"
      [class.active]="activeTab === 'agents'"
      (click)="setActiveTab('agents')">
      🤖 Agentes
    </button>
  </div>

  <div class="first-column-content">
    <!-- Aba 1: Árvore de Roteiros -->
    <app-screenplay-tree
      *ngIf="activeTab === 'tree'"
      [screenplays]="screenplays"
      (openScreenplay)="onTreeScreenplayOpen($event)"
      (editPath)="onTreeEditPath($event)"
      (reloadFromDisk)="onTreeReload($event)">
    </app-screenplay-tree>

    <!-- Aba 2: Agentes Instanciados (já existe) -->
    <app-agent-game
      *ngIf="activeTab === 'instances'"
      #agentGame>
    </app-agent-game>

    <!-- Aba 3: Catálogo de Agentes -->
    <app-agent-catalog
      *ngIf="activeTab === 'catalog'"
      (selectAgent)="onCatalogAgentSelect($event)"
      (createAgent)="openAgentCreator()">
    </app-agent-catalog>
  </div>
</div>
```

---

## 🚀 Plano de Implementação

### **FASE 1: Preparação e Estrutura de Abas** ⏱️ 30min

#### 1.1 Adicionar Estado de Abas no `screenplay-interactive.ts`
```typescript
// Novo estado
activeTab: 'tree' | 'instances' | 'catalog' = 'instances'; // Default: mantém comportamento atual

// Novo método
setActiveTab(tab: 'tree' | 'instances' | 'catalog'): void {
  this.activeTab = tab;
  console.log('🔄 [TAB] Changed to:', tab);
}
```

**Arquivo**: `screenplay-interactive.ts:150` (após outros estados)

#### 1.2 Modificar HTML para Incluir Abas
- **Arquivo**: `screenplay-interactive.html:4-6`
- **Ação**: Substituir conteúdo da `first-column` pela estrutura de abas

#### 1.3 Criar CSS para Abas
- **Arquivo**: `screenplay-layout.css` (ou novo `first-column-tabs.css`)
- **Estilos**:
  - `.first-column-tabs`: Container horizontal com abas
  - `.tab-button`: Botão de aba com hover e estado ativo
  - `.tab-button.active`: Aba selecionada
  - `.first-column-content`: Container do conteúdo das abas

---

### **FASE 2A: Implementar Aba 1 - Árvore de Roteiros** ⏱️ 2h

#### 2.1 Criar Componente `app-screenplay-tree`
**Arquivo Novo**: `/src/app/living-screenplay-simple/screenplay-tree/screenplay-tree.component.ts`

**Responsabilidades**:
- Receber lista de roteiros via `@Input() screenplays`
- Agrupar roteiros por "projeto" (extraído do `importPath`)
- Exibir em árvore: projeto → arquivos
- Permitir editar `importPath` (botão ✏️)
- Permitir recarregar do disco (botão 🔄)
- Emitir eventos: `openScreenplay`, `editPath`, `reloadFromDisk`

**Estrutura Visual**:
```
📁 conductor
  ├─ 📄 README.md (v2) - 2 dias atrás
  └─ 📄 CONTRIBUTING.md (v1) - 5 dias atrás
📁 conductor-web
  ├─ 📄 README.md (v3) - 1 hora atrás
  └─ 📄 GUIDE.md (v1) - 3 dias atrás
📁 conductor-gateway
  └─ 📄 API.md (v2) - 1 semana atrás
📁 [Sem Projeto]
  └─ 📄 notas.md (v1) - 10 minutos atrás
```

**Interface de Dados**:
```typescript
interface ScreenplayTreeNode {
  type: 'project' | 'file';
  name: string;
  path?: string; // Full path (para projetos)
  screenplay?: ScreenplayListItem; // Para arquivos
  children?: ScreenplayTreeNode[]; // Para projetos
  isExpanded: boolean; // Estado de expansão
}
```

**Lógica de Agrupamento**:
```typescript
groupScreenplaysByProject(): ScreenplayTreeNode[] {
  const projectMap = new Map<string, ScreenplayListItem[]>();

  this.screenplays.forEach(screenplay => {
    const projectName = this.extractProjectName(screenplay.importPath);
    if (!projectMap.has(projectName)) {
      projectMap.set(projectName, []);
    }
    projectMap.get(projectName)!.push(screenplay);
  });

  return Array.from(projectMap.entries()).map(([project, screenplays]) => ({
    type: 'project',
    name: project,
    isExpanded: true,
    children: screenplays.map(s => ({
      type: 'file',
      name: s.name,
      screenplay: s,
      isExpanded: false
    }))
  }));
}

extractProjectName(importPath: string | undefined): string {
  if (!importPath) return '[Sem Projeto]';

  // Exemplos:
  // "conductor/README.md" → "conductor"
  // "/path/to/conductor/README.md" → "conductor"
  // "README.md" → "[Sem Projeto]"

  const parts = importPath.split('/');
  if (parts.length <= 1) return '[Sem Projeto]';

  // Pega o penúltimo segmento (pasta do projeto)
  return parts[parts.length - 2];
}
```

#### 2.2 Modal de Edição de Path
**Funcionalidade**: Quando usuário clica ✏️, abre modal para editar `importPath`

**Implementação**:
- Reutilizar estilo do modal de "Renomear" em `screenplay-manager.html:137-151`
- Salvar `importPath` no MongoDB via `ScreenplayStorage.updateScreenplay()`

**Exemplo**:
```html
<!-- Edit Path Dialog -->
<div class="dialog-backdrop" *ngIf="showEditPathDialog" (click)="cancelDialog()">
  <div class="dialog-container" (click)="$event.stopPropagation()">
    <h3>✏️ Editar Caminho de Importação</h3>
    <input
      type="text"
      class="dialog-input"
      [(ngModel)]="editingPath"
      placeholder="/caminho/completo/arquivo.md"
      (keyup.enter)="saveEditedPath()"
    />
    <small class="hint">Este caminho será usado para recarregar o arquivo do disco</small>
    <div class="dialog-actions">
      <button class="btn btn-secondary" (click)="cancelDialog()">Cancelar</button>
      <button class="btn btn-primary" (click)="saveEditedPath()">Salvar</button>
    </div>
  </div>
</div>
```

#### 2.3 Truncamento Seguro de Paths
**Problema**: Caminhos completos expõem informações sensíveis

**Solução**:
```typescript
sanitizePath(path: string): string {
  // Remove prefixos sensíveis configuráveis
  const sensitivePrefix = '/mnt/ramdisk/primoia-main/';
  if (path.startsWith(sensitivePrefix)) {
    return path.replace(sensitivePrefix, '');
  }
  return path;
}

// Exemplo:
// Input:  "/mnt/ramdisk/primoia-main/conductor-community/src/conductor/README.md"
// Output: "conductor-community/src/conductor/README.md"
```

**Configuração**: Adicionar `basePath` no `localStorage` para permitir usuário definir

#### 2.4 Integração com `screenplay-manager`
- **Modificar**: `screenplay-manager.ts:237-272` (método `showRenameScreen`)
- **Adicionar**: Campo para editar `importPath` no modal de renomear
- **OU**: Criar botão separado "✏️ Editar Caminho" na lista

---

### **FASE 2B: Implementar Aba 3 - Catálogo de Agentes** ⏱️ 1h

#### 2.1 Criar Componente `app-agent-catalog`
**Arquivo Novo**: `/src/app/living-screenplay-simple/agent-catalog/agent-catalog.component.ts`

**Responsabilidades**:
- Buscar agentes disponíveis da API: `GET /api/agents`
- Exibir lista de agentes em cards
- Busca e filtros (por nome, emoji, tipo)
- Clicar em agente → emite `selectAgent` (abre no editor ou instancia)
- Botão "➕ Criar Novo" → emite `createAgent` (abre modal de criação)

**Estrutura Visual**:
```
┌─────────────────────────────────────┐
│  🔍 [Buscar agentes...]            │
│  🏷️ Filtros: [Todos ▾]             │
├─────────────────────────────────────┤
│  🚀 Performance Agent               │
│  Monitors application performance   │
│  [📋 Instanciar] [✏️ Editar]        │
├─────────────────────────────────────┤
│  🔐 Auth Agent                      │
│  Manages user authentication        │
│  [📋 Instanciar] [✏️ Editar]        │
├─────────────────────────────────────┤
│  📊 Analytics Agent                 │
│  Collects usage metrics             │
│  [📋 Instanciar] [✏️ Editar]        │
├─────────────────────────────────────┤
│         [➕ Criar Novo Agente]       │
└─────────────────────────────────────┘
```

**API Integration**:
```typescript
loadAgents(): void {
  this.http.get<Agent[]>(`${environment.gatewayUrl}/api/agents`)
    .subscribe({
      next: (agents) => {
        this.agents = agents;
        this.filteredAgents = agents;
      },
      error: (error) => {
        console.error('Erro ao carregar agentes:', error);
      }
    });
}
```

#### 2.2 Eventos de Interação
```typescript
@Output() selectAgent = new EventEmitter<Agent>();
@Output() createAgent = new EventEmitter<void>();

onSelectAgent(agent: Agent): void {
  this.selectAgent.emit(agent);
}

onCreateAgent(): void {
  this.createAgent.emit();
}
```

**Parent Handler** (`screenplay-interactive.ts`):
```typescript
onCatalogAgentSelect(agent: Agent): void {
  // Opção 1: Abrir modal de seleção para instanciar
  this.openAgentSelector();

  // Opção 2: Adicionar emoji ao editor automaticamente
  this.interactiveEditor.insertText(agent.emoji);
}
```

---

### **FASE 3: Persistência e Sincronização** ⏱️ 30min

#### 3.1 Salvar Aba Ativa no LocalStorage
```typescript
setActiveTab(tab: 'tree' | 'instances' | 'catalog'): void {
  this.activeTab = tab;
  localStorage.setItem('firstColumnActiveTab', tab);
}

// No ngOnInit():
ngOnInit(): void {
  const savedTab = localStorage.getItem('firstColumnActiveTab') as any;
  if (savedTab) {
    this.activeTab = savedTab;
  }
}
```

#### 3.2 Atualizar Árvore ao Importar/Deletar Roteiro
- **Hook**: `onScreenplayManagerAction()` em `screenplay-interactive.ts:1970`
- **Ação**: Recarregar lista de roteiros no componente `screenplay-tree`

```typescript
@ViewChild('screenplayTree') screenplayTree?: ScreenplayTreeComponent;

onScreenplayManagerAction(event: ScreenplayManagerEvent): void {
  // ... código existente ...

  // Novo: Atualizar árvore
  if (event.action === 'import' || event.action === 'delete' || event.action === 'rename') {
    this.screenplayTree?.reloadScreenplays();
  }
}
```

---

## 🎨 Design e UX

### Paleta de Cores
```css
--tab-bg: #f8f9fa;
--tab-active-bg: #ffffff;
--tab-border: #e1e4e8;
--tab-active-border: #0366d6;
--tab-hover-bg: #f0f1f2;
--tree-project-bg: #f6f8fa;
--tree-file-bg: #ffffff;
```

### Animações
- **Transição de Abas**: `opacity` e `transform` (300ms)
- **Hover de Botões**: `scale(1.05)` (150ms)
- **Expansão de Projetos**: `max-height` (200ms)

---

## 📊 Requisitos de Dados

### Modificações no Modelo `ScreenplayListItem`
```typescript
interface ScreenplayListItem {
  id: string;
  name: string;
  version: number;
  updatedAt: string;
  createdAt: string;
  isDeleted: boolean;
  filePath?: string;
  importPath?: string; // ✅ Já existe (implementado anteriormente)
  fileKey?: string; // ✅ Já existe
  projectName?: string; // 🆕 Novo: nome do projeto extraído
}
```

**Backend**: Adicionar campo virtual `projectName` ao retornar roteiros (extrair de `importPath`)

---

## 🧪 Testes e Validação

### Cenários de Teste

#### Aba 1: Árvore de Roteiros
1. ✅ Importar arquivo sem path → aparece em "[Sem Projeto]"
2. ✅ Importar arquivo com path → agrupa por projeto
3. ✅ Editar path de um roteiro → move para novo projeto
4. ✅ Expandir/colapsar projetos → estado persiste na sessão
5. ✅ Clicar em arquivo → abre no editor
6. ✅ Clicar em 🔄 → recarrega do disco

#### Aba 2: Instâncias (já existe)
1. ✅ Visualizar agentes instanciados
2. ✅ Filtrar por status/tipo
3. ✅ Métricas de performance

#### Aba 3: Catálogo
1. ✅ Listar agentes disponíveis
2. ✅ Buscar agentes por nome
3. ✅ Instanciar agente → adiciona ao roteiro
4. ✅ Criar novo agente → abre modal

---

## 📦 Arquivos a Serem Criados/Modificados

### Novos Arquivos
```
src/app/living-screenplay-simple/
├── screenplay-tree/
│   ├── screenplay-tree.component.ts (🆕)
│   ├── screenplay-tree.component.html (🆕)
│   └── screenplay-tree.component.css (🆕)
└── agent-catalog/
    ├── agent-catalog.component.ts (🆕)
    ├── agent-catalog.component.html (🆕)
    └── agent-catalog.component.css (🆕)
```

### Arquivos Modificados
```
src/app/living-screenplay-simple/
├── screenplay-interactive.ts (modificar: +50 linhas)
├── screenplay-interactive.html (modificar: linhas 4-6)
├── screenplay-layout.css (adicionar: estilos de abas)
└── screenplay-manager/
    └── screenplay-manager.ts (modificar: adicionar edição de path)
```

---

## ⚠️ Considerações de Segurança

### Paths Sensíveis
- **Nunca exibir**: `/mnt/ramdisk/`, `/home/user/`, chaves SSH, tokens
- **Sempre sanitizar**: Remover prefixos sensíveis antes de exibir
- **Configurável**: Permitir usuário definir "base path" a ocultar

### File System Access API
- **Limitação de Segurança**: Navegador não fornece caminho completo
- **Workaround**: Pedir usuário informar path manualmente no modal de edição
- **Fallback**: Se API não disponível (Firefox/Safari), exibir mensagem

---

## 🚦 Priorização

### Ordem de Implementação Recomendada
1. **FASE 1**: Estrutura de abas (rápido, base para tudo)
2. **FASE 2A**: Árvore de roteiros (funcionalidade principal solicitada)
3. **FASE 3**: Persistência (melhora UX)
4. **FASE 2B**: Catálogo de agentes (nice-to-have)

### MVP (Minimum Viable Product)
Para validar rapidamente:
- ✅ Abas funcionais
- ✅ Aba 1: Lista simples de roteiros (sem árvore)
- ✅ Aba 2: Agent-game (já existe)
- ⏸️ Aba 3: Pode ser implementada depois

---

## 🎯 Próximos Passos

### Decisões Pendentes
1. **Edição de Path**:
   - ❓ Modal separado ou integrado ao "Renomear"?
   - **Sugestão**: Modal separado é mais claro

2. **Extração de Projeto**:
   - ❓ Backend ou Frontend?
   - **Sugestão**: Frontend (mais rápido, sem deploy de backend)

3. **Estado de Expansão da Árvore**:
   - ❓ Persiste entre sessões ou só na sessão atual?
   - **Sugestão**: Sessão atual (localStorage, menos complexo)

### Aprovação para Prosseguir
Aguardando confirmação para:
- ✅ Iniciar FASE 1 (estrutura de abas)
- ✅ Iniciar FASE 2A (árvore de roteiros)
- ❓ Prioridade da Aba 3 (catálogo)?

---

## 📚 Referências Técnicas

### APIs Utilizadas
- **File System Access API**: Para leitura de arquivos
- **LocalStorage API**: Para persistência de estado
- **Angular Material**: (opcional) Para componentes de árvore

### Componentes Relacionados
- `screenplay-manager`: Gerenciamento de roteiros
- `agent-game`: Visualização de instâncias
- `agent-selector-modal`: Seleção de agentes

---

**Última Atualização**: 2025-10-29
**Versão do Documento**: 1.0
**Autor**: Claude (Requirements Engineer)
