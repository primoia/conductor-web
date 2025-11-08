# Especificação de Padrão de Modais - Conductor Web

**Versão:** 1.0
**Data:** 08/11/2025
**Status:** Documento Oficial - Versionado
**Autor:** Equipe de Requisitos e Arquitetura

---

## 📋 Visão Geral

Este documento estabelece o **padrão oficial** para implementação de modais (dialogs) no sistema Conductor Web. O objetivo é normalizar a estrutura, estilos e comportamentos de todos os componentes modais da aplicação, garantindo consistência visual, acessibilidade e manutenibilidade.

### Contexto

Atualmente, o sistema possui **11 componentes de modal** com implementações variadas. Esta especificação unifica as melhores práticas identificadas durante a análise e define diretrizes obrigatórias para novos desenvolvimentos e refatorações.

---

## 🎯 Requisitos Funcionais

### RF1: Estrutura de Componentes
Todos os modais **DEVEM** ser implementados como **Angular Standalone Components** com a seguinte estrutura de arquivos:

```
src/app/shared/modals/[nome-modal]/
├── [nome-modal].component.ts
├── [nome-modal].component.html
├── [nome-modal].component.scss
└── [nome-modal].component.spec.ts
```

**Justificativa:** Separar template e estilos melhora legibilidade, manutenibilidade e permite reutilização de estilos através de arquivos `.scss` compartilhados.

**Exceção:** Modais extremamente simples (< 20 linhas de template) podem usar inline template, mas **NUNCA** inline styles.

---

### RF2: Anatomia HTML Padrão
Todo modal **DEVE** seguir esta estrutura HTML obrigatória:

```html
<div class="modal-backdrop" *ngIf="isVisible" (click)="onBackdropClick($event)">
  <div class="modal-content" (click)="$event.stopPropagation()"
       role="dialog"
       aria-labelledby="modal-title"
       aria-describedby="modal-description">

    <!-- Header obrigatório -->
    <div class="modal-header">
      <h3 id="modal-title">{{ modalTitle }}</h3>
      <button class="close-btn"
              (click)="onClose()"
              aria-label="Fechar modal">
        ×
      </button>
    </div>

    <!-- Body obrigatório -->
    <div class="modal-body" id="modal-description">
      <!-- Conteúdo variável -->
    </div>

    <!-- Footer obrigatório -->
    <div class="modal-footer">
      <button class="btn btn-secondary" (click)="onClose()">
        Cancelar
      </button>
      <button class="btn btn-primary"
              (click)="onConfirm()"
              [disabled]="!isValid">
        {{ confirmLabel }}
      </button>
    </div>
  </div>
</div>
```

**Elementos obrigatórios:**
- `.modal-backdrop` - Container overlay full-screen
- `.modal-content` - Container do conteúdo do modal
- `.modal-header` - Cabeçalho com título e botão de fechar
- `.modal-body` - Corpo com conteúdo principal
- `.modal-footer` - Rodapé com botões de ação

---

### RF3: Padrão de Botões de Ação

#### Hierarquia de Botões
Os botões **DEVEM** seguir esta ordem visual (da esquerda para direita):

1. **Botões destrutivos** (`.btn-danger`) - Ex: "Deletar", "Sobrescrever"
2. **Botões secundários** (`.btn-secondary`) - Ex: "Cancelar", "Voltar"
3. **Botão primário** (`.btn-primary`) - Ex: "Salvar", "Confirmar", "Aceitar"

#### Posicionamento
- **Desktop:** Alinhados à direita (`justify-content: flex-end`)
- **Mobile (< 768px):** Empilhados verticalmente, largura total

#### Classes de Botões
```scss
.btn {
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  display: flex;
  align-items: center;
  gap: 8px;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.btn-primary {
  background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
  color: white;

  &:hover:not(:disabled) {
    background: linear-gradient(135deg, #0056b3 0%, #004085 100%);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 123, 255, 0.4);
  }
}

.btn-secondary {
  background: #6b7280;
  color: white;

  &:hover:not(:disabled) {
    background: #4b5563;
  }
}

.btn-danger {
  background: #dc3545;
  color: white;

  &:hover:not(:disabled) {
    background: #c82333;
  }
}
```

---

## 🎨 Requisitos de Estilos (CSS/SCSS)

### RNF1: Arquivo de Variáveis Compartilhadas
**DEVE** ser criado o arquivo `src/app/shared/styles/_modal-variables.scss`:

```scss
// Cores
$modal-backdrop-color: rgba(0, 0, 0, 0.6);
$modal-border-radius: 12px;
$modal-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);

// Espaçamentos
$modal-header-padding: 20px 24px;
$modal-body-padding: 24px;
$modal-footer-padding: 20px 24px;

// Animações
$modal-animation-duration: 0.3s;
$modal-animation-easing: ease-out;

// Z-index
$modal-z-index: 1000;
$modal-backdrop-z-index: 1000;

// Responsividade
$modal-mobile-breakpoint: 768px;
$modal-small-mobile-breakpoint: 480px;

// Botões
$btn-border-radius: 6px;
$btn-padding: 10px 20px;
$btn-gap: 8px;
$btn-transition: all 0.2s ease;

// Cores de Botões
$btn-primary-bg: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
$btn-primary-hover-bg: linear-gradient(135deg, #0056b3 0%, #004085 100%);
$btn-secondary-bg: #6b7280;
$btn-secondary-hover-bg: #4b5563;
$btn-danger-bg: #dc3545;
$btn-danger-hover-bg: #c82333;
```

### RNF2: Backdrop e Overlay

**Padrão obrigatório:**

```scss
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
  animation: backdropFadeIn 0.3s ease-out;
}

@keyframes backdropFadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
```

**Requisitos:**
- Backdrop **DEVE** ter `backdrop-filter: blur(4px)` para efeito de desfoque
- Z-index **DEVE** ser 1000 (reservado para modais)
- Animação de entrada **DEVE** ser `backdropFadeIn` com duração de 0.3s

### RNF3: Container do Modal

```scss
.modal-content {
  background: white;
  border-radius: 12px;
  max-width: 800px; // Ajustar conforme necessidade
  width: 90%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  animation: modalSlideIn 0.3s ease-out;
  overflow: hidden;
  border: 1px solid #e1e4e8;

  @media (max-width: 768px) {
    width: 95%;
    max-height: 95vh;
    border-radius: 8px;
  }

  @media (max-width: 480px) {
    width: 100%;
    height: 100vh;
    max-height: 100vh;
    border-radius: 0;
  }
}

@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: translateY(-30px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
```

**Requisitos:**
- Animação de entrada **DEVE** ser `modalSlideIn` (slide + scale)
- Border-radius **DEVE** ser 12px (desktop) e 0px (mobile < 480px)
- Max-height **DEVE** ser 90vh para evitar overflow vertical
- Overflow interno **DEVE** ser gerenciado pelo `.modal-body`

### RNF4: Header Padrão

```scss
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e1e4e8;
  background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);

  h3 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: #2c3e50;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: #6b7280;
    padding: 8px;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    transition: all 0.2s ease;

    &:hover {
      color: #374151;
      background: rgba(107, 114, 128, 0.1);
      transform: scale(1.05);
    }

    &:active {
      transform: scale(0.95);
    }
  }
}
```

### RNF5: Body Padrão

```scss
.modal-body {
  padding: 24px;
  overflow-y: auto;
  flex: 1;

  // Scrollbar personalizada
  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: #c1c1c1;
    border-radius: 4px;

    &:hover {
      background: #a8a8a8;
    }
  }
}
```

### RNF6: Footer Padrão

```scss
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px 24px;
  border-top: 1px solid #e1e4e8;
  background: linear-gradient(135deg, #f7fafc 0%, #ffffff 100%);

  @media (max-width: 768px) {
    flex-direction: column;

    .btn {
      width: 100%;
      justify-content: center;
    }
  }
}
```

---

## ⚡ Requisitos Comportamentais

### RNF7: Gerenciamento de Visibilidade

**TypeScript padrão:**

```typescript
@Component({
  selector: 'app-example-modal',
  // ...
})
export class ExampleModalComponent {
  @Input() isVisible: boolean = false;
  @Output() closeModal = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<any>();

  onClose(): void {
    this.closeModal.emit();
  }

  onBackdropClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }

  onConfirm(): void {
    // Validação e lógica de confirmação
    this.confirm.emit(this.data);
    this.onClose();
  }
}
```

**Requisitos obrigatórios:**
- Modal **DEVE** fechar ao clicar no backdrop (a menos que haja operação em andamento)
- Modal **DEVE** fechar ao pressionar ESC (implementar `@HostListener('keydown.escape')`)
- Modal **NÃO DEVE** fechar ao clicar no `.modal-content` (usar `$event.stopPropagation()`)
- Modal **DEVE** emitir evento `closeModal` ao fechar
- Modal **DEVE** ter controle via `@Input() isVisible`

### RNF8: Acessibilidade (ARIA)

**Requisitos obrigatórios:**

```html
<div class="modal-content"
     role="dialog"
     aria-labelledby="modal-title"
     aria-describedby="modal-description"
     [attr.aria-modal]="true">

  <div class="modal-header">
    <h3 id="modal-title">{{ title }}</h3>
    <button class="close-btn"
            (click)="onClose()"
            aria-label="Fechar modal"
            type="button">
      ×
    </button>
  </div>

  <div class="modal-body" id="modal-description">
    <!-- ... -->
  </div>
</div>
```

**Checklist de acessibilidade:**
- ✅ `role="dialog"` no container do modal
- ✅ `aria-labelledby` apontando para o ID do título
- ✅ `aria-describedby` apontando para o ID da descrição/body
- ✅ `aria-label` em botões de ícone (fechar, ações)
- ✅ `aria-modal="true"` para indicar modal blocking
- ✅ Trap de foco dentro do modal (evitar Tab para fora)
- ✅ Foco automático no primeiro elemento interativo ao abrir

---

## 🔧 Componentes Base Reutilizáveis

### RNF9: Criação de Componentes Compartilhados

**Estrutura recomendada:**

```
src/app/shared/modals/
├── base/
│   ├── base-modal.component.ts       # Classe abstrata base
│   ├── modal-header.component.ts     # Header reutilizável
│   └── modal-footer.component.ts     # Footer reutilizável
├── _modal-variables.scss              # Variáveis compartilhadas
├── _modal-mixins.scss                 # Mixins SCSS
└── [modais-específicos]/
```

**Exemplo de classe base:**

```typescript
import { Component, EventEmitter, Input, Output, HostListener } from '@angular/core';

@Component({
  template: ''
})
export abstract class BaseModalComponent {
  @Input() isVisible: boolean = false;
  @Output() closeModal = new EventEmitter<void>();

  @HostListener('document:keydown.escape', ['$event'])
  handleEscapeKey(event: KeyboardEvent): void {
    if (this.isVisible && !this.preventEscapeClose()) {
      this.onClose();
    }
  }

  onClose(): void {
    this.closeModal.emit();
  }

  onBackdropClick(event: Event): void {
    if (event.target === event.currentTarget && !this.preventBackdropClose()) {
      this.onClose();
    }
  }

  // Hooks opcionais para personalização
  protected preventEscapeClose(): boolean {
    return false;
  }

  protected preventBackdropClose(): boolean {
    return false;
  }
}
```

---

## 📱 Responsividade

### RNF10: Breakpoints Padrão

**Breakpoints obrigatórios:**

```scss
// Desktop (default)
.modal-content {
  max-width: 800px;
  width: 90%;
  border-radius: 12px;
}

// Tablet (768px)
@media (max-width: 768px) {
  .modal-content {
    width: 95%;
    max-height: 95vh;
    border-radius: 8px;
  }

  .modal-footer {
    flex-direction: column;
    gap: 8px;

    .btn {
      width: 100%;
      justify-content: center;
    }
  }
}

// Mobile (480px)
@media (max-width: 480px) {
  .modal-content {
    width: 100%;
    height: 100vh;
    max-height: 100vh;
    border-radius: 0;
  }

  .modal-header,
  .modal-body,
  .modal-footer {
    padding: 16px;
  }
}
```

**Comportamentos específicos:**
- **Desktop:** Modal centralizado, tamanho limitado
- **Tablet:** Modal ocupa 95% da largura, botões empilhados
- **Mobile:** Modal fullscreen, sem border-radius

---

## 🎭 Estados e Feedbacks Visuais

### RNF11: Estados de Loading

**Padrão para botões em loading:**

```html
<button class="btn btn-primary"
        [disabled]="isLoading"
        [class.btn-loading]="isLoading"
        (click)="onSave()">
  <span *ngIf="!isLoading">{{ saveLabel }}</span>
  <span *ngIf="isLoading">
    <span class="spinner"></span>
    Salvando...
  </span>
</button>
```

```scss
.btn-loading {
  cursor: not-allowed;
  opacity: 0.7;
}

.spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
```

### RNF12: Estados de Erro e Validação

**Padrão para mensagens de erro:**

```html
<div class="modal-body">
  <!-- Conteúdo -->

  <div class="error-message" *ngIf="errorMessage" role="alert">
    ❌ {{ errorMessage }}
  </div>

  <div class="validation-errors" *ngIf="validationErrors.length > 0" role="alert">
    <div class="error-item" *ngFor="let error of validationErrors">
      {{ error }}
    </div>
  </div>
</div>
```

```scss
.error-message {
  background: rgba(220, 53, 69, 0.1);
  border: 1px solid #dc3545;
  border-radius: 6px;
  padding: 12px;
  color: #dc3545;
  font-size: 14px;
  margin-top: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.validation-errors {
  margin-top: 12px;

  .error-item {
    font-size: 12px;
    color: #dc2626;
    margin: 4px 0;
    padding: 4px 8px;
    background: rgba(220, 38, 38, 0.1);
    border-radius: 4px;
    border-left: 3px solid #dc2626;
  }
}
```

---

## 📊 Z-Index Hierarchy

### RNF13: Controle de Camadas

**Hierarquia obrigatória:**

```scss
// src/app/shared/styles/_z-index.scss

$z-index-base: 0;
$z-index-dropdown: 100;
$z-index-sticky: 200;
$z-index-fixed: 300;
$z-index-overlay: 400;
$z-index-modal-backdrop: 1000;
$z-index-modal: 1000;
$z-index-toast: 2000;
$z-index-tooltip: 3000;
```

**Regra:** Modais **SEMPRE** devem usar `z-index: 1000`. Para modais sobrepostos (modal dentro de modal), usar `z-index: 1100, 1200...` incrementalmente.

---

## 🧪 Testes e Qualidade

### RNF14: Testes Unitários Obrigatórios

Todo modal **DEVE** ter testes para:

1. **Abertura e fechamento:**
   - Abre quando `isVisible = true`
   - Fecha ao clicar no backdrop
   - Fecha ao pressionar ESC
   - Emite evento `closeModal` ao fechar

2. **Botões de ação:**
   - Botão primário desabilitado quando inválido
   - Emite evento correto ao confirmar
   - Fecha modal após ação bem-sucedida

3. **Validações:**
   - Exibe mensagens de erro corretamente
   - Desabilita submit quando há erros de validação

4. **Acessibilidade:**
   - Atributos ARIA presentes
   - Foco gerenciado corretamente
   - ESC fecha o modal

---

## 🚀 Migração de Modais Existentes

### Plano de Migração (Sugestão)

**Fase 1: Preparação (Sprint 1)**
- [ ] Criar `_modal-variables.scss`
- [ ] Criar `_modal-mixins.scss`
- [ ] Implementar `BaseModalComponent`
- [ ] Criar `ModalHeaderComponent` e `ModalFooterComponent` reutilizáveis

**Fase 2: Migração Gradual (Sprint 2-4)**
Prioridade por criticidade e uso:

1. **Alta prioridade:** `agent-preview-modal`, `persona-edit-modal`
2. **Média prioridade:** `conflict-resolution-modal`, `councilor-edit-modal`
3. **Baixa prioridade:** Demais modais

**Fase 3: Validação (Sprint 5)**
- [ ] Testes de regressão visual
- [ ] Testes de acessibilidade (WCAG 2.1 AA)
- [ ] Testes de responsividade
- [ ] Code review completo

---

## 📚 Exemplos de Implementação

### Exemplo 1: Modal Simples (Confirmação)

**arquivo: confirmation-modal.component.ts**

```typescript
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseModalComponent } from '../base/base-modal.component';

@Component({
  selector: 'app-confirmation-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './confirmation-modal.component.html',
  styleUrls: ['./confirmation-modal.component.scss']
})
export class ConfirmationModalComponent extends BaseModalComponent {
  @Input() title: string = 'Confirmação';
  @Input() message: string = 'Tem certeza que deseja continuar?';
  @Input() confirmLabel: string = 'Confirmar';
  @Input() cancelLabel: string = 'Cancelar';
  @Output() confirm = new EventEmitter<void>();

  onConfirm(): void {
    this.confirm.emit();
    this.onClose();
  }
}
```

**arquivo: confirmation-modal.component.html**

```html
<div class="modal-backdrop" *ngIf="isVisible" (click)="onBackdropClick($event)">
  <div class="modal-content" (click)="$event.stopPropagation()"
       role="dialog"
       aria-labelledby="modal-title">

    <div class="modal-header">
      <h3 id="modal-title">{{ title }}</h3>
      <button class="close-btn" (click)="onClose()" aria-label="Fechar">×</button>
    </div>

    <div class="modal-body">
      <p>{{ message }}</p>
    </div>

    <div class="modal-footer">
      <button class="btn btn-secondary" (click)="onClose()">
        {{ cancelLabel }}
      </button>
      <button class="btn btn-primary" (click)="onConfirm()">
        {{ confirmLabel }}
      </button>
    </div>
  </div>
</div>
```

### Exemplo 2: Modal com Formulário

```typescript
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BaseModalComponent } from '../base/base-modal.component';

@Component({
  selector: 'app-form-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './form-modal.component.html',
  styleUrls: ['./form-modal.component.scss']
})
export class FormModalComponent extends BaseModalComponent {
  @Input() title: string = 'Formulário';
  @Output() save = new EventEmitter<any>();

  formData = {
    name: '',
    email: ''
  };

  isLoading = false;
  errorMessage: string | null = null;

  get isValid(): boolean {
    return this.formData.name.trim().length > 0 &&
           this.formData.email.includes('@');
  }

  async onSave(): Promise<void> {
    if (!this.isValid) return;

    this.isLoading = true;
    this.errorMessage = null;

    try {
      // Simular chamada API
      await new Promise(resolve => setTimeout(resolve, 1000));
      this.save.emit(this.formData);
      this.onClose();
    } catch (error) {
      this.errorMessage = 'Erro ao salvar. Tente novamente.';
    } finally {
      this.isLoading = false;
    }
  }

  // Prevenir fechamento durante loading
  protected override preventBackdropClose(): boolean {
    return this.isLoading;
  }

  protected override preventEscapeClose(): boolean {
    return this.isLoading;
  }
}
```

---

## ✅ Checklist de Validação

Antes de considerar um modal completo, verificar:

### Estrutura
- [ ] Usa standalone component
- [ ] Template e estilos em arquivos externos (.html e .scss)
- [ ] Segue estrutura HTML padrão (backdrop > content > header/body/footer)
- [ ] Extende `BaseModalComponent` (se aplicável)

### Estilos
- [ ] Importa `_modal-variables.scss`
- [ ] Usa variáveis compartilhadas para cores, espaçamentos e animações
- [ ] Implementa animações de entrada (backdrop + modal)
- [ ] Responsivo (desktop, tablet, mobile)
- [ ] Scrollbar personalizada no body

### Comportamento
- [ ] Fecha ao clicar no backdrop
- [ ] Fecha ao pressionar ESC
- [ ] Emite evento `closeModal`
- [ ] Previne fechamento durante operações críticas (loading)
- [ ] Gerencia foco corretamente

### Acessibilidade
- [ ] Atributos ARIA (`role`, `aria-labelledby`, `aria-describedby`)
- [ ] Botões com `aria-label` quando necessário
- [ ] Foco automático ao abrir
- [ ] Trap de foco (não sai do modal com Tab)

### Botões
- [ ] Usa classes padrão (`.btn-primary`, `.btn-secondary`, `.btn-danger`)
- [ ] Ordem correta (destrutivo → secundário → primário)
- [ ] Estado disabled implementado
- [ ] Loading state implementado (quando aplicável)

### Testes
- [ ] Testes unitários implementados
- [ ] Testes de acessibilidade passando
- [ ] Testes de responsividade validados

---

## 🔄 Versionamento e Atualizações

**Histórico de Versões:**

| Versão | Data       | Autor              | Alterações                          |
|--------|------------|--------------------|-------------------------------------|
| 1.0    | 08/11/2025 | Equipe Requisitos  | Versão inicial da especificação     |

**Processo de Atualização:**
1. Propor alteração via Pull Request
2. Revisão por pelo menos 2 membros da equipe
3. Atualizar este documento com novo número de versão
4. Comunicar mudanças para todo o time

---

## 📞 Contatos e Suporte

**Dúvidas sobre esta especificação:**
- Abrir issue no repositório com tag `[MODAL-SPEC]`
- Contatar equipe de arquitetura frontend

**Contribuições:**
- Pull requests são bem-vindos!
- Seguir processo de versionamento descrito acima

---

## 📖 Referências

- [Angular Material Dialog](https://material.angular.io/components/dialog/overview)
- [WCAG 2.1 - Dialog (Modal) Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- [Bootstrap Modal Documentation](https://getbootstrap.com/docs/5.3/components/modal/)
- [MDN - ARIA: dialog role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/dialog_role)

---

**Documento gerado em:** 08/11/2025
**Última atualização:** 08/11/2025
**Próxima revisão prevista:** Sprint de Q1 2026
