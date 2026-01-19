import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgentService, Agent, MCPRegistryEntry } from '../../services/agent.service';
import { ModalHeaderComponent } from '../../shared/modals/base/modal-header.component';
import { ModalFooterComponent, ModalButton } from '../../shared/modals/base/modal-footer.component';
import { BaseModalComponent } from '../../shared/modals/base/base-modal.component';

export interface AgentUpdateData {
  name?: string;
  description?: string;
  group?: string;
  emoji?: string;
  tags?: string[];
  persona_content?: string;
  mcp_configs?: string[];
}

export const VALID_GROUPS = [
  { value: 'development', label: 'Desenvolvimento', icon: '🔧' },
  { value: 'crm', label: 'CRM & Vendas', icon: '📊' },
  { value: 'documentation', label: 'Documentação', icon: '📝' },
  { value: 'devops', label: 'DevOps', icon: '🛡️' },
  { value: 'orchestration', label: 'Orquestração', icon: '🎼' },
  { value: 'testing', label: 'Testes', icon: '🧪' },
  { value: 'career', label: 'Carreira', icon: '💼' },
  { value: 'other', label: 'Outros', icon: '📦' },
];

@Component({
  selector: 'app-agent-editor-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalHeaderComponent, ModalFooterComponent],
  templateUrl: './agent-editor-modal.component.html',
  styleUrls: ['./agent-editor-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AgentEditorModalComponent extends BaseModalComponent implements OnInit, OnChanges {
  @Input() override isVisible: boolean = false;
  @Input() agent: Agent | null = null;
  @Output() override closeModal = new EventEmitter<void>();
  @Output() agentUpdated = new EventEmitter<Agent>();

  agentName: string = '';
  agentDescription: string = '';
  agentGroup: string = 'other';
  agentEmoji: string = '🤖';
  agentTags: string[] = [];
  newTag: string = '';
  personaContent: string = '';
  selectedMcps: string[] = [];

  availableMcps: MCPRegistryEntry[] = [];
  filteredMcps: MCPRegistryEntry[] = [];
  mcpSearchQuery: string = '';
  mcpFilter: { category: string; status: string } = { category: '', status: '' };
  mcpCategories: string[] = [];

  isLoading: boolean = false;
  isSaving: boolean = false;
  error: string | null = null;
  activeTab: 'basic' | 'persona' | 'mcps' = 'basic';
  hasChanges: boolean = false;
  footerButtons: ModalButton[] = [];

  availableEmojis = ['🤖', '🚀', '🔐', '📊', '🛡️', '⚡', '🎯', '🧠', '💻', '📱', '🌐', '🔍', '🧪', '💡', '🎨', '📝'];
  customEmoji: string = '';
  groupOptions = VALID_GROUPS;

  private originalValues: AgentUpdateData = {};

  constructor(
    private agentService: AgentService,
    private cdr: ChangeDetectorRef
  ) {
    super();
    this.setupFooterButtons();
  }

  ngOnInit(): void {
    this.loadMcps();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isVisible'] && this.isVisible && this.agent) {
      this.loadAgentData();
    }
    if (changes['agent'] && this.agent && this.isVisible) {
      this.loadAgentData();
    }
  }

  private setupFooterButtons(): void {
    this.footerButtons = [
      { label: 'Cancelar', type: 'secondary', action: 'cancel' },
      { label: 'Salvar Alterações', type: 'primary', action: 'save', disabled: true }
    ];
  }

  private updateSaveButtonState(): void {
    this.footerButtons = this.footerButtons.map(btn => {
      if (btn.action === 'save') {
        return {
          ...btn,
          disabled: !this.hasChanges || !this.isValid() || this.isSaving,
          loading: this.isSaving
        };
      }
      return btn;
    });
  }

  handleFooterAction(action: string): void {
    if (action === 'cancel') {
      this.onClose();
    } else if (action === 'save') {
      this.onSave();
    }
  }

  private loadAgentData(): void {
    if (!this.agent) return;

    this.isLoading = true;
    this.error = null;

    this.agentName = this.agent.name || '';
    this.agentDescription = this.agent.description || '';
    this.agentGroup = this.agent.group || 'other';
    this.agentEmoji = this.agent.emoji || '🤖';
    this.agentTags = [...(this.agent.tags || [])];
    this.selectedMcps = [...(this.agent.mcp_configs || [])];

    if (this.availableEmojis.includes(this.agentEmoji)) {
      this.customEmoji = '';
    } else {
      this.customEmoji = this.agentEmoji;
    }

    this.agentService.getAgentPersona(this.agent.id).subscribe({
      next: (response) => {
        this.personaContent = response.persona_content || '';
        this.saveOriginalValues();
        this.isLoading = false;
        this.hasChanges = false;
        this.updateSaveButtonState();
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('[AgentEditor] Error loading persona:', err);
        this.personaContent = '';
        this.saveOriginalValues();
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  private saveOriginalValues(): void {
    this.originalValues = {
      name: this.agentName,
      description: this.agentDescription,
      group: this.agentGroup,
      emoji: this.getSelectedEmoji(),
      tags: [...this.agentTags],
      persona_content: this.personaContent,
      mcp_configs: [...this.selectedMcps]
    };
  }

  private loadMcps(): void {
    this.agentService.getAvailableMcps().subscribe({
      next: (mcps) => {
        this.availableMcps = mcps;
        this.extractCategories();
        this.filterMcps();
        this.cdr.markForCheck();
      },
      error: (err) => console.error('[AgentEditor] Error loading MCPs:', err)
    });
  }

  private extractCategories(): void {
    const categories = new Set<string>();
    this.availableMcps.forEach(mcp => {
      if (mcp.metadata?.category) {
        categories.add(mcp.metadata.category);
      }
    });
    this.mcpCategories = Array.from(categories).sort();
  }

  filterMcps(): void {
    let result = [...this.availableMcps];

    if (this.mcpSearchQuery) {
      const query = this.mcpSearchQuery.toLowerCase();
      result = result.filter(mcp => mcp.name.toLowerCase().includes(query));
    }

    if (this.mcpFilter.category) {
      result = result.filter(mcp => mcp.metadata?.category === this.mcpFilter.category);
    }

    if (this.mcpFilter.status) {
      result = result.filter(mcp => mcp.status === this.mcpFilter.status);
    }

    result.sort((a, b) => {
      const aSelected = this.selectedMcps.includes(a.name);
      const bSelected = this.selectedMcps.includes(b.name);
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;
      return a.name.localeCompare(b.name);
    });

    this.filteredMcps = result;
  }

  setActiveTab(tab: 'basic' | 'persona' | 'mcps'): void {
    this.activeTab = tab;
    this.cdr.markForCheck();
  }

  selectEmoji(emoji: string): void {
    this.agentEmoji = emoji;
    this.customEmoji = '';
    this.checkForChanges();
  }

  onCustomEmojiInput(): void {
    if (this.customEmoji) {
      this.agentEmoji = '';
    }
    this.checkForChanges();
  }

  getSelectedEmoji(): string {
    return this.customEmoji || this.agentEmoji || '🤖';
  }

  addTag(): void {
    const tag = this.newTag.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (tag && !this.agentTags.includes(tag) && this.agentTags.length < 10) {
      this.agentTags.push(tag);
      this.newTag = '';
      this.checkForChanges();
    }
  }

  removeTag(index: number): void {
    this.agentTags.splice(index, 1);
    this.checkForChanges();
  }

  toggleMcp(mcp: MCPRegistryEntry): void {
    const index = this.selectedMcps.indexOf(mcp.name);
    if (index === -1) {
      this.selectedMcps.push(mcp.name);
    } else {
      this.selectedMcps.splice(index, 1);
    }
    this.filterMcps();
    this.checkForChanges();
  }

  isMcpSelected(name: string): boolean {
    return this.selectedMcps.includes(name);
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'healthy': return '●';
      case 'stopped': return '○';
      case 'starting': return '◐';
      default: return '?';
    }
  }

  formatMcpName(name: string): string {
    return name.length > 25 ? name.substring(0, 22) + '...' : name;
  }

  isValid(): boolean {
    return this.isNameValid() && this.isDescriptionValid() && this.isPersonaValid();
  }

  isNameValid(): boolean {
    return this.agentName.length >= 2;
  }

  isDescriptionValid(): boolean {
    const len = this.agentDescription.trim().length;
    return len >= 10 && len <= 200;
  }

  isPersonaValid(): boolean {
    const content = this.personaContent.trim();
    return content.length >= 50 && content.startsWith('#');
  }

  getDescriptionValidationMessage(): string {
    const len = this.agentDescription.trim().length;
    if (len === 0) return '10-200 caracteres';
    if (len < 10) return 'Faltam ' + (10 - len) + ' caracteres';
    if (len > 200) return 'Excedeu ' + (len - 200) + ' caracteres';
    return len + '/200 caracteres';
  }

  getPersonaValidationMessage(): string {
    const content = this.personaContent.trim();
    if (content.length === 0) return 'Deve começar com # (Markdown) e ter mín 50 chars';
    if (!content.startsWith('#')) return 'Deve começar com um cabeçalho Markdown (#)';
    if (content.length < 50) return 'Faltam ' + (50 - content.length) + ' caracteres';
    return content.length + ' caracteres';
  }

  onFieldChange(): void {
    this.checkForChanges();
  }

  private checkForChanges(): void {
    const current: AgentUpdateData = {
      name: this.agentName,
      description: this.agentDescription,
      group: this.agentGroup,
      emoji: this.getSelectedEmoji(),
      tags: [...this.agentTags],
      persona_content: this.personaContent,
      mcp_configs: [...this.selectedMcps]
    };

    this.hasChanges = 
      current.name !== this.originalValues.name ||
      current.description !== this.originalValues.description ||
      current.group !== this.originalValues.group ||
      current.emoji !== this.originalValues.emoji ||
      current.persona_content !== this.originalValues.persona_content ||
      JSON.stringify(current.tags) !== JSON.stringify(this.originalValues.tags) ||
      JSON.stringify(current.mcp_configs) !== JSON.stringify(this.originalValues.mcp_configs);

    this.updateSaveButtonState();
    this.cdr.markForCheck();
  }

  onSave(): void {
    if (!this.agent || !this.isValid() || !this.hasChanges) return;

    this.isSaving = true;
    this.error = null;
    this.updateSaveButtonState();

    const updates: AgentUpdateData = {};

    if (this.agentName !== this.originalValues.name) {
      updates.name = this.agentName;
    }
    if (this.agentDescription !== this.originalValues.description) {
      updates.description = this.agentDescription;
    }
    if (this.agentGroup !== this.originalValues.group) {
      updates.group = this.agentGroup;
    }
    if (this.getSelectedEmoji() !== this.originalValues.emoji) {
      updates.emoji = this.getSelectedEmoji();
    }
    if (JSON.stringify(this.agentTags) !== JSON.stringify(this.originalValues.tags)) {
      updates.tags = this.agentTags;
    }
    if (this.personaContent !== this.originalValues.persona_content) {
      updates.persona_content = this.personaContent;
    }
    if (JSON.stringify(this.selectedMcps) !== JSON.stringify(this.originalValues.mcp_configs)) {
      updates.mcp_configs = this.selectedMcps;
    }

    console.log('[AgentEditor] Saving updates:', updates);

    this.agentService.updateAgent(this.agent.id, updates).subscribe({
      next: (response) => {
        console.log('[AgentEditor] Agent updated:', response);
        this.isSaving = false;
        this.updateSaveButtonState();

        const updatedAgent: Agent = {
          ...this.agent!,
          name: this.agentName,
          description: this.agentDescription,
          group: this.agentGroup,
          emoji: this.getSelectedEmoji(),
          tags: this.agentTags,
          mcp_configs: this.selectedMcps
        };

        this.agentUpdated.emit(updatedAgent);
        this.closeModal.emit();
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('[AgentEditor] Error updating agent:', err);
        this.error = err.message || 'Erro ao atualizar agente';
        this.isSaving = false;
        this.updateSaveButtonState();
        this.cdr.markForCheck();
      }
    });
  }

  override onClose(): void {
    if (this.hasChanges && !confirm('Descartar alterações não salvas?')) {
      return;
    }
    this.resetForm();
    this.closeModal.emit();
  }

  public override onBackdropClick(event: Event): void {
    event.stopPropagation();
    this.onClose();
  }

  private resetForm(): void {
    this.agentName = '';
    this.agentDescription = '';
    this.agentGroup = 'other';
    this.agentEmoji = '🤖';
    this.customEmoji = '';
    this.agentTags = [];
    this.newTag = '';
    this.personaContent = '';
    this.selectedMcps = [];
    this.mcpSearchQuery = '';
    this.mcpFilter = { category: '', status: '' };
    this.hasChanges = false;
    this.error = null;
    this.activeTab = 'basic';
    this.filterMcps();
  }
}
