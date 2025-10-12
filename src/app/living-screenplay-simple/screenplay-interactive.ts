import { Component, ViewChild, ElementRef, AfterViewInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DraggableCircle, CircleData, CirclePosition, CircleEvent } from '../examples/draggable-circles/draggable-circle.component';
import { InteractiveEditor } from '../interactive-editor/interactive-editor';
import { AgentExecutionService, AgentExecutionState } from '../services/agent-execution';
import { AgentCreatorComponent, AgentCreationData } from './agent-creator/agent-creator.component';
import { AgentSelectorModalComponent, AgentSelectionData } from './agent-selector-modal/agent-selector-modal.component';
import { AgentPreviewModalComponent, PreviewData, PreviewAction } from './agent-preview-modal/agent-preview-modal.component';
import { AgentService } from '../services/agent.service';
import { ConductorChatComponent } from '../shared/conductor-chat/conductor-chat.component';
import { ScreenplayService } from '../services/screenplay/screenplay.service';
import { ScreenplayStorage, Screenplay } from '../services/screenplay-storage';
import { ScreenplayManager, ScreenplayManagerEvent } from './screenplay-manager/screenplay-manager';
import { Subscription } from 'rxjs';

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
  imports: [CommonModule, DraggableCircle, InteractiveEditor, AgentCreatorComponent, AgentSelectorModalComponent, AgentPreviewModalComponent, ConductorChatComponent, ScreenplayManager],
  template: `
    <div class="screenplay-layout">
      <div class="screenplay-container" [style.width.%]="screenplayWidth">
        <div class="control-panel">
        <h3>🎬 Roteiro Vivo</h3>

        <div class="file-controls">
          <button (click)="openScreenplayManager()" class="control-btn">
            📚 Gerenciar Roteiros
          </button>
          <button (click)="saveCurrentScreenplay()" class="control-btn save-btn" *ngIf="currentScreenplay && isDirty">
            💾 Salvar
          </button>
          <div class="current-file" *ngIf="currentScreenplay">
            📄 {{ currentScreenplay.name }}
            <span class="dirty-indicator" *ngIf="isDirty">●</span>
            <span class="save-status" *ngIf="isSaving">Salvando...</span>
          </div>
        </div>

        <div class="agent-controls">
          <h4>🤖 Agentes ({{ agents.length }})</h4>
          <button (click)="openAgentCreator()" class="control-btn create-agent-btn">
            ✨ Criar Agente Personalizado
          </button>
          <button (click)="openAgentSelector()" class="control-btn add-agent-btn">
            ➕ Adicionar Agente
          </button>
          <button (click)="resyncManually()" class="control-btn">
            🔄 Ressincronizar com Texto
          </button>
          <button (click)="clearAllAgents()" class="control-btn" *ngIf="agents.length > 0">
            🗑️ Limpar Todos
          </button>

          <!-- Agent execution status -->
          <div class="execution-status" *ngIf="getRunningAgents().length > 0">
            <small>Em execução:</small>
            <div class="running-agents">
              <div *ngFor="let agent of getRunningAgents()" class="running-agent">
                {{ agent.emoji }} {{ agent.definition.title }}
                <button (click)="cancelAgentExecution(agent.id)" class="cancel-btn" title="Cancelar">❌</button>
              </div>
            </div>
          </div>

          <!-- Queue status -->
          <div class="queue-status" *ngIf="getQueuedAgents().length > 0">
            <small>Na fila ({{ getQueuedAgents().length }}):</small>
            <div class="queued-agents">
              <div *ngFor="let agent of getQueuedAgents(); let i = index" class="queued-agent">
                {{ agent.emoji }} {{ agent.definition.title }} ({{ i + 1 }})
              </div>
            </div>
          </div>
          <div class="emoji-list" *ngIf="availableEmojis.length > 0">
            <small>Emojis encontrados:</small>
            <div class="emoji-buttons">
              <div *ngFor="let emojiInfo of availableEmojis" class="emoji-group">
                <button
                  (click)="createAgentsForEmoji(emojiInfo)"
                  class="emoji-btn"
                  [class.has-some-agents]="hasSomeAgentsForEmoji(emojiInfo.emoji)"
                  [class.has-all-agents]="hasAllAgentsForEmoji(emojiInfo.emoji, emojiInfo.count)"
                  [title]="getEmojiTooltip(emojiInfo)">
                  {{ emojiInfo.emoji }}
                </button>
                <small class="emoji-count">{{ getAgentCountForEmoji(emojiInfo.emoji) }}/{{ emojiInfo.count }}</small>
              </div>
            </div>
          </div>
        </div>

        <div class="view-controls">
          <button
            [class.active]="currentView === 'clean'"
            (click)="switchView('clean')">
            📝 Roteiro Limpo
          </button>
          <button
            [class.active]="currentView === 'agents'"
            (click)="switchView('agents')">
            🤖 Com Agentes
          </button>
          <button
            [class.active]="currentView === 'full'"
            (click)="switchView('full')">
            🌐 Visão Completa
          </button>
        </div>
      </div>

      <div class="screenplay-canvas" #canvas>
        <div class="editor-content">
          <app-interactive-editor
            [content]="editorContent"
            [placeholder]="'Digite / para comandos ou comece a escrever o seu roteiro vivo...'"
            (contentChange)="handleContentUpdate($event)"
            (blockCommand)="onBlockCommand($event)">
          </app-interactive-editor>
        </div>

        <div class="overlay-elements" *ngIf="currentView !== 'clean'">
          <!-- Multiple draggable circles -->
          <draggable-circle
            *ngFor="let agent of getAgentInstancesAsArray()"
            [data]="{ id: agent.id, emoji: agent.emoji, title: agent.definition.title, description: agent.definition.description, category: 'auth' }"
            [position]="agent.position"
            [container]="canvas"
            [attr.data-status]="agent.status"
            [class.agent-queued]="agent.status === 'queued'"
            [class.agent-running]="agent.status === 'running'"
            [class.agent-completed]="agent.status === 'completed'"
            [class.agent-error]="agent.status === 'error'"
            [title]="getAgentTooltip(agent)"
            (circleEvent)="onAgentInstanceCircleEvent($event, agent)"
            (positionChange)="onAgentInstancePositionChange($event, agent)">
          </draggable-circle>

          <!-- Agent info badges (cwd only, no context menu button) -->
          <div
            *ngFor="let agent of getAgentInstancesAsArray()"
            class="agent-badge"
            [style.left.px]="agent.position.x + 50"
            [style.top.px]="agent.position.y - 10">
            <div class="cwd-badge" *ngIf="agent.config?.cwd" [title]="agent.config?.cwd || ''">
              📁 {{ getAgentCwdDisplay(agent) }}
            </div>
          </div>
        </div>
      </div>

      <!-- Popup para hover -->
      <div class="action-popup"
           *ngIf="popupVisible"
           [style.left.px]="popupX"
           [style.top.px]="popupY">
        {{ popupText }}
        <div class="popup-arrow"></div>
      </div>

      <!-- Agent Creator Modal -->
      <app-agent-creator
        [isVisible]="showAgentCreator"
        (agentCreated)="onAgentCreated($event)"
        (close)="closeAgentCreator()">
      </app-agent-creator>

      <!-- Agent Selector Modal -->
      <app-agent-selector-modal
        [isVisible]="showAgentSelector"
        (agentSelected)="onAgentSelected($event)"
        (close)="closeAgentSelector()">
      </app-agent-selector-modal>

      <!-- Agent Preview Modal -->
      <app-agent-preview-modal
        [isVisible]="showAgentPreview"
        [previewData]="previewData"
        [isLoading]="previewLoading"
        [error]="previewError"
        (accept)="onPreviewAccept($event)"
        (reject)="onPreviewReject($event)"
        (close)="closeAgentPreview()">
      </app-agent-preview-modal>

      <!-- Screenplay Manager Modal -->
      <app-screenplay-manager
        [isVisible]="showScreenplayManager"
        (close)="closeScreenplayManager()"
        (action)="onScreenplayManagerAction($event)">
      </app-screenplay-manager>
      </div>

      <!-- Resizable splitter -->
      <div class="splitter" (mousedown)="onSplitterMouseDown($event)"></div>

      <!-- Chat component -->
      <div class="chat-panel" [style.width.%]="chatWidth">
        <app-conductor-chat #conductorChat></app-conductor-chat>
      </div>
    </div>
  `,
  styles: [`
    /* Força fontes de emoji em todo o componente */
    :host {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', 'Segoe UI Symbol', 'Android Emoji', 'EmojiSymbols' !important;
    }

    .screenplay-layout {
      display: flex;
      height: 100vh;
      width: 100%;
      overflow: hidden;
    }

    .screenplay-container {
      display: flex;
      height: 100vh;
      background: #fafbfc;
      font-family: inherit !important;
      transition: width 0.1s ease-out;
    }

    .splitter {
      width: 6px;
      background: #e1e4e8;
      cursor: col-resize;
      flex-shrink: 0;
      transition: background 0.2s;
      position: relative;
    }

    .splitter:hover {
      background: #a8b9ff;
    }

    .splitter::before {
      content: '';
      position: absolute;
      left: 2px;
      top: 50%;
      transform: translateY(-50%);
      width: 2px;
      height: 40px;
      background: white;
      border-radius: 2px;
    }

    .chat-panel {
      height: 100vh;
      overflow: hidden;
      transition: width 0.1s ease-out;
      flex-shrink: 0;
    }

    .control-panel {
      width: 280px;
      background: #f0f3f7;
      color: #2c3e50;
      padding: 20px;
      overflow-y: auto;
      flex-shrink: 0;
      border-right: 1px solid #e1e4e8;

      /* Força fontes de emoji em todo o painel */
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', 'Segoe UI Symbol', 'Android Emoji', 'EmojiSymbols' !important;
    }

    .control-panel h3 {
      margin: 0 0 20px 0;
      color: #5a67d8;
      font-size: 18px;
      font-weight: 600;
    }

    .control-panel h4 {
      margin: 20px 0 10px 0;
      color: #48bb78;
      font-size: 14px;
      font-weight: 600;
    }

    .file-controls {
      margin-bottom: 20px;
      border-bottom: 1px solid #d1d5db;
      padding-bottom: 15px;
    }

    .agent-controls {
      margin-bottom: 20px;
      border-bottom: 1px solid #d1d5db;
      padding-bottom: 15px;
    }

    .view-controls {
      margin-bottom: 20px;
    }

    .control-btn {
      display: block;
      width: 100%;
      padding: 10px 12px;
      margin-bottom: 8px;
      border: 1px solid #cbd5e0;
      border-radius: 8px;
      background: #ffffff;
      color: #4a5568;
      cursor: pointer;
      font-size: 12px;
      text-align: left;
      transition: all 0.2s;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);

      /* Força fontes de emoji nos botões */
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', 'Segoe UI Symbol', 'Android Emoji', 'EmojiSymbols' !important;
    }

    .control-btn:hover {
      background: #f7fafc;
      border-color: #a0aec0;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
    }

    .control-btn.active {
      background: #ebf4ff;
      border-color: #7c9ff6;
      color: #2d3748;
    }

    .create-agent-btn {
      background: #e9d8fd !important;
      border-color: #b794f4 !important;
      color: #553c9a !important;
    }

    .create-agent-btn:hover {
      background: #d6bcfa !important;
      border-color: #9f7aea !important;
    }

    .add-agent-btn {
      background: #c6f6d5 !important;
      border-color: #68d391 !important;
      color: #276749 !important;
    }

    .add-agent-btn:hover {
      background: #9ae6b4 !important;
      border-color: #48bb78 !important;
    }

    .current-file {
      margin-top: 10px;
      padding: 8px;
      background: #fef3c7;
      border-radius: 6px;
      font-size: 11px;
      color: #92400e;
      border: 1px solid #fcd34d;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .dirty-indicator {
      color: #f59e0b;
      font-size: 16px;
      animation: pulse 2s infinite;
    }

    .save-status {
      color: #10b981;
      font-size: 10px;
      font-weight: 600;
    }

    .save-btn {
      background: #10b981 !important;
      border-color: #059669 !important;
      color: white !important;
    }

    .save-btn:hover {
      background: #059669 !important;
      border-color: #047857 !important;
    }

    .emoji-list {
      margin-top: 15px;
    }

    .emoji-list small {
      color: #6b7280;
      font-size: 10px;
      display: block;
      margin-bottom: 8px;
    }

    .emoji-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .emoji-group {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
    }

    .emoji-btn {
      width: 35px;
      height: 35px;
      border: 1px solid #cbd5e0;
      border-radius: 50%;
      background: #ffffff;
      cursor: pointer;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);

      /* Força fontes de emoji para renderização correta */
      font-family: 'emoji', 'Noto Color Emoji', 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', sans-serif !important;
    }

    .emoji-btn:hover {
      background: #f7fafc;
      transform: scale(1.1);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .emoji-btn.has-some-agents {
      border-color: #fbbf24;
      background: #fef3c7;
    }

    .emoji-btn.has-all-agents {
      border-color: #68d391;
      background: #c6f6d5;
    }

    .emoji-count {
      color: #6b7280;
      font-size: 9px;
    }

    .execution-status, .queue-status {
      margin-top: 15px;
      padding: 10px;
      background: #d1fae5;
      border-radius: 6px;
      border-left: 3px solid #48bb78;
    }

    .execution-status small, .queue-status small {
      color: #065f46;
      font-weight: 600;
      display: block;
      margin-bottom: 5px;
    }

    .running-agent, .queued-agent {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 4px 0;
      font-size: 11px;
      color: #1f2937;
    }

    .cancel-btn {
      background: none;
      border: none;
      font-size: 10px;
      cursor: pointer;
      opacity: 0.7;
      transition: opacity 0.2s;
    }

    .cancel-btn:hover {
      opacity: 1;
    }

    .screenplay-canvas {
      flex: 1;
      position: relative;
      background: #ffffff;
      overflow: auto;
    }

    .editor-content {
      height: 100%;
      position: relative;
      z-index: 1;
    }

    .overlay-elements {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      pointer-events: none;
      z-index: 10;
    }

    .overlay-elements draggable-circle {
      pointer-events: auto;
    }

    /* Agent status indicators */
    .overlay-elements draggable-circle.agent-queued::after {
      content: '⏳';
      position: absolute;
      top: -5px;
      right: -5px;
      font-size: 12px;
      background: #fef3c7;
      border: 2px solid #fbbf24;
      border-radius: 50%;
      width: 18px;
      height: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: pulse 2s infinite;
    }

    .overlay-elements draggable-circle.agent-running::after {
      content: '⚡';
      position: absolute;
      top: -5px;
      right: -5px;
      font-size: 12px;
      background: #dbeafe;
      border: 2px solid #60a5fa;
      border-radius: 50%;
      width: 18px;
      height: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: spin 1s linear infinite;
    }

    .overlay-elements draggable-circle.agent-completed::after {
      content: '✅';
      position: absolute;
      top: -5px;
      right: -5px;
      font-size: 12px;
      background: #d1fae5;
      border: 2px solid #68d391;
      border-radius: 50%;
      width: 18px;
      height: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .overlay-elements draggable-circle.agent-error::after {
      content: '❌';
      position: absolute;
      top: -5px;
      right: -5px;
      font-size: 12px;
      background: #fee2e2;
      border: 2px solid #f87171;
      border-radius: 50%;
      width: 18px;
      height: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    @keyframes pulse {
      0% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.7; transform: scale(1.1); }
      100% { opacity: 1; transform: scale(1); }
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .action-popup {
      position: fixed;
      background: #1f2937;
      color: #f9fafb;
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 12px;
      z-index: 1000;
      pointer-events: none;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .popup-arrow {
      position: absolute;
      bottom: -5px;
      left: 50%;
      transform: translateX(-50%);
      width: 0;
      height: 0;
      border-left: 5px solid transparent;
      border-right: 5px solid transparent;
      border-top: 5px solid #1f2937;
    }

    /* Agent badges */
    .agent-badge {
      position: absolute;
      pointer-events: none;
      z-index: 15;
    }

    .cwd-badge {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 10px;
      font-weight: 500;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      white-space: nowrap;
      font-family: 'Courier New', monospace;
      max-width: 150px;
      overflow: hidden;
      text-overflow: ellipsis;
      pointer-events: auto;
    }

  `]
})
export class ScreenplayInteractive implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvas!: ElementRef;
  @ViewChild(InteractiveEditor) private interactiveEditor!: InteractiveEditor;
  @ViewChild(ConductorChatComponent) conductorChat!: ConductorChatComponent;

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

  // Text selection context for agent execution
  private selectedText: string = '';
  private selectedTextRange: { start: number; end: number } | null = null;
  private activeAgentForExecution: AgentInstance | null = null;

  // Persistência
  markdownAgentMap: MarkdownAgentMap = {};

  // Timeout para debounce
  private updateTimeout: any;
  private autoSaveTimeout: any;

  // Simulates MongoDB 'agent_instances' collection
  private agentInstances = new Map<string, AgentInstance>();

  // Agent execution service integration
  private agentStateSubscription?: Subscription;
  public selectedAgent: AgentInstance | null = null;

  // Conteúdo do editor (fonte da verdade)
  editorContent = `# 🎬 Roteiro Vivo Interativo

## 📝 Sistema de Propostas IA

Este é um ambiente onde você pode:

- ✨ Criar propostas de IA interativas
- ▶️ Definir gatilhos de execução
- 📦 Incluir sub-roteiros
- 🎯 Gerenciar agentes visuais

### Demo com README Resume Agent

Clique no agente abaixo para carregar o contexto e depois digite uma mensagem no chat:

<!-- agent-instance: 8ea9e2b4-3458-48dd-9b90-382974c8d43e, agent-id: ReadmeResume_Agent -->
📄 **README Resume Agent** - Analisa e resume arquivos README de projetos

### Exemplo de Agentes

Aqui temos alguns agentes distribuídos pelo documento:

🚀 **Performance Agent** - Monitora performance da aplicação
🔐 **Auth Agent** - Gerencia autenticação de usuários
📊 **Analytics Agent** - Coleta métricas de uso
🛡️ **Security Agent** - Verifica vulnerabilidades
⚡ **Speed Agent** - Otimiza velocidade de resposta

### Como usar

1. **Clique** em um emoji para selecionar o agente e carregar seu contexto no chat
2. **Digite** sua mensagem no chat para executar o agente diretamente
3. **Arraste** os círculos dos agentes para reposicionar
4. Use "➕ Adicionar Agente" no painel lateral para inserir novos agentes
5. Salve e carregue diferentes arquivos markdown

> 💡 **Dica**: Use "Roteiro Limpo" para ver apenas o texto!
`;

  constructor(
    private agentExecutionService: AgentExecutionService,
    private screenplayService: ScreenplayService,
    private agentService: AgentService,
    private screenplayStorage: ScreenplayStorage
  ) {
    // Subscribe to agent execution state changes
    this.agentStateSubscription = this.agentExecutionService.agentState$.subscribe(
      (agentStates) => this.updateAgentInstancesWithExecutionState(agentStates)
    );

    // Load agent definitions from MongoDB
    this.loadAgentDefinitions();
  }

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
        console.log(`✅ ${Object.keys(AGENT_DEFINITIONS).length} emojis carregados no AGENT_DEFINITIONS`);
      },
      error: (error) => {
        console.error('❌ Erro ao carregar definições de agentes:', error);
      }
    });
  }

  private createAgentInstanceInMongoDB(instanceId: string, agentId: string, position: CirclePosition, cwd?: string): void {
    console.log('💾 [SCREENPLAY] Criando instância no MongoDB:');
    console.log('   - instance_id:', instanceId);
    console.log('   - agent_id:', agentId);
    console.log('   - position:', position);
    console.log('   - cwd:', cwd || 'não definido');

    // Call gateway to create instance record
    const baseUrl = this.agentService['baseUrl'] || 'http://localhost:5006';

    const payload: any = {
      instance_id: instanceId,
      agent_id: agentId,
      position: position,
      created_at: new Date().toISOString()
    };

    // Add cwd if provided
    if (cwd) {
      payload.cwd = cwd;
    }

    fetch(`${baseUrl}/api/agents/instances`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    })
      .then(response => {
        if (response.ok) {
          console.log('✅ [SCREENPLAY] Instância criada no MongoDB com sucesso');
        } else {
          console.warn('⚠️ [SCREENPLAY] Falha ao criar instância no MongoDB:', response.status);
        }
      })
      .catch(error => {
        console.error('❌ [SCREENPLAY] Erro ao criar instância no MongoDB:', error);
      });
  }

  ngAfterViewInit(): void {
    // Load instances from MongoDB (primary source) with localStorage fallback
    this.loadInstancesFromMongoDB();

    // Define conteúdo inicial no editor, que disparará o evento de sincronização automaticamente
    setTimeout(() => {
      this.interactiveEditor.setContent(this.editorContent, true);
      // Inicializa o ScreenplayService com a instância do editor TipTap
      this.screenplayService.initialize(this.interactiveEditor.getEditor());
    }, 0);
  }

  ngOnDestroy(): void {
    if (this.agentStateSubscription) {
      this.agentStateSubscription.unsubscribe();
    }
  }

  // === Screenplay Management (MongoDB Integration) ===

  openScreenplayManager(): void {
    this.showScreenplayManager = true;
  }

  closeScreenplayManager(): void {
    this.showScreenplayManager = false;
  }

  onScreenplayManagerAction(event: ScreenplayManagerEvent): void {
    console.log('📝 Screenplay manager action:', event.action);

    switch (event.action) {
      case 'open':
        if (event.screenplay) {
          this.loadScreenplayIntoEditor(event.screenplay);
        }
        break;
      case 'create':
        if (event.screenplay) {
          this.loadScreenplayIntoEditor(event.screenplay);
        }
        break;
    }
  }

  private loadScreenplayIntoEditor(screenplay: Screenplay): void {
    // Clear previous state
    this.agentInstances.clear();
    this.agents = [];

    // Set current screenplay
    this.currentScreenplay = screenplay;
    this.isDirty = false;

    // Load content into editor
    this.interactiveEditor.setContent(screenplay.content, true);

    console.log(`📖 Screenplay loaded: ${screenplay.name} (ID: ${screenplay.id})`);
  }

  saveCurrentScreenplay(): void {
    if (!this.currentScreenplay || !this.isDirty) {
      console.log('⏭️ No changes to save');
      return;
    }

    this.isSaving = true;

    // Get current content from editor
    const currentContent = this.generateMarkdownForSave();

    this.screenplayStorage.updateScreenplay(this.currentScreenplay.id, {
      content: currentContent
    }).subscribe({
      next: (updatedScreenplay) => {
        this.currentScreenplay = updatedScreenplay;
        this.isDirty = false;
        this.isSaving = false;
        console.log(`✅ Screenplay saved: ${updatedScreenplay.name} (v${updatedScreenplay.version})`);
      },
      error: (error) => {
        this.isSaving = false;
        console.error('❌ Failed to save screenplay:', error);
        alert('Falha ao salvar o roteiro. Tente novamente.');
      }
    });
  }

  generateMarkdownForSave(): string {
    if (!this.interactiveEditor) {
      console.error('Editor não encontrado. Não é possível salvar.');
      return '';
    }

    // 1. Get current markdown content
    let markdown = this.interactiveEditor.getMarkdown();

    // 2. Group instances by emoji for ordered processing
    const instancesByEmoji = new Map<string, AgentInstance[]>();
    this.agentInstances.forEach((instance) => {
      const list = instancesByEmoji.get(instance.emoji) || [];
      list.push(instance);
      instancesByEmoji.set(instance.emoji, list);
    });

    // 3. For each emoji type, find occurrences and add anchors in order
    instancesByEmoji.forEach((instances, emoji) => {
      const escapedEmoji = emoji.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      let processedCount = 0;

      // Replace each occurrence with anchor + emoji
      markdown = markdown.replace(new RegExp(escapedEmoji, 'g'), (match, offset) => {
        if (processedCount < instances.length) {
          const instance = instances[processedCount];
          processedCount++;
          // SAGA-003 format: anchor on previous line
          // Use agent_id if available, otherwise fallback to slug from title
          const agentIdValue = instance.agent_id || instance.definition.title.toLowerCase().replace(/\s+/g, '-');
          return `<!-- agent-instance: ${instance.id}, agent-id: ${agentIdValue} -->\n${emoji}`;
        }
        return match; // No instance for this occurrence, keep as-is
      });
    });

    return markdown;
  }

  // === Controle de Views ===
  switchView(view: 'clean' | 'agents' | 'full'): void {
    this.currentView = view;
    console.log(`🌐 View alterada para: ${view}`);
  }

  // === Gerenciamento de Agentes ===

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  private syncAgentsWithMarkdown(sourceText: string): void {
    console.log('🔄 Sincronizando agentes...');
    const foundAgentIds = new Set<string>();

    // Validação robusta: garante que sourceText é uma string antes de usar matchAll
    if (!sourceText || typeof sourceText !== 'string') {
      console.warn('⚠️ sourceText is not a valid string, skipping synchronization');
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

    console.log(`📋 Encontradas ${anchoredMatches.length} âncoras SAGA-003 no markdown`);

    if (anchoredMatches.length === 0) {
      console.warn('⚠️ Nenhuma âncora encontrada! Verificando se há âncoras no texto...');
      const hasAnchor = sourceText.includes('agent-instance');
      console.warn(`   - Texto contém "agent-instance": ${hasAnchor}`);
      if (hasAnchor) {
        console.warn('   - Âncora existe mas regex não está encontrando!');
        console.warn('   - Trecho do texto:', sourceText.substring(sourceText.indexOf('agent-instance') - 20, sourceText.indexOf('agent-instance') + 100));
      }
    }

    for (const match of anchoredMatches) {
      console.log('🔍 [SYNC] Match encontrado:', match);
      console.log('   - match[0] (full):', match[0]);
      console.log('   - match[1] (instance_id):', match[1]);
      console.log('   - match[2] (agent_id):', match[2]);
      console.log('   - match[3] (emoji):', match[3]);

      const instanceId = match[1].trim();
      const agentIdOrSlug = match[2].trim();
      const emoji = match[3];
      const definition = AGENT_DEFINITIONS[emoji];

      foundAgentIds.add(instanceId);

      if (!this.agentInstances.has(instanceId)) {
        console.log(`✨ Criando instância ${instanceId} do agente ${agentIdOrSlug} (${emoji})`);
        console.log(`   - instance_id: ${instanceId}`);
        console.log(`   - agent_id/slug (do markdown): ${agentIdOrSlug}`);
        console.log(`   - emoji: ${emoji}`);

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

        console.log(`✅ Instância criada com agent_id: ${newInstance.agent_id}`);
        this.agentInstances.set(instanceId, newInstance);
      } else {
        console.log(`ℹ️ Instância ${instanceId} já existe, pulando...`);
      }
    }

    // Segundo, processar emojis sem âncora (standalone)
    // Construir regex dinamicamente com todos os emojis de AGENT_DEFINITIONS
    const allEmojis = Object.keys(AGENT_DEFINITIONS).map(e => e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const standaloneEmojiRegex = new RegExp(`(?<!<!--[^>]*>[\\s\\n]*)(${allEmojis})`, 'gu');
    const standaloneMatches = [...sourceText.matchAll(standaloneEmojiRegex)];

    console.log(`📋 Encontrados ${standaloneMatches.length} emojis standalone de ${Object.keys(AGENT_DEFINITIONS).length} possíveis`);

    // Group standalone matches by emoji
    const matchesByEmoji = new Map<string, Array<{ match: RegExpMatchArray; index: number }>>();
    standaloneMatches.forEach(match => {
      const emoji = match[1];
      const list = matchesByEmoji.get(emoji) || [];
      list.push({ match, index: match.index || 0 });
      matchesByEmoji.set(emoji, list);
    });

    // Process each emoji type
    matchesByEmoji.forEach((matches, emoji) => {
      const definition = AGENT_DEFINITIONS[emoji];
      if (!definition) return;

      // Get existing instances for this emoji (not already found by anchors)
      const existingInstances = Array.from(this.agentInstances.entries())
        .filter(([id, instance]) => instance.emoji === emoji && !foundAgentIds.has(id))
        .map(([id, instance]) => ({ id, instance }));

      // Map existing instances to matches (first-to-first, second-to-second, etc.)
      for (let i = 0; i < matches.length; i++) {
        if (i < existingInstances.length) {
          // Reuse existing instance
          const { id } = existingInstances[i];
          foundAgentIds.add(id);
          console.log(`♻️  Reutilizando instância ${id} para ${emoji} #${i}`);
        } else {
          // Create new instance for extra emoji
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
          console.log(`✨ Nova instância ${instanceId} para ${emoji} #${i}`);
        }
      }
    });

    // Limpeza de órfãos
    for (const id of this.agentInstances.keys()) {
      if (!foundAgentIds.has(id)) {
        this.agentInstances.delete(id);
      }
    }

    this.updateAgentPositionsFromText();
    this.saveStateToLocalStorage();

    console.log(`✅ Sincronização completa. ${this.agentInstances.size} agentes ativos.`);

    // Update legacy structures for backward compatibility
    this.updateAvailableEmojis();
    this.updateLegacyAgentsFromInstances();
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
    console.log(`✨ Triggered sync for ${emojiInfo.emoji}`);
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
    this.saveStateToLocalStorage();
    this.updateLegacyAgentsFromInstances();

    console.log('➕ Agente manual adicionado:', randomEmoji);
  }

  clearAllAgents(): void {
    console.log('🗑️ [SCREENPLAY] Removendo todos os agentes...');

    // Get all instance IDs before clearing
    const instanceIds = Array.from(this.agentInstances.keys());

    // Clear memory first for immediate UI update
    this.agents = [];
    this.agentInstances.clear();
    this.saveStateToLocalStorage();

    // Delete all instances from MongoDB (cascade to remove history and logs)
    instanceIds.forEach(instanceId => {
      this.agentService.deleteInstance(instanceId, true).subscribe({
        next: () => {
          console.log(`✅ [SCREENPLAY] Instância ${instanceId} deletada do MongoDB`);
        },
        error: (error) => {
          console.error(`❌ [SCREENPLAY] Falha ao deletar ${instanceId} do MongoDB:`, error);
          // Continue with other deletions even if one fails
        }
      });
    });

    console.log(`🗑️ Todos os agentes removidos (${instanceIds.length} instâncias)`);
  }

  resyncManually(): void {
    console.log('🔄 Executando resincronização manual...');
    const currentContent = this.interactiveEditor.getMarkdown();
    this.syncAgentsWithMarkdown(currentContent);
    console.log('🔄 Resincronização manual completa');
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
    console.log('--- Iniciando Posicionamento de Agentes ---');

    const canvas = this.canvas.nativeElement;
    if (!canvas) {
      console.error('❌ BUG: Elemento do Canvas não encontrado.');
      return;
    }

    const editorElement = this.interactiveEditor.getEditorElement();
    if (!editorElement) {
      console.error('❌ BUG: Elemento do Editor (.ProseMirror) não foi encontrado pelo filho.');
      return;
    }

    const canvasRect = canvas.getBoundingClientRect();
    console.log('📦 Coordenadas do Canvas (referência):', canvasRect);

    // --- INÍCIO DA CORREÇÃO ---
    // 1. Obtenha a posição de scroll do container que ROLA. Neste caso, é o próprio canvas.
    const scrollTop = canvas.scrollTop;
    console.log(`📜 Posição do Scroll Top: ${scrollTop}`);
    // --- FIM DA CORREÇÃO ---

    if (this.agentInstances.size === 0) {
      console.log('ℹ️ Nenhuma instância de agente para posicionar.');
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
      console.log(`-- Buscando posições para o emoji: "${emoji}" (${instances.length} instâncias)`);

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
            console.warn(`⚠️ Posição do emoji "${emoji}" #${emojiInstanceIndex} não pôde ser calculada (rect is zero).`);
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

          console.log(`✅ Emoji "${emoji}" #${emojiInstanceIndex} encontrado. Rect:`, rect, `Posição Relativa com Scroll:`, newPosition);

          instance.position = newPosition;
          emojiInstanceIndex++;
        }
      }
    });

    console.log('--- Posicionamento de Agentes (com Scroll) Concluído ---');
  }

  updateAgentPositionsFromText(): void {
    this.positionAgentsOverEmojis();
  }

  // === Event Handlers ===
  handleContentUpdate(newContent: string): void {
    // Mark content as dirty (has unsaved changes)
    if (this.currentScreenplay) {
      this.isDirty = true;
    }

    // Debounce to avoid too many updates while typing
    clearTimeout(this.updateTimeout);
    this.updateTimeout = setTimeout(() => {
      console.log('📝 handleContentUpdate recebeu conteúdo:', newContent.substring(0, 200));
      console.log('   - Contém agent-instance?', newContent.includes('agent-instance'));

      // Passa o conteúdo mais recente para a lógica de sincronização
      this.syncAgentsWithMarkdown(newContent);

      // Auto-save: save 3 seconds after user stops typing
      if (this.currentScreenplay && this.isDirty) {
        clearTimeout(this.autoSaveTimeout);
        this.autoSaveTimeout = setTimeout(() => {
          console.log('💾 Auto-saving screenplay...');
          this.saveCurrentScreenplay();
        }, 3000);
      }
    }, 1000);
  }

  onBlockCommand(command: string): void {
    console.log('🎬 Comando do bloco:', command);
  }

  onAgentCircleEvent(event: CircleEvent, agent: AgentConfig): void {
    console.log('🎯 Evento do círculo:', event.type, agent.emoji);
    // Legacy method - no longer in use, agent instances use onAgentInstanceCircleEvent instead
  }

  onAgentPositionChange(position: CirclePosition, agent: AgentConfig): void {
    agent.position = position;
    this.saveStateToLocalStorage();
  }

  onAgentInstanceCircleEvent(event: CircleEvent, instance: AgentInstance): void {
    console.log('🎯 Agent instance circle event:', event.type, instance.emoji, instance.id);
    if (event.type === 'click') {
      this.selectedAgent = instance;
      console.log('================================================================================');
      console.log('📍 [SCREENPLAY] Agente clicado:');
      console.log('   - instance_id:', instance.id);
      console.log('   - agent_id (MongoDB):', instance.agent_id);
      console.log('   - agent_id type:', typeof instance.agent_id);
      console.log('   - agent_id is undefined?', instance.agent_id === undefined);
      console.log('   - agent_id is null?', instance.agent_id === null);
      console.log('   - Nome:', instance.definition.title);
      console.log('   - Emoji:', instance.emoji);
      console.log('   - Instância completa:', JSON.stringify(instance, null, 2));
      console.log('================================================================================');

      if (!instance.agent_id) {
        console.error('================================================================================');
        console.error('❌ [SCREENPLAY] ERRO CRÍTICO: agent_id está undefined/null!');
        console.error('   A instância foi criada mas agent_id não foi definido.');
        console.error('   Verifique se a âncora no markdown tem agent-id correto.');
        console.error('   Formato esperado: <!-- agent-instance: uuid, agent-id: nome-do-agente -->');
        console.error('   Verifique os logs de sincronização acima para ver o que foi extraído.');
        console.error('================================================================================');
      }

      this.conductorChat.loadContextForAgent(
        instance.id,
        instance.definition.title,
        instance.emoji,
        instance.agent_id,  // Pass MongoDB agent_id for direct execution
        instance.config?.cwd  // Pass working directory if defined
      );
      console.log('💬 Carregando contexto no chat:');
      console.log('   - instance_id passado:', instance.id);
      console.log('   - agent_id passado:', instance.agent_id);
    }
  }

  onAgentInstancePositionChange(position: CirclePosition, instance: AgentInstance): void {
    instance.position = position;

    // Update MongoDB first, fallback to localStorage
    this.agentService.updateInstance(instance.id, { position }).subscribe({
      next: () => {
        console.log(`✅ [SCREENPLAY] Posição atualizada no MongoDB: ${instance.id}`);
        this.saveStateToLocalStorage(); // Update cache
      },
      error: (error) => {
        console.error('❌ [SCREENPLAY] Falha ao atualizar posição no MongoDB:', error);
        console.warn('⚠️ [SCREENPLAY] Salvando apenas no localStorage');
        this.saveStateToLocalStorage(); // Fallback to localStorage only
      }
    });

    console.log(`📍 Agent instance ${instance.id} moved to (${position.x}, ${position.y})`);
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
    this.saveStateToLocalStorage();
    this.updateLegacyAgentsFromInstances();
    this.closeAgentCreator();

    console.log('✨ Agente personalizado criado:', agentData.title, agentData.emoji);
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

    // Insert ONLY the emoji at cursor position (no anchor, no line breaks)
    // The anchor will be added automatically during save in generateMarkdownForSave()
    this.interactiveEditor.insertContent(agent.emoji);

    // Add to instances map BEFORE positioning
    this.agentInstances.set(instanceId, newInstance);

    // Create instance record in MongoDB via gateway
    this.createAgentInstanceInMongoDB(instanceId, agent.id, newInstance.position, cwd);

    // Note: Conversation history is now stored in MongoDB, no localStorage init needed

    this.saveStateToLocalStorage();
    this.updateLegacyAgentsFromInstances();

    // CRITICAL: Position the agent circle over the emoji in the text
    // Wait longer for TipTap to update the DOM completely
    setTimeout(() => {
      this.updateAgentPositionsFromText();
      console.log('📍 Agent positioned over emoji in text');
    }, 500);

    this.closeAgentSelector();

    console.log('✅ Agente inserido:', agent.name, agent.emoji, 'ID:', instanceId);
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
      console.warn('No text selected');
      return;
    }

    const selectedText = selection.toString().trim();
    if (!selectedText) {
      console.warn('Empty selection');
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
    const agentId = agent.agent_id || agent.id;

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
      console.log('✅ Preview accepted, text replaced');
    }

    this.closeAgentPreview();
  }

  /**
   * Handle preview reject - close modal without changes
   */
  onPreviewReject(action: PreviewAction): void {
    console.log('❌ Preview rejected');
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
   * Load agent instances from MongoDB (primary source)
   * Falls back to localStorage if MongoDB fails
   */
  loadInstancesFromMongoDB(): void {
    console.log('📥 [SCREENPLAY] Carregando instâncias do MongoDB...');

    this.agentService.loadAllInstances().subscribe({
      next: (instances: any[]) => {
        console.log(`✅ [SCREENPLAY] ${instances.length} instâncias carregadas do MongoDB`);

        // Convert array to Map
        this.agentInstances.clear();

        instances.forEach((doc: any) => {
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
            config: doc.config,
            executionState: doc.execution_state
          };

          this.agentInstances.set(instance.id, instance);
        });

        console.log(`✅ [SCREENPLAY] ${this.agentInstances.size} instâncias carregadas na memória`);

        // Update legacy structures for UI
        this.updateLegacyAgentsFromInstances();
        this.updateAvailableEmojis();

        // Update localStorage as cache
        this.saveStateToLocalStorage();
      },
      error: (error) => {
        console.error('❌ [SCREENPLAY] Falha ao carregar do MongoDB:', error);
        console.warn('⚠️ [SCREENPLAY] Usando localStorage como fallback');

        // Fallback to localStorage
        this.loadStateFromLocalStorage();
      }
    });
  }

  saveStateToLocalStorage(): void {
    const serializableInstances = Array.from(this.agentInstances.entries());
    localStorage.setItem('screenplay-agent-instances', JSON.stringify(serializableInstances));
    console.log('💾 State saved to LocalStorage.');
  }

  loadStateFromLocalStorage(): void {
    const storedState = localStorage.getItem('screenplay-agent-instances');
    if (storedState) {
      try {
        const parsedState = JSON.parse(storedState);
        this.agentInstances = new Map<string, AgentInstance>(parsedState);
        console.log(`🔄 ${this.agentInstances.size} agent instances loaded from LocalStorage.`);

        // Verificar se as instâncias têm agent_id
        this.agentInstances.forEach((instance, id) => {
          if (!instance.agent_id) {
            console.warn(`⚠️ Instância ${id} carregada do localStorage SEM agent_id!`);
            console.warn(`   Isso pode causar problemas na execução.`);
            console.warn(`   Considere limpar o localStorage: localStorage.clear()`);
          }
        });

        // Update legacy structures for UI
        this.updateLegacyAgentsFromInstances();
        this.updateAvailableEmojis();
      } catch (e) {
        console.error('Error loading state from LocalStorage:', e);
        this.agentInstances.clear();
      }
    }
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

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    // ESC não desseleciona o agente para manter configurações e tarja amarela visíveis
    // O usuário pode clicar em outro agente ou fechar manualmente se desejar
    console.log('⎋ ESC pressed - agent remains selected');
  }

  // === Keyboard Shortcuts for Screenplay Management ===

  @HostListener('document:keydown.control.s', ['$event'])
  @HostListener('document:keydown.meta.s', ['$event'])
  handleSaveShortcut(event: Event): void {
    event.preventDefault();
    if (this.currentScreenplay && this.isDirty) {
      console.log('💾 Ctrl/Cmd+S pressed - Saving screenplay');
      this.saveCurrentScreenplay();
    }
  }

  @HostListener('document:keydown.control.o', ['$event'])
  @HostListener('document:keydown.meta.o', ['$event'])
  handleOpenShortcut(event: Event): void {
    event.preventDefault();
    console.log('📚 Ctrl/Cmd+O pressed - Opening screenplay manager');
    this.openScreenplayManager();
  }

}