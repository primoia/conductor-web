import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgentService, MCPRegistryEntry } from '../../services/agent.service';
import { firstValueFrom } from 'rxjs';

/**
 * Interface for instance MCP configurations
 */
interface InstanceMcpConfigs {
  template_mcps: string[];
  instance_mcps: string[];
  combined: string[];
}

/**
 * MCP Manager Modal Component
 *
 * Allows users to manage MCPs for a specific agent instance.
 * - Shows template MCPs (read-only, inherited from agent definition)
 * - Shows instance MCPs (editable, specific to this instance)
 * - Allows adding/removing instance MCPs
 */
@Component({
  selector: 'app-mcp-manager-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mcp-manager-modal.component.html',
  styleUrls: ['./mcp-manager-modal.component.scss']
})
export class McpManagerModalComponent implements OnInit, OnChanges {
  @Input() isVisible: boolean = false;
  @Input() instanceId: string | null = null;
  @Input() instanceName: string = '';
  @Output() closeModal = new EventEmitter<void>();
  @Output() mcpsSaved = new EventEmitter<string[]>();

  // Data
  availableMcps: MCPRegistryEntry[] = [];
  templateMcps: string[] = [];
  instanceMcps: string[] = [];

  // State
  isLoading = true;
  isSaving = false;
  error: string | null = null;

  // Selection
  selectedMcpToAdd: string = '';

  // Original for change detection
  private originalInstanceMcps: string[] = [];

  constructor(private agentService: AgentService) {}

  ngOnInit(): void {
    if (this.isVisible && this.instanceId) {
      this.loadData();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Load data when modal becomes visible
    if (changes['isVisible'] && this.isVisible && this.instanceId) {
      this.loadData();
    }
  }

  /**
   * Load available MCPs and instance configuration
   */
  async loadData(): Promise<void> {
    if (!this.instanceId) return;

    this.isLoading = true;
    this.error = null;

    try {
      const [mcps, configs] = await Promise.all([
        firstValueFrom(this.agentService.getAvailableMcps()),
        firstValueFrom(this.agentService.getInstanceMcpConfigs(this.instanceId))
      ]);

      this.availableMcps = mcps || [];

      if (configs) {
        this.templateMcps = configs.template_mcps || [];
        this.instanceMcps = [...(configs.instance_mcps || [])];
        this.originalInstanceMcps = [...this.instanceMcps];
      }

      this.isLoading = false;
    } catch (err) {
      this.error = 'Falha ao carregar dados';
      this.isLoading = false;
      console.error('[MCP Manager] Load error:', err);
    }
  }

  // ==================== Computed Properties ====================

  /**
   * Combined list of template + instance MCPs
   */
  get combinedMcps(): string[] {
    return [...new Set([...this.templateMcps, ...this.instanceMcps])];
  }

  /**
   * MCPs available to add (not already in combined list)
   */
  get availableToAdd(): MCPRegistryEntry[] {
    const combined = this.combinedMcps;
    return this.availableMcps.filter(mcp => !combined.includes(mcp.name));
  }

  /**
   * Check if there are unsaved changes
   */
  get hasChanges(): boolean {
    return JSON.stringify([...this.instanceMcps].sort()) !==
           JSON.stringify([...this.originalInstanceMcps].sort());
  }

  // ==================== Actions ====================

  /**
   * Add selected MCP to instance list
   */
  addMcp(): void {
    if (!this.selectedMcpToAdd) return;
    if (!this.instanceMcps.includes(this.selectedMcpToAdd)) {
      this.instanceMcps.push(this.selectedMcpToAdd);
    }
    this.selectedMcpToAdd = '';
  }

  /**
   * Remove MCP from instance list
   */
  removeMcp(mcpName: string): void {
    const index = this.instanceMcps.indexOf(mcpName);
    if (index !== -1) {
      this.instanceMcps.splice(index, 1);
    }
  }

  // ==================== Helpers ====================

  /**
   * Check if MCP is from template (read-only)
   */
  isTemplateMcp(mcpName: string): boolean {
    return this.templateMcps.includes(mcpName);
  }

  /**
   * Get MCP status from available list
   */
  getMcpStatus(mcpName: string): string {
    const mcp = this.availableMcps.find(m => m.name === mcpName);
    return mcp?.status || 'unknown';
  }

  /**
   * Get status icon based on MCP status
   */
  getStatusIcon(status: string): string {
    switch (status) {
      case 'healthy': return '●';   // Verde - funcionando
      case 'stopped': return '○';   // Cinza - parado (on-demand)
      case 'starting': return '◐';  // Amarelo - iniciando
      case 'unhealthy': return '✕'; // Vermelho - com problema
      case 'unknown': return '◌';   // Cinza claro - não registrado
      default: return '◌';
    }
  }

  /**
   * Check if any combined MCP is stopped
   */
  hasStoppedMcps(): boolean {
    return this.combinedMcps.some(mcp => this.getMcpStatus(mcp) === 'stopped');
  }

  // ==================== Save / Cancel ====================

  /**
   * Save changes to instance MCPs
   */
  async save(): Promise<void> {
    if (!this.instanceId || !this.hasChanges) return;

    this.isSaving = true;
    this.error = null;

    try {
      await firstValueFrom(
        this.agentService.updateInstanceMcpConfigs(this.instanceId, this.instanceMcps)
      );

      this.isSaving = false;
      this.originalInstanceMcps = [...this.instanceMcps];
      this.mcpsSaved.emit(this.combinedMcps);
      this.onClose();
    } catch (err) {
      this.isSaving = false;
      this.error = 'Falha ao salvar';
      console.error('[MCP Manager] Save error:', err);
    }
  }

  /**
   * Cancel and close modal
   */
  cancel(): void {
    if (this.hasChanges && !confirm('Descartar alterações?')) return;
    this.instanceMcps = [...this.originalInstanceMcps];
    this.onClose();
  }

  /**
   * Close modal
   */
  onClose(): void {
    this.closeModal.emit();
  }

  /**
   * Handle backdrop click
   */
  onBackdropClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.cancel();
    }
  }
}
