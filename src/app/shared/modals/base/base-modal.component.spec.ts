// =============================================================================
// BASE MODAL COMPONENT - TESTS
// =============================================================================
// Versão: 1.0
// Data: 08/11/2025
// =============================================================================

import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BaseModalComponent } from './base-modal.component';

// =============================================================================
// COMPONENTE DE TESTE (Implementação Concreta do BaseModalComponent)
// =============================================================================

@Component({
  selector: 'app-test-modal',
  standalone: true,
  template: `
    <div class="modal-backdrop" *ngIf="isVisible" (click)="onBackdropClick($event)">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <h3>Test Modal</h3>
        <button id="close-btn" (click)="onClose()">Close</button>
      </div>
    </div>
  `
})
class TestModalComponent extends BaseModalComponent {
  public preventEscapeCloseValue = false;
  public preventBackdropCloseValue = false;
  public preventCloseValue = false;

  protected override preventEscapeClose(): boolean {
    return this.preventEscapeCloseValue;
  }

  protected override preventBackdropClose(): boolean {
    return this.preventBackdropCloseValue;
  }

  protected override preventClose(): boolean {
    return this.preventCloseValue;
  }
}

// =============================================================================
// SUITE DE TESTES
// =============================================================================

describe('BaseModalComponent', () => {
  let component: TestModalComponent;
  let fixture: ComponentFixture<TestModalComponent>;

  // ===========================================================================
  // SETUP
  // ===========================================================================

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestModalComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(TestModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // ===========================================================================
  // TESTES DE CRIAÇÃO
  // ===========================================================================

  it('deve criar o componente', () => {
    expect(component).toBeTruthy();
  });

  it('deve inicializar com isVisible = false', () => {
    expect(component.isVisible).toBe(false);
  });

  it('deve inicializar com isProcessing = false', () => {
    expect(component['isProcessing']).toBe(false);
  });

  // ===========================================================================
  // TESTES DE VISIBILIDADE
  // ===========================================================================

  describe('Visibilidade', () => {
    it('deve exibir o modal quando isVisible = true', () => {
      component.isVisible = true;
      fixture.detectChanges();

      const backdrop = fixture.nativeElement.querySelector('.modal-backdrop');
      expect(backdrop).toBeTruthy();
    });

    it('deve ocultar o modal quando isVisible = false', () => {
      component.isVisible = false;
      fixture.detectChanges();

      const backdrop = fixture.nativeElement.querySelector('.modal-backdrop');
      expect(backdrop).toBeFalsy();
    });
  });

  // ===========================================================================
  // TESTES DE FECHAMENTO
  // ===========================================================================

  describe('Fechamento', () => {
    it('deve emitir evento closeModal ao chamar onClose()', () => {
      spyOn(component.closeModal, 'emit');

      component.onClose();

      expect(component.closeModal.emit).toHaveBeenCalled();
    });

    it('não deve emitir closeModal se preventClose() retornar true', () => {
      spyOn(component.closeModal, 'emit');
      component.preventCloseValue = true;

      component.onClose();

      expect(component.closeModal.emit).not.toHaveBeenCalled();
    });

    it('deve fechar ao clicar no botão de fechar', () => {
      spyOn(component.closeModal, 'emit');
      component.isVisible = true;
      fixture.detectChanges();

      const closeBtn = fixture.nativeElement.querySelector('#close-btn');
      closeBtn.click();

      expect(component.closeModal.emit).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // TESTES DE BACKDROP
  // ===========================================================================

  describe('Backdrop Click', () => {
    it('deve fechar ao clicar no backdrop', () => {
      spyOn(component.closeModal, 'emit');
      component.isVisible = true;
      fixture.detectChanges();

      const backdrop = fixture.nativeElement.querySelector('.modal-backdrop');
      const event = new MouseEvent('click', {
        bubbles: true,
        cancelable: true
      });

      Object.defineProperty(event, 'target', { value: backdrop, enumerable: true });
      Object.defineProperty(event, 'currentTarget', { value: backdrop, enumerable: true });

      backdrop.dispatchEvent(event);

      expect(component.closeModal.emit).toHaveBeenCalled();
    });

    it('não deve fechar ao clicar no conteúdo do modal', () => {
      spyOn(component.closeModal, 'emit');
      component.isVisible = true;
      fixture.detectChanges();

      const content = fixture.nativeElement.querySelector('.modal-content');
      content.click();

      expect(component.closeModal.emit).not.toHaveBeenCalled();
    });

    it('não deve fechar ao clicar no backdrop se preventBackdropClose() retornar true', () => {
      spyOn(component.closeModal, 'emit');
      component.preventBackdropCloseValue = true;
      component.isVisible = true;
      fixture.detectChanges();

      const backdrop = fixture.nativeElement.querySelector('.modal-backdrop');
      const event = new MouseEvent('click');
      Object.defineProperty(event, 'target', { value: backdrop });
      Object.defineProperty(event, 'currentTarget', { value: backdrop });

      backdrop.dispatchEvent(event);

      expect(component.closeModal.emit).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // TESTES DE TECLA ESC
  // ===========================================================================

  describe('ESC Key', () => {
    it('deve fechar ao pressionar ESC quando modal está visível', () => {
      spyOn(component.closeModal, 'emit');
      component.isVisible = true;

      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        code: 'Escape'
      });

      component.handleEscapeKey(event);

      expect(component.closeModal.emit).toHaveBeenCalled();
    });

    it('não deve fechar ao pressionar ESC quando modal não está visível', () => {
      spyOn(component.closeModal, 'emit');
      component.isVisible = false;

      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      component.handleEscapeKey(event);

      expect(component.closeModal.emit).not.toHaveBeenCalled();
    });

    it('não deve fechar ao pressionar ESC se preventEscapeClose() retornar true', () => {
      spyOn(component.closeModal, 'emit');
      component.isVisible = true;
      component.preventEscapeCloseValue = true;

      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      component.handleEscapeKey(event);

      expect(component.closeModal.emit).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // TESTES DE ESTADO DE PROCESSAMENTO
  // ===========================================================================

  describe('Processing State', () => {
    it('deve definir isProcessing corretamente', () => {
      component['setProcessing'](true);
      expect(component['getProcessing']()).toBe(true);

      component['setProcessing'](false);
      expect(component['getProcessing']()).toBe(false);
    });

    it('não deve fechar quando em processamento (ESC)', () => {
      spyOn(component.closeModal, 'emit');
      component.isVisible = true;
      component['setProcessing'](true);

      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      component.handleEscapeKey(event);

      expect(component.closeModal.emit).not.toHaveBeenCalled();
    });

    it('não deve fechar quando em processamento (Backdrop)', () => {
      spyOn(component.closeModal, 'emit');
      component.isVisible = true;
      component['setProcessing'](true);
      fixture.detectChanges();

      const backdrop = fixture.nativeElement.querySelector('.modal-backdrop');
      const event = new MouseEvent('click');
      Object.defineProperty(event, 'target', { value: backdrop });
      Object.defineProperty(event, 'currentTarget', { value: backdrop });

      backdrop.dispatchEvent(event);

      expect(component.closeModal.emit).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // TESTES DE HOOKS
  // ===========================================================================

  describe('Lifecycle Hooks', () => {
    it('deve permitir override de preventEscapeClose()', () => {
      component.preventEscapeCloseValue = true;
      expect(component['preventEscapeClose']()).toBe(true);

      component.preventEscapeCloseValue = false;
      expect(component['preventEscapeClose']()).toBe(false);
    });

    it('deve permitir override de preventBackdropClose()', () => {
      component.preventBackdropCloseValue = true;
      expect(component['preventBackdropClose']()).toBe(true);

      component.preventBackdropCloseValue = false;
      expect(component['preventBackdropClose']()).toBe(false);
    });

    it('deve permitir override de preventClose()', () => {
      component.preventCloseValue = true;
      expect(component['preventClose']()).toBe(true);

      component.preventCloseValue = false;
      expect(component['preventClose']()).toBe(false);
    });
  });
});

// =============================================================================
// FIM DOS TESTES
// =============================================================================
