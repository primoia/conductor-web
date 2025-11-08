import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AgentControlModal } from './agent-control-modal';
import { DebugElement } from '@angular/core';
import { By } from '@angular/platform-browser';

describe('AgentControlModal', () => {
  let component: AgentControlModal;
  let fixture: ComponentFixture<AgentControlModal>;
  let compiled: DebugElement;

  const mockAgent = {
    id: 'test-agent-1',
    emoji: '🤖',
    definition: {
      title: 'Test Agent',
      description: 'A test agent for unit testing',
      unicode: 'U+1F916'
    },
    status: 'pending' as const,
    position: { x: 0, y: 0 },
    executionState: null
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AgentControlModal]
    }).compileComponents();

    fixture = TestBed.createComponent(AgentControlModal);
    component = fixture.componentInstance;
    compiled = fixture.debugElement;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Visibility', () => {
    it('should not render modal when isVisible is false', () => {
      component.isVisible = false;
      component.agent = mockAgent;
      fixture.detectChanges();

      const backdrop = compiled.query(By.css('.modal-backdrop'));
      expect(backdrop).toBeNull();
    });

    it('should render modal when isVisible is true and agent is set', () => {
      component.isVisible = true;
      component.agent = mockAgent;
      fixture.detectChanges();

      const backdrop = compiled.query(By.css('.modal-backdrop'));
      expect(backdrop).toBeTruthy();
    });

    it('should not render modal when agent is null', () => {
      component.isVisible = true;
      component.agent = null;
      fixture.detectChanges();

      const backdrop = compiled.query(By.css('.modal-backdrop'));
      expect(backdrop).toBeNull();
    });
  });

  describe('Modal Title', () => {
    it('should display agent emoji and name in title', () => {
      component.agent = mockAgent;
      const title = component.getModalTitle();

      expect(title).toContain(mockAgent.emoji);
      expect(title).toContain(mockAgent.definition.title);
    });

    it('should return default title when agent is null', () => {
      component.agent = null;
      const title = component.getModalTitle();

      expect(title).toBe('Controle de Agente');
    });
  });

  describe('Status Display', () => {
    it('should translate status to Portuguese', () => {
      expect(component.getStatusText('pending')).toBe('Pendente');
      expect(component.getStatusText('queued')).toBe('Na Fila');
      expect(component.getStatusText('running')).toBe('Executando');
      expect(component.getStatusText('completed')).toBe('Concluído');
      expect(component.getStatusText('error')).toBe('Erro');
      expect(component.getStatusText('unknown' as any)).toBe('Desconhecido');
    });
  });

  describe('Footer Actions - Pending State', () => {
    beforeEach(() => {
      component.agent = { ...mockAgent, status: 'pending' };
    });

    it('should return execute and close actions', () => {
      const actions = component.getFooterActions();

      expect(actions.length).toBe(2);
      expect(actions[0].action).toBe('close');
      expect(actions[1].action).toBe('execute');
    });

    it('should disable execute button when prompt is empty', () => {
      component.agentPrompt = '';
      const actions = component.getFooterActions();
      const executeAction = actions.find(a => a.action === 'execute');

      expect(executeAction?.disabled).toBe(true);
    });

    it('should enable execute button when prompt has content', () => {
      component.agentPrompt = 'Test prompt';
      const actions = component.getFooterActions();
      const executeAction = actions.find(a => a.action === 'execute');

      expect(executeAction?.disabled).toBe(false);
    });
  });

  describe('Footer Actions - Running/Queued State', () => {
    it('should return cancel action when queued', () => {
      component.agent = { ...mockAgent, status: 'queued' };
      const actions = component.getFooterActions();

      expect(actions.length).toBe(1);
      expect(actions[0].action).toBe('cancel');
      expect(actions[0].type).toBe('danger');
    });

    it('should return cancel action when running', () => {
      component.agent = { ...mockAgent, status: 'running' };
      const actions = component.getFooterActions();

      expect(actions.length).toBe(1);
      expect(actions[0].action).toBe('cancel');
    });
  });

  describe('Footer Actions - Completed State', () => {
    beforeEach(() => {
      component.agent = { ...mockAgent, status: 'completed' };
    });

    it('should return close and execute again actions', () => {
      const actions = component.getFooterActions();

      expect(actions.length).toBe(2);
      expect(actions[0].action).toBe('close');
      expect(actions[1].action).toBe('execute');
      expect(actions[1].label).toBe('Executar Novamente');
    });
  });

  describe('Footer Actions - Error State', () => {
    beforeEach(() => {
      component.agent = { ...mockAgent, status: 'error' };
    });

    it('should return close and try again actions', () => {
      const actions = component.getFooterActions();

      expect(actions.length).toBe(2);
      expect(actions[0].action).toBe('close');
      expect(actions[1].action).toBe('execute');
      expect(actions[1].label).toBe('Tentar Novamente');
    });
  });

  describe('User Interactions', () => {
    beforeEach(() => {
      component.isVisible = true;
      component.agent = mockAgent;
      fixture.detectChanges();
    });

    it('should emit execute event with agent and prompt', () => {
      spyOn(component.execute, 'emit');
      component.agentPrompt = 'Test prompt';

      component.onExecute();

      expect(component.execute.emit).toHaveBeenCalledWith({
        agent: mockAgent,
        prompt: 'Test prompt'
      });
    });

    it('should not emit execute event when prompt is empty', () => {
      spyOn(component.execute, 'emit');
      component.agentPrompt = '';

      component.onExecute();

      expect(component.execute.emit).not.toHaveBeenCalled();
    });

    it('should emit cancel event with agent id', () => {
      spyOn(component.cancel, 'emit');

      component.onCancel();

      expect(component.cancel.emit).toHaveBeenCalledWith({ agentId: mockAgent.id });
    });

    it('should emit close event', () => {
      spyOn(component.close, 'emit');

      component.onClose();

      expect(component.close.emit).toHaveBeenCalled();
    });

    it('should handle footer action clicks', () => {
      spyOn(component, 'onExecute');
      spyOn(component, 'onCancel');
      spyOn(component, 'onClose');

      component.onFooterAction('execute');
      expect(component.onExecute).toHaveBeenCalled();

      component.onFooterAction('cancel');
      expect(component.onCancel).toHaveBeenCalled();

      component.onFooterAction('close');
      expect(component.onClose).toHaveBeenCalled();
    });
  });

  describe('Prompt Input', () => {
    beforeEach(() => {
      component.isVisible = true;
      component.agent = { ...mockAgent, status: 'pending' };
      fixture.detectChanges();
    });

    it('should update agentPrompt on input', () => {
      const event = { target: { value: 'New prompt value' } };

      component.onPromptInput(event);

      expect(component.agentPrompt).toBe('New prompt value');
    });
  });

  describe('Agent Change Detection', () => {
    it('should clear prompt when different agent is selected', () => {
      component.agent = mockAgent;
      component.isVisible = true;
      component.agentPrompt = 'Old prompt';

      component.ngOnChanges();

      expect(component.agentPrompt).toBe('');
    });

    it('should not clear prompt when same agent is selected', () => {
      component.agent = mockAgent;
      component.isVisible = true;
      component.agentPrompt = 'Existing prompt';
      component['lastAgentId'] = mockAgent.id;

      component.ngOnChanges();

      expect(component.agentPrompt).toBe('Existing prompt');
    });
  });

  describe('Result Display', () => {
    it('should display string results directly', () => {
      const result = component.getResultDisplay('Simple string result');
      expect(result).toBe('Simple string result');
    });

    it('should extract result property from object', () => {
      const result = component.getResultDisplay({ result: 'Result value' });
      expect(result).toBe('Result value');
    });

    it('should extract message property from object', () => {
      const result = component.getResultDisplay({ message: 'Message value' });
      expect(result).toBe('Message value');
    });

    it('should extract content property from object', () => {
      const result = component.getResultDisplay({ content: 'Content value' });
      expect(result).toBe('Content value');
    });

    it('should stringify complex objects', () => {
      const result = component.getResultDisplay({ complex: 'object', data: 123 });
      expect(result).toContain('complex');
      expect(result).toContain('object');
    });

    it('should handle null/undefined results', () => {
      const result = component.getResultDisplay(null);
      expect(result).toBe('Nenhum resultado disponível');
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should close modal on ESC key when visible', () => {
      component.isVisible = true;
      component.agent = mockAgent;
      spyOn(component, 'onClose');

      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      spyOn(event, 'preventDefault');

      component.handleEscape(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(component.onClose).toHaveBeenCalled();
    });

    it('should not close modal on ESC key when not visible', () => {
      component.isVisible = false;
      spyOn(component, 'onClose');

      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      component.handleEscape(event);

      expect(component.onClose).not.toHaveBeenCalled();
    });
  });

  describe('Backdrop Click', () => {
    it('should close modal on backdrop click', () => {
      spyOn(component, 'onClose');

      component.onBackdropClick();

      expect(component.onClose).toHaveBeenCalled();
    });

    it('should not close modal on content click', () => {
      const event = new Event('click');
      spyOn(event, 'stopPropagation');

      component.onModalContentClick(event);

      expect(event.stopPropagation).toHaveBeenCalled();
    });
  });
});
