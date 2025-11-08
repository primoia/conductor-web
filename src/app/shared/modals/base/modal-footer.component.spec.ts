// =============================================================================
// MODAL FOOTER COMPONENT - TESTS
// =============================================================================
// Versão: 1.0
// Data: 08/11/2025
// =============================================================================

import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ModalFooterComponent,
  ModalButton,
  createCancelButton,
  createConfirmButton,
  createDeleteButton,
  createDefaultButtons
} from './modal-footer.component';

describe('ModalFooterComponent', () => {
  let component: ModalFooterComponent;
  let fixture: ComponentFixture<ModalFooterComponent>;
  let compiled: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModalFooterComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ModalFooterComponent);
    component = fixture.componentInstance;
    compiled = fixture.nativeElement;
    fixture.detectChanges();
  });

  // ===========================================================================
  // TESTES DE CRIAÇÃO
  // ===========================================================================

  it('deve criar o componente', () => {
    expect(component).toBeTruthy();
  });

  // ===========================================================================
  // TESTES DE RENDERIZAÇÃO
  // ===========================================================================

  describe('Renderização', () => {
    it('deve renderizar o container do footer', () => {
      const footer = compiled.querySelector('.modal-footer');
      expect(footer).toBeTruthy();
    });

    it('deve renderizar botões baseado no array de configuração', () => {
      component.buttons = [
        { label: 'Cancelar', type: 'secondary', action: 'cancel' },
        { label: 'Salvar', type: 'primary', action: 'save' }
      ];
      fixture.detectChanges();

      const buttons = compiled.querySelectorAll('.btn');
      expect(buttons.length).toBe(2);
    });

    it('não deve renderizar botões quando array está vazio', () => {
      component.buttons = [];
      fixture.detectChanges();

      const buttons = compiled.querySelectorAll('.btn');
      expect(buttons.length).toBe(0);
    });
  });

  // ===========================================================================
  // TESTES DE BOTÕES
  // ===========================================================================

  describe('Botões', () => {
    it('deve renderizar label correto nos botões', () => {
      component.buttons = [
        { label: 'Meu Botão', type: 'primary', action: 'test' }
      ];
      fixture.detectChanges();

      const button = compiled.querySelector('.btn .button-label');
      expect(button?.textContent?.trim()).toBe('Meu Botão');
    });

    it('deve aplicar classes CSS corretas baseado no tipo', () => {
      component.buttons = [
        { label: 'Primary', type: 'primary', action: 'p' },
        { label: 'Secondary', type: 'secondary', action: 's' },
        { label: 'Danger', type: 'danger', action: 'd' }
      ];
      fixture.detectChanges();

      const buttons = compiled.querySelectorAll('.btn');
      expect(buttons[0].classList.contains('btn-primary')).toBe(true);
      expect(buttons[1].classList.contains('btn-secondary')).toBe(true);
      expect(buttons[2].classList.contains('btn-danger')).toBe(true);
    });

    it('deve aplicar aria-label correto', () => {
      component.buttons = [
        { label: 'Salvar', type: 'primary', action: 'save', ariaLabel: 'Salvar dados' }
      ];
      fixture.detectChanges();

      const button = compiled.querySelector('.btn');
      expect(button?.getAttribute('aria-label')).toBe('Salvar dados');
    });

    it('deve usar label como aria-label quando não especificado', () => {
      component.buttons = [
        { label: 'Cancelar', type: 'secondary', action: 'cancel' }
      ];
      fixture.detectChanges();

      const button = compiled.querySelector('.btn');
      expect(button?.getAttribute('aria-label')).toBe('Cancelar');
    });
  });

  // ===========================================================================
  // TESTES DE ESTADO
  // ===========================================================================

  describe('Estado dos Botões', () => {
    it('deve desabilitar botão quando disabled = true', () => {
      component.buttons = [
        { label: 'Salvar', type: 'primary', action: 'save', disabled: true }
      ];
      fixture.detectChanges();

      const button = compiled.querySelector('.btn') as HTMLButtonElement;
      expect(button.disabled).toBe(true);
    });

    it('deve adicionar classe loading quando loading = true', () => {
      component.buttons = [
        { label: 'Salvar', type: 'primary', action: 'save', loading: true }
      ];
      fixture.detectChanges();

      const button = compiled.querySelector('.btn');
      expect(button?.classList.contains('btn-loading')).toBe(true);
    });

    it('deve desabilitar botão quando loading = true', () => {
      component.buttons = [
        { label: 'Salvar', type: 'primary', action: 'save', loading: true }
      ];
      fixture.detectChanges();

      const button = compiled.querySelector('.btn') as HTMLButtonElement;
      expect(button.disabled).toBe(true);
    });

    it('deve exibir texto de loading quando loading = true', () => {
      component.buttons = [
        { label: 'Salvar', type: 'primary', action: 'save', loading: true }
      ];
      component.loadingText = 'Salvando...';
      fixture.detectChanges();

      const buttonLabel = compiled.querySelector('.btn .button-label');
      expect(buttonLabel?.textContent?.trim()).toBe('Salvando...');
    });

    it('deve exibir spinner quando loading = true', () => {
      component.buttons = [
        { label: 'Salvar', type: 'primary', action: 'save', loading: true }
      ];
      fixture.detectChanges();

      const spinner = compiled.querySelector('.spinner');
      expect(spinner).toBeTruthy();
    });
  });

  // ===========================================================================
  // TESTES DE EVENTOS
  // ===========================================================================

  describe('Eventos', () => {
    it('deve emitir evento buttonClick com action correto', () => {
      spyOn(component.buttonClick, 'emit');
      component.buttons = [
        { label: 'Salvar', type: 'primary', action: 'save' }
      ];
      fixture.detectChanges();

      const button = compiled.querySelector('.btn') as HTMLButtonElement;
      button.click();

      expect(component.buttonClick.emit).toHaveBeenCalledWith('save');
    });

    it('não deve emitir evento se botão estiver desabilitado', () => {
      spyOn(component.buttonClick, 'emit');
      component.buttons = [
        { label: 'Salvar', type: 'primary', action: 'save', disabled: true }
      ];
      fixture.detectChanges();

      const button = compiled.querySelector('.btn') as HTMLButtonElement;
      button.click();

      expect(component.buttonClick.emit).not.toHaveBeenCalled();
    });

    it('não deve emitir evento se botão estiver em loading', () => {
      spyOn(component.buttonClick, 'emit');
      component.buttons = [
        { label: 'Salvar', type: 'primary', action: 'save', loading: true }
      ];
      fixture.detectChanges();

      const button = compiled.querySelector('.btn') as HTMLButtonElement;
      button.click();

      expect(component.buttonClick.emit).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // TESTES DE LAYOUT
  // ===========================================================================

  describe('Layout', () => {
    it('deve aplicar classe align-left quando alignLeft = true', () => {
      component.alignLeft = true;
      fixture.detectChanges();

      const footer = compiled.querySelector('.modal-footer');
      expect(footer?.classList.contains('align-left')).toBe(true);
    });

    it('deve aplicar classe compact quando compact = true', () => {
      component.compact = true;
      fixture.detectChanges();

      const footer = compiled.querySelector('.modal-footer');
      expect(footer?.classList.contains('compact')).toBe(true);
    });
  });

  // ===========================================================================
  // TESTES DE MÉTODOS PÚBLICOS
  // ===========================================================================

  describe('Métodos Públicos', () => {
    it('getButtonClass deve retornar classes corretas', () => {
      const button: ModalButton = {
        label: 'Test',
        type: 'primary',
        action: 'test'
      };

      const classes = component.getButtonClass(button);
      expect(classes).toContain('btn');
      expect(classes).toContain('btn-primary');
    });

    it('getButtonClass deve incluir btn-loading quando loading = true', () => {
      const button: ModalButton = {
        label: 'Test',
        type: 'primary',
        action: 'test',
        loading: true
      };

      const classes = component.getButtonClass(button);
      expect(classes).toContain('btn-loading');
    });

    it('getButtonClass deve incluir btn-full-width quando fullWidth = true', () => {
      const button: ModalButton = {
        label: 'Test',
        type: 'primary',
        action: 'test',
        fullWidth: true
      };

      const classes = component.getButtonClass(button);
      expect(classes).toContain('btn-full-width');
    });

    it('onButtonClick deve emitir evento para botão válido', () => {
      spyOn(component.buttonClick, 'emit');
      const button: ModalButton = {
        label: 'Test',
        type: 'primary',
        action: 'test'
      };

      component.onButtonClick(button);
      expect(component.buttonClick.emit).toHaveBeenCalledWith('test');
    });

    it('onButtonClick não deve emitir evento para botão desabilitado', () => {
      spyOn(component.buttonClick, 'emit');
      const button: ModalButton = {
        label: 'Test',
        type: 'primary',
        action: 'test',
        disabled: true
      };

      component.onButtonClick(button);
      expect(component.buttonClick.emit).not.toHaveBeenCalled();
    });
  });
});

// =============================================================================
// TESTES DAS FACTORY FUNCTIONS
// =============================================================================

describe('Factory Functions', () => {
  describe('createCancelButton', () => {
    it('deve criar botão de cancelar com valores padrão', () => {
      const button = createCancelButton();
      expect(button.label).toBe('Cancelar');
      expect(button.type).toBe('secondary');
      expect(button.action).toBe('cancel');
    });

    it('deve permitir override de propriedades', () => {
      const button = createCancelButton({ label: 'Voltar' });
      expect(button.label).toBe('Voltar');
      expect(button.type).toBe('secondary');
      expect(button.action).toBe('cancel');
    });
  });

  describe('createConfirmButton', () => {
    it('deve criar botão de confirmar com valores padrão', () => {
      const button = createConfirmButton();
      expect(button.label).toBe('Confirmar');
      expect(button.type).toBe('primary');
      expect(button.action).toBe('confirm');
    });

    it('deve permitir override de propriedades', () => {
      const button = createConfirmButton({ label: 'Salvar', loading: true });
      expect(button.label).toBe('Salvar');
      expect(button.loading).toBe(true);
    });
  });

  describe('createDeleteButton', () => {
    it('deve criar botão de deletar com valores padrão', () => {
      const button = createDeleteButton();
      expect(button.label).toBe('Deletar');
      expect(button.type).toBe('danger');
      expect(button.action).toBe('delete');
    });

    it('deve permitir override de propriedades', () => {
      const button = createDeleteButton({ disabled: true });
      expect(button.disabled).toBe(true);
    });
  });

  describe('createDefaultButtons', () => {
    it('deve criar array com botões padrão', () => {
      const buttons = createDefaultButtons();
      expect(buttons.length).toBe(2);
      expect(buttons[0].action).toBe('cancel');
      expect(buttons[1].action).toBe('confirm');
    });

    it('deve permitir customização de labels', () => {
      const buttons = createDefaultButtons({
        cancelLabel: 'Fechar',
        confirmLabel: 'Enviar'
      });
      expect(buttons[0].label).toBe('Fechar');
      expect(buttons[1].label).toBe('Enviar');
    });

    it('deve permitir customização de estados', () => {
      const buttons = createDefaultButtons({
        confirmDisabled: true,
        confirmLoading: true
      });
      expect(buttons[1].disabled).toBe(true);
      expect(buttons[1].loading).toBe(true);
    });
  });
});

// =============================================================================
// FIM DOS TESTES
// =============================================================================
