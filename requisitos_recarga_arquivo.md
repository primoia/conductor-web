# Funcionalidade: Recarga de Arquivo do Disco

## 📋 Visão Geral

A funcionalidade de **Recarga de Arquivo do Disco** permite que o usuário atualize o conteúdo de um roteiro (screenplay) já importado no sistema, lendo novamente o arquivo do disco sem criar uma nova entrada ou duplicar o documento. Isso é útil em cenários onde o arquivo original foi modificado externamente (por exemplo, por um agente externo, editor de texto, ou processo automatizado) e o usuário deseja sincronizar essas mudanças com o roteiro armazenado no banco de dados.

**Cenário de Uso**: Um usuário importou um arquivo README.md do disco para o sistema. Posteriormente, um agente externo (ou o próprio usuário em outro editor) modificou o arquivo README.md no disco. O usuário precisa atualizar o conteúdo do roteiro no sistema sem criar uma nova importação ou documento duplicado.

## 🎯 Requisitos Identificados

### Requisitos Funcionais

- **RF1**: O sistema deve exibir o **caminho de importação** (`importPath`) de cada roteiro na lista de gerenciamento, permitindo ao usuário identificar de onde o arquivo foi originalmente importado.

- **RF2**: O sistema deve exibir um **botão "Recarregar do Disco" (🔄)** apenas para roteiros que possuem um `importPath` definido (ou seja, que foram importados do disco).

- **RF3**: Ao clicar no botão "Recarregar do Disco", o sistema deve:
  - Abrir o seletor de arquivos do sistema operacional (File System Access API)
  - Permitir ao usuário selecionar um arquivo Markdown (.md)
  - Ler o conteúdo do arquivo selecionado
  - **Substituir o conteúdo** do roteiro existente pelo novo conteúdo
  - **Atualizar os metadados** (`importPath`, `fileKey`, `updatedAt`, `version`) sem alterar o ID do roteiro

- **RF4**: O sistema deve **incrementar a versão** do roteiro após a recarga bem-sucedida.

- **RF5**: O sistema deve **atualizar a interface** automaticamente após a recarga, refletindo a nova data de atualização e versão.

- **RF6**: Se o roteiro recarregado estiver **aberto no editor**, o sistema deve emitir um evento para atualizar o conteúdo visível no editor.

- **RF7**: O sistema deve exibir o caminho de importação **truncado** (últimos 50 caracteres) na interface para evitar overflow, mas mostrar o caminho completo no **tooltip** ao passar o mouse.

- **RF8**: O sistema deve **preservar o ID do roteiro** durante a recarga, garantindo que não seja criado um novo documento.

- **RF9**: Durante a importação inicial, o sistema deve armazenar:
  - `filePath`: Nome do arquivo com extensão
  - `importPath`: Caminho completo de onde foi importado
  - `fileKey`: Chave única gerada para detecção de duplicatas

### Requisitos Não-Funcionais

- **RNF1**: A funcionalidade deve usar a **File System Access API** (disponível em navegadores modernos como Chrome, Edge) para acessar arquivos do disco.

- **RNF2**: O sistema deve exibir mensagens de erro claras em caso de:
  - Navegador não suportado (falta de File System Access API)
  - Usuário cancelar a seleção de arquivo
  - Falha na leitura do arquivo
  - Falha na atualização do banco de dados

- **RNF3**: A interface deve fornecer **feedback visual** durante o processo de recarga (indicador de loading).

- **RNF4**: O botão de recarga deve ter **animação visual** (rotação do ícone 🔄) ao passar o mouse para indicar sua ação.

- **RNF5**: A operação de recarga deve ser **atômica**: se falhar, o conteúdo original não deve ser perdido.

## 🔄 Fluxo do Processo

### 1. Exibição do Caminho de Importação

1. **Carregamento da Lista**: Quando o modal "Gerenciar Roteiros" é aberto, o sistema busca todos os roteiros do banco de dados, incluindo os campos `importPath`, `filePath` e `fileKey`.

2. **Renderização**: Para cada roteiro na lista:
   - Se o campo `importPath` estiver presente, o sistema exibe:
     - Um ícone de pasta 📁
     - O caminho truncado (últimos 50 caracteres se maior que 50)
     - Um tooltip com o caminho completo ao passar o mouse

3. **Exibição do Botão**: O botão "🔄 Recarregar do Disco" só é exibido se `importPath` existir.

### 2. Processo de Recarga

1. **Início**: Usuário clica no botão "🔄 Recarregar do Disco" de um roteiro específico.

2. **Validação Prévia**:
   - O evento de clique não propaga para o item pai (previne abertura do roteiro)
   - Verifica se `importPath` existe (segurança dupla)

3. **Verificação de Compatibilidade**:
   - O sistema verifica se o navegador suporta `showOpenFilePicker` (File System Access API)
   - Se não suportar, exibe mensagem de erro clara

4. **Seleção de Arquivo**:
   - Abre o seletor de arquivos nativo do sistema operacional
   - Restringe a seleção a arquivos `.md` (Markdown)
   - Aguarda o usuário selecionar um arquivo ou cancelar

5. **Leitura do Conteúdo**:
   - Obtém o handle do arquivo selecionado
   - Lê o conteúdo como texto UTF-8

6. **Atualização no Banco de Dados**:
   - Envia requisição `PUT` para `/api/screenplays/{id}` com:
     - `content`: Novo conteúdo lido do arquivo
     - `importPath`: Nome do arquivo (atualizado caso seja diferente)
     - `fileKey`: Nova chave única gerada

7. **Atualização da Interface Local**:
   - Atualiza o item na lista local com:
     - `updatedAt`: Nova data de atualização
     - `version`: Nova versão (incrementada)
     - `importPath`: Caminho atualizado

8. **Notificação ao Editor**:
   - Emite evento `action` com tipo `'import'` e o roteiro atualizado
   - Se o roteiro estiver aberto no editor, o componente pai atualiza o conteúdo visível

9. **Feedback ao Usuário**:
   - Remove indicador de loading
   - Exibe sucesso implicitamente (nenhum erro, interface atualizada)
   - Log no console: `✅ [RELOAD] Screenplay reloaded successfully from disk`

### 3. Tratamento de Erros

- **Usuário Cancelou**: Se o usuário fechar o seletor sem escolher arquivo, o processo é cancelado silenciosamente (apenas log no console).

- **Erro de Leitura**: Se falhar ao ler o arquivo, exibe: "Erro ao recarregar do disco".

- **Erro de Atualização**: Se falhar ao atualizar no banco, exibe: "Falha ao atualizar o roteiro com o conteúdo do disco".

- **Navegador Incompatível**: Exibe: "Seu navegador não suporta o acesso direto ao sistema de arquivos. Use um navegador moderno (Chrome, Edge)."

## 🏗️ Componentes Principais

### Frontend (Angular)

#### 1. **screenplay-manager.html** (Template)
- **Responsabilidade**: Renderizar a interface do gerenciador de roteiros
- **Modificações**:
  - Adiciona exibição do caminho de importação dentro de `.screenplay-info`
  - Adiciona botão "🔄" dentro de `.screenplay-actions`
  - Usa diretiva `*ngIf="screenplay.importPath"` para exibição condicional

#### 2. **screenplay-manager.ts** (Component)
- **Responsabilidade**: Lógica de negócio do gerenciador de roteiros
- **Métodos Adicionados**:
  - `truncatePath(path: string): string` - Trunca caminho para exibição
  - `reloadFromDisk(screenplay, event): Promise<void>` - Executa a recarga do arquivo
- **Modificações em Métodos Existentes**:
  - `readFileAndImport()`: Agora salva `importPath`, `fileKey` durante importação inicial

#### 3. **screenplay-manager.scss** (Estilos)
- **Responsabilidade**: Estilização visual da interface
- **Classes Adicionadas**:
  - `.screenplay-path`: Estilo para exibição do caminho (fonte monospace, cor cinza, truncamento)
  - `.reload-btn:hover`: Estilo para o botão de recarga com animação de rotação
  - `@keyframes spin`: Animação de rotação 360° para o ícone

#### 4. **screenplay-storage.ts** (Service)
- **Responsabilidade**: Comunicação com a API backend
- **Interfaces**:
  - `ScreenplayListItem`: Inclui campos `importPath`, `exportPath`, `fileKey`
  - `ScreenplayPayload`: Permite envio desses campos em requisições
- **Métodos Utilizados**:
  - `updateScreenplay(id, payload)`: Atualiza o roteiro com novo conteúdo e metadados
  - `generateFileKey(filePath, fileName)`: Gera chave única para duplicatas

### Backend (Python/FastAPI)

A funcionalidade utiliza os endpoints existentes:

- **`PUT /api/screenplays/{id}`**: Atualiza conteúdo e metadados do roteiro
- **`GET /api/screenplays`**: Lista roteiros com metadados incluindo `importPath`

**Modificações necessárias no backend** (se ainda não implementadas):
- O modelo `Screenplay` no MongoDB deve incluir campos `importPath`, `exportPath`, `fileKey`
- O endpoint `PUT` deve aceitar e persistir esses campos
- O endpoint `GET` deve retornar esses campos na lista e detalhes

## 🔗 Relacionamentos e Dependências

### Fluxo de Dados

1. **Importação Inicial**:
   ```
   Usuário seleciona arquivo do disco
   → FileReader lê conteúdo
   → ScreenplayStorage.createScreenplay() envia para API
   → Backend salva no MongoDB com importPath
   → Lista local é atualizada com novo item
   ```

2. **Recarga do Disco**:
   ```
   Usuário clica "🔄"
   → File System Access API abre seletor
   → Lê conteúdo do arquivo selecionado
   → ScreenplayStorage.updateScreenplay() envia para API
   → Backend atualiza documento MongoDB (mesmo ID, nova versão)
   → Lista local e editor são atualizados
   ```

### Dependências de API

- **File System Access API** (`showOpenFilePicker`, `FileHandle`, `createWritable`)
  - Disponível em: Chrome 86+, Edge 86+
  - Não disponível em: Firefox, Safari (até versões recentes)

### Comunicação Entre Componentes

```
ScreenplayManager (Component)
    ↓ chama
ScreenplayStorage (Service)
    ↓ HTTP Request
Backend API (FastAPI)
    ↓ salva/atualiza
MongoDB (Database)
```

```
ScreenplayManager
    ↓ emite evento 'action'
ScreenplayInteractive (Parent Component)
    ↓ atualiza
Editor Monaco (se roteiro estiver aberto)
```

## 💡 Regras de Negócio Identificadas

1. **Regra 1: Exibição Condicional do Botão de Recarga**
   - Apenas roteiros com `importPath` definido devem exibir o botão "🔄"
   - _Implementação_: Diretiva `*ngIf="screenplay.importPath"` no botão (linha 62-67 do HTML)

2. **Regra 2: Preservação de Identidade do Roteiro**
   - A recarga **não deve** criar um novo documento
   - O ID do roteiro deve permanecer o mesmo após a recarga
   - _Implementação_: Usa `updateScreenplay(screenplay.id, ...)` ao invés de `createScreenplay()` (linha 439 do TS)

3. **Regra 3: Incremento de Versão**
   - Toda recarga bem-sucedida deve incrementar o campo `version`
   - Isso é gerenciado automaticamente pelo backend ao receber `PUT`
   - _Implementação_: Backend incrementa versão ao atualizar

4. **Regra 4: Atualização de Metadados**
   - A recarga deve atualizar:
     - `content`: Novo conteúdo do arquivo
     - `importPath`: Nome do arquivo (caso tenha mudado)
     - `fileKey`: Nova chave única
     - `updatedAt`: Data/hora da atualização (automático no backend)
   - _Implementação_: Payload enviado em `updateScreenplay()` (linhas 439-443 do TS)

5. **Regra 5: Sincronização com Editor Aberto**
   - Se o roteiro recarregado estiver aberto no editor, o conteúdo visível deve ser atualizado
   - _Implementação_: Emite evento `action: 'import'` para o componente pai (linhas 460-463 do TS)

6. **Regra 6: Validação de Compatibilidade de Navegador**
   - A funcionalidade só deve tentar usar File System Access API se o navegador suportar
   - Caso contrário, exibe mensagem de erro clara
   - _Implementação_: Verifica `'showOpenFilePicker' in window` (linha 417 do TS)

7. **Regra 7: Cancelamento Silencioso**
   - Se o usuário cancelar a seleção de arquivo, não deve exibir erro
   - Apenas registra no console
   - _Implementação_: Catch de `AbortError` retorna silenciosamente (linhas 474-477 do TS)

8. **Regra 8: Truncamento de Caminho para UI**
   - Caminhos longos devem ser truncados para evitar quebra de layout
   - Caminho completo deve estar disponível no tooltip
   - _Implementação_: `truncatePath()` retorna últimos 50 caracteres (linhas 398-402 do TS)

9. **Regra 9: Restrição de Tipo de Arquivo**
   - A recarga só deve aceitar arquivos Markdown (.md)
   - _Implementação_: Opção `accept: { 'text/markdown': ['.md'] }` no seletor (linha 429 do TS)

10. **Regra 10: Armazenamento de Caminho na Importação Inicial**
    - Durante a primeira importação, o sistema deve salvar `importPath` e `fileKey`
    - Isso habilita a funcionalidade de recarga para importações futuras
    - _Implementação_: Payload de criação inclui `importPath` e `fileKey` (linhas 638-639 do TS)

## 🎓 Conceitos-Chave

### File System Access API

A **File System Access API** é uma API moderna do navegador que permite que aplicações web leiam e escrevam arquivos do sistema de arquivos local do usuário, com sua permissão explícita. Ela substitui o método tradicional `<input type="file">` com funcionalidades mais poderosas:

- **`showOpenFilePicker()`**: Abre seletor de arquivos nativo para leitura
- **`showSaveFilePicker()`**: Abre seletor para salvar arquivos
- **`FileHandle`**: Referência persistente a um arquivo selecionado
- **Vantagens**: Acesso persistente, melhor UX, suporte a diretórios

**Limitações**: Disponível apenas em navegadores Chromium (Chrome, Edge). Não funciona em Firefox e Safari (até versões recentes).

### Importação vs. Recarga

- **Importação**: Cria um **novo** roteiro no banco de dados a partir de um arquivo do disco. Gera novo ID único.

- **Recarga**: **Atualiza** o conteúdo de um roteiro existente lendo novamente do disco. Preserva o ID, mas incrementa a versão.

### Chave de Arquivo (fileKey)

A `fileKey` é uma chave única gerada a partir do caminho e nome do arquivo usando base64. Ela serve para:

- **Detecção de Duplicatas**: Identificar se um arquivo já foi importado anteriormente
- **Sincronização**: Permitir verificação de integridade entre disco e banco de dados

**Geração**: `btoa(filePath + ':' + fileName).replace(/[^a-zA-Z0-9]/g, '')`

### Versionamento de Roteiros

Cada roteiro possui um campo `version` (inteiro) que:

- Inicia em `1` na criação
- Incrementa a cada atualização (edição ou recarga)
- Permite rastreamento de histórico de mudanças
- Facilita detecção de conflitos em cenários de sincronização

### Emissão de Eventos (Event Emitter)

O componente `ScreenplayManager` emite eventos para o componente pai (`ScreenplayInteractive`) usando Angular's `@Output` e `EventEmitter`:

```typescript
@Output() action = new EventEmitter<ScreenplayManagerEvent>();

// Emite evento de recarga
this.action.emit({
  action: 'import',
  screenplay: updatedScreenplay
});
```

O componente pai escuta esse evento e pode:
- Atualizar o editor Monaco se o roteiro estiver aberto
- Exibir notificação de sucesso
- Recarregar metadados exibidos

## 📌 Observações

### ✅ Situação Atual

A funcionalidade de **Recarga do Disco** foi **totalmente implementada** com:

1. ✅ Exibição do caminho de importação na lista de roteiros
2. ✅ Botão "🔄 Recarregar do Disco" com exibição condicional
3. ✅ Lógica completa de recarga usando File System Access API
4. ✅ Atualização automática da interface após recarga
5. ✅ Sincronização com editor aberto
6. ✅ Tratamento robusto de erros
7. ✅ Animação visual no botão de recarga
8. ✅ Truncamento de caminho longo com tooltip

### 🔧 Arquivos Modificados

1. **`screenplay-manager.html`** (linhas 54-67):
   - Adiciona exibição de `screenplay-path`
   - Adiciona botão de recarga condicional

2. **`screenplay-manager.ts`** (linhas 395-481):
   - Adiciona método `truncatePath()`
   - Adiciona método `reloadFromDisk()`
   - Modifica `readFileAndImport()` para salvar `importPath` e `fileKey`

3. **`screenplay-manager.scss`** (linhas 165-217):
   - Adiciona classe `.screenplay-path`
   - Adiciona estilo `.reload-btn:hover`
   - Adiciona animação `@keyframes spin`

### 🧪 Como Testar

1. **Testar Exibição do Caminho**:
   - Importar um arquivo do disco
   - Verificar se o caminho aparece abaixo do nome do roteiro
   - Passar o mouse sobre o caminho para ver tooltip completo

2. **Testar Recarga Básica**:
   - Importar um arquivo (ex: `test.md`)
   - Editar `test.md` externamente (adicionar texto)
   - Clicar no botão "🔄" do roteiro
   - Selecionar o arquivo `test.md` modificado
   - Verificar se o conteúdo foi atualizado
   - Verificar se a versão foi incrementada

3. **Testar Sincronização com Editor**:
   - Abrir um roteiro importado no editor
   - Clicar em "🔄" na lista
   - Selecionar arquivo modificado
   - Verificar se o editor atualiza automaticamente

4. **Testar Compatibilidade de Navegador**:
   - Testar em Chrome/Edge (deve funcionar)
   - Testar em Firefox (deve exibir mensagem de erro)

5. **Testar Cancelamento**:
   - Clicar em "🔄"
   - Cancelar seletor de arquivo
   - Verificar que nenhum erro é exibido (apenas console log)

### 💡 Melhorias Futuras Opcionais

1. **Armazenamento de FileHandle Persistente**:
   - Salvar o `FileHandle` do arquivo para recarregar automaticamente sem abrir seletor
   - Requer permissão persistente do usuário

2. **Recarga Automática**:
   - Detectar mudanças no arquivo usando `FileSystemWatcher` (se disponível)
   - Perguntar ao usuário se deseja recarregar quando detectar modificação

3. **Histórico de Versões**:
   - Salvar snapshot do conteúdo anterior antes de recarregar
   - Permitir "desfazer" recarga retornando à versão anterior

4. **Diff Visual**:
   - Exibir diferenças entre conteúdo atual e arquivo do disco antes de recarregar
   - Permitir aceitar/rejeitar mudanças seletivamente

5. **Sincronização Bidirecional**:
   - Detectar se arquivo no disco foi modificado externamente
   - Detectar se roteiro no banco foi modificado internamente
   - Resolver conflitos automaticamente ou manualmente

6. **Suporte a Navegadores Legacy**:
   - Implementar fallback usando `<input type="file">` para navegadores sem File System Access API
   - Perder funcionalidade de acesso persistente, mas manter recarga básica

7. **Notificação Visual de Sucesso**:
   - Exibir toast/snackbar confirmando recarga bem-sucedida
   - Destacar temporariamente o item recarregado na lista

8. **Logs de Auditoria**:
   - Registrar data, hora e usuário de cada recarga
   - Salvar hash do conteúdo para verificação de integridade

---

**Documento criado em**: 2025-10-29
**Versão**: 1.0
**Autor**: Requirements Engineer (Claude)
