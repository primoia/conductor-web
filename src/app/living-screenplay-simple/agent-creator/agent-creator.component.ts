import { Component, Output, EventEmitter, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgentService } from '../../services/agent.service';

export interface AgentCreationData {
  emoji: string;
  name: string;  // Changed from 'title' - must end with _Agent
  description: string;
  tags: string[];
  persona_content: string;
  mcp_configs: string[];
  position?: { x: number; y: number };
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
          <!-- Row 1: Identification + Tags -->
          <div class="form-row">
            <!-- Identification Column -->
            <div class="form-column">
              <div class="form-section">
                <label class="form-label">Emoji do Agente</label>
                <div class="emoji-row">
                  <button
                    *ngFor="let emoji of availableEmojis"
                    class="emoji-option"
                    [class.selected]="selectedEmoji === emoji"
                    (click)="selectEmoji(emoji)">
                    {{ emoji }}
                  </button>
                  <input
                    type="text"
                    [(ngModel)]="customEmoji"
                    (input)="onCustomEmojiInput()"
                    placeholder="🎭"
                    maxlength="2"
                    class="emoji-input"
                    title="Ou digite um emoji personalizado">
                </div>
              </div>

              <div class="form-section">
                <label class="form-label">Nome do Agente</label>
                <div class="name-input-wrapper">
                  <input
                    type="text"
                    [(ngModel)]="agentName"
                    (input)="onNameInput()"
                    placeholder="MeuAgente"
                    class="text-input"
                    [class.invalid]="agentName && !isNameValid()"
                    maxlength="50">
                  <span class="name-suffix">_Agent</span>
                </div>
                <small class="field-hint" [class.error]="agentName && !isNameValid()">
                  {{ getNameValidationMessage() }}
                </small>
              </div>
            </div>

            <!-- Tags Column -->
            <div class="form-column">
              <div class="form-section">
                <label class="form-label">Tags</label>
                <div class="tags-container">
                  <div class="tags-list">
                    <span *ngFor="let tag of tags; let i = index" class="tag-chip">
                      {{ tag }}
                      <button class="tag-remove" (click)="removeTag(i)">×</button>
                    </span>
                  </div>
                  <div class="tag-input-wrapper">
                    <input
                      type="text"
                      [(ngModel)]="newTag"
                      (keydown.enter)="addTag()"
                      (keydown.comma)="addTag(); $event.preventDefault()"
                      placeholder="Digite e pressione Enter..."
                      class="tag-input"
                      maxlength="30">
                    <button class="tag-add-btn" (click)="addTag()" [disabled]="!newTag.trim()">+</button>
                  </div>
                </div>
                <small class="field-hint">Ajudam na busca e organização</small>
              </div>
            </div>
          </div>

          <!-- Row 2: Description -->
          <div class="form-section">
            <label class="form-label">Descrição <span class="char-count">({{ agentDescription.length }}/200)</span></label>
            <textarea
              [(ngModel)]="agentDescription"
              placeholder="Descreva o que este agente faz em 10-200 caracteres..."
              class="text-area"
              [class.invalid]="agentDescription && !isDescriptionValid()"
              maxlength="200"
              rows="2"></textarea>
            <small class="field-hint" [class.error]="agentDescription && !isDescriptionValid()">
              {{ getDescriptionValidationMessage() }}
            </small>
          </div>

          <!-- Row 3: MCP Sidecars -->
          <div class="form-section">
            <label class="form-label">
              Ferramentas MCP
              <span class="mcp-count">({{ selectedSidecars.length }} de {{ filteredSidecars.length }} selecionadas)</span>
            </label>
            <div class="mcp-filter">
              <input
                type="text"
                [(ngModel)]="sidecarFilter"
                (input)="filterSidecars()"
                placeholder="🔍 Filtrar sidecars..."
                class="filter-input">
            </div>
            <div class="mcp-grid" *ngIf="filteredSidecars.length > 0; else noSidecars">
              <div
                *ngFor="let sidecar of filteredSidecars"
                class="mcp-option"
                [class.selected]="isSidecarSelected(sidecar)"
                (click)="toggleSidecar(sidecar)">
                <span class="mcp-check">{{ isSidecarSelected(sidecar) ? '✅' : '⬜' }}</span>
                <span class="mcp-name">{{ formatSidecarName(sidecar) }}</span>
              </div>
            </div>
            <ng-template #noSidecars>
              <div class="no-sidecars">
                <p *ngIf="availableSidecars.length === 0">Nenhuma ferramenta MCP descoberta.</p>
                <p *ngIf="availableSidecars.length > 0 && filteredSidecars.length === 0">Nenhum resultado para "{{ sidecarFilter }}"</p>
              </div>
            </ng-template>
          </div>

          <!-- Row 4: Persona -->
          <div class="form-section">
            <label class="form-label">
              Persona (Markdown)
              <span class="char-count">({{ personaContent.length }} chars, mín 50)</span>
            </label>
            <textarea
              [(ngModel)]="personaContent"
              placeholder="# Especialista em...

Você é um agente especializado em...

## Suas responsabilidades:
- ..."
              class="persona-area"
              [class.invalid]="personaContent && !isPersonaValid()"
              rows="6"></textarea>
            <small class="field-hint" [class.error]="personaContent && !isPersonaValid()">
              {{ getPersonaValidationMessage() }}
            </small>
          </div>

          <!-- Preview -->
          <div class="form-section preview-section">
            <label class="form-label">Preview</label>
            <div class="agent-preview">
              <div class="preview-emoji">{{ getSelectedEmoji() }}</div>
              <div class="preview-info">
                <div class="preview-title">{{ getFullAgentName() }}</div>
                <div class="preview-description">{{ agentDescription || 'Descrição do agente...' }}</div>
                <div class="preview-tags" *ngIf="tags.length > 0">
                  <span *ngFor="let tag of tags" class="preview-tag">{{ tag }}</span>
                </div>
                <div class="preview-mcp" *ngIf="selectedSidecars.length > 0">
                  🔧 {{ selectedSidecars.length }} MCP{{ selectedSidecars.length > 1 ? 's' : '' }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="creator-footer">
          <div class="validation-summary" *ngIf="!isValid()">
            <span class="validation-icon">⚠️</span>
            <span>{{ getValidationSummary() }}</span>
          </div>
          <div class="footer-buttons">
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
      max-width: 900px;
      width: 95%;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    }

    .creator-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid #eee;
      background: #f8f9fa;
      border-radius: 12px 12px 0 0;
      position: sticky;
      top: 0;
      z-index: 10;
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

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 16px;
    }

    @media (max-width: 700px) {
      .form-row {
        grid-template-columns: 1fr;
      }
    }

    .form-column {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .form-section {
      margin-bottom: 16px;
    }

    .form-label {
      display: block;
      margin-bottom: 6px;
      font-weight: 600;
      color: #333;
      font-size: 13px;
    }

    .char-count, .mcp-count {
      font-weight: 400;
      color: #888;
      font-size: 12px;
    }

    .field-hint {
      display: block;
      margin-top: 4px;
      font-size: 11px;
      color: #888;
    }

    .field-hint.error {
      color: #dc3545;
    }

    /* Emoji Row */
    .emoji-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
    }

    .emoji-option {
      width: 36px;
      height: 36px;
      border: 2px solid #dee2e6;
      border-radius: 6px;
      background: #f8f9fa;
      cursor: pointer;
      font-size: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s;
    }

    .emoji-option:hover {
      border-color: #007bff;
      background: #e3f2fd;
      transform: scale(1.05);
    }

    .emoji-option.selected {
      border-color: #007bff;
      background: #007bff;
      box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
    }

    .emoji-input {
      width: 50px;
      height: 36px;
      padding: 4px;
      border: 2px dashed #dee2e6;
      border-radius: 6px;
      font-size: 18px;
      text-align: center;
    }

    .emoji-input:focus {
      border-color: #007bff;
      outline: none;
    }

    /* Name Input */
    .name-input-wrapper {
      display: flex;
      align-items: center;
      background: #f8f9fa;
      border: 1px solid #dee2e6;
      border-radius: 6px;
      overflow: hidden;
    }

    .name-input-wrapper .text-input {
      flex: 1;
      border: none;
      background: transparent;
      padding: 10px 12px;
      font-size: 14px;
    }

    .name-input-wrapper .text-input:focus {
      outline: none;
    }

    .name-input-wrapper .text-input.invalid {
      color: #dc3545;
    }

    .name-suffix {
      padding: 10px 12px;
      background: #e9ecef;
      color: #666;
      font-weight: 500;
      font-size: 14px;
      border-left: 1px solid #dee2e6;
    }

    /* Tags */
    .tags-container {
      background: #f8f9fa;
      border: 1px solid #dee2e6;
      border-radius: 6px;
      padding: 8px;
      min-height: 80px;
    }

    .tags-list {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 8px;
    }

    .tag-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      background: #007bff;
      color: white;
      border-radius: 12px;
      font-size: 12px;
    }

    .tag-remove {
      background: none;
      border: none;
      color: white;
      cursor: pointer;
      padding: 0;
      font-size: 14px;
      line-height: 1;
      opacity: 0.8;
    }

    .tag-remove:hover {
      opacity: 1;
    }

    .tag-input-wrapper {
      display: flex;
      gap: 6px;
    }

    .tag-input {
      flex: 1;
      padding: 6px 10px;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      font-size: 13px;
    }

    .tag-add-btn {
      padding: 6px 12px;
      background: #28a745;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    }

    .tag-add-btn:disabled {
      background: #ccc;
      cursor: not-allowed;
    }

    /* Text inputs */
    .text-input, .text-area, .persona-area {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #dee2e6;
      border-radius: 6px;
      font-size: 14px;
      font-family: inherit;
      transition: border-color 0.2s;
    }

    .text-input:focus, .text-area:focus, .persona-area:focus {
      outline: none;
      border-color: #007bff;
      box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.15);
    }

    .text-input.invalid, .text-area.invalid, .persona-area.invalid {
      border-color: #dc3545;
    }

    .persona-area {
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 13px;
      line-height: 1.5;
      resize: vertical;
      min-height: 120px;
    }

    /* MCP Grid */
    .mcp-filter {
      margin-bottom: 8px;
    }

    .filter-input {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #dee2e6;
      border-radius: 6px;
      font-size: 13px;
    }

    .mcp-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 8px;
      max-height: 150px;
      overflow-y: auto;
      padding: 8px;
      background: #f8f9fa;
      border-radius: 6px;
      border: 1px solid #dee2e6;
    }

    .mcp-option {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 8px;
      background: white;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      transition: all 0.15s;
    }

    .mcp-option:hover {
      border-color: #007bff;
      background: #e3f2fd;
    }

    .mcp-option.selected {
      border-color: #007bff;
      background: #e3f2fd;
      font-weight: 500;
    }

    .mcp-check {
      font-size: 14px;
    }

    .mcp-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .no-sidecars {
      padding: 20px;
      text-align: center;
      background: #f8f9fa;
      border-radius: 6px;
      color: #666;
      font-size: 13px;
    }

    /* Preview */
    .preview-section {
      margin-top: 8px;
      padding-top: 16px;
      border-top: 1px dashed #dee2e6;
    }

    .agent-preview {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px;
      border: 2px solid #007bff;
      border-radius: 8px;
      background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
    }

    .preview-emoji {
      font-size: 32px;
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      background: white;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      flex-shrink: 0;
    }

    .preview-info {
      flex: 1;
      min-width: 0;
    }

    .preview-title {
      font-weight: 600;
      font-size: 15px;
      color: #333;
      margin-bottom: 4px;
    }

    .preview-description {
      font-size: 12px;
      color: #666;
      line-height: 1.4;
      margin-bottom: 6px;
    }

    .preview-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-bottom: 4px;
    }

    .preview-tag {
      padding: 2px 6px;
      background: #6c757d;
      color: white;
      border-radius: 8px;
      font-size: 10px;
    }

    .preview-mcp {
      font-size: 11px;
      color: #007bff;
    }

    /* Footer */
    .creator-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-top: 1px solid #eee;
      background: #f8f9fa;
      border-radius: 0 0 12px 12px;
      position: sticky;
      bottom: 0;
    }

    .validation-summary {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #856404;
      font-size: 12px;
    }

    .footer-buttons {
      display: flex;
      gap: 10px;
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

  // Available emojis - compact list
  availableEmojis = ['🚀', '🔐', '📊', '🛡️', '⚡', '🎯', '🧠', '💻', '📱', '🌐', '🔍', '🧪'];

  // Form data
  selectedEmoji: string = '🤖';
  customEmoji: string = '';
  agentName: string = '';
  agentDescription: string = '';
  tags: string[] = [];
  newTag: string = '';
  personaContent: string = '';

  // MCP Data
  availableSidecars: string[] = [];
  filteredSidecars: string[] = [];
  selectedSidecars: string[] = [];
  sidecarFilter: string = '';

  loadSidecars(): void {
    this.agentService.getAvailableSidecars().subscribe({
      next: (sidecars) => {
        this.availableSidecars = sidecars.sort();
        this.filteredSidecars = [...this.availableSidecars];
        console.log('✅ [CREATOR] Loaded sidecars:', sidecars.length);
      },
      error: (err) => console.error('❌ [CREATOR] Error loading sidecars:', err)
    });
  }

  // Emoji methods
  selectEmoji(emoji: string): void {
    this.selectedEmoji = emoji;
    this.customEmoji = '';
  }

  onCustomEmojiInput(): void {
    if (this.customEmoji) {
      this.selectedEmoji = '';
    }
  }

  getSelectedEmoji(): string {
    return this.customEmoji || this.selectedEmoji || '🤖';
  }

  // Name validation
  onNameInput(): void {
    // Remove spaces and special chars as user types
    this.agentName = this.agentName.replace(/[^a-zA-Z0-9_]/g, '');
  }

  isNameValid(): boolean {
    return this.agentName.length >= 2 && /^[A-Za-z][A-Za-z0-9_]*$/.test(this.agentName);
  }

  getNameValidationMessage(): string {
    if (!this.agentName) return 'Nome sem espaços, será sufixado com _Agent';
    if (this.agentName.length < 2) return 'Mínimo 2 caracteres';
    if (!/^[A-Za-z]/.test(this.agentName)) return 'Deve começar com letra';
    return `Será salvo como: ${this.getFullAgentName()}`;
  }

  getFullAgentName(): string {
    if (!this.agentName) return 'Nome_Agent';
    return `${this.agentName}_Agent`;
  }

  // Description validation
  isDescriptionValid(): boolean {
    const len = this.agentDescription.trim().length;
    return len >= 10 && len <= 200;
  }

  getDescriptionValidationMessage(): string {
    const len = this.agentDescription.trim().length;
    if (len === 0) return '10-200 caracteres';
    if (len < 10) return `Faltam ${10 - len} caracteres`;
    return '✓ Válido';
  }

  // Tags methods
  addTag(): void {
    const tag = this.newTag.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (tag && !this.tags.includes(tag) && this.tags.length < 10) {
      this.tags.push(tag);
      this.newTag = '';
    }
  }

  removeTag(index: number): void {
    this.tags.splice(index, 1);
  }

  // Persona validation
  isPersonaValid(): boolean {
    const content = this.personaContent.trim();
    return content.length >= 50 && content.startsWith('#');
  }

  getPersonaValidationMessage(): string {
    const content = this.personaContent.trim();
    if (content.length === 0) return 'Deve começar com # (Markdown) e ter mín 50 chars';
    if (!content.startsWith('#')) return 'Deve começar com um cabeçalho Markdown (#)';
    if (content.length < 50) return `Faltam ${50 - content.length} caracteres`;
    return '✓ Válido';
  }

  // MCP methods
  filterSidecars(): void {
    const filter = this.sidecarFilter.toLowerCase();
    this.filteredSidecars = this.availableSidecars.filter(s =>
      s.toLowerCase().includes(filter)
    );
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

  formatSidecarName(name: string): string {
    // Truncate long names for display
    return name.length > 25 ? name.substring(0, 22) + '...' : name;
  }

  // Overall validation
  isValid(): boolean {
    return this.isNameValid() && this.isDescriptionValid() && this.isPersonaValid();
  }

  getValidationSummary(): string {
    const issues: string[] = [];
    if (!this.isNameValid()) issues.push('nome');
    if (!this.isDescriptionValid()) issues.push('descrição');
    if (!this.isPersonaValid()) issues.push('persona');
    return `Preencha: ${issues.join(', ')}`;
  }

  onCreate(): void {
    if (this.isValid()) {
      const agentData: AgentCreationData = {
        emoji: this.getSelectedEmoji(),
        name: this.getFullAgentName(),
        description: this.agentDescription.trim(),
        tags: [...this.tags],
        persona_content: this.personaContent.trim(),
        mcp_configs: [...this.selectedSidecars]
      };

      console.log('🛠️ [CREATOR] Creating agent:', agentData);
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
    this.selectedEmoji = '🤖';
    this.customEmoji = '';
    this.agentName = '';
    this.agentDescription = '';
    this.tags = [];
    this.newTag = '';
    this.personaContent = '';
    this.selectedSidecars = [];
    this.sidecarFilter = '';
    this.filteredSidecars = [...this.availableSidecars];
  }
}
