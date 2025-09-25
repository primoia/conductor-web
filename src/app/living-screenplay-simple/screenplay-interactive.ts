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
          <button (click)="scanAndCreateAgents()" class="control-btn">
            🔍 Escanear Emojis
          </button>
          <button (click)="updateAgentPositionsFromText()" class="control-btn">
            📍 Linkar com Texto
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
            *ngFor="let agent of agents"
            [data]="agent.data"
            [position]="agent.position"
            [container]="canvas"
            (circleEvent)="onAgentCircleEvent($event, agent)"
            (positionChange)="onAgentPositionChange($event, agent)">
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
    this.loadStoredAgents();
    this.scanAndCreateAgents();
  }

  // === Operações de Arquivo ===
  loadMarkdownFile(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.txt';
    input.onchange = (event: any) => {
      const file = event.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          this.editorContent = e.target?.result as string;
          this.currentFileName = file.name;
          this.scanAndCreateAgents();
          console.log('📁 Arquivo carregado:', file.name);
        };
        reader.readAsText(file);
      }
    };
    input.click();
  }

  saveMarkdownFile(): void {
    if (!this.currentFileName) {
      this.currentFileName = 'roteiro-vivo.md';
    }

    const blob = new Blob([this.editorContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = this.currentFileName;
    a.click();
    URL.revokeObjectURL(url);

    console.log('💾 Arquivo salvo:', this.currentFileName);
  }

  newMarkdownFile(): void {
    this.editorContent = '# Novo Roteiro\n\nDigite seu conteúdo aqui...';
    this.currentFileName = '';
    this.clearAllAgents();
    console.log('📄 Novo arquivo criado');
  }

  // === Controle de Views ===
  switchView(view: 'clean' | 'agents' | 'full'): void {
    this.currentView = view;
    console.log(`🌐 View alterada para: ${view}`);
  }

  // === Gerenciamento de Agentes ===
  scanAndCreateAgents(): void {
    const emojiPattern = /(\u{1F680}|\u{1F510}|\u{1F4CA}|\u{1F6E1}|\u{26A1}|\u{1F3AF}|\u{1F9E0}|\u{1F4BB}|\u{1F4F1}|\u{1F310}|\u{1F50D}|\u{1F3AA}|\u{1F3C6}|\u{1F52E}|\u{1F48E}|\u{2B50}|\u{1F31F})/gu;
    const matches = [...this.editorContent.matchAll(emojiPattern)];

    const emojiCount: { [key: string]: number } = {};
    const emojiPositions: { [key: string]: number[] } = {};

    matches.forEach(match => {
      const emoji = match[1];
      const position = match.index!;

      if (!emojiCount[emoji]) {
        emojiCount[emoji] = 0;
        emojiPositions[emoji] = [];
      }
      emojiCount[emoji]++;
      emojiPositions[emoji].push(position);
    });

    this.availableEmojis = Object.keys(emojiCount).map(emoji => ({
      emoji,
      count: emojiCount[emoji],
      positions: emojiPositions[emoji]
    }));

    // Auto-create agents for found emojis that don't have agents yet
    this.availableEmojis.forEach(emojiInfo => {
      this.createAgentsForEmoji(emojiInfo);
    });

    // Update positions of existing agents to match emoji positions in text
    this.updateAgentPositionsFromText();

    console.log('🔍 Escanear completo:', this.availableEmojis.length, 'tipos de emoji,', this.agents.length, 'agentes totais');
  }

  addManualAgent(): void {
    const canvas = this.canvas.nativeElement;
    const rect = canvas.getBoundingClientRect();

    const emojis = ['🚀', '🔐', '📊', '🛡️', '⚡', '🎯', '🧠', '💻', '📱', '🌐', '🔍'];
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];

    const agent: AgentConfig = {
      id: `manual-${Date.now()}`,
      emoji: randomEmoji,
      position: {
        x: Math.random() * (rect.width - 100) + 50,
        y: Math.random() * (rect.height - 100) + 50
      },
      data: {
        id: `manual-${Date.now()}`,
        emoji: randomEmoji,
        category: 'auth',
        title: this.getEmojiTitle(randomEmoji),
        description: this.getEmojiDescription(randomEmoji)
      }
    };

    this.agents.push(agent);
    this.saveAgentsToStorage();
    console.log('➕ Agente manual adicionado:', randomEmoji);
  }

  createAgentsForEmoji(emojiInfo: EmojiInfo): void {
    const existingAgents = this.agents.filter(a => a.emoji === emojiInfo.emoji);
    const missingCount = emojiInfo.count - existingAgents.length;

    if (missingCount <= 0) {
      console.log('✅ Todos os agentes já existem para', emojiInfo.emoji);
      return;
    }

    const canvas = this.canvas.nativeElement;
    const rect = canvas.getBoundingClientRect();

    for (let i = 0; i < missingCount; i++) {
      const instanceIndex = existingAgents.length + i;

      const agent: AgentConfig = {
        id: `${emojiInfo.emoji}-${instanceIndex}-${Date.now()}`,
        emoji: emojiInfo.emoji,
        instanceIndex,
        textPosition: emojiInfo.positions[instanceIndex] || 0,
        position: {
          x: Math.random() * (rect.width - 100) + 50,
          y: Math.random() * (rect.height - 100) + 50
        },
        data: {
          id: `${emojiInfo.emoji}-${instanceIndex}`,
          emoji: emojiInfo.emoji,
          category: 'auth',
          title: this.getEmojiTitle(emojiInfo.emoji),
          description: this.getEmojiDescription(emojiInfo.emoji)
        }
      };

      this.agents.push(agent);
    }

    this.saveAgentsToStorage();
    console.log(`✨ ${missingCount} agentes criados para ${emojiInfo.emoji}`);
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

  updateAgentPositionsFromText(): void {
    const canvas = this.canvas.nativeElement;
    if (!canvas) return;

    const editorElement = canvas.querySelector('.ProseMirror') || canvas.querySelector('[contenteditable]');
    if (!editorElement) {
      console.warn('⚠️ Editor element não encontrado para posicionamento');
      return;
    }

    // Group agents by emoji type
    const agentsByEmoji: { [emoji: string]: AgentConfig[] } = {};
    this.agents.forEach(agent => {
      if (!agentsByEmoji[agent.emoji]) {
        agentsByEmoji[agent.emoji] = [];
      }
      agentsByEmoji[agent.emoji].push(agent);
    });

    // Find and position each emoji in the DOM
    this.availableEmojis.forEach(emojiInfo => {
      const agentsForEmoji = agentsByEmoji[emojiInfo.emoji] || [];

      // Find all occurrences of this emoji in the DOM
      const walker = document.createTreeWalker(
        editorElement,
        NodeFilter.SHOW_TEXT,
        null
      );

      let node;
      let emojiInstanceIndex = 0;
      const canvasRect = canvas.getBoundingClientRect();

      while (node = walker.nextNode()) {
        const textContent = node.textContent || '';
        let startIndex = 0;

        while (true) {
          const emojiIndex = textContent.indexOf(emojiInfo.emoji, startIndex);
          if (emojiIndex === -1) break;

          // Position the corresponding agent if it exists
          if (emojiInstanceIndex < agentsForEmoji.length) {
            const agent = agentsForEmoji[emojiInstanceIndex];

            try {
              const range = document.createRange();
              range.setStart(node, emojiIndex);
              range.setEnd(node, emojiIndex + emojiInfo.emoji.length);

              const rect = range.getBoundingClientRect();

              // Calculate position relative to canvas
              const newPosition = {
                x: rect.left - canvasRect.left,
                y: rect.top - canvasRect.top
              };

              // Update agent position
              agent.position = newPosition;
              agent.textPosition = emojiIndex;
              agent.instanceIndex = emojiInstanceIndex;

              console.log(`📍 ${emojiInfo.emoji} #${emojiInstanceIndex} posicionado em (${newPosition.x}, ${newPosition.y})`);
            } catch (error) {
              console.warn('⚠️ Erro ao posicionar emoji:', error);
            }
          }

          emojiInstanceIndex++;
          startIndex = emojiIndex + emojiInfo.emoji.length;
        }
      }
    });

    this.saveAgentsToStorage();
  }

  // === Event Handlers ===
  onEditorContentChange(content: string): void {
    this.editorContent = content;

    // Debounce to avoid too many updates while typing
    clearTimeout(this.updateTimeout);
    this.updateTimeout = setTimeout(() => {
      this.scanAndCreateAgents();
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

  closeModal(): void {
    this.showModal = false;
  }

  // === Utilitários ===
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
  private saveAgentsToStorage(): void {
    const markdownHash = this.generateHash(this.editorContent);
    this.markdownAgentMap[markdownHash] = [...this.agents];
    localStorage.setItem('screenplay-agents', JSON.stringify(this.markdownAgentMap));
  }

  private loadStoredAgents(): void {
    try {
      const stored = localStorage.getItem('screenplay-agents');
      if (stored) {
        this.markdownAgentMap = JSON.parse(stored);

        const markdownHash = this.generateHash(this.editorContent);
        if (this.markdownAgentMap[markdownHash]) {
          // Reconstruct agents with proper data structure
          this.agents = this.markdownAgentMap[markdownHash].map(agent => ({
            ...agent,
            data: {
              id: agent.id,
              emoji: agent.emoji,
              category: 'auth' as const,
              title: this.getEmojiTitle(agent.emoji),
              description: this.getEmojiDescription(agent.emoji)
            }
          }));
          console.log(`🔄 ${this.agents.length} agentes restaurados e reconstruídos do localStorage`);
        }
      }
    } catch (error) {
      console.warn('⚠️ Erro ao carregar agentes do localStorage:', error);
      // Clear corrupted storage
      localStorage.removeItem('screenplay-agents');
      this.markdownAgentMap = {};
    }
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