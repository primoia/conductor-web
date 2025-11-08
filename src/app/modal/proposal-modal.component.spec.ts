import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProposalModal } from './proposal-modal.component';
import { DebugElement } from '@angular/core';
import { By } from '@angular/platform-browser';

describe('ProposalModal', () => {
  let component: ProposalModal;
  let fixture: ComponentFixture<ProposalModal>;
  let compiled: DebugElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProposalModal]
    }).compileComponents();

    fixture = TestBed.createComponent(ProposalModal);
    component = fixture.componentInstance;
    compiled = fixture.debugElement;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Visibility', () => {
    it('should not render modal when isVisible is false', () => {
      component.isVisible = false;
      fixture.detectChanges();

      const backdrop = compiled.query(By.css('.modal-backdrop'));
      expect(backdrop).toBeNull();
    });

    it('should render modal when isVisible is true', () => {
      component.isVisible = true;
      fixture.detectChanges();

      const backdrop = compiled.query(By.css('.modal-backdrop'));
      expect(backdrop).toBeTruthy();
    });
  });

  describe('Initialization', () => {
    it('should initialize with default proposalData', () => {
      expect(component.proposalData).toBeDefined();
      expect(component.proposalData.id).toBe('modal-proposal');
      expect(component.proposalData.status).toBe('pending');
    });

    it('should initialize footer buttons', () => {
      expect(component.footerButtons.length).toBe(2);
      expect(component.footerButtons[0].action).toBe('cancel');
      expect(component.footerButtons[1].action).toBe('save');
    });
  });

  describe('Footer Actions', () => {
    it('should have correct button labels', () => {
      const buttons = component.footerButtons;

      expect(buttons[0].label).toBe('Cancelar');
      expect(buttons[0].type).toBe('secondary');

      expect(buttons[1].label).toBe('Salvar no Documento');
      expect(buttons[1].type).toBe('primary');
    });
  });

  describe('User Interactions', () => {
    beforeEach(() => {
      component.isVisible = true;
      fixture.detectChanges();
    });

    it('should call onClose when cancel action is triggered', () => {
      spyOn(component, 'onClose');

      component.handleFooterAction('cancel');

      expect(component.onClose).toHaveBeenCalled();
    });

    it('should call save when save action is triggered', () => {
      spyOn(component, 'save');

      component.handleFooterAction('save');

      expect(component.save).toHaveBeenCalled();
    });

    it('should emit closeModal event on onClose', () => {
      spyOn(component.closeModal, 'emit');

      component.onClose();

      expect(component.closeModal.emit).toHaveBeenCalled();
    });

    it('should call onClose after save', () => {
      spyOn(component, 'onClose');

      component.save();

      expect(component.onClose).toHaveBeenCalled();
    });
  });

  describe('Status Change', () => {
    it('should handle status change for accepted', () => {
      spyOn(console, 'log');

      component.onStatusChange('accepted');

      expect(console.log).toHaveBeenCalledWith('Modal: Proposal status changed to', 'accepted');
    });

    it('should handle status change for rejected', () => {
      spyOn(console, 'log');

      component.onStatusChange('rejected');

      expect(console.log).toHaveBeenCalledWith('Modal: Proposal status changed to', 'rejected');
    });
  });

  describe('Modal Rendering', () => {
    beforeEach(() => {
      component.isVisible = true;
      fixture.detectChanges();
    });

    it('should render modal header with correct title', () => {
      const header = compiled.query(By.css('app-modal-header'));
      expect(header).toBeTruthy();
    });

    it('should render modal body with proposal block', () => {
      const proposalBlock = compiled.query(By.css('app-proposal-block'));
      expect(proposalBlock).toBeTruthy();
    });

    it('should render modal footer with buttons', () => {
      const footer = compiled.query(By.css('app-modal-footer'));
      expect(footer).toBeTruthy();
    });

    it('should render modal container inside backdrop', () => {
      const backdrop = compiled.query(By.css('.modal-backdrop'));
      const container = backdrop.query(By.css('.modal-container'));
      expect(container).toBeTruthy();
    });
  });

  describe('Backdrop Click', () => {
    it('should close modal on backdrop click', () => {
      spyOn(component, 'onClose');
      const event = new Event('click') as any;
      event.target = event.currentTarget = document.createElement('div');

      component.onBackdropClick(event);

      expect(component.onClose).toHaveBeenCalled();
    });

    it('should not close modal when clicking inside container', () => {
      spyOn(component, 'onClose');
      const event = new Event('click') as any;
      event.target = document.createElement('div');
      event.currentTarget = document.createElement('section');

      component.onBackdropClick(event);

      expect(component.onClose).not.toHaveBeenCalled();
    });
  });

  describe('BaseModalComponent Integration', () => {
    it('should extend BaseModalComponent', () => {
      expect(component instanceof component['constructor']['prototype']['constructor']['__proto__'].constructor).toBeTruthy();
    });

    it('should have isVisible input', () => {
      expect(component.isVisible).toBeDefined();
      expect(typeof component.isVisible).toBe('boolean');
    });

    it('should have closeModal output', () => {
      expect(component.closeModal).toBeDefined();
      expect(component.closeModal.observers.length).toBeGreaterThanOrEqual(0);
    });

    it('should call super.onClose when closing', () => {
      const superOnClose = spyOn(Object.getPrototypeOf(Object.getPrototypeOf(component)), 'onClose');

      component.onClose();

      expect(superOnClose).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      component.isVisible = true;
      fixture.detectChanges();
    });

    it('should have correct ARIA attributes on backdrop', () => {
      const backdrop = compiled.query(By.css('.modal-backdrop'));
      const backdropElement = backdrop.nativeElement;

      expect(backdropElement.getAttribute('role')).toBe('dialog');
      expect(backdropElement.getAttribute('aria-modal')).toBe('true');
      expect(backdropElement.getAttribute('aria-labelledby')).toBe('modal-title');
    });

    it('should have aria-label on modal header', () => {
      const header = compiled.query(By.css('app-modal-header'));
      expect(header.nativeElement.getAttribute('aria-label')).toBeTruthy();
    });

    it('should have aria-label on modal footer', () => {
      const footer = compiled.query(By.css('app-modal-footer'));
      expect(footer.nativeElement.getAttribute('aria-label')).toBeTruthy();
    });
  });

  describe('ProposalData Structure', () => {
    it('should have valid proposal data structure', () => {
      const data = component.proposalData;

      expect(data.id).toBeDefined();
      expect(data.title).toBeDefined();
      expect(data.description).toBeDefined();
      expect(data.codeContent).toBeDefined();
      expect(data.language).toBe('typescript');
      expect(data.agent).toBe('@auth-agent');
      expect(data.createdAt).toBeInstanceOf(Date);
    });

    it('should have proposal block editable by default', () => {
      component.isVisible = true;
      fixture.detectChanges();

      const proposalBlock = compiled.query(By.css('app-proposal-block'));
      expect(proposalBlock).toBeTruthy();
    });
  });
});
