// =============================================================================
// MODAL HEADER COMPONENT - TESTS
// =============================================================================
// Versão: 1.0
// Data: 08/11/2025
// =============================================================================

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalHeaderComponent } from './modal-header.component';
import { DebugElement } from '@angular/core';
import { By } from '@angular/platform-browser';

describe('ModalHeaderComponent', () => {
  let component: ModalHeaderComponent;
  let fixture: ComponentFixture<ModalHeaderComponent>;
  let compiled: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModalHeaderComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ModalHeaderComponent);
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
    it('deve renderizar o container do header', () => {
      const header = compiled.querySelector('.modal-header');
      expect(header).toBeTruthy();
    });

    it('deve renderizar o título com o texto correto', () => {
      component.title = 'Meu Modal';
      fixture.detectChanges();

      const title = compiled.querySelector('.modal-title');
      expect(title?.textContent?.trim()).toBe('Meu Modal');
    });

    it('deve renderizar o título com ID correto', () => {
      component.titleId = 'custom-title-id';
      fixture.detectChanges();

      const title = compiled.querySelector('.modal-title');
      expect(title?.getAttribute('id')).toBe('custom-title-id');
    });

    it('deve usar ID padrão quando não especificado', () => {
      const title = compiled.querySelector('.modal-title');
      expect(title?.getAttribute('id')).toBe('modal-title');
    });
  });

  // ===========================================================================
  // TESTES DO BOTÃO DE FECHAR
  // ===========================================================================

  describe('Botão de Fechar', () => {
    it('deve exibir o botão de fechar por padrão', () => {
      const closeBtn = compiled.querySelector('.close-btn');
      expect(closeBtn).toBeTruthy();
    });

    it('deve ocultar o botão de fechar quando showCloseButton = false', () => {
      component.showCloseButton = false;
      fixture.detectChanges();

      const closeBtn = compiled.querySelector('.close-btn');
      expect(closeBtn).toBeFalsy();
    });

    it('deve exibir o texto correto no botão de fechar', () => {
      component.closeButtonText = 'X';
      fixture.detectChanges();

      const closeBtn = compiled.querySelector('.close-btn');
      expect(closeBtn?.textContent?.trim()).toBe('X');
    });

    it('deve usar texto padrão "×" no botão de fechar', () => {
      const closeBtn = compiled.querySelector('.close-btn');
      expect(closeBtn?.textContent?.trim()).toBe('×');
    });

    it('deve ter aria-label correto no botão de fechar', () => {
      component.closeButtonAriaLabel = 'Close this modal';
      fixture.detectChanges();

      const closeBtn = compiled.querySelector('.close-btn');
      expect(closeBtn?.getAttribute('aria-label')).toBe('Close this modal');
    });

    it('deve usar aria-label padrão no botão de fechar', () => {
      const closeBtn = compiled.querySelector('.close-btn');
      expect(closeBtn?.getAttribute('aria-label')).toBe('Fechar modal');
    });
  });

  // ===========================================================================
  // TESTES DE EVENTOS
  // ===========================================================================

  describe('Eventos', () => {
    it('deve emitir evento close ao clicar no botão de fechar', () => {
      spyOn(component.close, 'emit');

      const closeBtn = compiled.querySelector('.close-btn') as HTMLButtonElement;
      closeBtn.click();

      expect(component.close.emit).toHaveBeenCalled();
    });

    it('não deve emitir evento close se botão estiver desabilitado', () => {
      spyOn(component.close, 'emit');
      component.disableClose = true;
      fixture.detectChanges();

      const closeBtn = compiled.querySelector('.close-btn') as HTMLButtonElement;
      closeBtn.click();

      expect(component.close.emit).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // TESTES DE ESTADO
  // ===========================================================================

  describe('Estado do Botão', () => {
    it('deve desabilitar o botão quando disableClose = true', () => {
      component.disableClose = true;
      fixture.detectChanges();

      const closeBtn = compiled.querySelector('.close-btn') as HTMLButtonElement;
      expect(closeBtn.disabled).toBe(true);
    });

    it('deve habilitar o botão quando disableClose = false', () => {
      component.disableClose = false;
      fixture.detectChanges();

      const closeBtn = compiled.querySelector('.close-btn') as HTMLButtonElement;
      expect(closeBtn.disabled).toBe(false);
    });
  });

  // ===========================================================================
  // TESTES DE CONTEÚDO CUSTOMIZADO
  // ===========================================================================

  describe('Conteúdo Customizado', () => {
    it('deve exibir conteúdo customizado quando hasContent = true', () => {
      component.hasContent = true;
      fixture.detectChanges();

      const headerContent = compiled.querySelector('.header-content');
      expect(headerContent).toBeTruthy();
    });

    it('não deve exibir conteúdo customizado quando hasContent = false', () => {
      component.hasContent = false;
      fixture.detectChanges();

      const headerContent = compiled.querySelector('.header-content');
      expect(headerContent).toBeFalsy();
    });
  });

  // ===========================================================================
  // TESTES DE ACESSIBILIDADE
  // ===========================================================================

  describe('Acessibilidade', () => {
    it('botão de fechar deve ter type="button"', () => {
      const closeBtn = compiled.querySelector('.close-btn');
      expect(closeBtn?.getAttribute('type')).toBe('button');
    });

    it('título deve ter tag h3', () => {
      const title = compiled.querySelector('.modal-title');
      expect(title?.tagName.toLowerCase()).toBe('h3');
    });

    it('título deve ter ID para aria-labelledby', () => {
      const title = compiled.querySelector('.modal-title');
      const id = title?.getAttribute('id');
      expect(id).toBeTruthy();
      expect(id).toBe('modal-title');
    });
  });

  // ===========================================================================
  // TESTES DE INTEGRAÇÃO
  // ===========================================================================

  describe('Integração', () => {
    it('deve atualizar dinamicamente o título', () => {
      component.title = 'Título Inicial';
      fixture.detectChanges();
      let title = compiled.querySelector('.modal-title');
      expect(title?.textContent?.trim()).toBe('Título Inicial');

      component.title = 'Título Atualizado';
      fixture.detectChanges();
      title = compiled.querySelector('.modal-title');
      expect(title?.textContent?.trim()).toBe('Título Atualizado');
    });

    it('deve permitir alternar visibilidade do botão de fechar', () => {
      component.showCloseButton = true;
      fixture.detectChanges();
      let closeBtn = compiled.querySelector('.close-btn');
      expect(closeBtn).toBeTruthy();

      component.showCloseButton = false;
      fixture.detectChanges();
      closeBtn = compiled.querySelector('.close-btn');
      expect(closeBtn).toBeFalsy();
    });
  });
});

// =============================================================================
// FIM DOS TESTES
// =============================================================================
