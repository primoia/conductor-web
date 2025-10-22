# 📝 Plano Frontend: Gerenciamento de Roteiros - Caminho de Arquivo

## 🎯 Objetivo
Implementar funcionalidades de gerenciamento de caminho de arquivo para roteiros no frontend Angular, permitindo importar e exportar arquivos markdown com persistência do caminho completo.

## 📋 Contexto
O sistema atual possui botões para importar e exportar roteiros, mas não armazena nem gerencia o caminho completo dos arquivos em disco. É necessário:

1. **Importar do Disco**: Armazenar o caminho completo do arquivo importado
2. **Exportar para Disco**: Permitir escolher o caminho de destino e armazená-lo
3. **Persistência**: Manter o caminho do arquivo associado ao roteiro

## 🔍 Análise do Código Atual

### Componentes Identificados:
- `screenplay-interactive.html` - Interface principal com botões de toolbar
- `screenplay-manager.html` - Modal de gerenciamento de roteiros
- `markdown-screenplay.ts` - Lógica de gerenciamento de roteiros

### Botões Existentes:
- `📂 Abrir do Banco...` - Abre modal de gerenciamento
- `📥 Importar do Disco...` - Importa arquivo do disco
- `📤 Exportar para Disco...` - Exporta arquivo para disco

## 📝 Checklist de Implementação

### Fase 1: Estrutura de Dados
- [ ] **1.1** Adicionar campo `filePath` ao modelo de roteiro
- [ ] **1.2** Atualizar interface `Screenplay` para incluir `filePath?: string`
- [ ] **1.3** Modificar `ScreenplayManager` para exibir caminho do arquivo quando disponível

### Fase 2: Importação com Caminho
- [ ] **2.1** Modificar `importFromDisk()` para capturar caminho completo do arquivo
- [ ] **2.2** Atualizar `handleFileSelect()` para armazenar `filePath`
- [ ] **2.3** Enviar `filePath` para o backend ao salvar roteiro importado
- [ ] **2.4** Exibir caminho do arquivo na lista de roteiros do modal

### Fase 3: Exportação com Caminho
- [ ] **3.1** Implementar `openExportModal()` com seletor de diretório
- [ ] **3.2** Criar modal de exportação com campo de caminho
- [ ] **3.3** Permitir escolha de diretório de destino
- [ ] **3.4** Atualizar `filePath` do roteiro após exportação bem-sucedida

### Fase 4: Persistência e UI
- [ ] **4.1** Modificar `save()` para incluir `filePath` na requisição
- [ ] **4.2** Atualizar `loadScreenplays()` para carregar `filePath` do backend
- [ ] **4.3** Adicionar indicador visual de arquivo associado na lista
- [ ] **4.4** Implementar funcionalidade "Abrir Localização" do arquivo

### Fase 5: Validação e Testes
- [ ] **5.1** Validar persistência do caminho após importação
- [ ] **5.2** Validar atualização do caminho após exportação
- [ ] **5.3** Testar comportamento com arquivos inexistentes
- [ ] **5.4** Implementar tratamento de erros para operações de arquivo

## 🎨 Especificações de Interface

### Modal de Gerenciamento Atualizado:
```html
<!-- Adicionar na lista de roteiros -->
<div class="screenplay-file-path" *ngIf="screenplay.filePath">
  📁 {{ screenplay.filePath }}
</div>
```

### Modal de Exportação:
```html
<div class="export-modal">
  <h3>Exportar Roteiro</h3>
  <input type="text" [(ngModel)]="exportPath" placeholder="Caminho do arquivo...">
  <button (click)="selectDirectory()">📁 Escolher Pasta</button>
  <button (click)="confirmExport()">Exportar</button>
</div>
```

## 🔧 Arquivos a Modificar

### Principais:
- `src/app/living-screenplay-simple/screenplay-interactive.html`
- `src/app/living-screenplay-simple/screenplay-manager/screenplay-manager.html`
- `src/app/living-screenplay-simple/markdown-screenplay.ts`

### Secundários:
- `src/app/living-screenplay-simple/screenplay-manager/screenplay-manager.ts`
- Interfaces de modelo de dados
- Serviços de comunicação com backend

## ⚠️ Considerações Técnicas

1. **Segurança**: Validar caminhos de arquivo para evitar path traversal
2. **Cross-platform**: Usar APIs compatíveis com Windows/Linux/Mac
3. **Performance**: Não bloquear UI durante operações de arquivo
4. **UX**: Feedback visual claro para operações de import/export
5. **Fallback**: Funcionar mesmo se `filePath` não estiver disponível

## 🎯 Critérios de Sucesso

- [ ] Usuário pode importar arquivo e o caminho é armazenado
- [ ] Usuário pode exportar para local específico e caminho é atualizado
- [ ] Caminho do arquivo é exibido na interface de gerenciamento
- [ ] Persistência funciona corretamente entre sessões
- [ ] Interface responsiva e intuitiva

## 📊 Estimativa de Esforço
- **Tempo estimado**: 4-6 horas
- **Complexidade**: Média
- **Dependências**: Backend deve suportar campo `filePath`