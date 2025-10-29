import { Component, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Agent } from '../../services/agent.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-agent-catalog',
  standalone: true,
  imports: [CommonModule, FormsModule],
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

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadAgents();
  }

  loadAgents(): void {
    this.isLoading = true;
    this.error = null;

    const gatewayUrl = (environment as any).gatewayUrl || environment.apiUrl || 'http://localhost:3001';
    this.http.get<Agent[]>(`${gatewayUrl}/api/agents`).subscribe({
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
}
