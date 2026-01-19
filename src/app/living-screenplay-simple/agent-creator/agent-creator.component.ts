import { Component, Output, EventEmitter, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgentService, MCPRegistryEntry, Agent } from '../../services/agent.service';

// Interface para filtros de MCP
interface McpFilter {
  search: string;
  category: string;
  status: string;
}

export interface AgentCreationData {
  emoji: string;
  name: string;  // Changed from 'title' - must end with _Agent
  description: string;
  group: string; // Agent group/category
  tags: string[];
  persona_content: string;
  mcp_configs: string[];
  position?: { x: number; y: number };
}

// Available agent groups
export const AGENT_GROUPS = [
  { id: 'development', label: 'Desenvolvimento', icon: '💻' },
  { id: 'crm', label: 'CRM', icon: '👥' },
  { id: 'documentation', label: 'Documentação', icon: '📝' },
  { id: 'devops', label: 'DevOps', icon: '🔧' },
  { id: 'orchestration', label: 'Orquestração', icon: '🎭' },
  { id: 'testing', label: 'Testes', icon: '🧪' },
  { id: 'career', label: 'Carreira', icon: '📈' },
  { id: 'other', label: 'Outro', icon: '📦' }
];

type TabType = 'definition' | 'mcp' | 'persona' | 'preview';

@Component({
  selector: 'app-agent-creator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="agent-creator-backdrop" *ngIf="isVisible" (click)="onBackdropClick()">
      <div class="agent-creator-content" (click)="onContentClick($event)">
        <!-- Header -->
        <div class="creator-header">
          <h3>{{ isEditMode ? '✏️ Editar Agente' : '🛠️ Criar Novo Agente' }}</h3>
          <button class="close-btn" (click)="onClose()">×</button>
        </div>

        <!-- Tabs Navigation -->
        <div class="tabs-nav">
          <button
            class="tab-btn"
            [class.active]="activeTab === 'definition'"
            [class.has-error]="!isDefinitionValid()"
            (click)="activeTab = 'definition'">
            <span class="tab-icon">📋</span>
            <span class="tab-label">Definição</span>
            <span class="tab-status" *ngIf="!isDefinitionValid()">!</span>
          </button>
          <button
            class="tab-btn"
            [class.active]="activeTab === 'mcp'"
            (click)="activeTab = 'mcp'">
            <span class="tab-icon">🔌</span>
            <span class="tab-label">MCPs</span>
            <span class="tab-badge" *ngIf="selectedMcps.length > 0">{{ selectedMcps.length }}</span>
          </button>
          <button
            class="tab-btn"
            [class.active]="activeTab === 'persona'"
            [class.has-error]="!isPersonaValid()"
            (click)="activeTab = 'persona'">
            <span class="tab-icon">🎭</span>
            <span class="tab-label">Persona</span>
            <span class="tab-status" *ngIf="!isPersonaValid()">!</span>
          </button>
          <button
            class="tab-btn"
            [class.active]="activeTab === 'preview'"
            (click)="activeTab = 'preview'">
            <span class="tab-icon">👁️</span>
            <span class="tab-label">Preview</span>
          </button>
        </div>

        <!-- Tab Content -->
        <div class="creator-body">
          <!-- TAB 1: Definition -->
          <div class="tab-content" *ngIf="activeTab === 'definition'">
            <!-- Row 1: Emoji -->
            <div class="form-section">
              <label class="form-label">Emoji</label>
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
                  title="Emoji personalizado">
              </div>
            </div>

            <!-- Row 2: Name -->
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

            <!-- Row 3: Description -->
            <div class="form-section">
              <label class="form-label">
                Descrição
                <span class="char-count">({{ agentDescription.length }}/200)</span>
              </label>
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

            <!-- Row 3: Group -->
            <div class="form-section">
              <label class="form-label">Grupo</label>
              <div class="group-selector">
                <button
                  *ngFor="let group of agentGroups"
                  class="group-option"
                  [class.selected]="selectedGroup === group.id"
                  (click)="selectedGroup = group.id"
                  [title]="group.label">
                  <span class="group-icon">{{ group.icon }}</span>
                  <span class="group-label">{{ group.label }}</span>
                </button>
              </div>
            </div>

            <!-- Row 4: Tags -->
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

          <!-- TAB 2: MCP -->
          <div class="tab-content mcp-tab" *ngIf="activeTab === 'mcp'">
            <div class="mcp-header">
              <label class="form-label">
                Ferramentas MCP
                <span class="mcp-count">({{ selectedMcps.length }} de {{ availableMcps.length }} selecionadas)</span>
              </label>
              <small class="mcp-hint">
                Selecione os MCPs (Model Context Protocol) que este agente poderá utilizar.
                MCPs parados (○) serão iniciados automaticamente quando necessário.
              </small>
            </div>

            <!-- Filtros -->
            <div class="mcp-filters">
              <input
                type="text"
                [(ngModel)]="mcpFilter.search"
                (ngModelChange)="filterMcps()"
                placeholder="🔍 Buscar ferramenta..."
                class="mcp-search">
              <select
                [(ngModel)]="mcpFilter.category"
                (ngModelChange)="filterMcps()"
                class="mcp-category-filter">
                <option value="">Todas categorias</option>
                <option *ngFor="let cat of mcpCategories" [value]="cat">{{ cat }}</option>
              </select>
              <select
                [(ngModel)]="mcpFilter.status"
                (ngModelChange)="filterMcps()"
                class="mcp-status-filter">
                <option value="">Todos status</option>
                <option value="healthy">● Ativos</option>
                <option value="stopped">○ Parados</option>
              </select>
            </div>

            <!-- Selected MCPs -->
            <div class="selected-mcps" *ngIf="selectedMcps.length > 0">
              <label class="form-label-small">Selecionados:</label>
              <div class="selected-mcps-list">
                <span *ngFor="let mcpName of selectedMcps" class="selected-mcp-chip">
                  {{ formatMcpName(mcpName) }}
                  <button class="mcp-remove" (click)="removeMcp(mcpName)">×</button>
                </span>
              </div>
            </div>

            <!-- Grid -->
            <div class="mcp-grid-large" *ngIf="filteredMcps.length > 0; else noMcps">
              <div
                *ngFor="let mcp of filteredMcps"
                class="mcp-card"
                [class.selected]="isMcpSelected(mcp.name)"
                [class.stopped]="mcp.status === 'stopped'"
                (click)="toggleMcp(mcp)">
                <div class="mcp-card-header">
                  <span class="mcp-status-indicator" [class]="mcp.status">{{ getStatusIcon(mcp.status) }}</span>
                  <span class="mcp-checkbox">{{ isMcpSelected(mcp.name) ? '✓' : '' }}</span>
                </div>
                <div class="mcp-card-body">
                  <span class="mcp-card-name">{{ mcp.name }}</span>
                  <span class="mcp-card-category" *ngIf="mcp.metadata?.category">{{ mcp.metadata?.category }}</span>
                  <span class="mcp-card-description" *ngIf="mcp.metadata?.description">{{ mcp.metadata?.description }}</span>
                </div>
              </div>
            </div>
            <ng-template #noMcps>
              <div class="no-mcps-large">
                <div class="no-mcps-icon">🔌</div>
                <p *ngIf="availableMcps.length === 0">Nenhuma ferramenta MCP descoberta no sistema.</p>
                <p *ngIf="availableMcps.length > 0 && filteredMcps.length === 0">Nenhum resultado para os filtros aplicados.</p>
              </div>
            </ng-template>
          </div>

          <!-- TAB 3: Persona -->
          <div class="tab-content persona-tab" *ngIf="activeTab === 'persona'">
            <div class="persona-header">
              <label class="form-label">
                Persona do Agente (Markdown)
                <span class="char-count">({{ personaContent.length }} caracteres)</span>
              </label>
              <small class="persona-hint">
                Define a personalidade, conhecimentos e comportamentos do agente. Mínimo 50 caracteres, deve começar com #.
              </small>
            </div>
            <textarea
              [(ngModel)]="personaContent"
              placeholder="# Especialista em...

Você é um agente especializado em...

## Suas responsabilidades:
- Analisar e resolver problemas de...
- Fornecer orientações sobre...

## Seu estilo de comunicação:
- Seja objetivo e claro
- Use exemplos práticos quando possível

## Restrições:
- Nunca faça X sem antes verificar Y
- Sempre confirme antes de executar ações destrutivas"
              class="persona-editor"
              [class.invalid]="personaContent && !isPersonaValid()"></textarea>
            <div class="persona-footer">
              <small class="field-hint" [class.error]="personaContent && !isPersonaValid()">
                {{ getPersonaValidationMessage() }}
              </small>
            </div>
          </div>

          <!-- TAB 4: Preview -->
          <div class="tab-content preview-tab" *ngIf="activeTab === 'preview'">
            <div class="preview-container">
              <!-- Agent Card Preview -->
              <div class="preview-section">
                <h4>Como aparece no catálogo:</h4>
                <div class="agent-card-preview-full">
                  <div class="card-header-preview">
                    <div class="agent-emoji-preview">{{ getSelectedEmoji() }}</div>
                    <div class="agent-meta-preview">
                      <span class="agent-group-badge-preview" [attr.data-group]="selectedGroup">
                        {{ getSelectedGroupIcon() }} {{ getSelectedGroupLabel() }}
                      </span>
                    </div>
                  </div>
                  <div class="card-body-preview">
                    <h3 class="agent-name-preview">{{ getFullAgentName() || 'Nome_Agent' }}</h3>
                    <p class="agent-description-preview">{{ agentDescription || 'Descrição do agente...' }}</p>
                    <div class="agent-tags-preview" *ngIf="tags.length > 0">
                      <span *ngFor="let tag of tags" class="tag-preview">{{ tag }}</span>
                    </div>
                    <div class="agent-mcps-preview" *ngIf="selectedMcps.length > 0">
                      🔌 {{ selectedMcps.length }} MCP{{ selectedMcps.length > 1 ? 's' : '' }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
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
              {{ isEditMode ? '💾 Salvar Alterações' : '✨ Criar Agente' }}
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
      max-width: 800px;
      width: 95%;
      height: 85vh;
      max-height: 700px;
      display: flex;
      flex-direction: column;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      overflow: hidden;
    }

    /* Header */
    .creator-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid #eee;
      background: #f8f9fa;
      flex-shrink: 0;
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

    /* Tabs Navigation */
    .tabs-nav {
      display: flex;
      gap: 4px;
      padding: 12px 20px;
      background: #f8f9fa;
      border-bottom: 1px solid #eee;
      flex-shrink: 0;
    }

    .tab-btn {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 10px 16px;
      border: 1px solid #dee2e6;
      background: white;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 13px;
      color: #666;
      position: relative;
    }

    .tab-btn:hover {
      background: #f0f4ff;
      border-color: #007bff;
      color: #007bff;
    }

    .tab-btn.active {
      background: #007bff;
      border-color: #007bff;
      color: white;
    }

    .tab-btn.has-error:not(.active) {
      border-color: #dc3545;
    }

    .tab-btn.has-error:not(.active) .tab-status {
      display: flex;
    }

    .tab-icon {
      font-size: 16px;
    }

    .tab-label {
      font-weight: 500;
    }

    .tab-status {
      display: none;
      position: absolute;
      top: -4px;
      right: -4px;
      width: 16px;
      height: 16px;
      background: #dc3545;
      color: white;
      border-radius: 50%;
      font-size: 10px;
      font-weight: bold;
      align-items: center;
      justify-content: center;
    }

    .tab-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      min-width: 18px;
      height: 18px;
      padding: 0 4px;
      background: #28a745;
      color: white;
      border-radius: 9px;
      font-size: 10px;
      font-weight: bold;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* Body */
    .creator-body {
      flex: 1;
      overflow: hidden;
      padding: 20px;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }

    .tab-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      min-height: 0;
      animation: fadeIn 0.2s ease;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    /* Form Elements */
    .form-row {
      display: flex;
      gap: 20px;
      margin-bottom: 16px;
    }

    .form-section {
      margin-bottom: 16px;
    }

    .emoji-section {
      flex: 0 0 auto;
    }

    .name-section {
      flex: 1;
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
    }

    .emoji-option.selected {
      border-color: #007bff;
      background: #007bff;
      box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
    }

    .emoji-input {
      width: 44px;
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

    /* Text inputs */
    .text-input, .text-area {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #dee2e6;
      border-radius: 6px;
      font-size: 14px;
      font-family: inherit;
      transition: border-color 0.2s;
    }

    .text-input:focus, .text-area:focus {
      outline: none;
      border-color: #007bff;
      box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.15);
    }

    .text-input.invalid, .text-area.invalid {
      border-color: #dc3545;
    }

    /* Group Selector */
    .group-selector {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .group-option {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      border: 2px solid #dee2e6;
      border-radius: 10px;
      background: #f8f9fa;
      cursor: pointer;
      font-size: 13px;
      transition: all 0.15s;
    }

    .group-option:hover {
      border-color: #007bff;
      background: #e3f2fd;
    }

    .group-option.selected {
      border-color: #007bff;
      background: #007bff;
      color: white;
    }

    .group-icon {
      font-size: 16px;
    }

    .group-label {
      font-weight: 500;
    }

    /* Tags */
    .tags-container {
      background: #f8f9fa;
      border: 1px solid #dee2e6;
      border-radius: 6px;
      padding: 8px;
      min-height: 60px;
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

    /* MCP Section */
    .mcp-section .mcp-filters {
      display: flex;
      gap: 8px;
      margin-bottom: 10px;
    }

    .mcp-search {
      flex: 1;
      padding: 6px 10px;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      font-size: 12px;
    }

    .mcp-category-filter, .mcp-status-filter {
      padding: 6px 8px;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      font-size: 12px;
      background: white;
    }

    .mcp-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
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
      padding: 8px 10px;
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
    }

    .mcp-option.selected .mcp-check {
      background: #007bff;
      color: white;
    }

    .mcp-option.stopped {
      opacity: 0.75;
    }

    .mcp-status-dot {
      font-size: 10px;
    }

    .mcp-status-dot.healthy { color: #10b981; }
    .mcp-status-dot.stopped { color: #6b7280; }
    .mcp-status-dot.starting { color: #f59e0b; }

    .mcp-check {
      width: 16px;
      height: 16px;
      border: 1px solid #dee2e6;
      border-radius: 3px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      background: white;
    }

    .mcp-info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
    }

    .mcp-info .mcp-name {
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .mcp-info .mcp-category {
      font-size: 10px;
      color: #888;
      text-transform: uppercase;
    }

    .no-mcps {
      padding: 20px;
      text-align: center;
      background: #f8f9fa;
      border-radius: 6px;
      color: #666;
      font-size: 13px;
    }

    /* MCP Tab - Full page */
    .mcp-tab {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .mcp-header {
      margin-bottom: 16px;
    }

    .mcp-hint {
      display: block;
      color: #666;
      font-size: 12px;
      margin-top: 4px;
      line-height: 1.4;
    }

    .mcp-tab .mcp-filters {
      display: flex;
      gap: 10px;
      margin-bottom: 16px;
    }

    .mcp-tab .mcp-search {
      flex: 1;
      padding: 10px 14px;
      border: 1px solid #dee2e6;
      border-radius: 6px;
      font-size: 14px;
    }

    .mcp-tab .mcp-category-filter,
    .mcp-tab .mcp-status-filter {
      padding: 10px 12px;
      border: 1px solid #dee2e6;
      border-radius: 6px;
      font-size: 13px;
      background: white;
      min-width: 130px;
    }

    .selected-mcps {
      margin-bottom: 16px;
      padding: 12px;
      background: #e8f5e9;
      border-radius: 8px;
      border: 1px solid #c8e6c9;
    }

    .form-label-small {
      font-size: 11px;
      font-weight: 600;
      color: #2e7d32;
      text-transform: uppercase;
      margin-bottom: 8px;
      display: block;
    }

    .selected-mcps-list {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .selected-mcp-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      background: #4caf50;
      color: white;
      border-radius: 14px;
      font-size: 12px;
      font-weight: 500;
    }

    .mcp-remove {
      background: none;
      border: none;
      color: white;
      cursor: pointer;
      padding: 0;
      font-size: 14px;
      line-height: 1;
      opacity: 0.8;
      margin-left: 2px;
    }

    .mcp-remove:hover {
      opacity: 1;
    }

    .mcp-grid-large {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 12px;
      flex: 1;
      overflow-y: auto;
      padding: 4px;
      min-height: 0;
      align-content: start;
    }

    .mcp-card {
      background: white;
      border: 2px solid #dee2e6;
      border-radius: 10px;
      padding: 12px;
      cursor: pointer;
      transition: all 0.15s;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .mcp-card:hover {
      border-color: #007bff;
      background: #f8faff;
    }

    .mcp-card.selected {
      border-color: #28a745;
      background: #f1f8f2;
    }

    .mcp-card.stopped {
      opacity: 0.8;
    }

    .mcp-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .mcp-status-indicator {
      font-size: 12px;
    }

    .mcp-status-indicator.healthy { color: #28a745; }
    .mcp-status-indicator.stopped { color: #6c757d; }
    .mcp-status-indicator.starting { color: #ffc107; }

    .mcp-checkbox {
      width: 20px;
      height: 20px;
      border: 2px solid #dee2e6;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      background: white;
      color: transparent;
    }

    .mcp-card.selected .mcp-checkbox {
      background: #28a745;
      border-color: #28a745;
      color: white;
    }

    .mcp-card-body {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .mcp-card-name {
      font-weight: 600;
      font-size: 14px;
      color: #333;
      word-break: break-word;
    }

    .mcp-card-category {
      font-size: 11px;
      color: #007bff;
      text-transform: uppercase;
      font-weight: 500;
    }

    .mcp-card-description {
      font-size: 12px;
      color: #666;
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .no-mcps-large {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px;
      text-align: center;
      background: #f8f9fa;
      border-radius: 12px;
      color: #666;
    }

    .no-mcps-icon {
      font-size: 48px;
      margin-bottom: 12px;
      opacity: 0.5;
    }

    .no-mcps-large p {
      font-size: 14px;
      margin: 0;
    }

    /* Persona Tab */
    .persona-tab {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .persona-header {
      margin-bottom: 12px;
    }

    .persona-hint {
      display: block;
      color: #666;
      font-size: 12px;
      margin-top: 4px;
    }

    .persona-editor {
      flex: 1;
      min-height: 200px;
      padding: 16px;
      border: 1px solid #dee2e6;
      border-radius: 8px;
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 13px;
      line-height: 1.6;
      resize: none;
      transition: border-color 0.2s;
    }

    .persona-editor:focus {
      outline: none;
      border-color: #007bff;
      box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.15);
    }

    .persona-editor.invalid {
      border-color: #dc3545;
    }

    .persona-footer {
      margin-top: 8px;
    }

    /* Preview Tab */
    .preview-tab {
      padding: 0;
      overflow-y: auto;
    }

    .preview-container {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .preview-section {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 16px;
    }

    .preview-section h4 {
      margin: 0 0 12px;
      font-size: 13px;
      font-weight: 600;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* Agent Card Preview - Full Width */
    .agent-card-preview-full {
      background: white;
      border: 2px solid #007bff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0, 123, 255, 0.15);
    }

    .card-header-preview {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px;
      background: linear-gradient(135deg, #f8f9fa 0%, white 100%);
      border-bottom: 1px solid #eee;
    }

    .agent-emoji-preview {
      font-size: 28px;
      width: 44px;
      height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: white;
      border-radius: 50%;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
    }

    .agent-group-badge-preview {
      padding: 6px 12px;
      background: #f0f0f0;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      color: #666;
    }

    .agent-group-badge-preview[data-group="development"] { color: #3b82f6; background: rgba(59, 130, 246, 0.15); }
    .agent-group-badge-preview[data-group="crm"] { color: #8b5cf6; background: rgba(139, 92, 246, 0.15); }
    .agent-group-badge-preview[data-group="documentation"] { color: #10b981; background: rgba(16, 185, 129, 0.15); }
    .agent-group-badge-preview[data-group="devops"] { color: #f59e0b; background: rgba(245, 158, 11, 0.15); }
    .agent-group-badge-preview[data-group="orchestration"] { color: #ec4899; background: rgba(236, 72, 153, 0.15); }
    .agent-group-badge-preview[data-group="testing"] { color: #06b6d4; background: rgba(6, 182, 212, 0.15); }
    .agent-group-badge-preview[data-group="career"] { color: #84cc16; background: rgba(132, 204, 22, 0.15); }
    .agent-group-badge-preview[data-group="other"] { color: #6b7280; background: rgba(107, 114, 128, 0.15); }

    .card-body-preview {
      padding: 12px;
    }

    .agent-name-preview {
      margin: 0 0 4px;
      font-size: 16px;
      font-weight: 600;
      color: #333;
    }

    .agent-description-preview {
      margin: 0 0 8px;
      font-size: 13px;
      color: #666;
      line-height: 1.4;
    }

    .agent-tags-preview {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-bottom: 8px;
    }

    .tag-preview {
      padding: 2px 8px;
      background: #e9ecef;
      border-radius: 10px;
      font-size: 11px;
      color: #666;
    }

    .agent-mcps-preview {
      font-size: 12px;
      color: #007bff;
    }

    /* Persona Preview */
    .persona-preview-box {
      background: white;
      border: 1px solid #dee2e6;
      border-radius: 6px;
      padding: 16px;
      max-height: 200px;
      overflow-y: auto;
    }

    .persona-preview-content {
      font-size: 13px;
      line-height: 1.6;
      color: #333;
      white-space: pre-wrap;
      font-family: inherit;
    }

    /* Summary */
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }

    .summary-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .summary-label {
      font-size: 11px;
      color: #888;
      text-transform: uppercase;
    }

    .summary-value {
      font-size: 14px;
      font-weight: 600;
      color: #333;
    }

    /* Footer */
    .creator-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-top: 1px solid #eee;
      background: #f8f9fa;
      flex-shrink: 0;
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

    /* Responsive */
    @media (max-width: 600px) {
      .form-row {
        flex-direction: column;
        gap: 12px;
      }

      .tabs-nav {
        padding: 8px 12px;
      }

      .tab-btn {
        padding: 8px 12px;
        font-size: 12px;
      }

      .tab-label {
        display: none;
      }

      .summary-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }
  `]
})
export class AgentCreatorComponent implements OnInit, OnChanges {
  @Input() isVisible: boolean = false;
  @Input() agentToEdit: Agent | null = null;
  @Output() agentCreated = new EventEmitter<AgentCreationData>();
  @Output() agentUpdated = new EventEmitter<{ agentId: string; updates: AgentCreationData }>();
  @Output() close = new EventEmitter<void>();

  // Tab state
  activeTab: TabType = 'definition';

  // Track if we've already populated for this edit session
  private lastEditedAgentId: string | null = null;
  private isLoadingPersona: boolean = false;

  constructor(private agentService: AgentService) { }

  ngOnInit(): void {
    this.loadMcps();
  }

  ngOnChanges(changes: SimpleChanges): void {
    console.log('🔄 [CREATOR] ngOnChanges triggered:', {
      isVisibleChanged: !!changes['isVisible'],
      agentToEditChanged: !!changes['agentToEdit'],
      isVisible: this.isVisible,
      agentToEdit: this.agentToEdit?.id || null,
      lastEditedAgentId: this.lastEditedAgentId
    });

    // Reset lastEditedAgentId when modal closes
    if (changes['isVisible'] && !this.isVisible) {
      console.log('🔄 [CREATOR] Modal closed, resetting lastEditedAgentId');
      this.lastEditedAgentId = null;
    }

    // Reset tab to definition when modal opens
    if (changes['isVisible'] && this.isVisible) {
      this.activeTab = 'definition';
    }

    // Only populate form once per edit session
    // This prevents double-calling when both inputs change in the same cycle
    if (this.isVisible && this.agentToEdit) {
      const currentAgentId = this.agentToEdit.id;
      if (currentAgentId !== this.lastEditedAgentId) {
        console.log('🔄 [CREATOR] New agent to edit detected, populating form for:', currentAgentId);
        this.lastEditedAgentId = currentAgentId;
        this.populateFormForEdit();
      } else {
        console.log('🔄 [CREATOR] Same agent, skipping populate');
      }
    }
  }

  get isEditMode(): boolean {
    return !!this.agentToEdit;
  }

  private populateFormForEdit(): void {
    if (!this.agentToEdit) {
      console.warn('⚠️ [CREATOR] populateFormForEdit called but agentToEdit is null');
      return;
    }

    if (this.isLoadingPersona) {
      console.warn('⚠️ [CREATOR] Already loading persona, skipping');
      return;
    }

    console.log('✏️ [CREATOR] ========== POPULATING FORM FOR EDIT ==========');
    console.log('✏️ [CREATOR] Full agent object:', JSON.stringify(this.agentToEdit, null, 2));
    console.log('✏️ [CREATOR] Agent ID:', this.agentToEdit.id);
    console.log('✏️ [CREATOR] Agent Name:', this.agentToEdit.name);

    // Extract name without _Agent suffix and remove any spaces/special chars
    const fullName = this.agentToEdit.name || this.agentToEdit.id;
    const nameWithoutSuffix = fullName.replace(/_Agent$/, '');
    // Clean the name - remove spaces and special characters (same as onNameInput)
    this.agentName = nameWithoutSuffix.replace(/[^a-zA-Z0-9_]/g, '');

    this.agentDescription = this.agentToEdit.description || '';
    this.selectedEmoji = this.agentToEdit.emoji || '🤖';
    this.customEmoji = '';
    this.selectedGroup = this.agentToEdit.group || 'other';
    this.tags = [...(this.agentToEdit.tags || [])];
    this.selectedMcps = [...(this.agentToEdit.mcp_configs || [])];

    console.log('✏️ [CREATOR] Form fields populated:');
    console.log('   - agentName:', this.agentName);
    console.log('   - agentDescription:', this.agentDescription);
    console.log('   - selectedEmoji:', this.selectedEmoji);
    console.log('   - selectedGroup:', this.selectedGroup);
    console.log('   - tags:', this.tags);
    console.log('   - selectedMcps:', this.selectedMcps);

    // Load persona content from API - use the ID as-is from backend
    const agentId = this.agentToEdit.id;
    console.log('📄 [CREATOR] Loading persona for agent ID:', agentId);

    if (!agentId) {
      console.error('❌ [CREATOR] No agent ID available for persona loading');
      this.personaContent = '';
      return;
    }

    // Set loading flag to prevent duplicate calls
    this.isLoadingPersona = true;
    this.personaContent = ''; // Clear while loading

    console.log('📄 [CREATOR] Calling API: /api/agents/' + agentId + '/persona');

    this.agentService.getAgentPersona(agentId).subscribe({
      next: (result) => {
        console.log('✅ [CREATOR] ========== PERSONA API RESPONSE ==========');
        console.log('✅ [CREATOR] Full response:', JSON.stringify(result, null, 2));
        console.log('✅ [CREATOR] agent_id from response:', result.agent_id);
        console.log('✅ [CREATOR] has_persona:', result.has_persona);
        console.log('✅ [CREATOR] persona_content length:', result.persona_content?.length || 0);
        console.log('✅ [CREATOR] persona_content preview:', result.persona_content?.substring(0, 200));

        this.personaContent = result.persona_content || '';
        this.isLoadingPersona = false;

        console.log('✅ [CREATOR] personaContent set to:', this.personaContent.length, 'characters');
        console.log('✅ [CREATOR] ================================================');
      },
      error: (err) => {
        console.error('❌ [CREATOR] ========== PERSONA API ERROR ==========');
        console.error('❌ [CREATOR] Error object:', err);
        console.error('❌ [CREATOR] Error message:', err.message);
        console.error('❌ [CREATOR] Fallback: checking if agent object has prompt field');

        // Fallback: try to use the prompt field from the agent object if available
        // This is a workaround for when the persona API endpoint fails
        if (this.agentToEdit?.prompt) {
          console.log('⚠️ [CREATOR] Using agent.prompt as fallback for persona');
          this.personaContent = this.agentToEdit.prompt;
        } else {
          console.warn('⚠️ [CREATOR] No fallback available, persona will be empty');
          console.warn('⚠️ [CREATOR] Backend API /api/agents/{id}/persona returned 500 error');
          console.warn('⚠️ [CREATOR] Please check the gateway logs for the root cause');
          this.personaContent = '';
        }
        this.isLoadingPersona = false;
      }
    });
  }

  // Available emojis - compact list
  availableEmojis = ['🚀', '🔐', '📊', '🛡️', '⚡', '🎯', '🧠', '💻', '📱', '🌐', '🔍', '🧪'];

  // Agent groups
  agentGroups = AGENT_GROUPS;

  // Form data
  selectedEmoji: string = '🤖';
  customEmoji: string = '';
  agentName: string = '';
  agentDescription: string = '';
  selectedGroup: string = 'other';
  tags: string[] = [];
  newTag: string = '';
  personaContent: string = '';

  // MCP Data
  availableMcps: MCPRegistryEntry[] = [];
  filteredMcps: MCPRegistryEntry[] = [];
  selectedMcps: string[] = [];
  mcpFilter: McpFilter = { search: '', category: '', status: '' };
  mcpCategories: string[] = [];

  loadMcps(): void {
    this.agentService.getAvailableMcps().subscribe({
      next: (mcps) => {
        this.availableMcps = mcps;
        this.extractCategories();
        this.filterMcps();
        console.log('✅ [CREATOR] Loaded MCPs:', mcps.length);
      },
      error: (err) => console.error('❌ [CREATOR] Error loading MCPs:', err)
    });
  }

  extractCategories(): void {
    const categories = new Set<string>();
    this.availableMcps.forEach(mcp => {
      if (mcp.metadata?.category) {
        categories.add(mcp.metadata.category);
      }
    });
    this.mcpCategories = Array.from(categories).sort();
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

  // Group methods
  getSelectedGroupIcon(): string {
    const group = this.agentGroups.find(g => g.id === this.selectedGroup);
    return group?.icon || '📦';
  }

  getSelectedGroupLabel(): string {
    const group = this.agentGroups.find(g => g.id === this.selectedGroup);
    return group?.label || 'Outro';
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
    if (!this.agentName) return '';
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

  // Definition tab validation
  isDefinitionValid(): boolean {
    return this.isNameValid() && this.isDescriptionValid();
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
    if (content.length === 0) return 'Deve começar com # (Markdown) e ter mínimo 50 caracteres';
    if (!content.startsWith('#')) return 'Deve começar com um cabeçalho Markdown (#)';
    if (content.length < 50) return `Faltam ${50 - content.length} caracteres`;
    return '✓ Válido';
  }

  getPersonaPreview(): string {
    const content = this.personaContent || 'Persona não definida...';
    // Simple markdown-like formatting for preview
    return content
      .replace(/^### (.+)$/gm, '<strong style="font-size: 14px;">$1</strong>')
      .replace(/^## (.+)$/gm, '<strong style="font-size: 15px;">$1</strong>')
      .replace(/^# (.+)$/gm, '<strong style="font-size: 16px;">$1</strong>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^- (.+)$/gm, '• $1')
      .replace(/\n/g, '<br>');
  }

  // MCP methods
  filterMcps(): void {
    let result = [...this.availableMcps];

    if (this.mcpFilter.search) {
      const search = this.mcpFilter.search.toLowerCase();
      result = result.filter(mcp => mcp.name.toLowerCase().includes(search));
    }

    if (this.mcpFilter.category) {
      result = result.filter(mcp => mcp.metadata?.category === this.mcpFilter.category);
    }

    if (this.mcpFilter.status) {
      result = result.filter(mcp => mcp.status === this.mcpFilter.status);
    }

    result.sort((a, b) => {
      const aSelected = this.selectedMcps.includes(a.name);
      const bSelected = this.selectedMcps.includes(b.name);
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;
      return a.name.localeCompare(b.name);
    });

    this.filteredMcps = result;
  }

  toggleMcp(mcp: MCPRegistryEntry): void {
    const index = this.selectedMcps.indexOf(mcp.name);
    if (index === -1) {
      this.selectedMcps.push(mcp.name);
    } else {
      this.selectedMcps.splice(index, 1);
    }
    this.filterMcps();
  }

  removeMcp(mcpName: string): void {
    const index = this.selectedMcps.indexOf(mcpName);
    if (index !== -1) {
      this.selectedMcps.splice(index, 1);
      this.filterMcps();
    }
  }

  isMcpSelected(name: string): boolean {
    return this.selectedMcps.includes(name);
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'healthy': return '●';
      case 'stopped': return '○';
      case 'starting': return '◐';
      default: return '?';
    }
  }

  formatMcpName(name: string): string {
    return name.length > 20 ? name.substring(0, 17) + '...' : name;
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
        group: this.selectedGroup,
        tags: [...this.tags],
        persona_content: this.personaContent.trim(),
        mcp_configs: [...this.selectedMcps]
      };

      if (this.isEditMode && this.agentToEdit) {
        console.log('📝 [CREATOR] Updating agent:', this.agentToEdit.id, agentData);
        this.agentUpdated.emit({
          agentId: this.agentToEdit.id,
          updates: agentData
        });
      } else {
        console.log('🛠️ [CREATOR] Creating agent:', agentData);
        this.agentCreated.emit(agentData);
      }
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
    console.log('🔄 [CREATOR] Resetting form');
    this.selectedEmoji = '🤖';
    this.customEmoji = '';
    this.agentName = '';
    this.agentDescription = '';
    this.selectedGroup = 'other';
    this.tags = [];
    this.newTag = '';
    this.personaContent = '';
    this.selectedMcps = [];
    this.mcpFilter = { search: '', category: '', status: '' };
    this.filterMcps();
    this.activeTab = 'definition';
    // Reset tracking flags
    this.lastEditedAgentId = null;
    this.isLoadingPersona = false;
  }
}
