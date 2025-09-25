import { Component, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DraggableCircle, CircleData, CirclePosition, CircleEvent } from '../examples/draggable-circles/draggable-circle.component';
import { ProposalModal } from '../modal/proposal-modal';
import { InteractiveEditor } from '../interactive-editor/interactive-editor';

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
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  position: CirclePosition; // XY position on screen
  // Future: last_run, results_summary, etc.
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
  '🌟': { title: 'Featured Agent', description: 'Special highlights', unicode: '\\u{1F31F}' }
};

@Component({
  selector: 'app-screenplay-interactive',
  standalone: true,
  imports: [CommonModule, DraggableCircle, ProposalModal, InteractiveEditor],
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
          <button (click)="addManualAgent()" class="control-btn add-agent-btn">
            ➕ Adicionar Círculo
          </button>
          <button (click)="resyncManually()" class="control-btn">
            🔄 Ressincronizar com Texto
          </button>
          <button (click)="clearAllAgents()" class="control-btn" *ngIf="agents.length > 0">
            🗑️ Limpar Todos
          </button>
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
            (contentChange)="onEditorContentChange($event)"
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

    <!-- Modal -->
    <app-proposal-modal *ngIf="showModal" (closeModal)="closeModal()"></app-proposal-modal>
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

    .screenplay-canvas {
      flex: 1;
      position: relative;
      background: #ffffff;
      overflow: hidden;
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
export class ScreenplayInteractive implements AfterViewInit {
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

  // Persistência
  markdownAgentMap: MarkdownAgentMap = {};

  // Timeout para debounce
  private updateTimeout: any;

  // --- NEW: PERSISTENT ANCHOR SYSTEM ---

  // Simulates MongoDB 'agent_instances' collection
  // Key: agent ID (UUID), Value: AgentInstance object
  private agentInstances = new Map<string, AgentInstance>();

  // Stores the latest version of editor content with injected anchors
  private contentWithAnchors = '';

  // --- END: NEW PROPERTIES ---

  // Conteúdo do editor
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

  ngAfterViewInit(): void {
    this.loadStateFromLocalStorage(); // Load saved state
    setTimeout(() => {
      this.syncAgentsWithMarkdown();    // Synchronize with initial text
    }, 0);
  }

  // === Operações de Arquivo ===
  loadMarkdownFile(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.txt';
    input.onchange = (event: any) => this.handleFileLoad(event);
    input.click();
  }

  // Extracted for testability
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

  // Extracted for testability
  private processNewMarkdownContent(content: string, filename: string): void {
    // Clear previous state before loading new file
    this.agentInstances.clear();
    this.agents = []; // Also clear legacy agents array for backward compatibility
    console.log('🧹 Previous agent state cleared.');

    this.editorContent = content;
    this.currentFileName = filename;

    // Delay synchronization to guarantee DOM update happens before sync
    setTimeout(() => {
      this.syncAgentsWithMarkdown();
    }, 0);

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

  // Public method for generating pure Markdown content with anchors - testable and robust
  generateMarkdownForSave(): string {
    if (!this.interactiveEditor) {
      console.error('Editor not found. Cannot save.');
      return '';
    }

    // 1. Get Markdown directly from the improved editor method
    let markdownContent = this.interactiveEditor.getMarkdown();

    // 2. Inject agent anchors into the markdown content
    this.agentInstances.forEach((instance, id) => {
      const anchor = `<!-- agent-id: ${id} -->`;

      if (!markdownContent.includes(anchor)) {
        // Replace first occurrence of the emoji with anchor + emoji
        const escapedEmoji = instance.emoji.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        markdownContent = markdownContent.replace(new RegExp(escapedEmoji), `${anchor}${instance.emoji}`);
      }
    });

    console.log('📄 Converted Markdown:', markdownContent);
    console.log('💾 Number of agent instances:', this.agentInstances.size);

    return markdownContent;
  }

  // Extracted for testability
  generateMarkdownBlob(): Blob {
    const markdownContent = this.generateMarkdownForSave();
    return new Blob([markdownContent], { type: 'text/markdown' });
  }

  newMarkdownFile(): void {
    // Clear all state for new file
    this.agentInstances.clear();
    this.agents = []; // Also clear legacy agents array for backward compatibility
    this.editorContent = '# Novo Roteiro\n\nDigite seu conteúdo aqui...';
    this.currentFileName = '';
    this.saveStateToLocalStorage(); // Persist the cleared state
    console.log('📄 New file created, all agent state cleared');
  }

  // === Controle de Views ===
  switchView(view: 'clean' | 'agents' | 'full'): void {
    this.currentView = view;
    console.log(`🌐 View alterada para: ${view}`);
  }

  // === Gerenciamento de Agentes ===

  // Generate a simple UUID v4
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  private syncAgentsWithMarkdown(): void {
    console.log('🔄 Synchronizing agents with Markdown...');
    const sourceText = this.editorContent;
    let updatedText = sourceText;
    const foundAgentIds = new Set<string>();

    // 1. Regex to find agent emoji, optionally preceded by an ID anchor
    // Use proper Unicode code points without curly braces for regex compatibility
    const emojiPattern = /(🚀|🔐|📊|🛡️|⚡|🎯|🧠|💻|📱|🌐|🔍|🎪|🏆|🔮|💎|⭐|🌟)/gu;
    const anchorAndEmojiRegex = new RegExp(`(<!--\\s*agent-id:\\s*([a-f0-9-]{36})\\s*-->\\s*)?(${emojiPattern.source.slice(1, -3)})`, 'gu');

    // 2. First pass: Process all found emojis
    const matches = [...sourceText.matchAll(anchorAndEmojiRegex)];

    for (const match of matches) {
      let agentId = match[2]; // Captured ID
      const emoji = match[3]; // The emoji character itself

      if (!emoji || !AGENT_DEFINITIONS[emoji]) continue;

      const definition = AGENT_DEFINITIONS[emoji];

      if (agentId && this.agentInstances.has(agentId)) {
        // Case 1: Existing agent with ID. Just mark as found.
        foundAgentIds.add(agentId);
      } else {
        // Case 2: New agent (legacy emoji without anchor) or unknown ID
        if (!agentId) {
          agentId = this.generateUUID();
          // Inject anchor in text. Important: we'll do the replacement after to not mess up indices
          const originalFragment = match[0];
          const newFragment = `<!-- agent-id: ${agentId} -->${originalFragment}`;
          updatedText = updatedText.replace(originalFragment, newFragment);
        }

        const newInstance: AgentInstance = {
          id: agentId,
          emoji: emoji,
          definition: definition,
          status: 'pending',
          position: { x: Math.random() * 400 + 100, y: Math.random() * 400 + 100 }, // Random initial position
        };
        this.agentInstances.set(agentId, newInstance);
        foundAgentIds.add(agentId);
      }
    }

    // 3. Second pass: Clean orphaned agents
    for (const id of this.agentInstances.keys()) {
      if (!foundAgentIds.has(id)) {
        this.agentInstances.delete(id);
        console.log(`🗑️ Orphaned agent removed: ${id}`);
      }
    }

    // 4. Update editor content if new anchors were injected
    this.contentWithAnchors = updatedText;
    if (this.editorContent !== this.contentWithAnchors) {
      // Ideally, the editor would be updated without losing cursor position
      // For prototyping, direct replacement is sufficient
      this.editorContent = this.contentWithAnchors;
    }

    // 5. Position agents over their corresponding emojis in the DOM
    this.positionAgentsOverEmojis();

    // 6. Save state and update legacy structures
    this.saveStateToLocalStorage(); // Simulates saving to MongoDB

    console.log(`✅ Synchronization complete. ${this.agentInstances.size} active agents.`);

    // Update legacy structures for backward compatibility
    this.updateAvailableEmojis();
    this.updateLegacyAgentsFromInstances();
  }

  // For backward compatibility with template
  private updateAvailableEmojis(): void {
    const emojiCount: { [key: string]: number } = {};
    for (const instance of this.agentInstances.values()) {
      emojiCount[instance.emoji] = (emojiCount[instance.emoji] || 0) + 1;
    }

    this.availableEmojis = Object.keys(emojiCount).map(emoji => ({
      emoji,
      count: emojiCount[emoji],
      positions: [] // Will be updated by updateAgentPositionsFromText
    }));
  }

  // Update legacy agents array from agentInstances for template compatibility
  private updateLegacyAgentsFromInstances(): void {
    this.agents = Array.from(this.agentInstances.values()).map(instance => ({
      id: instance.id,
      emoji: instance.emoji,
      position: instance.position,
      data: {
        id: instance.id,
        emoji: instance.emoji,
        category: 'auth' as const, // Default category for backward compatibility
        title: instance.definition.title,
        description: instance.definition.description
      }
    }));
  }

  // Legacy function name for backward compatibility
  scanAndCreateAgents(): void {
    this.syncAgentsWithMarkdown();
  }

  // Legacy function for template compatibility
  createAgentsForEmoji(emojiInfo: EmojiInfo): void {
    // This now just triggers a sync since the new system handles creation automatically
    this.syncAgentsWithMarkdown();
    console.log(`✨ Triggered sync for ${emojiInfo.emoji} (new persistence system)`);
  }

  addManualAgent(): void {
    const canvas = this.canvas.nativeElement;

    const emojis = ['🚀', '🔐', '📊', '🛡️', '⚡', '🎯', '🧠', '💻', '📱', '🌐', '🔍'];
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

    // Update legacy agents array for backward compatibility
    this.updateLegacyAgentsFromInstances();

    console.log('➕ Agente manual adicionado:', randomEmoji);
  }


  clearAllAgents(): void {
    this.agents = [];
    this.saveAgentsToStorage();
    console.log('🗑️ Todos os agentes removidos');
  }

  clearStorage(): void {
    localStorage.removeItem('screenplay-agents');
    this.markdownAgentMap = {};
    this.agents = [];
    console.log('🧹 Storage limpo - todos os dados de agentes removidos');
  }

  // Manual resynchronization function - calls the main sync logic
  resyncManually(): void {
    console.log('🔄 Executing manual resynchronization...');

    // Call the main synchronization function, which handles creation and positioning
    this.syncAgentsWithMarkdown();

    console.log('🔄 Manual resynchronization complete');
  }

  // Position agents over their corresponding emojis in the DOM
  private positionAgentsOverEmojis(): void {
    const canvas = this.canvas.nativeElement;
    if (!canvas) {
      console.warn('⚠️ Canvas element not found for positioning');
      return;
    }

    const editorElement = canvas.querySelector('.ProseMirror') || canvas.querySelector('[contenteditable]');
    if (!editorElement) {
      console.warn('⚠️ Editor element not found for positioning');
      return;
    }

    // --- DEBUG: Canvas positioning information ---
    const canvasRect = canvas.getBoundingClientRect();
    console.log('🔧 Positioning Debug - Canvas coordinates:', canvasRect);
    console.log('🔧 Editor element:', editorElement);
    console.log('🔧 Number of agent instances to position:', this.agentInstances.size);
    // --- END DEBUG ---

    // Group agent instances by emoji type
    const instancesByEmoji: { [emoji: string]: AgentInstance[] } = {};
    this.agentInstances.forEach(instance => {
      if (!instancesByEmoji[instance.emoji]) {
        instancesByEmoji[instance.emoji] = [];
      }
      instancesByEmoji[instance.emoji].push(instance);
    });

    console.log('🔧 Instances grouped by emoji:', instancesByEmoji);

    // Find and position each emoji in the DOM
    Object.keys(instancesByEmoji).forEach(emoji => {
      const instancesForEmoji = instancesByEmoji[emoji];
      console.log(`🔧 Processing emoji: ${emoji}, ${instancesForEmoji.length} instances`);

      // Find all occurrences of this emoji in the DOM
      const walker = document.createTreeWalker(
        editorElement,
        NodeFilter.SHOW_TEXT,
        null
      );

      let node;
      let emojiInstanceIndex = 0;

      while (node = walker.nextNode()) {
        const textContent = node.textContent || '';
        let startIndex = 0;

        while (true) {
          const emojiIndex = textContent.indexOf(emoji, startIndex);
          if (emojiIndex === -1) break;

          // Position the corresponding agent instance if it exists
          if (emojiInstanceIndex < instancesForEmoji.length) {
            const instance = instancesForEmoji[emojiInstanceIndex];

            try {
              const range = document.createRange();
              range.setStart(node, emojiIndex);
              range.setEnd(node, emojiIndex + emoji.length);

              const rect = range.getBoundingClientRect();

              // --- DETAILED DEBUG LOGS ---
              console.log(`-- Found ${emoji} #${emojiInstanceIndex} --`);
              console.log('🔧 Emoji coordinates (absolute):', rect);
              console.log('🔧 Canvas coordinates (absolute):', canvasRect);

              const newPosition = {
                x: rect.left - canvasRect.left,
                y: rect.top - canvasRect.top
              };

              console.log('🔧 Calculated position (relative to canvas):', newPosition);
              // --- END DETAILED DEBUG LOGS ---

              // Update agent instance position
              instance.position = newPosition;

            } catch (error) {
              console.warn('⚠️ Error positioning emoji:', error);
            }
          }

          emojiInstanceIndex++;
          startIndex = emojiIndex + emoji.length;
        }
      }
    });

    console.log('🔧 Positioning complete');
  }

  // Keep the old function name for any internal calls but delegate to main sync
  updateAgentPositionsFromText(): void {
    this.resyncManually();
  }

  // === Event Handlers ===
  onEditorContentChange(content: string): void {
    this.editorContent = content;

    // Debounce to avoid too many updates while typing
    clearTimeout(this.updateTimeout);
    this.updateTimeout = setTimeout(() => {
      this.syncAgentsWithMarkdown();
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
    this.saveAgentsToStorage();
  }

  // New event handlers for AgentInstance
  onAgentInstanceCircleEvent(event: CircleEvent, instance: AgentInstance): void {
    console.log('🎯 Agent instance circle event:', event.type, instance.emoji, instance.id);

    if (event.type === 'doubleClick') {
      this.showModal = true;
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

  // === Utilitários ===

  // Helper method for template to iterate over agentInstances Map
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

  private getEmojiTitle(emoji: string): string {
    const titles: { [key: string]: string } = {
      '🚀': 'Performance Agent',
      '🔐': 'Auth Agent',
      '📊': 'Analytics Agent',
      '🛡️': 'Security Agent',
      '⚡': 'Speed Agent',
      '🎯': 'Target Agent',
      '🧠': 'AI Agent',
      '💻': 'System Agent',
      '📱': 'Mobile Agent',
      '🌐': 'Network Agent',
      '🔍': 'Search Agent',
      '🎪': 'Entertainment Agent',
      '🏆': 'Achievement Agent',
      '🔮': 'Prediction Agent',
      '💎': 'Premium Agent',
      '⭐': 'Star Agent',
      '🌟': 'Featured Agent',
      '💡': 'Insight Agent',
      '🔔': 'Notification Agent',
      '📈': 'Growth Agent',
      '🎮': 'Gaming Agent'
    };
    return titles[emoji] || `${emoji} Agent`;
  }

  private getEmojiDescription(emoji: string): string {
    const descriptions: { [key: string]: string } = {
      '🚀': 'Monitora performance da aplicação',
      '🔐': 'Gerencia autenticação de usuários',
      '📊': 'Coleta métricas de uso',
      '🛡️': 'Verifica vulnerabilidades',
      '⚡': 'Otimiza velocidade de resposta',
      '🎯': 'Foca em objetivos específicos',
      '🧠': 'Processamento com IA',
      '💻': 'Gerencia recursos do sistema',
      '📱': 'Interface mobile responsiva',
      '🌐': 'Conectividade e rede',
      '🔍': 'Busca e indexação',
      '🎪': 'Entretenimento e gamificação',
      '🏆': 'Conquistas e medalhas',
      '🔮': 'Previsões e tendências',
      '💎': 'Recursos premium',
      '⭐': 'Avaliações e favoritos',
      '🌟': 'Destaques especiais',
      '💡': 'Insights e sugestões',
      '🔔': 'Notificações e alertas',
      '📈': 'Crescimento e métricas',
      '🎮': 'Jogos e interatividade'
    };
    return descriptions[emoji] || `Agente especializado em ${emoji}`;
  }

  // === Persistência ===
  saveStateToLocalStorage(): void {
    // Convert Map to array of [key, value] to be JSON serializable
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

  // Legacy function for backward compatibility
  private saveAgentsToStorage(): void {
    this.saveStateToLocalStorage();
  }

  private loadStoredAgents(): void {
    this.loadStateFromLocalStorage();
  }

  private generateHash(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString();
  }
}