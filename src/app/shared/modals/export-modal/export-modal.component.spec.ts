import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { ExportModalComponent } from './export-modal.component';

describe('ExportModalComponent', () => {
  let component: ExportModalComponent;
  let fixture: ComponentFixture<ExportModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExportModalComponent, FormsModule]
    }).compileComponents();

    fixture = TestBed.createComponent(ExportModalComponent);
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

    it('should be invalid when tempFilename is empty', () => {
      component.tempFilename = '';
      expect(component.isValid).toBe(false);
    });

    it('should be invalid when tempFilename does not end with .md', () => {
      component.tempFilename = 'filename.txt';
      expect(component.isValid).toBe(false);
    });

    it('should be valid when tempFilename ends with .md', () => {
      component.tempFilename = 'roteiro.md';
      expect(component.isValid).toBe(true);
    });

    it('should disable export button when form is invalid', () => {
      component.tempFilename = 'invalid.txt';
      fixture.detectChanges();
      const exportBtn = fixture.nativeElement.querySelector('.btn-primary');
      expect(exportBtn.disabled).toBe(true);
    });

    it('should enable export button when form is valid', () => {
      component.tempFilename = 'valid.md';
      fixture.detectChanges();
      const exportBtn = fixture.nativeElement.querySelector('.btn-primary');
      expect(exportBtn.disabled).toBe(false);
    });
  });

  describe('Export Functionality', () => {
    beforeEach(() => {
      component.isVisible = true;
      fixture.detectChanges();
    });

    it('should emit export event with trimmed filename when valid', () => {
      spyOn(component.export, 'emit');
      spyOn(component.closeModal, 'emit');

      component.tempFilename = '  roteiro.md  ';
      component.onExport();

      expect(component.export.emit).toHaveBeenCalledWith('roteiro.md');
      expect(component.closeModal.emit).toHaveBeenCalled();
    });

    it('should show error when filename is empty', () => {
      component.tempFilename = '';
      component.onExport();

      expect(component.errorMessage).toBe('Por favor, informe um nome de arquivo');
    });

    it('should show error when filename does not end with .md', () => {
      component.tempFilename = 'roteiro.txt';
      component.onExport();

      expect(component.errorMessage).toBe('O arquivo deve ter extensão .md');
    });

    it('should show error when filename contains forward slash', () => {
      component.tempFilename = 'path/to/file.md';
      component.onExport();

      expect(component.errorMessage).toBe('O nome do arquivo não pode conter barras (/ ou \\)');
    });

    it('should show error when filename contains backslash', () => {
      component.tempFilename = 'path\\to\\file.md';
      component.onExport();

      expect(component.errorMessage).toBe('O nome do arquivo não pode conter barras (/ ou \\)');
    });

    it('should accept valid .md filenames', () => {
      spyOn(component.export, 'emit');
      component.tempFilename = 'meu-roteiro-legal.md';
      component.onExport();

      expect(component.errorMessage).toBeNull();
      expect(component.export.emit).toHaveBeenCalledWith('meu-roteiro-legal.md');
    });

    it('should trigger export when Enter is pressed and form is valid', () => {
      spyOn(component, 'onExport');
      component.tempFilename = 'valid.md';
      component.onEnterKey();

      expect(component.onExport).toHaveBeenCalled();
    });

    it('should NOT trigger export when Enter is pressed and form is invalid', () => {
      spyOn(component, 'onExport');
      component.tempFilename = '';
      component.onEnterKey();

      expect(component.onExport).not.toHaveBeenCalled();
    });
  });

  describe('Initialization', () => {
    it('should initialize tempFilename from filename prop when visible', () => {
      component.filename = 'custom-name.md';
      component.isVisible = false;
      fixture.detectChanges();

      component.isVisible = true;
      component.ngOnChanges();

      expect(component.tempFilename).toBe('custom-name.md');
    });

    it('should use default filename when filename prop is empty', () => {
      component.filename = '';
      component.isVisible = true;
      component.ngOnChanges();

      expect(component.tempFilename).toBe('roteiro-vivo.md');
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
      expect(modalContent.getAttribute('aria-labelledby')).toBe('export-modal-title');
    });

    it('should have aria-describedby pointing to description', () => {
      const modalContent = fixture.nativeElement.querySelector('.modal-content');
      expect(modalContent.getAttribute('aria-describedby')).toBe('export-modal-description');
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
      const input = fixture.nativeElement.querySelector('#export-filename');
      expect(input.getAttribute('aria-required')).toBe('true');
    });

    it('should set aria-invalid when error exists', () => {
      component.errorMessage = 'Error';
      fixture.detectChanges();
      const input = fixture.nativeElement.querySelector('#export-filename');
      expect(input.getAttribute('aria-invalid')).toBe('true');
    });

    it('should have role="alert" on error message', () => {
      component.errorMessage = 'Error message';
      fixture.detectChanges();
      const errorDiv = fixture.nativeElement.querySelector('.error-message');
      expect(errorDiv.getAttribute('role')).toBe('alert');
    });
  });
});
