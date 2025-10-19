# 🎯 SAGA-008 - Fase 1: Estrutura Base

## 📋 Objetivo da Fase
Estabelecer a estrutura fundamental para edição de persona, incluindo o serviço de gerenciamento e a integração básica com o menu de opções.

## 🎯 Entregáveis

### 1. Serviço de Gerenciamento de Persona
**Arquivo:** `src/app/services/persona-edit.service.ts`

**Funcionalidades:**
- Armazenamento local da persona editada
- Métodos de salvamento e carregamento
- Validação básica de entrada
- Gerenciamento de estado local

**Interface:**
```typescript
interface PersonaEditService {
  savePersona(instanceId: string, persona: string): void
  loadPersona(instanceId: string): string | null
  clearPersona(instanceId: string): void
  hasEditedPersona(instanceId: string): boolean
}
```

### 2. Item de Menu "Editar Persona"
**Arquivo:** `src/app/shared/conductor-chat/conductor-chat.component.ts`

**Modificações:**
- Adicionar item "✏️ Editar Persona" no menu de opções existente
- Implementar método `editPersona()` para abrir modal
- Integrar com o serviço de gerenciamento

**Localização no template:**
```html
<button class="menu-item" (click)="editPersona()">
  ✏️ Editar Persona
</button>
```

### 3. Modal Básico de Edição
**Arquivo:** `src/app/shared/persona-edit-modal/persona-edit-modal.component.ts`

**Funcionalidades:**
- Modal básico com textarea
- Botões de ação (Salvar, Cancelar)
- Carregamento da persona atual
- Validação básica (não vazia)

**Estrutura:**
```typescript
@Component({
  selector: 'app-persona-edit-modal',
  template: `
    <div class="modal-backdrop" *ngIf="isVisible" (click)="onBackdropClick($event)">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h4>✏️ Editar Persona</h4>
          <button class="close-btn" (click)="close()">✕</button>
        </div>
        <div class="modal-body">
          <textarea 
            [(ngModel)]="personaText" 
            placeholder="Digite a persona do agente..."
            class="persona-textarea">
          </textarea>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" (click)="close()">Cancelar</button>
          <button class="btn-save" (click)="save()" [disabled]="!personaText.trim()">
            Salvar
          </button>
        </div>
      </div>
    </div>
  `
})
```

## 🔧 Implementação

### Passo 1: Criar Serviço de Gerenciamento
1. Criar `src/app/services/persona-edit.service.ts`
2. Implementar métodos de armazenamento local
3. Adicionar validação básica
4. Testar persistência no localStorage

### Passo 2: Adicionar Item de Menu
1. Modificar `conductor-chat.component.ts`
2. Adicionar item no template do menu de opções
3. Implementar método `editPersona()`
4. Testar abertura do modal

### Passo 3: Criar Modal Básico
1. Criar componente `persona-edit-modal`
2. Implementar interface básica
3. Adicionar validação de entrada
4. Integrar com serviço de gerenciamento

### Passo 4: Integração Inicial
1. Importar serviço no componente principal
2. Conectar modal com o menu
3. Testar fluxo completo básico
4. Verificar persistência local

## ✅ Critérios de Sucesso

1. **Serviço Funcional**: Persona editada é salva e carregada corretamente
2. **Menu Integrado**: Item "Editar Persona" aparece no menu de opções
3. **Modal Básico**: Modal abre e fecha corretamente
4. **Validação**: Texto vazio é rejeitado
5. **Persistência**: Dados persistem durante a sessão

## 🚫 Limitações da Fase

- Apenas interface básica (sem preview markdown)
- Sem feedback visual de salvamento
- Sem integração com exibição da persona
- Sem estilos avançados

## 📊 Estimativa

**Tempo:** 2-3 horas
**Complexidade:** Baixa
**Dependências:** Nenhuma

## 🔗 Próxima Fase

Após conclusão desta fase, prosseguir para **Fase 2: Funcionalidade Completa** que incluirá:
- Editor com suporte a markdown
- Preview em tempo real
- Integração com exibição da persona
- Feedback visual de salvamento