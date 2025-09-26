import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

// Interface for agent instance (copied from parent)
interface AgentInstance {
  id: string;
  emoji: string;
  definition: { title: string; description: string; unicode: string; };
  status: 'pending' | 'queued' | 'running' | 'completed' | 'error';
  position: { x: number; y: number; };
  executionState?: any;
}

// Events emitted by this modal
export interface AgentControlModalEvents {
  execute: { agent: AgentInstance; prompt: string };
  cancel: { agentId: string };
  close: void;
}

@Component({
  selector: 'app-agent-control-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './agent-control-modal.html',
  styleUrl: './agent-control-modal.scss'
})
export class AgentControlModal implements OnChanges {
  @Input() agent: AgentInstance | null = null;
  @Input() executionLogs: string[] = [];
  @Input() isVisible: boolean = false;

  @Output() execute = new EventEmitter<{ agent: AgentInstance; prompt: string }>();
  @Output() cancel = new EventEmitter<{ agentId: string }>();
  @Output() close = new EventEmitter<void>();

  agentPrompt: string = '';
  private lastAgentId: string | null = null;

  ngOnChanges(): void {
    // Clear prompt only when a different agent is selected
    if (this.agent && this.isVisible && this.agent.id !== this.lastAgentId) {
      this.agentPrompt = '';
      this.lastAgentId = this.agent.id;
      console.log('🔄 Modal opened with new agent, prompt cleared for:', this.agent.definition.title);
    }
  }

  onPromptInput(event: any): void {
    this.agentPrompt = event.target.value;
    console.log('📝 Prompt input:', this.agentPrompt, 'Length:', this.agentPrompt.length, 'Trimmed:', this.agentPrompt.trim().length);
  }

  onExecute(): void {
    if (this.agent && this.agentPrompt.trim()) {
      this.execute.emit({
        agent: this.agent,
        prompt: this.agentPrompt.trim()
      });
    }
  }

  onCancel(): void {
    if (this.agent) {
      this.cancel.emit({ agentId: this.agent.id });
    }
  }

  onClose(): void {
    this.close.emit();
  }

  onBackdropClick(): void {
    this.onClose();
  }

  onModalContentClick(event: Event): void {
    event.stopPropagation();
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'pending': return 'Pendente';
      case 'queued': return 'Na Fila';
      case 'running': return 'Executando';
      case 'completed': return 'Concluído';
      case 'error': return 'Erro';
      default: return 'Desconhecido';
    }
  }

  getResultDisplay(result: any): string {
    if (!result) return 'Nenhum resultado disponível';

    if (typeof result === 'string') {
      return result;
    }

    if (typeof result === 'object') {
      if (result.result) return result.result;
      if (result.message) return result.message;
      if (result.content) return result.content;
      return JSON.stringify(result, null, 2);
    }

    return String(result);
  }
}