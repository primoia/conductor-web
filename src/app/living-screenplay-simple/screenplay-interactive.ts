import { Component, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DraggableCircle, CircleData, CirclePosition, CircleEvent } from '../examples/draggable-circles/draggable-circle.component';
import { InteractiveEditor } from '../interactive-editor/interactive-editor';
import { AgentExecutionService, AgentExecutionState } from '../services/agent-execution';
import { AgentControlModal } from './agent-control-modal/agent-control-modal';
import { AgentCreatorComponent, AgentCreationData } from './agent-creator/agent-creator.component';
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
  emoji: string;
  definition: { title: string; description: string; unicode: string; }; // Link to AGENT_DEFINITIONS
  status: 'pending' | 'queued' | 'running' | 'completed' | 'error';
  position: CirclePosition; // XY position on screen
  executionState?: AgentExecutionState; // Link to execution service state
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
  '🧪': { title: 'Test Agent', description: 'Runs automated tests and validations', unicode: '\\u{1F9EA}' }
};

@Component({
  selector: 'app-screenplay-interactive',
  standalone: true,
  imports: [CommonModule, DraggableCircle, InteractiveEditor, AgentControlModal, AgentCreatorComponent],
  template: `
    <div class="screenplay-container">
      <div class="control-panel">
        <h3>🎬 Roteiro Vivo</h3>

        <div class="file-controls">
          <button (click)="loadMarkdownFile()" class="control-btn">
            📁 Carregar Markdown
          </button>
          <button (click)="saveMarkdownFile()" class="control-btn">
            💾 Salvar Markdown
          </button>
          <button (click)="newMarkdownFile()" class="control-btn">
            📄 Novo Arquivo
          </button>
          <div class="current-file" *ngIf="currentFileName">
            📄 {{ currentFileName }}
          </div>
        </div>

        <div class="agent-controls">
          <h4>🤖 Agentes ({{ agents.length }})</h4>
          <button (click)="openAgentCreator()" class="control-btn create-agent-btn">
            ✨ Criar Agente Personalizado
          </button>
          <button (click)="addManualAgent()" class="control-btn add-agent-btn">
            ➕ Adicionar Círculo Aleatório
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
    </div>

    <!-- Agent Control Modal -->
    <app-agent-control-modal
      [agent]="selectedAgent"
      [executionLogs]="selectedAgent ? getAgentExecutionLogs(selectedAgent.id) : []"
      [isVisible]="showModal"
      (execute)="onModalExecute($event)"
      (cancel)="onModalCancel($event)"
      (close)="closeModal()">
    </app-agent-control-modal>

    <!-- Agent Creator Modal -->
    <app-agent-creator
      [isVisible]="showAgentCreator"
      (agentCreated)="onAgentCreated($event)"
      (close)="closeAgentCreator()">
    </app-agent-creator>
  `,
  styles: [`
    /* Força fontes de emoji em todo o componente */
    :host {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', 'Segoe UI Symbol', 'Android Emoji', 'EmojiSymbols' !important;
    }

    .screenplay-container {
      display: flex;
      height: 100vh;
      background: #f8f9fa;
      font-family: inherit !important;
    }

    .control-panel {
      width: 280px;
      background: #343a40;
      color: white;
      padding: 20px;
      overflow-y: auto;
      flex-shrink: 0;

      /* Força fontes de emoji em todo o painel */
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', 'Segoe UI Symbol', 'Android Emoji', 'EmojiSymbols' !important;
    }

    .control-panel h3 {
      margin: 0 0 20px 0;
      color: #ffc107;
      font-size: 18px;
    }

    .control-panel h4 {
      margin: 20px 0 10px 0;
      color: #28a745;
      font-size: 14px;
    }

    .file-controls {
      margin-bottom: 20px;
      border-bottom: 1px solid #495057;
      padding-bottom: 15px;
    }

    .agent-controls {
      margin-bottom: 20px;
      border-bottom: 1px solid #495057;
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
      border: 1px solid #495057;
      border-radius: 6px;
      background: #495057;
      color: white;
      cursor: pointer;
      font-size: 12px;
      text-align: left;
      transition: all 0.2s;

      /* Força fontes de emoji nos botões */
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', 'Segoe UI Symbol', 'Android Emoji', 'EmojiSymbols' !important;
    }

    .control-btn:hover {
      background: #5a6268;
      border-color: #6c757d;
    }

    .control-btn.active {
      background: #007bff;
      border-color: #007bff;
    }

    .create-agent-btn {
      background: #6f42c1 !important;
      border-color: #6f42c1 !important;
    }

    .create-agent-btn:hover {
      background: #5a2d8a !important;
    }

    .add-agent-btn {
      background: #28a745 !important;
      border-color: #28a745 !important;
    }

    .add-agent-btn:hover {
      background: #218838 !important;
    }

    .current-file {
      margin-top: 10px;
      padding: 8px;
      background: rgba(255, 193, 7, 0.1);
      border-radius: 4px;
      font-size: 11px;
      color: #ffc107;
    }

    .emoji-list {
      margin-top: 15px;
    }

    .emoji-list small {
      color: #adb5bd;
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
      border: 1px solid #6c757d;
      border-radius: 50%;
      background: #495057;
      cursor: pointer;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;

      /* Força fontes de emoji para renderização correta */
      font-family: 'emoji', 'Noto Color Emoji', 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', sans-serif !important;
    }

    .emoji-btn:hover {
      background: #5a6268;
      transform: scale(1.1);
    }

    .emoji-btn.has-some-agents {
      border-color: #ffc107;
      background: rgba(255, 193, 7, 0.2);
    }

    .emoji-btn.has-all-agents {
      border-color: #28a745;
      background: rgba(40, 167, 69, 0.2);
    }

    .emoji-count {
      color: #adb5bd;
      font-size: 9px;
    }

    .execution-status, .queue-status {
      margin-top: 15px;
      padding: 10px;
      background: rgba(40, 167, 69, 0.1);
      border-radius: 4px;
      border-left: 3px solid #28a745;
    }

    .execution-status small, .queue-status small {
      color: #28a745;
      font-weight: bold;
      display: block;
      margin-bottom: 5px;
    }

    .running-agent, .queued-agent {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 4px 0;
      font-size: 11px;
      color: #ffffff;
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
      background: #ffc107;
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
      background: #007bff;
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
      background: #28a745;
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
      background: #dc3545;
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
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      z-index: 1000;
      pointer-events: none;
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
      border-top: 5px solid rgba(0, 0, 0, 0.8);
    }

  `]
})
export class ScreenplayInteractive implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvas!: ElementRef;
  @ViewChild(InteractiveEditor) private interactiveEditor!: InteractiveEditor;

  // Estado da aplicação
  agents: AgentConfig[] = [];
  availableEmojis: EmojiInfo[] = [];
  currentView: 'clean' | 'agents' | 'full' = 'full';
  currentFileName = '';

  // Estado do popup
  popupVisible = false;
  popupX = 0;
  popupY = 0;
  popupText = '';

  // Estado do modal
  showModal = false;
  showAgentCreator = false;

  // Persistência
  markdownAgentMap: MarkdownAgentMap = {};

  // Timeout para debounce
  private updateTimeout: any;

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

### Exemplo de Agentes

Aqui temos alguns agentes distribuídos pelo documento:

🚀 **Performance Agent** - Monitora performance da aplicação
🔐 **Auth Agent** - Gerencia autenticação de usuários
📊 **Analytics Agent** - Coleta métricas de uso
🛡️ **Security Agent** - Verifica vulnerabilidades
⚡ **Speed Agent** - Otimiza velocidade de resposta

### Como usar

1. Duplo-clique nos emojis para abrir modais
2. Arraste os agentes para reposicionar
3. Use o painel lateral para controlar visualizações
4. Salve e carregue diferentes arquivos markdown

> 💡 **Dica**: Use "Roteiro Limpo" para ver apenas o texto!
`;

  constructor(private agentExecutionService: AgentExecutionService) {
    // Subscribe to agent execution state changes
    this.agentStateSubscription = this.agentExecutionService.agentState$.subscribe(
      (agentStates) => this.updateAgentInstancesWithExecutionState(agentStates)
    );
  }

  ngAfterViewInit(): void {
    this.loadStateFromLocalStorage();

    // Define conteúdo inicial no editor, que disparará o evento de sincronização automaticamente
    setTimeout(() => {
      this.interactiveEditor.setContent(this.editorContent, true);
    }, 0);
  }

  ngOnDestroy(): void {
    if (this.agentStateSubscription) {
      this.agentStateSubscription.unsubscribe();
    }
  }

  // === Operações de Arquivo ===
  loadMarkdownFile(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.txt';
    input.onchange = (event: any) => this.handleFileLoad(event);
    input.click();
  }

  handleFileLoad(event: any): void {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        this.processNewMarkdownContent(e.target?.result as string, file.name);
      };
      reader.readAsText(file);
    }
  }

  private processNewMarkdownContent(content: string, filename: string): void {
    this.agentInstances.clear();
    this.agents = [];
    console.log('🧹 Previous agent state cleared.');

    this.currentFileName = filename;

    // Dê um comando explícito para o editor se atualizar.
    // O editor então emitirá 'contentChange', que acionará a primeira sincronização.
    this.interactiveEditor.setContent(content, true);

    console.log('📁 File loaded:', filename);
  }

  saveMarkdownFile(): void {
    if (!this.currentFileName) {
      this.currentFileName = 'roteiro-vivo.md';
    }

    const blob = this.generateMarkdownBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = this.currentFileName;
    a.click();
    URL.revokeObjectURL(url);

    console.log(`💾 Markdown file saved: ${this.currentFileName}`);
  }

  generateMarkdownForSave(): string {
    if (!this.interactiveEditor) {
      console.error('Editor não encontrado. Não é possível salvar.');
      return '';
    }

    // 1. Pega o conteúdo como HTML, que é a representação mais estruturada.
    let htmlContent = this.interactiveEditor.getHTML();

    // 2. Itera sobre as instâncias para injetar as âncoras diretamente no HTML.
    this.agentInstances.forEach((instance) => {
      const anchor = `<!-- agent-id: ${instance.id} -->`;

      // Procura pelo emoji que NÃO seja imediatamente precedido por uma âncora.
      // Evita adicionar âncoras duplicadas usando uma verificação simples
      if (!htmlContent.includes(instance.id)) {
        // Escape do emoji para regex (alguns emojis têm caracteres especiais)
        const escapedEmoji = instance.emoji.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        // Injeta a âncora antes da primeira ocorrência "órfã" encontrada.
        // Esta é uma abordagem mais segura do que o replace simples no Markdown.
        const regex = new RegExp(escapedEmoji);
        htmlContent = htmlContent.replace(regex, `${anchor}${instance.emoji}`);
      }
    });

    // 3. AGORA, com o HTML enriquecido, fazemos a conversão final para Markdown.
    // Delega a responsabilidade de preservar a formatação para a função do editor.
    const finalMarkdown = this.interactiveEditor.convertHtmlToMarkdown(htmlContent);

    console.log('📄 Markdown Final para Salvar:', finalMarkdown);
    console.log('💾 Number of agent instances:', this.agentInstances.size);

    return finalMarkdown;
  }

  generateMarkdownBlob(): Blob {
    const markdownContent = this.generateMarkdownForSave();
    return new Blob([markdownContent], { type: 'text/markdown' });
  }

  newMarkdownFile(): void {
    this.agentInstances.clear();
    this.agents = [];
    this.currentFileName = '';

    // Use comando direto para definir conteúdo inicial
    this.interactiveEditor.setContent('# Novo Roteiro\n\nDigite seu conteúdo aqui...', true);

    this.saveStateToLocalStorage();
    console.log('📄 New file created, all agent state cleared');
  }

  // === Controle de Views ===
  switchView(view: 'clean' | 'agents' | 'full'): void {
    this.currentView = view;
    console.log(`🌐 View alterada para: ${view}`);
  }

  // === Gerenciamento de Agentes ===

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  private syncAgentsWithMarkdown(sourceText: string): void {
    console.log('🔄 Sincronizando agentes...');
    const foundAgentIds = new Set<string>();

    // Regex simplificada para encontrar emojis de agente com ou sem âncoras
    const anchorAndEmojiRegex = /(?:<!--\s*agent-id:\s*([a-f0-9-]{36})\s*-->\s*)?(🚀|🔐|📊|🛡️|⚡|🎯|🧠|💻|📱|🌐|🔍|🎪|🏆|🔮|💎|⭐|🌟|🧪)/gu;
    const matches = [...sourceText.matchAll(anchorAndEmojiRegex)];

    for (const match of matches) {
      let agentId = match[1];
      const emoji = match[2];
      const definition = AGENT_DEFINITIONS[emoji];

      if (!definition) continue;

      if (agentId && this.agentInstances.has(agentId)) {
        foundAgentIds.add(agentId);
      } else {
        // APENAS ATUALIZE O MAP, NUNCA O EDITOR
        if (!agentId) {
          agentId = this.generateUUID();
        }

        const newInstance: AgentInstance = {
          id: agentId,
          emoji: emoji,
          definition: definition,
          status: 'pending',
          position: { x: Math.random() * 200, y: Math.random() * 200 },
        };
        this.agentInstances.set(agentId, newInstance);
        foundAgentIds.add(agentId);
      }
    }

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
    this.agents = [];
    this.agentInstances.clear();
    this.saveStateToLocalStorage();
    console.log('🗑️ Todos os agentes removidos');
  }

  resyncManually(): void {
    console.log('🔄 Executing manual resynchronization...');
    const currentContent = this.interactiveEditor.getMarkdown();
    this.syncAgentsWithMarkdown(currentContent);
    console.log('🔄 Manual resynchronization complete');
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
    // Debounce to avoid too many updates while typing
    clearTimeout(this.updateTimeout);
    this.updateTimeout = setTimeout(() => {
      // Passa o conteúdo mais recente para a lógica de sincronização
      this.syncAgentsWithMarkdown(newContent);
    }, 1000);
  }

  onBlockCommand(command: string): void {
    console.log('🎬 Comando do bloco:', command);
  }

  onAgentCircleEvent(event: CircleEvent, agent: AgentConfig): void {
    console.log('🎯 Evento do círculo:', event.type, agent.emoji);
    if (event.type === 'doubleClick') {
      this.showModal = true;
    }
  }

  onAgentPositionChange(position: CirclePosition, agent: AgentConfig): void {
    agent.position = position;
    this.saveStateToLocalStorage();
  }

  onAgentInstanceCircleEvent(event: CircleEvent, instance: AgentInstance): void {
    console.log('🎯 Agent instance circle event:', event.type, instance.emoji, instance.id);
    if (event.type === 'doubleClick') {
      this.selectedAgent = instance;
      this.showModal = true;
      console.log('💬 Opening modal for agent:', instance.definition.title);
    }
  }

  onAgentInstancePositionChange(position: CirclePosition, instance: AgentInstance): void {
    instance.position = position;
    this.saveStateToLocalStorage();
    console.log(`📍 Agent instance ${instance.id} moved to (${position.x}, ${position.y})`);
  }

  closeModal(): void {
    this.showModal = false;
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

  // === Modal Event Handlers ===

  /**
   * Handle execute event from modal
   */
  onModalExecute(event: { agent: AgentInstance; prompt: string }): void {
    const { agent, prompt } = event;

    // Create execution state with the user's prompt
    const executionState: AgentExecutionState = {
      id: agent.id,
      emoji: agent.emoji,
      title: agent.definition.title,
      prompt: prompt,
      status: 'pending',
      logs: []
    };

    // Update the instance with execution state reference
    agent.executionState = executionState;
    agent.status = 'queued';

    // Start execution via service
    this.agentExecutionService.executeAgent(executionState);

    console.log('🚀 Executing agent from modal:', agent.definition.title, 'with prompt:', prompt);
  }

  /**
   * Handle cancel event from modal
   */
  onModalCancel(event: { agentId: string }): void {
    this.cancelAgentExecution(event.agentId);
    console.log('❌ Cancelling agent from modal:', event.agentId);
  }
}