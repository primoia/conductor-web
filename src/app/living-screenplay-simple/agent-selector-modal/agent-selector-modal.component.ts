import { Component, EventEmitter, Input, OnInit, Output, ViewChild, ElementRef, AfterViewInit, SimpleChanges, OnChanges } from '@angular/core';
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
  styleUrls: ['./agent-selector-modal.component.scss']
})
export class AgentSelectorModalComponent extends BaseModalComponent implements OnInit, AfterViewInit, OnChanges {
  @Input() override isVisible: boolean = false;
  @Output() agentSelected = new EventEmitter<AgentSelectionData>();
  @Output() override closeModal = new EventEmitter<void>();

  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  agents: Agent[] = [];
  filteredAgents: Agent[] = [];
  searchQuery: string = '';
  isLoading: boolean = false;
  error: string | null = null;
  footerButtons: ModalButton[] = [];

  // Advanced settings
  showAdvancedSettings: boolean = false;
  workingDirectory: string = '';
  recentDirectories: string[] = [];

  constructor(private agentService: AgentService) {
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
      // Focus search input when modal opens
      setTimeout(() => this.focusSearchInput(), 100);
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
   * Carrega a lista de agentes disponíveis do backend.
   */
  loadAgents(): void {
    this.isLoading = true;
    this.error = null;

    this.agentService.getAgents().subscribe({
      next: (agents) => {
        this.agents = agents;
        this.filteredAgents = agents; // Initialize filtered list
        this.isLoading = false;
        console.log('[AgentSelectorModal] Loaded agents:', agents);
      },
      error: (error) => {
        this.error = 'Falha ao carregar agentes. Verifique se o gateway está rodando.';
        this.isLoading = false;
        console.error('[AgentSelectorModal] Error loading agents:', error);
      }
    });
  }

  /**
   * Filtra a lista de agentes com base no texto de busca.
   */
  onSearchChange(): void {
    if (!this.searchQuery || this.searchQuery.trim() === '') {
      this.filteredAgents = this.agents;
    } else {
      const query = this.searchQuery.toLowerCase().trim();
      this.filteredAgents = this.agents.filter(agent =>
        agent.name.toLowerCase().includes(query) ||
        agent.description?.toLowerCase().includes(query) ||
        agent.emoji.includes(query)
      );
    }
  }

  /**
   * Limpa o campo de busca e reseta a lista filtrada.
   */
  clearSearch(): void {
    this.searchQuery = '';
    this.onSearchChange();
  }

  /**
   * Seleciona um agente e emite o evento de seleção.
   * @param agent - Agente selecionado
   */
  selectAgent(agent: Agent): void {
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
    this.onClose();
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
    this.searchQuery = '';
    this.filteredAgents = this.agents;
    this.closeModal.emit();
    super.onClose();
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
