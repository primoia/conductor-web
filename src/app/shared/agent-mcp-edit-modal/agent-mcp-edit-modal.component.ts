import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgentService, Agent, MCPRegistryEntry } from '../../services/agent.service';
import { firstValueFrom } from 'rxjs';

/**
 * Interface for MCP filter
 */
interface McpFilter {
  search: string;
  category: string;
}

/**
 * Agent MCP Edit Modal Component
 *
 * Allows users to edit MCPs for an agent template.
 * Changes affect all future instances of this agent.
 */
@Component({
  selector: 'app-agent-mcp-edit-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-overlay" *ngIf="isVisible" (click)="onBackdropClick($event)">
      <div class="modal-content" (click)="$event.stopPropagation()">

        <!-- Header -->
        <div class="modal-header">
          <h2>
            <span class="emoji">{{ agent?.emoji || '🤖' }}</span>
            Editar MCPs - {{ agent?.name || 'Agente' }}
          </h2>
          <button class="close-btn" (click)="cancel()">×</button>
        </div>

        <!-- Body -->
        <div class="modal-body">
          <div *ngIf="error" class="error-msg">{{ error }}</div>

          <div *ngIf="isLoading" class="loading">
            <span class="spinner">⏳</span> Carregando...
          </div>

          <div *ngIf="!isLoading" class="mcp-edit">
            <!-- Info -->
            <p class="info-text">
              Selecione os MCPs que este agente poderá usar.
              <span class="stopped-hint">MCPs parados (○) serão iniciados automaticamente.</span>
            </p>

            <!-- Filters -->
            <div class="filters">
              <input
                type="text"
                [(ngModel)]="mcpFilter.search"
                (ngModelChange)="filterMcps()"
                placeholder="🔍 Buscar..."
                class="filter-search"
              />
              <select [(ngModel)]="mcpFilter.category" (ngModelChange)="filterMcps()" class="filter-category">
                <option value="">Todas categorias</option>
                <option *ngFor="let cat of mcpCategories" [value]="cat">
                  {{ cat }}
                </option>
              </select>
            </div>

            <!-- Counter -->
            <div class="counter">
              {{ selectedMcps.length }} MCP(s) selecionado(s)
              <span *ngIf="hasChanges" class="changes-badge">● alterações pendentes</span>
            </div>

            <!-- Grid -->
            <div class="mcp-grid">
              <div
                *ngFor="let mcp of filteredMcps"
                class="mcp-item"
                [class.selected]="isMcpSelected(mcp.name)"
                [class.stopped]="mcp.status === 'stopped'"
                [class.starting]="mcp.status === 'starting'"
                (click)="toggleMcp(mcp)"
              >
                <span class="status-dot" [class]="mcp.status">{{ getStatusIcon(mcp.status) }}</span>
                <span class="checkbox">{{ isMcpSelected(mcp.name) ? '✓' : '' }}</span>
                <div class="mcp-info">
                  <span class="name">{{ mcp.name }}</span>
                  <span class="category" *ngIf="mcp.metadata?.category">{{ mcp.metadata?.category }}</span>
                </div>
              </div>
            </div>

            <div *ngIf="filteredMcps.length === 0" class="empty-state">
              Nenhum MCP encontrado.
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="modal-footer">
          <button class="btn-secondary" (click)="cancel()" [disabled]="isSaving">
            Cancelar
          </button>
          <button class="btn-primary" (click)="save()" [disabled]="!hasChanges || isSaving">
            {{ isSaving ? 'Salvando...' : 'Salvar' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1200;
    }

    .modal-content {
      background: white;
      border-radius: 12px;
      width: 90%;
      max-width: 600px;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid #eee;
      background: #f8f9fa;
      border-radius: 12px 12px 0 0;
    }

    .modal-header h2 {
      margin: 0;
      font-size: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .modal-header .emoji {
      font-size: 20px;
    }

    .close-btn {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: #999;
      padding: 0;
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
    }

    .close-btn:hover {
      color: #333;
      background: #e9ecef;
    }

    .modal-body {
      padding: 20px;
      overflow-y: auto;
      flex: 1;
    }

    .error-msg {
      background: #fee2e2;
      color: #dc2626;
      padding: 10px;
      border-radius: 6px;
      margin-bottom: 12px;
    }

    .loading {
      text-align: center;
      padding: 40px;
      color: #666;
    }

    .loading .spinner {
      font-size: 24px;
    }

    .info-text {
      font-size: 13px;
      color: #666;
      margin-bottom: 12px;
    }

    .stopped-hint {
      display: block;
      font-style: italic;
      color: #888;
      margin-top: 4px;
    }

    .filters {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
    }

    .filters input,
    .filters select {
      padding: 8px 12px;
      border: 1px solid #dee2e6;
      border-radius: 6px;
      font-size: 13px;
    }

    .filter-search {
      flex: 1;
    }

    .filter-category {
      min-width: 140px;
    }

    .counter {
      font-size: 12px;
      color: #666;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .changes-badge {
      color: #f59e0b;
      font-weight: 500;
    }

    .mcp-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 8px;
      max-height: 280px;
      overflow-y: auto;
      padding: 8px;
      background: #f8f9fa;
      border-radius: 6px;
      border: 1px solid #dee2e6;
    }

    .mcp-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px;
      background: white;
      border: 1px solid #dee2e6;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s;
    }

    .mcp-item:hover {
      border-color: #007bff;
      background: #e3f2fd;
    }

    .mcp-item.selected {
      border-color: #007bff;
      background: #e3f2fd;
    }

    .mcp-item.selected .checkbox {
      background: #007bff;
      color: white;
    }

    .mcp-item.stopped {
      opacity: 0.75;
    }

    .mcp-item.starting {
      opacity: 0.85;
    }

    .status-dot {
      font-size: 10px;
      flex-shrink: 0;
    }

    .status-dot.healthy { color: #10b981; }
    .status-dot.stopped { color: #6b7280; }
    .status-dot.starting { color: #f59e0b; }

    .checkbox {
      width: 18px;
      height: 18px;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      flex-shrink: 0;
      background: white;
    }

    .mcp-info {
      flex: 1;
      min-width: 0;
    }

    .mcp-info .name {
      display: block;
      font-weight: 500;
      font-size: 13px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .mcp-info .category {
      display: block;
      font-size: 10px;
      color: #888;
      text-transform: uppercase;
    }

    .empty-state {
      text-align: center;
      padding: 30px;
      color: #666;
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding: 16px 20px;
      border-top: 1px solid #eee;
      background: #f8f9fa;
      border-radius: 0 0 12px 12px;
    }

    .btn-secondary,
    .btn-primary {
      padding: 10px 20px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s;
    }

    .btn-secondary {
      background: #6c757d;
      color: white;
    }

    .btn-secondary:hover:not(:disabled) {
      background: #545b62;
    }

    .btn-primary {
      background: #007bff;
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      background: #0056b3;
    }

    .btn-secondary:disabled,
    .btn-primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  `]
})
export class AgentMcpEditModalComponent implements OnInit, OnChanges {
  @Input() isVisible: boolean = false;
  @Input() agent: Agent | null = null;
  @Output() closeModal = new EventEmitter<void>();
  @Output() agentUpdated = new EventEmitter<Agent>();

  // Data
  availableMcps: MCPRegistryEntry[] = [];
  filteredMcps: MCPRegistryEntry[] = [];
  selectedMcps: string[] = [];
  mcpFilter: McpFilter = { search: '', category: '' };
  mcpCategories: string[] = [];

  // State
  isLoading = true;
  isSaving = false;
  error: string | null = null;

  // Original for change detection
  private originalMcps: string[] = [];

  constructor(private agentService: AgentService) {}

  ngOnInit(): void {
    if (this.isVisible && this.agent) {
      this.loadData();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isVisible'] && this.isVisible && this.agent) {
      this.loadData();
    }
    if (changes['agent'] && this.agent && this.isVisible) {
      this.selectedMcps = [...(this.agent.mcp_configs || [])];
      this.originalMcps = [...this.selectedMcps];
    }
  }

  /**
   * Load available MCPs
   */
  async loadData(): Promise<void> {
    this.isLoading = true;
    this.error = null;

    try {
      const mcps = await firstValueFrom(this.agentService.getAvailableMcps());
      this.availableMcps = mcps || [];
      this.extractCategories();

      // Initialize selected MCPs from agent
      if (this.agent) {
        this.selectedMcps = [...(this.agent.mcp_configs || [])];
        this.originalMcps = [...this.selectedMcps];
      }

      this.filterMcps();
      this.isLoading = false;
    } catch (err) {
      this.error = 'Falha ao carregar MCPs';
      this.isLoading = false;
      console.error('[Agent MCP Edit] Load error:', err);
    }
  }

  /**
   * Extract unique categories from MCPs
   */
  extractCategories(): void {
    const categories = new Set<string>();
    this.availableMcps.forEach(mcp => {
      if (mcp.metadata?.category) {
        categories.add(mcp.metadata.category);
      }
    });
    this.mcpCategories = Array.from(categories).sort();
  }

  /**
   * Filter MCPs based on search and category
   */
  filterMcps(): void {
    let result = [...this.availableMcps];

    if (this.mcpFilter.search) {
      const search = this.mcpFilter.search.toLowerCase();
      result = result.filter(mcp =>
        mcp.name.toLowerCase().includes(search)
      );
    }

    if (this.mcpFilter.category) {
      result = result.filter(mcp =>
        mcp.metadata?.category === this.mcpFilter.category
      );
    }

    // Sort: selected first, then alphabetically
    result.sort((a, b) => {
      const aSelected = this.selectedMcps.includes(a.name);
      const bSelected = this.selectedMcps.includes(b.name);
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;
      return a.name.localeCompare(b.name);
    });

    this.filteredMcps = result;
  }

  /**
   * Check if there are unsaved changes
   */
  get hasChanges(): boolean {
    return JSON.stringify([...this.selectedMcps].sort()) !==
           JSON.stringify([...this.originalMcps].sort());
  }

  /**
   * Toggle MCP selection
   */
  toggleMcp(mcp: MCPRegistryEntry): void {
    const index = this.selectedMcps.indexOf(mcp.name);
    if (index === -1) {
      this.selectedMcps.push(mcp.name);
    } else {
      this.selectedMcps.splice(index, 1);
    }
    this.filterMcps();
  }

  /**
   * Check if MCP is selected
   */
  isMcpSelected(name: string): boolean {
    return this.selectedMcps.includes(name);
  }

  /**
   * Get status icon
   */
  getStatusIcon(status: string): string {
    switch (status) {
      case 'healthy': return '●';
      case 'stopped': return '○';
      case 'starting': return '◐';
      default: return '?';
    }
  }

  /**
   * Save changes
   */
  async save(): Promise<void> {
    if (!this.agent || !this.hasChanges) return;

    this.isSaving = true;
    this.error = null;

    try {
      // Use agent_id if available, otherwise use id
      const agentId = (this.agent as any).agent_id || this.agent.id;

      const updatedAgent = await firstValueFrom(
        this.agentService.updateAgentMcpConfigs(agentId, this.selectedMcps)
      );

      this.isSaving = false;
      this.originalMcps = [...this.selectedMcps];
      this.agentUpdated.emit(updatedAgent);
      this.onClose();
    } catch (err) {
      this.isSaving = false;
      this.error = 'Falha ao salvar alterações';
      console.error('[Agent MCP Edit] Save error:', err);
    }
  }

  /**
   * Cancel and close
   */
  cancel(): void {
    if (this.hasChanges && !confirm('Descartar alterações?')) return;
    this.selectedMcps = [...this.originalMcps];
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
