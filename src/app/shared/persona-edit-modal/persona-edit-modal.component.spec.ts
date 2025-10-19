import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChangeDetectorRef } from '@angular/core';
import { PersonaEditModalComponent } from './persona-edit-modal.component';
import { PersonaEditService, ValidationState, SaveState } from '../../services/persona-edit.service';

describe('PersonaEditModalComponent', () => {
  let component: PersonaEditModalComponent;
  let fixture: ComponentFixture<PersonaEditModalComponent>;
  let personaEditService: jasmine.SpyObj<PersonaEditService>;
  let changeDetectorRef: jasmine.SpyObj<ChangeDetectorRef>;

  beforeEach(async () => {
    const personaEditServiceSpy = jasmine.createSpyObj('PersonaEditService', [
      'savePersona',
      'loadPersona',
      'clearPersona',
      'hasEditedPersona',
      'validatePersonaAdvanced',
      'savePersonaWithHistory',
      'getOriginalPersona',
      'saveOriginalPersona'
    ]);

    const changeDetectorRefSpy = jasmine.createSpyObj('ChangeDetectorRef', [
      'markForCheck'
    ]);

    await TestBed.configureTestingModule({
      imports: [PersonaEditModalComponent],
      providers: [
        { provide: PersonaEditService, useValue: personaEditServiceSpy },
        { provide: ChangeDetectorRef, useValue: changeDetectorRefSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PersonaEditModalComponent);
    component = fixture.componentInstance;
    personaEditService = TestBed.inject(PersonaEditService) as jasmine.SpyObj<PersonaEditService>;
    changeDetectorRef = TestBed.inject(ChangeDetectorRef) as jasmine.SpyObj<ChangeDetectorRef>;

    // Configuração padrão dos spies
    personaEditService.validatePersonaAdvanced.and.returnValue({
      isValid: true,
      errors: [],
      warnings: []
    });
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Inicialização', () => {
    it('should initialize with default values', () => {
      expect(component.isVisible).toBe(false);
      expect(component.instanceId).toBeNull();
      expect(component.currentPersona).toBe('');
      expect(component.personaText).toBe('');
      expect(component.activeTab).toBe('edit');
      expect(component.maxLength).toBe(10000);
    });

    it('should load persona on init', () => {
      component.instanceId = 'test-instance';
      component.currentPersona = 'Original persona';
      personaEditService.loadPersona.and.returnValue('Edited persona');

      component.ngOnInit();

      expect(personaEditService.loadPersona).toHaveBeenCalledWith('test-instance');
      expect(component.personaText).toBe('Edited persona');
    });

    it('should load current persona when no edited persona exists', () => {
      component.instanceId = 'test-instance';
      component.currentPersona = 'Original persona';
      personaEditService.loadPersona.and.returnValue(null);

      component.ngOnInit();

      expect(component.personaText).toBe('Original persona');
    });
  });

  describe('Abertura e Fechamento do Modal', () => {
    it('should open modal correctly', () => {
      component.instanceId = 'test-instance';
      component.currentPersona = 'Original persona';
      component.isVisible = true;

      fixture.detectChanges();

      expect(component.isVisible).toBe(true);
    });

    it('should close modal correctly', () => {
      spyOn(component.closeModal, 'emit');
      component.isVisible = true;

      component.close();

      expect(component.closeModal.emit).toHaveBeenCalled();
    });

    it('should close modal on backdrop click', () => {
      spyOn(component, 'close');
      const event = new MouseEvent('click');
      spyOn(event, 'target').and.returnValue(event.currentTarget);

      component.onBackdropClick(event);

      expect(component.close).toHaveBeenCalled();
    });

    it('should not close modal on content click', () => {
      spyOn(component, 'close');
      const event = new MouseEvent('click');
      const mockTarget = document.createElement('div');
      spyOn(event, 'target').and.returnValue(mockTarget);
      spyOn(event, 'currentTarget').and.returnValue(document.createElement('div'));

      component.onBackdropClick(event);

      expect(component.close).not.toHaveBeenCalled();
    });
  });

  describe('Edição de Persona', () => {
    beforeEach(() => {
      component.instanceId = 'test-instance';
      component.currentPersona = 'Original persona';
      component.personaText = 'Edited persona';
    });

    it('should handle text changes', () => {
      spyOn(component, 'validatePersona');
      component.personaText = 'New persona';

      component.onTextChange();

      expect(component.validatePersona).toHaveBeenCalled();
      expect(changeDetectorRef.markForCheck).toHaveBeenCalled();
    });

    it('should validate persona on text change', () => {
      const validationState: ValidationState = {
        isValid: true,
        errors: [],
        warnings: ['Persona muito curta']
      };
      personaEditService.validatePersonaAdvanced.and.returnValue(validationState);

      component.onTextChange();

      expect(personaEditService.validatePersonaAdvanced).toHaveBeenCalledWith(component.personaText);
      expect(component.validationState).toEqual(validationState);
    });
  });

  describe('Validação', () => {
    it('should return true for valid persona', () => {
      component.validationState = {
        isValid: true,
        errors: [],
        warnings: []
      };

      expect(component.isPersonaValid()).toBe(true);
    });

    it('should return false for invalid persona', () => {
      component.validationState = {
        isValid: false,
        errors: ['Persona vazia'],
        warnings: []
      };

      expect(component.isPersonaValid()).toBe(false);
    });

    it('should show validation errors', () => {
      component.validationState = {
        isValid: false,
        errors: ['Persona muito grande'],
        warnings: ['Persona muito curta']
      };

      expect(component.validationState.errors).toContain('Persona muito grande');
      expect(component.validationState.warnings).toContain('Persona muito curta');
    });
  });

  describe('Tabs', () => {
    it('should set active tab to edit', () => {
      component.setActiveTab('edit');

      expect(component.activeTab).toBe('edit');
      expect(changeDetectorRef.markForCheck).toHaveBeenCalled();
    });

    it('should set active tab to preview', () => {
      component.setActiveTab('preview');

      expect(component.activeTab).toBe('preview');
      expect(changeDetectorRef.markForCheck).toHaveBeenCalled();
    });
  });

  describe('Preview Markdown', () => {
    it('should convert markdown to HTML correctly', () => {
      component.personaText = '# Title\n\n**Bold text**\n\n*Italic text*';

      const html = component.getPreviewHtml();

      expect(html).toContain('<h1>Title</h1>');
      expect(html).toContain('<strong>Bold text</strong>');
      expect(html).toContain('<em>Italic text</em>');
    });

    it('should handle empty content', () => {
      component.personaText = '';

      const html = component.getPreviewHtml();

      expect(html).toContain('Nenhum conteúdo para visualizar');
    });

    it('should convert lists correctly', () => {
      component.personaText = '- Item 1\n- Item 2\n\n1. Numbered 1\n2. Numbered 2';

      const html = component.getPreviewHtml();

      expect(html).toContain('<ul>');
      expect(html).toContain('<li>Item 1</li>');
      expect(html).toContain('<li>Item 2</li>');
      expect(html).toContain('<ol>');
      expect(html).toContain('<li>1. Numbered 1</li>');
    });

    it('should convert code blocks correctly', () => {
      component.personaText = '`inline code`\n\n```\nblock code\n```';

      const html = component.getPreviewHtml();

      expect(html).toContain('<code>inline code</code>');
      expect(html).toContain('<pre><code>block code</code></pre>');
    });

    it('should convert blockquotes correctly', () => {
      component.personaText = '> This is a quote';

      const html = component.getPreviewHtml();

      expect(html).toContain('<blockquote>This is a quote</blockquote>');
    });
  });

  describe('Salvamento', () => {
    beforeEach(() => {
      component.instanceId = 'test-instance';
      component.personaText = 'Valid persona';
      component.validationState = {
        isValid: true,
        errors: [],
        warnings: []
      };
    });

    it('should save persona when valid', async () => {
      spyOn(component.personaSaved, 'emit');
      spyOn(component, 'close');

      await component.save();

      expect(personaEditService.savePersonaWithHistory).toHaveBeenCalledWith('test-instance', 'Valid persona');
      expect(component.saveState.status).toBe('saved');
      expect(component.personaSaved.emit).toHaveBeenCalledWith('Valid persona');
      expect(changeDetectorRef.markForCheck).toHaveBeenCalled();
    });

    it('should not save persona when invalid', async () => {
      component.validationState = {
        isValid: false,
        errors: ['Persona vazia'],
        warnings: []
      };

      await component.save();

      expect(personaEditService.savePersonaWithHistory).not.toHaveBeenCalled();
    });

    it('should not save persona when no instanceId', async () => {
      component.instanceId = null;

      await component.save();

      expect(personaEditService.savePersonaWithHistory).not.toHaveBeenCalled();
    });

    it('should handle save error', async () => {
      personaEditService.savePersonaWithHistory.and.throwError('Save error');
      spyOn(console, 'error');

      await component.save();

      expect(component.saveState.status).toBe('error');
      expect(console.error).toHaveBeenCalled();
      expect(changeDetectorRef.markForCheck).toHaveBeenCalled();
    });

    it('should show saving status during save', async () => {
      component.saveState = { status: 'saving', message: 'Salvando...' };

      expect(component.getSaveStatusText()).toBe('Salvando...');
    });

    it('should show saved status after save', async () => {
      const timestamp = new Date();
      component.saveState = { 
        status: 'saved', 
        message: 'Salvo com sucesso',
        timestamp 
      };

      expect(component.getSaveStatusText()).toContain('Salvo em');
    });

    it('should show error status on save error', async () => {
      component.saveState = { status: 'error', message: 'Erro ao salvar' };

      expect(component.getSaveStatusText()).toBe('Erro ao salvar');
    });
  });

  describe('Mudanças de Input', () => {
    it('should reload persona when currentPersona changes', () => {
      spyOn(component, 'loadPersona');
      spyOn(component, 'validatePersona');

      component.ngOnChanges({
        currentPersona: {
          currentValue: 'New persona',
          previousValue: 'Old persona',
          firstChange: false,
          isFirstChange: () => false
        }
      });

      expect(component.loadPersona).toHaveBeenCalled();
      expect(component.validatePersona).toHaveBeenCalled();
    });

    it('should reload persona when instanceId changes', () => {
      spyOn(component, 'loadPersona');
      spyOn(component, 'validatePersona');

      component.ngOnChanges({
        instanceId: {
          currentValue: 'new-instance',
          previousValue: 'old-instance',
          firstChange: false,
          isFirstChange: () => false
        }
      });

      expect(component.loadPersona).toHaveBeenCalled();
      expect(component.validatePersona).toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    it('should complete destroy subject on destroy', () => {
      spyOn(component['destroy$'], 'next');
      spyOn(component['destroy$'], 'complete');

      component.ngOnDestroy();

      expect(component['destroy$'].next).toHaveBeenCalled();
      expect(component['destroy$'].complete).toHaveBeenCalled();
    });
  });

  describe('Acessibilidade', () => {
    it('should have proper ARIA attributes', () => {
      component.isVisible = true;
      fixture.detectChanges();

      const modalContent = fixture.debugElement.nativeElement.querySelector('.modal-content');
      expect(modalContent.getAttribute('role')).toBe('dialog');
      expect(modalContent.getAttribute('aria-labelledby')).toBe('modal-title');
      expect(modalContent.getAttribute('aria-describedby')).toBe('modal-description');
    });

    it('should have proper tab roles', () => {
      component.isVisible = true;
      fixture.detectChanges();

      const tabs = fixture.debugElement.nativeElement.querySelectorAll('.tab');
      tabs.forEach(tab => {
        expect(tab.getAttribute('role')).toBe('tab');
      });
    });

    it('should have proper textarea attributes', () => {
      component.isVisible = true;
      component.activeTab = 'edit';
      fixture.detectChanges();

      const textarea = fixture.debugElement.nativeElement.querySelector('.persona-textarea');
      expect(textarea.getAttribute('aria-label')).toBe('Editor de persona');
      expect(textarea.getAttribute('aria-describedby')).toBe('char-count validation-errors');
    });
  });

  describe('Responsividade', () => {
    it('should handle different screen sizes', () => {
      component.isVisible = true;
      fixture.detectChanges();

      const modalContent = fixture.debugElement.nativeElement.querySelector('.modal-content');
      expect(modalContent).toBeTruthy();
    });
  });
});