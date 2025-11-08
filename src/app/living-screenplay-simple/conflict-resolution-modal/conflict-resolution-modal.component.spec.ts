import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConflictResolutionModalComponent } from './conflict-resolution-modal.component';
import { FormsModule } from '@angular/forms';
import { DebugElement } from '@angular/core';
import { By } from '@angular/platform-browser';

describe('ConflictResolutionModalComponent', () => {
  let component: ConflictResolutionModalComponent;
  let fixture: ComponentFixture<ConflictResolutionModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConflictResolutionModalComponent, FormsModule]
    }).compileComponents();

    fixture = TestBed.createComponent(ConflictResolutionModalComponent);
    component = fixture.componentInstance;
    component.isVisible = true;
    component.newFileName = 'test-file.md';
    component.newContent = 'New content';
    component.existingScreenplay = {
      id: '1',
      name: 'test-file.md',
      content: 'Existing content',
      updatedAt: new Date()
    };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Inicialização', () => {
    it('deve inicializar newName com o newFileName', () => {
      expect(component.newName).toBe('test-file.md');
    });

    it('deve exibir o modal quando isVisible é true', () => {
      const overlay = fixture.debugElement.query(By.css('.modal-overlay'));
      expect(overlay).toBeTruthy();
    });

    it('não deve exibir o modal quando isVisible é false', () => {
      component.isVisible = false;
      fixture.detectChanges();
      const overlay = fixture.debugElement.query(By.css('.modal-overlay'));
      expect(overlay).toBeFalsy();
    });
  });

  describe('Cálculos de conteúdo', () => {
    it('deve calcular existingContentLength corretamente', () => {
      expect(component.existingContentLength).toBe(16); // 'Existing content'.length
    });

    it('deve calcular newContentLength corretamente', () => {
      expect(component.newContentLength).toBe(11); // 'New content'.length
    });

    it('deve retornar "mesmo tamanho" quando não há diferença', () => {
      component.newContent = 'Existing content';
      expect(component.contentDifference).toBe('mesmo tamanho');
    });

    it('deve retornar diferença positiva', () => {
      component.newContent = 'Existing content plus more';
      expect(component.contentDifference).toContain('+');
    });

    it('deve retornar diferença negativa', () => {
      component.newContent = 'Short';
      expect(component.contentDifference).not.toContain('+');
    });
  });

  describe('Botões', () => {
    it('deve retornar 3 botões padrão', () => {
      expect(component.defaultButtons.length).toBe(3);
    });

    it('deve ter botão Sobrescrever com variante danger', () => {
      const overwriteBtn = component.defaultButtons.find(b => b.label === 'Sobrescrever');
      expect(overwriteBtn).toBeTruthy();
      expect(overwriteBtn?.variant).toBe('danger');
    });

    it('deve ter botão Renomear com variante primary', () => {
      const renameBtn = component.defaultButtons.find(b => b.label === 'Renomear');
      expect(renameBtn).toBeTruthy();
      expect(renameBtn?.variant).toBe('primary');
    });

    it('deve retornar 2 botões de renomeação', () => {
      expect(component.renameButtons.length).toBe(2);
    });

    it('deve desabilitar botão de confirmar quando newName está vazio', () => {
      component.newName = '';
      const confirmBtn = component.renameButtons.find(b => b.label === 'Confirmar Renomeação');
      expect(confirmBtn?.disabled).toBe(true);
    });
  });

  describe('Ações', () => {
    it('deve emitir evento de sobrescrever', (done) => {
      component.resolve.subscribe((result) => {
        expect(result.action).toBe('overwrite');
        done();
      });
      component.onOverwrite();
    });

    it('deve emitir evento de manter existente', (done) => {
      component.resolve.subscribe((result) => {
        expect(result.action).toBe('keep-existing');
        done();
      });
      component.onKeepExisting();
    });

    it('deve mostrar input de renomeação ao clicar em Renomear', () => {
      component.onShowRename();
      expect(component.showRenameInput).toBe(true);
    });

    it('deve gerar novo nome com contador ao mostrar renomeação', () => {
      component.newName = 'test-file.md';
      component.onShowRename();
      expect(component.newName).toBe('test-file.md (1)');
    });

    it('deve emitir evento de renomeação com novo nome', (done) => {
      component.newName = 'new-name.md';
      component.resolve.subscribe((result) => {
        expect(result.action).toBe('rename');
        expect(result.newName).toBe('new-name.md');
        done();
      });
      component.onRename();
    });

    it('não deve renomear se newName estiver vazio', () => {
      component.newName = '   ';
      const spy = spyOn(component.resolve, 'emit');
      component.onRename();
      expect(spy).not.toHaveBeenCalled();
    });

    it('deve emitir evento de cancelar', (done) => {
      component.resolve.subscribe((result) => {
        expect(result.action).toBe('cancel');
        done();
      });
      component.onCancel();
    });
  });

  describe('Backdrop', () => {
    it('deve cancelar ao clicar no backdrop', () => {
      const spy = spyOn(component, 'onCancel');
      const event = new MouseEvent('click');
      Object.defineProperty(event, 'target', { value: event.currentTarget, configurable: true });
      component.onBackdropClick(event);
      expect(spy).toHaveBeenCalled();
    });

    it('não deve cancelar ao clicar dentro do modal', () => {
      const spy = spyOn(component, 'onCancel');
      const event = new MouseEvent('click');
      const mockTarget = document.createElement('div');
      const mockCurrentTarget = document.createElement('div');
      Object.defineProperty(event, 'target', { value: mockTarget, configurable: true });
      Object.defineProperty(event, 'currentTarget', { value: mockCurrentTarget, configurable: true });
      component.onBackdropClick(event);
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('ESC key handler', () => {
    it('deve fechar o modal ao pressionar ESC', () => {
      const spy = spyOn(component, 'onCancel');
      component.handleEscape();
      expect(spy).toHaveBeenCalled();
    });

    it('não deve fechar se modal não estiver visível', () => {
      component.isVisible = false;
      const spy = spyOn(component, 'onCancel');
      component.handleEscape();
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('Fechamento', () => {
    it('deve resetar showRenameInput ao fechar', () => {
      component.showRenameInput = true;
      component['close']();
      expect(component.showRenameInput).toBe(false);
    });

    it('deve definir isVisible como false ao fechar', () => {
      component.isVisible = true;
      component['close']();
      expect(component.isVisible).toBe(false);
    });
  });

  describe('Acessibilidade', () => {
    it('deve ter role="dialog"', () => {
      const overlay = fixture.debugElement.query(By.css('[role="dialog"]'));
      expect(overlay).toBeTruthy();
    });

    it('deve ter aria-modal="true"', () => {
      const overlay = fixture.debugElement.query(By.css('[aria-modal="true"]'));
      expect(overlay).toBeTruthy();
    });

    it('deve ter aria-labelledby', () => {
      const overlay = fixture.debugElement.query(By.css('[aria-labelledby="conflict-modal-title"]'));
      expect(overlay).toBeTruthy();
    });
  });

  describe('Componentes Base', () => {
    it('deve usar ModalHeaderComponent', () => {
      const header = fixture.debugElement.query(By.css('app-modal-header'));
      expect(header).toBeTruthy();
    });

    it('deve usar ModalFooterComponent', () => {
      const footer = fixture.debugElement.query(By.css('app-modal-footer'));
      expect(footer).toBeTruthy();
    });
  });
});
