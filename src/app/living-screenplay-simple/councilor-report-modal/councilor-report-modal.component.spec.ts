import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CouncilorReportModalComponent } from './councilor-report-modal.component';
import { By } from '@angular/platform-browser';
import { CouncilorReport } from '../../models/councilor.types';

describe('CouncilorReportModalComponent', () => {
  let component: CouncilorReportModalComponent;
  let fixture: ComponentFixture<CouncilorReportModalComponent>;
  let mockReport: CouncilorReport;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CouncilorReportModalComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(CouncilorReportModalComponent);
    component = fixture.componentInstance;

    // Mock report data
    mockReport = {
      total_executions: 10,
      success_rate: 85,
      next_execution: new Date('2025-11-10T10:00:00'),
      recent_executions: [
        {
          id: '1',
          started_at: new Date('2025-11-08T09:00:00'),
          status: 'completed',
          severity: 'success',
          duration_ms: 5000,
          output: 'Execution successful',
          error: null
        },
        {
          id: '2',
          started_at: new Date('2025-11-07T08:00:00'),
          status: 'error',
          severity: 'error',
          duration_ms: 2000,
          output: null,
          error: 'Execution failed'
        }
      ]
    };

    component.isVisible = true;
    component.report = mockReport;
    component.councilorName = 'Test Councilor';
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Inicialização', () => {
    it('deve exibir o modal quando isVisible é true', () => {
      const backdrop = fixture.debugElement.query(By.css('.modal-backdrop'));
      expect(backdrop).toBeTruthy();
    });

    it('não deve exibir o modal quando isVisible é false', () => {
      component.isVisible = false;
      fixture.detectChanges();
      const backdrop = fixture.debugElement.query(By.css('.modal-backdrop'));
      expect(backdrop).toBeFalsy();
    });

    it('deve logar ao abrir o modal', () => {
      spyOn(console, 'log');
      component.ngOnInit();
      expect(console.log).toHaveBeenCalledWith('📋 Report modal opened:', mockReport);
    });
  });

  describe('Formatação de Data', () => {
    it('deve formatar data corretamente', () => {
      const date = new Date('2025-11-08T10:30:00');
      const formatted = component.formatDate(date);
      expect(formatted).toContain('08/11/2025');
      expect(formatted).toContain('10:30');
    });

    it('deve retornar N/A para data inválida', () => {
      expect(component.formatDate(undefined)).toBe('N/A');
      expect(component.formatDate(null as any)).toBe('N/A');
    });

    it('deve aceitar string de data', () => {
      const formatted = component.formatDate('2025-11-08T10:30:00');
      expect(formatted).toBeTruthy();
      expect(formatted).not.toBe('N/A');
    });
  });

  describe('Formatação de Duração', () => {
    it('deve formatar duração em minutos e segundos', () => {
      expect(component.formatDuration(125000)).toBe('2m 5s');
    });

    it('deve formatar duração apenas em segundos', () => {
      expect(component.formatDuration(5000)).toBe('5s');
    });

    it('deve retornar N/A para duração inválida', () => {
      expect(component.formatDuration(undefined)).toBe('N/A');
      expect(component.formatDuration(0)).toBe('N/A');
    });
  });

  describe('Classes de Severidade', () => {
    it('deve retornar classe correta para error', () => {
      expect(component.getSeverityClass('error')).toBe('severity-error');
    });

    it('deve retornar classe correta para warning', () => {
      expect(component.getSeverityClass('warning')).toBe('severity-warning');
    });

    it('deve retornar classe correta para success', () => {
      expect(component.getSeverityClass('success')).toBe('severity-success');
    });

    it('deve retornar classe padrão para severidade desconhecida', () => {
      expect(component.getSeverityClass('unknown')).toBe('severity-info');
    });
  });

  describe('Emojis de Severidade', () => {
    it('deve retornar emoji correto para error', () => {
      expect(component.getSeverityEmoji('error')).toBe('🔥');
    });

    it('deve retornar emoji correto para warning', () => {
      expect(component.getSeverityEmoji('warning')).toBe('⚠️');
    });

    it('deve retornar emoji correto para success', () => {
      expect(component.getSeverityEmoji('success')).toBe('✅');
    });

    it('deve retornar emoji padrão para severidade desconhecida', () => {
      expect(component.getSeverityEmoji('unknown')).toBe('ℹ️');
    });
  });

  describe('Labels de Severidade', () => {
    it('deve retornar label correto para error', () => {
      expect(component.getSeverityLabel('error')).toBe('Erro');
    });

    it('deve retornar label correto para warning', () => {
      expect(component.getSeverityLabel('warning')).toBe('Alerta');
    });

    it('deve retornar label correto para success', () => {
      expect(component.getSeverityLabel('success')).toBe('Sucesso');
    });

    it('deve retornar label padrão para severidade desconhecida', () => {
      expect(component.getSeverityLabel('unknown')).toBe('Info');
    });
  });

  describe('Classes de Status', () => {
    it('deve retornar classe correta para completed', () => {
      expect(component.getStatusClass('completed')).toBe('status-completed');
    });

    it('deve retornar classe correta para running', () => {
      expect(component.getStatusClass('running')).toBe('status-running');
    });

    it('deve retornar classe correta para error', () => {
      expect(component.getStatusClass('error')).toBe('status-error');
    });

    it('deve retornar classe padrão para status desconhecido', () => {
      expect(component.getStatusClass('unknown')).toBe('status-pending');
    });
  });

  describe('Labels de Status', () => {
    it('deve retornar label correto para completed', () => {
      expect(component.getStatusLabel('completed')).toBe('Concluído');
    });

    it('deve retornar label correto para running', () => {
      expect(component.getStatusLabel('running')).toBe('Executando');
    });

    it('deve retornar label correto para error', () => {
      expect(component.getStatusLabel('error')).toBe('Erro');
    });

    it('deve retornar label padrão para status desconhecido', () => {
      expect(component.getStatusLabel('unknown')).toBe('Pendente');
    });
  });

  describe('Footer', () => {
    it('deve retornar um botão Fechar', () => {
      const buttons = component.footerButtons;
      expect(buttons.length).toBe(1);
      expect(buttons[0].label).toBe('Fechar');
      expect(buttons[0].type).toBe('secondary');
    });

    it('deve fechar o modal ao clicar em Fechar', () => {
      const spy = spyOn(component, 'onClose');
      component.handleFooterAction('close');
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('Fechamento', () => {
    it('deve emitir evento close ao fechar', (done) => {
      component.close.subscribe(() => {
        done();
      });
      component.onClose();
    });

    it('deve emitir evento closeModal ao fechar', (done) => {
      component.closeModal.subscribe(() => {
        done();
      });
      component.onClose();
    });
  });

  describe('Backdrop', () => {
    it('deve fechar ao clicar no backdrop', () => {
      const spy = spyOn(component, 'onClose');
      const event = new MouseEvent('click');
      Object.defineProperty(event, 'target', { value: event.currentTarget, configurable: true });
      component.onBackdropClick(event);
      expect(spy).toHaveBeenCalled();
    });

    it('não deve fechar ao clicar dentro do modal', () => {
      const spy = spyOn(component, 'onClose');
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
      const spy = spyOn(component, 'onClose');
      component.handleEscape();
      expect(spy).toHaveBeenCalled();
    });

    it('não deve fechar se modal não estiver visível', () => {
      component.isVisible = false;
      const spy = spyOn(component, 'onClose');
      component.handleEscape();
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('Acessibilidade', () => {
    it('deve ter role="dialog"', () => {
      const backdrop = fixture.debugElement.query(By.css('[role="dialog"]'));
      expect(backdrop).toBeTruthy();
    });

    it('deve ter aria-modal="true"', () => {
      const backdrop = fixture.debugElement.query(By.css('[aria-modal="true"]'));
      expect(backdrop).toBeTruthy();
    });

    it('deve ter aria-labelledby', () => {
      const backdrop = fixture.debugElement.query(By.css('[aria-labelledby="report-modal-title"]'));
      expect(backdrop).toBeTruthy();
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

  describe('Exibição de Dados', () => {
    it('deve exibir estatísticas do relatório', () => {
      const stats = fixture.debugElement.queryAll(By.css('.stat-card'));
      expect(stats.length).toBeGreaterThan(0);
    });

    it('deve exibir execuções recentes', () => {
      const executions = fixture.debugElement.queryAll(By.css('.execution-item'));
      expect(executions.length).toBe(2);
    });

    it('deve exibir loading state quando não há relatório', () => {
      component.report = null;
      fixture.detectChanges();
      const loadingState = fixture.debugElement.query(By.css('.loading-state'));
      expect(loadingState).toBeTruthy();
    });

    it('deve exibir empty state quando não há execuções', () => {
      component.report = {
        ...mockReport,
        recent_executions: []
      };
      fixture.detectChanges();
      const emptyState = fixture.debugElement.query(By.css('.empty-state'));
      expect(emptyState).toBeTruthy();
    });
  });
});
