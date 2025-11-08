import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CouncilorEditModalComponent } from './councilor-edit-modal.component';
import { FormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';

describe('CouncilorEditModalComponent', () => {
  let component: CouncilorEditModalComponent;
  let fixture: ComponentFixture<CouncilorEditModalComponent>;

  const mockCouncilor = {
    id: 'agent-123',
    name: 'Test Agent',
    customization: {
      display_name: 'Test Councilor'
    },
    councilor_config: {
      title: 'Quality Auditor',
      task: {
        name: 'Check CSS',
        prompt: 'Check for CSS issues',
        context_files: []
      },
      schedule: {
        type: 'interval' as const,
        value: '30m',
        enabled: true
      },
      notifications: {
        on_success: false,
        on_warning: true,
        on_error: true,
        channels: ['panel']
      }
    }
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CouncilorEditModalComponent, FormsModule]
    }).compileComponents();

    fixture = TestBed.createComponent(CouncilorEditModalComponent);
    component = fixture.componentInstance;
    component.councilor = mockCouncilor as any;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Inicialização', () => {
    it('deve carregar dados do conselheiro no formulário', () => {
      expect(component.title).toBe('Quality Auditor');
      expect(component.taskName).toBe('Check CSS');
      expect(component.taskPrompt).toBe('Check for CSS issues');
      expect(component.scheduleValue).toBe('30m');
      expect(component.notifyOnSuccess).toBe(false);
      expect(component.notifyOnWarning).toBe(true);
      expect(component.notifyOnError).toBe(true);
    });

    it('deve ter valores padrão para notificações', () => {
      component.councilor = null;
      component.ngOnInit();
      expect(component.notifyOnSuccess).toBe(false);
      expect(component.notifyOnWarning).toBe(true);
      expect(component.notifyOnError).toBe(true);
    });
  });

  describe('Validação', () => {
    it('deve validar formulário com sucesso', () => {
      component.title = 'Test Title';
      component.taskName = 'Test Task';
      component.taskPrompt = 'Test Prompt';
      component.scheduleValue = '30m';
      expect(component.validateForm()).toBe(true);
    });

    it('deve falhar sem título', () => {
      component.title = '';
      expect(component.validateForm()).toBe(false);
      expect(component.errorMessage).toContain('título');
    });

    it('deve falhar sem nome da tarefa', () => {
      component.title = 'Title';
      component.taskName = '';
      expect(component.validateForm()).toBe(false);
      expect(component.errorMessage).toContain('nome da tarefa');
    });

    it('deve falhar sem prompt', () => {
      component.title = 'Title';
      component.taskName = 'Task';
      component.taskPrompt = '';
      expect(component.validateForm()).toBe(false);
      expect(component.errorMessage).toContain('prompt');
    });

    it('deve falhar com formato de intervalo inválido', () => {
      component.title = 'Title';
      component.taskName = 'Task';
      component.taskPrompt = 'Prompt';
      component.scheduleValue = 'invalid';
      expect(component.validateForm()).toBe(false);
      expect(component.errorMessage).toContain('intervalo');
    });

    it('deve aceitar intervalos válidos', () => {
      const validIntervals = ['30m', '1h', '2d', '15m', '24h'];
      component.title = 'Title';
      component.taskName = 'Task';
      component.taskPrompt = 'Prompt';

      validIntervals.forEach(interval => {
        component.scheduleValue = interval;
        expect(component.validateForm()).toBe(true);
      });
    });
  });

  describe('Ações', () => {
    it('deve fechar o modal', (done) => {
      component.close.subscribe(() => {
        done();
      });
      component.onClose();
    });

    it('não deve fechar se estiver salvando', () => {
      component.isSaving = true;
      const spy = spyOn(component.close, 'emit');
      component.onClose();
      expect(spy).not.toHaveBeenCalled();
    });

    it('deve emitir evento de salvar com dados corretos', (done) => {
      component.title = 'New Title';
      component.taskName = 'New Task';
      component.taskPrompt = 'New Prompt';
      component.scheduleValue = '1h';
      component.notifyOnSuccess = true;

      component.save.subscribe((data) => {
        expect(data.title).toBe('New Title');
        expect(data.task.name).toBe('New Task');
        expect(data.task.prompt).toBe('New Prompt');
        expect(data.schedule.value).toBe('1h');
        expect(data.notifications.on_success).toBe(true);
        done();
      });

      component.onSave();
    });

    it('não deve salvar formulário inválido', async () => {
      component.title = '';
      const spy = spyOn(component.save, 'emit');
      await component.onSave();
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('Schedule Examples', () => {
    it('deve retornar exemplos de intervalos', () => {
      const examples = component.getScheduleExamples();
      expect(examples.length).toBeGreaterThan(0);
      expect(examples).toContain('30m');
      expect(examples).toContain('1h');
    });

    it('deve definir valor de intervalo', () => {
      component.setScheduleValue('2h');
      expect(component.scheduleValue).toBe('2h');
    });
  });

  describe('Loading State', () => {
    it('deve definir estado de carregamento', () => {
      component.setLoadingState(true);
      expect(component.isSaving).toBe(true);
    });

    it('deve definir erro', () => {
      component.setError('Test error');
      expect(component.errorMessage).toBe('Test error');
      expect(component.isSaving).toBe(false);
    });
  });

  describe('Footer Buttons', () => {
    it('deve retornar 2 botões no footer', () => {
      expect(component.footerButtons.length).toBe(2);
    });

    it('deve ter botão Cancelar', () => {
      const cancelBtn = component.footerButtons.find(b => b.label === 'Cancelar');
      expect(cancelBtn).toBeTruthy();
      expect(cancelBtn?.variant).toBe('secondary');
    });

    it('deve ter botão Salvar', () => {
      const saveBtn = component.footerButtons.find(b => b.label.includes('Salvar'));
      expect(saveBtn).toBeTruthy();
      expect(saveBtn?.variant).toBe('primary');
    });

    it('deve desabilitar botões quando estiver salvando', () => {
      component.isSaving = true;
      component.footerButtons.forEach(btn => {
        expect(btn.disabled).toBe(true);
      });
    });

    it('deve mostrar loading no botão Salvar', () => {
      component.isSaving = true;
      const saveBtn = component.footerButtons.find(b => b.loading);
      expect(saveBtn).toBeTruthy();
    });
  });

  describe('ESC key handler', () => {
    it('deve fechar o modal ao pressionar ESC', () => {
      const spy = spyOn(component, 'onClose');
      component.handleEsc();
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('Acessibilidade', () => {
    it('deve ter role="dialog"', () => {
      const dialog = fixture.debugElement.query(By.css('[role="dialog"]'));
      expect(dialog).toBeTruthy();
    });

    it('deve ter aria-modal="true"', () => {
      const dialog = fixture.debugElement.query(By.css('[aria-modal="true"]'));
      expect(dialog).toBeTruthy();
    });

    it('deve ter aria-labelledby', () => {
      const dialog = fixture.debugElement.query(By.css('[aria-labelledby]'));
      expect(dialog).toBeTruthy();
    });

    it('deve ter role="alert" na mensagem de erro', async () => {
      component.errorMessage = 'Test error';
      fixture.detectChanges();
      await fixture.whenStable();
      const alert = fixture.debugElement.query(By.css('[role="alert"]'));
      expect(alert).toBeTruthy();
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
