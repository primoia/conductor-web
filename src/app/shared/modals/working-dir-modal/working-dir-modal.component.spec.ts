import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { WorkingDirModalComponent } from './working-dir-modal.component';

describe('WorkingDirModalComponent', () => {
  let component: WorkingDirModalComponent;
  let fixture: ComponentFixture<WorkingDirModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkingDirModalComponent, FormsModule]
    }).compileComponents();

    fixture = TestBed.createComponent(WorkingDirModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Visibility', () => {
    it('should not display modal when isVisible is false', () => {
      component.isVisible = false;
      fixture.detectChanges();
      const backdrop = fixture.nativeElement.querySelector('.modal-backdrop');
      expect(backdrop).toBeNull();
    });

    it('should display modal when isVisible is true', () => {
      component.isVisible = true;
      fixture.detectChanges();
      const backdrop = fixture.nativeElement.querySelector('.modal-backdrop');
      expect(backdrop).toBeTruthy();
    });
  });

  describe('Close Behavior', () => {
    beforeEach(() => {
      component.isVisible = true;
      fixture.detectChanges();
    });

    it('should emit closeModal when close button is clicked', () => {
      spyOn(component.closeModal, 'emit');
      const closeBtn = fixture.nativeElement.querySelector('.close-btn');
      closeBtn.click();
      expect(component.closeModal.emit).toHaveBeenCalled();
    });

    it('should emit closeModal when backdrop is clicked', () => {
      spyOn(component.closeModal, 'emit');
      const backdrop = fixture.nativeElement.querySelector('.modal-backdrop');
      backdrop.click();
      expect(component.closeModal.emit).toHaveBeenCalled();
    });

    it('should NOT close when modal content is clicked', () => {
      spyOn(component.closeModal, 'emit');
      const content = fixture.nativeElement.querySelector('.modal-content');
      content.click();
      expect(component.closeModal.emit).not.toHaveBeenCalled();
    });

    it('should emit closeModal when ESC key is pressed', () => {
      spyOn(component.closeModal, 'emit');
      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      component.handleEscapeKey(event);
      expect(component.closeModal.emit).toHaveBeenCalled();
    });

    it('should emit closeModal when cancel button is clicked', () => {
      spyOn(component.closeModal, 'emit');
      const cancelBtn = fixture.nativeElement.querySelector('.btn-secondary');
      cancelBtn.click();
      expect(component.closeModal.emit).toHaveBeenCalled();
    });
  });

  describe('Form Validation', () => {
    beforeEach(() => {
      component.isVisible = true;
      fixture.detectChanges();
    });

    it('should be invalid when tempDirectory is empty', () => {
      component.tempDirectory = '';
      expect(component.isValid).toBe(false);
    });

    it('should be invalid when tempDirectory is only whitespace', () => {
      component.tempDirectory = '   ';
      expect(component.isValid).toBe(false);
    });

    it('should be valid when tempDirectory has content', () => {
      component.tempDirectory = '/some/path';
      expect(component.isValid).toBe(true);
    });

    it('should disable save button when form is invalid', () => {
      component.tempDirectory = '';
      fixture.detectChanges();
      const saveBtn = fixture.nativeElement.querySelector('.btn-primary');
      expect(saveBtn.disabled).toBe(true);
    });

    it('should enable save button when form is valid', () => {
      component.tempDirectory = '/some/path';
      fixture.detectChanges();
      const saveBtn = fixture.nativeElement.querySelector('.btn-primary');
      expect(saveBtn.disabled).toBe(false);
    });
  });

  describe('Save Functionality', () => {
    beforeEach(() => {
      component.isVisible = true;
      fixture.detectChanges();
    });

    it('should emit save event with trimmed directory when valid', () => {
      spyOn(component.save, 'emit');
      spyOn(component.closeModal, 'emit');

      component.tempDirectory = '  /valid/path  ';
      component.onSave();

      expect(component.save.emit).toHaveBeenCalledWith('/valid/path');
      expect(component.closeModal.emit).toHaveBeenCalled();
    });

    it('should show error when directory is empty', () => {
      component.tempDirectory = '';
      component.onSave();

      expect(component.errorMessage).toBe('Por favor, informe um diretório válido');
    });

    it('should show error when path is not absolute', () => {
      component.tempDirectory = 'relative/path';
      component.onSave();

      expect(component.errorMessage).toBe('O caminho deve ser absoluto (começar com /)');
    });

    it('should accept valid absolute paths', () => {
      spyOn(component.save, 'emit');
      component.tempDirectory = '/mnt/ramdisk/project';
      component.onSave();

      expect(component.errorMessage).toBeNull();
      expect(component.save.emit).toHaveBeenCalledWith('/mnt/ramdisk/project');
    });

    it('should trigger save when Enter is pressed and form is valid', () => {
      spyOn(component, 'onSave');
      component.tempDirectory = '/valid/path';
      component.onEnterKey();

      expect(component.onSave).toHaveBeenCalled();
    });

    it('should NOT trigger save when Enter is pressed and form is invalid', () => {
      spyOn(component, 'onSave');
      component.tempDirectory = '';
      component.onEnterKey();

      expect(component.onSave).not.toHaveBeenCalled();
    });
  });

  describe('Initialization', () => {
    it('should initialize tempDirectory from currentDirectory when visible', () => {
      component.currentDirectory = '/existing/path';
      component.isVisible = false;
      fixture.detectChanges();

      component.isVisible = true;
      component.ngOnChanges();

      expect(component.tempDirectory).toBe('/existing/path');
    });

    it('should clear tempDirectory when currentDirectory is null', () => {
      component.currentDirectory = null;
      component.isVisible = true;
      component.ngOnChanges();

      expect(component.tempDirectory).toBe('');
    });

    it('should clear error message when modal is opened', () => {
      component.errorMessage = 'Some error';
      component.isVisible = true;
      component.ngOnChanges();

      expect(component.errorMessage).toBeNull();
    });
  });

  describe('Accessibility (ARIA)', () => {
    beforeEach(() => {
      component.isVisible = true;
      fixture.detectChanges();
    });

    it('should have role="dialog" on modal content', () => {
      const modalContent = fixture.nativeElement.querySelector('.modal-content');
      expect(modalContent.getAttribute('role')).toBe('dialog');
    });

    it('should have aria-labelledby pointing to title', () => {
      const modalContent = fixture.nativeElement.querySelector('.modal-content');
      expect(modalContent.getAttribute('aria-labelledby')).toBe('working-dir-modal-title');
    });

    it('should have aria-describedby pointing to description', () => {
      const modalContent = fixture.nativeElement.querySelector('.modal-content');
      expect(modalContent.getAttribute('aria-describedby')).toBe('working-dir-modal-description');
    });

    it('should have aria-modal="true"', () => {
      const modalContent = fixture.nativeElement.querySelector('.modal-content');
      expect(modalContent.getAttribute('aria-modal')).toBe('true');
    });

    it('should have aria-label on close button', () => {
      const closeBtn = fixture.nativeElement.querySelector('.close-btn');
      expect(closeBtn.getAttribute('aria-label')).toBe('Fechar modal');
    });

    it('should have aria-required on input', () => {
      const input = fixture.nativeElement.querySelector('#working-directory-input');
      expect(input.getAttribute('aria-required')).toBe('true');
    });

    it('should set aria-invalid when error exists', () => {
      component.errorMessage = 'Error';
      fixture.detectChanges();
      const input = fixture.nativeElement.querySelector('#working-directory-input');
      expect(input.getAttribute('aria-invalid')).toBe('true');
    });

    it('should have role="alert" on error message', () => {
      component.errorMessage = 'Error message';
      fixture.detectChanges();
      const errorDiv = fixture.nativeElement.querySelector('.error-message');
      expect(errorDiv.getAttribute('role')).toBe('alert');
    });
  });

  describe('Current Directory Display', () => {
    it('should display current directory when provided', () => {
      component.currentDirectory = '/current/dir';
      component.isVisible = true;
      fixture.detectChanges();

      const currentDirDiv = fixture.nativeElement.querySelector('.current-dir');
      expect(currentDirDiv).toBeTruthy();
      expect(currentDirDiv.textContent).toContain('/current/dir');
    });

    it('should NOT display current directory section when null', () => {
      component.currentDirectory = null;
      component.isVisible = true;
      fixture.detectChanges();

      const currentDirDiv = fixture.nativeElement.querySelector('.current-dir');
      expect(currentDirDiv).toBeNull();
    });
  });
});
