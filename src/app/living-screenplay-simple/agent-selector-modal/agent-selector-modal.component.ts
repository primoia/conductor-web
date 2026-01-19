import { Component, EventEmitter, Input, OnInit, Output, ViewChild, ElementRef, AfterViewInit, SimpleChanges, OnChanges, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgentService, Agent } from '../../services/agent.service';
import { ModalHeaderComponent } from '../../shared/modals/base/modal-header.component';
import { ModalFooterComponent, ModalButton } from '../../shared/modals/base/modal-footer.component';
import { BaseModalComponent } from '../../shared/modals/base/base-modal.component';

export interface AgentSelectionData {
  agent: Agent;
  instanceId: string;
  cwd?: string; // Working directory for agent execution
}

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

// Grupos disponíveis para filtro (devem corresponder às tags group:* no backend)
export const AGENT_GROUPS: GroupOption[] = [
  { value: 'all', label: '🌐 Todos' },
  { value: 'development', label: '🔧 Desenvolvimento' },
  { value: 'crm', label: '📊 CRM & Vendas' },
  { value: 'documentation', label: '📝 Documentação' },
  { value: 'devops', label: '🛡️ DevOps' },
  { value: 'orchestration', label: '🎼 Orquestração' },
  { value: 'testing', label: '🧪 Testes' },
  { value: 'career', label: '💼 Carreira' },
  { value: 'other', label: '📦 Outros' },
];

/**
 * Modal para seleção de agentes do Conductor.
 * Permite buscar, filtrar e selecionar agentes disponíveis, com opção de configurar diretório de trabalho.
 *
 * @extends BaseModalComponent
 * ✓ Herda gerenciamento de teclado (ESC)
 * ✓ Herda gerenciamento de backdrop
 * ✓ Padronização completa aplicada
 *
 * @example
 * ```html
 * <app-agent-selector-modal
 *   [isVisible]="showModal"
 *   (agentSelected)="handleAgentSelected($event)"
 *   (closeModal)="handleClose()">
 * </app-agent-selector-modal>
 * ```
 */
@Component({
  selector: 'app-agent-selector-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalHeaderComponent, ModalFooterComponent],
  templateUrl: './agent-selector-modal.component.html',
  styleUrls: ['./agent-selector-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AgentSelectorModalComponent extends BaseModalComponent implements OnInit, AfterViewInit, OnChanges {
  @Input() override isVisible: boolean = false;
  @Input() screenplayWorkingDirectory?: string | null; // Diretorio de trabalho do screenplay
  @Input() excludeCouncilors: boolean = false; // Exclui agentes ja promovidos a conselheiros
  @Output() agentSelected = new EventEmitter<AgentSelectionData>();
  @Output() close = new EventEmitter<void>(); // Compatibilidade
  @Output() override closeModal = new EventEmitter<void>();

  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  agents: Agent[] = [];
  filteredAgents: Agent[] = [];
  searchQuery: string = '';
  isLoading: boolean = false;
  error: string | null = null;
  footerButtons: ModalButton[] = [];

  // Debounce para seleção após scroll
  private scrollDebounceTimer: any = null;
  isScrolling: boolean = false;

  // Advanced settings
  showAdvancedSettings: boolean = false;
  workingDirectory: string = '';
  recentDirectories: string[] = [];

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
  ) {
    super();
    this.loadRecentDirectories();
    this.setupFooterButtons();
  }

  /**
   * Configura os botões do footer do modal.
   * @private
   */
  private setupFooterButtons(): void {
    this.footerButtons = [
      {
        label: 'Cancelar',
        type: 'secondary',
        action: 'cancel'
      }
    ];
  }

  /**
   * Manipula ações dos botões do footer.
   * @param action - Ação disparada pelo botão
   */
  handleFooterAction(action: string): void {
    if (action === 'cancel') {
      this.onClose();
    }
  }


  ngOnInit(): void {
    if (this.isVisible) {
      this.loadAgents();
    }
  }

  ngAfterViewInit(): void {
    this.focusSearchInput();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Always reload agents when modal becomes visible
    if (changes['isVisible'] && this.isVisible && !this.isLoading) {
      this.loadAgents();

      // 📁 Preencher workingDirectory com o diretório do screenplay (se disponível)
      if (this.screenplayWorkingDirectory && !this.workingDirectory) {
        this.workingDirectory = this.screenplayWorkingDirectory;
        console.log('[AgentSelectorModal] Herdando diretório do screenplay:', this.workingDirectory);
      }

      // Focus search input when modal opens
      setTimeout(() => this.focusSearchInput(), 100);
    }

    // 📁 Atualizar workingDirectory se o diretório do screenplay mudar
    if (changes['screenplayWorkingDirectory'] && this.screenplayWorkingDirectory) {
      this.workingDirectory = this.screenplayWorkingDirectory;
      console.log('[AgentSelectorModal] Diretório do screenplay atualizado:', this.workingDirectory);
    }
  }

  /**
   * Foca o campo de busca
   * @private
   */
  private focusSearchInput(): void {
    if (this.isVisible && this.searchInput?.nativeElement) {
      this.searchInput.nativeElement.focus();
    }
  }

  /**
   * Carrega a lista de agentes disponiveis do backend.
   * Se excludeCouncilors=true, filtra agentes ja promovidos a conselheiros.
   */
  loadAgents(): void {
    this.isLoading = true;
    this.error = null;

    this.agentService.getAgents().subscribe({
      next: (agents) => {
        // Filtrar conselheiros se excludeCouncilors=true
        if (this.excludeCouncilors) {
          this.agents = agents.filter(agent => !agent.is_councilor);
          console.log(`[AgentSelectorModal] Loaded ${this.agents.length} agents (excluded councilors)`);
        } else {
          this.agents = agents;
          console.log('[AgentSelectorModal] Loaded agents:', this.agents.length);
        }
        this.updateGroupCounts(); // Atualiza contagem por grupo
        this.applyFilterAndSort(); // Aplica filtro e ordenação
        this.isLoading = false;
        this.cdr.markForCheck(); // OnPush: notificar mudança
      },
      error: (error) => {
        this.error = 'Falha ao carregar agentes. Verifique se o gateway esta rodando.';
        this.isLoading = false;
        this.cdr.markForCheck(); // OnPush: notificar mudança
        console.error('[AgentSelectorModal] Error loading agents:', error);
      }
    });
  }

  /**
   * Filtra a lista de agentes com base no texto de busca.
   */
  onSearchChange(): void {
    this.applyFilterAndSort();
    this.cdr.markForCheck(); // OnPush: notificar mudança
  }

  /**
   * Limpa o campo de busca e reseta a lista filtrada.
   */
  clearSearch(): void {
    this.searchQuery = '';
    this.onSearchChange();
  }

  /**
   * Altera a ordenação da lista de agentes.
   * @param sortOption - Opção de ordenação selecionada
   */
  onSortChange(sortOption: SortOption): void {
    this.currentSort = sortOption;
    this.applyFilterAndSort();
    this.cdr.markForCheck();
  }

  /**
   * Altera o filtro de grupo.
   * @param group - Grupo selecionado
   */
  onGroupChange(group: string): void {
    this.currentGroup = group;
    this.applyFilterAndSort();
    this.cdr.markForCheck();
  }

  /**
   * Atualiza a contagem de agentes por grupo.
   * @private
   */
  private updateGroupCounts(): void {
    // Reset counts
    this.groupOptions = AGENT_GROUPS.map(group => ({
      ...group,
      count: group.value === 'all'
        ? this.agents.length
        : this.agents.filter(a => this.getAgentGroup(a) === group.value).length
    }));
  }

  /**
   * Retorna o grupo de um agente.
   * @param agent - Agente
   * @returns O grupo do agente (ex: 'development', 'crm', etc.)
   * @private
   */
  private getAgentGroup(agent: Agent): string {
    return agent.group || 'other';
  }

  /**
   * Aplica filtro de busca, grupo e ordenação na lista de agentes.
   * @private
   */
  private applyFilterAndSort(): void {
    let result = this.agents;

    // Primeiro aplica o filtro de grupo
    if (this.currentGroup && this.currentGroup !== 'all') {
      result = result.filter(agent => this.getAgentGroup(agent) === this.currentGroup);
    }

    // Depois aplica o filtro de busca
    if (this.searchQuery && this.searchQuery.trim() !== '') {
      const query = this.searchQuery.toLowerCase().trim();
      result = result.filter(agent =>
        agent.name.toLowerCase().includes(query) ||
        agent.description?.toLowerCase().includes(query) ||
        agent.emoji.includes(query)
      );
    }

    // Por último aplica a ordenação
    result = this.sortAgents(result);
    this.filteredAgents = result;
  }

  /**
   * Ordena a lista de agentes conforme a opção selecionada.
   * @param agents - Lista de agentes a ser ordenada
   * @returns Lista ordenada
   * @private
   */
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

  /**
   * Seleciona um agente e emite o evento de seleção.
   * Não chama onClose() pois o componente pai é responsável por fechar o modal.
   * Bloqueia seleção durante scroll (debounce de 1 segundo).
   * @param agent - Agente selecionado
   */
  selectAgent(agent: Agent): void {
    // Bloqueia seleção durante scroll
    if (this.isScrolling) {
      console.log('[AgentSelectorModal] Seleção bloqueada - aguardando fim do scroll');
      return;
    }

    const instanceId = this.agentService.generateInstanceId();
    const selectionData: AgentSelectionData = {
      agent,
      instanceId,
      cwd: this.workingDirectory.trim() || undefined
    };

    // Save cwd to recent directories if provided
    if (this.workingDirectory.trim()) {
      this.saveToRecentDirectories(this.workingDirectory.trim());
    }

    console.log('[AgentSelectorModal] Agent selected:', selectionData);
    this.agentSelected.emit(selectionData);

    // Limpar estado interno mas NÃO emitir close
    // O componente pai controla o fechamento via showAgentSelector
    this.searchQuery = '';
    this.filteredAgents = this.agents;
  }

  /**
   * Alterna a visibilidade das configurações avançadas.
   */
  toggleAdvancedSettings(): void {
    this.showAdvancedSettings = !this.showAdvancedSettings;
  }

  /**
   * Seleciona um diretório da lista de recentes.
   * @param dir - Diretório a ser selecionado
   */
  selectDirectory(dir: string): void {
    this.workingDirectory = dir;
  }

  /**
   * Carrega os diretórios recentes do localStorage.
   * @private
   */
  private loadRecentDirectories(): void {
    const stored = localStorage.getItem('agent-recent-directories');
    if (stored) {
      try {
        this.recentDirectories = JSON.parse(stored);
      } catch (e) {
        console.error('Error loading recent directories:', e);
        this.recentDirectories = [];
      }
    }
  }

  /**
   * Salva um diretório na lista de recentes.
   * @param dir - Diretório a ser salvo
   * @private
   */
  private saveToRecentDirectories(dir: string): void {
    // Remove if already exists
    this.recentDirectories = this.recentDirectories.filter(d => d !== dir);
    // Add to beginning
    this.recentDirectories.unshift(dir);
    // Keep only last 5
    this.recentDirectories = this.recentDirectories.slice(0, 5);
    // Save to localStorage
    localStorage.setItem('agent-recent-directories', JSON.stringify(this.recentDirectories));
  }

  // ============================================================
  // OVERRIDES DO BASEMODALCOMPONENT
  // ============================================================

  /**
   * Fecha o modal e limpa estados.
   * Override do BaseModalComponent para adicionar limpeza de estados específicos.
   */
  override onClose(): void {
    console.log('[AgentSelectorModal] onClose() chamado');
    this.searchQuery = '';
    this.currentGroup = 'all'; // Reset filtro de grupo
    this.filteredAgents = this.agents;
    this.close.emit();      // Compatibilidade com (close)
    this.closeModal.emit(); // Padrão BaseModalComponent
    // NÃO chamar super.onClose() pois já emitimos closeModal
  }

  /**
   * Track by function para otimizar *ngFor de agentes
   */
  trackByAgentId(index: number, agent: Agent): string {
    return agent.id;
  }

  /**
   * Handler de scroll - bloqueia seleção durante scroll
   * A seleção só é liberada 1 segundo após o último scroll
   */
  onListScroll(): void {
    // Não fazer nada durante scroll para evitar change detection
    if (!this.isScrolling) {
      this.isScrolling = true;
      this.cdr.markForCheck();
    }

    // Limpa timer anterior
    if (this.scrollDebounceTimer) {
      clearTimeout(this.scrollDebounceTimer);
    }

    // Aguarda 1 segundo após o último scroll para liberar seleção
    this.scrollDebounceTimer = setTimeout(() => {
      this.isScrolling = false;
      this.cdr.markForCheck();
    }, 1000);
  }

  /**
   * Manipula clique no backdrop.
   * Override do BaseModalComponent para permitir fechamento via backdrop.
   * @param event - Evento de clique do mouse
   */
  public override onBackdropClick(event: Event): void {
    event.stopPropagation();
    this.onClose();
  }
}
