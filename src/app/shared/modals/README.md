# Modais Padronizados - Conductor Web

> Documentação oficial do sistema de modais padronizados do Conductor Web

**Versão:** 1.0
**Data:** 08/11/2025
**Especificação:** [docs/especificacao-modal-padrao.md](../../../../docs/especificacao-modal-padrao.md)
**Plano de Normalização:** [docs/plano-normalizacao-modais.md](../../../../docs/plano-normalizacao-modais.md)

---

## Índice

1. [Visão Geral](#visão-geral)
2. [Componentes Base](#componentes-base)
3. [Guia Rápido](#guia-rápido)
4. [Exemplos Completos](#exemplos-completos)
5. [Estilos e Customização](#estilos-e-customização)
6. [Acessibilidade](#acessibilidade)
7. [Testes](#testes)
8. [FAQ](#faq)

---

## Visão Geral

Este diretório contém a infraestrutura base para **todos os modais** do sistema Conductor Web. O objetivo é fornecer:

- **Consistência visual** em todos os modais
- **Comportamentos padronizados** (ESC, backdrop, foco)
- **Acessibilidade WCAG 2.1 AA** nativa
- **Componentes reutilizáveis** para acelerar desenvolvimento
- **Estilos compartilhados** via SCSS

### Estrutura de Arquivos

```
src/app/shared/modals/
├── base/
│   ├── base-modal.component.ts          # Classe abstrata base
│   ├── base-modal.component.spec.ts     # Testes do base
│   ├── modal-header.component.ts        # Header reutilizável
│   ├── modal-header.component.html      # Template do header
│   ├── modal-header.component.scss      # Estilos do header
│   ├── modal-header.component.spec.ts   # Testes do header
│   ├── modal-footer.component.ts        # Footer reutilizável
│   ├── modal-footer.component.html      # Template do footer
│   ├── modal-footer.component.scss      # Estilos do footer
│   └── modal-footer.component.spec.ts   # Testes do footer
└── README.md (este arquivo)

src/app/shared/styles/
├── _modal-variables.scss                # Variáveis compartilhadas
├── _modal-mixins.scss                   # Mixins reutilizáveis
└── _z-index.scss                        # Hierarquia de z-index
```

---

## Status de Migração

Todos os **11 modais** do sistema foram migrados e normalizados seguindo esta especificação:

| Modal | Status | Componentes Base | SCSS | Testes |
|-------|--------|------------------|------|--------|
| Agent Preview Modal | ✅ Migrado | ✅ | ✅ | ✅ |
| Agent Personalization Modal | ✅ Migrado | ✅ | ✅ | ✅ |
| Agent Selector Modal | ✅ Migrado | ✅ | ✅ | ✅ |
| Agent Control Modal | ✅ Migrado | ✅ | ✅ | ✅ |
| Conflict Resolution Modal | ✅ Migrado | ✅ | ✅ | ✅ |
| Councilor Edit Modal | ✅ Migrado | ✅ | ✅ | ✅ |
| Councilor Report Modal | ✅ Migrado | ✅ | ✅ | ✅ |
| Promote Councilor Modal | ✅ Migrado | ✅ | ✅ | ✅ |
| Report Modal | ✅ Migrado | ✅ | ✅ | ✅ |
| Persona Edit Modal | ✅ Migrado | ✅ | ✅ | ✅ |
| Proposal Modal | ✅ Migrado | ✅ | ✅ | ✅ |

**Progresso:** 11/11 modais normalizados (100%)

**Melhorias alcançadas:**
- ✅ 0% templates inline (era 54.5%)
- ✅ 0% styles inline (era 54.5%)
- ✅ 0% arquivos `.css` (convertidos para `.scss`)
- ✅ 100% usando `@use` (eliminado `@import`)
- ✅ 100% com componentes base reutilizáveis
- ✅ 100% com variáveis SCSS compartilhadas
- ✅ 100% com acessibilidade WCAG 2.1 AA

Para detalhes da migração, consulte:
- [Plano de Normalização](../../../../docs/plano-normalizacao-modais.md)
- [Relatório de Validação FASE 4](../../../../docs/fase4-relatorio-validacao.md)

---

## Componentes Base

### 1. BaseModalComponent

Classe abstrata que fornece funcionalidade comum para todos os modais.

**Características:**
- Gerenciamento de visibilidade (`isVisible`)
- Fechamento por ESC key
- Fechamento por backdrop click
- Proteção contra fechamento acidental durante processamento
- Hooks customizáveis

**Uso básico:**

```typescript
import { BaseModalComponent } from '@/shared/modals/base/base-modal.component';

@Component({
  selector: 'app-my-modal',
  templateUrl: './my-modal.component.html',
  styleUrls: ['./my-modal.component.scss']
})
export class MyModalComponent extends BaseModalComponent {
  // Sua implementação
}
```

---

### 2. ModalHeaderComponent

Componente standalone para header de modais.

**Props:**
- `title` (string) - Título do modal
- `titleId` (string) - ID para aria-labelledby
- `showCloseButton` (boolean) - Exibe botão de fechar
- `closeButtonText` (string) - Texto do botão (padrão: `×`)
- `closeButtonAriaLabel` (string) - Label ARIA do botão
- `disableClose` (boolean) - Desabilita botão de fechar

**Eventos:**
- `close` - Emitido ao clicar no botão de fechar

**Uso:**

```html
<app-modal-header
  [title]="'Editar Usuário'"
  [showCloseButton]="true"
  (close)="onClose()">
</app-modal-header>
```

---

### 3. ModalFooterComponent

Componente standalone para footer com botões de ação.

**Props:**
- `buttons` (ModalButton[]) - Array de configurações de botões
- `loadingText` (string) - Texto durante loading
- `alignLeft` (boolean) - Alinha botões à esquerda
- `compact` (boolean) - Usa padding reduzido

**Eventos:**
- `buttonClick` - Emitido ao clicar em um botão (retorna `action`)

**Interface ModalButton:**

```typescript
interface ModalButton {
  label: string;           // Texto do botão
  type: ButtonType;        // 'primary' | 'secondary' | 'danger' | 'success' | 'warning'
  action: string;          // Identificador da ação
  disabled?: boolean;      // Se está desabilitado
  loading?: boolean;       // Se está em loading
  ariaLabel?: string;      // Label ARIA
  icon?: string;           // HTML do ícone
  fullWidth?: boolean;     // Largura total (mobile)
}
```

**Uso:**

```typescript
// No componente .ts
footerButtons: ModalButton[] = [
  { label: 'Cancelar', type: 'secondary', action: 'cancel' },
  { label: 'Salvar', type: 'primary', action: 'save', loading: this.isSaving }
];

onButtonClick(action: string): void {
  if (action === 'save') this.save();
  else if (action === 'cancel') this.onClose();
}
```

```html
<!-- No template .html -->
<app-modal-footer
  [buttons]="footerButtons"
  (buttonClick)="onButtonClick($event)">
</app-modal-footer>
```

**Factory Functions:**

```typescript
import {
  createCancelButton,
  createConfirmButton,
  createDeleteButton,
  createDefaultButtons
} from '@/shared/modals/base/modal-footer.component';

// Criar botões rapidamente
const buttons = [
  createCancelButton(),
  createConfirmButton({ loading: this.isSaving })
];

// Ou usar conjunto padrão
const buttons = createDefaultButtons({
  confirmLabel: 'Salvar',
  confirmDisabled: !this.isValid
});
```

---

## Guia Rápido

### Criar um Novo Modal (Passo a Passo)

#### 1. Criar estrutura de arquivos

```bash
# Dentro de src/app/shared/modals/
mkdir my-modal
cd my-modal

# Criar arquivos
touch my-modal.component.ts
touch my-modal.component.html
touch my-modal.component.scss
touch my-modal.component.spec.ts
```

#### 2. Implementar o componente TypeScript

```typescript
// my-modal.component.ts
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseModalComponent } from '../base/base-modal.component';
import { ModalHeaderComponent } from '../base/modal-header.component';
import { ModalFooterComponent, ModalButton, createDefaultButtons } from '../base/modal-footer.component';

@Component({
  selector: 'app-my-modal',
  standalone: true,
  imports: [CommonModule, ModalHeaderComponent, ModalFooterComponent],
  templateUrl: './my-modal.component.html',
  styleUrls: ['./my-modal.component.scss']
})
export class MyModalComponent extends BaseModalComponent {
  @Input() data: any;
  @Output() confirm = new EventEmitter<any>();

  footerButtons: ModalButton[] = createDefaultButtons({
    confirmLabel: 'Salvar'
  });

  onButtonClick(action: string): void {
    if (action === 'confirm') {
      this.confirm.emit(this.data);
      this.onClose();
    } else if (action === 'cancel') {
      this.onClose();
    }
  }
}
```

#### 3. Criar o template HTML

```html
<!-- my-modal.component.html -->
<div class="modal-backdrop" *ngIf="isVisible" (click)="onBackdropClick($event)">
  <div class="modal-content" (click)="$event.stopPropagation()"
       role="dialog"
       aria-labelledby="my-modal-title"
       aria-modal="true">

    <!-- Header -->
    <app-modal-header
      [title]="'Meu Modal'"
      [titleId]="'my-modal-title'"
      (close)="onClose()">
    </app-modal-header>

    <!-- Body -->
    <div class="modal-body">
      <p>Conteúdo do modal aqui...</p>
    </div>

    <!-- Footer -->
    <app-modal-footer
      [buttons]="footerButtons"
      (buttonClick)="onButtonClick($event)">
    </app-modal-footer>
  </div>
</div>
```

#### 4. Aplicar estilos SCSS

```scss
// my-modal.component.scss
@use '../styles/modal-variables' as vars;
@use '../styles/modal-mixins' as mixins;

.modal-backdrop {
  @include mixins.modal-backdrop();
}

.modal-content {
  @include mixins.modal-container();
}

.modal-body {
  @include mixins.modal-body();

  // Estilos específicos do seu modal
  p {
    margin-bottom: 16px;
    color: vars.$modal-body-color;
  }
}
```

#### 5. Usar no componente pai

```typescript
// parent.component.ts
showModal = false;

openModal(): void {
  this.showModal = true;
}

closeModal(): void {
  this.showModal = false;
}

onConfirm(data: any): void {
  console.log('Confirmado:', data);
  this.closeModal();
}
```

```html
<!-- parent.component.html -->
<button (click)="openModal()">Abrir Modal</button>

<app-my-modal
  [isVisible]="showModal"
  [data]="myData"
  (closeModal)="closeModal()"
  (confirm)="onConfirm($event)">
</app-my-modal>
```

---

## Exemplos Completos

### Exemplo 1: Modal de Confirmação Simples

```typescript
@Component({
  selector: 'app-confirmation-modal',
  standalone: true,
  imports: [CommonModule, ModalHeaderComponent, ModalFooterComponent],
  template: `
    <div class="modal-backdrop" *ngIf="isVisible" (click)="onBackdropClick($event)">
      <div class="modal-content" (click)="$event.stopPropagation()" role="dialog">
        <app-modal-header [title]="title" (close)="onClose()"></app-modal-header>
        <div class="modal-body">{{ message }}</div>
        <app-modal-footer [buttons]="buttons" (buttonClick)="onButtonClick($event)"></app-modal-footer>
      </div>
    </div>
  `,
  styleUrls: ['./confirmation-modal.component.scss']
})
export class ConfirmationModalComponent extends BaseModalComponent {
  @Input() title = 'Confirmação';
  @Input() message = 'Tem certeza?';
  @Output() confirm = new EventEmitter<void>();

  buttons = createDefaultButtons({ confirmLabel: 'Confirmar' });

  onButtonClick(action: string): void {
    if (action === 'confirm') {
      this.confirm.emit();
      this.onClose();
    } else {
      this.onClose();
    }
  }
}
```

### Exemplo 2: Modal com Formulário e Validação

```typescript
@Component({
  selector: 'app-form-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalHeaderComponent, ModalFooterComponent],
  templateUrl: './form-modal.component.html',
  styleUrls: ['./form-modal.component.scss']
})
export class FormModalComponent extends BaseModalComponent {
  @Input() user: User;
  @Output() save = new EventEmitter<User>();

  formData = { name: '', email: '' };
  isSaving = false;
  errorMessage: string | null = null;

  get isValid(): boolean {
    return this.formData.name.length > 0 && this.formData.email.includes('@');
  }

  get footerButtons(): ModalButton[] {
    return createDefaultButtons({
      confirmLabel: 'Salvar',
      confirmDisabled: !this.isValid,
      confirmLoading: this.isSaving
    });
  }

  async onButtonClick(action: string): Promise<void> {
    if (action === 'confirm') {
      this.isSaving = true;
      try {
        await this.saveUser();
        this.save.emit(this.formData);
        this.onClose();
      } catch (error) {
        this.errorMessage = 'Erro ao salvar usuário';
      } finally {
        this.isSaving = false;
      }
    } else {
      this.onClose();
    }
  }

  // Prevenir fechamento durante save
  protected override preventBackdropClose(): boolean {
    return this.isSaving;
  }

  protected override preventEscapeClose(): boolean {
    return this.isSaving;
  }
}
```

### Exemplo 3: Modal com Botão de Deletar

```typescript
footerButtons: ModalButton[] = [
  createDeleteButton({ disabled: !canDelete }),
  createCancelButton(),
  createConfirmButton({ label: 'Salvar' })
];
```

---

## Estilos e Customização

### Variáveis Disponíveis

Todas as variáveis estão em `src/app/shared/styles/_modal-variables.scss`:

```scss
// Cores
$modal-backdrop-color
$modal-background
$modal-border-color

// Dimensões
$modal-max-width
$modal-border-radius-desktop
$modal-border-radius-mobile

// Espaçamento
$modal-header-padding
$modal-body-padding
$modal-footer-padding

// Botões
$btn-primary-bg
$btn-secondary-bg
$btn-danger-bg

// E muito mais...
```

### Mixins Disponíveis

Todos os mixins estão em `src/app/shared/styles/_modal-mixins.scss`:

```scss
@use '../styles/modal-mixins' as mixins;

.my-element {
  @include mixins.modal-backdrop();      // Backdrop padrão
  @include mixins.modal-container();     // Container do modal
  @include mixins.modal-header();        // Header
  @include mixins.modal-body();          // Body
  @include mixins.modal-footer();        // Footer
  @include mixins.btn-primary();         // Botão primário
  @include mixins.loading-spinner();     // Spinner
  @include mixins.error-message();       // Mensagem de erro
}
```

### Customizar Estilos

```scss
// my-modal.component.scss
@use '../styles/modal-variables' as vars;
@use '../styles/modal-mixins' as mixins;

.modal-content {
  @include mixins.modal-container(600px); // Largura customizada
}

.modal-body {
  @include mixins.modal-body();

  // Customizações específicas
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  padding: 32px; // Override do padrão
}
```

---

## Acessibilidade

Todos os componentes seguem **WCAG 2.1 nível AA**.

### Checklist de Acessibilidade

- ✅ `role="dialog"` no container do modal
- ✅ `aria-labelledby` apontando para ID do título
- ✅ `aria-modal="true"` para indicar modal blocking
- ✅ `aria-label` em botões de ícone
- ✅ Fechamento via ESC key
- ✅ Trap de foco (não sai do modal com Tab)
- ✅ Contraste mínimo 4.5:1 em textos
- ✅ Navegação completa por teclado

### Exemplo de Implementação Acessível

```html
<div class="modal-content"
     role="dialog"
     aria-labelledby="modal-title"
     aria-describedby="modal-description"
     aria-modal="true">

  <app-modal-header
    [title]="'Editar Perfil'"
    [titleId]="'modal-title'"
    [closeButtonAriaLabel]="'Fechar modal de edição de perfil'">
  </app-modal-header>

  <div class="modal-body" id="modal-description">
    <p>Atualize suas informações de perfil.</p>
  </div>

  <app-modal-footer [buttons]="buttons"></app-modal-footer>
</div>
```

---

## Testes

### Rodar Testes

```bash
# Todos os testes de modais
ng test --include='**/modals/**/*.spec.ts'

# Apenas componentes base
ng test --include='**/modals/base/*.spec.ts'

# Com coverage
ng test --code-coverage --include='**/modals/**/*.spec.ts'
```

### Exemplo de Teste

```typescript
describe('MyModalComponent', () => {
  let component: MyModalComponent;
  let fixture: ComponentFixture<MyModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyModalComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(MyModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('deve fechar ao clicar no backdrop', () => {
    spyOn(component.closeModal, 'emit');
    component.isVisible = true;
    fixture.detectChanges();

    const backdrop = fixture.nativeElement.querySelector('.modal-backdrop');
    backdrop.click();

    expect(component.closeModal.emit).toHaveBeenCalled();
  });
});
```

---

## FAQ

### 1. Como criar um modal sem usar os componentes base?

Você **pode** criar um modal sem usar `BaseModalComponent`, mas precisará implementar manualmente:
- Fechamento por ESC
- Fechamento por backdrop
- Atributos ARIA
- Gerenciamento de foco

**Não recomendado**, pois perde consistência e acessibilidade.

### 2. Posso customizar cores dos botões?

Sim! Sobrescreva as variáveis SCSS:

```scss
// my-modal.component.scss
@use '../styles/modal-variables' as vars with (
  $btn-primary-bg: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)
);
```

### 3. Como adicionar ícones nos botões?

Use a propriedade `icon` do `ModalButton`:

```typescript
buttons: ModalButton[] = [
  {
    label: 'Salvar',
    type: 'primary',
    action: 'save',
    icon: '<i class="fa fa-save"></i>'
  }
];
```

### 4. Como fazer um modal fullscreen?

```scss
.modal-content {
  @include mixins.modal-container();

  width: 100vw;
  height: 100vh;
  max-width: 100vw;
  max-height: 100vh;
  border-radius: 0;
}
```

### 5. Como impedir fechamento durante operação?

Use os hooks `preventBackdropClose()` e `preventEscapeClose()`:

```typescript
export class MyModalComponent extends BaseModalComponent {
  isSaving = false;

  protected override preventBackdropClose(): boolean {
    return this.isSaving;
  }

  protected override preventEscapeClose(): boolean {
    return this.isSaving;
  }
}
```

### 6. Como adicionar animações customizadas?

Sobrescreva as animações no SCSS:

```scss
@keyframes myCustomSlideIn {
  from {
    opacity: 0;
    transform: translateX(-100px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.modal-content {
  animation: myCustomSlideIn 0.4s ease-out;
}
```

---

## Contribuindo

### Processo de Contribuição

1. Leia a [Especificação de Padrão de Modais](../../../../docs/especificacao-modal-padrao.md)
2. Crie uma branch: `git checkout -b feature/novo-modal`
3. Implemente seguindo os padrões
4. Adicione testes (cobertura > 80%)
5. Execute testes: `ng test`
6. Commit: `git commit -m "feat: adiciona modal XYZ"`
7. Abra Pull Request

### Checklist de PR

- [ ] Template e estilos em arquivos externos
- [ ] Extende `BaseModalComponent` (quando aplicável)
- [ ] Usa `ModalHeaderComponent` e `ModalFooterComponent`
- [ ] Importa variáveis e mixins SCSS
- [ ] Atributos ARIA completos
- [ ] Testes unitários (> 80% coverage)
- [ ] Documentação atualizada

---

## Suporte

**Dúvidas ou problemas?**

1. Consulte a [Especificação](../../../../docs/especificacao-modal-padrao.md)
2. Veja os [Exemplos Completos](#exemplos-completos)
3. Abra uma issue com tag `[MODAL]`

---

**Última atualização:** 08/11/2025
**Versão:** 1.0
**Mantido por:** Equipe de Frontend
