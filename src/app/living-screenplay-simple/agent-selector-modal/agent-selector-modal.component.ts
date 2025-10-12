import { Component, EventEmitter, Input, OnInit, Output, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgentService, Agent } from '../../services/agent.service';

export interface AgentSelectionData {
  agent: Agent;
  instanceId: string;
  cwd?: string; // Working directory for agent execution
}

@Component({
  selector: 'app-agent-selector-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-backdrop" *ngIf="isVisible" (click)="onBackdropClick()">
      <div class="modal-content" (click)="onContentClick($event)">
        <div class="modal-header">
          <h3>🤖 Selecionar Agente</h3>
          <button class="close-btn" (click)="onClose()">×</button>
        </div>

        <!-- Search bar -->
        <div class="search-container" *ngIf="!isLoading && !error">
          <input
            type="text"
            class="search-input"
            [(ngModel)]="searchQuery"
            (ngModelChange)="onSearchChange()"
            placeholder="🔍 Buscar agente por nome..."
            autofocus>
          <button *ngIf="searchQuery" class="clear-search" (click)="clearSearch()">×</button>
        </div>

        <div class="modal-body">
          <!-- Loading state -->
          <div *ngIf="isLoading" class="loading-state">
            <div class="spinner"></div>
            <p>Carregando agentes disponíveis...</p>
          </div>

          <!-- Error state -->
          <div *ngIf="error && !isLoading" class="error-state">
            <div class="error-icon">⚠️</div>
            <p>{{ error }}</p>
            <button class="retry-btn" (click)="loadAgents()">🔄 Tentar Novamente</button>
          </div>

          <!-- Agents list -->
          <div *ngIf="!isLoading && !error" class="agents-list">
            <div *ngIf="filteredAgents.length === 0 && agents.length > 0" class="empty-state">
              <div class="empty-icon">🔍</div>
              <p>Nenhum agente encontrado</p>
              <small>Tente outra busca</small>
            </div>

            <div *ngIf="agents.length === 0" class="empty-state">
              <div class="empty-icon">🤷</div>
              <p>Nenhum agente disponível</p>
              <small>Crie agentes usando o CLI do Conductor</small>
            </div>

            <div
              *ngFor="let agent of filteredAgents"
              class="agent-item"
              (click)="selectAgent(agent)"
              [title]="agent.description">
              <div class="agent-emoji">{{ agent.emoji }}</div>
              <div class="agent-info">
                <div class="agent-name">{{ agent.name }}</div>
                <div class="agent-description">{{ agent.description }}</div>
              </div>
              <div class="select-indicator">→</div>
            </div>
          </div>
        </div>

        <!-- Advanced Settings (collapsible) -->
        <div class="advanced-settings" *ngIf="!isLoading && !error">
          <button
            class="advanced-toggle"
            (click)="toggleAdvancedSettings()"
            type="button">
            <span class="toggle-icon">{{ showAdvancedSettings ? '▼' : '▶' }}</span>
            ⚙️ Configurações avançadas
          </button>

          <div class="advanced-content" *ngIf="showAdvancedSettings">
            <div class="form-group">
              <label for="cwdInput">📁 Diretório de trabalho (opcional)</label>
              <input
                id="cwdInput"
                type="text"
                class="cwd-input"
                [(ngModel)]="workingDirectory"
                placeholder="/mnt/ramdisk/projeto-exemplo"
                (keydown.enter)="$event.preventDefault()">
              <small class="help-text">Define onde o agente executará os comandos</small>
            </div>

            <div class="recent-dirs" *ngIf="recentDirectories.length > 0">
              <small class="recent-label">Diretórios recentes:</small>
              <div class="dir-chips">
                <button
                  *ngFor="let dir of recentDirectories"
                  class="dir-chip"
                  (click)="selectDirectory(dir)"
                  type="button">
                  📂 {{ dir }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer" *ngIf="!isLoading && !error && agents.length > 0">
          <button class="btn btn-secondary" (click)="onClose()">Cancelar</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1100;
      animation: fadeIn 0.2s ease;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .modal-content {
      background: white;
      border-radius: 12px;
      max-width: 600px;
      width: 90%;
      max-height: 80vh;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      display: flex;
      flex-direction: column;
      animation: slideIn 0.3s ease;
    }

    @keyframes slideIn {
      from {
        transform: translateY(-20px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px;
      border-bottom: 1px solid #eee;
      background: #f8f9fa;
      border-radius: 12px 12px 0 0;
    }

    .search-container {
      padding: 16px 20px;
      border-bottom: 1px solid #eee;
      background: white;
      position: relative;
    }

    .search-input {
      width: 100%;
      padding: 10px 40px 10px 12px;
      border: 2px solid #dee2e6;
      border-radius: 8px;
      font-size: 14px;
      outline: none;
      transition: border-color 0.2s;
    }

    .search-input:focus {
      border-color: #007bff;
    }

    .clear-search {
      position: absolute;
      right: 28px;
      top: 50%;
      transform: translateY(-50%);
      background: #6c757d;
      color: white;
      border: none;
      border-radius: 50%;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 18px;
      transition: background 0.2s;
    }

    .clear-search:hover {
      background: #545b62;
    }

    .modal-header h3 {
      margin: 0;
      color: #333;
      font-size: 18px;
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
      transition: all 0.2s;
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

    .loading-state,
    .error-state,
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px 20px;
      text-align: center;
      color: #666;
    }

    .spinner {
      border: 3px solid #f3f3f3;
      border-top: 3px solid #007bff;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin-bottom: 16px;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .error-icon,
    .empty-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }

    .retry-btn {
      margin-top: 16px;
      padding: 8px 16px;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      transition: background 0.2s;
    }

    .retry-btn:hover {
      background: #0056b3;
    }

    .agents-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .agent-item {
      display: flex;
      align-items: center;
      padding: 16px;
      border: 2px solid #dee2e6;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
      background: white;
    }

    .agent-item:hover {
      border-color: #007bff;
      background: #f8f9ff;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 123, 255, 0.15);
    }

    .agent-emoji {
      font-size: 36px;
      width: 60px;
      height: 60px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      background: #f8f9fa;
      margin-right: 16px;
      flex-shrink: 0;
    }

    .agent-info {
      flex: 1;
      min-width: 0;
    }

    .agent-name {
      font-weight: 600;
      font-size: 16px;
      color: #333;
      margin-bottom: 4px;
    }

    .agent-description {
      font-size: 13px;
      color: #666;
      line-height: 1.4;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }

    .select-indicator {
      font-size: 24px;
      color: #999;
      margin-left: 12px;
      transition: all 0.2s;
    }

    .agent-item:hover .select-indicator {
      color: #007bff;
      transform: translateX(4px);
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

    .btn {
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

    .btn-secondary:hover {
      background: #545b62;
    }

    /* Advanced Settings */
    .advanced-settings {
      border-top: 1px solid #eee;
      margin-top: 0;
    }

    .advanced-toggle {
      width: 100%;
      padding: 12px 20px;
      background: #f8f9fa;
      border: none;
      text-align: left;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      color: #495057;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: background 0.2s;
    }

    .advanced-toggle:hover {
      background: #e9ecef;
    }

    .toggle-icon {
      font-size: 10px;
      transition: transform 0.2s;
    }

    .advanced-content {
      padding: 16px 20px;
      background: #fafbfc;
      animation: slideDown 0.3s ease;
    }

    @keyframes slideDown {
      from {
        opacity: 0;
        max-height: 0;
      }
      to {
        opacity: 1;
        max-height: 300px;
      }
    }

    .form-group {
      margin-bottom: 16px;
    }

    .form-group label {
      display: block;
      margin-bottom: 6px;
      font-size: 12px;
      font-weight: 600;
      color: #495057;
    }

    .cwd-input {
      width: 100%;
      padding: 8px 12px;
      border: 2px solid #dee2e6;
      border-radius: 6px;
      font-size: 13px;
      font-family: 'Courier New', monospace;
      outline: none;
      transition: border-color 0.2s;
    }

    .cwd-input:focus {
      border-color: #007bff;
    }

    .help-text {
      display: block;
      margin-top: 4px;
      font-size: 11px;
      color: #6c757d;
    }

    .recent-dirs {
      margin-top: 12px;
    }

    .recent-label {
      display: block;
      margin-bottom: 6px;
      font-size: 11px;
      color: #6c757d;
      font-weight: 600;
    }

    .dir-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .dir-chip {
      padding: 4px 10px;
      background: white;
      border: 1px solid #dee2e6;
      border-radius: 12px;
      font-size: 11px;
      cursor: pointer;
      transition: all 0.2s;
      font-family: 'Courier New', monospace;
    }

    .dir-chip:hover {
      background: #e7f3ff;
      border-color: #007bff;
      transform: translateY(-1px);
    }
  `]
})
export class AgentSelectorModalComponent implements OnInit {
  @Input() isVisible: boolean = false;
  @Output() agentSelected = new EventEmitter<AgentSelectionData>();
  @Output() close = new EventEmitter<void>();

  agents: Agent[] = [];
  filteredAgents: Agent[] = [];
  searchQuery: string = '';
  isLoading: boolean = false;
  error: string | null = null;

  // Advanced settings
  showAdvancedSettings: boolean = false;
  workingDirectory: string = '';
  recentDirectories: string[] = [];

  constructor(private agentService: AgentService) {
    this.loadRecentDirectories();
  }

  @HostListener('document:keydown.escape')
  handleEscapeKey(): void {
    if (this.isVisible) {
      this.onClose();
    }
  }

  ngOnInit(): void {
    if (this.isVisible) {
      this.loadAgents();
    }
  }

  ngOnChanges(): void {
    // Always reload agents when modal becomes visible
    if (this.isVisible && !this.isLoading) {
      this.loadAgents();
    }
  }

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

  clearSearch(): void {
    this.searchQuery = '';
    this.onSearchChange();
  }

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

  toggleAdvancedSettings(): void {
    this.showAdvancedSettings = !this.showAdvancedSettings;
  }

  selectDirectory(dir: string): void {
    this.workingDirectory = dir;
  }

  loadRecentDirectories(): void {
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

  saveToRecentDirectories(dir: string): void {
    // Remove if already exists
    this.recentDirectories = this.recentDirectories.filter(d => d !== dir);
    // Add to beginning
    this.recentDirectories.unshift(dir);
    // Keep only last 5
    this.recentDirectories = this.recentDirectories.slice(0, 5);
    // Save to localStorage
    localStorage.setItem('agent-recent-directories', JSON.stringify(this.recentDirectories));
  }

  onClose(): void {
    this.searchQuery = '';
    this.filteredAgents = this.agents;
    this.close.emit();
  }

  onBackdropClick(): void {
    this.onClose();
  }

  onContentClick(event: Event): void {
    event.stopPropagation();
  }
}
