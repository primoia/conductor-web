import { Component, ViewChild, ElementRef, AfterViewInit, OnDestroy, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { DraggableCircle, CircleData, CirclePosition, CircleEvent } from '../examples/draggable-circles/draggable-circle.component';
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
  is_system_default?: boolean; // SAGA-006: Flag for system default agents
  is_hidden?: boolean; // SAGA-006: Flag for hidden agents
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
          <details class="file-controls-menu">
            <summary>Arquivo</summary>
            <menu>
              <button (click)="newScreenplayWithDefaultAgent()">Novo Roteiro</button>
              <button (click)="openScreenplayManager()">Abrir do Banco...</button>
              <button (click)="importFromDisk()">Importar do Disco...</button>
              <hr>
              <button (click)="save()" [disabled]="!isDirty">Salvar</button>
              <hr>
              <button (click)="exportToDisk()">Exportar para Disco...</button>
            </menu>
          </details>
          
          <!-- Loading indicator -->
          <div *ngIf="isLoading" class="loading-indicator">
            <span>Carregando screenplay...</span>
          </div>
          <input type="file" #fileInput hidden (change)="handleFileSelect($event)" accept=".md,.txt" />

          <!-- SAGA-005 v2: Simplified file indicator - only database and new -->
          <div class="current-file" *ngIf="sourceOrigin === 'database' && currentScreenplay">
            💾 {{ currentScreenplay.name }}
            <span class="db-indicator" title="Vinculado ao MongoDB">🔗</span>
            <span class="dirty-indicator" *ngIf="isDirty">●</span>
            <span class="save-status" *ngIf="isSaving">Salvando...</span>
          </div>

          <!-- New file indicator -->
          <div class="current-file new-file" *ngIf="sourceOrigin === 'new'">
            📝 {{ sourceIdentifier || 'Novo Roteiro' }}
            <span class="new-indicator" title="Roteiro novo - não salvo">✨</span>
            <small class="new-hint">Não salvo</small>
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

      <!-- Agent Launcher Dock -->
      <div class="agent-launcher-dock">
        <div class="dock-section">
          <div class="dock-section-title">Agents</div>
          <button 
            *ngFor="let agent of contextualAgents" 
            class="dock-item" 
            [class.active]="activeAgentId === agent.id"
            [title]="agent.definition.description" 
            (click)="onDockAgentClick(agent)">
            {{ agent.emoji }}
          </button>
        </div>
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


    .dock-separator {
      width: 80%;
      border: none;
      border-top: 1px solid #4a5568;
      margin: 10px 0;
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

    .file-controls-menu {
      margin-bottom: 10px;
      border: 1px solid #cbd5e0;
      border-radius: 8px;
      background: #ffffff;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }

    .file-controls-menu summary {
      padding: 10px 12px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      color: #4a5568;
      list-style: none;
      user-select: none;
      transition: all 0.2s;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', 'Segoe UI Symbol', 'Android Emoji', 'EmojiSymbols' !important;
    }

    .file-controls-menu summary::-webkit-details-marker {
      display: none;
    }

    .file-controls-menu summary::after {
      content: ' ▼';
      font-size: 10px;
      float: right;
      transition: transform 0.2s;
    }

    .file-controls-menu[open] summary::after {
      transform: rotate(180deg);
    }

    .file-controls-menu summary:hover {
      background: #f7fafc;
    }

    .file-controls-menu menu {
      padding: 8px 0;
      border-top: 1px solid #e2e8f0;
      animation: menuFadeIn 0.15s ease-out;
      margin: 0;
      list-style: none;
    }

    @keyframes menuFadeIn {
      from {
        opacity: 0;
        transform: translateY(-5px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .file-controls-menu menu button {
      display: block;
      width: 100%;
      padding: 8px 12px;
      border: none;
      background: none;
      color: #4a5568;
      cursor: pointer;
      font-size: 11px;
      text-align: left;
      transition: all 0.15s;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', 'Segoe UI Symbol', 'Android Emoji', 'EmojiSymbols' !important;
    }

    .file-controls-menu menu button:hover:not(:disabled) {
      background: #ebf4ff;
      color: #2d3748;
    }

    .file-controls-menu menu button:disabled {
      color: #9ca3af;
      cursor: not-allowed;
      opacity: 0.6;
    }

    .menu-divider {
      margin: 6px 0;
      border: none;
      border-top: 1px solid #e2e8f0;
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
      flex-wrap: wrap;
    }

    .current-file.new-file {
      background: #fef3c7;
      border-color: #fcd34d;
      color: #92400e;
    }

    .db-indicator {
      color: #10b981;
      font-size: 12px;
    }


    .new-indicator {
      color: #f59e0b;
      font-size: 12px;
    }

    .new-hint {
      width: 100%;
      color: #92400e;
      font-size: 9px;
      font-style: italic;
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

    .save-btn:disabled {
      background: #9ca3af !important;
      border-color: #6b7280 !important;
      color: #6b7280 !important;
      cursor: not-allowed !important;
      opacity: 0.6;
    }

    .save-btn:disabled:hover {
      background: #9ca3af !important;
      border-color: #6b7280 !important;
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

    /* Agent Launcher Dock Styles */
    .agent-launcher-dock {
      width: 60px;
      flex-shrink: 0;
      background: #f0f3f7;
      padding: 10px 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      border-left: 1px solid #e1e4e8;
      border-right: 1px solid #e1e4e8;
      position: relative;
      z-index: 10;
      overflow-y: auto;
      max-height: 100vh;
      scrollbar-width: thin;
      scrollbar-color: #cbd5e0 #f0f3f7;
    }

    .agent-launcher-dock::-webkit-scrollbar {
      width: 4px;
    }

    .agent-launcher-dock::-webkit-scrollbar-track {
      background: #f0f3f7;
    }

    .agent-launcher-dock::-webkit-scrollbar-thumb {
      background: #cbd5e0;
      border-radius: 2px;
    }

    .agent-launcher-dock::-webkit-scrollbar-thumb:hover {
      background: #a0aec0;
    }

    .dock-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      width: 100%;
    }

    .dock-section-title {
      font-size: 10px;
      color: #6b7280;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }

    .dock-item {
      width: 44px;
      height: 44px;
      border-radius: 8px;
      background: #ffffff;
      border: 1px solid #e1e4e8;
      cursor: pointer;
      font-size: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      position: relative;
      overflow: hidden;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }

    .dock-item:hover {
      background: #f7fafc;
      border-color: #a8b9ff;
      transform: scale(1.1);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .dock-item:active {
      transform: scale(0.95);
    }

    .dock-item.active {
      background: #ebf4ff;
      border-color: #7c9ff6;
      box-shadow: 0 0 0 2px rgba(124, 159, 246, 0.3);
      transform: scale(1.05);
    }

    .dock-item.active:hover {
      background: #dbeafe;
      border-color: #60a5fa;
      transform: scale(1.15);
    }


    /* Responsive adjustments */
    @media (max-width: 768px) {
      .agent-launcher-dock {
        width: 50px;
        padding: 8px 0;
      }
      
      .dock-item {
        width: 36px;
        height: 36px;
        font-size: 20px;
      }
      
      .dock-section-title {
        font-size: 9px;
      }
    }

    .loading-indicator {
      position: fixed;
      top: 20px;
      right: 20px;
      background: #007bff;
      color: white;
      padding: 10px 15px;
      border-radius: 5px;
      font-size: 14px;
      z-index: 1000;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    }

  `]
})
export class ScreenplayInteractive implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvas!: ElementRef;
  @ViewChild(InteractiveEditor) private interactiveEditor!: InteractiveEditor;
  @ViewChild(ConductorChatComponent) conductorChat!: ConductorChatComponent;
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

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

  // Agent Dock properties
  public contextualAgents: AgentInstance[] = [];
  public activeAgentId: string | null = null;

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
    private screenplayStorage: ScreenplayStorage,
    private route: ActivatedRoute,
    private router: Router
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

  /**
   * SAGA-006: Salva o roteiro antes de criar a instância do agente
   * Usado quando o roteiro ainda não foi salvo (não tem ID)
   */
  private saveScreenplayBeforeAgentCreation(instanceId: string, agentId: string, position: CirclePosition, cwd?: string): void {
    console.log('💾 [AUTO-SAVE] Salvando roteiro antes de criar instância do agente...');
    
    // Se for um roteiro novo, criar no banco
    if (this.sourceOrigin === 'new') {
      const content = this.generateMarkdownForSave();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const defaultName = `novo-roteiro-${timestamp}`;
      
      console.log(`💾 [AUTO-SAVE] Criando roteiro: ${defaultName}`);
      
      this.screenplayStorage.createScreenplay({
        name: defaultName,
        content: content,
        description: `Criado automaticamente em ${new Date().toLocaleDateString()}`
      }).subscribe({
        next: (newScreenplay) => {
          console.log(`✅ [AUTO-SAVE] Roteiro criado: ${newScreenplay.id}`);
          
          // Atualizar estado
          this.sourceOrigin = 'database';
          this.sourceIdentifier = newScreenplay.id;
          this.currentScreenplay = newScreenplay;
          this.isDirty = false;
          
          // Agora criar a instância do agente
          this.createAgentInstanceInMongoDB(instanceId, agentId, position, cwd);
        },
        error: (error) => {
          console.error('❌ [AUTO-SAVE] Falha ao criar roteiro:', error);
          alert('Falha ao salvar o roteiro. Tente novamente.');
        }
      });
    } else {
      // Se for um roteiro existente, apenas salvar
      this.saveCurrentScreenplay();
      
      // Aguardar um pouco e tentar novamente
      setTimeout(() => {
        if (this.currentScreenplay?.id) {
          console.log('✅ [AUTO-SAVE] Roteiro salvo, criando instância do agente...');
          this.createAgentInstanceInMongoDB(instanceId, agentId, position, cwd);
        } else {
          console.error('❌ [AUTO-SAVE] Falha ao salvar roteiro, não foi possível criar instância');
          alert('Falha ao salvar o roteiro. Tente novamente.');
        }
      }, 1000);
    }
  }

  private createAgentInstanceInMongoDB(instanceId: string, agentId: string, position: CirclePosition, cwd?: string): void {
    console.log('💾 [SCREENPLAY] Criando instância no MongoDB:');
    console.log('   - instance_id:', instanceId);
    console.log('   - agent_id:', agentId);
    console.log('   - position:', position);
    console.log('   - cwd:', cwd || 'não definido');
    console.log('   - screenplay_id:', this.currentScreenplay?.id || 'não disponível');
    console.log('   - currentScreenplay completo:', this.currentScreenplay);
    console.log('   - currentScreenplay.id tipo:', typeof this.currentScreenplay?.id);
    console.log('   - currentScreenplay.id valor:', this.currentScreenplay?.id);

    // SAGA-006: Verificar se o roteiro foi salvo (tem ID)
    if (!this.currentScreenplay?.id) {
      console.log('⚠️ [SCREENPLAY] Roteiro não foi salvo ainda! Salvando automaticamente...');
      console.log('   - sourceOrigin:', this.sourceOrigin);
      console.log('   - isDirty:', this.isDirty);
      
      // Salvar o roteiro primeiro
      this.saveScreenplayBeforeAgentCreation(instanceId, agentId, position, cwd);
      return;
    }

    // Call gateway to create instance record
    const baseUrl = this.agentService['baseUrl'] || 'http://localhost:5006';

    const payload: any = {
      instance_id: instanceId,
      agent_id: agentId,
      position: position,
      created_at: new Date().toISOString(),
      is_system_default: false, // SAGA-006: Default to false for regular agents
      is_hidden: false, // SAGA-006: Default to false for regular agents
      screenplay_id: this.currentScreenplay?.id // SAGA-006: Add screenplay_id to associate agent with screenplay
    };

    console.log('🔍 [DEBUG] Payload completo antes do envio:');
    console.log('   - payload.screenplay_id:', payload.screenplay_id);
    console.log('   - payload.screenplay_id tipo:', typeof payload.screenplay_id);
    console.log('   - payload completo:', JSON.stringify(payload, null, 2));

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

  /**
   * SAGA-006: Create default agent instance for new screenplays
   */
  private async createDefaultAgentInstance(): Promise<void> {
    console.log('🤖 [DEFAULT AGENT] Creating default agent instance');
    
    try {
      // Check if we already have a default agent for this screenplay
      const existingDefaultAgent = Array.from(this.agentInstances.values())
        .find(agent => agent.is_system_default === true && agent.agent_id === 'ScreenplayAssistant_Agent');
      
      if (existingDefaultAgent) {
        console.log('⚠️ [DEFAULT AGENT] Default agent already exists for this screenplay, skipping creation');
        console.log('   - Existing agent ID:', existingDefaultAgent.id);
        console.log('   - Existing agent emoji:', existingDefaultAgent.emoji);
        return;
      }
      
      // Generate instance ID
      const instanceId = this.generateUUID();
      
      // Default agent configuration
      const agentId = 'ScreenplayAssistant_Agent';
      const emoji = '🎬';
      const position: CirclePosition = { x: 100, y: 100 };
      
      // SAGA-006: Insert emoji into editor content first
      this.insertEmojiIntoEditor(emoji, instanceId);
      
      // Create agent instance in memory
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
      
      // Add to agent instances
      this.agentInstances.set(instanceId, defaultInstance);
      
      // Update legacy structures
      this.updateLegacyAgentsFromInstances();
      this.updateAvailableEmojis();
      this.updateAgentDockLists();
      
      // Create in MongoDB with system default flags
      this.createDefaultAgentInstanceInMongoDB(instanceId, agentId, position);
      
      // Auto-activate the default agent in chat
      this.activateDefaultAgent(defaultInstance);
      
      console.log('✅ [DEFAULT AGENT] Default agent instance created and activated');
      console.log('   - Instance ID:', defaultInstance.id);
      console.log('   - Agent ID:', defaultInstance.agent_id);
      console.log('   - Emoji:', defaultInstance.emoji);
      
    } catch (error) {
      console.error('❌ [DEFAULT AGENT] Error creating default agent instance:', error);
    }
  }

  /**
   * SAGA-006: Insert emoji into editor content
   */
  private insertEmojiIntoEditor(emoji: string, instanceId: string): void {
    console.log('📝 [DEFAULT AGENT] Inserting emoji into editor:', emoji);
    
    // Insert emoji at the beginning of the editor with a new line
    this.interactiveEditor.insertContent(emoji + '\n\n');
    
    // Update editor content to trigger sync
    this.editorContent = this.interactiveEditor.getMarkdown();
    
    console.log('✅ [DEFAULT AGENT] Emoji inserted into editor');
  }

  /**
   * SAGA-006: Activate default agent in chat panel
   */
  private activateDefaultAgent(agent: AgentInstance): void {
    console.log('🎯 [DEFAULT AGENT] Activating default agent in chat');
    
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
    
    console.log('✅ [DEFAULT AGENT] Default agent activated in chat');
  }

  /**
   * Auto-select the default agent in the dock to ensure chat is loaded
   * This simulates the user clicking on the dock-item
   */
  private autoSelectDefaultAgent(agent: AgentInstance): void {
    console.log('🔄 [AUTO-SELECT] Auto-selecting default agent in dock:', agent.definition.title);
    console.log('   - Agent ID:', agent.id);
    console.log('   - Agent emoji:', agent.emoji);
    console.log('   - ConductorChat available:', !!this.conductorChat);
    
    // Ensure the agent is in the contextual agents list
    if (!this.contextualAgents.find(a => a.id === agent.id)) {
      console.log('⚠️ [AUTO-SELECT] Agent not found in contextual agents, updating dock lists...');
      this.updateAgentDockLists();
    }
    
    // Simulate the dock click by calling the same function
    this.onDockAgentClick(agent);
    
    console.log('✅ [AUTO-SELECT] Default agent auto-selected in dock');
  }

  /**
   * Auto-select default agent after loading agents from MongoDB
   * This is called when loading an existing screenplay
   */
  private autoSelectDefaultAgentAfterLoad(): void {
    console.log('🔍 [AUTO-SELECT-LOAD] Looking for default agent to auto-select...');
    
    // Find the default agent for this screenplay
    const defaultAgent = Array.from(this.agentInstances.values())
      .find(agent => agent.is_system_default === true && agent.agent_id === 'ScreenplayAssistant_Agent');
    
    if (defaultAgent) {
      console.log('✅ [AUTO-SELECT-LOAD] Default agent found:', defaultAgent.definition.title);
      console.log('   - Agent ID:', defaultAgent.id);
      console.log('   - Agent emoji:', defaultAgent.emoji);
      
      // Auto-select with a small delay to ensure UI is ready
      setTimeout(() => {
        this.autoSelectDefaultAgent(defaultAgent);
      }, 300);
    } else {
      console.log('⚠️ [AUTO-SELECT-LOAD] No default agent found for this screenplay');
      console.log('   - Available agents:', Array.from(this.agentInstances.values()).map(a => `${a.emoji} ${a.definition.title}`));
    }
  }

  /**
   * SAGA-006: Hide agent instead of deleting (for system default agents)
   */
  hideAgent(instanceId: string): void {
    console.log('👁️ [HIDE AGENT] Hiding agent:', instanceId);
    
    const agent = this.agentInstances.get(instanceId);
    if (!agent) {
      console.warn('⚠️ [HIDE AGENT] Agent not found:', instanceId);
      return;
    }
    
    // Update agent to hidden state
    agent.is_hidden = true;
    this.agentInstances.set(instanceId, agent);
    
    // Update UI
    this.updateLegacyAgentsFromInstances();
    this.updateAvailableEmojis();
    this.updateAgentDockLists();
    
    // Update in MongoDB
    this.updateAgentInMongoDB(instanceId, { is_hidden: true });
    
    console.log('✅ [HIDE AGENT] Agent hidden successfully');
  }

  /**
   * SAGA-006: Create default agent instance in MongoDB
   */
  /**
   * SAGA-006: Salva o roteiro antes de criar a instância do agente padrão
   * Usado quando o roteiro ainda não foi salvo (não tem ID)
   */
  private saveScreenplayBeforeDefaultAgentCreation(instanceId: string, agentId: string, position: CirclePosition): void {
    console.log('💾 [AUTO-SAVE] Salvando roteiro antes de criar instância do agente padrão...');
    
    // Se for um roteiro novo, criar no banco
    if (this.sourceOrigin === 'new') {
      const content = this.generateMarkdownForSave();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const defaultName = `novo-roteiro-${timestamp}`;
      
      console.log(`💾 [AUTO-SAVE] Criando roteiro: ${defaultName}`);
      
      this.screenplayStorage.createScreenplay({
        name: defaultName,
        content: content,
        description: `Criado automaticamente em ${new Date().toLocaleDateString()}`
      }).subscribe({
        next: (newScreenplay) => {
          console.log(`✅ [AUTO-SAVE] Roteiro criado: ${newScreenplay.id}`);
          
          // Atualizar estado
          this.sourceOrigin = 'database';
          this.sourceIdentifier = newScreenplay.id;
          this.currentScreenplay = newScreenplay;
          this.isDirty = false;
          
          // Agora criar a instância do agente padrão
          this.createDefaultAgentInstanceInMongoDB(instanceId, agentId, position);
        },
        error: (error) => {
          console.error('❌ [AUTO-SAVE] Falha ao criar roteiro:', error);
          alert('Falha ao salvar o roteiro. Tente novamente.');
        }
      });
    } else {
      // Se for um roteiro existente, apenas salvar
      this.saveCurrentScreenplay();
      
      // Aguardar um pouco e tentar novamente
      setTimeout(() => {
        if (this.currentScreenplay?.id) {
          console.log('✅ [AUTO-SAVE] Roteiro salvo, criando instância do agente padrão...');
          this.createDefaultAgentInstanceInMongoDB(instanceId, agentId, position);
        } else {
          console.error('❌ [AUTO-SAVE] Falha ao salvar roteiro, não foi possível criar instância');
          alert('Falha ao salvar o roteiro. Tente novamente.');
        }
      }, 1000);
    }
  }

  private createDefaultAgentInstanceInMongoDB(instanceId: string, agentId: string, position: CirclePosition): void {
    console.log('💾 [DEFAULT AGENT] Creating default agent instance in MongoDB:');
    console.log('   - instance_id:', instanceId);
    console.log('   - agent_id:', agentId);
    console.log('   - position:', position);
    console.log('   - screenplay_id:', this.currentScreenplay?.id || 'não disponível');
    console.log('   - currentScreenplay completo:', this.currentScreenplay);
    console.log('   - currentScreenplay.id tipo:', typeof this.currentScreenplay?.id);
    console.log('   - currentScreenplay.id valor:', this.currentScreenplay?.id);

    // SAGA-006: Verificar se o roteiro foi salvo (tem ID)
    if (!this.currentScreenplay?.id) {
      console.log('⚠️ [DEFAULT AGENT] Roteiro não foi salvo ainda! Salvando automaticamente...');
      console.log('   - sourceOrigin:', this.sourceOrigin);
      console.log('   - isDirty:', this.isDirty);
      
      // Salvar o roteiro primeiro
      this.saveScreenplayBeforeDefaultAgentCreation(instanceId, agentId, position);
      return;
    }

    const baseUrl = this.agentService['baseUrl'] || 'http://localhost:5006';

    const payload: any = {
      instance_id: instanceId,
      agent_id: agentId,
      position: position,
      created_at: new Date().toISOString(),
      is_system_default: true, // SAGA-006: Mark as system default
      is_hidden: false, // SAGA-006: Not hidden by default
      screenplay_id: this.currentScreenplay?.id // SAGA-006: Add screenplay_id to associate agent with screenplay
    };

    console.log('🔍 [DEBUG] Payload completo (DEFAULT AGENT) antes do envio:');
    console.log('   - payload.screenplay_id:', payload.screenplay_id);
    console.log('   - payload.screenplay_id tipo:', typeof payload.screenplay_id);
    console.log('   - payload completo:', JSON.stringify(payload, null, 2));

    fetch(`${baseUrl}/api/agents/instances`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    })
      .then(response => {
        if (response.ok) {
          console.log('✅ [DEFAULT AGENT] Default agent instance created in MongoDB successfully');
        } else {
          console.warn('⚠️ [DEFAULT AGENT] Failed to create default agent instance in MongoDB:', response.status);
        }
      })
      .catch(error => {
        console.error('❌ [DEFAULT AGENT] Error creating default agent instance in MongoDB:', error);
      });
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
          console.log('✅ [MONGODB] Agent updated successfully');
        } else {
          console.warn('⚠️ [MONGODB] Failed to update agent:', response.status);
        }
      })
      .catch(error => {
        console.error('❌ [MONGODB] Error updating agent:', error);
      });
  }

  /**
   * SAGA-006: Delete agent (for non-system agents)
   */
  deleteAgent(instanceId: string): void {
    console.log('🗑️ [DELETE AGENT] Deleting agent:', instanceId);
    
    const agent = this.agentInstances.get(instanceId);
    if (!agent) {
      console.warn('⚠️ [DELETE AGENT] Agent not found:', instanceId);
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
    
    console.log('✅ [DELETE AGENT] Agent deleted successfully');
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
          console.log('✅ [MONGODB] Agent deleted successfully');
        } else {
          console.warn('⚠️ [MONGODB] Failed to delete agent:', response.status);
        }
      })
      .catch(error => {
        console.error('❌ [MONGODB] Error deleting agent:', error);
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
    // Load instances from MongoDB (primary source) with localStorage fallback
    this.loadInstancesFromMongoDB();

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
  }

  ngOnDestroy(): void {
    if (this.agentStateSubscription) {
      this.agentStateSubscription.unsubscribe();
    }
    
    // Remove force save event listener
    document.removeEventListener('forceSaveScreenplay', this.handleForceSaveScreenplay);
  }

  private handleForceSaveScreenplay = (event: any) => {
    const screenplayId = event.detail?.screenplayId;
    if (screenplayId && this.isDirty && this.currentScreenplay?.id === screenplayId) {
      console.log('💾 [SCREENPLAY] Forçando salvamento antes do envio da mensagem...');
      this.save();
    }
  };

  // === Screenplay Management (MongoDB Integration) ===

  /**
   * SAGA-005 v2: Clear chat state when loading new screenplay
   */
  private clearChatState(): void {
    console.log('🧹 [CHAT] Clearing chat state for new screenplay');
    
    // Clear selected agent
    this.selectedAgent = null;
    
    // Clear chat context if conductorChat is available
    if (this.conductorChat) {
      this.conductorChat.clear();
    }
    
    console.log('✅ [CHAT] Chat state cleared');
  }

  /**
   * SAGA-005: Create a new screenplay - clears editor and resets state
   */
  newScreenplay(): void {
    console.log('📝 [NEW] Creating new screenplay');
    
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
    
    console.log('✅ [NEW] New screenplay created');
  }

  /**
   * SAGA-006: Create a new screenplay with default agent - creates screenplay and instantiates default agent
   */
  async newScreenplayWithDefaultAgent(): Promise<void> {
    console.log('📝 [NEW] Creating new screenplay with default agent');
    
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
    this.createNewScreenplayImmediately();
    
    console.log('✅ [NEW] New screenplay with default agent created');
  }

  /**
   * Create new screenplay in database immediately and update URL
   */
  private createNewScreenplayImmediately(): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const defaultName = `novo-roteiro-${timestamp}`;
    
    console.log(`💾 [IMMEDIATE] Creating new screenplay immediately: ${defaultName}`);
    
    this.screenplayStorage.createScreenplay({
      name: defaultName,
      content: '',
      description: `Criado em ${new Date().toLocaleDateString()}`
    }).subscribe({
      next: (newScreenplay) => {
        console.log(`✅ [IMMEDIATE] Screenplay created: ${newScreenplay.id}`);
        
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
        
        console.log(`✅ [IMMEDIATE] Screenplay linked to editor and URL updated: ${newScreenplay.name}`);
      },
      error: (error) => {
        console.error('❌ [IMMEDIATE] Failed to create screenplay:', error);
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
          this.updateUrlWithScreenplayId(event.screenplay.id);
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
  importFromDisk(): void {
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
      const reader = new FileReader();

      reader.onload = (e) => {
        const content = e.target?.result as string;
        const filename = file.name.replace(/\.md$/, ''); // Remove .md extension

        console.log('📂 [DISK] Arquivo lido do disco:');
        console.log('   - Nome:', file.name);
        console.log('   - Tamanho:', content.length, 'caracteres');
        console.log('   - Primeiros 100 chars:', content.substring(0, 100));

        // Check if screenplay with same name exists in MongoDB
        // First, try to get all screenplays to see what's really there
        console.log('🔍 [CONFLICT] Starting conflict check...');
        this.screenplayStorage.getScreenplays('', 1, 1000).subscribe({
          next: (response) => {
            console.log('🔍 [CONFLICT] Checking for existing screenplays:');
            console.log('   - Looking for name:', filename);
            console.log('   - Search query:', filename);
            console.log('   - Total screenplays found:', response.items.length);
            console.log('   - Existing names:', response.items.map(item => item.name));
            
            // More robust comparison - check exact match and also check for similar names
            const existingScreenplay = response.items.find(item => {
              const exactMatch = item.name === filename;
              const similarMatch = item.name.toLowerCase() === filename.toLowerCase();
              console.log(`   - Exact match "${item.name}" === "${filename}": ${exactMatch}`);
              console.log(`   - Similar match "${item.name.toLowerCase()}" === "${filename.toLowerCase()}": ${similarMatch}`);
              return exactMatch;
            });
            
            console.log('   - Found existing?', !!existingScreenplay);
            if (existingScreenplay) {
              console.log('   - Existing screenplay ID:', existingScreenplay.id);
              console.log('   - Existing screenplay name:', existingScreenplay.name);
            }

            if (existingScreenplay) {
              console.log('⚠️ [CONFLICT] Potential conflict detected, loading full screenplay to verify...');
              console.log('   - Existing ID:', existingScreenplay.id);
              console.log('   - Existing name:', existingScreenplay.name);
              
              // Load full screenplay to check content
              this.screenplayStorage.getScreenplay(existingScreenplay.id).subscribe({
                next: (fullScreenplay) => {
                  console.log('   - Full screenplay content length:', fullScreenplay.content?.length || 0);
                  console.log('   - Full screenplay content preview:', fullScreenplay.content?.substring(0, 100));
                  
                  // Check if the existing screenplay is actually different
                  if (fullScreenplay.content === content) {
                    console.log('🔄 [CONFLICT] Same content detected, loading existing screenplay');
                    this.loadScreenplayIntoEditor(fullScreenplay);
                  } else {
                    console.log('⚠️ [CONFLICT] Different content detected, showing conflict modal');
                    this.handleScreenplayConflict(fullScreenplay, content, filename);
                  }
                },
                error: (error: any) => {
                  console.error('❌ Erro ao carregar roteiro completo:', error);
                  this.createAndLinkScreenplayAutomatically(content, filename);
                }
              });
            } else {
              console.log('✅ [CONFLICT] No conflict detected, creating new screenplay');
              // No conflict - automatically create in MongoDB
              this.createAndLinkScreenplayAutomatically(content, filename);
            }
          },
          error: (error: any) => {
            console.error('❌ Erro ao verificar roteiros existentes:', error);
            // Fallback: create automatically
            this.createAndLinkScreenplayAutomatically(content, filename);
          }
        });
      };

      reader.onerror = (error) => {
        console.error('❌ Erro ao ler arquivo:', error);
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
    console.log(`📄 [NEW] Loading as new screenplay: ${filename}`);

    // Clear previous state
    this.agentInstances.clear();
    this.agents = [];
    this.currentScreenplay = null;
    this.isDirty = false;
    this.currentFileName = '';

    // SAGA-005 v2: Clear chat when loading new screenplay
    this.clearChatState();

    // Set state for new screenplay
    this.sourceOrigin = 'new';
    this.sourceIdentifier = filename;

    // Load content into editor
    this.editorContent = content;
    this.interactiveEditor.setContent(content, true);

    console.log(`✅ [NEW] New screenplay loaded: ${filename}`);
  }

  /**
   * Create screenplay in MongoDB automatically and link to editor
   * No confirmation needed for new files
   */
  private createAndLinkScreenplayAutomatically(content: string, filename: string): void {
    console.log(`💾 [AUTO] Criando roteiro automaticamente no banco: ${filename}`);
    console.log(`   - Nome: ${filename}`);
    console.log(`   - Tamanho do conteúdo: ${content.length} caracteres`);
    console.log(`   - Primeiros 100 chars: ${content.substring(0, 100)}`);

    // Clean filename - remove .md extension if present and sanitize
    const cleanFilename = filename.replace(/\.md$/, '').replace(/[^a-zA-Z0-9\-_]/g, '-');
    console.log(`   - Nome limpo: ${cleanFilename}`);

    // Validate filename
    if (!cleanFilename || cleanFilename.length === 0) {
      console.error('❌ [AUTO] Nome de arquivo inválido após limpeza');
      this.loadAsNewScreenplay(content, 'arquivo-importado');
      return;
    }

    this.screenplayStorage.createScreenplay({
      name: cleanFilename,
      content: content,
      description: `Importado do disco em ${new Date().toLocaleDateString()}`
    }).subscribe({
      next: (newScreenplay) => {
        console.log(`✅ [AUTO] Roteiro criado: ${newScreenplay.id}`);
        console.log(`   - Nome no banco: ${newScreenplay.name}`);
        console.log(`   - Conteúdo retornado (length): ${newScreenplay.content?.length || 0}`);
        console.log('📄 [AUTO] Carregando conteúdo do disco no editor...');

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
          isDeleted: false
        };

        this.loadScreenplayIntoEditor(screenplayWithDiskContent);

        // If backend didn't return content, update it asynchronously
        if (!newScreenplay.content || newScreenplay.content.length === 0) {
          console.warn('⚠️ [AUTO] Backend não retornou conteúdo, sincronizando em background...');
          this.screenplayStorage.updateScreenplay(newScreenplay.id, {
            content: content
          }).subscribe({
            next: () => {
              console.log('✅ [AUTO] Banco sincronizado com sucesso');
            },
            error: (updateError) => {
              console.error('❌ [AUTO] Erro ao sincronizar banco (conteúdo já está no editor):', updateError);
            }
          });
        }
      },
      error: (error) => {
        console.error('❌ [AUTO] Erro ao criar roteiro no MongoDB:', error);
        console.error('   - Detalhes do erro:', JSON.stringify(error, null, 2));

        // Check if it's a "name already exists" error
        if (error.message && error.message.includes('already exists')) {
          console.warn('⚠️ [AUTO] Roteiro já existe, buscando e carregando o existente');

          // Instead of trying with timestamp, search for and load the existing screenplay
          this.screenplayStorage.getScreenplays(cleanFilename, 1, 10).subscribe({
            next: (response) => {
              const existingScreenplay = response.items.find(item => item.name === cleanFilename);

              if (existingScreenplay) {
                console.log(`✅ [AUTO] Roteiro existente encontrado: ${existingScreenplay.id}`);
                console.log('📄 [AUTO] Carregando conteúdo do disco no editor primeiro...');

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
                console.log('💾 [AUTO] Sincronizando com banco em background...');
                this.screenplayStorage.updateScreenplay(existingScreenplay.id, {
                  content: content
                }).subscribe({
                  next: () => {
                    console.log('✅ [AUTO] Banco atualizado com sucesso');
                  },
                  error: (updateError) => {
                    console.error('❌ [AUTO] Erro ao atualizar banco (conteúdo já está no editor):', updateError);
                  }
                });
              } else {
                // Screenplay not found in search, try with timestamp as fallback
                console.warn('⚠️ [AUTO] Roteiro não encontrado na busca, tentando com timestamp');
                console.log('   - Content length:', content?.length || 0);
                console.log('   - Content preview:', content?.substring(0, 200) || 'EMPTY');
                console.log('   - cleanFilename:', cleanFilename);

                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const uniqueName = `${cleanFilename}-${timestamp}`;
                console.log('   - uniqueName:', uniqueName);

                const createPayload = {
                  name: uniqueName,
                  content: content,
                  description: `Importado do disco em ${new Date().toLocaleDateString()} (nome original: ${cleanFilename})`
                };
                console.log('   - Payload:', JSON.stringify({
                  name: createPayload.name,
                  contentLength: createPayload.content?.length,
                  description: createPayload.description
                }));

                this.screenplayStorage.createScreenplay(createPayload).subscribe({
                  next: (newScreenplay) => {
                    console.log(`✅ [AUTO] Roteiro criado com nome único: ${newScreenplay.id}`);
                    console.log('   - Screenplay name:', newScreenplay.name);
                    console.log('   - Screenplay content length:', newScreenplay.content?.length || 0);
                    console.log('📄 [AUTO] Carregando conteúdo do disco no editor...');

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
                      console.warn('⚠️ [AUTO] Backend não retornou conteúdo, sincronizando em background...');
                      this.screenplayStorage.updateScreenplay(newScreenplay.id, {
                        content: content
                      }).subscribe({
                        next: () => {
                          console.log('✅ [AUTO] Banco sincronizado com sucesso');
                        },
                        error: (updateError) => {
                          console.error('❌ [AUTO] Erro ao sincronizar banco (conteúdo já está no editor):', updateError);
                        }
                      });
                    }
                  },
                  error: (retryError) => {
                    console.error('❌ [AUTO] Falha mesmo com nome único:', retryError);
                    this.loadAsNewScreenplay(content, cleanFilename);
                  }
                });
              }
            },
            error: (searchError) => {
              console.error('❌ [AUTO] Erro ao buscar roteiro existente:', searchError);
              this.loadAsNewScreenplay(content, cleanFilename);
            }
          });
        } else {
          console.warn('⚠️ [AUTO] Fallback: carregando como novo roteiro');
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
      console.log(`🔁 [CONFLICT] Sobrescrevendo MongoDB com conteúdo do disco`);

      this.screenplayStorage.updateScreenplay(existingScreenplay.id, {
        content: diskContent
      }).subscribe({
        next: (updatedScreenplay) => {
          this.loadScreenplayIntoEditor(updatedScreenplay);
          console.log(`✅ [CONFLICT] Roteiro atualizado: ${filename}`);
        },
        error: (error) => {
          console.error('❌ [CONFLICT] Erro ao atualizar:', error);
          // Fallback: create new
          this.createAndLinkScreenplayAutomatically(diskContent, `${filename}-novo`);
        }
      });
    } else {
      console.log(`📄 [CONFLICT] Usuário optou por carregar do banco`);
      // Load existing screenplay from database (ignore disk content)
      this.loadScreenplayIntoEditor(existingScreenplay);
    }
  }

  /**
   * SAGA-005: Export current markdown content to disk as a file
   */
  exportToDisk(): void {
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

    // Cleanup
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log('💾 Arquivo salvo no disco:', filename);
  }

  /**
   * Reload current screenplay from database
   */
  loadFromDatabase(): void {
    if (!this.currentScreenplay) {
      console.warn('⚠️ Nenhum roteiro carregado do banco');
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
        console.log('🔄 Roteiro recarregado do banco:', screenplay.name);
      },
      error: (error) => {
        console.error('❌ Erro ao recarregar roteiro:', error);
        alert('Falha ao recarregar o roteiro do banco.');
      }
    });
  }

  /**
   * SAGA-005 v2: Simplified save method - disk files are automatically converted to database
   */
  save(): void {
    console.log(`💾 [SAVE] Intelligent save - sourceOrigin: ${this.sourceOrigin}`);

    if (!this.isDirty) {
      console.log('⏭️ [SAVE] No changes to save');
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
        console.warn('⚠️ [SAVE] Unknown sourceOrigin:', this.sourceOrigin);
    }
  }

  /**
   * SAGA-005: Prompt user to create new screenplay in database
   */
  private promptCreateNewScreenplay(): void {
    const content = this.generateMarkdownForSave();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const defaultName = `novo-roteiro-${timestamp}`;
    
    console.log(`💾 [PROMPT] Prompting for new screenplay name`);
    console.log(`   - Default name: ${defaultName}`);
    console.log(`   - Content length: ${content.length} characters`);
    
    // TODO: Replace with beautiful modal component
    // For now, using improved window.prompt
    const name = window.prompt(
      `💾 Criar Novo Roteiro no Banco\n\n` +
      `Nome do roteiro:`,
      defaultName
    );

    console.log(`   - User input: "${name}"`);
    console.log(`   - User input type: ${typeof name}`);
    console.log(`   - User input length: ${name?.length || 0}`);
    console.log(`   - Default name was: "${defaultName}"`);
    console.log(`   - Is same as default: ${name === defaultName}`);
    console.log(`   - Trimmed: "${name?.trim()}"`);
    console.log(`   - Trimmed length: ${name?.trim().length || 0}`);
    console.log(`   - Is valid: ${name && name.trim().length > 0}`);

    // Handle the case where user accepts default name without editing
    let finalName = name;
    if (name === defaultName) {
      console.log(`🔄 [PROMPT] User accepted default name, using as-is: "${defaultName}"`);
      finalName = defaultName;
    } else if (name && name.trim() && name.trim().length > 0) {
      finalName = name.trim();
      console.log(`✅ [PROMPT] User provided custom name: "${finalName}"`);
    } else if (name === null) {
      console.log('❌ [SAVE] User cancelled screenplay creation (null)');
      return;
    } else if (name === '') {
      console.log('❌ [SAVE] User entered empty string');
      return;
    } else {
      console.log('❌ [SAVE] User entered invalid name:', name);
      return;
    }

    console.log(`✅ [PROMPT] Final name to create: "${finalName}"`);
    this.createNewScreenplayInDatabase(finalName, content);
  }

  /**
   * SAGA-005: Create new screenplay in database and link to editor
   */
  private createNewScreenplayInDatabase(name: string, content: string): void {
    console.log(`💾 [CREATE] Creating new screenplay in database: ${name}`);
    console.log(`   - Name: "${name}"`);
    console.log(`   - Name length: ${name.length}`);
    console.log(`   - Content length: ${content.length}`);
    console.log(`   - Content preview: ${content.substring(0, 100)}...`);

    // Sanitize name similar to import - but be more careful
    let sanitizedName = name.trim();
    
    // Only sanitize if there are problematic characters
    if (/[^a-zA-Z0-9\-_]/.test(sanitizedName)) {
      console.log(`   - Name contains special characters, sanitizing...`);
      sanitizedName = sanitizedName.replace(/[^a-zA-Z0-9\-_]/g, '-');
      // Remove multiple consecutive dashes
      sanitizedName = sanitizedName.replace(/-+/g, '-');
      // Remove leading/trailing dashes
      sanitizedName = sanitizedName.replace(/^-+|-+$/g, '');
    }
    
    console.log(`   - Sanitized name: "${sanitizedName}"`);

    // Validate name
    if (!sanitizedName || sanitizedName.length === 0) {
      console.error('❌ [CREATE] Invalid name after sanitization');
      alert('Nome inválido. Use apenas letras, números, hífens e underscores.');
      return;
    }

    // Additional validation - ensure it's not just dashes
    if (sanitizedName.replace(/-/g, '').length === 0) {
      console.error('❌ [CREATE] Name is only dashes after sanitization');
      alert('Nome inválido. Use pelo menos uma letra ou número.');
      return;
    }

    console.log('💾 [CREATE] Sending to MongoDB:');
    console.log('   - Name:', sanitizedName);
    console.log('   - Content length:', content.length);
    console.log('   - Content preview:', content.substring(0, 200));
    console.log('   - Description:', `Criado em ${new Date().toLocaleDateString()}`);

    this.screenplayStorage.createScreenplay({
      name: sanitizedName,
      content: content,
      description: `Criado em ${new Date().toLocaleDateString()}`
    }).subscribe({
      next: (newScreenplay) => {
        console.log(`✅ [CREATE] Screenplay created: ${newScreenplay.id}`);
        console.log(`   - Name in database: ${newScreenplay.name}`);
        console.log(`   - Version: ${newScreenplay.version}`);
        
        // Update state to database-linked
        this.sourceOrigin = 'database';
        this.sourceIdentifier = newScreenplay.id;
        this.currentScreenplay = newScreenplay;
        this.isDirty = false;
        this.currentFileName = '';
        
        // Update URL with new screenplay ID
        this.updateUrlWithScreenplayId(newScreenplay.id);
        
        console.log(`✅ [CREATE] Screenplay linked to editor: ${newScreenplay.name}`);
        console.log(`✅ [CREATE] URL updated with screenplayId: ${newScreenplay.id}`);
      },
      error: (error) => {
        console.error('❌ [CREATE] Failed to create screenplay:', error);
        console.error('   - Error details:', JSON.stringify(error, null, 2));
        alert(`Falha ao criar roteiro no banco: ${error.message || 'Erro desconhecido'}`);
      }
    });
  }

  private loadScreenplayById(id: string): void {
    this.isLoading = true;
    this.screenplayStorage.getScreenplay(id).subscribe({
      next: (screenplay) => {
        if (screenplay.isDeleted) {
          console.error('Screenplay was deleted');
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
        console.error('Failed to load screenplay:', err);
        alert('Não foi possível carregar o roteiro. Carregando padrão.');
        this.loadDefaultContent();
        this.clearInvalidUrl();
        this.isLoading = false;
      }
    });
  }

  private loadDefaultContent(): void {
    this.interactiveEditor.setContent(this.editorContent, true);
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

    console.log(`📖 [LOAD] Loading screenplay into editor:`, screenplay.name);
    console.log(`   - Content length:`, screenplay.content.length, 'chars');
    console.log(`   - First 100 chars:`, screenplay.content.substring(0, 100));

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

    console.log(`✅ [LOAD] Screenplay loaded: ${screenplay.name} (ID: ${screenplay.id})`);
  }

  saveCurrentScreenplay(): void {
    if (!this.currentScreenplay) {
      console.log('⏭️ No screenplay loaded');
      return;
    }
    
    if (!this.isDirty) {
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
    
    console.log('📝 [GENERATE] Generating markdown for save:');
    console.log('   - Content length:', markdown.length);
    console.log('   - First 200 chars:', markdown.substring(0, 200));
    console.log('   - Source origin:', this.sourceOrigin);
    console.log('   - Is dirty:', this.isDirty);

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
    // SAGA-005 v2: Mark content as dirty for any source origin
    this.isDirty = true;

    // Debounce to avoid too many updates while typing
    clearTimeout(this.updateTimeout);
    this.updateTimeout = setTimeout(() => {
      console.log('📝 handleContentUpdate recebeu conteúdo:', newContent.substring(0, 200));
      console.log('   - Contém agent-instance?', newContent.includes('agent-instance'));

      // Passa o conteúdo mais recente para a lógica de sincronização
      this.syncAgentsWithMarkdown(newContent);

      // Auto-save: only for database-linked screenplays and only after user interaction
      if (this.isDirty && this.sourceOrigin === 'database' && this.currentScreenplay) {
        clearTimeout(this.autoSaveTimeout);
        this.autoSaveTimeout = setTimeout(() => {
          console.log('💾 Auto-saving screenplay...');
          this.save();
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
        instance.config?.cwd,  // Pass working directory if defined
        this.currentScreenplay?.id // SAGA-006: Pass screenplay ID for document association
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

  // === Agent Dock Methods ===

  private updateAgentDockLists(): void {
    // Popula agentes contextuais a partir das instâncias no documento
    // SAGA-006: Filter out hidden agents
    this.contextualAgents = this.getAgentInstancesAsArray().filter(agent => !agent.is_hidden);
    console.log(`🔄 Dock atualizado: ${this.contextualAgents.length} agentes no documento (${this.agentInstances.size - this.contextualAgents.length} ocultos)`);
  }

  public onDockAgentClick(agent: AgentInstance): void {
    console.log(`🔄 Dock: Carregando agente: ${agent.definition.title}`);
    this.activeAgentId = agent.id;
    this.conductorChat.loadContextForAgent(
      agent.id, 
      agent.definition.title, 
      agent.emoji, 
      agent.agent_id, 
      agent.config?.cwd,
      this.currentScreenplay?.id // SAGA-006: Pass screenplay ID for document association
    );
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
   * Only loads agents for the current screenplay
   */
  loadInstancesFromMongoDB(): void {
    console.log('📥 [SCREENPLAY] Carregando instâncias do MongoDB...');

    // Only load agents if we have a current screenplay
    if (!this.currentScreenplay?.id) {
      console.log('⚠️ [SCREENPLAY] Nenhum roteiro carregado, não carregando agentes');
      this.agentInstances.clear();
      this.updateLegacyAgentsFromInstances();
      this.updateAvailableEmojis();
      return;
    }

    console.log(`📥 [SCREENPLAY] Carregando agentes para roteiro: ${this.currentScreenplay.id}`);

    this.agentService.loadAllInstances().subscribe({
      next: (instances: any[]) => {
        console.log(`✅ [SCREENPLAY] ${instances.length} instâncias carregadas do MongoDB`);
        console.log('🔍 [DEBUG] Todas as instâncias:', instances.map(i => ({
          id: i.instance_id,
          emoji: i.emoji,
          screenplay_id: i.screenplay_id,
          cwd: i.cwd || i.config?.cwd || 'não definido'
        })));

        // Convert array to Map and filter by screenplay_id
        this.agentInstances.clear();

        instances.forEach((doc: any) => {
          console.log(`🔍 [DEBUG] Verificando agente: ${doc.emoji} ${doc.agent_id} (roteiro: ${doc.screenplay_id})`);
          
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
              config: doc.config,
              executionState: doc.execution_state,
              is_system_default: doc.is_system_default || false, // SAGA-006: Load system default flag
              is_hidden: doc.is_hidden || false // SAGA-006: Load hidden flag
            };

            this.agentInstances.set(instance.id, instance);
            console.log(`✅ [SCREENPLAY] Agente carregado: ${instance.emoji} ${instance.definition.title} (${instance.id}) - CWD: ${instance.config?.cwd || 'não definido'}`);
          } else {
            console.log(`⏭️ [SCREENPLAY] Agente ignorado (roteiro diferente): ${doc.emoji} ${doc.agent_id} (roteiro: ${doc.screenplay_id})`);
          }
        });

        console.log(`✅ [SCREENPLAY] ${this.agentInstances.size} instâncias carregadas na memória para roteiro ${this.currentScreenplay?.id}`);

        // Update legacy structures for UI
        this.updateLegacyAgentsFromInstances();
        this.updateAvailableEmojis();

        // Auto-select default agent if available
        this.autoSelectDefaultAgentAfterLoad();

        // Update localStorage as cache
        this.saveStateToLocalStorage();
      },
      error: (error) => {
        console.error('❌ [SCREENPLAY] Falha ao carregar do MongoDB:', error);
        console.warn('⚠️ [SCREENPLAY] Usando localStorage como fallback');

        // Fallback to localStorage
        this.loadStateFromLocalStorage();
        
        // Auto-select default agent after fallback load
        setTimeout(() => {
          this.autoSelectDefaultAgentAfterLoad();
        }, 200);
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
        
        // Auto-select default agent after loading from localStorage
        setTimeout(() => {
          this.autoSelectDefaultAgentAfterLoad();
        }, 200);
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

  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(event: Event): void {
    // ESC não desseleciona o agente para manter configurações e tarja amarela visíveis
    // O usuário pode clicar em outro agente ou fechar manualmente se desejar
    console.log('⎋ ESC pressed - agent remains selected');
    
    // Don't prevent default or stop propagation to allow child components to handle ESC
    // This allows modals and dialogs to close properly
  }

  // === Keyboard Shortcuts for Screenplay Management ===

  @HostListener('document:keydown.control.s', ['$event'])
  @HostListener('document:keydown.meta.s', ['$event'])
  handleSaveShortcut(event: Event): void {
    event.preventDefault();
    if (this.isDirty) {
      console.log('💾 Ctrl/Cmd+S pressed - Saving screenplay');
      this.save();
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