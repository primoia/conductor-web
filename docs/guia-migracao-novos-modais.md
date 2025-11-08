# Guia de Migração: Criando Novos Modais Padronizados

> Guia passo a passo para criar novos modais seguindo o padrão estabelecido no Conductor Web

**Versão:** 1.0
**Data:** 08/11/2025
**Documento de Referência:** [especificacao-modal-padrao.md](./especificacao-modal-padrao.md)

---

## Índice

1. [Pré-requisitos](#pré-requisitos)
2. [Estrutura de Arquivos](#estrutura-de-arquivos)
3. [Passo a Passo: Criando um Novo Modal](#passo-a-passo-criando-um-novo-modal)
4. [Checklist de Validação](#checklist-de-validação)
5. [Troubleshooting](#troubleshooting)
6. [Exemplos de Migração Real](#exemplos-de-migração-real)

---

## Pré-requisitos

Antes de criar um novo modal, certifique-se de que:

- ✅ A infraestrutura base está implementada (`src/app/shared/modals/base/`)
- ✅ Os estilos compartilhados existem (`src/app/shared/styles/`)
- ✅ Você leu a [Especificação de Modal Padrão](./especificacao-modal-padrao.md)
- ✅ Você está familiarizado com Angular standalone components
- ✅ Você compreende os conceitos de acessibilidade WCAG 2.1 AA

---

## Estrutura de Arquivos

Todo modal deve seguir esta estrutura:

```
src/app/[module]/[modal-name]/
├── [modal-name].component.ts         # Componente TypeScript
├── [modal-name].component.html       # Template HTML (externo)
├── [modal-name].component.scss       # Estilos SCSS (externo)
└── [modal-name].component.spec.ts    # Testes unitários
```

**Regras de nomenclatura:**
- Use kebab-case para nomes de arquivos
- Sufixo `.component` obrigatório
- Nome descritivo e específico (ex: `agent-preview-modal`)

---

## Passo a Passo: Criando um Novo Modal

### PASSO 1: Gerar o Componente

```bash
ng generate component [module]/[modal-name] --standalone --skip-tests=false
```

**Exemplo:**
```bash
ng generate component living-screenplay-simple/task-editor-modal --standalone --skip-tests=false
```

---

### PASSO 2: Configurar o Componente TypeScript

#### 2.1 Importar Dependências Base

```typescript
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseModalComponent } from '@/shared/modals/base/base-modal.component';
import { ModalHeaderComponent } from '@/shared/modals/base/modal-header.component';
import { ModalFooterComponent, ModalButton } from '@/shared/modals/base/modal-footer.component';
```

#### 2.2 Configurar o Decorator @Component

```typescript
@Component({
  selector: 'app-task-editor-modal',
  standalone: true,
  imports: [
    CommonModule,
    ModalHeaderComponent,
    ModalFooterComponent,
    // Adicione outros imports necessários (FormsModule, etc)
  ],
  templateUrl: './task-editor-modal.component.html',
  styleUrl: './task-editor-modal.component.scss'
})
```

#### 2.3 Extender BaseModalComponent

```typescript
export class TaskEditorModalComponent extends BaseModalComponent {
  // Inputs do modal
  @Input() taskId?: string;
  @Input() taskData?: any;

  // Outputs do modal
  @Output() taskSaved = new EventEmitter<any>();

  // Estado interno
  isLoading = false;
  errorMessage = '';

  // Configuração de botões
  buttons: ModalButton[] = [
    {
      label: 'Cancelar',
      type: 'secondary',
      action: 'cancel',
      ariaLabel: 'Cancelar edição'
    },
    {
      label: 'Salvar',
      type: 'primary',
      action: 'save',
      ariaLabel: 'Salvar tarefa'
    }
  ];

  /**
   * Manipula ações dos botões do footer
   */
  handleFooterAction(action: string): void {
    switch (action) {
      case 'cancel':
        this.close();
        break;
      case 'save':
        this.saveTask();
        break;
    }
  }

  /**
   * Salva a tarefa
   */
  private saveTask(): void {
    this.isLoading = true;
    // Lógica de salvamento
    // ...
    this.taskSaved.emit(this.taskData);
    this.close();
  }

  /**
   * Fecha o modal
   */
  override close(): void {
    this.closeModal.emit();
  }

  /**
   * Impede fechamento durante processamento
   */
  protected override preventBackdropClose(): boolean {
    return this.isLoading;
  }

  /**
   * Impede fechamento via ESC durante processamento
   */
  protected override preventEscapeClose(): boolean {
    return this.isLoading;
  }
}
```

---

### PASSO 3: Criar o Template HTML

```html
<!-- Overlay/Backdrop -->
<div
  *ngIf="isVisible"
  class="modal-overlay"
  (click)="handleBackdropClick()"
  role="presentation">

  <!-- Container do Modal -->
  <div
    class="modal-container"
    role="dialog"
    aria-labelledby="task-editor-modal-title"
    aria-describedby="task-editor-modal-description"
    aria-modal="true"
    (click)="$event.stopPropagation()">

    <!-- Header -->
    <app-modal-header
      [title]="taskId ? 'Editar Tarefa' : 'Nova Tarefa'"
      [titleId]="'task-editor-modal-title'"
      [closeButtonAriaLabel]="'Fechar modal de edição de tarefa'"
      (closeClick)="close()">
    </app-modal-header>

    <!-- Body -->
    <div
      class="modal-body"
      id="task-editor-modal-description">

      <!-- Mensagem de erro -->
      <div *ngIf="errorMessage" class="error-message">
        <i class="fa fa-exclamation-circle"></i>
        {{ errorMessage }}
      </div>

      <!-- Conteúdo do modal -->
      <form>
        <div class="form-group">
          <label for="task-title">Título da Tarefa</label>
          <input
            id="task-title"
            type="text"
            class="form-control"
            [(ngModel)]="taskData.title"
            [disabled]="isLoading"
            aria-required="true">
        </div>

        <div class="form-group">
          <label for="task-description">Descrição</label>
          <textarea
            id="task-description"
            class="form-control"
            [(ngModel)]="taskData.description"
            [disabled]="isLoading"
            rows="5">
          </textarea>
        </div>
      </form>
    </div>

    <!-- Footer -->
    <app-modal-footer
      [buttons]="buttons"
      [isLoading]="isLoading"
      (buttonClick)="handleFooterAction($event)">
    </app-modal-footer>
  </div>
</div>
```

---

### PASSO 4: Criar os Estilos SCSS

```scss
@use '../../shared/styles/modal-variables' as *;
@use '../../shared/styles/modal-mixins' as *;

// Overlay
.modal-overlay {
  @include modal-overlay($z-index-modal);
}

// Container
.modal-container {
  @include modal-container(700px); // Largura customizada
}

// Body
.modal-body {
  @include modal-body;
  padding: $modal-spacing-lg;
}

// Form Groups
.form-group {
  margin-bottom: $modal-spacing-md;

  label {
    display: block;
    margin-bottom: $modal-spacing-xs;
    font-size: $modal-font-size-sm;
    font-weight: 500;
    color: $modal-text-primary;
  }

  .form-control {
    width: 100%;
    padding: $modal-spacing-sm $modal-spacing-md;
    border: 1px solid $modal-border-color;
    border-radius: $modal-border-radius-sm;
    font-size: $modal-font-size-base;
    color: $modal-text-primary;
    background: $modal-bg-secondary;
    transition: all $modal-transition-duration;

    &:focus {
      outline: none;
      border-color: $modal-color-primary;
      box-shadow: 0 0 0 3px rgba($modal-color-primary, 0.1);
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }

  textarea.form-control {
    resize: vertical;
    min-height: 120px;
    font-family: inherit;
  }
}

// Error Message
.error-message {
  @include error-message;
  margin-bottom: $modal-spacing-md;
  display: flex;
  align-items: center;
  gap: $modal-spacing-sm;

  i {
    font-size: $modal-font-size-lg;
  }
}

// Responsividade
@include modal-responsive {
  .modal-container {
    width: 95vw;
    max-height: 90vh;
  }

  .modal-body {
    padding: $modal-spacing-md;
  }

  .form-group {
    margin-bottom: $modal-spacing-sm;
  }
}
```

---

### PASSO 5: Criar Testes Unitários

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TaskEditorModalComponent } from './task-editor-modal.component';

describe('TaskEditorModalComponent', () => {
  let component: TaskEditorModalComponent;
  let fixture: ComponentFixture<TaskEditorModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TaskEditorModalComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(TaskEditorModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('deve criar o componente', () => {
    expect(component).toBeTruthy();
  });

  it('deve exibir o modal quando isVisible é true', () => {
    component.isVisible = true;
    fixture.detectChanges();

    const modal = fixture.nativeElement.querySelector('.modal-overlay');
    expect(modal).toBeTruthy();
  });

  it('deve fechar ao clicar no backdrop', () => {
    spyOn(component.closeModal, 'emit');
    component.isVisible = true;
    fixture.detectChanges();

    const backdrop = fixture.nativeElement.querySelector('.modal-overlay');
    backdrop.click();

    expect(component.closeModal.emit).toHaveBeenCalled();
  });

  it('deve fechar ao pressionar ESC', () => {
    spyOn(component.closeModal, 'emit');
    component.isVisible = true;

    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    component.handleEscape(event);

    expect(component.closeModal.emit).toHaveBeenCalled();
  });

  it('não deve fechar durante processamento', () => {
    spyOn(component.closeModal, 'emit');
    component.isVisible = true;
    component.isLoading = true;
    fixture.detectChanges();

    const backdrop = fixture.nativeElement.querySelector('.modal-overlay');
    backdrop.click();

    expect(component.closeModal.emit).not.toHaveBeenCalled();
  });

  it('deve ter atributos ARIA corretos', () => {
    component.isVisible = true;
    fixture.detectChanges();

    const dialog = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('task-editor-modal-title');
  });

  it('deve emitir taskSaved ao salvar', () => {
    spyOn(component.taskSaved, 'emit');
    component.taskData = { title: 'Test Task', description: 'Test' };

    component.handleFooterAction('save');

    expect(component.taskSaved.emit).toHaveBeenCalledWith(component.taskData);
  });
});
```

---

### PASSO 6: Integrar no Componente Pai

```typescript
// parent.component.ts
import { TaskEditorModalComponent } from './task-editor-modal/task-editor-modal.component';

@Component({
  // ...
  imports: [TaskEditorModalComponent]
})
export class ParentComponent {
  showTaskModal = false;
  currentTask: any = null;

  openTaskModal(task?: any): void {
    this.currentTask = task || { title: '', description: '' };
    this.showTaskModal = true;
  }

  closeTaskModal(): void {
    this.showTaskModal = false;
    this.currentTask = null;
  }

  handleTaskSaved(task: any): void {
    console.log('Task saved:', task);
    this.closeTaskModal();
    // Atualizar lista, etc
  }
}
```

```html
<!-- parent.component.html -->
<button (click)="openTaskModal()">Nova Tarefa</button>

<app-task-editor-modal
  [(isVisible)]="showTaskModal"
  [taskData]="currentTask"
  (closeModal)="closeTaskModal()"
  (taskSaved)="handleTaskSaved($event)">
</app-task-editor-modal>
```

---

## Checklist de Validação

Antes de considerar o modal completo, valide:

### ✅ Estrutura
- [ ] Componente standalone
- [ ] Template em arquivo externo (`.html`)
- [ ] Estilos em arquivo externo (`.scss`)
- [ ] Testes unitários criados (`.spec.ts`)
- [ ] Estende `BaseModalComponent`

### ✅ Componentes Base
- [ ] Usa `ModalHeaderComponent`
- [ ] Usa `ModalFooterComponent`
- [ ] Importa variáveis SCSS (`@use '../../shared/styles/modal-variables'`)
- [ ] Importa mixins SCSS (`@use '../../shared/styles/modal-mixins'`)

### ✅ Estilos
- [ ] Usa `@use` (não `@import`)
- [ ] Usa variáveis compartilhadas (`$modal-*`)
- [ ] Usa mixins compartilhados (`@include modal-overlay`, etc)
- [ ] Responsivo com `@include modal-responsive`
- [ ] Sem valores hardcoded (cores, tamanhos)

### ✅ Acessibilidade
- [ ] `role="dialog"` no container
- [ ] `aria-modal="true"`
- [ ] `aria-labelledby` com ID único
- [ ] `aria-describedby` (se aplicável)
- [ ] `aria-label` em botões de ícone
- [ ] Fecha com ESC key
- [ ] Fecha com backdrop click
- [ ] Contraste mínimo 4.5:1

### ✅ Comportamento
- [ ] Implementa `handleBackdropClick()`
- [ ] Implementa `handleEscape()`
- [ ] Implementa `close()`
- [ ] Implementa `preventBackdropClose()` (se necessário)
- [ ] Implementa `preventEscapeClose()` (se necessário)
- [ ] Emite evento `closeModal`

### ✅ Testes
- [ ] Teste de criação do componente
- [ ] Teste de exibição quando `isVisible = true`
- [ ] Teste de fechamento por backdrop
- [ ] Teste de fechamento por ESC
- [ ] Teste de prevenção de fechamento durante loading
- [ ] Teste de atributos ARIA
- [ ] Cobertura > 80%

### ✅ Documentação
- [ ] JSDoc em métodos públicos
- [ ] Comentários em lógica complexa
- [ ] Exemplo de uso no README (se modal compartilhado)

---

## Troubleshooting

### Erro: "Cannot find module '@/shared/modals/base/base-modal.component'"

**Causa:** Path alias `@` não configurado

**Solução:**
```typescript
// Use path relativo temporariamente
import { BaseModalComponent } from '../../shared/modals/base/base-modal.component';
```

---

### Erro: "Cannot read property 'emit' of undefined"

**Causa:** Esqueceu de declarar `@Output() closeModal`

**Solução:**
```typescript
@Output() closeModal = new EventEmitter<void>();
```

---

### Erro: "SassError: Undefined variable $modal-spacing-md"

**Causa:** Esqueceu de importar variáveis SCSS

**Solução:**
```scss
@use '../../shared/styles/modal-variables' as *;
```

---

### Modal não fecha ao clicar no backdrop

**Causa:** Evento `click` propagando para o container

**Solução:**
```html
<div class="modal-container" (click)="$event.stopPropagation()">
```

---

### Botões do footer não funcionam

**Causa:** Não implementou `handleFooterAction()`

**Solução:**
```typescript
handleFooterAction(action: string): void {
  switch (action) {
    case 'save': this.save(); break;
    case 'cancel': this.close(); break;
  }
}
```

---

## Exemplos de Migração Real

Veja exemplos reais de modais já migrados:

1. **Modal Simples:** `src/app/living-screenplay-simple/agent-preview-modal/`
   - Exibição de dados read-only
   - Sem formulários
   - Apenas botão "Fechar"

2. **Modal com Formulário:** `src/app/living-screenplay-simple/councilor-edit-modal/`
   - Formulário complexo com validação
   - Estados de loading
   - Botões "Cancelar" e "Salvar"

3. **Modal com Tabs:** `src/app/living-screenplay-simple/report-modal/`
   - Sistema de abas (Result/Prompt/JSON)
   - Carregamento assíncrono
   - Markdown rendering

4. **Modal com Busca:** `src/app/living-screenplay-simple/agent-selector-modal/`
   - Input de busca com filtro em tempo real
   - Lista de itens clicáveis
   - Configurações avançadas expansíveis

---

## Recursos Adicionais

- **Especificação Completa:** [especificacao-modal-padrao.md](./especificacao-modal-padrao.md)
- **Plano de Normalização:** [plano-normalizacao-modais.md](./plano-normalizacao-modais.md)
- **README de Modais:** [src/app/shared/modals/README.md](../src/app/shared/modals/README.md)
- **Relatório de Validação:** [fase4-relatorio-validacao.md](./fase4-relatorio-validacao.md)

---

**Última atualização:** 08/11/2025
**Versão:** 1.0
**Mantido por:** Equipe de Frontend
