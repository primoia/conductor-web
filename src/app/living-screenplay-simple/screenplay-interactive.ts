import { Component, ViewChild, ElementRef, AfterViewInit, OnDestroy, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { CircleData, CirclePosition, CircleEvent } from '../examples/draggable-circles/draggable-circle.component';
import { InteractiveEditor } from '../interactive-editor/interactive-editor';
import { AgentExecutionService, AgentExecutionState } from '../services/agent-execution';
import { AgentCreatorComponent, AgentCreationData } from './agent-creator/agent-creator.component';
import { AgentSelectorModalComponent, AgentSelectionData } from './agent-selector-modal/agent-selector-modal.component';
import { AgentPreviewModalComponent, PreviewData, PreviewAction } from './agent-preview-modal/agent-preview-modal.component';
import { AgentService, Agent } from '../services/agent.service';
import { ConductorChatComponent } from '../shared/conductor-chat/conductor-chat.component';
import { ScreenplayService } from '../services/screenplay/screenplay.service';
import { ScreenplayStorage, Screenplay } from '../services/screenplay-storage';
import { ScreenplayManager, ScreenplayManagerEvent } from './screenplay-manager/screenplay-manager';
import { AgentGameComponent } from './agent-game/agent-game.component';
import { SaveStatusComponent } from './save-status/save-status.component';
import { FilePathInfoComponent } from './file-path-info/file-path-info.component';
import { ConflictResolutionModalComponent, ConflictResolution } from './conflict-resolution-modal/conflict-resolution-modal.component';
import { NotificationToastComponent } from './notification-toast/notification-toast.component';
import { NotificationService } from '../services/notification.service';
import { Subscription } from 'rxjs';
import { LoggingService } from '../services/logging.service';
import { environment } from '../../environments/environment';

interface AgentConfig {
  id: string;
  emoji: string;
  position: CirclePosition;
  data: CircleData;
  markdownHash?: string;
  instanceIndex?: number; // Which occurrence of the emoji (0, 1, 2...)
  textPosition?: number;  // Character position in markdown
}

interface MarkdownAgentMap {
  [markdownHash: string]: AgentConfig[];
}

interface EmojiInfo {
  emoji: string;
  count: number;
  positions: number[];
}

// Represents a unique agent instance linked to an emoji in the text
interface AgentInstance {
  id: string; // UUID v4 - anchor in Markdown and key in "database"
  agent_id?: string; // Agent ID from MongoDB (e.g., "ReadmeResume_Agent")
  emoji: string;
  definition: { title: string; description: string; unicode: string; }; // Link to AGENT_DEFINITIONS
  status: 'pending' | 'queued' | 'running' | 'completed' | 'error';
  position: CirclePosition; // XY position on screen
  executionState?: AgentExecutionState; // Link to execution service state
  is_system_default?: boolean; // SAGA-006: Flag for system default agents
  is_hidden?: boolean; // SAGA-006: Flag for hidden agents
  isDeleted?: boolean; // Soft delete flag
  deleted_at?: string; // Deletion timestamp
  config?: {
    cwd?: string; // Working directory for agent execution
    createdAt?: Date;
    updatedAt?: Date;
  };
}

// Agent definitions mapping emoji to their properties
const AGENT_DEFINITIONS: { [emoji: string]: { title: string; description: string; unicode: string; } } = {
  '🚀': { title: 'Performance Agent', description: 'Monitors application performance', unicode: '\\u{1F680}' },
  '🔐': { title: 'Auth Agent', description: 'Manages user authentication', unicode: '\\u{1F510}' },
  '📊': { title: 'Analytics Agent', description: 'Collects usage metrics', unicode: '\\u{1F4CA}' },
  '🛡️': { title: 'Security Agent', description: 'Verifies vulnerabilities', unicode: '\\u{1F6E1}' },
  '⚡': { title: 'Speed Agent', description: 'Optimizes response speed', unicode: '\\u{26A1}' },
  '🎯': { title: 'Target Agent', description: 'Focuses on specific goals', unicode: '\\u{1F3AF}' },
  '🧠': { title: 'AI Agent', description: 'AI processing', unicode: '\\u{1F9E0}' },
  '💻': { title: 'System Agent', description: 'Manages system resources', unicode: '\\u{1F4BB}' },
  '📱': { title: 'Mobile Agent', description: 'Responsive mobile interface', unicode: '\\u{1F4F1}' },
  '🌐': { title: 'Network Agent', description: 'Connectivity and network', unicode: '\\u{1F310}' },
  '🔍': { title: 'Search Agent', description: 'Search and indexing', unicode: '\\u{1F50D}' },
  '🎪': { title: 'Entertainment Agent', description: 'Entertainment and gamification', unicode: '\\u{1F3AA}' },
  '🏆': { title: 'Achievement Agent', description: 'Achievements and awards', unicode: '\\u{1F3C6}' },
  '🔮': { title: 'Prediction Agent', description: 'Predictions and trends', unicode: '\\u{1F52E}' },
  '💎': { title: 'Premium Agent', description: 'Premium resources', unicode: '\\u{1F48E}' },
  '⭐': { title: 'Star Agent', description: 'Reviews and favorites', unicode: '\\u{2B50}' },
  '🌟': { title: 'Featured Agent', description: 'Special highlights', unicode: '\\u{1F31F}' },
  '🧪': { title: 'Test Agent', description: 'Runs automated tests and validations', unicode: '\\u{1F9EA}' },
  '📄': { title: 'README Resume Agent', description: 'Analyzes and summarizes README files', unicode: '\\u{1F4C4}' }
};

@Component({
  selector: 'app-screenplay-interactive',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    InteractiveEditor,
    AgentCreatorComponent,
    AgentSelectorModalComponent,
    AgentPreviewModalComponent,
    ConductorChatComponent,
    ScreenplayManager,
    AgentGameComponent,
    SaveStatusComponent,
    FilePathInfoComponent,
    ConflictResolutionModalComponent,
    NotificationToastComponent
  ],
  templateUrl: './screenplay-interactive.html',
  styleUrls: [
    './screenplay-layout.css',
    './screenplay-controls.css',
    './screenplay-agents.css',
    './screenplay-popup.css',
    './screenplay-animations.css'
  ]
})
export class ScreenplayInteractive implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvas!: ElementRef;
  @ViewChild(InteractiveEditor) private interactiveEditor!: InteractiveEditor;
  @ViewChild(ConductorChatComponent) conductorChat!: ConductorChatComponent;
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('agentGame') agentGame!: AgentGameComponent;

  // Splitter state
  screenplayWidth = 70;
  chatWidth = 30;
  private isDraggingSplitter = false;

  // Estado da aplicação
  agents: AgentConfig[] = [];
  availableEmojis: EmojiInfo[] = [];
  currentView: 'clean' | 'agents' | 'full' = 'full';
  currentFileName = '';

  // Screenplay state (MongoDB integration)
  currentScreenplay: Screenplay | null = null;
  isDirty = false;
  isSaving = false;
  showScreenplayManager = false;

  // SAGA-005: New state management for file synchronization
  sourceOrigin: 'database' | 'disk' | 'new' = 'new';
  sourceIdentifier: string | null = null;

  // URL state management
  private pendingScreenplayId: string | null = null;
  isLoading = false;

  // Estado do popup
  popupVisible = false;
  popupX = 0;
  popupY = 0;
  popupText = '';

  // Estado do modal
  showAgentCreator = false;
  showAgentSelector = false;
  showAgentPreview = false;
  previewData: PreviewData | null = null;
  previewLoading = false;
  previewError: string | null = null;

  // Export modal state
  showExportModal = false;
  exportFilename = '';

  // Screenplay info modal state
  showScreenplayInfoModal = false;

  // Working Directory modal state
  showWorkingDirModal = false;
  tempWorkingDirectory = '';
  currentWorkingDirectory: string | null = null;
  showScreenplaySettings = false;

  // UI Enhancement: Conflict resolution modal
  showConflictModal = false;
  conflictExistingScreenplay: Screenplay | null = null;
  conflictNewContent: string = '';
  conflictNewFileName: string = '';

  // UI Enhancement: Save status tracking
  lastSavedAt: Date | null = null;
  saveError: string | null = null;

  // Delete confirmation modal state
  showDeleteConfirmModal = false;
  agentToDelete: AgentInstance | null = null;

  // Text selection context for agent execution
  private selectedText: string = '';
  private selectedTextRange: { start: number; end: number } | null = null;
  private activeAgentForExecution: AgentInstance | null = null;

  // Persistência
  markdownAgentMap: MarkdownAgentMap = {};

  // Timeout para debounce
  private updateTimeout: any;
  private autoSaveTimeout: any;
  
  // Auto-save configuration
  private readonly AUTO_SAVE_DELAY = 3000; // 3 segundos
  private autoSaveEnabled = true;

  // Simulates MongoDB 'agent_instances' collection
  private agentInstances = new Map<string, AgentInstance>();

  // Agent execution service integration
  private agentStateSubscription?: Subscription;
  public selectedAgent: AgentInstance | null = null;

  // Task polling for agent movement
  private taskPollingInterval?: any;

  // Agent Dock properties
  public contextualAgents: AgentInstance[] = [];
  public activeAgentId: string | null = null;

  // BUG FIX: Conteúdo do editor padrão agora é vazio para evitar agentes fantasma
  // Quando um novo screenplay é criado, o agente padrão é adicionado automaticamente
  editorContent = '';

  constructor(
    private agentExecutionService: AgentExecutionService,
    private screenplayService: ScreenplayService,
    private agentService: AgentService,
    private screenplayStorage: ScreenplayStorage,
    private route: ActivatedRoute,
    private router: Router,
    private logging: LoggingService,
    private http: HttpClient,
    private notificationService: NotificationService
  ) {
    // Create specialized loggers for different contexts
    this.logger = this.logging.createChildLogger('ScreenplayInteractive');
    this.agentLogger = this.logging.createChildLogger('ScreenplayInteractive.AgentManager');
    this.fileLogger = this.logging.createChildLogger('ScreenplayInteractive.FileManager');
    this.apiLogger = this.logging.createChildLogger('ScreenplayInteractive.API');

    // Subscribe to agent execution state changes
    this.agentStateSubscription = this.agentExecutionService.agentState$.subscribe(
      (agentStates) => this.updateAgentInstancesWithExecutionState(agentStates)
    );

    // Load agent definitions from MongoDB
    this.loadAgentDefinitions();
  }

  // Specialized loggers for different contexts
  private logger: LoggingService;
  private agentLogger: LoggingService;
  private fileLogger: LoggingService;
  private apiLogger: LoggingService;

  private loadAgentDefinitions(): void {
    this.agentService.getAgents().subscribe({
      next: (agents) => {
        agents.forEach(agent => {
          if (!AGENT_DEFINITIONS[agent.emoji]) {
            AGENT_DEFINITIONS[agent.emoji] = {
              title: agent.name,
              description: agent.description,
              unicode: agent.emoji.codePointAt(0)?.toString(16) || ''
            };
          }
        });
        this.logging.info(`✅ ${Object.keys(AGENT_DEFINITIONS).length} emojis carregados no AGENT_DEFINITIONS`, 'ScreenplayInteractive');
      },
      error: (error) => {
        this.logging.error('❌ Erro ao carregar definições de agentes:', error, 'ScreenplayInteractive');
      }
    });
  }

  /**
   * SAGA-006: Salva o roteiro antes de criar a instância do agente
   * Usado quando o roteiro ainda não foi salvo (não tem ID)
   */
  private _saveScreenplayIfNeeded(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (this.currentScreenplay?.id) {
        if (this.isDirty) {
          this.saveCurrentScreenplay(); // Save if dirty
        }
        resolve(this.currentScreenplay.id);
        return;
      }

      this.logging.info('💾 [AUTO-SAVE] Roteiro não existe, criando um novo...', 'ScreenplayInteractive');
      const content = this.generateMarkdownForSave();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const defaultName = `novo-roteiro-${timestamp}`;

      this.screenplayStorage.createScreenplay({
        name: defaultName,
        content: content,
        description: `Criado automaticamente em ${new Date().toLocaleDateString()}`
      }).subscribe({
        next: (newScreenplay) => {
          this.logging.info(`✅ [AUTO-SAVE] Roteiro criado: ${newScreenplay.id}`, 'ScreenplayInteractive');
          this.sourceOrigin = 'database';
          this.sourceIdentifier = newScreenplay.id;
          this.currentScreenplay = newScreenplay;
          this.isDirty = false;
          resolve(newScreenplay.id);
        },
        error: (error) => {
          this.logging.error('❌ [AUTO-SAVE] Falha ao criar roteiro:', error, 'ScreenplayInteractive');
          alert('Falha ao salvar o roteiro. Tente novamente.');
          reject(error);
        }
      });
    });
  }


  private async _createAgentInstanceInMongoDB(
    instanceId: string,
    agentId: string,
    position: CirclePosition,
    options: { cwd?: string; isSystemDefault: boolean }
  ): Promise<void> {
    const { cwd, isSystemDefault } = options;
    const logPrefix = isSystemDefault ? '[DEFAULT AGENT]' : '[SCREENPLAY]';

    try {
      const screenplayId = await this._saveScreenplayIfNeeded();

      // Get the instance from memory to include emoji and definition
      const instance = this.agentInstances.get(instanceId);
      
      const baseUrl = this.agentService['baseUrl'] || '';
      const payload: any = {
        instance_id: instanceId,
        agent_id: agentId,
        position: position,
        created_at: new Date().toISOString(),
        is_system_default: isSystemDefault,
        is_hidden: false,
        screenplay_id: screenplayId,
        emoji: instance?.emoji || '🎬', // BUG FIX: Include emoji
        definition: instance?.definition || { // BUG FIX: Include definition
          title: 'Assistente de Roteiro',
          description: 'Agente especializado em ajudar com roteiros',
          unicode: '\\u{1F3AC}'
        }
      };

      if (cwd) {
        payload.cwd = cwd;
      }
      
      this.logging.info(`💾 ${logPrefix} Criando instância no MongoDB:`, 'ScreenplayInteractive', payload);

      const response = await fetch(`${baseUrl}/api/agents/instances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        this.logging.info(`✅ ${logPrefix} Instância criada no MongoDB com sucesso`, 'ScreenplayInteractive');
      } else {
        this.logging.warn(`⚠️ ${logPrefix} Falha ao criar instância no MongoDB:`, 'ScreenplayInteractive', response.status);
      }
    } catch (error) {
      this.logging.error(`❌ ${logPrefix} Erro ao criar instância no MongoDB:`, error, 'ScreenplayInteractive');
    }
  }


  private createAgentInstanceInMongoDB(instanceId: string, agentId: string, position: CirclePosition, cwd?: string): void {
    this._createAgentInstanceInMongoDB(instanceId, agentId, position, { cwd, isSystemDefault: false });
  }

  /**
   * SAGA-006: Create default agent instance in MongoDB
   */
  private createDefaultAgentInstanceInMongoDB(instanceId: string, agentId: string, position: CirclePosition): void {
    this._createAgentInstanceInMongoDB(instanceId, agentId, position, { isSystemDefault: true });
  }

  /**
   * SAGA-006: Update agent in MongoDB
   */
  private updateAgentInMongoDB(instanceId: string, updates: any): void {
    const baseUrl = this.agentService['baseUrl'] || 'http://localhost:5006';
    
    fetch(`${baseUrl}/api/agents/instances/${instanceId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates)
    })
      .then(response => {
        if (response.ok) {
          this.logging.info('✅ [MONGODB] Agent updated successfully', 'ScreenplayInteractive');
        } else {
          this.logging.warn('⚠️ [MONGODB] Failed to update agent:', 'ScreenplayInteractive', response.status);
        }
      })
      .catch(error => {
        this.logging.error('❌ [MONGODB] Error updating agent:', error, 'ScreenplayInteractive');
      });
  }

  /**
   * SAGA-006: Delete agent (for non-system agents)
   */
  deleteAgent(instanceId: string): void {
    this.logging.info('🗑️ [DELETE AGENT] Deleting agent:', 'ScreenplayInteractive', instanceId);
    
    const agent = this.agentInstances.get(instanceId);
    if (!agent) {
      this.logging.warn('⚠️ [DELETE AGENT] Agent not found:', 'ScreenplayInteractive', instanceId);
      return;
    }
    
    // Remove from memory
    this.agentInstances.delete(instanceId);

    // Update UI
    this.updateLegacyAgentsFromInstances();
    this.updateAvailableEmojis();
    this.updateAgentDockLists();

    // Delete from MongoDB
    this.deleteAgentFromMongoDB(instanceId);

    // Remove from agent game map
    if (this.agentGame) {
      this.agentGame.removeAgent(instanceId);
      this.logging.info('🎮 [AGENT-GAME] Agent removed from map', 'ScreenplayInteractive');
    }

    this.logging.info('✅ [DELETE AGENT] Agent deleted successfully', 'ScreenplayInteractive');
  }

  /**
   * SAGA-006: Delete agent from MongoDB
   */
  private deleteAgentFromMongoDB(instanceId: string): void {
    const baseUrl = this.agentService['baseUrl'] || 'http://localhost:5006';
    
    fetch(`${baseUrl}/api/agents/instances/${instanceId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      }
    })
      .then(response => {
        if (response.ok) {
          this.logging.info('✅ [MONGODB] Agent deleted successfully', 'ScreenplayInteractive');
        } else {
          this.logging.warn('⚠️ [MONGODB] Failed to delete agent:', 'ScreenplayInteractive', response.status);
        }
      })
      .catch(error => {
        this.logging.error('❌ [MONGODB] Error deleting agent:', error, 'ScreenplayInteractive');
      });
  }

  ngOnInit(): void {
    // Subscribe to URL query parameter changes
    this.route.queryParamMap.subscribe(params => {
      const screenplayId = params.get('screenplayId');
      
      // Prevent reload if ID hasn't changed
      if (screenplayId === this.currentScreenplay?.id) {
        return;
      }
      
      // Check for unsaved changes before loading new screenplay
      if (this.isDirty && screenplayId !== this.currentScreenplay?.id) {
        const confirmed = confirm(
          'Você tem alterações não salvas. Deseja descartá-las e carregar um novo screenplay?'
        );
        if (!confirmed) {
          // Revert URL to current screenplay
          this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { screenplayId: this.currentScreenplay?.id || null },
            replaceUrl: true
          });
          return;
        }
      }
      
      this.pendingScreenplayId = screenplayId;
    });

    // Listen for force save events from chat
    document.addEventListener('forceSaveScreenplay', this.handleForceSaveScreenplay);
  }

  ngAfterViewInit(): void {
    // Load instances from MongoDB
    this.loadInstancesFromMongoDB();

    // Configure file input to accept only .md files
    this.updateFileInput();

    // Define conteúdo inicial no editor, que disparará o evento de sincronização automaticamente
    setTimeout(() => {
      if (this.pendingScreenplayId) {
        // Load screenplay from URL
        this.loadScreenplayById(this.pendingScreenplayId);
        this.pendingScreenplayId = null;
      } else {
        // Load default content
        this.interactiveEditor.setContent(this.editorContent, true);
      }
      // Inicializa o ScreenplayService com a instância do editor TipTap
      this.screenplayService.initialize(this.interactiveEditor.getEditor());
    }, 0);

    // Initialize agent dock lists
    this.updateAgentDockLists();

    // Start polling for tasks to update agent movement
    this.startTaskPolling();
  }

  ngOnDestroy(): void {
    if (this.agentStateSubscription) {
      this.agentStateSubscription.unsubscribe();
    }

    // Stop task polling
    if (this.taskPollingInterval) {
      clearInterval(this.taskPollingInterval);
    }

    // Remove force save event listener
    document.removeEventListener('forceSaveScreenplay', this.handleForceSaveScreenplay);
  }

  private handleForceSaveScreenplay = (event: any) => {
    const screenplayId = event.detail?.screenplayId;
    if (screenplayId && this.isDirty && this.currentScreenplay?.id === screenplayId) {
      this.logging.info('💾 [SCREENPLAY] Forçando salvamento antes do envio da mensagem...', 'ScreenplayInteractive');
      this.save();
    }
  };

  // === Screenplay Management (MongoDB Integration) ===

  /**
   * SAGA-005 v2: Clear chat state when loading new screenplay
   */
  private clearChatState(): void {
    this.logging.info('🧹 [CHAT] Clearing chat state for new screenplay', 'ScreenplayInteractive');
    
    // Clear selected agent
    this.selectedAgent = null;
    
    // Clear chat context if conductorChat is available
    if (this.conductorChat) {
      this.conductorChat.clear();
    }
    
    this.logging.info('✅ [CHAT] Chat state cleared', 'ScreenplayInteractive');
  }

  /**
   * SAGA-005: Create a new screenplay - clears editor and resets state
   */
  newScreenplay(): void {
    this.logging.info('📝 [NEW] Creating new screenplay', 'ScreenplayInteractive');
    
    // Clear editor content
    this.editorContent = '';
    this.interactiveEditor.setContent('', true);
    
    // Reset state
    this.sourceOrigin = 'new';
    this.sourceIdentifier = null;
    this.isDirty = false;
    this.currentScreenplay = null;
    this.currentFileName = '';
    
    // Clear agents
    this.agentInstances.clear();
    this.agents = [];
    this.updateLegacyAgentsFromInstances();
    this.updateAvailableEmojis();
    
    // SAGA-005 v2: Clear chat when creating new screenplay
    this.clearChatState();
    
    this.logging.info('✅ [NEW] New screenplay created', 'ScreenplayInteractive');
  }

  /**
   * SAGA-006: Create a new screenplay with default agent - creates screenplay and instantiates default agent
   */
  async newScreenplayWithDefaultAgent(): Promise<void> {
    try {
      this.logging.info('📝 [NEW] Creating new screenplay with default agent', 'ScreenplayInteractive');

      // Ensure current screenplay is saved before creating new one
      await this.ensureCurrentScreenplaySaved();

      // Clear editor content
      this.editorContent = '';
      this.interactiveEditor.setContent('', true);

      // Clear agents
      this.agentInstances.clear();
      this.agents = [];
      this.updateLegacyAgentsFromInstances();
      this.updateAvailableEmojis();

      // SAGA-005 v2: Clear chat when creating new screenplay
      this.clearChatState();

      // Create new screenplay in database immediately
      await this.createNewScreenplayImmediately();

      this.logging.info('✅ [NEW] New screenplay with default agent created', 'ScreenplayInteractive');
    } catch (error) {
      this.logging.error('❌ [NEW] Error creating new screenplay:', error, 'ScreenplayInteractive');
      this.notificationService.showError('Erro ao criar novo roteiro. Verifique o console.');
      throw error;
    }
  }

  /**
   * Generate automatic screenplay name with timestamp
   */
  private generateScreenplayName(): string {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 19).replace(/[:.]/g, '-');
    return `Novo Roteiro ${dateStr}`;
  }

  /**
   * Schedule auto-save with debounce
   */
  private scheduleAutoSave(): void {
    if (!this.autoSaveEnabled || this.sourceOrigin !== 'database') {
      return;
    }

    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
    }
    
    this.autoSaveTimeout = window.setTimeout(() => {
      if (this.isDirty && this.currentScreenplay) {
        this.save();
      }
    }, this.AUTO_SAVE_DELAY);
  }

  /**
   * Ensure current screenplay is saved before transitions
   */
  private async ensureCurrentScreenplaySaved(): Promise<void> {
    if (this.isDirty && this.currentScreenplay && this.sourceOrigin === 'database') {
      await this.save();
    }
  }

  /**
   * Validate markdown file
   */
  private validateMarkdownFile(file: File): boolean {
    if (!file.name.endsWith('.md')) {
      this.showError('Apenas arquivos .md são aceitos');
      return false;
    }
    
    // Validação adicional de conteúdo se necessário
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      this.showError('Arquivo muito grande. Tamanho máximo: 10MB');
      return false;
    }
    
    return true;
  }

  /**
   * Show error message to user
   */
  private showError(message: string): void {
    alert(message); // TODO: Replace with proper modal component
  }

  /**
   * Update file input to accept only .md files
   */
  private updateFileInput(): void {
    const fileInput = this.fileInput?.nativeElement;
    if (fileInput) {
      fileInput.accept = '.md';
    }
  }

  /**
   * Generate file key for duplicate detection
   */
  private generateFileKey(filePath: string, fileName: string): string {
    const keyData = `${filePath}:${fileName}`;
    return btoa(keyData).replace(/[^a-zA-Z0-9]/g, '');
  }

  /**
   * Check for duplicates using file key
   */
  private async checkForDuplicates(filePath: string, fileName: string): Promise<Screenplay | null> {
    const fileKey = this.generateFileKey(filePath, fileName);
    try {
      const result = await this.screenplayStorage.getByFileKey(fileKey).toPromise();
      return result || null;
    } catch (error) {
      this.logging.error('Error checking for duplicates:', error, 'ScreenplayInteractive');
      return null;
    }
  }

  /**
   * Handle duplicate detection and resolution
   */
  private async handleDuplicateDetection(existingScreenplay: Screenplay, newContent: string, fileName: string): Promise<void> {
    if (existingScreenplay.content === newContent) {
      this.logging.info('🔄 [DUPLICATE] Same content detected, loading existing screenplay', 'ScreenplayInteractive');
      this.loadScreenplayIntoEditor(existingScreenplay);
    } else {
      this.logging.warn('⚠️ [DUPLICATE] Different content detected, showing conflict resolution', 'ScreenplayInteractive');
      this.showDuplicateResolutionModal(existingScreenplay, newContent, fileName);
    }
  }

  /**
   * Show duplicate resolution modal (UI Enhancement)
   */
  private showDuplicateResolutionModal(existingScreenplay: Screenplay, newContent: string, fileName: string): void {
    this.conflictExistingScreenplay = existingScreenplay;
    this.conflictNewContent = newContent;
    this.conflictNewFileName = fileName;
    this.showConflictModal = true;
  }

  /**
   * Handle conflict resolution from modal
   */
  handleConflictResolution(resolution: ConflictResolution): void {
    if (!this.conflictExistingScreenplay) return;

    switch (resolution.action) {
      case 'overwrite':
        this.overwriteExistingScreenplay(this.conflictExistingScreenplay.id, this.conflictNewContent);
        this.notificationService.showSuccess('Roteiro sobrescrito com sucesso');
        break;

      case 'keep-existing':
        this.loadScreenplayIntoEditor(this.conflictExistingScreenplay);
        this.notificationService.showInfo('Roteiro existente carregado');
        break;

      case 'rename':
        if (resolution.newName) {
          this.createAndLinkScreenplayAutomatically(this.conflictNewContent, resolution.newName);
          this.notificationService.showSuccess(`Roteiro criado com o nome "${resolution.newName}"`);
        }
        break;

      case 'cancel':
        this.notificationService.showInfo('Importação cancelada');
        break;
    }

    // Reset conflict state
    this.showConflictModal = false;
    this.conflictExistingScreenplay = null;
    this.conflictNewContent = '';
    this.conflictNewFileName = '';
  }

  /**
   * Overwrite existing screenplay with new content
   */
  private overwriteExistingScreenplay(screenplayId: string, newContent: string): void {
    this.screenplayStorage.updateScreenplay(screenplayId, {
      content: newContent
    }).subscribe({
      next: (updatedScreenplay) => {
        this.logging.info('✅ [OVERWRITE] Screenplay updated successfully', 'ScreenplayInteractive');
        this.loadScreenplayIntoEditor(updatedScreenplay);
      },
      error: (error) => {
        this.logging.error('❌ [OVERWRITE] Failed to update screenplay:', error, 'ScreenplayInteractive');
        this.showError('Falha ao sobrescrever roteiro existente');
      }
    });
  }

  /**
   * Show rename modal for current screenplay
   */
  showRenameModal(): void {
    if (!this.currentScreenplay) {
      this.showError('Nenhum roteiro carregado para renomear');
      return;
    }

    const newName = prompt('Novo nome do roteiro:', this.currentScreenplay.name);
    if (newName && newName.trim() && newName !== this.currentScreenplay.name) {
      this.renameCurrentScreenplay(newName.trim());
    }
  }

  /**
   * Rename current screenplay
   */
  private renameCurrentScreenplay(newName: string): void {
    if (!this.currentScreenplay) {
      return;
    }

    // Check if name already exists
    this.screenplayStorage.nameExists(newName).subscribe({
      next: (exists) => {
        if (exists) {
          this.showError(`O nome "${newName}" já existe. Escolha outro nome.`);
          return;
        }

        // Proceed with rename
        this.screenplayStorage.updateScreenplay(this.currentScreenplay!.id, {
          name: newName
        }).subscribe({
          next: (updatedScreenplay) => {
            this.logging.info('✅ [RENAME] Screenplay renamed successfully', 'ScreenplayInteractive');
            this.currentScreenplay = updatedScreenplay;
            this.logging.info(`✅ [RENAME] Renamed to: ${newName}`, 'ScreenplayInteractive');
          },
          error: (error) => {
            this.logging.error('❌ [RENAME] Failed to rename screenplay:', error, 'ScreenplayInteractive');
            this.showError('Falha ao renomear roteiro');
          }
        });
      },
      error: (error) => {
        this.logging.error('❌ [RENAME] Failed to check name existence:', error, 'ScreenplayInteractive');
        this.showError('Falha ao verificar disponibilidade do nome');
      }
    });
  }

  /**
   * Ensure unique name by checking against existing screenplays
   */
  private async ensureUniqueName(baseName: string): Promise<string> {
    let name = baseName;
    let counter = 1;

    try {
      // Check if name exists by trying to find screenplays with similar names
      // API limit is max 100, so we use that
      const existingScreenplays = await this.screenplayStorage.getScreenplays('', 1, 100).toPromise();
      if (existingScreenplays?.items) {
        while (existingScreenplays.items.some(s => s.name === name)) {
          const nameWithoutExt = baseName.replace('.md', '');
          name = `${nameWithoutExt}-${counter}`;
          counter++;
        }
      }
    } catch (error) {
      // If the API call fails, just use the base name with a timestamp to ensure uniqueness
      this.logging.warn('⚠️ [UNIQUE] Failed to check existing names, using timestamp fallback', 'ScreenplayInteractive', error);
      const timestamp = new Date().getTime();
      const nameWithoutExt = baseName.replace('.md', '');
      name = `${nameWithoutExt}-${timestamp}`;
    }

    return name;
  }

  /**
   * Create new screenplay in database immediately and update URL
   */
  private async createNewScreenplayImmediately(): Promise<void> {
    const baseName = this.generateScreenplayName();
    const uniqueName = await this.ensureUniqueName(baseName);
    
    this.logging.info(`💾 [IMMEDIATE] Creating new screenplay immediately: ${uniqueName}`, 'ScreenplayInteractive');
    
    this.screenplayStorage.createScreenplay({
      name: uniqueName,
      content: '',
      description: `Criado em ${new Date().toLocaleDateString()}`
    }).subscribe({
      next: (newScreenplay) => {
        this.logging.info(`✅ [IMMEDIATE] Screenplay created: ${newScreenplay.id}`, 'ScreenplayInteractive');
        
        // Update state to database-linked
        this.sourceOrigin = 'database';
        this.sourceIdentifier = newScreenplay.id;
        this.currentScreenplay = newScreenplay;
        this.isDirty = false;
        this.currentFileName = '';
        
        // Update URL with new screenplay ID
        this.updateUrlWithScreenplayId(newScreenplay.id);
        
        // SAGA-006: Wait for editor to be ready, then create default agent instance
        setTimeout(async () => {
          await this.createDefaultAgentInstance();
        }, 100);
        
        this.logging.info(`✅ [IMMEDIATE] Screenplay linked to editor and URL updated: ${newScreenplay.name}`, 'ScreenplayInteractive');
      },
      error: (error) => {
        this.logging.error('❌ [IMMEDIATE] Failed to create screenplay:', error, 'ScreenplayInteractive');
        alert(`Falha ao criar roteiro: ${error.message || 'Erro desconhecido'}`);
        
        // Fallback: set as new (not saved)
        this.sourceOrigin = 'new';
        this.sourceIdentifier = null;
        this.currentScreenplay = null;
        this.isDirty = false;
        this.currentFileName = '';
      }
    });
  }

  async openScreenplayManager(): Promise<void> {
    // Ensure current screenplay is saved before opening manager
    await this.ensureCurrentScreenplaySaved();
    
    this.showScreenplayManager = true;
  }

  closeScreenplayManager(): void {
    this.showScreenplayManager = false;
  }

  onScreenplayManagerAction(event: ScreenplayManagerEvent): void {
    this.logging.info('📝 Screenplay manager action:', 'ScreenplayInteractive', event.action);

    switch (event.action) {
      case 'open':
        if (event.screenplay) {
          this.logging.info('🔄 [OPEN] Loading screenplay from database:', 'ScreenplayInteractive', event.screenplay.name);
          this.loadScreenplayIntoEditor(event.screenplay);
          this.updateUrlWithScreenplayId(event.screenplay.id);
          // Auto-selection will be handled by loadInstancesFromMongoDB when agents are loaded
        }
        break;
      case 'create':
        if (event.screenplay) {
          this.loadScreenplayIntoEditor(event.screenplay);
          this.updateUrlWithScreenplayId(event.screenplay.id);
          // SAGA-006: Wait for editor to be ready, then create default agent for new screenplay
          setTimeout(async () => {
            await this.createDefaultAgentInstance();
          }, 100);
        }
        break;
      case 'delete':
        // When a screenplay is deleted, clear the current content and agents
        this.logging.info('🗑️ [DELETE] Screenplay deleted, clearing content and agents', 'ScreenplayInteractive');
        this.loadDefaultContent();
        this.clearInvalidUrl();
        break;
      case 'import':
        if (event.screenplay) {
          this.logging.info('📥 [IMPORT] Importing screenplay from disk:', 'ScreenplayInteractive', event.screenplay.name);
          this.loadScreenplayIntoEditor(event.screenplay);
          // The screenplay will be automatically saved to MongoDB by the existing save logic
        }
        break;
    }
  }

  private updateUrlWithScreenplayId(id: string): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { screenplayId: id },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  // === Disk File Operations ===

  /**
   * SAGA-005 v2: Import markdown file from disk with automatic MongoDB creation
   * Files are automatically saved to MongoDB unless there's a conflict
   */
  async importFromDisk(): Promise<void> {
    // Ensure current screenplay is saved before importing
    await this.ensureCurrentScreenplaySaved();
    
    this.fileInput.nativeElement.click();
  }

  /**
   * Handle file selection from disk
   * SAGA-005 v2: Implements automatic MongoDB creation with conflict detection
   */
  handleFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      
      // Validate file before processing
      if (!this.validateMarkdownFile(file)) {
        return;
      }
      
      const reader = new FileReader();

      reader.onload = (e) => {
        const content = e.target?.result as string;
        const filename = file.name.replace(/\.md$/, ''); // Remove .md extension

        this.logging.info('📂 [DISK] Arquivo lido do disco:', 'ScreenplayInteractive', {
          name: file.name,
          size: content.length,
          preview: content.substring(0, 100)
        });

        // Use new duplicate detection system
        this.logging.info('🔍 [DUPLICATE] Starting duplicate detection...', 'ScreenplayInteractive');
        this.checkForDuplicates(file.name, filename).then(existingScreenplay => {
          if (existingScreenplay) {
            this.logging.info('⚠️ [DUPLICATE] Duplicate detected, handling resolution...', 'ScreenplayInteractive');
            this.handleDuplicateDetection(existingScreenplay, content, filename);
          } else {
            this.logging.info('✅ [DUPLICATE] No duplicates found, creating new screenplay', 'ScreenplayInteractive');
            this.createAndLinkScreenplayAutomatically(content, filename);
          }
        }).catch(error => {
          this.logging.error('❌ [DUPLICATE] Error checking for duplicates:', error, 'ScreenplayInteractive');
          // Fallback: create automatically
          this.createAndLinkScreenplayAutomatically(content, filename);
        });
      };

      reader.onerror = (error) => {
        this.logging.error('❌ Erro ao ler arquivo:', error, 'ScreenplayInteractive');
        alert('Falha ao carregar o arquivo. Tente novamente.');
      };

      reader.readAsText(file);

      // Reset input to allow reloading the same file
      input.value = '';
    }
  }


  /**
   * SAGA-005 v2: Load content as new screenplay (fallback method)
   */
  private loadAsNewScreenplay(content: string, filename: string): void {
    this.logging.info(`📄 [NEW] Loading as new screenplay: ${filename}`, 'ScreenplayInteractive');

    // Clear previous state
    this.agentInstances.clear();
    this.agents = [];
    this.currentScreenplay = null;
    this.isDirty = false;
    this.currentFileName = '';

    // SAGA-005 v2: Clear chat when loading new screenplay
    this.clearChatState();
    
    // Reload agents in the game component
    this.reloadAgentGame();

    // Set state for new screenplay
    this.sourceOrigin = 'new';
    this.sourceIdentifier = filename;

    // Load content into editor
    this.editorContent = content;
    this.interactiveEditor.setContent(content, true);

    this.logging.info(`✅ [NEW] New screenplay loaded: ${filename}`, 'ScreenplayInteractive');
  }

  /**
   * Create screenplay in MongoDB automatically and link to editor
   * No confirmation needed for new files
   */
  private createAndLinkScreenplayAutomatically(content: string, filename: string): void {
    this.logging.info(`💾 [AUTO] Criando roteiro automaticamente no banco: ${filename}`, 'ScreenplayInteractive', {
      name: filename,
      contentLength: content.length,
      preview: content.substring(0, 100)
    });

    // Clean filename - remove .md extension if present and sanitize
    const cleanFilename = filename.replace(/\.md$/, '').replace(/[^a-zA-Z0-9\-_]/g, '-');
    this.logging.debug(`   - Nome limpo: ${cleanFilename}`, 'ScreenplayInteractive');

    // Validate filename
    if (!cleanFilename || cleanFilename.length === 0) {
      this.logging.error('❌ [AUTO] Nome de arquivo inválido após limpeza', null, 'ScreenplayInteractive');
      this.loadAsNewScreenplay(content, 'arquivo-importado');
      return;
    }

    // Generate file key for duplicate detection
    const fileKey = this.generateFileKey(filename, cleanFilename);

    this.screenplayStorage.createScreenplay({
      name: cleanFilename,
      content: content,
      description: `Importado do disco em ${new Date().toLocaleDateString()}`,
      fileKey: fileKey,
      importPath: filename
    }).subscribe({
      next: (newScreenplay) => {
        this.logging.info(`✅ [AUTO] Roteiro criado: ${newScreenplay.id}`, 'ScreenplayInteractive', {
          nameInDb: newScreenplay.name,
          contentLength: newScreenplay.content?.length || 0
        });
        this.logging.info('📄 [AUTO] Carregando conteúdo do disco no editor...', 'ScreenplayInteractive');

        // CRITICAL: Always use disk content in editor (backend might return empty)
        const screenplayWithDiskContent: Screenplay = {
          id: newScreenplay.id,
          name: newScreenplay.name,
          content: content,  // Always use disk content
          description: newScreenplay.description || '',
          tags: newScreenplay.tags || [],
          version: newScreenplay.version || 1,
          createdAt: newScreenplay.createdAt || new Date().toISOString(),
          updatedAt: newScreenplay.updatedAt || new Date().toISOString(),
          isDeleted: false,
          fileKey: fileKey,
          importPath: filename
        };

        this.loadScreenplayIntoEditor(screenplayWithDiskContent);
        // Note: Default agent will be created automatically by loadInstancesFromMongoDB if needed

        // If backend didn't return content, update it asynchronously
        if (!newScreenplay.content || newScreenplay.content.length === 0) {
          this.logging.warn('⚠️ [AUTO] Backend não retornou conteúdo, sincronizando em background...', 'ScreenplayInteractive');
          this.screenplayStorage.updateScreenplay(newScreenplay.id, {
            content: content
          }).subscribe({
            next: () => {
              this.logging.info('✅ [AUTO] Banco sincronizado com sucesso', 'ScreenplayInteractive');
            },
            error: (updateError) => {
              this.logging.error('❌ [AUTO] Erro ao sincronizar banco (conteúdo já está no editor):', updateError, 'ScreenplayInteractive');
            }
          });
        }
      },
      error: (error) => {
        this.logging.error('❌ [AUTO] Erro ao criar roteiro no MongoDB:', error, 'ScreenplayInteractive', { errorDetails: JSON.stringify(error, null, 2) });

        // Check if it's a "name already exists" error
        if (error.message && error.message.includes('already exists')) {
          this.logging.warn('⚠️ [AUTO] Roteiro já existe, buscando e carregando o existente', 'ScreenplayInteractive');

          // Instead of trying with timestamp, search for and load the existing screenplay
          this.screenplayStorage.getScreenplays(cleanFilename, 1, 10).subscribe({
            next: (response) => {
              const existingScreenplay = response.items.find(item => item.name === cleanFilename);

              if (existingScreenplay) {
                this.logging.info(`✅ [AUTO] Roteiro existente encontrado: ${existingScreenplay.id}`, 'ScreenplayInteractive');
                this.logging.info('📄 [AUTO] Carregando conteúdo do disco no editor primeiro...', 'ScreenplayInteractive');

                // CRITICAL: Load disk content into editor IMMEDIATELY
                const screenplayWithDiskContent = {
                  ...existingScreenplay,
                  content: content,
                  name: existingScreenplay.name,
                  id: existingScreenplay.id,
                  version: existingScreenplay.version,
                  description: existingScreenplay.description || '',
                  tags: existingScreenplay.tags || [],
                  createdAt: existingScreenplay.createdAt,
                  updatedAt: existingScreenplay.updatedAt,
                  isDeleted: existingScreenplay.isDeleted
                } as Screenplay;

                this.loadScreenplayIntoEditor(screenplayWithDiskContent);

                // Then update backend asynchronously
                this.logging.info('💾 [AUTO] Sincronizando com banco em background...', 'ScreenplayInteractive');
                this.screenplayStorage.updateScreenplay(existingScreenplay.id, {
                  content: content
                }).subscribe({
                  next: () => {
                    this.logging.info('✅ [AUTO] Banco atualizado com sucesso', 'ScreenplayInteractive');
                  },
                  error: (updateError) => {
                    this.logging.error('❌ [AUTO] Erro ao atualizar banco (conteúdo já está no editor):', updateError, 'ScreenplayInteractive');
                  }
                });
              } else {
                // Screenplay not found in search, try with timestamp as fallback
                this.logging.warn('⚠️ [AUTO] Roteiro não encontrado na busca, tentando com timestamp', 'ScreenplayInteractive', {
                  contentLength: content?.length || 0,
                  contentPreview: content?.substring(0, 200) || 'EMPTY',
                  cleanFilename
                });

                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const uniqueName = `${cleanFilename}-${timestamp}`;
                this.logging.debug(`   - uniqueName: ${uniqueName}`, 'ScreenplayInteractive');

                const createPayload = {
                  name: uniqueName,
                  content: content,
                  description: `Importado do disco em ${new Date().toLocaleDateString()} (nome original: ${cleanFilename})`
                };
                this.logging.debug('   - Payload:', 'ScreenplayInteractive', JSON.stringify({
                  name: createPayload.name,
                  contentLength: createPayload.content?.length,
                  description: createPayload.description
                }));

                this.screenplayStorage.createScreenplay(createPayload).subscribe({
                  next: (newScreenplay) => {
                    this.logging.info(`✅ [AUTO] Roteiro criado com nome único: ${newScreenplay.id}`, 'ScreenplayInteractive', {
                      screenplayName: newScreenplay.name,
                      contentLength: newScreenplay.content?.length || 0
                    });
                    this.logging.info('📄 [AUTO] Carregando conteúdo do disco no editor...', 'ScreenplayInteractive');

                    // CRITICAL: Always use disk content in editor
                    const screenplayWithDiskContent: Screenplay = {
                      id: newScreenplay.id,
                      name: newScreenplay.name,
                      content: content,  // Always use disk content
                      description: newScreenplay.description || '',
                      tags: newScreenplay.tags || [],
                      version: newScreenplay.version || 1,
                      createdAt: newScreenplay.createdAt || new Date().toISOString(),
                      updatedAt: newScreenplay.updatedAt || new Date().toISOString(),
                      isDeleted: false
                    };

                    this.loadScreenplayIntoEditor(screenplayWithDiskContent);

                    // If backend didn't return content, update it asynchronously
                    if (!newScreenplay.content || newScreenplay.content.length === 0) {
                      this.logging.warn('⚠️ [AUTO] Backend não retornou conteúdo, sincronizando em background...', 'ScreenplayInteractive');
                      this.screenplayStorage.updateScreenplay(newScreenplay.id, {
                        content: content
                      }).subscribe({
                        next: () => {
                          this.logging.info('✅ [AUTO] Banco sincronizado com sucesso', 'ScreenplayInteractive');
                        },
                        error: (updateError) => {
                          this.logging.error('❌ [AUTO] Erro ao sincronizar banco (conteúdo já está no editor):', updateError, 'ScreenplayInteractive');
                        }
                      });
                    }
                  },
                  error: (retryError) => {
                    this.logging.error('❌ [AUTO] Falha mesmo com nome único:', retryError, 'ScreenplayInteractive');
                    this.loadAsNewScreenplay(content, cleanFilename);
                  }
                });
              }
            },
            error: (searchError) => {
              this.logging.error('❌ [AUTO] Erro ao buscar roteiro existente:', searchError, 'ScreenplayInteractive');
              this.loadAsNewScreenplay(content, cleanFilename);
            }
          });
        } else {
          this.logging.warn('⚠️ [AUTO] Fallback: carregando como novo roteiro', 'ScreenplayInteractive');
          // Fallback: load as new screenplay (user can save later)
          this.loadAsNewScreenplay(content, cleanFilename);
        }
      }
    });
  }

  /**
   * Handle conflict when loading a file that already exists in MongoDB
   * Shows modal for user decision
   */
  private handleScreenplayConflict(existingScreenplay: Screenplay, diskContent: string, filename: string): void {
    const diskLines = diskContent.split('\n').length;
    const dbLines = existingScreenplay.content.split('\n').length;

    // TODO: Replace with beautiful modal component
    // For now, using improved window.confirm
    const message = `⚠️ CONFLITO DETECTADO\n\n` +
      `Já existe um roteiro "${filename}" no banco de dados.\n\n` +
      `📄 Arquivo do disco: ${diskLines} linhas\n` +
      `💾 Arquivo do banco: ${dbLines} linhas\n\n` +
      `[OK] - Sobrescrever banco com arquivo do disco\n` +
      `[Cancelar] - Manter banco como está e carregar arquivo em memória\n`;

    const overwrite = window.confirm(message);

    if (overwrite) {
      this.logging.info(`🔁 [CONFLICT] Sobrescrevendo MongoDB com conteúdo do disco`, 'ScreenplayInteractive');

      this.screenplayStorage.updateScreenplay(existingScreenplay.id, {
        content: diskContent
      }).subscribe({
        next: (updatedScreenplay) => {
          this.loadScreenplayIntoEditor(updatedScreenplay);
          this.logging.info(`✅ [CONFLICT] Roteiro atualizado: ${filename}`, 'ScreenplayInteractive');
        },
        error: (error) => {
          this.logging.error('❌ [CONFLICT] Erro ao atualizar:', error, 'ScreenplayInteractive');
          // Fallback: create new
          this.createAndLinkScreenplayAutomatically(diskContent, `${filename}-novo`);
        }
      });
    } else {
      this.logging.info(`📄 [CONFLICT] Usuário optou por carregar do banco`, 'ScreenplayInteractive');
      // Load existing screenplay from database (ignore disk content)
      this.loadScreenplayIntoEditor(existingScreenplay);
    }
  }

  /**
   * SAGA-005: Export current markdown content to disk as a file
   */
  async exportToDisk(): Promise<void> {
    // Ensure current screenplay is saved before exporting
    await this.ensureCurrentScreenplaySaved();
    
    // Get current content
    const content = this.generateMarkdownForSave();

    // Determine filename
    let filename = this.currentScreenplay?.name || this.currentFileName || 'roteiro-vivo.md';
    if (!filename.endsWith('.md')) {
      filename += '.md';
    }

    // Create blob and download
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();

    // Store the file path for future reference
    if (this.currentScreenplay) {
      this.currentScreenplay.filePath = filename;
      // Update the screenplay in the database with the file path
      this.screenplayStorage.updateScreenplay(this.currentScreenplay.id, {
        filePath: filename
      }).subscribe({
        next: () => {
          this.logging.info('📁 Caminho do arquivo salvo no banco:', 'ScreenplayInteractive', filename);
        },
        error: (error) => {
          this.logging.error('❌ Erro ao salvar caminho do arquivo:', error, 'ScreenplayInteractive');
        }
      });
    }

    // Cleanup
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.logging.info('💾 Arquivo salvo no disco:', 'ScreenplayInteractive', filename);
  }

  /**
   * Open export modal with default filename
   */
  async openExportModal(): Promise<void> {
    // Ensure current screenplay is saved before opening export modal
    await this.ensureCurrentScreenplaySaved();
    
    // Set default filename
    let filename = this.currentScreenplay?.name || this.currentFileName || 'roteiro-vivo';
    if (filename.endsWith('.md')) {
      filename = filename.slice(0, -3);
    }
    this.exportFilename = filename;
    this.showExportModal = true;
  }

  /**
   * Close export modal
   */
  closeExportModal(): void {
    this.showExportModal = false;
    this.exportFilename = '';
  }

  /**
   * Toggle screenplay info modal
   */
  toggleScreenplayInfoModal(): void {
    this.showScreenplayInfoModal = !this.showScreenplayInfoModal;
  }

  /**
   * Close screenplay info modal
   */
  closeScreenplayInfoModal(): void {
    this.showScreenplayInfoModal = false;
  }

  /**
   * Toggle screenplay settings menu
   */
  toggleScreenplaySettings(): void {
    this.showScreenplaySettings = !this.showScreenplaySettings;
  }

  /**
   * Open working directory modal
   */
  openWorkingDirModal(): void {
    this.showScreenplaySettings = false;

    // Load current working directory
    if (this.currentScreenplay) {
      this.currentWorkingDirectory = this.currentScreenplay.workingDirectory || null;
      this.tempWorkingDirectory = this.currentWorkingDirectory || '';
    }

    this.showWorkingDirModal = true;
  }

  /**
   * Close working directory modal
   */
  closeWorkingDirModal(): void {
    this.showWorkingDirModal = false;
    this.tempWorkingDirectory = '';
  }

  /**
   * Save working directory
   */
  saveWorkingDirectory(): void {
    if (!this.currentScreenplay) {
      this.notificationService.showError('Nenhum roteiro carregado');
      return;
    }

    const newWorkingDir = this.tempWorkingDirectory.trim();

    if (!newWorkingDir) {
      this.notificationService.showError('Digite um diretório válido');
      return;
    }

    // Basic path validation
    if (!newWorkingDir.startsWith('/')) {
      this.notificationService.showError('O caminho deve ser absoluto (começar com /)');
      return;
    }

    this.logging.info(`Salvando working directory: ${newWorkingDir}`, 'ScreenplayInteractive');

    // Update via API
    this.screenplayStorage.updateWorkingDirectory(
      this.currentScreenplay.id,
      newWorkingDir
    ).subscribe({
      next: (result) => {
        this.logging.info('Working directory salvo com sucesso', 'ScreenplayInteractive');

        // Update local state
        if (this.currentScreenplay) {
          this.currentScreenplay.workingDirectory = newWorkingDir;
          this.currentWorkingDirectory = newWorkingDir;
        }

        this.notificationService.showSuccess('Diretório de trabalho salvo com sucesso');
        this.closeWorkingDirModal();
      },
      error: (error) => {
        this.logging.error('Erro ao salvar working directory', error, 'ScreenplayInteractive');
        this.notificationService.showError('Erro ao salvar diretório de trabalho');
      }
    });
  }

  /**
   * Export file with custom filename from modal using File System Access API
   */
  async confirmExport(): Promise<void> {
    if (!this.exportFilename.trim()) {
      alert('Por favor, insira um nome para o arquivo.');
      return;
    }

    // Get current content
    const content = this.generateMarkdownForSave();

    // Ensure .md extension
    let filename = this.exportFilename.trim();
    if (!filename.endsWith('.md')) {
      filename += '.md';
    }

    try {
      // Check if File System Access API is supported
      if ('showSaveFilePicker' in window) {
        // Use File System Access API to let user choose location
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: filename,
          types: [{
            description: 'Markdown Files',
            accept: { 'text/markdown': ['.md'] }
          }]
        });

        // Write content to the selected file
        const writable = await handle.createWritable();
        await writable.write(content);
        await writable.close();

        // Store the file path for future reference
        if (this.currentScreenplay) {
          this.currentScreenplay.filePath = filename;
          // Update the screenplay in the database with the file path
          this.screenplayStorage.updateScreenplay(this.currentScreenplay.id, {
            filePath: filename
          }).subscribe({
            next: () => {
              this.logging.info('📁 Caminho do arquivo salvo no banco:', 'ScreenplayInteractive', filename);
            },
            error: (error) => {
              this.logging.error('❌ Erro ao salvar caminho do arquivo:', error, 'ScreenplayInteractive');
            }
          });
        }

        this.logging.info('📤 Arquivo exportado com sucesso:', 'ScreenplayInteractive', filename);
      } else {
        // Fallback to traditional download (for older browsers)
        const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();

        // Cleanup
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.logging.info('📥 Arquivo exportado (modo compatibilidade):', 'ScreenplayInteractive', filename);
      }

      // Close modal
      this.closeExportModal();
    } catch (error: any) {
      // User cancelled or error occurred
      if (error.name !== 'AbortError') {
        this.logging.error('❌ Erro ao exportar arquivo:', error, 'ScreenplayInteractive');
        alert('Erro ao exportar arquivo. Tente novamente.');
      }
    }
  }

  /**
   * Reload current screenplay from database
   */
  loadFromDatabase(): void {
    if (!this.currentScreenplay) {
      this.logging.warn('⚠️ Nenhum roteiro carregado do banco', 'ScreenplayInteractive');
      return;
    }

    if (this.isDirty) {
      const confirm = window.confirm(
        'Você tem alterações não salvas. Deseja realmente recarregar do banco? As alterações serão perdidas.'
      );
      if (!confirm) {
        return;
      }
    }

    // Reload from storage
    this.screenplayStorage.getScreenplay(this.currentScreenplay.id).subscribe({
      next: (screenplay) => {
        this.loadScreenplayIntoEditor(screenplay);
        this.logging.info('🔄 Roteiro recarregado do banco:', 'ScreenplayInteractive', screenplay.name);
      },
      error: (error) => {
        this.logging.error('❌ Erro ao recarregar roteiro:', error, 'ScreenplayInteractive');
        alert('Falha ao recarregar o roteiro do banco.');
      }
    });
  }

  /**
   * SAGA-005 v2: Simplified save method - disk files are automatically converted to database
   */
  async save(): Promise<void> {
    this.logging.info(`💾 [SAVE] Intelligent save - sourceOrigin: ${this.sourceOrigin}`, 'ScreenplayInteractive');

    if (!this.isDirty) {
      this.logging.info('⏭️ [SAVE] No changes to save', 'ScreenplayInteractive');
      return;
    }

    switch (this.sourceOrigin) {
      case 'database':
        // Update existing screenplay in database
        this.saveCurrentScreenplay();
        break;

      case 'new':
        // Need to create new screenplay in database
        this.promptCreateNewScreenplay();
        break;

      default:
        this.logging.warn('⚠️ [SAVE] Unknown sourceOrigin:', 'ScreenplayInteractive', this.sourceOrigin);
    }
  }

  /**
   * SAGA-005: Prompt user to create new screenplay in database
   */
  private promptCreateNewScreenplay(): void {
    const content = this.generateMarkdownForSave();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const defaultName = `novo-roteiro-${timestamp}`;
    
    this.logging.info(`💾 [PROMPT] Prompting for new screenplay name`, 'ScreenplayInteractive', {
      defaultName,
      contentLength: content.length
    });
    
    // TODO: Replace with beautiful modal component
    // For now, using improved window.prompt
    const name = window.prompt(
      `💾 Criar Novo Roteiro no Banco\n\n` +
      `Nome do roteiro:`,
      defaultName
    );

    this.logging.debug(`   - User input: "${name}"`, 'ScreenplayInteractive', {
      type: typeof name,
      length: name?.length || 0,
      defaultNameWas: defaultName,
      isSameAsDefault: name === defaultName,
      trimmed: name?.trim(),
      trimmedLength: name?.trim().length || 0,
      isValid: name && name.trim().length > 0
    });

    // Handle the case where user accepts default name without editing
    let finalName = name;
    if (name === defaultName) {
      this.logging.debug(`🔄 [PROMPT] User accepted default name, using as-is: "${defaultName}"`, 'ScreenplayInteractive');
      finalName = defaultName;
    } else if (name && name.trim() && name.trim().length > 0) {
      finalName = name.trim();
      this.logging.info(`✅ [PROMPT] User provided custom name: "${finalName}"`, 'ScreenplayInteractive');
    } else if (name === null) {
      this.logging.info('❌ [SAVE] User cancelled screenplay creation (null)', 'ScreenplayInteractive');
      return;
    } else if (name === '') {
      this.logging.warn('❌ [SAVE] User entered empty string', 'ScreenplayInteractive');
      return;
    } else {
      this.logging.warn('❌ [SAVE] User entered invalid name:', 'ScreenplayInteractive', name);
      return;
    }

    this.logging.info(`✅ [PROMPT] Final name to create: "${finalName}"`, 'ScreenplayInteractive');
    this.createNewScreenplayInDatabase(finalName, content);
  }

  /**
   * SAGA-005: Create new screenplay in database and link to editor
   */
  private createNewScreenplayInDatabase(name: string, content: string): void {
    this.logging.info(`💾 [CREATE] Creating new screenplay in database: ${name}`, 'ScreenplayInteractive', {
      name,
      nameLength: name.length,
      contentLength: content.length,
      contentPreview: `${content.substring(0, 100)}...`
    });

    // Sanitize name similar to import - but be more careful
    let sanitizedName = name.trim();
    
    // Only sanitize if there are problematic characters
    if (/[^a-zA-Z0-9\-_]/.test(sanitizedName)) {
      this.logging.debug(`   - Name contains special characters, sanitizing...`, 'ScreenplayInteractive');
      sanitizedName = sanitizedName.replace(/[^a-zA-Z0-9\-_]/g, '-');
      // Remove multiple consecutive dashes
      sanitizedName = sanitizedName.replace(/-+/g, '-');
      // Remove leading/trailing dashes
      sanitizedName = sanitizedName.replace(/^-+|-+$/g, '');
    }
    
    this.logging.debug(`   - Sanitized name: "${sanitizedName}"`, 'ScreenplayInteractive');

    // Validate name
    if (!sanitizedName || sanitizedName.length === 0) {
      this.logging.error('❌ [CREATE] Invalid name after sanitization', undefined, 'ScreenplayInteractive');
      alert('Nome inválido. Use apenas letras, números, hífens e underscores.');
      return;
    }

    // Additional validation - ensure it's not just dashes
    if (sanitizedName.replace(/-/g, '').length === 0) {
      this.logging.error('❌ [CREATE] Name is only dashes after sanitization', undefined, 'ScreenplayInteractive');
      alert('Nome inválido. Use pelo menos uma letra ou número.');
      return;
    }

    this.logging.info('💾 [CREATE] Sending to MongoDB:', 'ScreenplayInteractive', {
      name: sanitizedName,
      contentLength: content.length,
      contentPreview: content.substring(0, 200),
      description: `Criado em ${new Date().toLocaleDateString()}`
    });

    this.screenplayStorage.createScreenplay({
      name: sanitizedName,
      content: content,
      description: `Criado em ${new Date().toLocaleDateString()}`
    }).subscribe({
      next: (newScreenplay) => {
        this.logging.info(`✅ [CREATE] Screenplay created: ${newScreenplay.id}`, 'ScreenplayInteractive', {
          nameInDb: newScreenplay.name,
          version: newScreenplay.version
        });
        
        // Update state to database-linked
        this.sourceOrigin = 'database';
        this.sourceIdentifier = newScreenplay.id;
        this.currentScreenplay = newScreenplay;
        this.isDirty = false;
        this.currentFileName = '';
        
        // Update URL with new screenplay ID
        this.updateUrlWithScreenplayId(newScreenplay.id);
        
        this.logging.info(`✅ [CREATE] Screenplay linked to editor: ${newScreenplay.name}`, 'ScreenplayInteractive');
        this.logging.info(`✅ [CREATE] URL updated with screenplayId: ${newScreenplay.id}`, 'ScreenplayInteractive');
      },
      error: (error) => {
        this.logging.error('❌ [CREATE] Failed to create screenplay:', error, 'ScreenplayInteractive', {
          errorDetails: JSON.stringify(error, null, 2)
        });
        alert(`Falha ao criar roteiro no banco: ${error.message || 'Erro desconhecido'}`);
      }
    });
  }

  private loadScreenplayById(id: string): void {
    this.isLoading = true;
    this.screenplayStorage.getScreenplay(id).subscribe({
      next: (screenplay) => {
        if (screenplay.isDeleted) {
          this.logging.error('Screenplay was deleted', undefined, 'ScreenplayInteractive');
          alert('Este roteiro foi deletado.');
          this.loadDefaultContent();
          this.clearInvalidUrl();
          this.isLoading = false;
          return;
        }
        this.loadScreenplayIntoEditor(screenplay);
        this.isLoading = false;
      },
      error: (err) => {
        this.logging.error('Failed to load screenplay:', err, 'ScreenplayInteractive');
        alert('Não foi possível carregar o roteiro. Carregando padrão.');
        this.loadDefaultContent();
        this.clearInvalidUrl();
        this.isLoading = false;
      }
    });
  }

  private loadDefaultContent(): void {
    this.interactiveEditor.setContent(this.editorContent, true);
    // Clear agents when loading default content
    this.agentInstances.clear();
    this.agents = [];
    this.updateLegacyAgentsFromInstances();
    this.updateAvailableEmojis();
    this.reloadAgentGame();
  }

  /**
   * Reload agents in the game component
   */
  private reloadAgentGame(): void {
    if (this.agentGame) {
      this.logging.info('🎮 [AGENT-GAME] Reloading agents in game component', 'ScreenplayInteractive');
      
      // First, clear all agents immediately to provide instant feedback
      this.agentGame.clearAllAgents();
      
      // Then reload with a small delay to ensure API has processed the changes
      setTimeout(() => {
        this.agentGame.reloadAgents();
      }, 500);
    } else {
      this.logging.warn('⚠️ [AGENT-GAME] Agent game component not available for reload', 'ScreenplayInteractive');
    }
  }

  private clearInvalidUrl(): void {
    this.router.navigate([], { 
      relativeTo: this.route, 
      queryParams: {},
      replaceUrl: true 
    });
  }

  private loadScreenplayIntoEditor(screenplay: Screenplay): void {
    // Clear previous state
    this.agentInstances.clear();
    this.agents = [];

    // SAGA-005 v2: Clear chat when loading new screenplay
    this.clearChatState();

    // Set current screenplay
    this.currentScreenplay = screenplay;
    this.isDirty = false;
    this.currentFileName = ''; // Clear disk filename

    // SAGA-005: Update state for database-linked screenplay
    this.sourceOrigin = 'database';
    this.sourceIdentifier = screenplay.id;

    // Update URL with screenplay ID
    this.updateUrlWithScreenplayId(screenplay.id);

    this.logging.info(`📖 [LOAD] Loading screenplay into editor:`, 'ScreenplayInteractive', {
      name: screenplay.name,
      contentLength: `${screenplay.content.length} chars`,
      preview: screenplay.content.substring(0, 100)
    });

    // CRITICAL: Set editorContent first (backward compatibility with old code)
    this.editorContent = screenplay.content;

    // SAGA-005 v2: Temporarily disable auto-save to prevent interference
    const originalAutoSave = this.autoSaveTimeout;
    this.autoSaveTimeout = null;

    // Then update TipTap editor
    this.interactiveEditor.setContent(screenplay.content, true);

    // Restore auto-save after a short delay
    setTimeout(() => {
      this.autoSaveTimeout = originalAutoSave;
    }, 100);

    // Load agents specific to this screenplay
    this.loadInstancesFromMongoDB();

    // Reload agents in the game component
    this.reloadAgentGame();

    this.logging.info(`✅ [LOAD] Screenplay loaded: ${screenplay.name} (ID: ${screenplay.id})`, 'ScreenplayInteractive');
  }

  saveCurrentScreenplay(): void {
    if (!this.currentScreenplay) {
      this.logging.info('⏭️ No screenplay loaded', 'ScreenplayInteractive');
      return;
    }

    if (!this.isDirty) {
      this.logging.info('⏭️ No changes to save', 'ScreenplayInteractive');
      return;
    }

    this.isSaving = true;
    this.saveError = null;

    // Get current content from editor
    const currentContent = this.generateMarkdownForSave();

    this.screenplayStorage.updateScreenplay(this.currentScreenplay.id, {
      content: currentContent
    }).subscribe({
      next: (updatedScreenplay) => {
        this.currentScreenplay = updatedScreenplay;
        this.isDirty = false;
        this.isSaving = false;
        this.lastSavedAt = new Date();
        this.saveError = null;
        this.logging.info(`✅ Screenplay saved: ${updatedScreenplay.name} (v${updatedScreenplay.version})`, 'ScreenplayInteractive');
        this.notificationService.showSuccess(`Roteiro salvo com sucesso`);
      },
      error: (error) => {
        this.isSaving = false;
        this.saveError = 'Falha ao salvar o roteiro';
        this.logging.error('❌ Failed to save screenplay:', error, 'ScreenplayInteractive');
        this.notificationService.showError('Falha ao salvar o roteiro. Tente novamente.');
      }
    });
  }

  generateMarkdownForSave(): string {
    if (!this.interactiveEditor) {
      this.logging.error('Editor não encontrado. Não é possível salvar.', undefined, 'ScreenplayInteractive');
      return '';
    }

    // BUG FIX: Get HTML first and convert spans to HTML comments before converting to markdown
    let html = this.interactiveEditor.getHTML();
    
    // Replace invisible spans with HTML comments
    // <span class="agent-anchor" data-instance-id="uuid" data-agent-id="name"></span>emoji
    // becomes: <!-- agent-instance: uuid, agent-id: name -->
    //          emoji
    html = html.replace(
      /<span class="agent-anchor" data-instance-id="([^"]+)" data-agent-id="([^"]+)"><\/span>/g,
      '<!-- agent-instance: $1, agent-id: $2 -->\n'
    );
    
    // Now convert the processed HTML to markdown
    let markdown = this.interactiveEditor.convertHtmlToMarkdown(html);
    
    this.logging.debug('📝 [GENERATE] Generating markdown for save:', 'ScreenplayInteractive', {
      contentLength: markdown.length,
      preview: markdown.substring(0, 200),
      sourceOrigin: this.sourceOrigin,
      isDirty: this.isDirty,
      hadSpans: html.includes('agent-anchor')
    });

    return markdown;
  }

  // === Controle de Views ===
  switchView(view: 'clean' | 'agents' | 'full'): void {
    this.currentView = view;
    this.logging.info(`🌐 View alterada para: ${view}`, 'ScreenplayInteractive');
  }

  // === Gerenciamento de Agentes ===

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  private syncAgentsWithMarkdown(sourceText: string): void {
    this.logging.info('🔄 Sincronizando agentes...', 'ScreenplayInteractive');
    const foundAgentIds = new Set<string>();

    // Validação robusta: garante que sourceText é uma string antes de usar matchAll
    if (!sourceText || typeof sourceText !== 'string') {
      this.logging.warn('⚠️ sourceText is not a valid string, skipping synchronization', 'ScreenplayInteractive');
      return;
    }

    // Suportar dois formatos:
    // 1. SAGA-003: <!-- agent-instance: uuid-123, agent-id: resume-formatter -->
    //              📄
    // 2. Formato antigo: 🚀 (sem âncora)

    // Primeiro, processar âncoras SAGA-003
    // Aceita tanto com quebra de linha quanto sem: -->📄 ou -->\n📄
    const anchorRegex = /<!--\s*agent-instance:\s*([^,]+),\s*agent-id:\s*([^\s]+)\s*-->\s*\n?(.)/gu;
    const anchoredMatches = [...sourceText.matchAll(anchorRegex)];

    this.logging.debug(`📋 Encontradas ${anchoredMatches.length} âncoras SAGA-003 no markdown`, 'ScreenplayInteractive');

    if (anchoredMatches.length === 0) {
      this.logging.warn('⚠️ Nenhuma âncora encontrada! Verificando se há âncoras no texto...', 'ScreenplayInteractive');
      const hasAnchor = sourceText.includes('agent-instance');
      this.logging.warn(`   - Texto contém "agent-instance": ${hasAnchor}`, 'ScreenplayInteractive');
      if (hasAnchor) {
        this.logging.warn('   - Âncora existe mas regex não está encontrando!', 'ScreenplayInteractive');
        this.logging.warn('   - Trecho do texto:', 'ScreenplayInteractive', sourceText.substring(sourceText.indexOf('agent-instance') - 20, sourceText.indexOf('agent-instance') + 100));
      }
    }

    for (const match of anchoredMatches) {
      this.logging.debug('🔍 [SYNC] Match encontrado:', 'ScreenplayInteractive', {
        full: match[0],
        instance_id: match[1],
        agent_id: match[2],
        emoji: match[3]
      });

      const instanceId = match[1].trim();
      const agentIdOrSlug = match[2].trim();
      const emoji = match[3];
      const definition = AGENT_DEFINITIONS[emoji];

      // BUG FIX: When loading from database, only accept anchors that have corresponding agents in the database
      // This prevents orphaned anchors from creating phantom instances
      if (this.sourceOrigin === 'database' && !this.agentInstances.has(instanceId)) {
        this.logging.warn(`⚠️ [SYNC] Ignorando âncora órfã: ${instanceId} (${agentIdOrSlug}) - agente não existe no banco de dados`, 'ScreenplayInteractive');
        continue; // Skip this anchor - it's orphaned and not in the database
      }

      foundAgentIds.add(instanceId);

      if (!this.agentInstances.has(instanceId)) {
        this.logging.info(`✨ Criando instância ${instanceId} do agente ${agentIdOrSlug} (${emoji})`, 'ScreenplayInteractive', {
          instance_id: instanceId,
          agent_id_slug: agentIdOrSlug,
          emoji
        });

        // Usar o agent_id da âncora diretamente
        // O gateway vai resolver se for nome ou MongoDB ID
        const newInstance: AgentInstance = {
          id: instanceId,
          agent_id: agentIdOrSlug,  // Pode ser MongoDB ID ou nome do agente
          emoji: emoji,
          definition: definition || {
            title: `Agent ${agentIdOrSlug}`,
            description: 'Imported from markdown',
            unicode: emoji.codePointAt(0)?.toString(16) || ''
          },
          status: 'pending',
          position: this.calculateEmojiPosition(match.index || 0)
        };

        this.logging.info(`✅ Instância criada com agent_id: ${newInstance.agent_id}`, 'ScreenplayInteractive');
        this.agentInstances.set(instanceId, newInstance);
      } else {
        this.logging.debug(`ℹ️ Instância ${instanceId} já existe, pulando...`, 'ScreenplayInteractive');
      }
    }

    // DISABLED: Automatic agent creation from standalone emojis
    // Agents are now created manually via "Adicionar Agente" button
    // This prevents unwanted agent creation from emojis in the text
    /*
    const allEmojis = Object.keys(AGENT_DEFINITIONS).map(e => e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const standaloneEmojiRegex = new RegExp(`(?<!<!--[^>]*>[\\s\\n]*)(${allEmojis})`, 'gu');
    const standaloneMatches = [...sourceText.matchAll(standaloneEmojiRegex)];

    this.logging.debug(`📋 Encontrados ${standaloneMatches.length} emojis standalone de ${Object.keys(AGENT_DEFINITIONS).length} possíveis`, 'ScreenplayInteractive');

    const matchesByEmoji = new Map<string, Array<{ match: RegExpMatchArray; index: number }>>();
    standaloneMatches.forEach(match => {
      const emoji = match[1];
      const list = matchesByEmoji.get(emoji) || [];
      list.push({ match, index: match.index || 0 });
      matchesByEmoji.set(emoji, list);
    });

    matchesByEmoji.forEach((matches, emoji) => {
      const definition = AGENT_DEFINITIONS[emoji];
      if (!definition) return;

      const existingInstances = Array.from(this.agentInstances.entries())
        .filter(([id, instance]) => instance.emoji === emoji && !foundAgentIds.has(id))
        .map(([id, instance]) => ({ id, instance }));

      for (let i = 0; i < matches.length; i++) {
        if (i < existingInstances.length) {
          const { id } = existingInstances[i];
          foundAgentIds.add(id);
          this.logging.debug(`♻️  Reutilizando instância ${id} para ${emoji} #${i}`, 'ScreenplayInteractive');
        } else {
          const instanceId = this.generateUUID();
          const newInstance: AgentInstance = {
            id: instanceId,
            emoji: emoji,
            definition: definition,
            status: 'pending',
            position: this.calculateEmojiPosition(matches[i].index)
          };

          this.agentInstances.set(instanceId, newInstance);
          foundAgentIds.add(instanceId);
          this.logging.info(`✨ Nova instância ${instanceId} para ${emoji} #${i}`, 'ScreenplayInteractive');
        }
      }
    });
    */
    
    this.logging.info('ℹ️ [SYNC] Automatic agent creation from emojis is disabled. Agents must be added manually.', 'ScreenplayInteractive');

    // DISABLED: Orphan cleanup
    // Since agents are no longer tied to emojis in the text, we don't clean them up
    // Agents persist in the screenplay until manually removed
    /*
    for (const id of this.agentInstances.keys()) {
      if (!foundAgentIds.has(id)) {
        this.agentInstances.delete(id);
      }
    }
    */

    this.updateAgentPositionsFromText();

    this.logging.info(`✅ Sincronização completa. ${this.agentInstances.size} agentes ativos.`, 'ScreenplayInteractive');

    // Update legacy structures for backward compatibility
    this.updateAvailableEmojis();
    this.updateLegacyAgentsFromInstances();

    // Update agent dock lists
    this.updateAgentDockLists();
  }

  private updateAvailableEmojis(): void {
    const emojiCount: { [key: string]: number } = {};
    for (const instance of this.agentInstances.values()) {
      emojiCount[instance.emoji] = (emojiCount[instance.emoji] || 0) + 1;
    }

    this.availableEmojis = Object.keys(emojiCount).map(emoji => ({
      emoji,
      count: emojiCount[emoji],
      positions: []
    }));
  }

  private updateLegacyAgentsFromInstances(): void {
    this.agents = Array.from(this.agentInstances.values()).map(instance => ({
      id: instance.id,
      emoji: instance.emoji,
      position: instance.position,
      data: {
        id: instance.id,
        emoji: instance.emoji,
        category: 'auth' as const,
        title: instance.definition.title,
        description: instance.definition.description
      }
    }));
  }

  scanAndCreateAgents(): void {
    const currentContent = this.interactiveEditor.getMarkdown();
    this.syncAgentsWithMarkdown(currentContent);
  }

  createAgentsForEmoji(emojiInfo: EmojiInfo): void {
    const currentContent = this.interactiveEditor.getMarkdown();
    this.syncAgentsWithMarkdown(currentContent);
    this.logging.info(`✨ Triggered sync for ${emojiInfo.emoji}`, 'ScreenplayInteractive');
  }

  addManualAgent(): void {
    const canvas = this.canvas.nativeElement;

    const emojis = ['🚀', '🔐', '📊', '🛡️', '⚡', '🎯', '🧠', '💻', '📱', '🌐', '🔍', '🧪'];
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
    const definition = AGENT_DEFINITIONS[randomEmoji];
    const agentId = `manual-${this.generateUUID()}`;

    const newInstance: AgentInstance = {
      id: agentId,
      emoji: randomEmoji,
      definition: definition,
      status: 'pending',
      position: {
        x: Math.random() * (canvas.offsetWidth - 100) + 50,
        y: Math.random() * (canvas.offsetHeight - 100) + 50
      }
    };

    this.agentInstances.set(agentId, newInstance);
    this.updateLegacyAgentsFromInstances();

    // Add agent to the game map
    if (this.agentGame) {
      this.agentGame.addAgent({
        emoji: newInstance.emoji,
        name: newInstance.definition.title,
        agentId: newInstance.agent_id ?? 'unknown',
        screenplayId: this.currentScreenplay?.id ?? 'unknown',
        instanceId: newInstance.id
      });
      this.logging.info('🎮 [AGENT-GAME] Manual agent added to game map', 'ScreenplayInteractive');
    }

    this.logging.info('➕ Agente manual adicionado:', 'ScreenplayInteractive', randomEmoji);
  }

  clearAllAgents(): void {
    this.logging.info('🗑️ [SCREENPLAY] Removendo todos os agentes...', 'ScreenplayInteractive');

    // Get all instance IDs before clearing
    const instanceIds = Array.from(this.agentInstances.keys());

    // Clear memory first for immediate UI update
    this.agents = [];
    this.agentInstances.clear();

    // Delete all instances from MongoDB (cascade to remove history and logs)
    instanceIds.forEach(instanceId => {
      this.agentService.deleteInstance(instanceId, true).subscribe({
        next: () => {
          this.logging.info(`✅ [SCREENPLAY] Instância ${instanceId} deletada do MongoDB`, 'ScreenplayInteractive');
        },
        error: (error) => {
          this.logging.error(`❌ [SCREENPLAY] Falha ao deletar ${instanceId} do MongoDB:`, error, 'ScreenplayInteractive');
          // Continue with other deletions even if one fails
        }
      });
    });

    this.logging.info(`🗑️ Todos os agentes removidos (${instanceIds.length} instâncias)`, 'ScreenplayInteractive');
  }

  resyncManually(): void {
    this.logging.info('🔄 Executando resincronização manual...', 'ScreenplayInteractive');
    const currentContent = this.interactiveEditor.getMarkdown();
    this.syncAgentsWithMarkdown(currentContent);
    this.logging.info('🔄 Resincronização manual completa', 'ScreenplayInteractive');
  }

  /**
   * Calculate position for emoji based on its index in the markdown
   * Following SAGA-003 specification
   */
  private calculateEmojiPosition(index: number): CirclePosition {
    const canvas = this.canvas.nativeElement;
    if (!canvas) {
      return { x: 100, y: 100 };
    }

    // Distribute positions in a grid-like pattern based on index
    const gridCols = 5;
    const spacing = 120;
    const offsetX = 100;
    const offsetY = 100;

    const col = index % gridCols;
    const row = Math.floor(index / gridCols);

    return {
      x: offsetX + (col * spacing),
      y: offsetY + (row * spacing)
    };
  }

  private positionAgentsOverEmojis(): void {
    this.logging.debug('--- Iniciando Posicionamento de Agentes ---', 'ScreenplayInteractive');

    const canvas = this.canvas.nativeElement;
    if (!canvas) {
      this.logging.error('❌ BUG: Elemento do Canvas não encontrado.', undefined, 'ScreenplayInteractive');
      return;
    }

    const editorElement = this.interactiveEditor.getEditorElement();
    if (!editorElement) {
      this.logging.error('❌ BUG: Elemento do Editor (.ProseMirror) não foi encontrado pelo filho.', undefined, 'ScreenplayInteractive');
      return;
    }

    const canvasRect = canvas.getBoundingClientRect();
    this.logging.debug('📦 Coordenadas do Canvas (referência):', 'ScreenplayInteractive', canvasRect);

    // --- INÍCIO DA CORREÇÃO ---
    // 1. Obtenha a posição de scroll do container que ROLA. Neste caso, é o próprio canvas.
    const scrollTop = canvas.scrollTop;
    this.logging.debug(`📜 Posição do Scroll Top: ${scrollTop}`, 'ScreenplayInteractive');
    // --- FIM DA CORREÇÃO ---

    if (this.agentInstances.size === 0) {
      this.logging.info('ℹ️ Nenhuma instância de agente para posicionar.', 'ScreenplayInteractive');
      return;
    }

    // Agrupa instâncias por emoji para processamento
    const instancesByEmoji = new Map<string, AgentInstance[]>();
    this.agentInstances.forEach(inst => {
      const list = instancesByEmoji.get(inst.emoji) || [];
      list.push(inst);
      instancesByEmoji.set(inst.emoji, list);
    });

    instancesByEmoji.forEach((instances, emoji) => {
      this.logging.debug(`-- Buscando posições para o emoji: "${emoji}" (${instances.length} instâncias)`, 'ScreenplayInteractive');

      const walker = document.createTreeWalker(editorElement, NodeFilter.SHOW_TEXT, null);
      let node;
      let emojiInstanceIndex = 0;

      while ((node = walker.nextNode()) && emojiInstanceIndex < instances.length) {
        const textContent = node.textContent || '';
        let searchIndex = -1;

        while ((searchIndex = textContent.indexOf(emoji, searchIndex + 1)) !== -1) {
          if (emojiInstanceIndex >= instances.length) break;

          const instance = instances[emojiInstanceIndex];
          const range = document.createRange();
          range.setStart(node, searchIndex);
          range.setEnd(node, searchIndex + emoji.length);
          const rect = range.getBoundingClientRect();

          if (rect.width === 0 && rect.height === 0) {
            this.logging.warn(`⚠️ Posição do emoji "${emoji}" #${emojiInstanceIndex} não pôde ser calculada (rect is zero).`, 'ScreenplayInteractive');
            emojiInstanceIndex++;
            continue;
          }

          // --- INÍCIO DA CORREÇÃO ---
          // 2. Adicione scrollTop ao cálculo da coordenada Y e offset para centralização perfeita
          const fontSize = parseFloat(getComputedStyle(editorElement).fontSize);
          const offsetX = fontSize / 2 + 2; // Ajuste fino para X (+2px para direita)
          const offsetY = fontSize / 2 + 1; // Centraliza no meio do emoji (+1px para baixo)

          const newPosition = {
            x: (rect.left - canvasRect.left) + offsetX,
            y: (rect.top - canvasRect.top) + scrollTop + offsetY // Scroll + centralização
          };
          // --- FIM DA CORREÇÃO ---

          this.logging.debug(`✅ Emoji "${emoji}" #${emojiInstanceIndex} encontrado. Rect:`, 'ScreenplayInteractive', { rect, newPosition });

          instance.position = newPosition;
          emojiInstanceIndex++;
        }
      }
    });

    this.logging.debug('--- Posicionamento de Agentes (com Scroll) Concluído ---', 'ScreenplayInteractive');
  }

  updateAgentPositionsFromText(): void {
    this.positionAgentsOverEmojis();
  }

  // === Event Handlers ===
  handleContentUpdate(newContent: string): void {
    // SAGA-005 v2: Mark content as dirty for any source origin
    this.isDirty = true;

    // Debounce to avoid too many updates while typing
    clearTimeout(this.updateTimeout);
    this.updateTimeout = setTimeout(() => {
      this.logging.debug('📝 handleContentUpdate recebeu conteúdo:', 'ScreenplayInteractive', {
        preview: newContent.substring(0, 200),
        hasAgentInstance: newContent.includes('agent-instance')
      });

      // Passa o conteúdo mais recente para a lógica de sincronização
      this.syncAgentsWithMarkdown(newContent);

      // Schedule auto-save using the new intelligent system
      this.scheduleAutoSave();
    }, 1000);
  }

  onBlockCommand(command: string): void {
    this.logging.info('🎬 Comando do bloco:', 'ScreenplayInteractive', command);
  }

  onAgentCircleEvent(event: CircleEvent, agent: AgentConfig): void {
    this.logging.debug('🎯 Evento do círculo:', 'ScreenplayInteractive', { type: event.type, emoji: agent.emoji });
    // Legacy method - no longer in use, agent instances use onAgentInstanceCircleEvent instead
  }

  onAgentPositionChange(position: CirclePosition, agent: AgentConfig): void {
    agent.position = position;
  }

  onAgentInstanceCircleEvent(event: CircleEvent, instance: AgentInstance): void {
    this.logging.info('🎯 Agent instance circle event:', 'ScreenplayInteractive', { type: event.type, emoji: instance.emoji, id: instance.id });
    if (event.type === 'click') {
      this.selectedAgent = instance;
      this.logging.info('📍 [SCREENPLAY] Agente clicado:', 'ScreenplayInteractive', {
        instance_id: instance.id,
        agent_id: instance.agent_id,
        agent_id_type: typeof instance.agent_id,
        is_undefined: instance.agent_id === undefined,
        is_null: instance.agent_id === null,
        name: instance.definition.title,
        emoji: instance.emoji,
        full_instance: JSON.stringify(instance, null, 2)
      });

      if (!instance.agent_id) {
        this.logging.error('❌ [SCREENPLAY] ERRO CRÍTICO: agent_id está undefined/null!', undefined, 'ScreenplayInteractive', {
          details: 'A instância foi criada mas agent_id não foi definido. Verifique se a âncora no markdown tem agent-id correto. Formato esperado: <!-- agent-instance: uuid, agent-id: nome-do-agente -->. Verifique os logs de sincronização acima para ver o que foi extraído.'
        });
      }

      this.conductorChat.loadContextForAgent(
        instance.id,
        instance.definition.title,
        instance.emoji,
        instance.agent_id,  // Pass MongoDB agent_id for direct execution
        instance.config?.cwd,  // Pass working directory if defined
        this.currentScreenplay?.id // SAGA-006: Pass screenplay ID for document association
      );
      this.logging.info('💬 Carregando contexto no chat:', 'ScreenplayInteractive', {
        instance_id_passed: instance.id,
        agent_id_passed: instance.agent_id
      });
    }
  }

  onAgentInstancePositionChange(position: CirclePosition, instance: AgentInstance): void {
    instance.position = position;

    // Update MongoDB
    this.agentService.updateInstance(instance.id, { position }).subscribe({
      next: () => {
        this.logging.info(`✅ [SCREENPLAY] Posição atualizada no MongoDB: ${instance.id}`, 'ScreenplayInteractive');
      },
      error: (error) => {
        this.logging.error('❌ [SCREENPLAY] Falha ao atualizar posição no MongoDB:', error, 'ScreenplayInteractive');
      }
    });

    this.logging.debug(`📍 Agent instance ${instance.id} moved to (${position.x}, ${position.y})`, 'ScreenplayInteractive');
  }

  openAgentCreator(): void {
    this.showAgentCreator = true;
  }

  closeAgentCreator(): void {
    this.showAgentCreator = false;
  }

  onAgentCreated(agentData: AgentCreationData): void {
    const canvas = this.canvas.nativeElement;
    const agentId = `custom-${this.generateUUID()}`;

    // Add the new emoji to definitions if it doesn't exist
    if (!AGENT_DEFINITIONS[agentData.emoji]) {
      AGENT_DEFINITIONS[agentData.emoji] = {
        title: agentData.title,
        description: agentData.description,
        unicode: agentData.emoji.codePointAt(0)?.toString(16) || ''
      };
    }

    const newInstance: AgentInstance = {
      id: agentId,
      emoji: agentData.emoji,
      definition: {
        title: agentData.title,
        description: agentData.description,
        unicode: agentData.emoji.codePointAt(0)?.toString(16) || ''
      },
      status: 'pending',
      position: agentData.position || {
        x: Math.random() * (canvas.offsetWidth - 100) + 50,
        y: Math.random() * (canvas.offsetHeight - 100) + 50
      }
    };

    this.agentInstances.set(agentId, newInstance);
    this.updateLegacyAgentsFromInstances();

    // Add agent to the game map
    if (this.agentGame) {
      this.agentGame.addAgent({
        emoji: agentData.emoji,
        name: agentData.title,
        agentId: agentId,
        screenplayId: this.currentScreenplay?.id || 'unknown',
        instanceId: agentId
      });
      this.logging.info('🎮 [AGENT-GAME] Custom agent added to map:', 'ScreenplayInteractive', { name: agentData.title });
    }

    this.closeAgentCreator();

    this.logging.info('✨ Agente personalizado criado:', 'ScreenplayInteractive', { title: agentData.title, emoji: agentData.emoji });
  }

  openAgentSelector(): void {
    this.showAgentSelector = true;
  }

  closeAgentSelector(): void {
    this.showAgentSelector = false;
  }

  onAgentSelected(selectionData: AgentSelectionData): void {
    const canvas = this.canvas.nativeElement;
    const { agent, instanceId, cwd } = selectionData;

    // Add the agent emoji to definitions if it doesn't exist
    if (!AGENT_DEFINITIONS[agent.emoji]) {
      AGENT_DEFINITIONS[agent.emoji] = {
        title: agent.name,
        description: agent.description,
        unicode: agent.emoji.codePointAt(0)?.toString(16) || ''
      };
    }

    // Create a new agent instance
    const newInstance: AgentInstance = {
      id: instanceId,
      agent_id: agent.id, // Agent name/identifier (e.g., "ReadmeResume_Agent")
      emoji: agent.emoji,
      definition: {
        title: agent.name,
        description: agent.description,
        unicode: agent.emoji.codePointAt(0)?.toString(16) || ''
      },
      status: 'pending',
      position: {
        x: 100, // Temporary position, will be updated after DOM renders
        y: 100
      },
      config: {
        cwd: cwd,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    };

    // Add to instances map
    this.agentInstances.set(instanceId, newInstance);

    // Create instance record in MongoDB via gateway (linked to screenplay)
    this.createAgentInstanceInMongoDB(instanceId, agent.id, newInstance.position, cwd);

    // Update structures to reflect new agent in dock
    this.updateLegacyAgentsFromInstances();
    this.updateAvailableEmojis();
    this.updateAgentDockLists();

    // Add agent to the game map
    if (this.agentGame) {
      this.agentGame.addAgent({
        emoji: agent.emoji,
        name: agent.name,
        agentId: agent.id,
        screenplayId: this.currentScreenplay?.id || 'unknown',
        instanceId: instanceId
      });
      this.logging.info('🎮 [AGENT-GAME] Agent added to map:', 'ScreenplayInteractive', { name: agent.name });
    }

    this.closeAgentSelector();

    this.logging.info('✅ Agente vinculado ao roteiro (disponível na dock lateral):', 'ScreenplayInteractive', {
      name: agent.name,
      emoji: agent.emoji,
      id: instanceId,
      note: 'Agent does not appear in editor, only in dock'
    });
  }

  // === Agent Execution with Preview ===

  /**
   * Keyboard shortcut handler (Ctrl+K or Cmd+K)
   */
  @HostListener('document:keydown.control.k', ['$event'])
  @HostListener('document:keydown.meta.k', ['$event'])
  handleExecuteShortcut(event: Event): void {
    event.preventDefault();
    this.captureSelectionAndExecute();
  }

  /**
   * Capture text selection and trigger agent execution
   */
  captureSelectionAndExecute(): void {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      this.logging.warn('No text selected', 'ScreenplayInteractive');
      return;
    }

    const selectedText = selection.toString().trim();
    if (!selectedText) {
      this.logging.warn('Empty selection', 'ScreenplayInteractive');
      return;
    }

    // Find which agent instance is active (could be based on proximity, last clicked, etc.)
    const activeAgent = this.findActiveAgent();
    if (!activeAgent) {
      alert('Nenhum agente ativo. Clique em um agente primeiro.');
      return;
    }

    // Store selection context
    this.selectedText = selectedText;
    this.activeAgentForExecution = activeAgent;

    // Get text range for later replacement
    const range = selection.getRangeAt(0);
    const fullText = this.interactiveEditor.getMarkdown();
    const startOffset = this.getTextOffset(range.startContainer, range.startOffset, fullText);
    const endOffset = this.getTextOffset(range.endContainer, range.endOffset, fullText);

    this.selectedTextRange = { start: startOffset, end: endOffset };

    // Execute agent with selected text
    this.executeAgentWithPreview(activeAgent, selectedText);
  }

  /**
   * Find the active agent instance (for now, just pick the first one)
   * TODO: Improve this to use last clicked agent or proximity to selection
   */
  private findActiveAgent(): AgentInstance | null {
    if (this.selectedAgent) {
      return this.selectedAgent;
    }

    const instances = Array.from(this.agentInstances.values());
    if (instances.length > 0) {
      return instances[0];
    }

    return null;
  }

  /**
   * Calculate text offset in the full markdown
   */
  private getTextOffset(node: Node, offset: number, fullText: string): number {
    // Simplified implementation - in production, you'd need more robust offset calculation
    const selection = window.getSelection();
    if (!selection) return 0;

    const range = selection.getRangeAt(0);
    const preRange = range.cloneRange();
    preRange.selectNodeContents(document.body);
    preRange.setEnd(range.startContainer, range.startOffset);

    return preRange.toString().length;
  }

  /**
   * Execute agent and show preview modal
   */
  private executeAgentWithPreview(agent: AgentInstance, inputText: string): void {
    this.showAgentPreview = true;
    this.previewLoading = true;
    this.previewError = null;
    this.previewData = {
      originalText: inputText,
      proposedText: '',
      agentName: agent.definition.title,
      agentEmoji: agent.emoji
    };

    // Use the MongoDB agent_id if available, fallback to instance id
    const agentId = agent.agent_id ?? agent.id;

    this.agentService.executeAgent(agentId, inputText, agent.id).subscribe({
      next: (result) => {
        this.previewLoading = false;
        if (result.success && result.result) {
          this.previewData = {
            originalText: inputText,
            proposedText: result.result,
            agentName: agent.definition.title,
            agentEmoji: agent.emoji
          };
        } else {
          this.previewError = result.error || 'Falha na execução do agente';
        }
      },
      error: (error) => {
        this.previewLoading = false;
        this.previewError = 'Erro ao executar agente: ' + (error.message || 'Erro desconhecido');
        console.error('Agent execution error:', error);
      }
    });
  }

  /**
   * Handle preview accept - replace text in editor
   */
  onPreviewAccept(action: PreviewAction): void {
    if (action.proposedText && this.selectedTextRange) {
      const currentMarkdown = this.interactiveEditor.getMarkdown();
      const newMarkdown =
        currentMarkdown.substring(0, this.selectedTextRange.start) +
        action.proposedText +
        currentMarkdown.substring(this.selectedTextRange.end);

      this.interactiveEditor.setContent(newMarkdown, true);
      this.logging.info('✅ Preview accepted, text replaced', 'ScreenplayInteractive');
    }

    this.closeAgentPreview();
  }

  /**
   * Handle preview reject - close modal without changes
   */
  onPreviewReject(action: PreviewAction): void {
    this.logging.info('❌ Preview rejected', 'ScreenplayInteractive');
    this.closeAgentPreview();
  }

  /**
   * Close preview modal and reset state
   */
  closeAgentPreview(): void {
    this.showAgentPreview = false;
    this.previewData = null;
    this.previewLoading = false;
    this.previewError = null;
    this.selectedText = '';
    this.selectedTextRange = null;
  }

  // === Utilitários ===

  getAgentInstancesAsArray(): AgentInstance[] {
    return Array.from(this.agentInstances.values());
  }

  // === Agent Dock Methods ===

  private updateAgentDockLists(): void {
    // Popula agentes contextuais a partir das instâncias no documento
    // SAGA-006: Filter out hidden agents, deleted agents, and sort by creation date
    this.contextualAgents = this.getAgentInstancesAsArray()
      .filter(agent => !agent.is_hidden && !agent.isDeleted)
      .sort((a, b) => {
        // Sort by creation date (oldest first)
        const dateA = a.config?.createdAt ? new Date(a.config.createdAt).getTime() : 0;
        const dateB = b.config?.createdAt ? new Date(b.config.createdAt).getTime() : 0;
        return dateA - dateB;
      });
    this.logging.info(`🔄 Dock atualizado: ${this.contextualAgents.length} agentes no documento (ordem por criação)`, 'ScreenplayInteractive');
  }

  public onDockAgentClick(agent: AgentInstance): void {
    this.logging.info(`🔄 [DOCK-CLICK] Carregando agente: ${agent.definition.title}`, 'ScreenplayInteractive', {
      agentId: agent.id,
      agentTitle: agent.definition.title,
      agentEmoji: agent.emoji,
      agent_agent_id: agent.agent_id,
      agentCwd: agent.config?.cwd,
      currentScreenplayId: this.currentScreenplay?.id,
      conductorChatAvailable: !!this.conductorChat
    });

    this.activeAgentId = agent.id;

    if (this.conductorChat) {
      this.logging.debug('🎯 [DOCK-CLICK] Calling conductorChat.loadContextForAgent...', 'ScreenplayInteractive');
      this.conductorChat.loadContextForAgent(
        agent.id,
        agent.definition.title,
        agent.emoji,
        agent.agent_id,
        agent.config?.cwd,
        this.currentScreenplay?.id // SAGA-006: Pass screenplay ID for document association
      );
      this.logging.debug('✅ [DOCK-CLICK] loadContextForAgent called successfully', 'ScreenplayInteractive');
    } else {
      this.logging.error('❌ [DOCK-CLICK] ConductorChat is not available!', undefined, 'ScreenplayInteractive');
    }
  }

  /**
   * Handler para clique no botão de delete (deleta o agente ativo/selecionado)
   */
  public onDeleteAgentClick(): void {
    if (!this.activeAgentId) {
      this.logging.warn('⚠️ [DELETE] No active agent selected', 'ScreenplayInteractive');
      return;
    }

    // Find the currently active agent
    const agent = this.contextualAgents.find(a => a.id === this.activeAgentId);
    if (!agent) {
      this.logging.error('❌ [DELETE] Active agent not found in contextual agents', undefined, 'ScreenplayInteractive', {
        activeAgentId: this.activeAgentId
      });
      return;
    }

    this.agentToDelete = agent;
    this.showDeleteConfirmModal = true;
    this.logging.info('🗑️ [DELETE] Opening delete confirmation modal', 'ScreenplayInteractive', {
      agentId: agent.id,
      agentTitle: agent.definition.title
    });
  }

  /**
   * Fecha o modal de confirmação de exclusão
   */
  public closeDeleteConfirmModal(): void {
    this.showDeleteConfirmModal = false;
    this.agentToDelete = null;
  }

  /**
   * Confirma e executa a exclusão do agente
   */
  public async confirmDeleteAgent(): Promise<void> {
    if (!this.agentToDelete) {
      this.logging.warn('⚠️ [DELETE] No agent to delete', 'ScreenplayInteractive');
      return;
    }

    const agent = this.agentToDelete;
    const instanceId = agent.id;

    try {
      this.logging.info('🗑️ [DELETE] Soft deleting agent instance', 'ScreenplayInteractive', {
        instanceId,
        agentTitle: agent.definition.title
      });

      // Call DELETE endpoint (soft delete by default)
      const baseUrl = this.getBaseUrl();
      const deleteUrl = `${baseUrl}/api/agents/instances/${instanceId}`;

      await this.http.delete(deleteUrl).toPromise();

      this.logging.info('✅ [DELETE] Agent instance soft deleted successfully', 'ScreenplayInteractive', { instanceId });

      // Remove from local contextualAgents array
      this.contextualAgents = this.contextualAgents.filter(a => a.id !== instanceId);

      // Remove from agentInstances map
      this.agentInstances.delete(instanceId);

      // Update agent game canvas
      if (this.agentGame) {
        this.agentGame.removeAgent(instanceId);
      }

      // Clear active agent if it was the deleted one
      if (this.activeAgentId === instanceId) {
        this.activeAgentId = null;
        // Auto-select first agent if available
        if (this.contextualAgents.length > 0) {
          this.onDockAgentClick(this.contextualAgents[0]);
        }
      }

      // Close modal
      this.closeDeleteConfirmModal();

      this.logging.info('🎯 [DELETE] Agent removed from UI and canvas', 'ScreenplayInteractive');
    } catch (error: any) {
      this.logging.error('❌ [DELETE] Error deleting agent instance', error, 'ScreenplayInteractive', {
        instanceId,
        error: error.message
      });
      alert(`Erro ao excluir agente: ${error.message || 'Erro desconhecido'}`);
    }
  }

  /**
   * Helper to get base URL
   */
  private getBaseUrl(): string {
    return environment.apiUrl;
  }

  hasSomeAgentsForEmoji(emoji: string): boolean {
    const count = this.getAgentCountForEmoji(emoji);
    const total = this.availableEmojis.find(e => e.emoji === emoji)?.count || 0;
    return count > 0 && count < total;
  }

  hasAllAgentsForEmoji(emoji: string, totalCount: number): boolean {
    return this.getAgentCountForEmoji(emoji) === totalCount;
  }

  getAgentCountForEmoji(emoji: string): number {
    return this.agents.filter(a => a.emoji === emoji).length;
  }

  getEmojiTooltip(emojiInfo: EmojiInfo): string {
    const existing = this.getAgentCountForEmoji(emojiInfo.emoji);
    return `${emojiInfo.emoji} - ${existing}/${emojiInfo.count} agentes criados`;
  }

  // === Persistência ===

  /**
   * Load agent instances from MongoDB
   * Only loads agents for the current screenplay
   */
  /**
   * BUG FIX: Clean orphaned agent anchors from markdown
   * Removes HTML comments for agents that don't exist in the database
   */
  private cleanOrphanedAnchorsFromMarkdown(): void {
    if (this.sourceOrigin !== 'database') {
      return; // Only clean when loaded from database
    }

    const currentContent = this.interactiveEditor.getHTML();
    const anchorRegex = /<!--\s*agent-instance:\s*([^,]+),\s*agent-id:\s*([^\s]+)\s*-->\s*\n?(.)/gu;
    const matches = [...currentContent.matchAll(anchorRegex)];
    
    let cleanedContent = currentContent;
    let orphanCount = 0;

    for (const match of matches) {
      const instanceId = match[1].trim();
      
      // If this anchor's instance doesn't exist in our loaded agents, it's orphaned
      if (!this.agentInstances.has(instanceId)) {
        this.logging.warn(`🧹 [CLEAN] Removendo âncora órfã: ${instanceId}`, 'ScreenplayInteractive');
        // Remove the entire anchor comment, keep only the emoji
        cleanedContent = cleanedContent.replace(match[0], match[3]);
        orphanCount++;
      }
    }

    if (orphanCount > 0) {
      this.logging.info(`🧹 [CLEAN] Removidas ${orphanCount} âncoras órfãs do markdown`, 'ScreenplayInteractive');
      
      // Update editor with cleaned content
      const wasAutoSave = this.autoSaveTimeout;
      this.autoSaveTimeout = null; // Temporarily disable auto-save
      
      this.interactiveEditor.setContent(cleanedContent, false);
      
      // Mark as dirty so it gets saved
      this.isDirty = true;
      
      // Re-enable auto-save
      setTimeout(() => {
        this.autoSaveTimeout = wasAutoSave;
      }, 100);
      
      // Save the cleaned content to database
      setTimeout(() => {
        if (this.isDirty) {
          this.logging.info('💾 [CLEAN] Auto-salvando conteúdo limpo...', 'ScreenplayInteractive');
          this.save();
        }
      }, 500);
    }
  }

  loadInstancesFromMongoDB(): void {
    this.logging.info('📥 [SCREENPLAY] Carregando instâncias do MongoDB...', 'ScreenplayInteractive');

    // Only load agents if we have a current screenplay
    if (!this.currentScreenplay?.id) {
      this.logging.warn('⚠️ [SCREENPLAY] Nenhum roteiro carregado, não carregando agentes', 'ScreenplayInteractive');
      this.agentInstances.clear();
      this.updateLegacyAgentsFromInstances();
      this.updateAvailableEmojis();
      this.reloadAgentGame();
      return;
    }

    this.logging.info(`📥 [SCREENPLAY] Carregando agentes para roteiro: ${this.currentScreenplay.id}`, 'ScreenplayInteractive');

    this.agentService.loadAllInstances().subscribe({
      next: (instances: any[]) => {
        this.logging.info(`✅ [SCREENPLAY] ${instances.length} instâncias carregadas do MongoDB`, 'ScreenplayInteractive');
        this.logging.debug('🔍 [DEBUG] Todas as instâncias:', 'ScreenplayInteractive', instances.map(i => ({
          id: i.instance_id,
          emoji: i.emoji,
          screenplay_id: i.screenplay_id,
          cwd: i.cwd || i.config?.cwd || 'não definido'
        })));

        // BUG FIX: Instead of clearing all instances, merge with existing ones
        // This prevents race conditions where newly created agents are cleared before MongoDB sync
        const loadedInstanceIds = new Set<string>();

        instances.forEach((doc: any) => {
          this.logging.debug(`🔍 [DEBUG] Verificando agente: ${doc.emoji} ${doc.agent_id} (roteiro: ${doc.screenplay_id})`, 'ScreenplayInteractive');
          
          // Only load agents that belong to the current screenplay
          if (doc.screenplay_id === this.currentScreenplay?.id) {
            const instance: AgentInstance = {
              id: doc.instance_id,
              agent_id: doc.agent_id,
              emoji: doc.emoji,
              definition: doc.definition || {
                title: doc.agent_id,
                description: '',
                unicode: ''
              },
              status: doc.status || 'pending',
              position: doc.position,
              config: {
                cwd: doc.cwd || doc.config?.cwd,
                createdAt: doc.created_at ? new Date(doc.created_at) : new Date(), // BUG FIX: Map created_at from MongoDB
                updatedAt: doc.updated_at ? new Date(doc.updated_at) : new Date()
              },
              executionState: doc.execution_state,
              is_system_default: doc.is_system_default || false, // SAGA-006: Load system default flag
              is_hidden: doc.is_hidden || false // SAGA-006: Load hidden flag
            };

            this.agentInstances.set(instance.id, instance);
            loadedInstanceIds.add(instance.id);
            this.logging.info(`✅ [SCREENPLAY] Agente carregado: ${instance.emoji} ${instance.definition.title} (${instance.id}) - CWD: ${instance.config?.cwd || 'não definido'}`, 'ScreenplayInteractive');
          } else {
            this.logging.debug(`⏭️ [SCREENPLAY] Agente ignorado (roteiro diferente): ${doc.emoji} ${doc.agent_id} (roteiro: ${doc.screenplay_id})`, 'ScreenplayInteractive');
          }
        });
        
        // Remove only agents that are NOT in MongoDB and NOT just created
        // Keep recently created agents that haven't synced to MongoDB yet
        const idsToRemove: string[] = [];
        for (const [id, instance] of this.agentInstances.entries()) {
          if (!loadedInstanceIds.has(id)) {
            // Check if this agent was recently created (within last 5 seconds)
            const createdAt = instance.config?.createdAt;
            const isRecent = createdAt && (new Date().getTime() - new Date(createdAt).getTime()) < 5000;
            
            if (!isRecent) {
              idsToRemove.push(id);
              this.logging.debug(`🗑️ [SCREENPLAY] Removendo agente não encontrado no MongoDB: ${id}`, 'ScreenplayInteractive');
            } else {
              this.logging.debug(`⏳ [SCREENPLAY] Mantendo agente recém-criado (aguardando sync): ${id}`, 'ScreenplayInteractive');
            }
          }
        }
        
        idsToRemove.forEach(id => this.agentInstances.delete(id));

        this.logging.info(`✅ [SCREENPLAY] ${this.agentInstances.size} instâncias carregadas na memória para roteiro ${this.currentScreenplay?.id}`, 'ScreenplayInteractive');

        // BUG FIX: Clean orphaned anchors from markdown after loading agents from database
        this.cleanOrphanedAnchorsFromMarkdown();

        // Update legacy structures for UI
        this.updateLegacyAgentsFromInstances();
        this.updateAvailableEmojis();

        // Reload agents in the game component
        this.reloadAgentGame();

        // Auto-select first agent after loading (universal solution)
        if (this.agentInstances.size > 0) {
          this.logging.info('🎯 [LOAD-AGENTS] Auto-selecting first agent after loading from MongoDB...', 'ScreenplayInteractive');
          setTimeout(() => {
            this.autoSelectFirstAgent();
          }, 300);
        } else {
          // BUG FIX: If no agents found for this screenplay, create default agent
          this.logging.info('🤖 [LOAD-AGENTS] No agents found for screenplay, creating default agent...', 'ScreenplayInteractive');
          setTimeout(async () => {
            await this.createDefaultAgentInstance();
            this.logging.info('✅ [LOAD-AGENTS] Default agent created for screenplay without agents', 'ScreenplayInteractive');
          }, 300);
        }

      },
      error: (error) => {
        this.logging.error('❌ [SCREENPLAY] Falha ao carregar do MongoDB:', error, 'ScreenplayInteractive');
      }
    });
  }


  // === Agent Execution Integration ===


  /**
   * Update agent instances with execution state from service
   */
  private updateAgentInstancesWithExecutionState(agentStates: Map<string, AgentExecutionState>): void {
    for (const [agentId, executionState] of agentStates.entries()) {
      const instance = this.agentInstances.get(agentId);
      if (instance) {
        instance.executionState = executionState;
        instance.status = executionState.status;

        // NOTE: Agent game movement is now controlled by task polling (checkProcessingTasks)
        // which checks /api/tasks/processing every 2 seconds for accurate real-time status
      }
    }

    // Update legacy agents array for UI compatibility
    this.updateLegacyAgentsFromInstances();
  }

  /**
   * Cancel agent execution
   */
  cancelAgentExecution(agentId: string): void {
    this.agentExecutionService.cancelAgent(agentId);
  }

  /**
   * Get execution logs for an agent
   */
  getAgentExecutionLogs(agentId: string): string[] {
    const instance = this.agentInstances.get(agentId);
    return instance?.executionState?.logs || [];
  }

  /**
   * Check if agent is currently executing
   */
  isAgentExecuting(agentId: string): boolean {
    const instance = this.agentInstances.get(agentId);
    return instance?.status === 'running' || instance?.status === 'queued';
  }

  /**
   * Get all running agents
   */
  getRunningAgents(): AgentInstance[] {
    return Array.from(this.agentInstances.values()).filter(agent => agent.status === 'running');
  }

  /**
   * Get all queued agents
   */
  getQueuedAgents(): AgentInstance[] {
    return Array.from(this.agentInstances.values()).filter(agent => agent.status === 'queued');
  }

  /**
   * Start polling for processing tasks to update agent movement
   */
  private startTaskPolling(): void {
    // Poll every 2 seconds
    this.taskPollingInterval = setInterval(() => {
      this.checkProcessingTasks();
    }, 2000);

    // Execute immediately on start
    this.checkProcessingTasks();
  }

  /**
   * Check for processing tasks and update agent movement accordingly
   */
  private async checkProcessingTasks(): Promise<void> {
    try {
      const baseUrl = this.agentService['baseUrl'] || '';
      const url = `${baseUrl}/api/tasks/processing`;

      const response = await this.http.get<{
        success: boolean;
        count: number;
        tasks: Array<{
          _id: string;
          instance_id: string;
          agent_id: string;
          status: string;
          created_at: string;
          started_at?: string;
          prompt?: string;
        }>;
      }>(url).toPromise();

      if (response && response.success && response.tasks) {
        // Get all instance_ids that are currently processing
        const processingInstanceIds = new Set(
          response.tasks.map(task => task.instance_id)
        );

        // Update agent-game for all agents
        if (this.agentGame) {
          this.agentInstances.forEach((instance, instanceId) => {
            const isProcessing = processingInstanceIds.has(instanceId);
            this.agentGame.setAgentActive(instanceId, isProcessing);
          });
        }

        // Log processing tasks (only if there are any)
        if (processingInstanceIds.size > 0) {
          this.logging.info(
            `🎮 [TASK-POLLING] ${processingInstanceIds.size} agent(s) processing`,
            'ScreenplayInteractive',
            { instanceIds: Array.from(processingInstanceIds) }
          );
        }
      }
    } catch (error) {
      // Silently fail - don't spam logs on network errors
      // Only log if it's not a common network issue
      if (error && (error as any).status !== 0) {
        this.logging.warn('⚠️ [TASK-POLLING] Error checking tasks:', 'ScreenplayInteractive', error);
      }
    }
  }

  /**
   * Get tooltip text for an agent based on its current status
   */
  getAgentTooltip(agent: AgentInstance): string {
    const baseText = `${agent.definition.title} - ${agent.definition.description}`;

    switch (agent.status) {
      case 'queued':
        return `${baseText} (Na fila para execução)`;
      case 'running':
        return `${baseText} (Executando...)`;
      case 'completed':
        return `${baseText} (Concluído)`;
      case 'error':
        return `${baseText} (Erro na execução)`;
      default:
        return `${baseText} (Duplo clique para executar)`;
    }
  }

  getAgentCwdDisplay(agent: AgentInstance): string {
    const cwd = agent.config?.cwd || '';
    if (cwd.length > 20) {
      return cwd.slice(0, 20) + '...';
    }
    return cwd;
  }

  // === Splitter methods ===

  onSplitterMouseDown(event: MouseEvent): void {
    event.preventDefault();
    this.isDraggingSplitter = true;
  }

  @HostListener('document:mousemove', ['$event'])
  onDocumentMouseMove(event: MouseEvent): void {
    if (!this.isDraggingSplitter) return;

    const containerWidth = window.innerWidth;
    const newScreenplayWidth = (event.clientX / containerWidth) * 100;

    // Limitar entre 30% e 80%
    if (newScreenplayWidth >= 30 && newScreenplayWidth <= 80) {
      this.screenplayWidth = newScreenplayWidth;
      this.chatWidth = 100 - newScreenplayWidth;
    }
  }

  @HostListener('document:mouseup')
  onDocumentMouseUp(): void {
    this.isDraggingSplitter = false;
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(event: Event): void {
    // Close screenplay info modal if open
    if (this.showScreenplayInfoModal) {
      this.closeScreenplayInfoModal();
      event.preventDefault();
      return;
    }

    // Close delete confirmation modal if open
    if (this.showDeleteConfirmModal) {
      this.closeDeleteConfirmModal();
      event.preventDefault();
      return;
    }

    // ESC não desseleciona o agente para manter configurações e tarja amarela visíveis
    // O usuário pode clicar em outro agente ou fechar manualmente se desejar
    this.logging.debug('⎋ ESC pressed - agent remains selected', 'ScreenplayInteractive');

    // Don't prevent default or stop propagation to allow child components to handle ESC
    // This allows modals and dialogs to close properly
  }

  // === Keyboard Shortcuts for Screenplay Management ===

  @HostListener('document:keydown.control.s', ['$event'])
  @HostListener('document:keydown.meta.s', ['$event'])
  handleSaveShortcut(event: Event): void {
    event.preventDefault();
    if (this.isDirty) {
      this.logging.info('💾 Ctrl/Cmd+S pressed - Saving screenplay', 'ScreenplayInteractive');
      this.save();
    }
  }

  @HostListener('document:keydown.control.o', ['$event'])
  @HostListener('document:keydown.meta.o', ['$event'])
  handleOpenShortcut(event: Event): void {
    event.preventDefault();
    this.logging.info('📚 Ctrl/Cmd+O pressed - Opening screenplay manager', 'ScreenplayInteractive');
    this.openScreenplayManager();
  }

  @HostListener('document:keydown.control.n', ['$event'])
  @HostListener('document:keydown.meta.n', ['$event'])
  handleNewShortcut(event: Event): void {
    event.preventDefault();
    this.logging.info('📝 Ctrl/Cmd+N pressed - Creating new screenplay', 'ScreenplayInteractive');
    this.newScreenplayWithDefaultAgent();
  }

  @HostListener('document:keydown.control.shift.a', ['$event'])
  @HostListener('document:keydown.meta.shift.a', ['$event'])
  handleAddAgentShortcut(event: Event): void {
    event.preventDefault();
    this.logging.info('➕ Ctrl/Cmd+Shift+A pressed - Adding agent', 'ScreenplayInteractive');
    this.openAgentSelector();
  }

  @HostListener('document:keydown.control.e', ['$event'])
  @HostListener('document:keydown.meta.e', ['$event'])
  handleExportShortcut(event: Event): void {
    event.preventDefault();
    this.logging.info('💾 Ctrl/Cmd+E pressed - Exporting to disk', 'ScreenplayInteractive');
    this.exportToDisk();
  }

  /**
   * SAGA-006: Create default agent instance for new screenplays
   */
  private async createDefaultAgentInstance(): Promise<void> {
    this.logging.info('🤖 [DEFAULT AGENT] Creating default agent instance', 'ScreenplayInteractive');
    
    try {
      // Check if we already have a default agent for this screenplay
      const existingDefaultAgent = Array.from(this.agentInstances.values())
        .find(agent => agent.is_system_default === true && agent.agent_id === 'ScreenplayAssistant_Agent');
      
      if (existingDefaultAgent) {
        this.logging.warn('⚠️ [DEFAULT AGENT] Default agent already exists for this screenplay, skipping creation', 'ScreenplayInteractive', {
          existingAgentId: existingDefaultAgent.id,
          existingAgentEmoji: existingDefaultAgent.emoji
        });
        return;
      }
      
      // Generate instance ID
      const instanceId = this.generateUUID();
      
      // Default agent configuration
      const agentId = 'ScreenplayAssistant_Agent';
      const emoji = '🎬';
      const position: CirclePosition = { x: 100, y: 100 };
      
      // BUG FIX: Create agent instance in memory FIRST (before inserting emoji)
      // This prevents syncAgentsWithMarkdown from creating a duplicate instance
      const defaultInstance: AgentInstance = {
        id: instanceId,
        agent_id: agentId,
        emoji: emoji,
        definition: {
          title: 'Assistente de Roteiro',
          description: 'Agente especializado em ajudar com roteiros e narrativas',
          unicode: '\\u{1F3AC}'
        },
        status: 'pending',
        position: position,
        is_system_default: true, // SAGA-006: Mark as system default
        is_hidden: false, // SAGA-006: Not hidden by default
        config: {
          createdAt: new Date(),
          updatedAt: new Date()
        }
      };
      
      // Add to agent instances BEFORE inserting template
      this.agentInstances.set(instanceId, defaultInstance);
      
      // Create in MongoDB with system default flags (before template insertion)
      this.createDefaultAgentInstanceInMongoDB(instanceId, agentId, position);
      
      // Update structures BEFORE inserting template to ensure dock is ready
      this.updateLegacyAgentsFromInstances();
      this.updateAvailableEmojis();
      this.updateAgentDockLists();
      
      // Add agent to the game map
      this.logging.info('🎮 [AGENT-GAME] Checking if agentGame is available...', 'ScreenplayInteractive', {
        agentGameExists: !!this.agentGame,
        agentGameType: typeof this.agentGame,
        defaultInstanceId: defaultInstance.id,
        defaultInstanceEmoji: defaultInstance.emoji
      });
      
      if (this.agentGame) {
        this.logging.info('🎮 [AGENT-GAME] Adding default agent to game map...', 'ScreenplayInteractive');
        this.agentGame.addAgent({
          emoji: defaultInstance.emoji,
          name: defaultInstance.definition.title,
          agentId: defaultInstance.agent_id ?? 'unknown',
          screenplayId: this.currentScreenplay?.id || 'unknown',
          instanceId: defaultInstance.id
        });
        this.logging.info('🎮 [AGENT-GAME] Default agent added to game map successfully', 'ScreenplayInteractive');
      } else {
        this.logging.warn('⚠️ [AGENT-GAME] agentGame is not available, cannot add agent to game', 'ScreenplayInteractive');
      }
      
      // SAGA-006: Insert template into editor AFTER everything is set up
      this.insertEmojiIntoEditor(emoji, instanceId);
      
      // Auto-activate the default agent in chat
      this.activateDefaultAgent(defaultInstance);
      
      this.logging.info('✅ [DEFAULT AGENT] Default agent instance created and activated', 'ScreenplayInteractive', {
        instanceId: defaultInstance.id,
        agentId: defaultInstance.agent_id,
        emoji: defaultInstance.emoji
      });
      
    } catch (error) {
      this.logging.error('❌ [DEFAULT AGENT] Error creating default agent instance:', error, 'ScreenplayInteractive');
    }
  }

  /**
   * SAGA-006: Insert initial template for default agent
   * Creates a clean screenplay with title and example text
   * ONLY inserts template if editor is empty (for new screenplays)
   */
  private insertEmojiIntoEditor(emoji: string, instanceId: string): void {
    this.logging.info('📝 [DEFAULT AGENT] Checking if template should be inserted:', 'ScreenplayInteractive', {
      emoji,
      instanceId,
      agentId: 'ScreenplayAssistant_Agent',
      currentContentLength: this.editorContent.length
    });
    
    // BUG FIX: Only insert template if editor is empty
    // For imported screenplays, keep the existing content
    const currentContent = this.interactiveEditor.getMarkdown().trim();
    if (currentContent && currentContent.length > 0) {
      this.logging.info('ℹ️ [DEFAULT AGENT] Editor has content, skipping template insertion (imported screenplay)', 'ScreenplayInteractive', {
        contentLength: currentContent.length
      });
      return;
    }
    
    this.logging.info('📝 [DEFAULT AGENT] Editor is empty, inserting initial template...', 'ScreenplayInteractive');
    
    // Insert a clean template with title and example text
    // NO emojis in template to avoid confusion with syncAgentsWithMarkdown
    const templateContent = `<h1>📝 Novo Roteiro</h1>

<p>Bem-vindo ao seu roteiro! Use o chat à direita para interagir com o <strong>Assistente de Roteiro</strong>.</p>

<h2>Como usar</h2>

<ul>
<li>Digite suas ideias e desenvolvimento do roteiro aqui</li>
<li>Use o chat lateral para pedir ajuda ao assistente</li>
<li>O assistente pode ajudar com estrutura, diálogos, e desenvolvimento de cenas</li>
<li>Adicione mais agentes ao roteiro usando o botão "➕ Adicionar Agente"</li>
</ul>

<p><strong>Dica:</strong> Todos os agentes vinculados ao roteiro aparecem na barra lateral direita!</p>
`;
    
    this.interactiveEditor.setContent(templateContent, false);
    
    // Update editor content to trigger sync
    this.editorContent = this.interactiveEditor.getMarkdown();
    
    this.logging.info('✅ [DEFAULT AGENT] Template inserted into editor', 'ScreenplayInteractive');
  }

  /**
   * SAGA-006: Activate default agent in chat panel
   */
  private activateDefaultAgent(agent: AgentInstance): void {
    this.logging.info('🎯 [DEFAULT AGENT] Activating default agent in chat', 'ScreenplayInteractive');
    
    // Set as active agent
    this.activeAgentId = agent.id;
    
    // Load context in chat
    if (this.conductorChat) {
      this.conductorChat.loadContextForAgent(
        agent.id,
        agent.definition.title,
        agent.emoji,
        agent.agent_id,
        undefined, // cwd
        this.currentScreenplay?.id // SAGA-006: Pass screenplay ID for document association
      );
    }
    
    // Auto-select the agent in the dock to ensure chat is loaded
    // This simulates clicking on the dock-item with class="dock-item active"
    setTimeout(() => {
      this.autoSelectDefaultAgent(agent);
    }, 500); // Increased delay to ensure the agent is fully loaded and UI is ready
    
    this.logging.info('✅ [DEFAULT AGENT] Default agent activated in chat', 'ScreenplayInteractive');
  }

  /**
   * Auto-select the default agent in the dock to ensure chat is loaded
   * This simulates the user clicking on the dock-item
   */
  private autoSelectDefaultAgent(agent: AgentInstance): void {
    this.logging.info('🔄 [AUTO-SELECT] Auto-selecting default agent in dock:', 'ScreenplayInteractive', {
      title: agent.definition.title,
      agentId: agent.id,
      emoji: agent.emoji,
      agent_agent_id: agent.agent_id,
      cwd: agent.config?.cwd,
      currentScreenplayId: this.currentScreenplay?.id,
      conductorChatAvailable: !!this.conductorChat
    });
    
    // Ensure the agent is in the contextual agents list
    if (!this.contextualAgents.find(a => a.id === agent.id)) {
      this.logging.warn('⚠️ [AUTO-SELECT] Agent not found in contextual agents, updating dock lists...', 'ScreenplayInteractive');
      this.updateAgentDockLists();
      this.logging.debug('   - Contextual agents after update:', 'ScreenplayInteractive', this.contextualAgents.map(a => `${a.emoji} ${a.definition.title} (${a.id})`));
    }
    
    // Simulate the dock click by calling the same function
    this.logging.debug('🎯 [AUTO-SELECT] Calling onDockAgentClick to simulate user click...', 'ScreenplayInteractive');
    this.onDockAgentClick(agent);
    
    this.logging.info('✅ [AUTO-SELECT] Default agent auto-selected in dock', 'ScreenplayInteractive');
  }

  /**
   * Auto-select first agent after loading agents
   * Universal solution that works for all flows
   */
  private autoSelectFirstAgent(): void {
    this.logging.info('🎯 [AUTO-SELECT-FIRST] Auto-selecting first available agent...', 'ScreenplayInteractive', {
      currentScreenplayId: this.currentScreenplay?.id,
      totalInstances: this.agentInstances.size,
      availableAgents: Array.from(this.agentInstances.values()).map(a => `${a.emoji} ${a.definition.title}`)
    });
    
    if (this.agentInstances.size === 0) {
      this.logging.warn('⚠️ [AUTO-SELECT-FIRST] No agents available to select', 'ScreenplayInteractive');
      return;
    }
    
    // Get the first agent from the instances
    const firstAgent = Array.from(this.agentInstances.values())[0];
    
    this.logging.info('✅ [AUTO-SELECT-FIRST] Selecting first agent:', 'ScreenplayInteractive', {
      title: firstAgent.definition.title,
      agentId: firstAgent.id,
      emoji: firstAgent.emoji,
      conductorChatAvailable: !!this.conductorChat
    });
    
    // Auto-select the first agent
    this.autoSelectDefaultAgent(firstAgent);
  }

  /**
   * SAGA-006: Hide agent instead of deleting (for system default agents)
   */
  hideAgent(instanceId: string): void {
    const instance = this.agentInstances.get(instanceId);
    if (instance) {
      instance.is_hidden = true;
      this.logging.info('👻 Agent hidden:', 'ScreenplayInteractive', instanceId);
    }
  }
}