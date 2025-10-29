# Funcionalidade: Importação e Exibição de Caminho de Arquivos

## 📋 Visão Geral

Esta funcionalidade permite aos usuários importar arquivos Markdown (.md) do disco para o banco de dados MongoDB, gerenciar roteiros salvos e exportá-los de volta para o disco. O sistema mantém referências aos caminhos dos arquivos importados/exportados, possibilitando rastreabilidade da origem dos roteiros.

A funcionalidade é acessada através de dois pontos principais:
1. **Botão "📥 Importar do Disco..."** - Importa arquivos diretamente do sistema de arquivos
2. **Botão "📂 Abrir do Banco..."** - Abre modal de gerenciamento mostrando roteiros salvos

## 🎯 Requisitos Identificados

### Requisitos Funcionais

- **RF1**: O sistema deve permitir importar arquivos Markdown (.md) do disco local
- **RF2**: O sistema deve salvar automaticamente arquivos importados no banco de dados MongoDB
- **RF3**: O sistema deve detectar duplicatas de arquivos importados (baseado em nome e caminho)
- **RF4**: O sistema deve exibir modal de gerenciamento com lista de roteiros salvos
- **RF5**: O sistema deve permitir exportar roteiros do banco para o disco
- **RF6**: O sistema deve armazenar metadados de caminho dos arquivos (`filePath`, `importPath`, `exportPath`)
- **RF7**: O sistema deve exibir informações de caminho no item da lista (class `screenplay-item`)
- **RF8**: O sistema deve permitir buscar roteiros por nome
- **RF9**: O sistema deve suportar paginação e carregamento incremental (scroll infinito)
- **RF10**: O sistema deve permitir renomear e deletar roteiros (soft delete)

### Requisitos Não-Funcionais

- **RNF1**: A interface deve usar File System Access API quando disponível no navegador
- **RNF2**: O sistema deve ter fallback para download tradicional em navegadores sem suporte
- **RNF3**: A busca deve ter debounce de 300ms para evitar requisições excessivas
- **RNF4**: A listagem deve carregar 20 itens por página

## 🔄 Fluxo do Processo

### Fluxo 1: Importação de Arquivo do Disco

1. **Início**: Usuário clica no botão "📥 Importar do Disco..." na toolbar
2. **Salvamento Preventivo**: Sistema verifica se há roteiro atual não salvo e salva automaticamente
3. **Seleção de Arquivo**: Abre diálogo de seleção de arquivo (input type="file" com accept=".md")
4. **Leitura**: Sistema lê o conteúdo do arquivo usando FileReader API
5. **Detecção de Duplicatas**: Sistema verifica se já existe roteiro com mesmo nome ou fileKey
   - Se existe: Abre modal de resolução de conflito (substituir, criar novo, cancelar)
   - Se não existe: Prossegue para criação automática
6. **Criação no MongoDB**: Sistema cria novo documento screenplay com:
   - `name`: Nome do arquivo (sem extensão .md)
   - `content`: Conteúdo do arquivo
   - `importPath`: Caminho original do arquivo
   - `fileKey`: Chave única para detecção de duplicatas
7. **Carregamento no Editor**: Conteúdo é carregado no editor interativo
8. **Finalização**: Sistema exibe notificação de sucesso

### Fluxo 2: Abertura do Gerenciador de Roteiros

1. **Início**: Usuário clica no botão "📂 Abrir do Banco..." (open-btn)
2. **Abertura do Modal**: Componente `ScreenplayManager` é exibido (`showScreenplayManager = true`)
3. **Carregamento Inicial**: Sistema busca lista de roteiros via API (`getScreenplays()`)
4. **Exibição da Lista**: Roteiros são renderizados com class `screenplay-item`
   - Cada item mostra: nome, data de atualização, versão
   - Cada item possui ações: abrir, exportar, renomear, deletar
5. **Interação do Usuário**:
   - **Busca**: Digitar no campo de busca filtra roteiros (debounce 300ms)
   - **Scroll**: Carregar mais itens ao chegar no fim da lista
   - **Abrir**: Clique no item carrega roteiro completo no editor
   - **Exportar**: Salva roteiro de volta para o disco
   - **Renomear**: Abre diálogo para alterar nome
   - **Deletar**: Soft delete do roteiro
6. **Finalização**: Modal fecha ao selecionar um roteiro ou clicar em fechar

### Fluxo 3: Exportação de Roteiro para Disco

1. **Início**: Usuário clica no botão de exportar (📤) em um item da lista
2. **Carregamento Completo**: Sistema busca conteúdo completo do roteiro
3. **Seleção de Local**:
   - **Com File System Access API**: Abre diálogo nativo para escolher local e nome
   - **Fallback**: Faz download automático do arquivo
4. **Salvamento**: Arquivo é salvo no local escolhido
5. **Atualização de Metadados**: Sistema atualiza campo `filePath` no banco com caminho do arquivo salvo
6. **Finalização**: Notificação de sucesso

## 🏗️ Componentes Principais

### Frontend (Angular)

- **`ScreenplayInteractive` (screenplay-interactive.ts)**
  - **Responsabilidade**: Componente principal que gerencia o editor e a interação com roteiros
  - **Métodos-chave**:
    - `importFromDisk()`: Aciona seleção de arquivo do disco (linha 1185)
    - `handleFileSelect()`: Processa arquivo selecionado e inicia importação (linha 1196)
    - `openScreenplayManager()`: Abre modal de gerenciamento de roteiros
    - `createAndLinkScreenplayAutomatically()`: Cria roteiro no MongoDB automaticamente (linha 1282)
  - **Estado gerenciado**:
    - `currentScreenplay`: Roteiro atualmente carregado
    - `showScreenplayManager`: Controla visibilidade do modal
    - `sourceOrigin`: Rastreia origem do roteiro ('database', 'disk', 'new')
    - `sourceIdentifier`: Identificador da fonte do roteiro

- **`ScreenplayManager` (screenplay-manager.ts + screenplay-manager.html)**
  - **Responsabilidade**: Modal de gerenciamento de roteiros salvos
  - **Métodos-chave**:
    - `loadScreenplays()`: Busca lista paginada de roteiros (linha 89)
    - `openScreenplay()`: Carrega roteiro completo e emite evento (linha 167)
    - `exportScreenplay()`: Exporta roteiro para disco (linha 277)
    - `importFromDisk()`: Aciona input de arquivo para importação (linha 438)
    - `handleFileSelect()`: Processa arquivo importado (linha 521)
    - `exportScreenplayToDisk()`: Usa File System Access API para exportar (linha 448)
  - **Template HTML**:
    - Lista de roteiros com class `screenplay-item` (linha 43-78 do HTML)
    - Cada item exibe: nome, data, versão, e ações (exportar, renomear, deletar)
    - Campo de busca com debounce
    - Botão "Carregar Mais" para paginação

- **`ScreenplayStorage` Service (screenplay-storage.ts)**
  - **Responsabilidade**: Serviço de comunicação com API backend para operações CRUD
  - **Interface de Dados**:
    - `Screenplay`: Modelo completo com `content`, `importPath`, `exportPath`, `fileKey`
    - `ScreenplayListItem`: Modelo leve para listagem (sem content)
  - **Métodos principais**:
    - `getScreenplays()`: Lista paginada de roteiros
    - `getScreenplay(id)`: Busca roteiro completo por ID
    - `createScreenplay(payload)`: Cria novo roteiro
    - `updateScreenplay(id, payload)`: Atualiza roteiro existente
    - `deleteScreenplay(id)`: Soft delete de roteiro

### Backend (Python - Inferido)

Embora não tenhamos analisado o código Python diretamente, podemos inferir os endpoints necessários:

- **API Gateway**: `/api/screenplays/*`
  - `GET /api/screenplays?search=...&page=...&limit=...` - Listar roteiros
  - `GET /api/screenplays/:id` - Buscar roteiro específico
  - `POST /api/screenplays` - Criar novo roteiro
  - `PUT /api/screenplays/:id` - Atualizar roteiro
  - `DELETE /api/screenplays/:id` - Deletar roteiro (soft delete)

- **Modelo de Dados MongoDB**: `Screenplay`
  - `id` (ObjectId)
  - `name` (string)
  - `content` (string)
  - `description` (string)
  - `tags` (array)
  - `version` (number)
  - `filePath` (string) - Compatibilidade com sistema antigo
  - `importPath` (string) - Caminho original de importação
  - `exportPath` (string) - Último caminho de exportação
  - `fileKey` (string) - Chave única para detecção de duplicatas
  - `workingDirectory` (string) - Diretório de trabalho padrão
  - `createdAt` (datetime)
  - `updatedAt` (datetime)
  - `isDeleted` (boolean)

## 🔗 Relacionamentos e Dependências

```
ScreenplayInteractive
    ├─> ScreenplayManager (modal de gerenciamento)
    │   └─> ScreenplayStorage (serviço de API)
    │       └─> Backend API Gateway
    │           └─> MongoDB (storage)
    │
    └─> InteractiveEditor (editor de conteúdo)
```

**Fluxo de Comunicação**:

1. Usuário clica em "Abrir do Banco..."
2. `ScreenplayInteractive.openScreenplayManager()` é chamado
3. `ScreenplayManager` é exibido e chama `loadScreenplays()`
4. `ScreenplayStorage.getScreenplays()` faz requisição HTTP GET
5. Backend retorna lista paginada de `ScreenplayListItem[]`
6. Lista é renderizada com class `screenplay-item`
7. Ao clicar em um item, `openScreenplay()` é chamado
8. `ScreenplayStorage.getScreenplay(id)` busca conteúdo completo
9. Backend retorna `Screenplay` completo
10. `ScreenplayManager` emite evento `action` com screenplay
11. `ScreenplayInteractive` recebe evento e carrega no editor

## 💡 Regras de Negócio Identificadas

1. **Regra 1: Salvamento Automático Preventivo**
   - _Descrição_: Antes de importar novo arquivo, sistema deve salvar roteiro atual
   - _Implementação_: `screenplay-interactive.ts:1186` - Chamada a `ensureCurrentScreenplaySaved()`

2. **Regra 2: Sanitização de Nome de Arquivo**
   - _Descrição_: Nomes de arquivo devem remover extensão .md e caracteres especiais
   - _Implementação_: `screenplay-interactive.ts:1290` - Regex `replace(/[^a-zA-Z0-9\-_]/g, '-')`

3. **Regra 3: Detecção de Duplicatas**
   - _Descrição_: Sistema deve verificar se arquivo já foi importado baseado em `fileKey`
   - _Implementação_: `screenplay-interactive.ts:1220` - Método `checkForDuplicates()`

4. **Regra 4: Resolução de Conflitos**
   - _Descrição_: Usuário deve escolher ação ao importar arquivo duplicado (substituir/criar novo/cancelar)
   - _Implementação_: `screenplay-interactive.ts:1223` - Modal `ConflictResolutionModal`

5. **Regra 5: Soft Delete**
   - _Descrição_: Roteiros deletados não são removidos fisicamente, apenas marcados como `isDeleted: true`
   - _Implementação_: `screenplay-manager.ts:309` - Atualização com flag de deleção

6. **Regra 6: Persistência de Caminho**
   - _Descrição_: Sistema deve armazenar caminho de importação (`importPath`) e último caminho de exportação (`exportPath`)
   - _Implementação_:
     - Importação: `screenplay-interactive.ts:1308` - Salva `importPath` ao criar
     - Exportação: `screenplay-manager.ts:468-472` - Atualiza `filePath` após exportar

7. **Regra 7: Validação de Arquivo**
   - _Descrição_: Apenas arquivos Markdown (.md) devem ser aceitos
   - _Implementação_: HTML `accept=".md"` e validação em `validateMarkdownFile()`

8. **Regra 8: Carregamento Incremental**
   - _Descrição_: Lista deve carregar 20 itens por vez com opção de "Carregar Mais"
   - _Implementação_: `screenplay-manager.ts:103` - Parâmetro `limit: 20`

9. **Regra 9: Busca com Debounce**
   - _Descrição_: Busca deve aguardar 300ms após última digitação antes de requisitar
   - _Implementação_: `screenplay-manager.ts:55-63` - RxJS `debounceTime(300)`

10. **Regra 10: Prioridade de Conteúdo do Disco**
    - _Descrição_: Ao importar, sempre usar conteúdo do arquivo, nunca do backend
    - _Implementação_: `screenplay-interactive.ts:1318-1321` - Comentário "Always use disk content"

## 🎓 Conceitos-Chave

- **Screenplay**: Roteiro vivo - documento Markdown que contém agentes e instruções
- **File System Access API**: API moderna do navegador para acesso direto ao sistema de arquivos
- **Soft Delete**: Técnica de marcação de registros como deletados sem removê-los fisicamente
- **FileKey**: Chave única gerada para identificar arquivos duplicados (baseada em nome e caminho)
- **Source Origin**: Rastreamento da origem do roteiro (banco, disco ou novo)
- **Agent Instance**: Agentes vinculados ao roteiro (não analisados neste documento)

## 📌 Observações

### ✅ Situação Atual: Exibição de Caminho

**O sistema JÁ possui suporte para armazenar e exibir caminhos de arquivo!**

Os campos estão implementados no modelo de dados:
- `filePath`: Caminho do arquivo (mantido para compatibilidade)
- `importPath`: Caminho de onde o arquivo foi importado
- `exportPath`: Caminho da última exportação
- `fileKey`: Chave para detecção de duplicatas

**Onde o caminho é armazenado**:
- **Na importação**: Campo `importPath` é salvo em `screenplay-interactive.ts:1308`
- **Na exportação**: Campo `filePath` é atualizado em `screenplay-manager.ts:468`

**Como exibir no template**:

No arquivo `screenplay-manager.html`, linha 43-78, cada item com class `screenplay-item` pode ser expandido para mostrar o caminho:

```html
<div class="screenplay-item" (click)="openScreenplay(screenplay)">
  <div class="screenplay-info">
    <div class="screenplay-name">{{ screenplay.name }}</div>
    <div class="screenplay-meta">
      <span class="screenplay-date">{{ formatDate(screenplay.updatedAt) }}</span>
      <span class="screenplay-version">v{{ screenplay.version }}</span>
      <!-- ADICIONAR AQUI: -->
      <span class="screenplay-path" *ngIf="screenplay.importPath"
            [title]="screenplay.importPath">
        📁 {{ screenplay.importPath }}
      </span>
    </div>
  </div>
  <!-- ... ações ... -->
</div>
```

**Implementação sugerida**:

1. **Modificar template**: Adicionar span com `*ngIf="screenplay.importPath"`
2. **Estilizar CSS**: Adicionar estilo para `.screenplay-path` em `screenplay-manager.scss`
3. **Tooltip completo**: Usar atributo `[title]` para mostrar caminho completo ao passar mouse
4. **Truncar caminho longo**: Exibir apenas nome do arquivo ou últimos componentes do path

### 🔍 Pontos de Atenção

1. **File System Access API**: Nem todos os navegadores suportam (principalmente Safari). O sistema já tem fallback implementado.

2. **Sincronização de Conteúdo**: Backend pode retornar conteúdo vazio ao criar screenplay. Sistema já trata isso fazendo update em background (`screenplay-interactive.ts:1336-1345`).

3. **Detecção de Duplicatas**: Sistema usa `fileKey` gerado a partir de nome e caminho. Pode haver falsos positivos se usuário renomear arquivo.

4. **Performance**: Lista usa `trackByScreenplayId` para otimizar renderização Angular, mas pode ser lenta com muitos itens. Paginação ajuda a mitigar.

5. **Concorrência**: Não há lock de edição. Múltiplos usuários podem editar mesmo roteiro simultaneamente, causando conflitos.

### 💡 Melhorias Sugeridas (Apenas se Solicitado)

As seguintes melhorias são sugestões enxutas e relevantes para requisitos:

1. **Exibição visual do caminho**: Adicionar badge ou ícone mostrando origem (disco/banco)
2. **Histórico de caminhos**: Manter lista de todos os caminhos de importação/exportação
3. **Re-importação inteligente**: Botão para atualizar roteiro com conteúdo do arquivo original
4. **Sincronização automática**: Watch de arquivos para detectar mudanças externas
5. **Busca por caminho**: Permitir filtrar roteiros por caminho de importação

---

**Data de Análise**: 2025-10-29
**Versão do Sistema**: main branch (commit 79adc5d)
**Analista**: Requirements Engineer AI
