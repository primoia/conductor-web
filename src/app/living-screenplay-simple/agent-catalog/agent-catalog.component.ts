import { Component, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Agent, AgentService } from '../../services/agent.service';
import { AgentMcpEditModalComponent } from '../../shared/agent-mcp-edit-modal/agent-mcp-edit-modal.component';

@Component({
  selector: 'app-agent-catalog',
  standalone: true,
  imports: [CommonModule, FormsModule, AgentMcpEditModalComponent],
  templateUrl: './agent-catalog.component.html',
  styleUrls: ['./agent-catalog.component.css']
})
export class AgentCatalogComponent implements OnInit {
  @Output() selectAgent = new EventEmitter<Agent>();
  @Output() createAgent = new EventEmitter<void>();

  agents: Agent[] = [];
  filteredAgents: Agent[] = [];
  searchTerm = '';
  isLoading = false;
  error: string | null = null;

  // Filter state
  selectedFilter: 'all' | 'system' | 'custom' = 'all';

  // MCP Edit Modal
  selectedAgentForEdit: Agent | null = null;
  isEditModalOpen = false;

  constructor(private agentService: AgentService) {}

  ngOnInit(): void {
    this.loadAgents();
  }

  loadAgents(): void {
    this.isLoading = true;
    this.error = null;

    this.agentService.getAgents().subscribe({
      next: (agents) => {
        this.agents = agents;
        this.applyFilters();
        this.isLoading = false;
        console.log('✅ [CATALOG] Loaded agents:', agents.length);
      },
      error: (error) => {
        console.error('❌ [CATALOG] Error loading agents:', error);
        this.error = 'Erro ao carregar catálogo de agentes';
        this.isLoading = false;
      }
    });
  }

  applyFilters(): void {
    let filtered = this.agents;

    // Apply search filter
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(agent =>
        (agent.title || agent.name)?.toLowerCase().includes(term) ||
        agent.description?.toLowerCase().includes(term) ||
        agent.emoji?.includes(term)
      );
    }

    // Apply type filter
    if (this.selectedFilter === 'system') {
      filtered = filtered.filter(agent => agent.isSystemDefault);
    } else if (this.selectedFilter === 'custom') {
      filtered = filtered.filter(agent => !agent.isSystemDefault);
    }

    this.filteredAgents = filtered;
  }

  onSearchChange(): void {
    this.applyFilters();
  }

  onFilterChange(filter: 'all' | 'system' | 'custom'): void {
    this.selectedFilter = filter;
    this.applyFilters();
  }

  onSelectAgent(agent: Agent): void {
    this.selectAgent.emit(agent);
  }

  onCreateAgent(): void {
    this.createAgent.emit();
  }

  getAgentType(agent: Agent): string {
    return agent.isSystemDefault ? 'Sistema' : 'Personalizado';
  }

  getAgentTypeClass(agent: Agent): string {
    return agent.isSystemDefault ? 'system-agent' : 'custom-agent';
  }

  // ==================== MCP Edit Modal ====================

  /**
   * Open MCP edit modal for an agent
   */
  editAgentMcps(agent: Agent): void {
    this.selectedAgentForEdit = agent;
    this.isEditModalOpen = true;
  }

  /**
   * Handle agent updated from modal
   */
  onAgentUpdated(updatedAgent: Agent): void {
    // Find and update the agent in the list
    const index = this.agents.findIndex(a => a.id === updatedAgent.id);
    if (index !== -1) {
      this.agents[index] = { ...this.agents[index], ...updatedAgent };
      this.applyFilters();
    }
    this.closeEditModal();
  }

  /**
   * Close the edit modal
   */
  closeEditModal(): void {
    this.isEditModalOpen = false;
    this.selectedAgentForEdit = null;
  }
}
