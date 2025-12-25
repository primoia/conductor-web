import { Component, Output, EventEmitter, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgentService } from '../../services/agent.service';

export interface AgentCreationData {
  emoji: string;
  title: string;
  description: string;
  color: string;
  position?: { x: number; y: number };
  mcp_configs?: string[];
}

@Component({
  selector: 'app-agent-creator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="agent-creator-backdrop" *ngIf="isVisible" (click)="onBackdropClick()">
      <div class="agent-creator-content" (click)="onContentClick($event)">
        <div class="creator-header">
          <h3>🛠️ Criar Novo Agente</h3>
          <button class="close-btn" (click)="onClose()">×</button>
        </div>

        <div class="creator-body">
          <!-- Emoji Selector -->
          <div class="form-section">
            <label class="form-label">Emoji do Agente:</label>
            <div class="emoji-grid">
              <button
                *ngFor="let emoji of availableEmojis"
                class="emoji-option"
                [class.selected]="selectedEmoji === emoji"
                (click)="selectEmoji(emoji)"
                [title]="getEmojiTitle(emoji)">
                {{ emoji }}
              </button>
            </div>
            <div class="custom-emoji-input">
              <label>Ou digite um emoji personalizado:</label>
              <input
                type="text"
                [(ngModel)]="customEmoji"
                (input)="onCustomEmojiInput()"
                placeholder="🎭"
                maxlength="2"
                class="emoji-input">
            </div>
          </div>

          <!-- Agent Info -->
          <div class="form-section">
            <label class="form-label">Título do Agente:</label>
            <input
              type="text"
              [(ngModel)]="agentTitle"
              placeholder="Ex: Test Agent, Custom Agent..."
              class="text-input"
              maxlength="50">
          </div>

          <div class="form-section">
            <label class="form-label">Descrição:</label>
            <textarea
              [(ngModel)]="agentDescription"
              placeholder="Descreva o que este agente faz..."
              class="text-area"
              maxlength="200"
              rows="3"></textarea>
          </div>

          <!-- Color Picker -->
          <div class="form-section">
            <label class="form-label">Cor do Agente:</label>
            <div class="color-selector">
              <div class="color-grid">
                <button
                  *ngFor="let color of predefinedColors"
                  class="color-option"
                  [class.selected]="selectedColor === color"
                  [style.background-color]="color"
                  (click)="selectColor(color)"
                  [title]="color">
                </button>
              </div>
              <div class="custom-color-input">
                <label>Cor personalizada:</label>
                <input
                  type="color"
                  [(ngModel)]="customColor"
                  (input)="onCustomColorInput()"
                  class="color-input">
                <span class="color-preview" [style.background-color]="selectedColor"></span>
              </div>
            </div>
          </div>

          <!-- Preview -->
          <div class="form-section">
            <label class="form-label">Preview:</label>
            <div class="agent-preview" [style.border-color]="selectedColor">
              <div class="preview-emoji">{{ getSelectedEmoji() }}</div>
              <div class="preview-info">
                <div class="preview-title">{{ agentTitle || 'Nome do Agente' }}</div>
                <div class="preview-description">{{ agentDescription || 'Descrição do agente' }}</div>
              </div>
            </div>
          </div>

          <!-- MCP Sidecars -->
          <div class="form-section">
            <label class="form-label">Ferramentas & Habilidades (MCP):</label>
            <div class="mcp-grid" *ngIf="availableSidecars.length > 0; else noSidecars">
              <div 
                *ngFor="let sidecar of availableSidecars" 
                class="mcp-option"
                [class.selected]="isSidecarSelected(sidecar)"
                (click)="toggleSidecar(sidecar)">
                <span class="mcp-check">{{ isSidecarSelected(sidecar) ? '✅' : '⬜' }}</span>
                <span class="mcp-name">{{ sidecar }}</span>
              </div>
            </div>
            <ng-template #noSidecars>
              <div class="no-sidecars">
                <p>Nenhuma ferramenta MCP descoberta.</p>
                <small>Verifique se os sidecars estão rodando no Docker.</small>
              </div>
            </ng-template>
          </div>
        </div>

        <div class="creator-footer">
          <button class="btn btn-secondary" (click)="onClose()">Cancelar</button>
          <button
            class="btn btn-primary"
            (click)="onCreate()"
            [disabled]="!isValid()">
            ✨ Criar Agente
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .agent-creator-backdrop {
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
    }

    .agent-creator-content {
      background: white;
      border-radius: 12px;
      max-width: 600px;
      width: 90%;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    }

    .creator-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px;
      border-bottom: 1px solid #eee;
      background: #f8f9fa;
      border-radius: 12px 12px 0 0;
    }

    .creator-header h3 {
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

    .creator-body {
      padding: 20px;
    }

    .form-section {
      margin-bottom: 20px;
    }

    .form-label {
      display: block;
      margin-bottom: 8px;
      font-weight: 600;
      color: #333;
      font-size: 14px;
    }

    .emoji-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(50px, 1fr));
      gap: 8px;
      margin-bottom: 15px;
    }

    .emoji-option {
      width: 50px;
      height: 50px;
      border: 2px solid #dee2e6;
      border-radius: 8px;
      background: #f8f9fa;
      cursor: pointer;
      font-size: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }

    .emoji-option:hover {
      border-color: #007bff;
      background: #e3f2fd;
      transform: scale(1.05);
    }

    .emoji-option.selected {
      border-color: #007bff;
      background: #007bff;
      color: white;
      box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.25);
    }

    .custom-emoji-input {
      margin-top: 15px;
      padding: 15px;
      background: #f8f9fa;
      border-radius: 8px;
      border: 1px solid #dee2e6;
    }

    .custom-emoji-input label {
      display: block;
      margin-bottom: 8px;
      font-size: 12px;
      color: #666;
    }

    .emoji-input {
      width: 80px;
      padding: 8px;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      font-size: 20px;
      text-align: center;
    }

    .text-input, .text-area {
      width: 100%;
      padding: 10px;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      font-size: 14px;
      font-family: inherit;
    }

    .text-input:focus, .text-area:focus {
      outline: none;
      border-color: #007bff;
      box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
    }

    .color-selector {
      display: flex;
      flex-direction: column;
      gap: 15px;
    }

    .color-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(40px, 1fr));
      gap: 8px;
    }

    .color-option {
      width: 40px;
      height: 40px;
      border: 3px solid #dee2e6;
      border-radius: 50%;
      cursor: pointer;
      transition: all 0.2s;
    }

    .color-option:hover {
      transform: scale(1.1);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }

    .color-option.selected {
      border-color: #333;
      box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.3);
    }

    .custom-color-input {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px;
      background: #f8f9fa;
      border-radius: 6px;
    }

    .custom-color-input label {
      margin: 0;
      font-size: 12px;
      color: #666;
    }

    .color-input {
      width: 50px;
      height: 30px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }

    .color-preview {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      border: 2px solid #dee2e6;
    }

    .agent-preview {
      display: flex;
      align-items: center;
      gap: 15px;
      padding: 15px;
      border: 3px solid #dee2e6;
      border-radius: 8px;
      background: #f8f9fa;
    }

    .preview-emoji {
      font-size: 36px;
      width: 50px;
      height: 50px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      background: white;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .preview-info {
      flex: 1;
    }

    .preview-title {
      font-weight: 600;
      font-size: 16px;
      color: #333;
      margin-bottom: 4px;
    }

    .preview-description {
      font-size: 12px;
      color: #666;
      line-height: 1.4;
    }

    .creator-footer {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding: 20px;
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

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .btn-secondary {
      background: #6c757d;
      color: white;
    }

    .btn-secondary:hover:not(:disabled) {
      background: #545b62;
    }

    .btn-primary {
      background: #007bff;
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      background: #0056b3;
    }

    .mcp-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 10px;
      max-height: 150px;
      overflow-y: auto;
      padding: 10px;
      background: #f8f9fa;
      border-radius: 8px;
      border: 1px solid #dee2e6;
    }

    .mcp-option {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px;
      background: white;
      border: 1px solid #dee2e6;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      transition: all 0.2s;
    }

    .mcp-option:hover {
      border-color: #007bff;
      background: #e3f2fd;
    }

    .mcp-option.selected {
      border-color: #007bff;
      background: #e3f2fd;
      color: #0056b3;
      font-weight: 500;
    }

    .mcp-check {
      font-size: 16px;
    }

    .no-sidecars {
      padding: 15px;
      text-align: center;
      background: #f8f9fa;
      border-radius: 8px;
      color: #666;
    }
  `]
})
export class AgentCreatorComponent implements OnInit {
  @Input() isVisible: boolean = false;
  @Output() agentCreated = new EventEmitter<AgentCreationData>();
  @Output() close = new EventEmitter<void>();

  constructor(private agentService: AgentService) { }

  ngOnInit(): void {
    this.loadSidecars();
  }

  // Available emojis from the main component
  availableEmojis = ['🚀', '🔐', '📊', '🛡️', '⚡', '🎯', '🧠', '💻', '📱', '🌐', '🔍', '🎪', '🏆', '🔮', '💎', '⭐', '🌟', '🧪'];

  // Predefined colors
  predefinedColors = [
    '#007bff', '#28a745', '#dc3545', '#ffc107', '#6f42c1',
    '#e83e8c', '#20c997', '#fd7e14', '#6c757d', '#343a40',
    '#17a2b8', '#f8f9fa', '#e9ecef', '#dee2e6', '#ced4da'
  ];

  // Form data
  selectedEmoji: string = '';
  customEmoji: string = '';
  agentTitle: string = '';
  agentDescription: string = '';
  selectedColor: string = '#007bff';
  customColor: string = '#007bff';

  // MCP Data
  availableSidecars: string[] = [];
  selectedSidecars: string[] = [];

  loadSidecars(): void {
    this.agentService.getAvailableSidecars().subscribe({
      next: (sidecars) => {
        this.availableSidecars = sidecars.sort();
        console.log('✅ [CREATOR] Loaded sidecars:', sidecars.length);
      },
      error: (err) => console.error('❌ [CREATOR] Error loading sidecars:', err)
    });
  }

  toggleSidecar(sidecar: string): void {
    const index = this.selectedSidecars.indexOf(sidecar);
    if (index > -1) {
      this.selectedSidecars.splice(index, 1);
    } else {
      this.selectedSidecars.push(sidecar);
    }
  }

  isSidecarSelected(sidecar: string): boolean {
    return this.selectedSidecars.includes(sidecar);
  }

  // Emoji definitions for titles
  private emojiTitles: { [key: string]: string } = {
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
    '🧪': 'Test Agent'
  };

  selectEmoji(emoji: string): void {
    this.selectedEmoji = emoji;
    this.customEmoji = '';

    // Auto-fill title and description if available
    if (this.emojiTitles[emoji] && !this.agentTitle) {
      this.agentTitle = this.emojiTitles[emoji];
    }
  }

  onCustomEmojiInput(): void {
    if (this.customEmoji) {
      this.selectedEmoji = '';
    }
  }

  selectColor(color: string): void {
    this.selectedColor = color;
    this.customColor = color;
  }

  onCustomColorInput(): void {
    this.selectedColor = this.customColor;
  }

  getSelectedEmoji(): string {
    return this.customEmoji || this.selectedEmoji || '🤖';
  }

  getEmojiTitle(emoji: string): string {
    return this.emojiTitles[emoji] || 'Agente personalizado';
  }

  isValid(): boolean {
    return !!(this.getSelectedEmoji() && this.agentTitle.trim() && this.agentDescription.trim());
  }

  onCreate(): void {
    if (this.isValid()) {
      const agentData: AgentCreationData = {
        emoji: this.getSelectedEmoji(),
        title: this.agentTitle.trim(),
        description: this.agentDescription.trim(),
        color: this.selectedColor,
        mcp_configs: [...this.selectedSidecars]
      };

      this.agentCreated.emit(agentData);
      this.resetForm();
    }
  }

  onClose(): void {
    this.close.emit();
    this.resetForm();
  }

  onBackdropClick(): void {
    this.onClose();
  }

  onContentClick(event: Event): void {
    event.stopPropagation();
  }

  private resetForm(): void {
    this.selectedEmoji = '';
    this.customEmoji = '';
    this.agentTitle = '';
    this.agentDescription = '';
    this.selectedColor = '#007bff';
    this.customColor = '#007bff';
    this.selectedSidecars = [];
  }
}