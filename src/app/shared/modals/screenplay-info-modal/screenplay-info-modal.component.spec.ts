import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ScreenplayInfoModalComponent } from './screenplay-info-modal.component';

describe('ScreenplayInfoModalComponent', () => {
  let component: ScreenplayInfoModalComponent;
  let fixture: ComponentFixture<ScreenplayInfoModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScreenplayInfoModalComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ScreenplayInfoModalComponent);
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

    it('should emit closeModal when footer button is clicked', () => {
      spyOn(component.closeModal, 'emit');
      const footerBtn = fixture.nativeElement.querySelector('.btn-primary');
      footerBtn.click();
      expect(component.closeModal.emit).toHaveBeenCalled();
    });
  });

  describe('Shortcuts Display', () => {
    beforeEach(() => {
      component.isVisible = true;
      fixture.detectChanges();
    });

    it('should display all shortcuts', () => {
      const shortcutItems = fixture.nativeElement.querySelectorAll('.shortcut-item');
      expect(shortcutItems.length).toBe(component.shortcuts.length);
      expect(shortcutItems.length).toBe(6);
    });

    it('should display correct keys for each shortcut', () => {
      const firstShortcut = fixture.nativeElement.querySelector('.shortcut-item');
      const kbdElements = firstShortcut.querySelectorAll('kbd');

      expect(kbdElements.length).toBe(2); // Ctrl + S
      expect(kbdElements[0].textContent).toBe('Ctrl');
      expect(kbdElements[1].textContent).toBe('S');
    });

    it('should display correct description for each shortcut', () => {
      const firstShortcut = fixture.nativeElement.querySelector('.shortcut-item');
      const description = firstShortcut.querySelector('.shortcut-desc');

      expect(description.textContent).toBe('Salvar roteiro');
    });

    it('should display shortcuts with multiple keys correctly', () => {
      const shortcutItems = fixture.nativeElement.querySelectorAll('.shortcut-item');
      const ctrlShiftAShortcut = Array.from(shortcutItems).find((item: any) =>
        item.textContent.includes('Adicionar agente')
      );

      const kbdElements = ctrlShiftAShortcut.querySelectorAll('kbd');
      expect(kbdElements.length).toBe(3); // Ctrl + Shift + A
      expect(kbdElements[0].textContent).toBe('Ctrl');
      expect(kbdElements[1].textContent).toBe('Shift');
      expect(kbdElements[2].textContent).toBe('A');
    });
  });

  describe('Shortcuts Data', () => {
    it('should have 6 shortcuts defined', () => {
      expect(component.shortcuts.length).toBe(6);
    });

    it('should include Save shortcut', () => {
      const saveShortcut = component.shortcuts.find(s => s.description === 'Salvar roteiro');
      expect(saveShortcut).toBeTruthy();
      expect(saveShortcut?.keys).toEqual(['Ctrl', 'S']);
    });

    it('should include New screenplay shortcut', () => {
      const newShortcut = component.shortcuts.find(s => s.description === 'Novo roteiro');
      expect(newShortcut).toBeTruthy();
      expect(newShortcut?.keys).toEqual(['Ctrl', 'N']);
    });

    it('should include Open shortcut', () => {
      const openShortcut = component.shortcuts.find(s => s.description === 'Abrir roteiro do banco');
      expect(openShortcut).toBeTruthy();
      expect(openShortcut?.keys).toEqual(['Ctrl', 'O']);
    });

    it('should include Add agent shortcut', () => {
      const addAgentShortcut = component.shortcuts.find(s => s.description === 'Adicionar agente');
      expect(addAgentShortcut).toBeTruthy();
      expect(addAgentShortcut?.keys).toEqual(['Ctrl', 'Shift', 'A']);
    });

    it('should include Export shortcut', () => {
      const exportShortcut = component.shortcuts.find(s => s.description === 'Exportar para disco');
      expect(exportShortcut).toBeTruthy();
      expect(exportShortcut?.keys).toEqual(['Ctrl', 'E']);
    });

    it('should include Import shortcut', () => {
      const importShortcut = component.shortcuts.find(s => s.description === 'Importar do disco');
      expect(importShortcut).toBeTruthy();
      expect(importShortcut?.keys).toEqual(['Ctrl', 'I']);
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
      expect(modalContent.getAttribute('aria-labelledby')).toBe('screenplay-info-modal-title');
    });

    it('should have aria-describedby pointing to description', () => {
      const modalContent = fixture.nativeElement.querySelector('.modal-content');
      expect(modalContent.getAttribute('aria-describedby')).toBe('screenplay-info-modal-description');
    });

    it('should have aria-modal="true"', () => {
      const modalContent = fixture.nativeElement.querySelector('.modal-content');
      expect(modalContent.getAttribute('aria-modal')).toBe('true');
    });

    it('should have aria-label on close button', () => {
      const closeBtn = fixture.nativeElement.querySelector('.close-btn');
      expect(closeBtn.getAttribute('aria-label')).toBe('Fechar modal');
    });

    it('should have aria-label on footer button', () => {
      const footerBtn = fixture.nativeElement.querySelector('.btn-primary');
      expect(footerBtn.getAttribute('aria-label')).toBe('Fechar');
    });
  });

  describe('Modal Styling', () => {
    beforeEach(() => {
      component.isVisible = true;
      fixture.detectChanges();
    });

    it('should have shortcuts-grid container', () => {
      const grid = fixture.nativeElement.querySelector('.shortcuts-grid');
      expect(grid).toBeTruthy();
    });

    it('should have modal description', () => {
      const description = fixture.nativeElement.querySelector('.modal-description');
      expect(description).toBeTruthy();
      expect(description.textContent).toContain('Use estes atalhos');
    });
  });
});
