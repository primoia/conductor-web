import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AgentPreviewModalComponent, PreviewData } from './agent-preview-modal.component';
import { DebugElement } from '@angular/core';
import { By } from '@angular/platform-browser';

describe('AgentPreviewModalComponent', () => {
  let component: AgentPreviewModalComponent;
  let fixture: ComponentFixture<AgentPreviewModalComponent>;
  let compiled: DebugElement;

  const mockPreviewData: PreviewData = {
    originalText: 'Texto original de teste',
    proposedText: 'Texto proposto modificado de teste',
    agentName: 'Agente Teste',
    agentEmoji: '🤖'
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AgentPreviewModalComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(AgentPreviewModalComponent);
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
      component.previewData = mockPreviewData;
      fixture.detectChanges();

      const backdrop = compiled.query(By.css('.modal-backdrop'));
      expect(backdrop).toBeTruthy();
    });
  });

  describe('Modal Content', () => {
    beforeEach(() => {
      component.isVisible = true;
      component.previewData = mockPreviewData;
      fixture.detectChanges();
    });

    it('should display modal title with agent name and emoji', () => {
      const title = component.getModalTitle();
      expect(title).toContain(mockPreviewData.agentEmoji);
      expect(title).toContain(mockPreviewData.agentName);
    });

    it('should display original text', () => {
      const originalText = compiled.query(By.css('.original-text'));
      expect(originalText.nativeElement.textContent).toContain(mockPreviewData.originalText);
    });

    it('should display proposed text', () => {
      const proposedText = compiled.query(By.css('.proposed-text'));
      expect(proposedText.nativeElement.textContent).toContain(mockPreviewData.proposedText);
    });

    it('should calculate and display character count difference', () => {
      const diff = component.getDiff();
      const expected = mockPreviewData.proposedText.length - mockPreviewData.originalText.length;
      expect(diff).toBe(expected);
    });
  });

  describe('Loading State', () => {
    it('should display loading spinner when isLoading is true', () => {
      component.isVisible = true;
      component.isLoading = true;
      component.previewData = mockPreviewData;
      fixture.detectChanges();

      const spinner = compiled.query(By.css('.spinner'));
      expect(spinner).toBeTruthy();
    });

    it('should not display diff when loading', () => {
      component.isVisible = true;
      component.isLoading = true;
      component.previewData = mockPreviewData;
      fixture.detectChanges();

      const diffContainer = compiled.query(By.css('.diff-container'));
      expect(diffContainer).toBeNull();
    });

    it('should not allow closing via backdrop when loading', () => {
      component.isVisible = true;
      component.isLoading = true;
      spyOn(component.reject, 'emit');

      component.onBackdropClick();

      expect(component.reject.emit).not.toHaveBeenCalled();
    });
  });

  describe('Error State', () => {
    it('should display error message when error is set', () => {
      component.isVisible = true;
      component.error = 'Erro de teste';
      component.isLoading = false;
      fixture.detectChanges();

      const errorMessage = compiled.query(By.css('.error-message'));
      expect(errorMessage.nativeElement.textContent).toContain('Erro de teste');
    });

    it('should display error icon when error is set', () => {
      component.isVisible = true;
      component.error = 'Erro de teste';
      component.isLoading = false;
      fixture.detectChanges();

      const errorIcon = compiled.query(By.css('.error-icon'));
      expect(errorIcon).toBeTruthy();
    });
  });

  describe('User Interactions', () => {
    beforeEach(() => {
      component.isVisible = true;
      component.previewData = mockPreviewData;
      fixture.detectChanges();
    });

    it('should emit accept event when accept button is clicked', () => {
      spyOn(component.accept, 'emit');

      component.onAccept();

      expect(component.accept.emit).toHaveBeenCalledWith({
        action: 'accept',
        proposedText: mockPreviewData.proposedText
      });
    });

    it('should emit reject event when reject button is clicked', () => {
      spyOn(component.reject, 'emit');

      component.onReject();

      expect(component.reject.emit).toHaveBeenCalledWith({ action: 'reject' });
    });

    it('should call onReject when backdrop is clicked', () => {
      spyOn(component, 'onReject');

      component.onBackdropClick();

      expect(component.onReject).toHaveBeenCalled();
    });

    it('should not propagate click events from modal content', () => {
      const event = new Event('click');
      spyOn(event, 'stopPropagation');

      component.onContentClick(event);

      expect(event.stopPropagation).toHaveBeenCalled();
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should close modal on ESC key when visible and not loading', () => {
      component.isVisible = true;
      component.isLoading = false;
      spyOn(component, 'onReject');

      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      spyOn(event, 'preventDefault');

      component.handleEscape(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(component.onReject).toHaveBeenCalled();
    });

    it('should not close modal on ESC key when loading', () => {
      component.isVisible = true;
      component.isLoading = true;
      spyOn(component, 'onReject');

      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      component.handleEscape(event);

      expect(component.onReject).not.toHaveBeenCalled();
    });
  });

  describe('Footer Actions', () => {
    it('should return correct footer actions', () => {
      const actions = component.getFooterActions();

      expect(actions.length).toBe(2);
      expect(actions[0].action).toBe('reject');
      expect(actions[0].type).toBe('secondary');
      expect(actions[1].action).toBe('accept');
      expect(actions[1].type).toBe('primary');
    });

    it('should handle footer action clicks correctly', () => {
      spyOn(component, 'onAccept');
      spyOn(component, 'onReject');

      component.onFooterAction('accept');
      expect(component.onAccept).toHaveBeenCalled();

      component.onFooterAction('reject');
      expect(component.onReject).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      component.isVisible = true;
      component.previewData = mockPreviewData;
      fixture.detectChanges();
    });

    it('should have proper ARIA attributes on backdrop', () => {
      const backdrop = compiled.query(By.css('.modal-backdrop'));
      expect(backdrop.nativeElement.getAttribute('role')).toBe('dialog');
      expect(backdrop.nativeElement.getAttribute('aria-modal')).toBe('true');
    });

    it('should have aria-hidden on decorative icons', () => {
      const icons = compiled.queryAll(By.css('.header-icon, .diff-arrow'));
      icons.forEach(icon => {
        expect(icon.nativeElement.getAttribute('aria-hidden')).toBe('true');
      });
    });

    it('should have aria-label on stats region', () => {
      const stats = compiled.query(By.css('.stats'));
      expect(stats.nativeElement.getAttribute('role')).toBe('region');
      expect(stats.nativeElement.getAttribute('aria-label')).toBeTruthy();
    });
  });

  describe('Responsive Behavior', () => {
    it('should calculate difference correctly for positive values', () => {
      component.previewData = {
        ...mockPreviewData,
        originalText: 'short',
        proposedText: 'much longer text'
      };

      const diff = component.getDiff();
      expect(diff).toBeGreaterThan(0);
    });

    it('should calculate difference correctly for negative values', () => {
      component.previewData = {
        ...mockPreviewData,
        originalText: 'very long text here',
        proposedText: 'short'
      };

      const diff = component.getDiff();
      expect(diff).toBeLessThan(0);
    });

    it('should return 0 difference when previewData is null', () => {
      component.previewData = null;
      const diff = component.getDiff();
      expect(diff).toBe(0);
    });
  });

  describe('Lifecycle Hooks', () => {
    it('should log when modal becomes visible', () => {
      spyOn(console, 'log');
      component.isVisible = false;

      component.ngOnChanges({
        isVisible: {
          previousValue: false,
          currentValue: true,
          firstChange: false,
          isFirstChange: () => false
        }
      });

      expect(console.log).toHaveBeenCalled();
    });
  });
});
