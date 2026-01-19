import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgentService, Agent } from '../../services/agent.service';

export type SortOption = 'name_asc' | 'name_desc' | 'created_at_asc' | 'created_at_desc';

export interface SortOptionConfig {
  value: SortOption;
  label: string;
}

export interface GroupOption {
  value: string;
  label: string;
  count?: number;
}

// Grupos disponíveis para filtro
export const AGENT_GROUPS: GroupOption[] = [
  { value: 'all', label: 'Todos' },
  { value: 'development', label: 'Desenvolvimento' },
  { value: 'crm', label: 'CRM & Vendas' },
  { value: 'documentation', label: 'Documentação' },
  { value: 'devops', label: 'DevOps' },
  { value: 'orchestration', label: 'Orquestração' },
  { value: 'testing', label: 'Testes' },
  { value: 'career', label: 'Carreira' },
  { value: 'other', label: 'Outros' },
];

@Component({
  selector: 'app-agent-catalog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './agent-catalog.component.html',
  styleUrls: ['./agent-catalog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AgentCatalogComponent implements OnInit {
  @Output() editAgent = new EventEmitter<Agent>();
  @Output() selectAgent = new EventEmitter<Agent>();
  @Output() createAgent = new EventEmitter<void>();

  agents: Agent[] = [];
  filteredAgents: Agent[] = [];
  searchQuery: string = '';
  isLoading: boolean = false;
  error: string | null = null;

  // Sorting options
  currentSort: SortOption = 'name_asc';
  sortOptions: SortOptionConfig[] = [
    { value: 'name_asc', label: 'Nome (A-Z)' },
    { value: 'name_desc', label: 'Nome (Z-A)' },
    { value: 'created_at_desc', label: 'Mais recente' },
    { value: 'created_at_asc', label: 'Mais antigo' }
  ];

  // Group filter options
  currentGroup: string = 'all';
  groupOptions: GroupOption[] = [...AGENT_GROUPS];

  constructor(
    private agentService: AgentService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadAgents();
  }

  loadAgents(): void {
    this.isLoading = true;
    this.error = null;

    this.agentService.getAgents().subscribe({
      next: (agents) => {
        this.agents = agents;
        console.log('[AgentCatalog] Loaded agents:', this.agents.length);
        this.updateGroupCounts();
        this.applyFilterAndSort();
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.error = 'Falha ao carregar agentes. Verifique se o gateway está rodando.';
        this.isLoading = false;
        this.cdr.markForCheck();
        console.error('[AgentCatalog] Error loading agents:', error);
      }
    });
  }

  onSearchChange(): void {
    this.applyFilterAndSort();
    this.cdr.markForCheck();
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.onSearchChange();
  }

  onSortChange(sortOption: SortOption): void {
    this.currentSort = sortOption;
    this.applyFilterAndSort();
    this.cdr.markForCheck();
  }

  onGroupChange(group: string): void {
    this.currentGroup = group;
    this.applyFilterAndSort();
    this.cdr.markForCheck();
  }

  private updateGroupCounts(): void {
    this.groupOptions = AGENT_GROUPS.map(group => ({
      ...group,
      count: group.value === 'all'
        ? this.agents.length
        : this.agents.filter(a => this.getAgentGroup(a) === group.value).length
    }));
  }

  private getAgentGroup(agent: Agent): string {
    return agent.group || 'other';
  }

  private applyFilterAndSort(): void {
    let result = this.agents;

    // Filtro de grupo
    if (this.currentGroup && this.currentGroup !== 'all') {
      result = result.filter(agent => this.getAgentGroup(agent) === this.currentGroup);
    }

    // Filtro de busca
    if (this.searchQuery && this.searchQuery.trim() !== '') {
      const query = this.searchQuery.toLowerCase().trim();
      result = result.filter(agent =>
        agent.name.toLowerCase().includes(query) ||
        agent.description?.toLowerCase().includes(query) ||
        agent.id.toLowerCase().includes(query) ||
        agent.emoji.includes(query)
      );
    }

    // Ordenação
    result = this.sortAgents(result);
    this.filteredAgents = result;
  }

  private sortAgents(agents: Agent[]): Agent[] {
    return [...agents].sort((a, b) => {
      switch (this.currentSort) {
        case 'name_asc':
          return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
        case 'name_desc':
          return b.name.localeCompare(a.name, 'pt-BR', { sensitivity: 'base' });
        case 'created_at_asc': {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return dateA - dateB;
        }
        case 'created_at_desc': {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return dateB - dateA;
        }
        default:
          return 0;
      }
    });
  }

  onEditAgent(agent: Agent, event: Event): void {
    event.stopPropagation(); // Prevent card click
    console.log('[AgentCatalog] Edit agent - Full object:', JSON.stringify(agent, null, 2));
    console.log('[AgentCatalog] Edit agent - ID:', agent.id);
    console.log('[AgentCatalog] Edit agent - Name:', agent.name);
    this.editAgent.emit(agent);
  }

  onSelectAgent(agent: Agent): void {
    console.log('[AgentCatalog] Select agent:', agent.id);
    this.selectAgent.emit(agent);
  }

  onCreateAgent(): void {
    console.log('[AgentCatalog] Create new agent');
    this.createAgent.emit();
  }

  trackByAgentId(index: number, agent: Agent): string {
    return agent.id;
  }

  getGroupIcon(group: string): string {
    const icons: Record<string, string> = {
      'development': '🔧',
      'crm': '📊',
      'documentation': '📝',
      'devops': '🛡️',
      'orchestration': '🎼',
      'testing': '🧪',
      'career': '💼',
      'other': '📦'
    };
    return icons[group] || '📦';
  }

  formatDate(dateStr: string | undefined): string {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return '-';
    }
  }
}
